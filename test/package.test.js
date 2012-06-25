var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),

    Package = require('../lib/package.js');

exports['given a package'] = {

  before: function(done) {
    var Cache = require('../lib/cache.js');
    Cache.configure({
      cacheDirectory: __dirname+'/db/',
      externalUrl: 'http://localhost:8080'
    });
    Package.setCache(Cache);
    done();
  },

  'can fetch a package index': function(done) {
    this.timeout(10000);
    Package.get('foo', function(err, json) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname+'/db/foo/index.json')
        .toString().replace('http://registry.npmjs.org/foo', 'http://localhost:8080/foo')
      );
//      console.log(util.inspect(expected, null, 6), util.inspect(json, null, 6));
      assert.deepEqual(json, expected);
      done();
    });
  },

  'can fetch a specific version in the index': function(done) {
    Package.get('foo', '1.0.0', function(err, json) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname+'/db/foo/index.json')
          .toString().replace('http://registry.npmjs.org/foo', 'http://localhost:8080/foo')
      ).versions["1.0.0"];
      assert.deepEqual(json, expected);
      done();
    });
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
