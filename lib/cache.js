var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    Client = require('./client.js');

var basePath = path.normalize(__dirname+'/../db/')+'/';

function Cache() { }

Cache.getAll = function(package, callback) {
  console.log('Cache, get all', package);

  // check for cache hit
  if(Cache.hasIndex(package)) {
    console.log('Get from cache', package);
    Cache.getIndex(package, callback);
  } else {
    // if cache miss:
    Client
      .get('http://registry.npmjs.org/'+package)
      .end(function(err, data) {
        if(err) throw err;
        console.log('NPM response');

        // should cache all version info
        Cache.addIndex(package, data);

        //console.log(require('util').inspect(data, false, 5, true));
        callback(undefined, data);
      });
  }
};

Cache.getVersion = function(package, version, callback) {
  console.log('Cache, get version', package, version);

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
    throw new Error('Could not find version', package, version);
    return callback(undefined, {});
  });
};

Cache.respondTar = function(package, filename, res) {
  res.setHeader('Content-type', 'application/octet-stream');
  if(path.existsSync(basePath + package+'/'+filename)) {
    fs.createReadStream(basePath + package + '/'+ filename).pipe(res);
  } else {
    var ws = fs.createWriteStream(basePath + package + '/'+ filename);
    Client
      .get('http://registry.npmjs.org/'+package+'/-/'+filename)
      .pipe(ws, function(err) {
        if(err) throw err;
        console.log('wrote NPM file', basePath + package + '/'+ filename);
        fs.createReadStream(basePath + package + '/'+ filename).pipe(res);
      });
  }
};

// add a previously unknown version to the cache
Cache.addIndex = function(package, content) {
  var dirname = basePath +package+'/';
  mkdirp(dirname, function (err) {
    if (err) throw err;
    fs.writeFile(dirname+'index.json', JSON.stringify(content, null, 2), function() {
      console.log('Wrote', dirname+'index.json');
    });
  });
};

Cache.hasIndex = function(package) {
  return path.existsSync(basePath + package+'/index.json');
};

Cache.getIndex = function(package, callback) {
  fs.readFile(basePath + package+'/index.json', function(err, data) {
    if (err) throw err;
    callback(undefined, JSON.parse(data.toString()));
  });
};

module.exports = Cache;
