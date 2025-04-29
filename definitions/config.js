FUNC.refresh_config = function(callback) {
	DB().find('cl_config').fields('id,type,value').data(LOADCONFIG).callback(function() {
		EMIT('configure');
		callback && callback();
	});
};