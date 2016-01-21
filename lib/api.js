var fs = require('fs'),
    url = require('url'),

    Router = require('mixu_minimal').Router,

    Package = require('./package.js'),
    Resource = require('./resource.js'),
    ETag = require('./etag.js'),

    remoteUrl = 'http://registry.npmjs.com/',
    logger = console;

var api = new Router();

api.configure = function(config) {
  if (typeof config.remoteUrl !== 'undefined') {
    remoteUrl = config.remoteUrl;
  }
  if (typeof config.logger !== 'undefined') {
    logger = config.logger;
  }
};

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  var name = match[1];
  if (Package.isPrivate(name)) {
    return Package.proxy(req, res, 'excluding node private module ' + name);
  }
  Package.getIndex(name, function(err, fullpath, etag) {
    if (err) {
      res.statusCode = err.statusCode || 500;
      logger.error('[' + res.statusCode + '] Error: ', err);
      if (err.content) {
        res.write(err.content);
      }
      res.end();
      return;
    }

    if (ETag.handle304(req, res, etag)) {
      return;
    }

    res.end(JSON.stringify(fullpath));
  });
});

// GET /package/download/package-version.tgz
// GET /package/-/package-version.tgz
api.get(new RegExp('^/([^/]+)/(.+)/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      name2 = match[2],
      file = match[3],
      uri = remoteUrl + name + '/' + name2 + '/' + file;

  if (Package.isPrivate(name)) {
    return Package.proxy(req, res, 'excluding node private module ' + name);
  }

  // direct cache access - this is a file get, not a metadata get
  logger.log('cache get', uri);

  Resource.get(uri)
          .getReadablePath(function(err, fullpath, etag) {
            if (err) {
              res.statusCode = err.statusCode || 500;
              logger.error('[' + res.statusCode + '] Error: ', err);
              if (err.content) {
                res.write(err.content);
              }
              res.end();
              return;
            }

            if (ETag.handle304(req, res, etag)) {
              return;
            }

            res.setHeader('Content-type', 'application/octet-stream');
            fs.createReadStream(fullpath).pipe(res);
          });
});

// /-/ or /package/-/ are special
api.get(new RegExp('^/-/(.+)$'), Package.proxy);
api.get(new RegExp('^/(.+)/-(.*)$'), Package.proxy);

// GET /package/version
api.get(new RegExp('^/([^/]+)/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      version = match[2],
      self = this;

  if (Package.isPrivate(name)) {
    return Package.proxy(req, res, 'excluding node private module ' + name);
  }

  Package.getVersion(name, version, function(err, fullpath, etag) {
    if (err) {
      res.statusCode = err.statusCode || 500;
      logger.error('[' + res.statusCode + '] Error: ', err);
      if (err.content) {
        res.write(err.content);
      }
      res.end();
      return;
    }

    if (ETag.handle304(req, res, etag)) {
      return;
    }

    res.end(JSON.stringify(fullpath));
  });
});



module.exports = api;
