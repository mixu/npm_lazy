var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    assert = require('assert'),
    npmLazy = require('npm_lazy'),
    Resource = npmLazy.Resource,
    Cache = require('../lib/cache.js');

var cache = new Cache({ path: __dirname + '/db' }),
        remoteDir = __dirname + '/fixtures/remote',
        localDir = __dirname + '/fixtures/local',
        oldIsUpToDate;

function getTargetBasename(uri) {
  var parts = url.parse(uri);
  return path.basename(path.extname(parts.pathname) == '.tgz' ? parts.pathname : parts.pathname + '.json');
}

function mockFetch(onDone) {
  var target = getTargetBasename(this.url),
      targetPath = remoteDir + '/' + target;

  console.log('remote-read:', this.url, 'from', targetPath);

  if (target == 'remote-retries.tgz') {
    return onDone(new Error('Fake error'));
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error('Path does not exist ' + targetPath);
  }

  // special case remote-retry: should succeed on 3rd try
  if (target == 'remote-retry.json' && this.retries == 1) {
    // return remote-retry-valid.json
    return onDone(null, fs.createReadStream(remoteDir + '/remote-retry-valid.json'));
  }
  if (target == 'remote-retry-3.tgz' && this.retries == 1) {
    // return remote-retry-valid.json
    return onDone(null, fs.createReadStream(remoteDir + '/remote-retry-3-valid.tgz'));
  }
  // this works by reading the corresponding file from fixtures/remote

  // console.log(remoteDir + '/' + target);

  return onDone(null, fs.createReadStream(targetPath));
}

function read(fullpath) {
  if (!fullpath) {
    return fullpath;
  }
  return fs.readFileSync(fullpath).toString();
}

exports['resource tests'] = {

  before: function() {

    cache.clear();

    // fixture setup
    Resource.configure({ cache: cache });

    // for each file in fixtures/local, store them in the cache
    // as if they had already been downloaded

    fs.readdirSync(localDir).forEach(function(basename) {
      var filename = localDir + '/' + basename,
          cachename = cache.filename(),
          content = fs.readFileSync(filename),
          // exclude the extension from the package name
          packagename = basename.substr(0, basename.length - path.extname(basename).length),
          remotename;

      if (path.extname(basename) === '.json') {
        remotename = 'http://registry.npmjs.org/' + packagename;
      } else {
        remotename = 'http://registry.npmjs.org/' +
          packagename + '/-/' + basename;
      }

      // console.log(path.relative(__dirname, filename), '\tcached locally as', remotename);

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

  '.tgz get packagename': function() {
    assert.equal(Resource.get('http://registry.npmjs.org/foo/-/foo-1.0.0.tgz').getPackageName(), 'foo');
  },

  'index resource': {

    'if it exists and is up to date, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/local-cached');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(read(data)).name, 'local-cached');
        done();
      });
    },

    'if it does not exist and the response is a JSON object, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-valid');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(read(data)).name, 'remote-valid');
        done();
      });
    },

    'if it does not exist and the response is not a JSON object, retry': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retry');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(read(data)).name, 'remote-retry');
        done();
      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-invalid');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(!read(data));
        done();
      });
    },

    'if the resource exists but is outdated, fetch a new version and return it': function(done) {
      var r = Resource.get('http://registry.npmjs.org/local-outdated');

      r.isUpToDate = function() { return false; };
      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(read(data)).name, 'uptodate');
        done();
      });
    },

    'if the resource is outdated and the fetch fails, return the cached version': function(done) {
      var r = Resource.get('http://registry.npmjs.org/local-outdated-fail');

      r.isUpToDate = function() { return false; };
      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(JSON.parse(read(data)).name, 'outdated-fail');
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
        Resource.configure({ timeout: 10 });
      },

      after: function() {
        Resource.prototype._fetchTask = mockFetch;
        Resource.prototype.isUpToDate = oldIsUpToDate;
        Resource.configure({ timeout: 2000 });
      },

      'if the fetch times out, use the cached version': function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.org/local-cached'),
            errors = [];

        r.on('fetch-error', function(err) {
          // console.log(err);
          errors.push(err);
        });

        r.getReadablePath(function(err, data) {
          assert.ok(!err);
          assert.ok(errors.length > 0);
          assert.equal(JSON.parse(read(data)).name, 'local-cached');
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

        r.getReadablePath(function(err, data) {
          assert.ok(err);
          assert.ok(!read(data));
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

        r.getReadablePath(onDone);
        r2.getReadablePath(onDone);

        function onDone(err, data) {
          assert.ok(!err);
          assert.equal(JSON.parse(read(data)).name, 'remote-valid');
          counter++;
          if (counter == 2) {
            done();
          }
        }
      }

    }

  },

  'tar resource': {

    'if it exists, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-cached/-/remote-cached.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(read(data), 'remote-cached-tar');
        done();
      });
    },

    'when the response passes checksum, success': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-valid/-/remote-valid.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(read(data).trim(), 'remote-valid-tar');
        done();
      });
    },

    'when the response fails checksum, retry': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retry-3/-/remote-retry-3.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err);
        assert.equal(read(data).trim(), 'remote-retry-valid-tar');
        done();
      });
    },

    'if retries > maxRetries, throw a error': function(done) {
      var r = Resource.get('http://registry.npmjs.org/remote-retries/-/remote-retries.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(!read(data));
        done();
      });
    },

    'with granular control': {

      before: function() {
        Resource.prototype._fetchTask = function() { };
        oldIsUpToDate = Resource.prototype.isUpToDate;
        Resource.configure({ timeout: 10 });
      },

      after: function() {
        Resource.prototype._fetchTask = mockFetch;
        Resource.configure({ timeout: 2000 });
      },

      'if the fetch times out, and the object is not cached, throw': function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.org/remote-missing/-/remote-missing.tgz'),
            errors = [];

        r.on('fetch-error', function(err) {
          console.log(err);
          errors.push(err);
        });

        r.getReadablePath(function(err, data) {
          assert.ok(err);
          assert.ok(!read(data));
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

        var r = Resource.get('http://registry.npmjs.org/remote-valid2/-/remote-valid2.tgz'),
            r2 = Resource.get('http://registry.npmjs.org/remote-valid2/-/remote-valid2.tgz'),
            counter = 0;

        r.getReadablePath(onDone);
        r2.getReadablePath(onDone);

        function onDone(err, data) {
          assert.ok(!err);
          assert.equal(read(data).trim(), 'remote-valid-tar');
          counter++;
          if (counter == 2) {
            done();
          }
        }
      }

    }

  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha',
    ['--colors', '--ui', 'exports', '--bail', '--reporter', 'spec', __filename]);
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

