var fs = require('fs'),
    url = require('url'),

    Router = require('mixu_minimal').Router,

    Package = require('./package.js'),
    Resource = require('./resource.js'),
    ETag = require('./etag.js'),

    remoteUrl = 'https://registry.npmjs.com/',
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
  var auth = req.headers.authorization;

  Package.getIndex(name, auth, function(err, fullpath, etag) {
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
api.get(new RegExp('^/([^/]+)/(-|download)/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      name2 = match[2],
      file = match[3],
      uri = remoteUrl + name + '/' + name2 + '/' + file;
  return downloadTar(req, res, uri);
});
// GET /@scope/package/-/package-version.tgz
api.get(new RegExp('^/(@.+)/-/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      file = match[2],
      uri = remoteUrl + name + '/-/' + file;
  return downloadTar(req, res, uri);
});

function downloadTar(req, res, uri) {
  // direct cache access - this is a file get, not a metadata get
  logger.log('cache get', uri);
  var auth = req.headers.authorization;

  Resource.get(uri, auth)
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
}

// /-/ or /package/-/ are special
api.get(new RegExp('^/-/(.+)$'), Package.proxy);
api.get(new RegExp('^/(.+)/-(.*)$'), Package.proxy);

// GET /package/version
api.get(new RegExp('^/([^/]+)/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      version = match[2],
      self = this;

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
