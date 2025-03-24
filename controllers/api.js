if (!MAIN.instances)
	MAIN.instances = [];

exports.install = function() {
	ROUTE('GET /instances/list/', instances_list);
	ROUTE('POST /instances/create/', instances_create);
	ROUTE('GET /instances/read/{phone}/', instances_read);
	ROUTE('POST /instances/remove/{phone}/', instances_remove);
};
function instances_list() {

	var self = this;
	self.json(MAIN.instances);
}
function instances_create() {
	var self = this;
	var body = self.body;

	if (!body.phone) {
		self.json({ error: 408, message: 'Invalid request' });
		return;
	}

	if (MAIN.instances[body.phone]) {
		$.success(MAIN.instances[body.phone].Data);
		return;
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
			webhook: body.webhook || "https://instance.zapwize.com/stream/webhook/",
			id: body.id || "1jns8001sn51d",
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
