var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    assert = require('assert'),
    npmLazy = require('npm_lazy'),
    Resource = npmLazy.Resource,
    Cache = require('../lib/cache2.js');

var cache = new Cache({ path: __dirname + '/tmp' }),
        remoteDir = __dirname + '/fixtures/remote',
        localDir = __dirname + '/fixtures/local',
        oldIsUpToDate;

function getTargetBasename(uri) {
  var parts = url.parse(uri);
  return path.basename(path.extname(parts.pathname) == '.tgz' ? parts.pathname : parts.pathname + '.json');
}

function mockFetch(onDone) {
  var target = getTargetBasename(this.url);

  // console.log('remote-read:', this.url, 'from', target);

  if(target == 'remote-retries.tgz') {
    return onDone(new Error('Fake error'));
  }

  if(!fs.existsSync(remoteDir + '/' + target)) {
    throw new Error('Path does not exist ' + remoteDir + '/' + target);
    return;
  }

  // special case remote-retry: should succeed on 3rd try
  if(target == 'remote-retry.json' && this.retries == 3) {
    // return remote-retry-valid.json
    return onDone(null, fs.createReadStream(remoteDir + '/remote-retry-valid.json'));
  }
  if(target == 'remote-retry-3.tgz' && this.retries == 3) {
    // return remote-retry-valid.json
    return onDone(null, fs.createReadStream(remoteDir + '/remote-retry-3-valid.tgz'));
  }
  // this works by reading the corresponding file from fixtures/remote

  // console.log(remoteDir + '/' + target);

  return onDone(null, fs.createReadStream(remoteDir + '/' + target));
}

exports['resource tests'] = {

  before: function() {

    cache.clear();

    // fixture setup
    Resource.setCache(cache);

    // for each file in fixtures/local, store them in the cache
    // as if they had already been downloaded

    fs.readdirSync(localDir).forEach(function(basename) {
      var filename = localDir + '/' + basename,
          cachename = cache.filename(),
          content = fs.readFileSync(filename),
          remotename = 'http://registry.npmjs.org/' + path.basename(basename, '.json');

      // console.log(remotename, filename, content.toString());

      fs.writeFileSync(cachename, content);

      // e.g. cache lookups should not have .json on their URLs
      cache.complete(remotename, 'GET', cachename);
    });

    // change the _fetchTask
    Resource.prototype._fetchTask = mockFetch;
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
      var r = Resource.get('http://registry.npmjs.org/local-cached');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'local-cached');
        done();
      });
    },

    'if it does not exist and the response is a JSON object, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-valid');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-valid');
        done();
      });
    },

    'if it does not exist and the response is not a JSON object, retry': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retry');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'remote-retry');
        done();
      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-invalid');

      r.getReadableStream(function(err, data) {
        assert.ok(err);
        assert.ok(!data);
        done();
      });
    },

    'if the resource exists but is outdated, fetch a new version and return it': function(done) {
      var r = Resource.get('http://registry.npmjs.org/local-outdated');

      r.isUpToDate = function() { return false; };
      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'uptodate');
        done();
      });
    },

    'if the resource is outdated and the fetch fails, return the cached version': function(done) {
      var r = Resource.get('http://registry.npmjs.org/local-outdated-fail');

      r.isUpToDate = function() { return false; };
      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(data).name, 'outdated-fail');
        done();
      });
    },

    'with granular control': {

      before: function() {
        Resource.prototype._fetchTask = function() { };
        oldIsUpToDate = Resource.prototype.isUpToDate;
        Resource.prototype.isUpToDate = function() {
          return false;
        };
      },

      after: function() {
        Resource.prototype._fetchTask = mockFetch;
        Resource.prototype.isUpToDate = oldIsUpToDate;
      },

      'if the fetch times out, use the cached version': function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.org/local-cached'),
            errors = [];

        r.on('fetch-error', function(err) {
          // console.log(err);
          errors.push(err);
        });
        r.timeout = 10;

        r.getReadableStream(function(err, data) {
          assert.ok(!err);
          assert.equal(errors.length, 3);
          assert.equal(JSON.parse(data).name, 'local-cached');
          done();
        });
      },

      'if the fetch times out, and the object is not cached, throw': function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.org/local-missing'),
            errors = [];

        r.on('fetch-error', function(err) {
          // console.log(err);
          errors.push(err);
        });
        r.timeout = 10;

        r.getReadableStream(function(err, data) {
          assert.ok(err);
          assert.ok(!data);
          done();
        });
      },

      'when the resource is already fetching, block all pending requests': function(done) {
        this.timeout(10000);
        Resource.prototype._fetchTask = function(onDone) {
          var u = this.url;
          setTimeout(function() {
            onDone(null, fs.createReadStream(remoteDir + '/' + getTargetBasename(u)));
          }, 50);
        };

        var r = Resource.get('http://registry.npmjs.org/remote-valid'),
            r2 = Resource.get('http://registry.npmjs.org/remote-valid'),
            counter = 0;

        r.getReadableStream(onDone);
        r2.getReadableStream(onDone);

        function onDone(err, data) {
          assert.ok(!err);
          assert.equal(JSON.parse(data).name, 'remote-valid');
          counter++;
          if(counter == 2) {
            done();
          }
        }
      }

    }

  },

  'tar resource': {

    'if it exists, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-cached.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(data, 'remote-cached-tar');
        done();
      });
    },

    'when the response passes checksum, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-valid.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(data.trim(), 'remote-valid-tar');
        done();
      });
    },

    'when the response fails checksum, retry': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retry-3.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(!err);
        assert.equal(data.trim(), 'remote-retry-valid-tar');
        done();
      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retries.tgz');

      r.getReadableStream(function(err, data) {
        assert.ok(err);
        assert.ok(!data);
        done();
      });
    },

    'with granular control': {

      before: function() {
        Resource.prototype._fetchTask = function() { };
        oldIsUpToDate = Resource.prototype.isUpToDate;
      },

      after: function() {
        Resource.prototype._fetchTask = mockFetch;
      },

      'if the fetch times out, and the object is not cached, throw': function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.org/remote-missing.tgz'),
            errors = [];

        r.on('fetch-error', function(err) {
          console.log(err);
          errors.push(err);
        });
        r.timeout = 10;

        r.getReadableStream(function(err, data) {
          assert.ok(err);
          assert.ok(!data);
          done();
        });
      },

      'when the resource is already fetching, block all pending requests': function(done) {
        this.timeout(10000);
        Resource.prototype._fetchTask = function(onDone) {
          var u = this.url;
          setTimeout(function() {
            onDone(null, fs.createReadStream(remoteDir + '/' + getTargetBasename(u)));
          }, 50);
        };

        var r = Resource.get('http://registry.npmjs.org/remote-valid2.tgz'),
            r2 = Resource.get('http://registry.npmjs.org/remote-valid2.tgz'),
            counter = 0;

        r.getReadableStream(onDone);
        r2.getReadableStream(onDone);

        function onDone(err, data) {
          assert.ok(!err);
          assert.equal(data.trim(), 'remote-valid-tar');
          counter++;
          if(counter == 2) {
            done();
          }
        }
      }

    }

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--bail',  '--reporter', 'spec', __filename ]);
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}

