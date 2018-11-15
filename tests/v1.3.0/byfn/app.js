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
var logger = log4js.getLogger('BlockchainApp');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');
var url = require('url');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var hfc = require('fabric-client');
var yaml = require('js-yaml');

var helper = require('./app/helper.js');
helper.init();

// TODO: separate api for app specific info

var createChannel = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var invoke = require('./app/invoke-transaction.js');
var query = require('./app/query.js');
var sd = require('./app/service-discovery.js');
var host = process.env.HOST || hfc.getConfigSetting('host');
var port = process.env.PORT || hfc.getConfigSetting('port');

var index = require('./routes/index');
var users = require('./routes/users');

mkdirp(hfc.getConfigSetting('run_dir'), null);
mkdirp(hfc.getConfigSetting('bc_data_dir'), null);

var LocalStorage = require('node-localstorage').LocalStorage;
var localStorageDir = path.join(hfc.getConfigSetting('credential_store_dir'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({extended: false}));
// set secret variable
app.set('secret', 'thisismysecret');

if (process.env.DEVEL) {
	logger.info("running in DEVEL mode.");
}

if (process.env.CONFIG_JWT) {
	logger.info("running with JWT enabled.");
	app.use(expressJWT({
		secret: 'thisismysecret',
		getToken: function fromLocalStorage (req) {
			if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
				return req.headers.authorization.split(' ')[1];
			} else if (req.query && req.query.token)
				return req.query.token;
		}
	}).unless({
		// /users へのアクセスに対してだけは認証を使用しない
		path: ['/users']
	}));
} else {
	// 検証目的で JWT をオフにした場合、とりあえずサーバ起動時に指定した
	// USERNAME/ORGNAME からアクセスされたものと想定する。
	app.use(function(req, res, next) {
		req.username = process.env.USERNAME;
		req.orgname = process.env.ORGNAME;
		return next();
	});
}

app.use(express.static(__dirname + '/static'));

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////

// Register and enroll user
app.post('/users', async function(req, res) {
	var username = req.body.username;
	var orgName = req.body.orgName;
	// TODO: log level setting
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgName);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgName) {
		res.json(getErrorMessage('\'orgName\''));
		return;
	}
	var token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: username,
		orgName: orgName
	}, app.get('secret'));

	// Fabric に enroll する処理
	let response = await helper.getRegisteredUser(username, orgName, true);
	if (response && typeof response !== 'string') {
		logger.debug('Successfully registered the username %s for organization %s',username,orgName);
		response.token = token;

		if (orgName === undefined)
			throw new Error('orgName undefined');
		let localStorage = new LocalStorage(localStorageDir + '-' + orgName);
 		localStorage.setItem(`token.${username}`, token);
		res.json(response);
	} else {
		logger.debug('Failed to register the username %s for organization %s with::%s',username,orgName,response);
		res.json({success: false, message: response});
	}

});

app.use(bearerToken());
app.use(function(req, res, next) {
	logger.debug('>>>>>>>>>> new request for %s', req.originalUrl);
	if (req.originalUrl.indexOf('/users') >= 0) {
		return next();
	}

	if (!process.env.CONFIG_JWT) {
		return next();
	}

	var localStorage = new LocalStorage(localStorageDir + '-' + req.user.orgName);
	var token = localStorage.getItem(`token.${req.user.username}`)

	jwt.verify(token, app.get('secret'), function(err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token. Make sure to include the ' +
					'token returned from /users call in the authorization header ' +
					'as a Bearer token'
			});
			return;
		} else {
			// add the decoded user name and org name to the request object
			// for the downstream code to use
			req.username = decoded.username;
			req.orgname = decoded.orgName;
			logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.username, decoded.orgName));
			return next();
		}
	});
});

// ここより下に定義された API は認証を通さないと実行できない。

// Create Channel
app.post('/channels', async function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug('End point : /channels');
	var channelName = req.body.channelName;
	var channelConfigPath = req.body.channelConfigPath;
	logger.debug('Channel name : ' + channelName);
	logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!channelConfigPath) {
		res.json(getErrorMessage('\'channelConfigPath\''));
		return;
	}

	let message = await createChannel.createChannel(channelName, channelConfigPath, req.username, req.orgname);
	res.send(message);
});

// Join Channel
app.post('/channels/:channelName/peers', async function(req, res) {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	logger.debug('channelName : ' + channelName);
	logger.debug('peers : ' + peers);
	logger.debug('username :' + req.username);
	logger.debug('orgname:' + req.orgname);

	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}

	let message =  await join.joinChannel(channelName, peers, req.username, req.orgname);
	res.send(message);
});

// Instantiate chaincode on target peers
app.post('/channels/:channelName/chaincodes', async function(req, res) {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var chaincodeType = req.body.chaincodeType;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('peers  : ' + peers);
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	logger.debug('args  : ' + util.inspect(args));
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodeVersion, chaincodeType, fcn, args, req.username, req.orgname);
	res.send(message);
});

// Invoke transaction on chaincode on target peers
app.post('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== INVOKE ON CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.params.chaincodeName;
	var channelName = req.params.channelName;
	var fcn = req.body.fcn;
	var args = req.body.args;
	var newif = req.body.newif;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn  : ' + fcn);
	logger.info('args  : ' + args);
	logger.info('peers  : ' + peers);
	logger.info('newif  : ' + newif);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message;
	if (newif == true) {
		message = await invoke.invokeChaincode2(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	} else {
		message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	}
	if (req.get('Accept') === 'application/json') {
		res.json(message);
	} else {
		res.send(message);
	}
});

// Install chaincode on target peers
app.post('/chaincodes', async function(req, res) {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	let peers = req.body.peers;
	let chaincodeName = req.body.chaincodeName;
	let chaincodePath = req.body.chaincodePath;
	let chaincodeVersion = req.body.chaincodeVersion;
	let chaincodeType = req.body.chaincodeType;
	let response = await install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, chaincodeType, req.username, req.orgname);

	res.json(response);
});

// Helper routines to prepare response to query

function toHexString(byteArray) {
	return Array.from(byteArray, function(byte) {
		return ('0' + (byte & 0xFF).toString(16)).slice(-2);
	}).join('')
}

String.prototype.trunc = String.prototype.trunc ||
    function(n){
        return (this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
    };

// Query to fetch channels
app.get('/channels', async function(req, res) {
	logger.debug('================ GET CHANNELS ======================');
	let peer = req.query.peer;
	let response = await query.getChannels(peer, req.username, req.orgname);

	if (req.get('Accept') === 'application/json') {
		res.json(response)
	} else {
		var toString = Object.prototype.toString;

		logger.debug('message: ' + response.message);
		// TODO: more elegant way to check class name
		if (response.message.match(/Error: (.*)/i)) {
			// TODO: typical way to handle error (maybe error page?)
			// TODO: apply this pattern to other callers
			res.json({success: false, message: response.message});
			return;
		} else {
			res.render('channels', {
				title: `Channels on ${peer}`,
				peer: peer,
				data: reponse.message
			})
		}
	}
});

//Query for Channel Information
app.get('/channels/:channelName', async function(req, res) {
	logger.debug('================ GET CHANNEL INFORMATION ======================');
	let peer = req.query.peer;

	let response = await query.getChainInfo(peer, req.params.channelName, req.username, req.orgname);

	await query.storeBlockchainData(peer, req.params.channelName, req.username, req.orgname);

	if (req.get('Accept') === 'application/json') {
		res.json(response)
	} else {
		let jsonmsg = JSON.parse(JSON.stringify(response.message))
		// logger.debug('message: %s', JSON.stringify(message))
		let msghash = {
			heightLow: jsonmsg.height.low,
			heightHigh: jsonmsg.height.high,
			currentBlockHash: toHexString(jsonmsg.currentBlockHash.buffer.data).trunc(40),
			currentBlockHashOffset: jsonmsg.currentBlockHash.offset,
			currentBlockHashLimit: jsonmsg.currentBlockHash.limit,
			previousBlockHash: toHexString(jsonmsg.previousBlockHash.buffer.data).trunc(40),
			previousBlockHashOffset: jsonmsg.previousBlockHash.offset,
			previousBlockHashLimit: jsonmsg.previousBlockHash.limit
		}
		res.render('channel', {channelid: req.params.channelName, data: msghash})
	}
});

//Query for Channel instantiated chaincodes
app.get('/channels/:channelName/chaincodes', async function(req, res) {
	logger.debug('================ GET INSTANTIATED CHAINCODES ======================');
	let peer = req.query.peer;
	let response = await query.getInstalledChaincodes(peer, req.params.channelName, 'instantiated', req.username, req.orgname);
	await query.storeBlockchainData(peer, req.params.channelName, req.username, req.orgname);

	if (req.get('Accept') === 'application/json') {
		res.json(response)
	} else {
		res.render('chaincodes', {
			title: `Instantiated chaincode on ${peer} on ${req.params.channelName}`,
			peer: peer,
			data: response.message
		})
	}
});

// Query on chaincode on target peers
app.get('/channels/:channelName/chaincodes/:chaincodeName', async function(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');
	var channelName = req.params.channelName;
	var chaincodeName = req.params.chaincodeName;
	let args = req.query.args;
	let fcn = req.query.fcn;
	let peer = req.query.peer;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	args = args.replace(/'/g, '"');
	args = JSON.parse(args);
	logger.debug(args);

	await query.storeBlockchainData(peer, channelName, req.username, req.orgname);

	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	res.send(message);
});

// Query Get Block by Hash
// If hash is not given, display blockchain summary and links to each block
app.get('/channels/:channelName/blocks', async function(req, res) {
	logger.debug('================ GET BLOCK BY HASH ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let hash = req.query.hash;
	let channelName = req.params.channelName;
	let peer = req.query.peer;

	await query.storeBlockchainData(peer, channelName, req.username, req.orgname);

	if (!hash) {
		// TODO: scalability?
		let datadir = hfc.getConfigSetting('bc_data_dir') + '/' + channelName + '/peers/' + peer + '/blocks';
		// logger.debug('bc_data_dir: ' + datadir);
		fs.readdir(datadir, (err, files) => {
			files.sort(function(a, b) {
				return a.split(".")[0] - b.split(".")[0];
			});
			let blocks = [];
			files.forEach(file => {
				blocks[file] = JSON.parse(fs.readFileSync(fs.realpathSync(datadir + '/' + file + '/block'), 'utf8'));
				logger.debug("block " + file + ' -> ' + util.inspect(blocks[file]));
			});

			res.render('blocks', {
				title: `Blocks on ${peer}`,
				peer: peer,
				channel: channelName,
				blocks: blocks
			})
		})
	} else {
		let message = await query.getBlockByHash(peer, channelName, hash, req.username, req.orgname);
		res.send(message);
	}
});

//  Query Get Block by BlockNumber
app.get('/channels/:channelName/blocks/:blockId', async function(req, res) {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	let blockId = req.params.blockId;
	let peer = req.query.peer;
	let channel = req.params.channelName;
	logger.debug('channelName : ' + channel);
	logger.debug('BlockID : ' + blockId);
	logger.debug('Peer : ' + peer);
	logger.debug('Accept : ' + req.get('Accept'));
	if (!blockId) {
		res.json(getErrorMessage('\'blockId\''));
		return;
	}

	//	await query.storeBlockchainData(peer, channel, req.username, req.orgname);

	let message = await query.getBlockByNumber(peer, channel, blockId, req.username, req.orgname);
	if (req.get('Accept') === 'application/json') {
		res.json(message);
	} else {
		let jsonmsg = JSON.parse(JSON.stringify(message))
		let msgtype = jsonmsg.data.data[0].payload.header.channel_header.typeString
		// logger.debug('message: %s', JSON.stringify(message))

		if (msgtype == "CONFIG") {
			res.render('block_config', {
				title: `block ${blockId} on peer ${peer} on channel ${channel}`,
				channel: channel,
				peer: peer,
				istextorbinary: require('istextorbinary'),
				data: jsonmsg.data.data[0].payload.data.config
			});
		} else if (msgtype == "ENDORSER_TRANSACTION") {
			let msghash = {
				type: jsonmsg.data.data[0].payload.header.channel_header.typeString,
				number: jsonmsg.header.number,
				dataHash: jsonmsg.header.data_hash,
				previousHash: jsonmsg.header.previous_hash,
				timestamp: jsonmsg.data.data[0].payload.header.channel_header.timestamp,
				actions: jsonmsg.data.data[0].payload.data.actions
			};
			res.render('block', {
				title: `block ${blockId} on peer ${peer} on channel ${channel}`,
				channel: channel,
				peer: peer,
				istextorbinary: require('istextorbinary'),
				util: require('util'),
				data: msghash
			});
		}
	}
});

// Query Get Transaction by Transaction ID
app.get('/channels/:channelName/transactions/:trxnId', async function(req, res) {
	logger.debug('================ GET TRANSACTION BY TRANSACTION_ID ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let trxnId = req.params.trxnId;
	let peer = req.query.peer;
	if (!trxnId) {
		res.json(getErrorMessage('\'trxnId\''));
		return;
	}

	let message = await query.getTransactionByID(peer, req.params.channelName, trxnId, req.username, req.orgname);
	res.send(message);
});

// Query to fetch all Installed chaincodes
app.get('/chaincodes', async function(req, res) {
	logger.debug('================ GET INSTALLED CHAINCODES ======================');
	let peer = req.query.peer;
	let response = await query.getInstalledChaincodes(peer, null, 'installed', req.username, req.orgname)

	if (req.get('Accept') === 'application/json') {
		res.json(response)
	} else {
		res.render('chaincodes', {
			title: `Installed chaincode on ${peer}`,
			peer: peer,
			data: response.message
		})
	}
});

// handling request for static contents
app.get('/static/:content', async function(req, res) {
	logger.debug('================ GET STATIC CONTENTS ======================');
	let pathname = `.${url.parse(req.url).pathname}`;
	let filepath = '/static/' + req.params.content
	logger.debug('content : ' + filepath);
	logger.debug('pathname : ' + pathname);

	// TODO: move this to common place
	const mimeType = {
		'.ico': 'image/x-icon',
		'.html': 'text/html',
		'.js': 'text/javascript',
		'.json': 'application/json',
		'.css': 'text/css',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.wav': 'audio/wav',
		'.mp3': 'audio/mpeg',
		'.svg': 'image/svg+xml',
		'.pdf': 'application/pdf',
		'.doc': 'application/msword',
		'.eot': 'appliaction/vnd.ms-fontobject',
		'.ttf': 'aplication/font-sfnt'
	};

	fs.exists(pathname, function(exist) {
		if (!exist) {
			res.statusCode = 404;
			res.end(`File ${pathname} not found!`);
			return;
		}
		// TODO: Don't do that.
		if (fs.statSync(pathname).isDirectory()) {
			pathname += '/index.html';
		}
		fs.readFile(pathname, function(err, data) {
			if (err) {
				res.statusCode = 500;
				res.end(`Error getting the file: ${err}.`);
			} else {
				const ext = path.parse(pathname).ext;
				// if the file is found, set Content-type and send data
				res.setHeader('Content-type', mimeType[ext] || 'text/plain' );
				res.end(data);
			}
		});
	});
});

// handling request for static contents
app.get('/', async function(req, res) {
	let datadir = hfc.getConfigSetting('bc_data_dir');
	logger.debug('bc_data_dir: ' + datadir);

	await query.storeBlockchainData(null, null, req.username, req.orgname);

	fs.access(datadir, fs.constants.R_OK | fs.constants.W_OK, (error) => {
		logger.debug("No data directory found on " + datadir + ". please run 'make collect_blockchain_data' first.");
		if (error) {
			if (error.code === "ENOENT") {
				res.render('index_nodata', {
					title: 'Blockchain Explorer'
				});
				return;
			}
		}
		logger.debug("error: " + error);
		return;
	});

	fs.readdir(datadir, (err, files) => {
		files.sort(function(a, b) {
			return a.split(".")[0] - b.split(".")[0];
		});
		let channels = [];
		files.forEach(channel => {
			channels.push(channel);
		});

		logger.debug('channels: ' + channels);
		res.render('index', {
			title: 'Blockchain Explorer',
			channels: channels,
			text: datadir
		});
	})
});

app.get('/summary', async function(req, res) {
	logger.debug('================ GET ALL READ/WRITE HISTORY ======================');
	let hash = req.query.hash;
	let channel = req.params.channelName;
	let peer = req.query.peer;

	if (req.get('Accept') === 'application/json') {
		// TODO: not implemented yet
		logger.debug("Not implemeneted yet.");
	} else {
		var datadir = hfc.getConfigSetting('bc_data_dir');
		var data = {};
		// per channel loop
		var files = fs.readdirSync(datadir);
		files.forEach(file => {
			let blockdir = datadir + "/" + file + "/peers/peer0.org1.example.com/blocks";
			var blkfiles = fs.readdirSync(blockdir);
			data[file] = [];
			blkfiles.sort(function(a, b) {
				return a.split(".")[0] - b.split(".")[0];
			});
			blkfiles.forEach(blkfile => {
				data[file][blkfile] = JSON.parse(fs.readFileSync(fs.realpathSync(blockdir + "/" + blkfile + '/block', 'utf8')));
				logger.debug("block " + blkfile + ' -> ' + fs.realpathSync(blockdir + "/" + blkfile, 'utf8'));
			});
		});

		res.render('summary', {
			title: `Read/Write Summary`,
			peer: peer,
			istextorbinary: require('istextorbinary'),
			data: data
		})
	}
});

app.get('/services', async function(req, res) {
	logger.debug('================ DISCOVER SERVICES ======================');
	let channel = req.query.channel;
	let peer = req.query.peer;
	let cc = req.query.cc;
	let config = req.query.config;
	let local = req.query.local;

	let message = await sd.getServicePeers(peer, channel, req.username, req.orgname, cc, config, local);
	if (req.get('Accept') === 'application/json') {
		res.json(message)
	} else {
		res.render('chaincodes', {
			title: `Services Discovery`,
			data: message
		})
	}
});

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  http://%s:%s  ******************',host,port);
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}
