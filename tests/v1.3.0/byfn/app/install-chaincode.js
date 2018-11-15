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
var logger = helper.getLogger('install-chaincode');
var tx_id = null;

var installChaincode = async function(peerNames, chaincodeName, chaincodePath,
	chaincodeVersion, chaincodeType, userName, orgName) {
	logger.debug('\n\n============ Install chaincode on organizations ============\n');
	helper.setupChaincodeDeploy();
	let error_message = null;
	let peers = [];
	try {
		logger.info('Calling peers in organization "%s" to join the channel', orgName);

		// only admin can setup install chaincode, so no userName is given.
		let client = helper.getClientForOrg(orgName);

		logger.debug('Successfully got the fabric client for the organization "%s"', orgName);
		peerNames.forEach(async (peerName) => {
			peers.push(helper.getPeer(peerName));
		})

		tx_id = client.newTransactionID(true); //get an admin transactionID
		let request = {
			targets: peers,
			chaincodePath: chaincodePath,
			chaincodeId: chaincodeName,
			chaincodeVersion: chaincodeVersion,
			chaincodeType: chaincodeType
		};
		let results = await client.installChaincode(request);

		helper.verifyProposalResponses(results);

		let message = util.format('Successfully installed chaincode');
		logger.info(message);
		return {
			status: "success",
			data: {
				chaincodeId: chaincodeName,
				chaincodeVersion: chaincodeVersion,
				chaincodeType: chaincodeType
			},
			message: message
		};
	} catch (error) {
		return {
			status: "failure",
			data: null,
			message: error.toString()
		};
	}
};
exports.installChaincode = installChaincode;
