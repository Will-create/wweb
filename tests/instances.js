require('total4');
var url = 'http://localhost:8000/'; // Update with your actual API URL

TESTER(async function(group, start) {
	group('Instances API', function(test) {

		// Test 1: List instances
		test('GET /instances/list/', function(next) {
			RESTBuilder.GET(url + 'instances/list/').callback(function(err, response) {
				if (err) {
					console.error('❌ Failed to list instances:', err);
				} else {
					console.log('✅ Instances list retrieved:', response);
				}
				next();
			});
		});

		// Test 2: Create instance
		test('POST /instances/create/', function(next) {
			var payload = {
				phone: '1234567890',
				name: 'TestInstance',
				token: 'testtoken'
			};

			RESTBuilder.POST(url + 'instances/create/').json(payload).callback(function(err, response) {
				if (err) {
					console.error('❌ Instance creation failed:', err);
				} else {
					console.log('✅ Instance created:', response);
				}
				next();
			});
		});

		// Test 3: Read instance
		test('GET /instances/read/{phone}/', function(next) {
			var phone = '1234567890';
			RESTBuilder.GET(url + `instances/read/${phone}/`).callback(function(err, response) {
				if (err) {
					console.error('❌ Failed to read instance:', err);
				} else {
					console.log('✅ Instance read successfully:', response);
				}
				next();
			});
		});

		// Test 4: Remove instance
		test('POST /instances/remove/{phone}/', function(next) {
			var phone = '1234567890';
			RESTBuilder.POST(url + `instances/remove/${phone}/`).callback(function(err, response) {
				if (err) {
					console.error('❌ Failed to remove instance:', err);
				} else {
					console.log('✅ Instance removed:', response);
				}
				next();
			});
		});

	});
	start();
});
