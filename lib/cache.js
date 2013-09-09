var fs = require('fs'),
    path = require('path'),

    mkdirp = require('mkdirp'),
    Client = require('mixu_minimal').Client,

    Lifecycle = require('./lifecycle.js'),
    verify = require('./verify.js');

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
  return fs.existsSync(basePath + pname + '/' + file);
};

Cache.get = function(pname, file, callback) {
  var filename = basePath + pname + '/' + file,
      resourceName;

  if(file == 'index.json') {
    resourceName = 'http://registry.npmjs.org/'+pname;
  } else {
    resourceName = 'http://registry.npmjs.org/'+pname+'/-/'+file;
  }

  if(Cache.has(pname, file) && !guard.isBlocking(resourceName)) {

    function next() {
      fs.readFile(filename, function(err, data) {
        if (err) throw err;
        callback && callback(undefined, data);
      });
    }

    if(path.extname(filename) === '.tgz') {
      var expected = verify.getSha(filename);
      verify.check(filename, function(err, actual) {
        if(err || actual !== expected) {
          console.error('SHASUM - ' + filename + ' - expected: ' + expected + ', actual: ' + actual);
          throw new Error('ERROR: npm SHASUM mismatch for '+ filename);
        } else {
          console.log('[done][SHASUM OK]', pname, filename);
          next();
        }
      })
    } else {
      console.log('[done] Read file from cache: '+ filename);
      next();
    }
  } else {
    Cache._fetch(resourceName, pname, file, callback);
  }
};

Cache.add = function(pname, file, content, callback) {
  var dirname = basePath + pname +'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    if(fs.existsSync(dirname + file)) {
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
    console.log('GET', resource);
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
    var outName = dirname + file;
    Client
      .get(resource)
      .end(function(err, res) {
        var outStream = fs.createWriteStream(outName);

        res.on('error', function(err) {
          console.log('Error while fetching: ' + resource);
          throw new Error(err);
        });

        res.pipe(outStream);

        outStream.on('close', function() {
          if(file == 'index.json') {
            lastUpdated[pname] = new Date();
          }
          if(outStream.bytesWritten != res.headers['content-length']) {
            console.log('WARN Result size mismatch', outStream.bytesWritten, res.headers['content-length']);
          }

          if(path.extname(file) === '.tgz') {
            var expected = verify.getSha(outName);
            verify.check(outName, function(err, actual) {
              if(err || actual !== expected) {
                console.error('SHASUM - ' + outName + ' - expected: ' + expected + ', actual: ' + actual);
                throw new Error('ERROR: npm SHASUM mismatch for '+ outName);
              } else {
                console.log('[done][SHASUM OK] added to cache', pname, file, outStream.bytesWritten, res.headers['content-length']);
                guard.release(resource);
              }
            });
          } else {
            console.log('[done] added to cache', pname, file);
            guard.release(resource);
          }

        });
      });
  });

};

module.exports = Cache;
