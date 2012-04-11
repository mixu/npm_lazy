var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    Client = require('./client.js'),
    time = require('./time.js'),
    config = require('../config.js');

// path to cache directory
var basePath = path.normalize(config.cacheDirectory),
// index of last updated (so we always do one refresh on restart, then after cacheAge or if restarted)
    lastUpdated = {};

function Cache() { }

Cache.getAll = function(package, callback) {
  // check for cache hit
  if(Cache.hasIndex(package)) {
    Cache.getIndex(package, callback);
  } else {
    console.log('Cache miss: ' + package + ', GET http://registry.npmjs.org/'+package);
    // if cache miss:
    Client
      .get('http://registry.npmjs.org/'+package)
      .end(function(err, data) {
        if(err) throw err;
        // should cache all version info
        Cache.addIndex(package, data);
        console.log(time() + '[done] read from cache');
        //console.log(require('util').inspect(data, false, 5, true));
        callback(undefined, data);
      });
  }
};

Cache.getVersion = function(package, version, callback) {
  // according to the NPM source, the version specific JSON is
  // directly from the index document (e.g. just take doc.versions[ver])
  Cache.getAll(package, function(err, doc) {
    if(err) throw err;

    // from NPM: if not a valid version, then treat as a tag.
    if (!(version in doc.versions) && (version in doc['dist-tags'])) {
      version = doc['dist-tags'][version]
    }
    if(doc.versions[version]) {
      return callback(undefined, doc.versions[version]);
    }
    throw new Error('[done] Could not find version', package, version);
    return callback(undefined, {});
  });
};

Cache.respondTar = function(package, filename, res) {
  var localName = basePath + package + '/'+ filename;
  res.setHeader('Content-type', 'application/octet-stream');
  if(path.existsSync(localName)) {
    fs.createReadStream(localName)
      .on('end', function() { console.log(time() + '[done] read tarfile from cache', localName);})
      .pipe(res);
  } else {
    var ws = fs.createWriteStream(basePath + package + '/'+ filename);
    Client
      .get('http://registry.npmjs.org/'+package+'/-/'+filename)
      .pipe(ws, function(err) {
        if(err) throw err;
        fs.createReadStream(localName)
          .on('end', function() { console.log(time() + '[done] fetch and return tarfile', localName);})
          .pipe(res);
      });
  }
};

// add a previously unknown version to the cache
Cache.addIndex = function(package, content) {
  var dirname = basePath +package+'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    fs.writeFile(dirname+'index.json', JSON.stringify(content, null, 2), function() {
      lastUpdated[package] = new Date();
      console.log('Cache index file '+ dirname+'index.json');
    });
  });
};

Cache.hasIndex = function(package) {
  var maxAge = new Date() - config.cacheAge,
      isUpToDate = (lastUpdated[package] && lastUpdated[package] > maxAge),
      exists = path.existsSync(basePath + package+'/index.json');
  if(!isUpToDate && exists) {
    console.log('Forcing index refresh, last update: '
      + (lastUpdated[package] ? lastUpdated[package].toLocaleString() : 'never')
      +' max age: '+new Date(maxAge).toLocaleString());
  }
  return isUpToDate && exists;
};

Cache.getIndex = function(package, callback) {
  fs.readFile(basePath + package+'/index.json', function(err, data) {
    if (err) throw err;
    console.log(time() + '[done] Read index file from cache: '+ basePath + package+'/index.json');
    callback(undefined, JSON.parse(data.toString()));
  });
};

module.exports = Cache;
