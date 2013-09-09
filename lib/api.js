var url = require('url'),

    Client = require('mixu_minimal').Client,
    Router = require('mixu_minimal').Router,

    Package = require('./package.js'),
    Cache = require('./cache.js');

var api = new Router();

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  var name = match[1];
  Package.get(name, function(err, data) {
    if(err) throw err;
    res.end(JSON.stringify(data));
  });
});

// GET /package/-/package-version.tgz
api.get(new RegExp('^/(.+)/-/(.+)$'), function(req, res, match) {
  var name = match[1],
      file = match[2];
  // direct cache access - this is a file get, not a metadata get
  console.log('cache get', name, file);
  Cache.get(name, file, function(err, data) {
    res.setHeader('Content-type', 'application/octet-stream');
    res.end(data);
  });
});

function notImplemented(req, res, match) {
  console.log('Not implemented', req.url);
  res.end();
}

// /-/ or /package/-/ are special
api.get(new RegExp('^/-/(.+)$'), notImplemented);
api.get(new RegExp('^/(.+)/-(.*)$'), notImplemented);

// GET /package/version
api.get(new RegExp('^/(.+)/(.+)$'), function(req, res, match) {
  var name = match[1],
      version = match[2];
  Package.get(name, version, function(err, data) {
    res.end(JSON.stringify(data));
  });
});

module.exports = api;
