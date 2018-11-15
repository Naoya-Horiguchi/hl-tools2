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
var logger = helper.getLogger('invoke-chaincode');

var invokeChaincode = async function(peerNames, channelName, chaincodeName, fcn, args, username, org_name) {
	logger.debug(util.format('\n============ invoke transaction on channel %s ============\n', channelName));
	let error_message = null;
	let tx_id_string = null;
	let eventHubs = [];
	let peers = [];
	let rets = null;
	try {
		let client = helper.getClientForOrg(org_name, username);
		let channel = client.getChannel(channelName);

		if (util.isArray(peerNames) == false) {
			logger.debug('service discovery enabled');
			client.setConfigSetting('initialize-with-discovery', true);
			let peer = helper.getPeer(peerNames);
			channel.addPeer(peer, client.getMspid, null, true); // replace should be true?
			await channel.initialize({
				discover: true,
				target: peer
			});
		} else {
			logger.debug('service discovery disabled');
			peerNames.forEach(async (peerName) => {
				peers.push(helper.getPeer(peerName));
			})
		}

		let tx_id = client.newTransactionID(true);
		tx_id_string = tx_id.getTransactionID();

		let request = {
			chaincodeId: chaincodeName,
			fcn: fcn,
			args: args,
			chainId: channelName,
			txId: tx_id
		};
		if (util.isArray(peerNames) == true) {
			request["targets"] = peers;
		}

		let results = await channel.sendTransactionProposal(request);
		let proposalResponses = helper.verifyProposalResponses(results);

		// Or using channel.newChannelEventHub(peer) for each peer?
		let event_hubs = channel.getChannelEventHubsForOrg();
		let promises = helper.enableEventHubs(event_hubs, tx_id_string);
		let orderer_request = {
			txId: tx_id,
			proposalResponses: results[0],
			proposal: results[1]
		};
		let sendPromise = channel.sendTransaction(orderer_request);
		promises.push(sendPromise);
		results = await Promise.all(promises);
		let ordererResponses = helper.checkResponse(results, event_hubs);
		ordererResponses.data.transactionId = tx_id_string;
		ordererResponses.data.proposalResponses = proposalResponses;
		return {
			status: ordererResponses.status,
			data: {
				transactionId: tx_id_string,
				proposalResponses: proposalResponses
			},
			message: ordererResponses.message
		}
	} catch (error) {
		return {
			status: "failure",
			data: null,
			message: error.toString()
		};
	}
};

// const {Gateway, InMemoryWallet, FileSystemWallet, X509WalletMixin, DefaultEventHandlerStrategies} = require('fabric-network/index.js');

//<2018-11-13 Tue 15:41>// <2018-11-13 Tue 15:34> いったん fabric-network ははずす。
//<2018-11-13 Tue 15:41>// var hfc = require('fabric-client');
//<2018-11-13 Tue 15:41>// var hfn = require('fabric-network');
//<2018-11-13 Tue 15:41>var glob = require('glob');
//<2018-11-13 Tue 15:41>// const credPath = fixtures + '/channel/crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com';
//<2018-11-13 Tue 15:41>// const cert = fs.readFileSync(credPath + '/signcerts/User1@org1.example.com-cert.pem').toString();
//<2018-11-13 Tue 15:41>// const key = fs.readFileSync(credPath + '/keystore/e4af7f90fa89b3e63116da5d278855cfb11e048397261844db89244549918731_sk').toString();
//<2018-11-13 Tue 15:41>const inMemoryWallet = new hfn.InMemoryWallet();
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>async function inMemoryIdentitySetup(id, mspid, cert, key) {
//<2018-11-13 Tue 15:41>    await inMemoryWallet.import(id, hfn.X509WalletMixin.createIdentity(mspid, cert, key));
//<2018-11-13 Tue 15:41>}
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>async function createContract(gateway, gatewayOptions, channelName, chaincodeId) {
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	var ccp = helper.getNetworkConfigJson().toString();
//<2018-11-13 Tue 15:41>	logger.error("createContract 0 %s", ccp);
//<2018-11-13 Tue 15:41>	logger.error("createContract 0 %s", util.inspect(gatewayOptions));
//<2018-11-13 Tue 15:41>    await gateway.connect(JSON.parse(ccp.toString()), gatewayOptions);
//<2018-11-13 Tue 15:41>	logger.error("createContract 10 %s", util.inspect(gateway));
//<2018-11-13 Tue 15:41>    const network = await gateway.getNetwork(channelName);
//<2018-11-13 Tue 15:41>	logger.error("createContract 20");
//<2018-11-13 Tue 15:41>    const contract = network.getContract(chaincodeId);
//<2018-11-13 Tue 15:41>	logger.error("createContract 30");
//<2018-11-13 Tue 15:41>    return contract;
//<2018-11-13 Tue 15:41>}
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>const getEventHubForOrg = async (gateway, orgMSP, channelName) => {
//<2018-11-13 Tue 15:41>    // bit horrible until we provide a proper api to get the underlying event hubs
//<2018-11-13 Tue 15:41>    const network = await gateway.getNetwork(channelName);
//<2018-11-13 Tue 15:41>    const orgpeer = network.getPeerMap().get(orgMSP)[0];
//<2018-11-13 Tue 15:41>    return network.getChannel().getChannelEventHub(orgpeer.getName());
//<2018-11-13 Tue 15:41>};
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>var compareVersions = require('compare-versions');
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>// using submitTransaction()
//<2018-11-13 Tue 15:41>var invokeChaincode2 = async function(peerNames, channelName, chaincodeName, fcn, args, username, org_name) {
//<2018-11-13 Tue 15:41>	if (hfc.getConfigSetting('sdk_version') && compareVersions(hfc.getConfigSetting('sdk_version'), '1.3') < 0)
//<2018-11-13 Tue 15:41>		return new Error('submitTransaction is not available');
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	let client = helper.getClientForOrg(org_name, username);
//<2018-11-13 Tue 15:41>	logger.error('--ae-aet-a-t-at-a %s', util.inspect(client));
//<2018-11-13 Tue 15:41>	// glob(path.join(process.cwd(), 'crypto-config/peerOrganizations/org1.example.com', "**/*_sk"), function (er, files) {
//<2018-11-13 Tue 15:41>	// 	logger.error('ppp %s', files);
//<2018-11-13 Tue 15:41>	// 	// files is an array of filenames.
//<2018-11-13 Tue 15:41>	// 	// If the `nonull` option is set, and nothing
//<2018-11-13 Tue 15:41>	// 	// was found, then files is ["**/*.js"]
//<2018-11-13 Tue 15:41>	// 	// er is an error object or null.
//<2018-11-13 Tue 15:41>	// })
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', path.join(process.cwd(), 'crypto-config/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/05e48b27a97da6cda3701976b0b522796900be7aefb8a2d2ba35709f86fbb516_sk'));
//<2018-11-13 Tue 15:41>	// let user = await client.getUserContext(username);
//<2018-11-13 Tue 15:41>	// let user = await helper.getRegisteredUser(username, org_name);
//<2018-11-13 Tue 15:41>	let user = await helper.getAdminUser(org_name);
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', util.inspect(user));
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', user.toString());
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', util.inspect(user.getIdentity()));
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', util.inspect(user.getSigningIdentity()));
//<2018-11-13 Tue 15:41>	// logger.error('--ae-aet-a-t-at-a %s', util.inspect(user.getCryptoSuite()));
//<2018-11-13 Tue 15:41>	var cryptosuite = user.getCryptoSuite();
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 11 %s', util.inspect(cryptosuite));
//<2018-11-13 Tue 15:41>	var cks = await cryptosuite._cryptoKeyStore._getKeyStore();
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 12 %s', util.inspect(cks));
//<2018-11-13 Tue 15:41>	var ski = user.getIdentity()._publicKey.getSKI();
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 22 %s', ski);
//<2018-11-13 Tue 15:41>	// var privkey = await cks.getKey(ski);
//<2018-11-13 Tue 15:41>	var privkey = await cks.getValue(ski + '-priv');
//<2018-11-13 Tue 15:41>	var pubkey = await cks.getValue(ski + '-pub');
//<2018-11-13 Tue 15:41>	// error check
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 33 %s', util.inspect(privkey));
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 44 %s', util.inspect(pubkey));
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	var msp_identity = helper.getOrgIdentity(org_name);
//<2018-11-13 Tue 15:41>	var msp_cert = msp_identity.cert.toString();
//<2018-11-13 Tue 15:41>	var msp_key = msp_identity.key.toString();
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 55 %s', util.inspect(msp_cert));
//<2018-11-13 Tue 15:41>	logger.error('--ae-a-at-a 66 %s', util.inspect(helper.getOrgIdentity(org_name)));
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	let org1EventHub;
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	// const network = new hfn.Network();
//<2018-11-13 Tue 15:41>	try {
//<2018-11-13 Tue 15:41>		logger.debug(util.format('\n============ invoke transaction on channel %s (using submitTransaction) ============\n', channelName));
//<2018-11-13 Tue 15:41>		const gateway = new hfn.Gateway();
//<2018-11-13 Tue 15:41>logger.error('abc');
//<2018-11-13 Tue 15:41>		// await inMemoryIdentitySetup('Admin@org1.example.com', client.getMspid(), msp_cert, msp_key);
//<2018-11-13 Tue 15:41>		// await inMemoryIdentitySetup(username, client.getMspid(), msp_cert, msp_key);
//<2018-11-13 Tue 15:41>		await inMemoryIdentitySetup('Jim', client.getMspid(), pubkey, privkey);
//<2018-11-13 Tue 15:41>logger.error('abc 2');
//<2018-11-13 Tue 15:41>// 		await inMemoryIdentitySetup('tlsId', client.getMspid(), pubkey, privkey);
//<2018-11-13 Tue 15:41>// logger.error('abc 3 %s', util.inspect(inMemoryWallet));
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		const contract = await createContract(gateway, {
//<2018-11-13 Tue 15:41>			wallet: inMemoryWallet,
//<2018-11-13 Tue 15:41>			identity: username
//<2018-11-13 Tue 15:41>			// identity: 'Jim',
//<2018-11-13 Tue 15:41>			// clientTlsIdentity: 'tlsId'
//<2018-11-13 Tue 15:41>		}, channelName, chaincodeName);
//<2018-11-13 Tue 15:41>logger.error('abc 4');
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// Obtain an event hub that that will be used by the underlying implementation
//<2018-11-13 Tue 15:41>		org1EventHub = await getEventHubForOrg(gateway, client.getMspid(), channelName);
//<2018-11-13 Tue 15:41>		const org2EventHub = await getEventHubForOrg(gateway, 'Org2MSP');
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// initialize eventFired to 0
//<2018-11-13 Tue 15:41>		let eventFired = 0;
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// have to register for all transaction events (a new feature in 1.3) as
//<2018-11-13 Tue 15:41>		// there is no way to know what the initial transaction id is
//<2018-11-13 Tue 15:41>		org1EventHub.registerTxEvent('all', (txId, code) => {
//<2018-11-13 Tue 15:41>			if (code === 'VALID') {
//<2018-11-13 Tue 15:41>				eventFired++;
//<2018-11-13 Tue 15:41>			}
//<2018-11-13 Tue 15:41>		}, () => {});
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		const response = await contract.submitTransaction('move', 'a', 'b','37');
//<2018-11-13 Tue 15:41>		// gateway.connect({
//<2018-11-13 Tue 15:41>		// 	wallet: wallet
//<2018-11-13 Tue 15:41>		// });
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		return {
//<2018-11-13 Tue 15:41>			status: 'success',
//<2018-11-13 Tue 15:41>			data: response,
//<2018-11-13 Tue 15:41>			message: ordererResponses.message
//<2018-11-13 Tue 15:41>		}
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		var result = "success";
//<2018-11-13 Tue 15:41>		var message = "";
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// await network.initialize(ccp, {
//<2018-11-13 Tue 15:41>		// 	identity: 'admin',
//<2018-11-13 Tue 15:41>		// 	wallet: wallet
//<2018-11-13 Tue 15:41>		// });
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// const contract = await network.getContract('market1234', 'commercial-paper');
//<2018-11-13 Tue 15:41>		// const paper = await contract.submitTransaction('issue', 'ibm', '1000000', '2019-03-31');
//<2018-11-13 Tue 15:41>		// await contract.submitTransaction('move', paper, 'acme', '900000');
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// let client = helper.getClientForOrg(org_name, username);
//<2018-11-13 Tue 15:41>		// let channel = client.getChannel(channelName);
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>		// if (util.isArray(peerNames) == false) {
//<2018-11-13 Tue 15:41>		// 	logger.debug('service discovery enabled');
//<2018-11-13 Tue 15:41>		// 	client.setConfigSetting('initialize-with-discovery', true);
//<2018-11-13 Tue 15:41>		// 	let peer = helper.getPeer(peerNames);
//<2018-11-13 Tue 15:41>		// 	channel.addPeer(peer, client.getMspid, null, true); // replace should be true?
//<2018-11-13 Tue 15:41>		// 	await channel.initialize({
//<2018-11-13 Tue 15:41>		// 		discover: true,
//<2018-11-13 Tue 15:41>		// 		target: peer
//<2018-11-13 Tue 15:41>		// 	});
//<2018-11-13 Tue 15:41>		// } else {
//<2018-11-13 Tue 15:41>		// 	logger.debug('service discovery disabled');
//<2018-11-13 Tue 15:41>		// 	peerNames.forEach(async (peerName) => {
//<2018-11-13 Tue 15:41>		// 		peers.push(helper.getPeer(peerName));
//<2018-11-13 Tue 15:41>		// 	})
//<2018-11-13 Tue 15:41>		// }
//<2018-11-13 Tue 15:41>	} catch (error) {
//<2018-11-13 Tue 15:41>		result = "failure";
//<2018-11-13 Tue 15:41>		message = error.toString();
//<2018-11-13 Tue 15:41>	} finally {
//<2018-11-13 Tue 15:41>		;
//<2018-11-13 Tue 15:41>		// network.disconnect();
//<2018-11-13 Tue 15:41>	}
//<2018-11-13 Tue 15:41>
//<2018-11-13 Tue 15:41>	return {
//<2018-11-13 Tue 15:41>		status: "failure",
//<2018-11-13 Tue 15:41>		data: null,
//<2018-11-13 Tue 15:41>		message: message
//<2018-11-13 Tue 15:41>	};
//<2018-11-13 Tue 15:41>};

exports.invokeChaincode = invokeChaincode;
//<2018-11-13 Tue 15:41>exports.invokeChaincode2 = invokeChaincode2;
