var fs = require('fs'),
    url = require('url'),
    path = require('path'),

    semver = require('semver'),
    Resource = require('./resource.js');

// configuration
var externalUrl, // external URL of npm_lazy
    remoteUrl = 'http://registry.npmjs.org/'; // "http://registry.npmjs.org/"

function Package() { }

Package.configure = function(config) {
  if(typeof config.externalUrl !== 'undefined') {
    externalUrl = config.externalUrl;
  }
  if(typeof config.remoteUrl !== 'undefined') {
    remoteUrl = config.remoteUrl;
  }
};

Package.getIndex = function(pname, onDone) {
  // package index
  var uri = remoteUrl + pname,
      r = Resource.get(uri);

  r.on('fetch-error', function(err, current, max) {
    console.log('Fetch failed (' + current + '/' + max + '): ' + uri, err);
  });

  r.on('fetch-cached', function() {
    console.log('[OK] Reusing cached result for ' + uri);
  });

  r.getReadablePath(function(err, fullpath) {
    if (err) throw err;

    r.removeAllListeners('fetch-error');
    r.removeAllListeners('fetch-cached');

    return onDone(err,
      Package._rewriteLocation(
        JSON.parse(fs.readFileSync(fullpath))
      ));
  });
};

Package.getVersion = function(pname, version, onDone) {
  // package index
  var uri = remoteUrl + pname,
      r = Resource.get(uri);

  r.on('fetch-error', function() {
    console.log('Fetch failed: ' + uri);
  });

  r.on('fetch-cached', function() {
    console.log('[OK] Reusing cached result for ' + uri);
  });


  r.getReadablePath(function(err, fullpath) {
    if (err) throw err;

    r.removeAllListeners('fetch-error');
    r.removeAllListeners('fetch-cached');

    // according to the NPM source, the version specific JSON is
    // directly from the index document (e.g. just take doc.versions[ver])
    var doc = JSON.parse(fs.readFileSync(fullpath));

    // from NPM: if not a valid version, then treat as a tag.
    if (!(version in doc.versions) && (version in doc['dist-tags'])) {
      version = doc['dist-tags'][version];
    }
    if (doc.versions[version]) {
      return onDone(undefined, Package._rewriteLocation(doc.versions[version]));
    }
    throw new Error('[done] Could not find version', filename, version);
  });
};

Package._rewriteLocation = function(meta) {
  if (!meta) {
    return meta;
  }

  if (meta.versions) {
    // if a full index, apply to all versions
    Object.keys(meta.versions).forEach(function(version) {
      meta.versions[version] = Package._rewriteLocation(meta.versions[version]);
    });
  }

  if (meta.dist && meta.dist.tarball) {
    var parts = url.parse(meta.dist.tarball);
    meta.dist.tarball = externalUrl + parts.pathname;
  }
  return meta;
};

module.exports = Package;
