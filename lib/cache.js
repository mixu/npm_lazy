var fs = require('fs'),
    path = require('path'),

    mkdirp = require('mkdirp'),
    Client = require('mixu_minimal').Client,

    Lifecycle = require('./lifecycle.js');

// path to cache directory
var basePath,
// index of last updated (so we always do one refresh on restart, then after cacheAge or if restarted)
    lastUpdated = {},
    guard = new Lifecycle(),
    config;

function Cache() { }

Cache.configure = function(configuration) {
  config = configuration;
  basePath = config.cacheDirectory;
  return Cache;
};

Cache.respondTar = function(package, filename, res) {
  var localName = basePath + package + '/'+ filename;
  res.setHeader('Content-type', 'application/octet-stream');
  if(path.existsSync(localName)) {
    fs.createReadStream(localName)
      .on('end', function() { console.log('[done] read tarfile from cache', localName);})
      .pipe(res);
  } else {
    var resource = 'http://registry.npmjs.org/'+package+'/-/'+filename;
    if(guard.isBlocking(resource)) {
      return guard.onRelease(resource, function() { Cache.respondTar(package, filename, res); });
    }
    guard.block(resource);
    var ws = fs.createWriteStream(localName);
    Client
      .get(resource)
      .pipe(ws, function(err) {
        if(err) throw err;
        guard.release(resource);
        fs.createReadStream(localName)
          .on('end', function() { console.log('[done] fetch and return tarfile', localName);})
          .pipe(res);
      });
  }
};

// add a previously unknown version to the cache
Cache.addIndex = function(package, content, callback) {
  var dirname = basePath +package+'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    fs.writeFile(dirname+'index.json', JSON.stringify(content, null, 2), function() {
      lastUpdated[package] = new Date();
      console.log('Cache index file '+ dirname+'index.json');
      callback && callback();
    });
  });
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

Cache.hasIndex = function(name) {
  return path.existsSync(basePath + name+'/index.json');
};

Cache.getIndex = function(package, callback) {
  fs.readFile(basePath + package+'/index.json', function(err, data) {
    if (err) throw err;
    console.log('[done] Read index file from cache: '+ basePath + package+'/index.json');
    callback(undefined, JSON.parse(data.toString()));
  });
};

Cache.fetchIndex = function(name, callback) {
  var resource = 'http://registry.npmjs.org/'+name;
  console.log('Cache miss: ' + name + ', GET '+resource);
  if(guard.isBlocking(resource)) {
    return guard.onRelease(resource, function() { Cache.getAll(name, callback) });
  }
  guard.block(resource);
  // if cache miss:
  Client
    .get(resource)
    .end(function(err, data) {
      if(err) throw err;
      data = JSON.parse(data);
      // should cache all version info
      Cache.addIndex(name, data, function() { guard.release(resource); });
      console.log('[done] read from cache');
      // console.log(require('util').inspect(data, false, 5, true));
      callback(undefined, data);
    });
};

module.exports = Cache;
