'use strict';
var util = require('util');
var helper = require('./helper.js');
var logger = helper.getLogger('service-discovery');

var discoverService = async function(peerName, channelName, username, orgName, cc, config, local) {
	try {
		let client = helper.getClientForOrg(orgName, username);
		let channel = client.getChannel(channelName);
		let peer = helper.getPeer(peerName);

		client.setConfigSetting('initialize-with-discovery', true);
		await channel.initialize({
			discover: true
		});

		let q_results = await channel.queryInstantiatedChaincodes(peer, true);
		let ccNames = [];
		q_results.chaincodes.forEach(async (cc) => {ccNames.push(cc.name);});
		let result = await channel._discover({
			target: peer,
			chaincodes: cc == "true" ? ccNames : null,
			config: config == "true" ? true : null,
			local: local == "true" ? true : null
		});

		return {
			status: 'success',
			data: {
				result: result
			},
			message: ''
		}
		return result;
	} catch(error) {
		return {
			status: "failure",
			data: null,
			message: error.toString()
		};
	}
};

exports.discoverService = discoverService;
