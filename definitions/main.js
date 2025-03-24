
MAIN.Instance = function  (phone) {
	const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

	var w = MEMORIZE(phone);
	var data = w.data;
	if (!data.id)
		data.id = UID();

	w.save();

	var t = this;
	t.phone = phone;
	t.Worker = w;
	t.Data = t.Worker.data;
	t.id = data.id;

	t.pairingCodeEnabled = t.phone && t.Data.mode == 'code' ? true : false;
	t.pairingCodeRequested = false;

	// Create whatapp instance
	var opt = {};
	opt.authStrategy = new LocalAuth({ dataPath: './.wwebjs_auth/' + t.Data.id });
	// opt.webVersion = '2.2412.50';
	// opt.webVersionCache = { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html' };
	opt.puppeteer = { args: [ '--disable-setuid-sandbox', '--no-sandbox'], headless: true };
	const client = new Client(opt);
	t.whatsapp = client;


	// Listen to whatsapp events
	t.whatsapp.on('message', (message) => FUNC.handle_status(message, t));
	t.whatsapp.on('message', (message) => FUNC.send_seen(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_voice(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_textonly(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_media(message, t));
	//t.whatsapp.on('message', (message) => FUNC.handle_contact(message, t));
	t.whatsapp.on('message', (message) => FUNC.handle_image(message, t));
	t.whatsapp.on('ready', () => {
		CALL('Client --> info').callback(function(err, info) {
			var model = {};
			model.data = info;
			t.PUB('whatsapp_ready', model);
			CONF.antidel && t.whatsapp && t.whatsapp.sendMessage(t.phone + '@c.us', 'Integration OK');
		});
	});

	t.whatsapp.on('qr', async function(qr) {
		if (t.pairingCodeEnabled && !t.pairingCodeRequested) {
			const pairingCode = await t.whatsapp.requestPairingCode(t.phone); // enter the target phone number
			console.log('Pairing code enabled, code: '+ pairingCode);
			t.pairingCodeRequested = true;
			t.PUB('code', { env: t.Worker.data, content: pairingCode });
		}

		if (!t.pairingCodeEnabled) {
			t.PUB('qr', { env: t.Worker.data, content: qr });
		}
	});

	t.whatsapp.on('loading_screen', (percent, message) => {
		t.PUB('loading_screen', { env: t.Worker.data, content: message + '|' + percent });
	});

	t.whatsapp.on('authenticated', () => {
		t.PUB('authenticated', { env: t.Worker.data });
	});

	t.whatsapp.on('auth_failure', msg => {
		// Fired if session restore was unsuccessful
		t.PUB('auth_failure', { env: t.Worker.data, content: msg });
	});
	t.whatsapp.on('disconnected', msg => {
		// Fired if session restore was unsuccessful
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
			console.log('NUMBER: ', number);

			user.id = isgroup ? before.author : before.from;
			user.name = contact.name;
			user.pushname = contact.pushname;
			user.shortname = contact.shortname;
			user.number = contact.number;
			user.countrycode = await  FUNC.getCountryCode(number);

			group.name = chat.isGroup ? chat.name : '';
			group.id = chat.isGroup ? chatid: '';
			if (before._data.directPath) {
				var dp = await FUNC.parseDP(before._data.directPath);
				fs.readbuffer(dp, function(err, buffer, meta) {
					RESTBuilder.POST(CONF.fs.format(number)).file('file', meta.name, buffer).keepalive().timeout(120000).callback(async function(err, response) {
						response.user = user;
						response.group = group;
						response.type = meta.custom.type,
						response.chatid = chatid;
						response.number = number;
						response.caption = meta.custom.caption;
						t.PUB('message_revoke_everyone', { env: t.Worker.data, content: response });
						//t.ask(number, chatid, response, meta.custom.type, isgroup, istag, user, group);
					});
				})
			} else {
				var res = {};
				res.user = user;
				res.group = group;
				res.type = 'text';
				res.chatid = chatid;
				res.number = number;
				res.content = before.body;
				t.PUB('message_revoke_everyone', { env: t.Worker.data, content: res });

			}
		}
	});

	ON('service', t.onservice);
};

var IP = MAIN.Instance.prototype;

IP.send  = function(obj) {
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

IP.memory_refresh = function(body, callback) {
	var t = this;

	if (body) {
		for (var key in body)
			Worker.data[key] = body[key];
	}

	t.Worker.save();

	t.Worker = MEMORIZE(t.phone);
	callback && callback();
};
IP.init = function() {
	var t = this;

	ROUTE('POST /config/' + t.phone, function(phone) {
		var self = this;
		var body = self.body;
		t.memory_refresh(body, function() {
			self.success();
		});
	});

	ROUTE('GET /config/' + t.phone, function(phone) {
		var self = this;
		self.json(t.Data);
	});

	ROUTE('POST /rpc/' + t.phone, function(phone) {
		var self = this;
		var payload = self.body;
		t.message(payload, self);
	});

	ROUTE('POST /' + t.phone + t.Data.messageapi, function() {
		var self = this;
		t.sendMessage(self.body);
		self.success();
	});

	ROUTE('POST /' + t.phone + t.Data.mediaapi, function() {
		var self = this;
		t.send_file(self.body);
		self.success();
	});

	setTimeout(function() {
		console.log('Initializing whatsapp: ' + t.id);
		t.whatsapp.initialize();
	}, 500);
};

IP.PUB = function(topic, obj, broker) {
	var t = this;
	obj.env = t.Worker.data;
	obj.topic = topic;
	t.send(obj);
};

IP.ask = async  function(number, chatid, content, type, isgroup, istag, user, group) {
	var t = this;
	const obj = {
		content: content,
		number: number,
		chatid: chatid,
		type: type,
		isgroup: isgroup,
		istag: istag,
		user: user,
		group: group
	};

	// if (t.Data.webhook) {
		// RESTBuilder.POST(t.Data.webhook, { type: CONF.antidel ? 'message_revoke_everyone' : 'message', data: obj }).header('x-token', t.Data.token).header('token', t.Data.token).callback(NOOP);
	// }
};

IP.sendMessage = function(data) {
	this.whatsapp && this.whatsapp.sendMessage(data.chatid, data.content);
};


IP.send_file = async function(data) {
	var t = this;
	var media;

	if (data.type == 'url')
		media = await MessageMedia.fromUrl(data.content);
	else
		media = data.content;

	if (data.caption)
		t.whatsapp && media && t.whatsapp.sendMessage(data.chatid, media, { caption: data.caption });
	else
		t.whatsapp && media && t.whatsapp.sendMessage(data.chatid, media);
};




IP.message = async  function(msg, ctrl) {
	var t = this;
	var output = { reqid, env: t.Worker.data };
	var reqid = msg.reqid || UID();
	var topic = msg.msg.topic;
	switch(topic) {
		case 'state':
		var state = t.whatsapp && await t.whatsapp.getState();
		output.content = state;
		break;
		case 'logout':
		t.whatsapp && await t.whatsapp.logout();
		output.content = 'OK';
		break;
		case 'ping':
		case 'test':
		output.content = 'OK';
		break;
	}

	!ctrl && t.send(output);
	ctrl && ctrl.json(output);

};

IP.save_file = async function(data, callback) {
	var obj = {};
	obj.name = GUID(35) + data.ext ;
	obj.file = data.content;
	var fs = FILESTORAGE(data.number);

	var id = data.custom.dp;
	fs.save(id || UID(), obj.name, obj.file.base64ToBuffer(), function(err, meta) {
		meta.url = '/' + data.number + '/download/{0}.{1}'.format(meta.id.sign(CONF.salt), meta.ext);
		//callback && callback(meta);
	}, data.custom, CONF.ttl);
};

IP.onservice = function() {
	var t = this;
	t.Worker = MEMORIZE(t.phone);
};



ON('ready', function() {
	U.ls(PATH.databases(), function(files, dirs) {
		var arr = [];

		for (var file of files) {
			var name = file.split('databases')[1].substring(1);
			var is = name.match(/^memorize_\d+\.json/);
			if (is) {
				console.log(name);
				F.Fs.readFile(PATH.databases(name), (err, data) => {

					if (err) {
						console.error("Error reading config file:", err);

					} else {
						var parsed = JSON.parse(data);
						var body = parsed.data;
						var instance = new MAIN.Instance(body.phone);
						MAIN.instances[body.phone] = instance;
						instance.init();
						console.log(`${name} read successfully.`);
					}
				});
			}

		}
	});
});

var index = 1;
setInterval(function() {
	console.log('TICKS', index++);
}, 10000);