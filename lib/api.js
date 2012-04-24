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
  Cache.getAll(match[1], function(err, data) {
    if(err) throw err;
    res.end(JSON.stringify(rewriteLocation(data)));
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
    res.end(JSON.stringify(rewriteLocation(data)));
  });
})

function rewriteLocation(meta) {
  if(meta.versions) {
    // if a full index, apply to all versions
    Object.keys(meta.versions).forEach(function(version) {
      meta.versions[version] = rewriteLocation(meta.versions[version]);
    });
  }

  if (meta.dist && meta.dist.tarball) {
    var parts = url.parse(meta.dist.tarball);
    meta.dist.tarball = config.externalUrl+parts.pathname;
  }
  return meta;
};

module.exports = api;
