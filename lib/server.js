var url = require('url'),

    Cache = require('./cache.js'),
    Client = require('./client.js'),
    Router = require('./router.js'),
    config = require('../config.js');

var api = new Router();

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  Cache.getAll(match[1], function(err, data) {
    if(err) throw err;
    res.end(JSON.stringify(Server.rewriteLocation(data)));
  });
});

// GET /package/-/package-version.tgz
api.get(new RegExp('^/(.+)/-/(.+)$'), function(req, res, match) {
  Cache.respondTar(match[1], match[2], res);
});

// /-/ or /package/-/ are special
api.get(new RegExp('^/-/(.+)$'), function(req, res, match) {
  console.log('Not implemented', req.url);
  res.end();
});

api.get(new RegExp('^/(.+)/-(.*)$'), function(req, res, match) {
  console.log('Not implemented', req.url);
  res.end();
});

// GET /package/version
api.get(new RegExp('^/(.+)/(.+)$'), function(req, res, match) {
  Cache.getVersion(match[1], match[2], function(err, data) {
    res.end(JSON.stringify(Server.rewriteLocation(data)));
  });
})

function Server() { }

Server.attach = function(httpServer) {
  httpServer.on('request', function(req, res) {
    if(!api.route(req, res)) {
      console.log('No route found', req.url);
      res.end();
    }
  });
  return httpServer;
};

Server.rewriteLocation = function(meta) {
  if(meta.versions) {
    // if a full index, apply to all versions
    Object.keys(meta.versions).forEach(function(version) {
      meta.versions[version] = Server.rewriteLocation(meta.versions[version]);
    });
  }

  if (meta.dist && meta.dist.tarball) {
    var parts = url.parse(meta.dist.tarball);
    meta.dist.tarball = config.externalUrl+parts.pathname;
  }
  return meta;
};

Server.setBackend = function(backend) { Cache = backend; }

module.exports = Server;
