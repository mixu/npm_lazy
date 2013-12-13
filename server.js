var http = require('http'),

    api = require('./lib/api.js'),
    Cache = require('./lib/cache2.js'),
    Package = require('./lib/package.js'),
    Resource = require('./lib/resource.js'),
    config = require('./config.js'),
    fs = require('fs'),
    argv = require('optimist')
      .default('config', config)
      .alias('c', 'config')
      .argv;

if (argv.config){
  config = require(argv.config);
}

Resource.configure({
  cache: new Cache({ path: config.cacheDirectory }),
  cacheAge: config.cacheAge,
  maxRetries: config.maxRetries,
  timeout: config.httpTimeout,
  rejectUnauthorized: config.rejectUnauthorized
});

Package.configure({
  externalUrl: config.externalUrl,
  remoteUrl: config.remoteUrl
});

var server = http.createServer();

server.on('request', function(req, res) {
  if (!api.route(req, res)) {
    console.log('No route found', req.url);
    res.end();
  }
}).listen(config.port, config.host);

console.log('npm_lazy at', config.host, 'port', config.port);
