var fs = require('fs'),
    crypto = require('crypto'),
    path = require('path'),
    mkdirp = require('mkdirp');

function Cache(opts) {
  this.opts = opts;
  this.data = null;
  this.path = opts.path;

  // can either set the path, or set 'appHash'
  if(opts.path) {
    this.metaPath = opts.path + '/meta.json';
    this.data = (fs.existsSync(this.metaPath) ? require(this.metaPath) : {});

    // need to do this early on, since if the path is missing,
    // writes to the cache dir will fail
    if(!fs.existsSync(this.opts.path)) {
      mkdirp.sync(this.opts.path);
    }
  } else {
    throw new Error('Must set either the cache path');
  }
}

Cache.prototype.save = function() {
  // just in case
  if(!fs.existsSync(this.opts.path)) {
    mkdirp.sync(this.opts.path);
  }
  fs.writeFileSync(this.metaPath, JSON.stringify(this.data, null, 2));
};

// invalidates all the cached items for the given inputFilePath
Cache.prototype.junk = function(itemHash) {
  var self = this;
  if(!this.data[itemHash]) {
    return; // nothing to do
  }
  // for each .taskResults
  Object.keys(this.data[itemHash].taskResults).forEach(function(taskHash) {
    // .taskResults[hash] = { path: '...' }
    var cacheFile = self.data[itemHash].taskResults[taskHash].path;
    if(fs.existsSync(cacheFile)) {
      fs.unlink(cacheFile);
    }
  });
  delete this.data[itemHash];
};

Cache.prototype.clear = function() {
  var self = this;
  // delete any lingering files
  Object.keys(this.data).forEach(function(inputFilePath) {
    self.junk(inputFilePath);
  });
  this.data = {};
  this.save();
};

Cache.prototype.filename = function() {
  var cacheName;
  // generate a new file name
  do {
    cacheName = this.path + '/' + Math.random().toString(36).substring(2);
  } while(fs.existsSync(cacheName));
  return cacheName;
};

Cache.prototype.complete = function(itemHash, taskHash, cacheFilePath) {
  if(arguments.length < 3) {
    throw new Error('Invalid call to Cache.complete()');
  }

  var method = this.opts.method || 'stat';

  if(!this.data[itemHash]) {
    this.data[itemHash] = { taskResults: {} };
  }
  if(!this.data[itemHash].taskResults) {
    this.data[itemHash].taskResults = {};
  }

  // make pluggable: update the cache with the INPUT item stats

  this.data[itemHash].taskResults[taskHash] = { path: cacheFilePath };
  // console.log('Complete', itemHash, taskHash);
  this.save();
};

Cache.prototype.lookup = function(itemHash, taskHash) {
  // console.log('Lookup', itemHash, taskHash, this.data[itemHash]);
  var cacheMeta = this.data[itemHash];
  // {
  //   itemHash: {
  //     stat: (expected stat meta)
  //     md5: (expected hash meta)
  //
  //     taskResults: {
  //       taskHash: {
  //         path: (path in cache for this task)
  //       }
  //     }
  //   }
  // }

  // make pluggable: verification that the looked up item is OK

  // now, search for a cached file that corresponds to the current task hash
  if(!cacheMeta || !cacheMeta.taskResults || !cacheMeta.taskResults[taskHash] || !cacheMeta.taskResults[taskHash].path) {
    return false;
  }
  return cacheMeta.taskResults[taskHash].path;
};

Cache.hash = Cache.prototype.hash = function(method, str) {
  // method is optional, defaults to md5
  if(arguments.length === 1) {
    str = method;
    method = 'md5';
  }
  return crypto.createHash(method).update(str).digest('hex');
};

module.exports = Cache;

