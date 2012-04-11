var http = require('http'),
    Server = require('./lib/server'),

    config = require('./config.js');


var server = http.createServer();

Server.attach(server).listen(config.port, config.host);

