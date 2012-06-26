var fs = require('fs'),
    path = require('path'),

    mkdirp = require('mkdirp'),
    Client = require('mixu_minimal').Client,

    Lifecycle = require('./lifecycle.js');

// configuration
var basePath, // path to cache directory
    cacheAge = 60 * 60 * 1000;  // max age in cache

// index of last updated (so we always do one refresh on restart, then after cacheAge or if restarted)
var lastUpdated = {},
    guard = new Lifecycle();

function Cache() { }

Cache.configure = function(config) {
  basePath = config.cacheDirectory;
  cacheAge = (!isNaN(config.cacheAge) ? config.cacheAge : cacheAge);
  return Cache;
};

Cache.has = function(pname, file) {
  // index.json has special handling
  if(file == 'index.json') {
    var maxAge = new Date() - cacheAge,
        isUpToDate = (lastUpdated[pname] && lastUpdated[pname] > maxAge);
    if(!isUpToDate) {
    console.log('Forcing index refresh, last update: '
      + (lastUpdated[pname] ? lastUpdated[pname].toLocaleString() : 'never')
      +' max age: '+new Date(maxAge).toLocaleString());
    return false;
    }
  }
  return path.existsSync(basePath + pname + '/' + file);
};

Cache.get = function(pname, file, callback) {
  var filename = basePath + pname + '/' + file;
  if(Cache.has(pname, file)) {
    fs.readFile(filename, function(err, data) {
      if (err) throw err;
      console.log('[done] Read index file from cache: '+ filename);
      callback && callback(undefined, data);
    });
  } else {
    if(file == 'index.json') {
      // fetch index
      Cache._fetch('http://registry.npmjs.org/'+pname, pname, file, callback);
    } else {
      Cache._fetch('http://registry.npmjs.org/'+pname+'/-/'+file, pname, file, callback);
    }
  }
};

Cache.add = function(pname, file, content, callback) {
  var dirname = basePath + pname +'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    if(path.existsSync(dirname + file)) {
      fs.unlinkSync(dirname + file);
    }
    fs.writeFile(dirname + file, content, function(err) {
      if (err) throw err;
      lastUpdated[pname] = new Date();
      console.log('Cache file '+ dirname + file);
      callback && callback();
    });
  });
};

Cache._fetch = function(resource, pname, file, callback) {
  console.log('Cache miss: ',  pname, file, ', GET '+resource);
  guard.onRelease(resource, function() {
    console.log('GET');
    // now fetch
    Cache.get(pname, file, callback);
  })
  if(guard.isBlocking(resource)) {
    return;
  }
  guard.block(resource);
  var dirname = basePath + pname +'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    var outputStream = fs.createWriteStream(dirname + file);
    Client
      .get(resource)
      .end(function(err, res) {
        res.on('end', function() {
            if(file == 'index.json') {
              lastUpdated[pname] = new Date();
            }
            console.log('[done] added to cache', pname, file);
            guard.release(resource);
          });
        res.pipe(outputStream);
      });
  });

};

module.exports = Cache;
