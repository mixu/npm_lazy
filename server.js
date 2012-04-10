var http = require('http'),
    Server = require('./lib/server');


var server = http.createServer();

Server.attach(server).listen(8080, 'localhost');

