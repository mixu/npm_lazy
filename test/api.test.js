var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    assert = require('assert'),
    mkdirp = require('mkdirp'),

    api = require('../lib/api.js'),
    Cache = require('../lib/cache.js'),
    Package = require('../lib/package.js'),
    Resource = require('../lib/resource.js'),

    Client = require('mixu_minimal').Client;

var FakeCache = {};

describe('given a server', function() {

  before(function(done) {
    cache = new Cache({ path: __dirname + '/db' });
    Resource.configure({
      cache: cache
    });

    cache.clear();

    Package.configure({
      externalUrl: 'http://localhost:9090'
    });

    http.createServer(function(req, res) {
      api.route(req, res);
    }).listen(9090, 'localhost', function() {
      done();
    });
  });

  after(function() {
    cache.clear();
  });

  it('can GET a package index', function(done) {
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
  });

  it('can GET a package version', function(done) {
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
  });

  describe('self-signed', function() {
    before(function() {
      // Note: this test depends on the fact that isaacs.iriscouch.com/ exists
      // and that it keeps serving the cert for registry.npmjs.com which
      // obviously fails validation

      // Note that this test seems to always pass in Node v0.8.x but works correctly in 0.10.x

      Resource.configure({
        rejectUnauthorized: false
      });
      Package.configure({
        remoteUrl: 'https://isaacs.iriscouch.com/registry/_design/app/_rewrite/'
      });
    });

    after(function() {
      Resource.configure({
        rejectUnauthorized: true
      });
      Package.configure({
        remoteUrl: 'http://registry.npmjs.com/'
      });
    });

    it('can GET a package index which has a self-signed cert', function(done) {
      this.timeout(60000); // because I'm tethering
      Client
        .get('http://localhost:9090/microee')
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
    });
  });

  it('can use npm install requireincontext', function(done) {
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
  });

});

