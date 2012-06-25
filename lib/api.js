var url = require('url'),

    Client = require('mixu_minimal').Client,
    Router = require('mixu_minimal').Router,

    Cache = require('./cache.js');

var api = new Router();

api.configure = function(configuration) {
  config = configuration;
};

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      filename = name+'/index.json';
  Cache.get(filename, function(err, data) {
    if(err) throw err;
    res.end(JSON.stringify(data));
  });
});

// GET /package/-/package-version.tgz
api.get(new RegExp('^/(.+)/-/(.+)$'), function(req, res, match) {
  var name = match[1],
      version = match[2],
      filename = name + '/'+ version;
  res.setHeader('Content-type', 'application/octet-stream');

  function respond(err, data) {
    res.end(JSON.stringify(data));
  }

  if(Cache.has(filename)) {
    Cache.get(filename, respond);
  } else {
    Cache.fetchTar(filename, respond);
  }
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
    res.end(JSON.stringify(data));
  });
})

module.exports = api;
