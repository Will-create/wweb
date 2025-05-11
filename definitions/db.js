require('querybuilderpg').init('', CONF.database, 1, ERROR('DB'));
ON('ready', function() {
    FUNC.refresh_config();
})