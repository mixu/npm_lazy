var fs = require('fs'),
    url = require('url'),
    path = require('path'),

    semver = require('semver'),
    Resource = require('./resource.js');

// configuration
var externalUrl; // external URL of the registry

function Package() { }

Package.configure = function(config) {
  externalUrl = config.externalUrl;
};

Package.getIndex = function(pname, onDone) {
  // package index
  var r = Resource.get('http://registry.npmjs.org/' + pname);

  r.getReadablePath(function(err, fullpath) {
    if(err) throw err;
    return onDone(err,
      Package._rewriteLocation(
        JSON.parse(fs.readFileSync(fullpath))
      ));
  });
};

Package.getVersion = function(pname, version, onDone) {
  // package index
  var r = Resource.get('http://registry.npmjs.org/' + pname);

  r.getReadablePath(function(err, fullpath) {
    if(err) throw err;

    // according to the NPM source, the version specific JSON is
    // directly from the index document (e.g. just take doc.versions[ver])
    var doc = JSON.parse(fs.readFileSync(fullpath));

    // from NPM: if not a valid version, then treat as a tag.
    if (!(version in doc.versions) && (version in doc['dist-tags'])) {
      version = doc['dist-tags'][version]
    }
    if(doc.versions[version]) {
      return onDone(undefined, Package._rewriteLocation(doc.versions[version]));
    }
    throw new Error('[done] Could not find version', filename, version);
    return onDone(undefined, {});
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

module.exports = Package;
