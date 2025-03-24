
FUNC.handle_voice = async  function(message, self) {

	if (message.isStatus)
		return;

	if (message.type === 'chat')
		return;

	if(!message.hasMedia)
		return

	var data = message['_data'];
	const media = await message.downloadMedia();


	var mmtype = data['mimetype'];
	if (mmtype !== 'audio/ogg; codecs=opus')
		return;

	var chatid = message.from;
	var chat = await message.getChat();
	var contact = await message.getContact();
	var number = message.from.split('@')[0];
	var mentions = await message.getMentions() || false;
	var istag = false;
	var isgroup = chat.isGroup;
	var forme = false;
	var user = {};
	var group = {};
	for (var m of mentions) {
		if (m.isMe)
			istag = true;
	}

	var qm = await message.getQuotedMessage();
	if (message.hasQuotedMsg) {

		if (qm.fromMe)
			forme = true;
	}

	if (isgroup && message.hasQuotedMsg && forme)
		istag = true;

	if (isgroup && istag)
		self.Data.sendrecording && chat.sendStateRecording();

	if (!isgroup)
		self.Data.sendrecording && chat.sendStateRecording();

	user.id = isgroup ? message.author : message.from;
	user.name = contact.name;
	user.pushname = contact.pushname;
	user.shortname = contact.shortname;
	user.number = contact.number;
	user.countrycode = await  FUNC.getCountryCode(number);

	group.name = chat.isGroup ? chat.name : '';
	group.id = chat.isGroup ? chatid: '';

	var content = 'data:application/ogg;base64,' + media.data;
	var data = {};
	data.content = content;
	data.ext = '.ogg';
	data.number = number;
	data.id = message.id;
	data.custom = { type: 'voice' };
	if (message['_data'])
		data.custom.dp = await FUNC.parseDP(message['_data'].directPath);

	self.save_file(data, function(response) {

		var quoted;
		if (message.hasQuotedMsg) {
			quoted = data.quotedMsg.body;

			if (qm.fromMe)
				forme = true;

			if (data.quotedMsg.body.length > 1200)
				quoted = data.quotedMsg.body.substring(0, 1200) + ' ...';

			response.caption = '"{0}": \n\n\n\n{1}'.format(quoted, text);
		}

		chat && self.Data.sendrecording && chat.sendStateRecording();
		self.ask(number, chatid, response, 'voice', isgroup, istag, user, group);
	});
};

// parse DirectPath from message.
FUNC.parseDP = function(query) {
	return new Promise(function(resolve) {
		var split = query.split('?ccb')[0];
		var spliter = '-';

		if (split.indexOf('.enc') > -1)
			spliter = '.enc';

		var temp = split.split(spliter)[0];

		var index = temp.lastIndexOf('/');
		var str = temp.substring(index + 1);
		resolve(str);
	});
};


FUNC.handle_textonly = async  function(message, self) {

	var quoted;
	if (message.hasMedia)
		return;

	if (message.isStatus)
		return;


	var chatid = message.from;
	var chat = await message.getChat();
	var contact = await message.getContact();
	var number = message.from.split('@')[0];
	var mentions = await message.getMentions() || false;
	var istag = false;
	var isgroup = chat.isGroup;
	var forme = false;
	var user = {};
	var group = {};

	for (var m of mentions) {
		if (m.isMe)
			istag = true;
	}

	var data = message['_data'];
	var qm = await message.getQuotedMessage();
	if (message.hasQuotedMsg) {
		quoted = data.quotedMsg.body;

		if (qm.fromMe)
			forme = true;

		if (quoted)
			quoted = quoted.substring(0, 2200) + ' ...';

		if (quoted)
			message.body = '"{0}": \n\n\n\n{1}'.format(quoted, message.body);
	}

	if (isgroup && message.hasQuotedMsg && forme)
		istag = true;

	if (isgroup && istag)
		self.Data.sendtyping && chat.sendStateTyping();


	if (!isgroup)
		self.Data.sendtyping && chat.sendStateTyping();

	user.id = isgroup ? message.author : message.from;
	user.name = contact.name;
	user.pushname = contact.pushname;
	user.shortname = contact.shortname;
	user.number = contact.number;
	user.countrycode = await  FUNC.getCountryCode(number);

	group.name = chat.isGroup ? chat.name : '';
	group.id = chat.isGroup ? chatid: '';

	message.body && self.ask(number, chatid, message.body, 'text', isgroup, istag, user, group);
};

FUNC.send_seen = async  function(message, self) {
	var chat = await message.getChat();
	// send send_seen
	chat && self.Data.sendseen && chat.sendSeen();
};
FUNC.handle_media = async  function(message, self) {

	if (message.isStatus)
		return;

	if (!message.hasMedia)
		return;

	var chatid = message.from;
	var chat = await message.getChat();
	var contact = await message.getContact();
	var number = message.from.split('@')[0];
	var mentions = await message.getMentions() || false;
	var istag = false;
	var isgroup = chat.isGroup;
	var forme = false;
	var user = {};
	var group = {};

	var type = message['_data']['type'];

	if (type == 'image')
		return;

	for (var m of mentions) {
		if (m.isMe)
			istag = true;
	}

	var data = message['_data'];
	var caption = message['_data'].caption;
	var mmtype = data['mimetype'];
	if (mmtype == 'audio/ogg; codecs=opus')
		return;


	var qm = await message.getQuotedMessage();
	if (message.hasQuotedMsg) {

		if (qm.fromMe)
			forme = true;
	}

	if (isgroup && message.hasQuotedMsg && forme)
		istag = true;

	if (isgroup && istag)
		self.Data.sendrecording && chat.sendStateRecording();


	if (!isgroup)
		self.Data.sendrecording && chat.sendStateRecording();

	user.id = isgroup ? message.author : message.from;
	user.name = contact.name;
	user.pushname = contact.pushname;
	user.shortname = contact.shortname;
	user.number = contact.number;
	user.countrycode = await FUNC.getCountryCode(number);

	group.name = chat.isGroup ? chat.name : '';
	group.id = chat.isGroup ? chatid: '';

	var number = message.from.split('@')[0];
	var model = {};
	model.media = await message.downloadMedia();
	model.message = message;

	var content = 'data:' + data.mimetype + ';base64,' + model.media.data;

	var obj = {};
	obj.content = content;
	obj.ext = '.' + U.getExtensionFromContentType(data.mimetype);
	obj.number = number;
	obj.id = message.id;
	obj.custom = { type: 'media' };

	if (caption)
		obj.caption = caption;

	if (message['_data'])
		obj.custom.dp = await FUNC.parseDP(message['_data'].directPath);

	self.save_file(obj, function(response) {
		self.ask(number, chatid, response, 'file', isgroup, istag, user, group);
	});

};

FUNC.handle_image = async  function(message, self) {


	if (message.isStatus)
		return;

	var chatid = message.from;
	var chat = await message.getChat();
	var mentions = await message.getMentions() || [];
	var number = message.from.split('@')[0];
	var isgroup = chat.isGroup;
	var istag = false;
	var contact = await message.getContact();
	var user = {};
	var group = {};

	for (var m of mentions) {
		if (m.isMe)
			istag = true;
	}

	if (message.hasMedia) {
		var media = await message.downloadMedia();
		var type = message['_data']['type'];

		if (type !== 'image')
			return;
		else  {
			var content = 'data:image/jpg;base64,' + media.data;

			var caption = message['_data'].caption;

			user.id = isgroup ? message.author : message.from;
			user.name = contact.name;
			user.pushname = contact.pushname;
			user.shortname = contact.shortname;
			user.number = contact.number;

			group.name = chat.isGroup ? chat.name : '';
			group.id = chat.isGroup ? chatid: '';
			var obj = { id: message.id, ext: '.jpg', content: content, number: number };
			obj.custom = { type: 'image' };

			if (caption)
				obj.custom.caption = caption;

			if (message['_data'])
				obj.custom.dp = await FUNC.parseDP(message['_data'].directPath);

			self.save_file(obj, function(response) {
				if (caption)
					response.caption = caption;

				self.ask(number, chatid, response, 'image', isgroup, istag, user, group);
			});
		}
	}
};
FUNC.handle_status = async function(message, self){

	if (message.isStatus) {
		var model = {};
		model.body = message.body;
		model.caption = message.caption;
		var user = {};
		var group = {};
		var chatid = message.from;
		var number = message.from.split('@')[0];
		user.chatid = chatid;
		user.number = number;

		if (message.hasMedia) {
			model.media = await message.downloadMedia();
			var number = message.from.split('@')[0];
			model.message = message;

			var content = 'data:' + model.media.mimetype + ';base64,' + model.media.data;

			var obj = {};
			obj.content = content;
			obj.ext = '.' + U.getExtensionFromContentType(model.media.mimetype);
			obj.number = number;
			obj.id = message.id;

			obj.custom = { type: 'status' };
			if (model.caption)
				obj.custom.caption = model.caption;
			if (message['_data'])
				obj.custom.dp = await FUNC.parseDP(message['_data'].directPath);
			self.save_file(obj, function(response) {
				response.body = message.body;
				response.caption = message.caption;
				self.ask(number, chatid, response, 'status', false, false, user, group);
			});
		} else {
			var number = message.from.split('@')[0];
			self.ask(number, chatid, model, 'status', false, false, user, group);
		}
	}
};

FUNC.handle_contact = async function(message, self) {

	var contact = await message.getContact();

	if (contact.isBusiness) {
		contact.profile = contact.businessProfile;
	}

	//contact.about = await contact.getAbout();

	var model = {};
	model.data = contact;
	self.PUB('whatsapp_contact', model, 'tms');
};

FUNC.delete_file = function(path, timeout) {
	if (!timeout)
		timeout = 5000;

	var id = setTimeout(function() {
		F.Fs.unlink(path, function() {
			clearTimeout(id);
		});
	}, timeout);
};

FUNC.save_file = async function(data, callback) {
	var obj = {};
	obj.name = GUID(35) + data.ext ;
	obj.file = data.content;
	var fs = FILESTORAGE(data.number);
	fs.save(data.id || UID(), obj.name, obj.file.base64ToBuffer(), function(err, meta) {
		meta.url = '/' + data.number + '/download/{0}.{1}'.format(meta.id.sign(CONF.salt), meta.ext);
		//callback && callback(meta);
	});
};


FUNC.save_ogg = async function(base64, number, callback) {
	const id = GUID(16);
	const filename = id + '.ogg';

	try {
		// Write the base64 data to the file
		await F.Fs.promises.writeFile(filename, base64.base64ToBuffer());

		var fs = FILESTORAGE(number);
		fs.save(id, filename, base64.base64ToBuffer(), function(err, meta) {
			meta.url =  '/' + number + '/download/{0}.{1}'.format(meta.id.sign(CONF.salt), meta.ext);
			callback && callback(meta);
		});
	} catch (err) {
		// Remove the file if it exists and an error occurred
		if (F.Fs.existsSync(filename)) {
			await F.Fs.promises.unlink(filename);
		}
		callback && callback(err);
	}
};
