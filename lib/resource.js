var fs = require('fs'),
    coreUrl = require('url'),
    path = require('path'),

    Lifecycle = require('./lifecycle.js'),
    verify = require('./verify2.js'),
    microee = require('microee'),
    Client = require('mixu_minimal').Client,
    Cache;

// maximum age before an index is refreshed from npm
var cacheAge = 60 * 60 * 1000,
    maxRetries = 3;

// global caches
var resourceCache = {},
    guard = new Lifecycle(),
    lastUpdated = {};

// A resource is a representation of a particular remote endpoint
// The main benefit for combining cross-cutting concerns into one object
// is that it makes expressing the various cases:
// 1) blocking while fetch is pending
// 2) retrying when a checksum fails (for a tarfile)
// 3) delaying the return when the resource is outdated (for a index.json)
//
// easier than trying to juggle these responsibilities in the caching logic

function Resource(url) {
  this.url = url;

  this.retries = 0;

  var parts = coreUrl.parse(url);
  if(path.extname(parts.pathname) == '.tgz') {
    this.type = 'tar';
    this.basename = path.basename(parts.pathname);
  } else {
    this.type = 'index';
  }

  this.err = null;
  this.fetchTimer = null;
  this.timeout = 2000;
}

microee.mixin(Resource);

Resource.setCache = function(c) {
  Cache = c;
};

Resource.setCacheAge = function(c) {
  cacheAge = c;
};

Resource.setMaxRetries = function(c) {
  maxRetries = c;
};

Resource.prototype.exists = function() {
  // console.log('exists', this.url, 'GET', Cache.lookup(this.url, 'GET'));
  return Cache.lookup(this.url, 'GET');
};

Resource.prototype.isUpToDate = function() {
      var maxAge = new Date() - cacheAge,
          isUpToDate = (lastUpdated[this.url] && lastUpdated[this.url] > maxAge);
    return isUpToDate;
};

Resource.prototype.getPackageName = function() {
  return path.basename(this.basename, '.tgz');
};

// one API
Resource.prototype.getReadableStream = function(onDone) {
  var self = this;

  // try to find a shortcut
  if(!guard.isBlocking(self.url)) {
    if(self.type == 'index' && self.exists()) {
      // is this a index file?
      if(self.isUpToDate()) {
        // is the index up to date?
        // yes: return readable stream
        return onDone(null, fs.readFileSync(this.exists()).toString());
      }
    }

    if(self.type == 'tar' && self.exists()) {
      // is this a tarfile and is it in the index?
      // yes: return readable stream
      return onDone(null, fs.readFileSync(this.exists()).toString());
    }
  }

  // queue the callback
  guard.onRelease(this.url, function() {
    // return readable stream
    if(self.err) {
      return onDone(self.err, null);
    }
    onDone(self.err, fs.readFileSync(self.exists()).toString());
  });

  // are we blocking? => nothing more to do so return
  if(guard.isBlocking(self.url)) {
    console.log('Request is pending, blocking ' + self.url);
    return;
  }

  // else: queue a get
  guard.block(self.url);

  this.retry();
};

Resource.prototype.retry = function() {
  var self = this;
  self.retries++;
  console.log('try', self.url, self.retries);
  if(self.retries > maxRetries) {
    // e.g. index, which is cached but not up to date, but fetching fails
    if(self.type == 'index' && self.exists() && !self.isUpToDate()) {
      return guard.release(self.url);
    } else {
      // did we exceed the max retries? => throw
      self.err = new Error('Max retries exceeded for ' + self.url);
      return guard.release(self.url);
    }
  }

  this.fetchTimer = setTimeout(function() {
    self._afterFetch(new Error('Request timed out'));
  }, this.timeout);

  this._fetchTask(function(err, readableStream) {
    self._afterFetch(err, readableStream);
  });
};

Resource.prototype._afterFetch = function(err, readableStream) {
  var self = this;
  clearTimeout(self.fetchTimer);
  // queue returned:

  // did the request fail?
  if(err) {
    self.emit('fetch-error', err);
    // RETRY
    return self.retry();
  }
  // resource fetch OK,

  // write to disk
  var cachename = Cache.filename(),
      out = fs.createWriteStream(cachename);

  // 0.8.x: "close"
  // 0.10.x: "finish"
  var emittedDone = false;
  function emitDone() {
    if(!emittedDone) {
      emittedDone = true;

      // now validate it

      if(self.type == 'index') {
        // is this a indexfile?
        try {
          // check that it's JSON => store => release
          var test = JSON.parse(fs.readFileSync(cachename).toString());
        } catch(e) {
          // RETRY
          return self.retry();
        }
        // mark as OK, return all pending callback
        Cache.complete(self.url, 'GET', cachename);
        // set last updated
        lastUpdated[self.url] = new Date();
        guard.release(self.url);
        return;
      }

      if(self.type == 'tar') {
        // is this a tarfile?
        // read the expected checksum
        var Package = require('./package.js');

        Package.getIndex(self.getPackageName(), function(err, data) {
          if(err) throw err;

          // console.log('PACKAGE INDEX', data);

          // check that the checksum matches => store => release
          var expected = verify.getSha(self.basename, data);
          verify.check(cachename, function(err, actual) {
            if(err || actual !== expected) {
              console.error('SHASUM - ' + self.url + ' - expected: ' + expected + ', actual: ' + actual);
              console.error('ERROR: npm SHASUM mismatch for '+ self.basename);
              // RETRY
              return self.retry();
            } else {
              // must be OK
              console.log('[done][SHASUM OK] added to cache', self.url, self.basename, cachename);
              // mark as OK, return all pending callback
              Cache.complete(self.url, 'GET', cachename);
              guard.release(self.url);
              return;
            }
          });

        });
      }
    }
  }
  out.once('close', emitDone);
  out.once('finish', emitDone);

  readableStream.pipe(out);
};

Resource.prototype._fetchTask = function(onDone) {
  Client
    .get(this.url)
    .end(function(err, res) {
      if(err) {
        return onDone(err);
      }
      if(res.statusCode != 200) {
        return onDone(new Error('Request failed with code ' + res.statusCode));
      }
      return onDone(err, res);
    });
};

// one instance of a resource per url

Resource.get = function(url) {
  if(!resourceCache[url]) {
    resourceCache[url] = new Resource(url);
  }
  return resourceCache[url];
};

module.exports = Resource;
