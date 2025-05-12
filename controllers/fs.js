exports.install = function() {
	ROUTE('POST /upload/ @upload <5MB', upload);
	ROUTE('FILE /download/{db}/*.*', download);

	ROUTE('#401', function()             {
		respond(this, 401,                   'Unauthorized request');
	});

	ROUTE('#404', function()             {
		respond(this, 404,                   'Ressource not found');
	});

	ROUTE('#400', function()             {
		respond(this, 400,                   'Bad Request');
	});

};

function respond(self, code, message) {
	self.json({success: false, code: code, value: message});
}


async function upload($) {
	var $ = this;
	var output = [];

	for (var file of $.files) {
		var response = await file.fs('files', UID());
		response.url = '/download/{0}.{1}'.format(response.id.sign(CONF.salt), response.ext);
		output.push(response);
	}

	$.json(output);
}

function download(req, res) {

	var db = req.split[2];
	var index = req.split[2].lastIndexOf('.');
	if (index !== -1) {
		var hash = req.split[2].substring(0, index);
		var id = hash.substring(0, hash.indexOf('-', 10));
		if (hash === id.sign(CONF.salt)) {
			res.filefs(db, id);
			return;
		}
	}

	res.throw404();
}