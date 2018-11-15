/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var helper = require('./helper.js');
var logger = helper.getLogger('instantiate-chaincode');

var TWO_ORG_MEMBERS_AND_ADMINS = [
	{role: {name: 'member', mspId: 'Org1MSP'}},
	{role: {name: 'member', mspId: 'Org2MSP'}},
	{role: {name: 'admin',  mspId: 'Org1MSP'}},
	{role: {name: 'admin',  mspId: 'Org2MSP'}},
];

var ONE_OF_ONE_ORG_MEMBER = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '1-of': [
			{'1-of': [{ 'signed-by': 0 }]},
			{'1-of': [{ 'signed-by': 1 }]}
		]
    }
};

var ONE_OF_TWO_ORG_MEMBER = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
    }
};

var TWO_OF_TWO_ORG_MEMBER = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '2-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
    }
};

var THREE_OF_TWO_ORG_MEMBER = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '8-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]
    }
};

var ONE_OF_TWO_ORG_MEMBER_AND_ADMIN = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '2-of': [
			{'1-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]},
			{'1-of': [{ 'signed-by': 2 }, { 'signed-by': 3 }]},
		]
    }
};

var ONE_OF_TWO_ORG_MEMBER_OR_ADMIN = {
    identities: TWO_ORG_MEMBERS_AND_ADMINS,
    policy: {
        '1-of': [
			{'2-of': [{ 'signed-by': 0 }, { 'signed-by': 1 }]},
			{'1-of': [{ 'signed-by': 2 }, { 'signed-by': 3 }]},
		]
    }
};

var instantiateChaincode = async function(peerNames, channelName, chaincodeName, chaincodeVersion, chaincodeType, functionName, args, userName, orgName) {
	logger.debug('\n\n============ Instantiate chaincode on channel ' + channelName + ' on peer %s ============\n', peerNames);
	let error_message = null;
	let peers = [];
	let rets = null;
	try {
		let client = helper.getClientForOrg(orgName);
		var channel = client.getChannel(channelName);
		var peerName;

		// TODO: instantiate は 1 peer で行うので service discovery なしで良いはず。
		if (util.isArray(peerNames) == false) {
			logger.debug('service discovery enabled');
			let peer = helper.getPeer(peerNames);
			channel.addPeer(peer, client.getMspid, null, true); // replace should be true?
			await channel.initialize({
				discover: true,
				target: peer
			});
			peerName = peerNames;
		} else {
			logger.debug('service discovery disabled');

			peerName = peerNames[0];
		}

		// Get an admin-based transactionID: admin-based transactionID indicates
		// that the admin identity should be used to sign the proposal request.
		let tx_id = client.newTransactionID(true);

		// 自分で instantiate するなら endorsement policy は知っていて当然なのだが、
		// 既存の chaincode を取得して使用したい場合はどうするか? -> discovery
		let endorsementPolicy = null;
		switch (args['endorsementPolicy']) {
		case 'ONE_OF_ONE_ORG_MEMBER':
			endorsementPolicy = ONE_OF_ONE_ORG_MEMBER;
			break;
		case 'ONE_OF_TWO_ORG_MEMBER':
			endorsementPolicy = ONE_OF_TWO_ORG_MEMBER;
			break;
		case 'TWO_OF_TWO_ORG_MEMBER':
			endorsementPolicy = TWO_OF_TWO_ORG_MEMBER;
logger.error("endorsement policy: " + util.inspect(endorsementPolicy));
			break;
		case 'THREE_OF_TWO_ORG_MEMBER':
			endorsementPolicy = THREE_OF_TWO_ORG_MEMBER;
			break;
		case 'ONE_OF_TWO_ORG_MEMBER_AND_ADMIN':
			endorsementPolicy = ONE_OF_TWO_ORG_MEMBER_AND_ADMIN;
			break;
		case 'ONE_OF_TWO_ORG_MEMBER_OR_ADMIN':
			endorsementPolicy = ONE_OF_TWO_ORG_MEMBER_OR_ADMIN;
			break;
		}

		// send proposal to endorser
		let request = {
			'endorsement-policy': endorsementPolicy,
			targets : peerName, // helper.getHeadPeerFromOrg(orgName),
			chaincodeId: chaincodeName,
			chaincodeType: chaincodeType,
			chaincodeVersion: chaincodeVersion,
			// args: args, // to be removed
			txId: tx_id
		};

		if (args['collectionFile'] != 'null')
			request['collections-config'] = args['collectionFile'];

		if (functionName)
			request.fcn = functionName;

		let results;
		if (args['update'] == true) {
			results = await channel.sendUpgradeProposal(request, 60000);
		} else {
			results = await channel.sendInstantiateProposal(request, 60000);
		}

		helper.verifyProposalResponses(results);

		peers = helper.getPeers();
		let event_hubs = channel.getChannelEventHubsForOrg();
		let deployId = tx_id.getTransactionID();
		let promises = helper.enableEventHubs(event_hubs, deployId);

		let orderer_request = {
			txId: tx_id,
			proposalResponses: results[0],
			proposal: results[1]
		};
		let sendPromise = channel.sendTransaction(orderer_request);
		promises.push(sendPromise);
		results = await Promise.all(promises);
		rets = helper.checkResponse(results, event_hubs);

		let status = "success";
		if (rets.status != "success") {
			status = "failure";
		}
		return {
			status: status,
			data: {
				transactionId: deployId
			},
			message: rets.message
		};
	} catch (error) {
		return {
			status: "failure",
			data: null,
			message: error.toString()
		};
	}
};
exports.instantiateChaincode = instantiateChaincode;
