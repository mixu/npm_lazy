var fs = require('fs'),
    path = require('path');

var rimraf = require('rimraf');

var List = require('minitask').list;

var Cache = require('./lib/cache.js'),
    Package = require('./lib/package.js'),
    config = require('./config.js'),
    verify = require('./lib/verify');

Cache.configure({
    cacheDirectory: config.cacheDirectory,
    cacheAge: config.cacheAge
  });
Package.configure({
  cache: Cache,
  externalUrl: config.externalUrl
});

var basePath = config.cacheDirectory;

var list = new List();
list.add(basePath);
list.files.forEach(function(file) {
  // verify .json files
  if (path.extname(file.name) == '.json') {
    var data = fs.readFileSync(file.name),
        index;
    try {
      index = JSON.parse(data);
    } catch (e) {
      console.log('Failed to parse', file.name);
      console.log('Deleting:', path.dirname(file.name));
      rimraf.sync(path.dirname(file.name));
    }
  }
});

// work around directory deletion

list = new List();
list.add(basePath);
list.files.forEach(function(file) {
  var basename = path.basename(file.name);

  // verify .tgz files

  if (path.extname(file.name) == '.tgz') {
    var expected = verify.getSha(file.name);

    verify.check(file.name, function(err, actual) {
      if (err) {
        return console.error(err);
      }
      if (actual === expected) {
        console.log(basename, 'SHASUM OK');
      } else {
        console.log(basename, 'SHASUM ERROR: ', expected, actual);
        console.log('Deleting:', path.dirname(file.name));
        rimraf.sync(path.dirname(file.name));
      }
    });
  }
});



