var Client = require('./client.js');

function Server() { }

Server.attach = function(httpServer) {
  httpServer.on('request', function(req, res) {

    if(req.method == 'GET') {
      var parts = req.url.split('/');
      (parts.length == 2) && Cache.getAll(parts[1]);
      (parts.length == 3) && Cache.getVersion(parts[1], parts[2]);
    } else {
      console.log(req);
    }

    res.end();
  });
  return httpServer;
};


function Cache() { }

Cache.getAll = function(package) {
  console.log('Cache, get all', package);

  // check for cache hit

  // if cache miss:

  Client
    .get('http://registry.npmjs.org/'+package)
    .end(function(err, data) {
      if(err) throw err;
      console.log('NPM response');

      // should cache all version info

      console.log(require('util').inspect(data, false, 5, true));
    });
};

Cache.getVersion = function(package, version) {
  console.log('Cache, get version', package, version);
};

// add a previously unknown version to the cache
Cache.addVersion = function(package, version, json) {

};

module.exports = Server;
