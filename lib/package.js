var fs = require('fs'),
    url = require('url'),
    path = require('path'),

    semver = require('semver'),
    Cache;

function Package() { }

Package.setCache = function(cache) {
  Cache = cache;
};

Package.exists = function(name) {
  return Cache.hasIndex(name);
};

Package.get = function(name, version, callback) {
  // version is optional
  if(arguments.length == 2) {
    callback = version;
    return Package._getIndex(name, callback);
  } else {
    return Package._getVersion(name, version, callback);
  }
};

Package._getIndex = function(name, callback) {
  var filename = name +'/index.json';
  // check for cache hit
  if(Cache.has(filename)) {
    Cache.get(filename, function(err, doc) {
      return callback(err, Package._rewriteLocation(doc));
    });
  } else {
    Cache.fetchIndex(name, callback);
  }
};

Package._getVersion = function(name, version, callback) {
  var filename = name +'/index.json';
  // according to the NPM source, the version specific JSON is
  // directly from the index document (e.g. just take doc.versions[ver])
  Cache.get(filename, function(err, doc) {
    if(err) throw err;

    // from NPM: if not a valid version, then treat as a tag.
    if (!(version in doc.versions) && (version in doc['dist-tags'])) {
      version = doc['dist-tags'][version]
    }
    if(doc.versions[version]) {
      return callback(undefined, Package._rewriteLocation(doc.versions[version]));
    }
    throw new Error('[done] Could not find version', filename, version);
    return callback(undefined, {});
  });
};

Package._rewriteLocation = function(meta) {
  if(!meta) {
    return meta;
  }

  if(meta.versions) {
    // if a full index, apply to all versions
    Object.keys(meta.versions).forEach(function(version) {
      meta.versions[version] = Package._rewriteLocation(meta.versions[version]);
    });
  }

  if (meta.dist && meta.dist.tarball) {
    var parts = url.parse(meta.dist.tarball);
    meta.dist.tarball = Cache.externalUrl()+parts.pathname;
  }
  return meta;
};

module.exports = Package;
