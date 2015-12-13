var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    http = require('http'),
    https = require('https'),

    semver = require('semver'),
    Resource = require('./resource.js');

// configuration
var externalUrl, // external URL of npm_lazy
    remoteUrl = 'http://registry.npmjs.com/', // "http://registry.npmjs.com/"
    remoteIsHttps = (url.parse(remoteUrl).protocol == 'https:'),
    rejectUnauthorized = true,
    logger = console;

function Package() { }

Package.configure = function(opts) {
  if (typeof opts.externalUrl !== 'undefined') {
    externalUrl = opts.externalUrl;
  }
  if (typeof opts.remoteUrl !== 'undefined') {
    remoteUrl = opts.remoteUrl;
    remoteIsHttps = (url.parse(remoteUrl).protocol == 'https:');
  }
  if (typeof opts.rejectUnauthorized !== 'undefined') {
    rejectUnauthorized = opts.rejectUnauthorized;
  }
  if (typeof opts.logger !== 'undefined') {
    logger = opts.logger;
  }
};

// uncached direct request
Package.proxy = function(req, res, message) {
  // sadly, the simple req.pipe(http.request).pipe(res) type approach
  // does not quite work, in particular the method and headers will be wrong

  var parsed = url.parse(remoteUrl),
      opts = {
        host: parsed.host,
        port: parsed.port,
        path: req.url,
        headers: req.headers,
        method: req.method
      };
  opts.headers.host = parsed.host;

  if (!rejectUnauthorized && parsed.protocol == 'https:') {
    opts.rejectUnauthorized = false;
    opts.agent = new https.Agent(opts);
  }

  message = message || 'not cached';
  logger.log('Querying the registry (' + message + '):', remoteUrl + req.url.substr(1));

  var outgoing = (remoteIsHttps ? https : http).request(opts, function(pres) {
    // write headers
    Object.keys(pres.headers).forEach(function(key) {
      res.setHeader(key, pres.headers[key]);
    });
    // write statuscode
    res.writeHead(pres.statusCode);
    // write response
    pres.pipe(res);
  });

  req.pipe(outgoing).once('error', function(e) {
    logger.log('Ignoring query error (not cached):', e);
    res.statusCode = 500;
    res.end('{}');
  });

  // logger.log(req.headers);
  // req.pipe(process.stdout);
};

Package.getIndex = function(pname, onDone) {
  // package index
  var uri = remoteUrl + pname,
      r = Resource.get(uri);

  r.on('fetch-error', function(err, current, max) {
    logger.log('Fetch failed (' + current + '/' + max + '): ' + uri, err);
  });

  r.on('fetch-cached', function() {
    logger.log('[OK] Reusing cached result for ' + uri);
  });

  r.getReadablePath(function(err, data, etag) {
    if (err) {
      return onDone(err);
    }

    r.removeAllListeners('fetch-error');
    r.removeAllListeners('fetch-cached');

    return onDone(err, Package._rewriteLocation(JSON.parse(fs.readFileSync(data))), etag);
  });
};

Package.getVersion = function(pname, version, onDone) {
  // package index
  var uri = remoteUrl + pname,
      r = Resource.get(uri);

  r.on('fetch-error', function() {
    logger.log('Fetch failed: ' + uri);
  });

  r.on('fetch-cached', function() {
    logger.log('[OK] Reusing cached result for ' + uri);
  });


  r.getReadablePath(function(err, fullpath, etag) {
    if (err) {
      return onDone(err);
    }

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
      return onDone(undefined, Package._rewriteLocation(doc.versions[version]), etag);
    }
    return onDone(new Error('[done] Could not find version', fullpath, version));
  });
};

Package.isPrivate = function(name) {
  return name.indexOf('@') === 0;
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
