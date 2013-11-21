var fs = require('fs'),
    path = require('path');

exports.getSha = function getSha(tarBaseName, json) {
  var expected;
  if (!json.versions) {
    throw new Error('Package index JSON is in unexpected format!' +
      ' A `.versions` keys is required ' + JSON.stringify(json));
  }

  // search `versions.nnn.dist.tarball` for the right tarball
  Object.keys(json.versions).forEach(function(version) {
    var item = json.versions[version];
    if (path.basename(item.dist.tarball) == tarBaseName) {
      expected = item.dist.shasum;
    }
  });
  return expected;
};

exports.check = function(filename, cb) {
  // from npm:
  var crypto = require('crypto');
  var h = crypto.createHash('sha1'),
      s = fs.createReadStream(filename),
      errState = null;
  s.on('error', function(er) {
    if (errState) return;
    return cb(errState = er);
  }).on('data', function(chunk) {
    if (errState) return;
    h.update(chunk);
  }).on('end', function() {
    if (errState) return;
    var actual = h.digest('hex').toLowerCase().trim();
    cb(null, actual);
  });
};
