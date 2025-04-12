if (!MAIN.instances)
	MAIN.instances = {};

MAIN.isfull = false;

exports.install = function() {
	ROUTE('GET /instances/list/', instances_list);
	ROUTE('POST /instances/create/', instances_create);
	ROUTE('GET /instances/read/{phone}/', instances_read);
	ROUTE('GET /instances/logs/{phone}/', instances_logs);
	ROUTE('GET /instances/reset/{phone}/', instances_reset);
	ROUTE('GET /instances/state/{phone}/', instances_state);
	ROUTE('POST /instances/remove/{phone}/', instances_remove);
};

function instances_logs(phone) {
	var self = this;
	var instance = MAIN.instances[phone];

	if (!instance) {
		self.invalid("Instance not found");
		return;
	}
	var output = {};
	output.logs = instance.logs || [];
	output.state = instance.whatsapp.state();
	output.code = instance.code;
	output.isfull = MAIN.isfull;
	output.env = instance.Data;
	self.json(output);
}

async function instances_reset(phone, self) {
	if (!self)
		var self = this;

	var instance = MAIN.instances[phone];
	await instance.whatsapp.destroy();

	var newinstance = new MAIN.Instance(phone);
	MAIN.instances[phone] = newinstance;
	newinstance.init();
	FUNC.refresh_count();

	self.json({ success: true, message: 'Instance created and config file saved' });
}

function instances_state(phone) {
	var self = this;
	var instance = MAIN.instances[phone];
	self.json(instance.laststate());
}

function instances_list() {
	var self = this;
	self.json(MAIN.instances);
}

async function instances_create() {
	var self = this;
	var body = self.body;

	if (!body.phone) {
		self.json({ error: 408, message: 'Invalid request' });
		return;
	}


	if (MAIN.isfull) {
		self.json({ error: 400, message: 'Invalid request' });
		return;
	}

	if (MAIN.instances[body.phone]) {
		var item = MAIN.instances[body.phone];

		var state = await item.whatsapp.getState();

		if (state !== 'CONNECTED') {
			instances_reset(body.phone, self);
			return;
		} else {
			self.json({ success: true, message: 'Instance created and config file saved' });
			return;
		}

	}

	// Define file path
	const configPath = PATH.databases(`memorize_${body.phone}.json`);


	// JSON config content
	const configData = {
		data: {
			name: body.name || "Muald",
			mode: body.mode || "code",
			baseurl: body.baseurl || "https://whatsapp.muald.com",
			phone: body.phone,
			token: body.token || "token",
			messageapi: body.messageapi || "/api/message/",
			mediaapi: body.mediaapi || "/api/media/",
			rpc: body.rpc || "/api/rpc/",
			webhook: body.webhook || "https://app.zapwize.com/api/mobile/webhook",
			id: body.id || UID(),
			status: body.status || "active",
			sendseen: body.sendseen || false,
			sendtyping: body.sendtyping || false,
			sendrecording: body.sendrecording || false
		},
		id: body.id || UID()
	};

	// Write the file asynchronously
	F.Fs.writeFile(configPath, JSON.stringify(configData, null, 4), (err) => {

		if (err) {
			console.error("Error writing config file:", err);
			self.json({ error: 500, message: 'Failed to create config file' });
		} else {
			var instance = new MAIN.Instance(body.phone);
			MAIN.instances[body.phone] = instance;
			instance.init();
			console.log(`${configPath} created successfully.`);
			FUNC.refresh_count();
			self.json({ success: true, message: 'Instance created and config file saved' });
		}
	});
}

function instances_remove(phone) {
    var self = this;

    // Define file path
	const configPath = PATH.databases(`memorize_${phone}.json`);

    // Check if the file exists
    F.Fs.access(configPath, F.Fs.constants.F_OK, (err) => {
        if (err) {
            self.json({ error: 404, message: 'Instance not found' });
            return;
        }

        // Remove file
        F.Fs.unlink(configPath, (err) => {
            if (err) {
                console.error("Error deleting config file:", err);
                self.json({ error: 500, message: 'Failed to remove instance' });
            } else {
                // Remove from MAIN.instances
                delete MAIN.instances[phone];
                self.json({ success: true, message: 'Instance removed successfully' });
            }
        });
    });
}


function instances_read(phone) {
    var self = this;

	const configPath = PATH.databases(`memorize_${phone}.json`);
    // Read file
    F.Fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading config file:", err);
            self.json({ error: 404, message: 'Instance not found' });
        } else {
            self.json(JSON.parse(data));
        }
    });
}


FUNC.refresh_count = function() {
	var keys = Object.keys(MAIN.instances);

	if (keys.length >= CONF.max_number)
		MAIN.isfull = true
};