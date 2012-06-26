var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),

    Package = require('../lib/package.js');

exports['given a package'] = {

  before: function(done) {
    var Cache = require('../lib/cache.js');
    Cache.configure({ cacheDirectory: __dirname+'/db/'});
    Package.configure({
      cache: Cache,
      externalUrl: 'http://localhost:8080'
    });
    done();
  },

  'can fetch a package index': function(done) {
    this.timeout(10000);
    Package.get('foo', function(err, json) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname+'/db/foo/index.json')
        .toString().replace('http://registry.npmjs.org/foo', 'http://localhost:8080/foo')
      );
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
  },

  'can check file sha': function(done) {
    Package.checkFile(__dirname+'/fixtures/requireincontext/requireincontext-0.0.2.tgz', function(err, actual) {
      assert.notEqual('4a77c6f7ccbd43e095d9fc6c943e53707e042f41', actual);
      assert.equal('3bb7b8a676e95a33a0f28f081cf860176b8f67c7', actual);
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
