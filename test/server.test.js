var http = require('http'),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter,

    Client = require('mixu_minimal').Client,
    api = require('../lib/api.js'),
    cache = require('../lib/cache.js'),
    config = require('../config.js');

var FakeCache = {};
api.configure(config);
cache.configure(config);

exports['given a server'] = {

  before: function(done) {
    var server = http.createServer(function(req, res) {
      api.route(req, res);
    }).listen(9090, 'localhost', function() {
      done();
    });
  },

  'can GET a package index': function(done) {
    FakeCache.getAll = function(pkg) {
      assert.equal('package', pkg);
      done();
    };
    Client
      .get('http://localhost:9090/package')
      .end(function(err, data) {
        if (err) throw err;
      });
  },

  'can GET a package version': function(done) {
    FakeCache.getVersion = function(pkg, ver) {
      assert.equal('package', pkg);
      assert.equal('1.2.3', ver);
      done();
    };
    Client
      .get('http://localhost:9090/package/1.2.3')
      .end(function(err, data) {
        if (err) throw err;
      });
  },

  'can rewrite the package location': function(done) {
    assert.deepEqual({
      name: "foo", version: "0.0.1",
      dist: {
        "shasum": "fb65ff63e8e6c5be1b1663479b172391f2948fdb",
        "tarball": "http://localhost:8080/foo/-/foo-0.0.1.tgz"
      }
    }, api.rewriteLocation(samplePackage));
    done();
  }
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
