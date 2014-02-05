var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),

    Package = require('../lib/package.js'),
    verify = require('../lib/verify.js'),
    Cache = require('../lib/cache.js'),
    Resource = require('../lib/resource.js');

exports['given a package'] = {

  before: function(done) {
    cache = new Cache({ path: __dirname + '/tmp' });
    Resource.configure({
      cache: cache
    });

    cache.clear();

    Package.configure({
      externalUrl: 'http://localhost:8080'
    });
    done();
  },

  'can fetch a package index': function(done) {
    this.timeout(10000);

    // Note: this goes out the the real reg!

    Package.getIndex('foo', function(err, actual) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname + '/db/foo.json')
        .toString().replace('http://registry.npmjs.org/foo', 'http://localhost:8080/foo')
      );
      assert.deepEqual(actual, expected);
      done();
    });
  },

  'can fetch a specific version in the index': function(done) {
    Package.getVersion('foo', '1.0.0', function(err, json) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname + '/db/foo.json')
          .toString().replace('http://registry.npmjs.org/foo', 'http://localhost:8080/foo')
      ).versions['1.0.0'];
      assert.deepEqual(json, expected);
      done();
    });
  },

  'can fetch a tarfile': function(done) {
    var out = __dirname + '/tmp/foo.tgz';
    if (fs.existsSync(out)) {
      fs.unlinkSync(out);
    }
    Resource.get('http://registry.npmjs.org/foo/-/foo-1.0.0.tgz')
            .getReadablePath(function(err, fullpath) {
              fs.createReadStream(fullpath).pipe(
                fs.createWriteStream(out)
                .on('close', function() {
                  verify.check(out, function(err, actual) {
                    console.log(err, actual);
                    done();
                  });
                })
              );
            });
  },

  'can check file sha': function(done) {
    verify.check(__dirname + '/fixtures/requireincontext/requireincontext-0.0.2.tgz', function(err, actual) {
      assert.notEqual('4a77c6f7ccbd43e095d9fc6c943e53707e042f41', actual);
      assert.equal('3bb7b8a676e95a33a0f28f081cf860176b8f67c7', actual);
      done();
    });
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha',
    ['--colors', '--ui', 'exports', '--reporter', 'spec', __filename]);
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
