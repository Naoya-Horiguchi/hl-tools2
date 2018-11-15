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
var logger = helper.getLogger('Query');
var mkdirp = require('mkdirp');

var hfc = require('fabric-client');

var queryChaincode = async function(peerName, channelName, chaincodeName, args, fcn, username, org_name) {
	try {
		var client = helper.getClientForOrg(org_name, username);
		var channel = await helper.getClientChannel(client, channelName);
		var peer = helper.getPeer(peerName);

		var request = {
            // for sdk 1.3?
			// targets : [peer], //queryByChaincode allows for multiple targets
			targets : peer, //queryByChaincode allows for multiple targets
			chaincodeId: chaincodeName,
			fcn: fcn,
			args: args
		};
		let response_payloads = await channel.queryByChaincode(request, true);
		if (response_payloads) {
			for (let i = 0; i < response_payloads.length; i++) {
				logger.info(args[0]+' now has ' + response_payloads[i].toString('utf8') +
					' after the move');
			}
			return response_payloads[0].toString('utf8');
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return error.toString();
	}
};

var getBlockByNumber = async function(peerName, channelName, blockNumber, username, org_name) {
	try {
		logger.error('user:%s, org:%s, peer:%s, channel:%s, block#:%d', username, org_name, peerName, channelName, blockNumber);

		var client = helper.getClientForOrg(org_name, username);
		var channel = await helper.getClientChannel(client, channelName);
		var peer = helper.getPeer(peerName);
// // 名前に :7051 が含んでいないといけないようだ [2018-08-01 Wed 00:49]
// logger.error('peer -- \n %s', util.inspect(peer));
		// var user = await client.getUserContext(username, true);
		let user = await client.getUserContext(username);
		// これが null なのが問題らしい

		// let client = helper.getClientForOrg(org_name, username);
		// let channel = client.newChannel(channelName);
		// var peer = await channel.getChannelPeer(peerName);
		// logger.error('---> peer %s', util.inspect(peer));
		// channel.addPeer(peer, 'org1MSP', null, true); // replace should be true?

//		let response_payload = await channel.queryBlock(parseInt(blockNumber), peerName);
//		let response_payload = await channel.queryBlock(parseInt(blockNumber), 'peer1-org1:7051');

		let response_payload = await channel.queryBlock(parseInt(blockNumber), peer);
		//let response_payload = await channel.queryBlock(12, peerName);
		if (response_payload) {
			logger.debug(response_payload);
			return response_payload;
		} else {
			logger.error('response_payload is null');
			return 'response_payload is null';
		}
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return error.toString();
	}
};

var getTransactionByID = async function(peerName, channelName, trxnID, username, org_name) {
	try {
		logger.error('getTransactionByID: user:%s, org:%s, peer:%s, channel:%s, block#:%d', username, org_name, peerName, channelName, trxnID);

		var client = helper.getClientForOrg(org_name, username);
		var channel = await helper.getClientChannel(client, channelName);
		var peer = helper.getPeer(peerName);

		let response_payload = await channel.queryTransaction(trxnID, peer);
		if (response_payload) {
			logger.debug(response_payload);
			return response_payload;
		} else {
			logger.error('response_payload is null');
			return 'response_payload is null';
		}
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return error.toString();
	}
};

var getBlockByHash = async function(peerName, channelName, hash, username, org_name) {
	try {
		var client = helper.getClientForOrg(org_name, username);
		var channel = await helper.getClientChannel(client, channelName);
		var peer = helper.getPeer(peerName);

		let response_payload = await channel.queryBlockByHash(Buffer.from(hash), peer);
		if (response_payload) {
			logger.debug(response_payload);
			return response_payload;
		} else {
			logger.error('response_payload is null');
			return 'response_payload is null';
		}
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return error.toString();
	}
};

var getChainInfo = async function(peerName, channelName, username, org_name) {
	var client = helper.getClientForOrg(org_name, username);
	var channel = await helper.getClientChannel(client, channelName);

	var peer = await helper.buildTarget(peerName, org_name);
	try {
		let response = await channel.queryInfo(peer, true);
		if (!response) {
			throw new Error('response payload is null');
		}
		return {
			status: "success",
			data: {
				chainInfo: response
			},
			message: ''
		}
	} catch (error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return {
			status: "failure",
			data: null,
			message: error.toString()
		}
	}
};

var getInstalledChaincodes = async function(peerName, channelName, type, username, org_name) {
	var client = helper.getClientForOrg(org_name, username);

	var peer = await helper.buildTarget(peerName, org_name);
	try {
		let response = null
		if (type === 'installed') {
			response = await client.queryInstalledChaincodes(peer, true); //use the admin identity
		} else {
			var channel = await helper.getClientChannel(client, channelName);
			response = await channel.queryInstantiatedChaincodes(peer, true); //use the admin identity
		}
		let details = [];
		if (response) {
			for (let i = 0; i < response.chaincodes.length; i++) {
				details.push({
					name: response.chaincodes[i].name,
					version: response.chaincodes[i].version,
					path: response.chaincodes[i].path
				});
			}
		}
		return {
			status: "success",
			data: details, // JSON.stringify(details).toString(); ?
			message: ""
		};
	} catch (error) {
		return {
			status: "failure",
			data: null,
			message: error.toString()
		};
	}
};

var getChannels = async function(peerName, username, org_name) {
	var client = helper.getClientForOrg(org_name, username);

	// TODO: really need this?
    // let adminKey = fs.readFileSync('run/fabric-client-kv-org1/privkey_org1');
	// // let adminCert = fs.readFileSync('network_data/orgs/org1/admin/msp/signcerts/cert.pem');
	// let adminCert = fs.readFileSync('network_data/orgs/org1/admin/msp/admincerts/cert.pem');
    // client.setAdminSigningIdentity(Buffer.from(adminKey).toString(), Buffer.from(adminCert).toString(), 'org1MSP');

	// var peer = await helper.buildTarget(peerName, org_name);
	var peer = helper.getPeer(peerName); //await helper.buildTarget(peerName, org_name);
	try {
		var message = "";
		var channels = [];

		const response = await client.queryChannels(peer, true);
		if (response) {
			for (let i = 0; i < response.channels.length; i++) {
				channels.push(response.channels[i].channel_id);
			}
			logger.debug(channels);
		} else {
			message = 'response payloads is null';
		}
		return {
			status: "success",
			data: {
				channels: channels
			},
			message: message
		}
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return {
			status: "failure",
			data: null,
			message: error.toString()
		}
	}
};

var printResponse = function(error, response) {
	if (error) console.log('Error:', error); else console.log(response);
}

// TODO: triggered by Fabric event
// TODO: can we get info of processing/rejected transaction?
var storeBlockchainData = async function(peerName, channelNames, userName, orgName) {
	return 'tmp';
	try {
		// TODO: how to handle default value?
		if (peerName == undefined) { peerName = 'peer0.org1.example.com'; }
		if (channelNames == null) {
			channelNames = await getChannels(peerName, userName, orgName);
		} else {
			channelNames = [channelName];
		}
		if (userName == undefined) { userName = 'Jim'; }
		if (orgName == undefined) { orgName = 'org1'; }
		var dataDir = hfc.getConfigSetting('bc_data_dir');

		channelNames.forEach(async (channelName) => {
			var channelDir = dataDir + '/' + channel;
			var blockDir = channelDir + '/blocks';
			var peerDir = channelDir + '/peers/' + peer;
			var peerBlockDir = peerDir + '/blocks';
			mkdirp(dataDir, null);
			mkdirp(channelDir, null);
			mkdirp(blockDir, null);
			mkdirp(channelDir + '/peers/', null);
			mkdirp(peerDir, null);
			mkdirp(peerBlockDir, null);

			var client = await helper.getClientForOrg(orgName, userName);
			var channel = await helper.getClientChannel(client, channelName);
			var peer = helper.getPeer(peerName);

			let msgChainInfo = await getChainInfo(peerName, channelName, userName, orgName);
			fs.writeFile(channelDir + '/chaininfo', JSON.stringify(msgChainInfo), 'utf8', null);

			let msgInstalledChaincodes = await getInstalledChaincodes(peerName, null, 'installed', userName, orgName);
			fs.writeFile(channelDir + '/chaincodes_installed', JSON.stringify(msgInstalledChaincodes), 'utf8', null);
			// TODO: channelDir + /chaincodes/installed/...

			let msgInstantiatedChaincodes = await getInstalledChaincodes(peerName, channelName, 'instantiated', userName, orgName);
			fs.writeFile(channelDir + '/chaincodes_instantiated', JSON.stringify(msgInstantiatedChaincodes), 'utf8', null);
			// TODO: channelDir + /chaincodes/instantiated/...

			var height_low = msgChainInfo.height.low;
			var height_high = msgChainInfo.height.high;
			// console.log("### height.low %s", msgChainInfo.height.low);

			for (var i = height_high; i < height_low; i++) {
				let msgBlockByNumber = await getBlockByNumber(peerName, channelName, i, userName, orgName);
				let blockDataHash = msgBlockByNumber.header.data_hash;
				mkdirp(blockDir + '/' + blockDataHash, null);
				fs.writeFile(blockDir + '/' + blockDataHash + '/block', JSON.stringify(msgBlockByNumber), 'utf8', null);
				fs.writeFile(blockDir + '/' + blockDataHash + '/nr_tx', msgBlockByNumber.data.data.length, 'utf8', null);
				fs.writeFile(blockDir + '/' + blockDataHash + '/tx_ids', msgBlockByNumber.data.data[0].payload.header.channel_header.tx_id, 'utf8', null);
				if (!fs.existsSync(peerBlockDir + '/' + i)) {
					fs.symlinkSync("../../../blocks/" + blockDataHash, peerBlockDir + '/' + i);
				}
			}
		});
	} catch(error) {
		logger.error('Failed to query due to error: ' + error.stack ? error.stack : error);
		return error.toString();
	}
};

exports.queryChaincode = queryChaincode;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
exports.storeBlockchainData = storeBlockchainData;
