var http = require('http'),
    path = require('path'),

    api = require('./lib/api.js'),
    Cache = require('./lib/cache2.js'),
    Package = require('./lib/package.js'),
    Resource = require('./lib/resource.js');

function start(config) {
  Resource.configure({
    cache: new Cache({ path: config.cacheDirectory }),
    cacheAge: config.cacheAge,
    maxRetries: config.maxRetries,
    timeout: config.httpTimeout,
    rejectUnauthorized: config.rejectUnauthorized
  });

  var packageConfig = {
    externalUrl: config.externalUrl,
    remoteUrl: config.remoteUrl
  };

  Package.configure(packageConfig);
  api.configure(packageConfig);

  var server = http.createServer();

  server.on('request', function(req, res) {
    if (!api.route(req, res)) {
      console.log('No route found', req.url);
      res.end();
    }
  }).listen(config.port, config.host);

  console.log('npm_lazy at', config.host, 'port', config.port);
  console.log('npm_lazy cache directory:', path.normalize(config.cacheDirectory));
};


// if this module is the script being run, then load the default config and run
// makes it possible to call `node server.js` and have it work like before.
// Alternatively, you can require server.js and then call the start function with a
// custom config like we do in ./bin/npm_lazy
if (module == require.main) {
  start(require('./config.js'));
}

module.exports = start;
