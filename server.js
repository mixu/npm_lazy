var http = require('http'),
    path = require('path'),
    fs = require('fs'),
    url = require('url'),
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
    minilog.pipe(fs.createWriteStream(config.loggingOpts.filename, {flags: 'w'}));
  }

  // parse proxy config, see https://wiki.archlinux.org/index.php/proxy_settings for an example
  if (!config.proxy || !config.proxy.http || !config.proxy.https) {
    config.proxy = {
      http: (process.env.http_proxy ? process.env.http_proxy : config.proxy.http),
      https: (process.env.https_proxy ? process.env.https_proxy : config.proxy.https)
    };
  }

  if (config.proxy.http) {
    if (!config.proxy.https) {
        // fall back to assuming that both http and https use the same proxy
        config.proxy.https = config.proxy.http;
    }
    // parse
    if (typeof config.proxy.http === 'string') {
      config.proxy.http = url.parse(config.proxy.http);
    }
    if (typeof config.proxy.https === 'string') {
      config.proxy.https = url.parse(config.proxy.https);
    }
  }

  Resource.configure({
    cache: new Cache({ path: config.cacheDirectory }),
    logger: log,
    cacheAge: config.cacheAge,
    maxRetries: config.maxRetries,
    timeout: config.httpTimeout,
    rejectUnauthorized: config.rejectUnauthorized,
    proxy: config.proxy
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
    if (config.loggingOpts.logRequesterIP) {
      log.info("Request from ip: "+req.connection.remoteAddress+ " for "+req.url);
    }
    if (!api.route(req, res)) {
      log.error('No route found', req.url);
      Package.proxy(req, res);
    }
  }).listen(config.port, config.host);

  process.on('SIGTERM', () => {
    log.info('SIGTERM signal received.');
    log.log('Closing http server.');
    server.close(() => {
      log.log('Http server closed.');
    });
  });
  process.on('SIGINT', () => {
    log.info('SIGINT signal received.');
    log.log('Closing http server.');
    server.close(() => {
      log.log('Http server closed.');
    });
  });

  log.info('npm_lazy at', config.host, 'port', config.port);
  log.info('npm_lazy cache directory:', path.normalize(config.cacheDirectory));

  // log the proxy config
  Object.keys(config.proxy).forEach(function(proto) {
    var conf = config.proxy[proto];
    if (conf) {
      log.info('Using ' + conf.protocol + '//' + conf.hostname + ':' + conf.port + ' to proxy ' + proto + ' requests.');
    }
  });

  /*
  Resource.get('http://www.lagado.com/proxy-test')._fetchTask(function(err, res) {
    if(res) {
      res.pipe(process.stdout);
    }
  });
  */
}


// if this module is the script being run, then load the default config and run
// makes it possible to call `node server.js` and have it work like before.
// Alternatively, you can require server.js and then call the start function with a
// custom config like we do in ./bin/npm_lazy
if (module == require.main) {
  start(require('./config.js'));
}

module.exports = start;
