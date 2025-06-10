const { Client, LocalAuth, MessageMedia, RemoteAuth, WAState } = require('whatsapp-web.js');
function replaceHostname(urlString, newHostname) {
	try {
		const url = new URL(urlString); // Parse the URL
		url.hostname = newHostname;     // Replace the hostname
		return url.toString();           // Return the updated URL
	} catch (error) {
		console.error('Invalid URL:', error);
		return null;
	}
}

async function create_client(id, t) {
	return new Promise(async function (resolve, reject) {

		var browser = t.browser;

		let conf = {
			headless: true,
			stealth: true,
			keepAlive: true,
		};

		// if (browser) {
		// 	conf.args = [];
		// 	conf.args.push(`--user-data-dir=${browser.datadir}`);
		// }

		conf.args = [];
		conf.args.push(`--user-data-dir=~/${id}`);
		let url;
		let timeout = '999999999';
		if (t.memorize.data.cl)
			url = t.memorize.data.cl.url + '&ttl=999999999&timeout=' + timeout + '&trackingId=' + id + '&launch=' + JSON.stringify(conf);
		else {
			// get from db the cl_browserless of possible browserless urls
			var arr = await t.db.find('db2/cl_browserless').where('isdisabled', false).promise();
			// get random browserless url
			var randomIndex = Math.floor(Math.random() * arr.length);
			url = arr[randomIndex].value  + '&ttl=999999999&timeout=' + timeout + '&trackingId=' + id + '&launch=' + JSON.stringify(conf);
			var cl = {};
			cl.baseurl = arr[randomIndex].baseurl;
			cl.type = arr[randomIndex].type;
			cl.id = arr[randomIndex].id;
			cl.token = arr[randomIndex].token;
			cl.url = url;
			t.memorize.data.cl = cl;
			t.memorize.save();
		}

		const opt = {
			qrMaxRetries: 10,
			disableMessageHistory: true,
			puppeteer: {
				args: [
					'--disable-setuid-sandbox',
					'--no-sandbox'
				],
				executablePath: '/usr/bin/google-chrome',
				headless: true
			}
		};

		var type = CONF.db_ctype;
		if (type === "mongo") {
			const { MongoStore } = require('wwebjs-mongo');
			const mongoose = require('mongoose');
			await mongoose.connect(CONF.mongosh_uri);
			const store = new MongoStore({ mongoose: mongoose });
			opt.authStrategy = new RemoteAuth({
				clientId: id,
				store: store,
				backupSyncIntervalMs: 60000,
				//dataPath: './.wwebjs_auth/' + id
			});
			const client = new Client(opt);
			resolve(client);
		} else {
			opt.authStrategy = new LocalAuth({ dataPath: './.wwebjs_auth/' + id, clientId: id });
			var client = new Client(opt);
			resolve(client);
		}
	});
};

MAIN.Instance = function (phone, origin = 'zapwize') {
	var t = this;
	t.db = DB();

	var w = t.memorize = MEMORIZE(phone);
	var data = w.data;
	data.id = UID();
	w.save();
	t.phone = phone;
	t.Worker = w;
	t.Data = t.Worker.data;
	t.id = data.id;
	t.ip = CONF.ip;
	t.port = CONF.port;
	t.days = {};
	t.plans = [];
	t.logs = [{ name: 'instance_created', content: true }];
	t.code = '';
	t.origin = origin;
	t.qrcode = '';
	t.is_maxlimit = false;
	t.is_limit = false;
	t.ws_clients = {};
	t.pairingCodeEnabled = t.phone && t.Data.mode == 'code' ? true : false;
	t.pairingCodeRequested = false;

	ON('service', t.onservice);
};

var IP = MAIN.Instance.prototype;

// get code from whatsapp
IP.get_code = function() {
	var t = this;
	if (t.pairingCodeEnabled && !t.pairingCodeRequested) {
		t.PUB('code', { env: t.Worker.data, content: t.code });
	} else {
		t.PUB('qr', { env: t.Worker.data, content: t.qrcode });
	}
};

IP.ws_send = function(obj) {
	var t = this;
	for (var key in t.ws_clients) {
		var client = t.ws_clients[key];
		client.send(obj);
	}
}

IP.notify = function (obj) {
	var t = this;
	RESTBuilder.POST(CONF.notify.format(obj.topic), { title: obj.title }).keepalive().callback(NOOP);
};

IP.save_revoked = async function (data) {
	var t = this;
	var content = data.content;
	var env = data.env;
	var user = content.user;
	var group = content.group;
	var number = await t.db.read('db2/tbl_number').where('phonenumber', env.phone).promise();
	var chat = await t.db.read('tbl_chat').id(user.number).where('numberid', number.id).promise();

	if (!chat) {
		chat = {};
		chat.id = UID();
		chat.numberid = number.id;
		chat.value = user.phone;
		chat.displayname = user.pushname;
		chat.dtcreated = NOW;
		await t.db.insert('tbl_chat', chat).promise();
	};
	var message = {};
	message.id = UID();
	message.chatid = chat.id;
	message.type = content.type;
	message.value = message.content = content.content;
	message.caption = content.caption;
	message.isviewonce = false;
	message.dtcreated = NOW;
	message.kind = content.type == 'edited' ? 'edited' : 'revoked';
	await t.db.insert('tbl_message', message).promise();
	await t.db.update('tbl_chat', { '+unread': 1, '+msgcount': 1 }).id(chat.id).promise();
	// send push notification
	var obj = {};
	obj.topic = 'revoked-' + t.phone;
	obj.title = user.pushname;
	t.notify(obj);
};

IP.laststate = function () {
	var t = this;
	var len = t.logs.length;
	return t.logs[len - 1];
};

IP.send = function (obj) {
	var t = this;
	if (!obj.env)
		obj.env = t.Data;
	obj.env.phone = t.phone;
	obj.type = 'event';
	//console.log(this);
	if (t.Data.webhook) {
		RESTBuilder.POST(t.Data.webhook, obj).header('x-token', t.Data.token).header('token', t.Data.token).callback(NOOP);
	}


};

IP.memory_refresh = function (body, callback) {
	var t = this;

	if (body) {
		for (var key in body)
			Worker.data[key] = body[key];
	}

	t.Worker.save();

	t.Worker = MEMORIZE(t.phone);
	callback && callback();
};


IP.init = async function () {
	var t = this;
	t.whatsapp = await create_client(t.phone, t);
	var number = await t.db.read('db2/tbl_number').where('phonenumber', t.phone).promise();
	if (!number) {
		number = {};
		number.id = UID();
		number.phonenumber = t.phone;
		upd.url = 'ws://' + t.ip + ':' + t.port;
		upd.url = 'http://' + t.ip + ':' + t.port;
		upd.token = t.Data.token;
		number.dtcreated = NOW;
		await t.db.insert('db2/tbl_number', number).promise();
	} else {
		let upd = {};
		upd.url = 'ws://' + t.ip + ':' + t.port;
		upd.baseurl = 'http://' + t.ip + ':' + t.port;
		upd.token = t.Data.token;
		upd.dtupdated = NOW;
		t.number = number;
		await t.db.update('db2/tbl_number', upd).where('phonenumber', t.phone).promise();
	}

	t.refresh_plans();

	t.resetInstance = async function () {
		try {
			t.pairingCodeRequested = false;
			await t.whatsapp.logout();
			await t.whatsapp.initialize();
			t.PUB('instance_restarted', { content: true });
		} catch (err) {
			console.error('Error restarting instance:', err);
		}
	};
	t.restartInstance = async function () {
		try {
			t.pairingCodeRequested = false;
			await t.whatsapp.destroy();
			await t.whatsapp.initialize();
			t.PUB('instance_reset', { content: true });
		} catch (err) {
			console.error('Error resetting instance:', err);
		}
	};
	ROUTE('+POST /api/config/' + t.phone, function (phone) {
		var self = this;
		var body = self.body;
		t.memory_refresh(body, function () {
			self.success();
		});
	});
	ROUTE('+GET /api/config/' + t.phone, function (phone) {
		var self = this;
		self.json(t.Data);
	});
	ROUTE('+POST /api/rpc/' + t.phone, function (phone) {
		var self = this;
		var payload = self.body;
		self.ws = false;
		t.message(payload, self);
	});
	ROUTE('+POST ' + t.Data.messageapi + t.phone, function () {
		var self = this;
		console.log(self.body);
		t.state == 'CONNECTED' && t.sendMessage(self.body);
		t.state == 'CONNECTED' && t.usage(self);
		self.success();
	});
	ROUTE('+POST ' + t.Data.mediaapi + t.phone, function () {
		var self = this;
		console.log(self.body);
		t.state == 'CONNECTED' && t.send_file(self.body);
		t.state == 'CONNECTED' && t.usage(self);

		self.success();
	});
	// Websocket server
	ROUTE('+SOCKET /api/ws/' + t.phone, function (phone) {
		var self = this;
		var socket = self;
		self.ws = true;
		t.ws = socket;
		self.autodestroy();
		socket.on('open', function (client) {
			client.phone = t.phone;
			t.ws_clients[client.id] = client;

			var timeout = setTimeout(function() {
				if (t.state == 'CONNECTED') {
					client.send({ type: 'ready' });
				} else {
					for (var log of t.logs) {
						if (log.name == 'whatsapp_ready')
							client.send({ type: 'ready' });
					}
				}
				clearTimeout(timeout);
			}, 2000);
		});
		socket.on('message', function (client, msg) {
			if (msg && msg.topic) {
				self.client = client;
				t.message(msg, self);
			}

			// check by msg.type
			if(msg && msg.type) {
				switch(msg.type) {
					case 'text':
					t.sendMessage(msg);
					// replay with success
					break;
					case 'file':
					t.send_file(msg);
					break;
				}
				client.send({ success: true });
			}
			// reply with success any way
			//client.send({ success: true });
		});
		socket.on('disconnect', function () {
			console.log('Client disconnected');
		});
	});
	setTimeout(function () {
		console.log('Initializing whatsapp: ' + t.id);
		t.logs.push({ name: 'instance_initializing', content: 'ID:' + t.id });
		t.whatsapp.initialize();

	}, 500);
};


IP.set_handlers = function() {
	let t = this;

	// Listen to whatsapp events
	t.whatsapp.on('message', (message) => FUNC.handle_status(message, t));
	t.whatsapp.on('message', (message) => FUNC.send_seen(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_voice(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_textonly(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_media(message, t));
	//t.whatsapp.on('message', (message) => FUNC.handle_contact(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_image(message, t));
	t.whatsapp.on('ready', () => {
		CALL('Client --> info').callback(async function (err, info) {
			var model = {};
			model.data = info;
			t.PUB('whatsapp_ready', model);
			t.state = await t.whatsapp.getState();
			t.logs.push({ name: 'whatsapp_ready', content: true });
			t.ws_send({ type: 'ready' });

			// CONF.antidel && t.whatsapp && t.whatsapp.sendMessage(t.phone + '@c.us', 'Integration OK');
		});
	});

	t.whatsapp.on('qr', async function (qr) {
		t.qrcode = qr;


		if (t.pairingCodeEnabled && !t.pairingCodeRequested) {
			const pairingCode = await t.whatsapp.requestPairingCode(t.phone); // enter the target phone number
			console.log('Pairing code enabled, code: ({0}) ==> '.format(t.phone) + pairingCode);
			t.pairingCodeRequested = true;
			t.logs.push({ name: 'pairingCode', content: pairingCode });
			t.code = pairingCode;
			t.PUB('code', { env: t.Worker.data, content: pairingCode });
		}

		if (!t.pairingCodeEnabled) {
			t.PUB('qr', { env: t.Worker.data, content: qr });
		}
	});

	t.whatsapp.on('loading_screen', (percent, message) => {
		t.logs.push({ name: 'loading_screen', content: percent });
		t.PUB('loading_screen', { env: t.Worker.data, content: percent + '%' });
	});

	t.whatsapp.on('authenticated', () => {
		t.logs.push({ name: 'authenticated', content: true });
		//t.save_session();
		t.PUB('authenticated', { env: t.Worker.data });
	});

	t.whatsapp.on('auth_failure', msg => {
		// Fired if session restore was unsuccessful
		t.logs.push({ name: 'auth_failure', content: true });
		t.PUB('auth_failure', { env: t.Worker.data, content: msg });
	});

	t.whatsapp.on('disconnected', msg => {
		// Fired if session restore was unsuccessful
		t.logs.push({ name: 'disconnected', content: true });
		t.PUB('disconnected', { env: t.Worker.data, content: msg });
	});

	t.whatsapp.on('message_revoke_everyone', async (after, before) => {
		if (before && !before.fromMe) {
			var chatid = before.from;
			var chat = await before.getChat();
			var contact = await before.getContact();
			var number = before.from.split('@')[0];
			var istag = false;
			var isgroup = chat.isGroup;
			var forme = false;
			var user = {};
			var group = {};
			var fs = FILESTORAGE(number);
			user.id = isgroup ? before.author : before.from;
			user.name = contact.name;
			user.pushname = contact.pushname;
			user.shortname = contact.shortname;
			user.number = contact.number;
			user.countrycode = await FUNC.getCountryCode(number);
			group.name = chat.isGroup ? chat.name : '';
			group.id = chat.isGroup ? chatid : '';

			if (before._data.directPath) {
				var dp = await FUNC.parseDP(before._data.directPath);
				fs.readbuffer(dp, function (err, buffer, meta) {
					RESTBuilder.POST(CONF.fs.format(number)).file('file', meta.name, buffer).keepalive().timeout(120000).callback(async function (err, response) {
						response.user = user;
						response.group = group;
						response.type = meta.custom.type,
							response.chatid = chatid;
						response.content = response.url;
						response.number = number;
						response.caption = meta.custom.caption;
						t.PUB('message_revoke_everyone', { env: t.Worker.data, content: response });
						//t.ask(number, chatid, response, meta.custom.type, isgroup, istag, user, group);
						// save_revoked
						await t.save_revoked({ content: response, env: t.Worker.data });

					});
				});
			} else {
				var res = {};
				res.user = user;
				res.group = group;
				res.type = 'text';
				res.chatid = chatid;
				res.number = number;
				res.content = before.body;
				console.log(res);
				t.PUB('message_revoke_everyone', { env: t.Worker.data, content: res });
				await t.save_revoked({ content: res, env: t.Worker.data });
			}
		}
	});

	t.whatsapp.on('message_edit', async function (message, newbody, prevbody) {
		message.body = newbody + ' (edited)' + prevbody;
		FUNC.handle_textonly2(message, t, async function (obj) {
			// save_revoked
			await t.save_revoked({ content: obj, env: t.Worker.data });
		});
	});

	t.whatsapp.on('change_state', async (state) => {
		console.log(`WhatsApp state changed: ${state}`);
		t.PUB('change_state', { content: state });
		switch (state) {
			case WAState.CONFLICT:
			case WAState.TIMEOUT:
			case WAState.PROXYBLOCK:
			case WAState.SMB_TOS_BLOCK:
			case WAState.TOS_BLOCK:
			console.log('State issue detected. Restarting...');
			await t.restartInstance();
			break;
			case WAState.UNPAIRED:
			case WAState.UNPAIRED_IDLE:
			console.log('Instance unpaired. Resetting...');
			await t.resetInstance();
			break;
			case WAState.DEPRECATED_VERSION:
			console.log('Deprecated version detected. Please update WhatsApp-web.js.');
			break;
		}
	});
}
IP.PUB = function (topic, obj, broker) {
	var t = this;
	obj.env = t.Worker.data;
	obj.topic = topic;
	console.log('PUB: ' + topic, obj.content);
	t.send(obj);
};
IP.refresh_plans = async function() {
	let t = this;
	let order = t.order;
	if (!t.plan) {
		t.plans = t.number.plans.split(',');
		let plans = await t.db.find('tbl_plan').in('id', t.plans).promise();
		t.plan = plans.findItem('id', 'elite') || plans.findItem('id', 'pro') || plans.findItem('id', 'standard') || plans.findItem('id', 'starter') || plans.findItem('id', 'free');
	}


	t.order = await t.db.read('tbl_order').where('ispaid', true).where('expired=FALSE').where('planid', t.plan.id).where('numberid', t.number.id).promise();

	if (!t.order && t.plan.id) {
		order = {};
		order.id = UID();
		order.planid = t.plan.id;
		order.numberid = t.number.id;
		order.userid = t.number.userid;
		order.expire = order.dtend = NOW.add((t.plan.id == 'free' ? 7 : 30 ) + ' days').format('dd-MM-yyyy');
		order.dtcreated = NOW;
		order.ispaid = true;
		order.date = order.dtstart = NOW.format('dd-MM-yyyy');
		await t.db.insert('tbl_order', order).promise();
		t.order = order;
	}

	await t.refresh_days();
	t.refresh_limits();



};
IP.refresh_days = function(key) {
	var t = this;
	return new Promise(async function (resolve) {
		let duration = t.plan.id == 'free' ? 7 : 30;
		t.monthly_count = 0;
		t.daily_count = 0;
		for (var i = 0; i < duration; i++ ) {
			let ts = t.order.ts || t.order.dtcreated;
			let id = ts.add(i + ' days').format('dd-MM-yyyy');
			let reqs = await t.db.find('tbl_request').where('numberid', t.number.id).where('date', id).promise();
			t.monthly_count += reqs.length;
			if (id == NOW.format('dd-MM-yyyy'))
				reqs.dailly_count = reqs.length;
			t.days[id]= reqs || [];
		}
		resolve(key ? t.days[key] : t.days);
	});
};
IP.usage = async function($, next) {
	var t = this;
	var number = t.number;
	var data = {};
	data.id = UID();
	data.numberid = number.id;
	data.userid = number.userid;
	data.apikey = $.query.apikey;
	data.date = NOW.format('dd-MM-yyyy');
	data.ip = $.ip;
	data.ua = $.ua;
	data.status = 'pending';
	data.dtcreated = NOW;
	t.db.insert('tbl_request', data).callback(NOOP);


	if(t.is_maxlimit) {

	}
};

IP.refresh_limits = async function() {
	var t = this;
	if (t.monthly_count >= t.plan.maxlimit)
		t.is_maxlimit = true;

	var key = NOW.format('dd-MM-yyyy');
	let reqs = t.days[key];

	if (reqs && reqs.length >= t.plan.limit)
		t.is_limit = true;
}

IP.save_session = async function() {
	var t = this;
	var cl = t.memorize.data.cl;
	if (cl) {
		// try to check if remote browser has been successfully created
		var sessionurl = cl.baseurl + 'sessions/?token=' + cl.token;
		console.log('Browserless session url: ' + sessionurl);
		var page;
		var browser;
		RESTBuilder.GET(sessionurl).callback(function (err, sessions) {
			console.log('Browserless session: ' + sessions);
			sessions && sessions.wait(async function(item, next) {
				if (item.type == 'browser' && item.trackingId == t.phone && item.running)
					browser = item;

				if (item.type == 'page' && item.trackingId == t.phone && item.title.includes('WhatsApp'))
					page = item;

				next();
			}, async function()	{
				if (browser && page) {
					var data = {};
					data.id = browser.id;
					data.url = cl.url
					data.type = cl.type;
					data.hostname = cl.baseurl;
					data.datadir = browser.userDataDir;
					data.killurl = replaceHostname(browser.killURL, cl.baseurl);
					data.dtcreated = NOW;
					await t.db.insert('tbl_browserless', data).promise();
					t.browserid = browser.id;
					t.browser = browser;
					t.memorize.data.browser = browser;
					t.memorize.data.cl = cl;
					t.memorize.save();
					//console.log('Browserless session created: ' + t.phone);
					t.PUB('browserless', { env: t.Worker.data, content: browser });
					console.log('Browserless session created: ' + t.phone);
				}
			});
			// check if browser exists and page.title includes 'WhatsApp'

		});
	}
}
IP.ask = async function (number, chatid, content, type, isgroup, istag, user, group) {
	var t = this;
	const obj = {
		content: content,
		number: number,
		chatid: chatid,
		type: type,
		isgroup: isgroup,
		istag: istag,
		from: user,
		group: group
	};
	// if (t.Data.webhook) {
	// RESTBuilder.POST(t.Data.webhook, { type: CONF.antidel ? 'message_revoke_everyone' : 'message', data: obj }).header('x-token', t.Data.token).header('token', t.Data.token).callback(NOOP);
	// }
	if (t.origin == 'zapwize') {
		t.ws_send(obj);
	}
};

IP.sendMessage = async function (data) {
	if(data.chatid.indexOf('@') == -1) {
		var isphone = data.chatid.isPhone();

		if (isphone)
			data.chatid = data.chatid + '@c.us';
		else
			data.chatid = data.chatid + '@g.us';
	}
	this.whatsapp && await this.whatsapp.sendMessage(data.chatid, data.content);
};


IP.send_file = async function (data) {
	var t = this;
	var media;
	if(data.chatid.indexOf('@') == -1) {
		var isphone = data.chatid.isPhone();

		if (isphone)
			data.chatid = data.chatid + '@c.us';
		else
			data.chatid = data.chatid + '@g.us';
	}

	if (data.url)
		media = await MessageMedia.fromUrl(data.url);
	else
		media = new MessageMedia(data.content.base64ContentType(), data.content);

	if (data.caption)
		t.whatsapp && media && await t.whatsapp.sendMessage(data.chatid, media, { caption: data.caption });
	else
		t.whatsapp && media && await t.whatsapp.sendMessage(data.chatid, media);
};

IP.message = async function (msg, ctrl) {
	var t = this;
	var output = { reqid: UID() };
	var reqid = msg.reqid || UID();
	var topic = msg.topic;
	switch (topic) {
		case 'state':
		var state = t.whatsapp && await t.whatsapp.getState();
		output.content = state;
		break;
		case 'restart':
		case 'logout':
		t.whatsapp && await t.restartInstance();
		output.content = 'OK';
		break;
		case 'reset':
		t.whatsapp && await t.resetInstance();
		output.content = 'OK';
		break;
		case 'ping':
		case 'test':
		output.content = 'OK';
		break;
		case 'logs':
		output.content = t.logs;
		break;
		case 'config':
		output.content = t.Data;
		break;
		case 'memory':
		output.content = t.memorize.data;
		break;
		case 'memory_refresh':
		t.memory_refresh(msg.content);
		output.content = 'OK';
		break;

	}

	!ctrl && t.send(output);
	ctrl && !ctrl.ws && ctrl.json(output);
	ctrl && ctrl.ws && ctrl.client.send(output);
};

IP.save_file = async function (data, callback) {
	var obj = {};
	obj.name = GUID(35) + data.ext;
	obj.file = data.content;
	var fs = FILESTORAGE(data.number);

	var id = data.custom.dp;
	fs.save(id || UID(), obj.name, obj.file.base64ToBuffer(), function (err, meta) {
		meta.url = '/' + data.number + '/download/{0}.{1}'.format(meta.id.sign(CONF.salt), meta.ext);
		//callback && callback(meta);
	}, data.custom, CONF.ttl);
};

IP.onservice = function (tick) {
	var t = this;
	// we check some metrics about the remote browser cl.baseurl + 'metrics/total' + cl.token
	t.Worker = MEMORIZE(t.phone);

	if (tick % 30 == 0) {
		t.number && t.refresh_plans();
	}

	if (tick % 5 == 0) {
		t.number && t.refresh_plans();
	}

	t.refresh_days && t.refresh_days();
		t.refresh_limits && t.refresh_limits();
};



ON('ready', function () {
	U.ls(PATH.databases(), function (files, dirs) {
		var arr = [];

		var index = 0;
		for (var file of files) {
			let name = file.split('databases')[1].substring(1);
			let is = name.match(/^memorize_\d+\.json/);
			if (is) {
				F.Fs.readFile(PATH.databases(name), (err, data) => {

					if (err) {
						console.error("Error reading config file:", err);

					} else {
						if (index < 5) {
							let parsed = JSON.parse(data);
							let body = parsed.data;
							let instance = new MAIN.Instance(body.phone);
							MAIN.instances[body.phone] = instance;
							instance.init();
							index++;
						}
						console.log(`${name} read successfully.`);
					}
				});
			}
		}
	});
});
