var assert = require('assert'),
    npmLazy = require('npm_lazy'),
    Resource = npmLazy.Resource;

var datasets = {
  'local-cached': JSON.stringify({ name: 'local-cached' }),
  'remote-valid': JSON.stringify({ name: 'remote-valid' }),
  'remote-retry': 'aaa',
  'remote-invalid': 'aaa'
};

var local = [ 'local-cached' ], cache = {};

local.forEach(function(key) {
  cache[key] = datasets[key];
});

exports['resource tests'] = {

  before: function() {
    // change the _fetchTask
    Resource.prototype._fetchTask = function(onDone) {
      console.log('fetch:', this.url);
      // special case remote-retry: should succeed on 3rd try
      if(this.url == 'remote-retry' && this.retries == 3) {
        datasets[this.url] = JSON.stringify( { name: 'remote-retry' });
      }
      onDone(null, datasets[this.url]);
    };
    Resource.prototype.exists = function() {
      return local.indexOf(this.url) != -1;
    };
    Resource.prototype._readCache = function(onDone) {
      console.log('read-cache:', this.url);
      return cache[this.url];
    };
    Resource.prototype._writeCache = function(data, onDone) {
      console.log('write-cache:', this.url);
      cache[this.url] = data;
      onDone();
    };
  },

  'Resource.get() will only return a single instance for a given url': function() {
    assert.strictEqual(Resource.get('foo'), Resource.get('foo'));
  },

  'index resource': {

    'if it exists and is up to date, success': function(done) {
      var r = Resource.get('local-cached');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'local-cached');
        done();
      });
    },

    'if does not exist and the response is a JSON object, success': function(done) {
      var r = Resource.get('remote-valid');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-valid');
        done();
      });
    },

    'if does not exist and the response is not a JSON object, retry': function(done) {
      var r = Resource.get('remote-retry');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-retry');
        done();

      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('remote-invalid');

      r.getReadableStream(function(err, data) {
        assert.ok(err);
        assert.ok(!data);
        done();
      });
    },

    'if the fetch times out, use the cached version': function() {

    },

    'if the fetch times out, and the object is not cached, throw': function() {

    },

    'when the resource is already fetching, block all pending requests': function() {

    },

    'when the resource is outdated, fetch a new version and return it': function() {

    },

    'when the resource is outdated and the fetch fails, return the cached version': function() {

    }

  },

  'tar resource': {

    'if it exists, success': function() {

    },

    'when the response passes checksum, success': function() {

    },

    'when the response fails checksum, retry': function() {

    },

    'if the fetch times out, and the object is not cached, throw': function() {

    },

    'if retries > maxRetries, throw a error': function() {

    },

    'when the resource is already fetching, block all pending requests': function() {

    }

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

