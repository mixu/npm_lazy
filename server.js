var http = require('http'),
    app = require('./lib/app.js'),
    config = require('./config.js'),
    api = app.Api;

app.configure(config);

var server = http.createServer();

server.on('request', function(req, res) {
  if(!api.route(req, res)) {
    console.log('No route found', req.url);
    res.end();
  }
}).listen(config.port, config.host);
