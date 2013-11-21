var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    assert = require('assert'),
    mkdirp = require('mkdirp'),

    api = require('../lib/api.js'),
    Cache = require('../lib/cache2.js'),
    Package = require('../lib/package.js'),
    Resource = require('../lib/resource.js'),

    Client = require('mixu_minimal').Client;

var FakeCache = {};

exports['given a server'] = {

  before: function(done) {
    Resource.configure({
      cache: new Cache({ path: __dirname + '/db/' })
    });
    Package.configure({
      externalUrl: 'http://localhost:9090'
    });

    http.createServer(function(req, res) {
      api.route(req, res);
    }).listen(9090, 'localhost', function() {
      done();
    });
  },

  'can GET a package index': function(done) {
    this.timeout(60000); // because I'm tethering
    Client
      .get('http://localhost:9090/requireincontext')
      .end(function(err, res) {
        if (err) throw err;
        var data = '';
        res.on('data', function(c) {
          data += c;
        });
        res.on('end', function() {
          assert.ok(typeof JSON.parse(data) === 'object');
          done();
        });
      });
  },

  'can GET a package version': function(done) {
    this.timeout(60000);
    Client
      .get('http://localhost:9090/requireincontext/0.0.1')
      .end(function(err, res) {
        if (err) throw err;
        var data = '';
        res.on('data', function(c) {
          data += c;
        });
        res.on('end', function() {
          assert.ok(typeof JSON.parse(data) === 'object');
          done();
        });
      });
  },

  'can use npm install requireincontext': function(done) {
    var tmpdir = __dirname + '/tmp/';
    this.timeout(60000);
    [tmpdir + '/node_modules/requireincontext/index.js',
      tmpdir + '/node_modules/requireincontext/package.json',
      tmpdir + '/node_modules/requireincontext/readme.md'
    ].forEach(function(p) {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    });
    mkdirp(tmpdir, function() {
      console.log(tmpdir);
      require('child_process')
          .exec('npm --verbose --registry http://localhost:9090/ install',
                { cwd: tmpdir },
      function(error, stdout, stderr) {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (error !== null) {
          console.log('exec error: ' + error);
          assert.ok(false);
        }
        done();
      });
    });
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [
    '--colors', '--ui', 'exports', '--reporter', 'spec', __filename
  ]);
  mocha.on('error', function() {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
  });
  mocha.stderr.on('data', function(data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
