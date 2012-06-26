var fs = require('fs'),
    url = require('url'),
    path = require('path'),

    semver = require('semver');

// configuration
var Cache, // Cache instance
    externalUrl; // external URL of the registry

function Package() { }

Package.configure = function(config) {
  Cache = config.cache;
  externalUrl = config.externalUrl;
};

Package.exists = function(name) {
  return Cache.has(name, 'index.json');
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
  Cache.get(name, 'index.json', function(err, doc) {
    return callback(err,
      Package._rewriteLocation(
        JSON.parse(doc.toString())
      ));
  });
};

Package._getVersion = function(name, version, callback) {
  var filename = name +'/index.json';
  // according to the NPM source, the version specific JSON is
  // directly from the index document (e.g. just take doc.versions[ver])
  Cache.get(name, 'index.json', function(err, doc) {
    if(err) throw err;
    doc = JSON.parse(doc.toString());

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
    meta.dist.tarball = externalUrl+parts.pathname;
  }
  return meta;
};

Package.checkFile = function(filename, cb) {
  // from npm:
  var crypto = require('crypto');
  var h = crypto.createHash("sha1"),
      s = fs.createReadStream(filename),
      errState = null;
  s.on("error", function (er) {
    if (errState) return;
    return cb(errState = er)
  }).on("data", function (chunk) {
    if (errState) return;
    h.update(chunk);
  }).on("end", function () {
    if (errState) return
    var actual = h.digest("hex").toLowerCase().trim();
    cb(null, actual);
  });
};

module.exports = Package;
