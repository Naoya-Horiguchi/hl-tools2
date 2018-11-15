/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');

var path = require('path');
var util = require('util');
var fs = require('fs');

var hfcac = require('fabric-ca-client');
var hfc = require('fabric-client');
var BlockDecoder = require('fabric-client/lib/BlockDecoder.js');

hfc.setLogger(logger);

var ORGS;
var clients = {};
var channels = {};
var caClients = {};
var peers = {};

var sleep = async function (sleep_time_ms) {
	return new Promise(resolve => setTimeout(resolve, sleep_time_ms));
}

var yaml = require('js-yaml');

var getClientChannel = async function(client, channelName) {
	var channel = client.getChannel(channelName);
	if (!channel) {
		let message = util.format('Channel %s was not defined in the connection profile', channelName);
		throw new Error(message);
	}
	return channel;
}

function newRemotes(names, forPeers, userOrg) {
	const client = getClientForOrg(userOrg);

	const targets = [];
	// find the peer that match the names
	let org_peers = hfc.getConfigSetting('peers');
	names.forEach((n) => {
		if (org_peers[n]) {
			// found a peer matching the name
			const data = fs.readFileSync(path.join(process.cwd(), org_peers[n].tlsCACerts.path));
			const grpcOpts = {
				'pem': Buffer.from(data).toString(),
				'ssl-target-name-override': org_peers[n].grpcOptions['ssl-target-name-override']
			};

			if (forPeers) {
				targets.push(client.newPeer(org_peers[n].url, grpcOpts));
			} else {
				const eh = client.newEventHub();
				eh.setPeerAddr(org_peers[n].eventUrl, grpcOpts);
				targets.push(eh);
			}
		}
	});

	if (targets.length === 0) {
		logger.error(util.format('Failed to find peers matching the names %s', names));
	}

	return targets;
}

var newPeers = function(names, org) {
    return newRemotes(names, true, org);
}
exports.newPeers = newPeers;

// If you need client TLS setting, you have to configure it before calling
// buildTarget(). otherwise ssl connection might fail with 'bad certificate'.
var buildTarget = function(peer, org) {
	let target = null;
	if (typeof peer !== 'undefined') {
		const targets = newPeers([peer], org);
		if (targets && targets.length > 0) {
			target = targets[0];
		}
	}
	return target;
}
exports.buildTarget = buildTarget;

function getKeyStoreForOrg(org) {
	if (org === undefined)
		throw new Error('undefined org');
    return process.cwd() + '/' + hfc.getConfigSetting('credential_store_dir') + '-' + org;
}

var getClientForOrg = function(userorg, username) {
	return clients[userorg];
}

var getChannelForOrg = function(org) {
    return channels[org];
}

var getAdminUser = async function(userOrg) {
    const admins = hfc.getConfigSetting('admins');
    const username = admins[0].username;
    const password = admins[0].secret;

	// No need to 2nd argument because we request client object for admin.
    const client = getClientForOrg(userOrg);

	var state_store = await hfc.newDefaultKeyValueStore({path: getKeyStoreForOrg(userOrg)});
	client.setStateStore(state_store);

    const user = await client.getUserContext(username, true);
    if (user && user.isEnrolled()) {
        logger.info('Successfully loaded member from persistence %s', username);
        return user;
    }

	// var ca = client.getCertificateAuthority();
	// [2018-09-06 Thu 09:39] ca がないケースではどう扱う?
	const caClient = caClients[userOrg];
    const enrollment = await caClient.enroll({
        enrollmentID: username,
        enrollmentSecret: password
    });

    logger.info('Successfully enrolled user \'' + username + '\'');
    const userOptions = {
        username,
        mspid: client.getMspid(),
        cryptoContent: {
            privateKeyPEM: enrollment.key.toBytes(),
            signedCertPEM: enrollment.certificate
        }
    };

    const member = await client.createUser(userOptions);
    return member;
}

function getMspID(org) {
	return ORGS[org].mspid;
}

var getPeer = function(peerName) {
	return peers[peerName];
}
exports.getPeer = getPeer;

// TODO: getting anchor/leader peer should be better
var getHeadPeerFromOrg = function(orgName) {
	return ORGS[org].peers[0];
}
exports.getHeadPeerFromOrg = getHeadPeerFromOrg;

var getPeers = function() {
	return peers;
}
exports.getPeers = getPeers;

var getRegisteredUser = async function (username, userOrg, isJson) {
    let client = getClientForOrg(userOrg);
    const store = await hfc.newDefaultKeyValueStore({path: getKeyStoreForOrg(userOrg)});
    client.setStateStore(store);
    const user = await client.getUserContext(username, true);

    if (user && user.isEnrolled()) {
        logger.info('Successfully loaded member from persistence');
		if (isJson && isJson === true) {
			var response = {
				status: "success",
				data: null,
				message: username + ' is already enrolled',
			};
			return response;
		}
        return user;
    }

    logger.debug('Using admin to enroll this user ...');

    // get the Admin and use it to enroll the user
    const adminUser = await getAdminUser(userOrg);
    const caClient = caClients[userOrg];
    const secret = await caClient.register({
        enrollmentID: username,
        affiliation: userOrg + '.department1'
    }, adminUser);

    logger.debug(username + ' registered successfully');

    const message = await caClient.enroll({
        enrollmentID: username,
        enrollmentSecret: secret
    });

    if (message && typeof message === 'string' && message.includes(
        'Error:')) {
        logger.error(username + ' enrollment failed');
    }
    logger.debug(username + ' enrolled successfully');

    const userOptions = {
        username,
        mspid: getMspID(userOrg),
        cryptoContent: {
            privateKeyPEM: message.key.toBytes(),
            signedCertPEM: message.certificate
        }
    };

    const member = await client.createUser(userOptions);
	if (isJson && isJson === true) {
		var response = {
			status: "success",
			data: {secret: member._enrollmentSecret},
			message: username + ' enrolled Successfully',
		};
		return response;
	}
    return member;
}

var setupChaincodeDeploy = function() {
	process.env.GOPATH = hfc.getConfigSetting('CC_SRC_PATH');
};

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	var loglevel = process.env.LOGLEVEL || 'INFO';
	logger.setLevel(loglevel);
	return logger;
};

// returns detailed execution results from each endorsing peers
var verifyProposalResponses = function(results) {
	// the returned object has both the endorsement results and the actual proposal,
	// the proposal will be needed later when we send a transaction to the orderer.
	var proposalResponses = results[0];
	var proposal = results[1];

	// lets have a look at the responses to see if they are all good, if good they
	// will also include signatures required to be committed.
	var all_good = true;

	var error_messages = [];
	proposalResponses.forEach(function (value, i) {
		let one_good = false;
		if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
			one_good = true;
		} else {
			let message = util.format('verifyProposalResponses failed: %s', value.response);
			error_messages.push(value);
		}
		all_good = all_good & one_good;
	});

	if (!all_good)
		throw new Error(util.format("verifyProposalResponses didn't show all_good flag: %s", error_messages));

	return proposalResponses;
}

var enableEventHubs = function(event_hubs, tx_id_string) {
	let promises = [];
	event_hubs.forEach((eh) => {
		let invokeEventPromise = new Promise((resolve, reject) => {
			logger.debug('invokeEventPromise - setting up event');
			let event_timeout = setTimeout(() => {
				let message = 'REQUEST_TIMEOUT: ' + eh.getPeerAddr();
				eh.disconnect();
				reject(message);
			}, 10000);
			eh.registerTxEvent(tx_id_string, (tx, code, block_num) => {
				clearTimeout(event_timeout);
                eh.unregisterTxEvent(tx_id_string);
                eh.disconnect();

				if (code !== 'VALID') {
					let message = util.format('The invoke chaincode transaction was invalid, code: %s', code);
					reject({
						status: 'failure',
						data: null,
						message: message.toString()
					});
				} else {
					let message = 'The invoke chaincode transaction was valid.';
					logger.debug(message);
					resolve({
						status: 'success',
						data: {
							peer: eh.getPeerAddr()
						},
						message: message
					});
				}
			}
//			},
//				// the default for 'unregister' is true for transaction listeners
//				// so no real need to set here, however for 'disconnect'
//				// the default is false as most event hubs are long running
//				// in this use case we are using it only once
//				{unregister: true, disconnect: true}
			);
			eh.connect();
		});
		promises.push(invokeEventPromise);
	});
	return promises;
}

var checkResponse = function(results, event_hubs) {
	let message = '';
	let response = results.pop(); //  orderer results are last in the results
	let status;
	if (response.status === 'SUCCESS') {
		status = "success";
		message = 'Successfully sent transaction to the orderer.'
	} else {
		status = "failure";
		message = util.format('Failed to order the transaction. Error code: %s', response.status);
	}

	// event_hub_result is given by result of promise of transaction event hub.
	let data = []
	for (let i in results) {
		let event_hub_result = results[i];

		data.push(event_hub_result);
		if (event_hub_result.status === 'failure') {
			status = 'failure';
			message = event_hub_result.message;
		}
	}
	return {
		status: status,
		data: data,
		message: message
	};
}

// TODO: what if there're multiple orderers on this channel?
function newOrderer(client) {
	let channelName = hfc.getConfigSetting('channelName');
	let ordererName = hfc.getConfigSetting('channels')[channelName].orderers[0];
	let orderer = hfc.getConfigSetting('orderers')[ordererName];
    let data = fs.readFileSync(path.join(process.cwd(), orderer.tlsCACerts.path));
    let caroots = Buffer.from(data).toString();
    return client.newOrderer(orderer.url, {
        'pem': caroots,
        'ssl-target-name-override': orderer.grpcOptions['ssl-target-name-override']
    });
}

var setupPeers = async function(channel, org, client) {
	let org_peers = ORGS[org].peers;
	let all_peers = hfc.getConfigSetting('peers');
	org_peers.forEach(function (peer) {
		let tlscacert = path.join(process.cwd(), all_peers[peer].tlsCACerts.path);
		let data = fs.readFileSync(tlscacert);
		let opts = {}
		opts = {
			'pem': Buffer.from(data).toString(),
			'ssl-target-name-override': all_peers[peer].grpcOptions['ssl-target-name-override']
		}
		let _peer = client.newPeer(all_peers[peer].url, opts);
		_peer.setName(peer);
		channel.addPeer(_peer, client.getMspid(), null, true);
		peers[peer] = _peer;
	});
}

function loadConfig(filepath) {
	if (path.extname(filepath) === '.yaml' || path.extname(filepath) === '.yml') {
		var obj = yaml.load(fs.readFileSync(filepath, {encoding: 'utf-8'}));
		filepath = path.join(path.dirname(filepath), path.parse(filepath).name + '.json');
		fs.writeFileSync(filepath, JSON.stringify(obj, null, 2))
	}
	hfc.addConfigFile(filepath);
}

//var compareVersions = require('compare-versions');

var init = function() {
	loadConfig(path.join(process.cwd(), hfc.getConfigSetting('config-json')));
	let network_conf_path = path.join(process.cwd(), hfc.getConfigSetting('network_config'));
	loadConfig(network_conf_path);

	ORGS = hfc.getConfigSetting('organizations');

	// set up the client and channel objects for each org
	for (const org in ORGS) {
		let client = new hfc();
		const cryptoSuite = hfc.newCryptoSuite();
		let cstore_dir = process.cwd() + '/' + hfc.getConfigSetting('credential_store_dir') + '-' + org;

		client = hfc.loadFromConfig(hfc.getConfigSetting('network_config'));
		client.loadFromConfig(hfc.getConfigSetting('organization_config')[org]);
		client.initCredentialStores();

		// TODO: Fix it up as setCryptoKeyStore is only available for s/w impl
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: cstore_dir}));
		client.setCryptoSuite(cryptoSuite);

		const channel = client.newChannel(hfc.getConfigSetting('channelName'));
logger.error('init: channel %s, %s', hfc.getConfigSetting('channelName'), channel);
		channel.addOrderer(newOrderer(client));

		clients[org] = client;
		channels[org] = channel;

		setupPeers(channel, org, client);

		// TODO: assuming using only one ca for now
		const ca = ORGS[org].certificateAuthorities[0];
		let caUrl = hfc.getConfigSetting('certificateAuthorities')[ca].url;
		caClients[org] = new hfcac(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite);
	}

	// if (hfc.getConfigSetting('sdk_version') && compareVersions(hfc.getConfigSetting('sdk_version'), '1.3') >= 0) {
	// 	logger.info('fabric-sdk-node version is %s (> 1.3), so new programming model is available', hfc.getConfigSetting('sdk_version'));
	// }
	// logger.debug('All configuration %s', util.inspect(hfc.getConfigSetting()));
}

var getOrgIdentity = function(orgName) {
	var ORGS = hfc.getConfigSetting('organizations');
	return {
		cert: fs.readFileSync(ORGS[orgName].adminPrivateKey.path),
		key: fs.readFileSync(ORGS[orgName].signedCert.path)
	};
}

var getNetworkConfigJson = function() {
	let filepath = path.join(process.cwd(), hfc.getConfigSetting('network_config'));
	let obj = yaml.load(fs.readFileSync(filepath, {encoding: 'utf-8'}));
	return JSON.stringify(obj, null, 4);
}

exports.getClientChannel = getClientChannel;
exports.getClientForOrg = getClientForOrg;
exports.getChannelForOrg = getChannelForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getRegisteredUser = getRegisteredUser;
exports.getAdminUser = getAdminUser;
exports.verifyProposalResponses = verifyProposalResponses;
exports.enableEventHubs = enableEventHubs;
exports.checkResponse = checkResponse;
exports.getOrgIdentity = getOrgIdentity;
exports.getNetworkConfigJson = getNetworkConfigJson;
exports.init = init;
