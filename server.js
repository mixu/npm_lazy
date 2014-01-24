var http = require('http'),
    path = require('path'),
    fs = require('fs'),
    log = require('minilog')('app'),

    api = require('./lib/api.js'),
    Cache = require('./lib/cache.js'),
    Package = require('./lib/package.js'),
    Resource = require('./lib/resource.js');

function start(config) {
  var minilog = require('minilog');

  if (config.loggingOpts.logToConsole) {
    minilog.enable();
  } else {
    minilog.disable();
  }

  if (config.loggingOpts.logToFile) {
    minilog.pipe(fs.createWriteStream(config.loggingOpts.filename));
  }

  Resource.configure({
    cache: new Cache({ path: config.cacheDirectory }),
    logger: log,
    cacheAge: config.cacheAge,
    maxRetries: config.maxRetries,
    timeout: config.httpTimeout,
    rejectUnauthorized: config.rejectUnauthorized
  });

  var packageConfig = {
    logger: log,
    externalUrl: config.externalUrl,
    remoteUrl: config.remoteUrl,
    rejectUnauthorized: config.rejectUnauthorized
  };

  Package.configure(packageConfig);
  api.configure(packageConfig);

  var server = http.createServer();

  server.on('request', function(req, res) {
    if (!api.route(req, res)) {
      log.error('No route found', req.url);
      Package.proxy(req, res);
    }
  }).listen(config.port, config.host);

  log.info('npm_lazy at', config.host, 'port', config.port);
  log.info('npm_lazy cache directory:', path.normalize(config.cacheDirectory));
}


// if this module is the script being run, then load the default config and run
// makes it possible to call `node server.js` and have it work like before.
// Alternatively, you can require server.js and then call the start function with a
// custom config like we do in ./bin/npm_lazy
if (module == require.main) {
  start(require('./config.js'));
}

module.exports = start;
