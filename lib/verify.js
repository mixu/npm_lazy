var fs = require('fs'),
    path = require('path');

exports.getSha = function getSha(filename) {
  // read the index.json to figure out the right shasum
  var indexfile = path.dirname(filename) + '/index.json',
      basename = path.basename(filename),
      expected;
  if(fs.existsSync(indexfile)) {
    var data = fs.readFileSync(indexfile),
        index;
    try {
      index = JSON.parse(data);
    } catch(e) {
      console.log('Failed to parse', indexfile);
      throw e;
    }

    // search `versions.nnn.dist.tarball` for the right tarball
    Object.keys(index.versions).forEach(function(version) {
      var item = index.versions[version];
      if(path.basename(item.dist.tarball) == basename) {
        expected = item.dist.shasum;
      }
    });
    return expected;
  }
};

exports.check = function(filename, cb) {
  // from npm:
  var crypto = require('crypto');
  var h = crypto.createHash("sha1"),
      s = fs.createReadStream(filename),
      errState = null;
  s.on("error", function (er) {
    if (errState) return;
    return cb(errState = er)
  }).on("data", function (chunk) {
    if (errState) return;
    h.update(chunk);
  }).on("end", function () {
    if (errState) return
    var actual = h.digest("hex").toLowerCase().trim();
    cb(null, actual);
  });
};
