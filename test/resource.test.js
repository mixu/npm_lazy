var fs = require('fs'),
    assert = require('assert'),
    npmLazy = require('npm_lazy'),
    Resource = npmLazy.Resource,
    Cache = require('../lib/cache2.js');

exports['resource tests'] = {

  before: function() {

    // fixture setup
    var cache = new Cache({ path: __dirname + '/tmp' }),
        remoteDir = __dirname + '/fixtures/remote',
        localDir = __dirname + '/fixtures/local';
    Resource.setCache(cache);

    // for each file in fixtures/local, store them in the cache
    // as if they had already been downloaded

    fs.readdirSync(localDir).forEach(function(basename) {
      var filename = localDir + '/' + basename,
          cachename = cache.filename(),
          content = fs.readFileSync(filename);

      console.log(filename, content.toString());

      fs.writeFileSync(cachename, content);

      cache.complete(basename, 'GET', cachename);
    });

    // change the _fetchTask
    Resource.prototype._fetchTask = function(onDone) {
      console.log('fetch:', this.url);

      if(!fs.existsSync(remoteDir + '/' + this.url)) {
        throw new Error('Path does not exist ' + remoteDir + '/' + this.url);
        return;
      }

      // special case remote-retry: should succeed on 3rd try
      if(this.url == 'remote-retry.json' && this.retries == 3) {
        // return remote-retry-valid.json
        return onDone(null, fs.createReadStream(remoteDir + '/remote-retry-valid.json'));
      }
      // this works by reading the corresponding file from fixtures/remote

      console.log(remoteDir + '/' + this.url);

      return onDone(null, fs.createReadStream(remoteDir + '/' + this.url));
    };
  },

  'Resource.get() will only return a single instance for a given url': function() {
    assert.strictEqual(Resource.get('foo'), Resource.get('foo'));
  },

  '.tgz has type tar, others have type index': function() {
    assert.equal(Resource.get('http://foo/foo.tgz').type, 'tar');
    assert.equal(Resource.get('http://foo/foo/').type, 'index');
  },

  'index resource': {

    'if it exists and is up to date, success': function(done) {
      var r = Resource.get('local-cached.json');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'local-cached');
        done();
      });
    },

    'if it does not exist and the response is a JSON object, success': function(done) {
      var r = Resource.get('remote-valid.json');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-valid');
        done();
      });
    },

    'if it does not exist and the response is not a JSON object, retry': function(done) {
      var r = Resource.get('remote-retry.json');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-retry');
        done();
      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('remote-invalid.json');

      r.getReadableStream(function(err, data) {
        assert.ok(err);
        assert.ok(!data);
        done();
      });
    },

    'if the resource exists but is outdated, fetch a new version and return it': function(done) {
      var r = Resource.get('local-outdated.json');

      r.isUpToDate = function() { return false; };
      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'uptodate');
        done();
      });
    },

    'if the resource is outdated and the fetch fails, return the cached version': function(done) {
      var r = Resource.get('local-outdated-fail.json');

      r.isUpToDate = function() { return false; };
      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'outdated-fail');
        done();
      });
    },

    'with granular control': {

      'if the fetch times out, use the cached version': function() {

      },

      'if the fetch times out, and the object is not cached, throw': function() {

      },

      'when the resource is already fetching, block all pending requests': function() {

      }

    }

  },
/*
  'tar resource': {

    'if it exists, success': function(done) {
      var r = Resource.get('remote-cached.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(data, 'remote-cached-tar');
        done();
      });
    },

    'when the response passes checksum, success': function(done) {
      var r = Resource.get('remote-valid.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(data, 'remote-valid-tar');
        done();
      });
    },

    'when the response fails checksum, retry': function() {

    },

    'if the fetch times out, and the object is not cached, throw': function() {

    },

    'if retries > maxRetries, throw a error': function() {
      var r = Resource.get('remote-invalid.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(err);
        assert.ok(!data);
        done();
      });
    },

    'when the resource is already fetching, block all pending requests': function() {

    }

  }
*/
};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

