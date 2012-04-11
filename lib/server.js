var url = require('url'),

    Cache = require('./cache.js'),
    Client = require('./client.js'),
    Router = require('./router.js');

var api = new Router();

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  Cache.getAll(match[1], function(err, data) {
    if(err) throw err;
    res.end(JSON.stringify(Server.rewriteLocation(data)));
  });
});

// GET /package/-/http-proxy-0.5.9.tgz
api.get(new RegExp('^/(.+)/-/(.+)$'), function(req, res, match) {
  Cache.getTar(match[1], match[2], function(err, data) {
    res.end();
  });
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
      console.log(req);
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
    meta.dist.tarball = 'http://localhost:8080'+parts.pathname;
  }
  return meta;
};

Server.setBackend = function(backend) { Cache = backend; }

module.exports = Server;
