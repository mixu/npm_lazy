var fs = require('fs'),
    path = require('path'),
    homePath = path.normalize(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']) + '/.npm_lazy',
    meta = require(homePath+'/meta.json');

var Cache = require('../lib/cache.js');

var cache = new Cache({ path: homePath });

var files = fs.readdirSync(homePath);

var entries = [];

Object.keys(meta).forEach(function(uri) {
  var ipath = meta[uri].taskResults.GET.path;
  entries.push( { size: fs.statSync(ipath).size, uri: uri, path: ipath } );
  var index = files.indexOf(path.basename(ipath));
  if(index > -1) {
    files.splice(index, 1);
  }

  console.log('Cache check', uri, cache.lookup(uri, 'GET'));

});

files.forEach(function(name) {
  var ipath = homePath + '/' + name;
  entries.push( { size: fs.statSync( ipath).size, path: ipath, uri: 'N/A' } );
});

entries.sort(function(a, b) {
  return b.size - a.size;
});

var bytes = require('bytes');

entries.forEach(function(line) {
  console.log(bytes(line.size) + ' ' + line.uri + ' ' + line.path);
});
