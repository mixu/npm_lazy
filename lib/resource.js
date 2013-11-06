var coreUrl = require('url'),
    path = require('path'),

    Lifecycle = require('./lifecycle.js'),
    verify = require('./verify.js');

// maximum age before an index is refreshed from npm
var cacheAge = 60 * 60 * 1000,
    maxRetries = 3;

// global caches
var resourceCache = {},
    guard = new Lifecycle();

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
  } else {
    this.type = 'index';
  }

  this.err = null;
}

Resource.prototype.exists = function() {
  return Cache.lookup(this.url);
};

Resource.prototype._readCache = function() {
  return Cache.read(this.url);
};

Resource.prototype._writeCache = function(data, onDone) {
  Cache.write(this.url, data);
};

Resource.prototype.isUpToDate = function() {
      var maxAge = new Date() - cacheAge,
          isUpToDate = true; // (lastUpdated[pname] && lastUpdated[pname] > maxAge);
    return isUpToDate;
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
        return onDone(null, this._readCache());
      }
    }

    if(self.type == 'tar' && self.exists()) {
      // is this a tarfile and is it in the index?
      // yes: return readable stream
      return onDone(null, this._readCache());
    }
  }

  // queue the callback
  guard.onRelease(this.url, function() {
    // return readable stream
    onDone(self.err, self._readCache());
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
  console.log('try', self.retries);
  if(self.retries > maxRetries) {
    if(self.type == 'index' && self.exists() && !self.isUpToDate()) {
      // e.g. index, which is cached but not up to date, but fetching fails
      return guard.release(self.url);
    } else {
      // did we exceed the max retries? => throw
      self.err = new Error('Max retries exceeded for ' + self.url);
      return guard.release(self.url);
    }
  }


  this._fetchTask(function(err, data) {
      // queue returned:

      // did the request fail?
      if(err) {
        // RETRY
        return self.retry();
      }
      // resource fetch OK, now validate it

      if(self.type == 'index') {
        // is this a indexfile?
        try {
          // check that it's JSON => store => release
          var test = JSON.parse(data);
        } catch(e) {
          // RETRY
          return self.retry();
        }
        // must be OK
        return self._writeCache(data, function() {
          guard.release(self.url);
        });
      }

      if(self.type == 'tar') {
        // is this a tarfile?
        var expected = verify.getSha(outName);
        // check that the checksum matches => store => release
        verify.check(outName, function(err, actual) {
          if(err || actual !== expected) {
            console.error('SHASUM - ' + outName + ' - expected: ' + expected + ', actual: ' + actual);
            console.error('ERROR: npm SHASUM mismatch for '+ outName);
            // RETRY
            return self.retry();
          } else {
            // must be OK
            console.log('[done][SHASUM OK] added to cache', pname, file, outStream.bytesWritten, res.headers['content-length']);
            return self._writeCache(data, function() {
              guard.release(self.url);
            });
          }
        });
      }
    });
};

Resource.prototype._fetchTask = function(onDone) {
  Client
    .get(self.url)
    .end(function(err, res) {
      if(err) {
        return onDone(err);
      }
      if(res.statusCode != 200) {
        return onDone(new Error('Request failed with code ' + res.statusCode));
      }
      return onDone(err, rest);
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
