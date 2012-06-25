var fs = require('fs'),
    path = require('path'),

    mkdirp = require('mkdirp'),
    Client = require('mixu_minimal').Client,

    Lifecycle = require('./lifecycle.js');

// configuration
var basePath; // path to cache directory

// index of last updated (so we always do one refresh on restart, then after cacheAge or if restarted)
var lastUpdated = {},
    guard = new Lifecycle();

function Cache() { }

Cache.configure = function(config) {
  basePath = config.cacheDirectory;
  return Cache;
};

Cache.has = function(pname, file) {
  return path.existsSync(basePath + pname + '/' + file);
};

Cache.get = function(pname, file, callback) {
  var filename = basePath + pname + '/' + file;
  if(Cache.has(pname, file)) {
    fs.readFile(filename, function(err, data) {
      if (err) throw err;
      console.log('[done] Read index file from cache: '+ filename);
      callback && callback(undefined, JSON.parse(data.toString()));
    });
  } else {
    if(file == 'index.json') {
      // fetch index
      Cache._fetch('http://registry.npmjs.org/'+pname, pname, file, callback);
    }
  }
};

Cache.add = function(pname, file, content, callback) {
  var dirname = basePath + pname +'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    fs.writeFile(dirname + file , JSON.stringify(content, null, 2), function() {
      lastUpdated[pname] = new Date();
      console.log('Cache index file '+ dirname+'index.json');
      callback && callback();
    });
  });
};

Cache._fetch = function(resource, pname, file, callback) {
  console.log('Cache miss: ' + pname + ', GET '+resource);
  guard.onRelease(resource, function() {
    console.log('GET')
    // now fetch
    Cache.get(pname, file, callback);
  })
  if(guard.isBlocking(resource)) {
    return;
  }
  guard.block(resource);
  Client
    .get(resource)
    .end(Client.parse(function(err, data) {
      Cache.add(pname, file, data, function() {
        console.log('[done] added to cache', pname, file);
        guard.release(resource);
      });
    }));
};

Cache.isCached = function(name) {
  var maxAge = new Date() - config.cacheAge,
      isUpToDate = (lastUpdated[name] && lastUpdated[name] > maxAge);
  if(!isUpToDate) {
    console.log('Forcing index refresh, last update: '
      + (lastUpdated[name] ? lastUpdated[name].toLocaleString() : 'never')
      +' max age: '+new Date(maxAge).toLocaleString());
    return false;
  }
  return Cache.hasIndex(name);
};

module.exports = Cache;
