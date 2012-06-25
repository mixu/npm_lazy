var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    assert = require('assert'),

    Cache = require('../lib/cache.js');

exports['given a cache'] = {

  before: function(done) {
    if(path.existsSync(__dirname+'/db/foobar/index.json')) {
      fs.unlinkSync(__dirname+'/db/foobar/index.json');
    }
    Cache.configure({ cacheDirectory: __dirname+'/db/' });
    done();
  },

  'can check for a nonexistent package': function(done) {
    assert.equal(Cache.has('foobar', 'index.json'), false);
    done();
  },

  'can add a package': function(done) {
    Cache.add('foobar', 'index.json', { msg: "hello world"}, function(err) {
      done();
    });
  },

  'can check for an existing package': function(done) {
    assert.equal(Cache.has('foobar', 'index.json'), true);
    done();
  },

  'can get an existing package': function(done) {
    Cache.get('foobar', 'index.json', function(err, data) {
      assert.deepEqual({ msg: 'hello world'}, data);
      done();
    });
  },

  'can get a remote package': function(done) {
    this.timeout(20000); // npm is slow today
    if(path.existsSync(__dirname+'/db/requireincontext/index.json')) {
      fs.unlinkSync(__dirname+'/db/requireincontext/index.json');
    }
    Cache.get('requireincontext', 'index.json', function(err, data) {
      // not really sure how I would mock this
      assert.equal('requireincontext', data.name);
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
