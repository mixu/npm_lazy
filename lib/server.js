var fs = require('fs'),
    url = require('url'),

    mkdirp = require('mkdirp'),

    Cache = require('./cache.js'),
    Client = require('./client.js');

function Server() { }

Server.attach = function(httpServer) {
  httpServer.on('request', function(req, res) {

    if(req.method == 'GET') {
      var parts = req.url.split('/');
      switch(parts.length) {
        case 2: Cache.getAll(parts[1]); break;
        case 3: Cache.getVersion(parts[1], parts[2]); break;
        default:
          console.log(req);
      }
    } else {
      console.log(req);
    }

    res.end();
  });
  return httpServer;
};

Server.rewriteLocation = function(meta) {
  if (meta.dist && meta.dist.tarball) {
    var parts = url.parse(meta.dist.tarball);
    meta.dist.tarball = 'http://localhost:8080'+parts.pathname;

  }

  return meta;
};

Server.setBackend = function(backend) { Cache = backend; }

module.exports = Server;
