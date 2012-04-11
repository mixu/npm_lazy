function Cache() { }

Cache.getAll = function(package) {
  console.log('Cache, get all', package);

  // check for cache hit

  // if cache miss:
  Client
    .get('http://registry.npmjs.org/'+package)
    .end(function(err, data) {
      if(err) throw err;
      console.log('NPM response');

      // should cache all version info
      Cache.addIndex(package, data);

      //console.log(require('util').inspect(data, false, 5, true));
    });
};

Cache.getVersion = function(package, version) {
  console.log('Cache, get version', package, version);

  // according to the NPM source, the version specific JSON is
  // directly from the index document (e.g. just take doc.versions[ver])
};

// add a previously unknown version to the cache
Cache.addIndex = function(package, content) {
  var path = __dirname+'/../db/'+package+'/';
  mkdirp(path, function (err) {
    if (err) throw err;
    fs.writeFile(path+'index.json', JSON.stringify(content, null, 2), function() {
      console.log('Wrote', path+'index.json');
    });
  });
};

module.exports = Cache;
