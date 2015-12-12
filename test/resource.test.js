var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    assert = require('assert'),
    npmLazy = require('npm_lazy'),
    Resource = npmLazy.Resource,
    Cache = require('../lib/cache.js'),
    fixture = require('file-fixture');

function getTargetBasename(uri) {
  var parts = url.parse(uri);
  return path.basename(path.extname(parts.pathname) == '.tgz' ? parts.pathname : parts.pathname + '.json');
}

function read(fullpath) {
  if (!fullpath) {
    return fullpath;
  }
  return fs.readFileSync(fullpath).toString();
}

describe('resource tests', function() {
  var cache,
      remoteDir,
      localDir,
      oldIsUpToDate;

  function fakeResponse(filePath, statusCode) {
    var stream = fs.createReadStream(filePath);
    stream.statusCode = statusCode || 200;
    return stream;
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
      return onDone(null, fakeResponse(remoteDir + '/remote-retry-valid.json'));
    }
    if (target == 'remote-retry-3.tgz' && this.retries == 1) {
      // return remote-retry-valid.json
      return onDone(null, fakeResponse(remoteDir + '/remote-retry-3-valid.tgz'));
    }
    // this works by reading the corresponding file from fixtures/remote

    // console.log(remoteDir + '/' + target);
    if (target.indexOf('404.json') > -1) {
      return onDone(null, fakeResponse(targetPath, 404));
    }
    if (target.indexOf('500.json') > -1) {
      return onDone(null, fakeResponse(targetPath, 500));
    }
    if (target.indexOf('503.json') > -1) {
      return onDone(null, fakeResponse(targetPath, 503));
    }

    return onDone(null, fakeResponse(targetPath));
  }

  before(function() {
    localDir = fixture.dir({
      'local-cached.json': '{ "name": "local-cached" }',
      'local-outdated-fail.json': '{ "name": "outdated-fail" }',
      'local-outdated-fail-500.json': '{ "name": "outdated-fail-500" }',
      'local-outdated.json': '{ "name": "outdated" }',
      'remote-cached.tgz': 'remote-cached-tar'
    });

    remoteDir = fixture.dir({
      'local-cached.json': '{ "name": "local-cached" }',
      'local-outdated-fail.json': 'aaaa',
      'local-outdated-fail-500.json': '{ "error": "Whoops something went wrong" }',
      'local-outdated.json': '{ "name": "uptodate" }',
      'remote-cached.json': JSON.stringify({
        'name': 'remote-cached',
        'versions': {
          '0.0.1': {
            'name': 'remote-cached',
            'dist': {
              'tarball': 'http://foo/remote-cached.tgz',
              'shasum': '1ffc692160f4cea33b3489ac0b9b281eb87b03eb'
            }
          }
        }
      }),
      'remote-invalid.json': 'remote-invalid',
      'remote-retry-3-valid.tgz': 'remote-retry-valid-tar\n',
      'remote-retry-3.json': JSON.stringify({
        'name': 'remote-valid',
        'versions': {
          '0.0.1': {
            'name': 'remote-valid',
            'dist': {
              'tarball': 'http://foo/remote-retry-3.tgz',
              'shasum': '7c92179e6b1cf5d2106f145f5a748d84f40d8d39',
              'comment': 'This is the SHA for remote-retry-3-valid.tgz and not for remote-retry-3.tgz'
            }
          }
        }
      }),
      'remote-retry-3.tgz': 'this file has a bad checksum\n',
      'remote-retry-valid.json': '{ "name": "remote-retry" }\n',
      'remote-retry.json': 'aaaa',
      'remote-valid.json': JSON.stringify({
        'name': 'remote-valid',
        'versions': {
          '0.0.1': {
            'name': 'remote-valid',
            'dist': {
              'tarball': 'http://foo/remote-valid.tgz',
              'shasum': '19da7c27e374042b357808fb914eb8a04b6a6f28'
            }
          }
        }
      }),
      'remote-valid.tgz': 'remote-valid-tar\n\n\n',
      'remote-valid2.json': JSON.stringify({
        'name': 'remote-valid2',
        'versions': {
          '0.0.1': {
            'name': 'remote-valid2',
            'dist': {
              'tarball': 'http://foo/remote-valid2.tgz',
              'shasum': '19da7c27e374042b357808fb914eb8a04b6a6f28'
            }
          }
        }
      }),
      'remote-valid2.tgz': 'remote-valid-tar\n\n\n',
      'remote-404.json': '{"error":"not_found","reason":"document not found"}',
      'remote-nocache-404.json': '{"error":"not_found","reason":"document not found"}',
      'remote-503.json': '{ "error": "remote-error" }',
      'remote-500.json': '{ "error": "remote-error" }'
    });

    cache = new Cache({ path: __dirname + '/db' });

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
        remotename = 'http://registry.npmjs.com/' + packagename;
      } else {
        remotename = 'http://registry.npmjs.com/' +
          packagename + '/-/' + basename;
      }

      // console.log(path.relative(__dirname, filename), '\tcached locally as', remotename);

      fs.writeFileSync(cachename, content);

      // e.g. cache lookups should not have .json on their URLs
      cache.complete(remotename, 'GET', cachename);
    });

    // change the _fetchTask
    Resource.prototype._fetchTask = mockFetch;
  });

  it('Resource.get() will only return a single instance for a given url', function() {
    assert.strictEqual(Resource.get('foo'), Resource.get('foo'));
  });

  it('.tgz has type tar, others have type index', function() {
    assert.equal(Resource.get('http://foo/foo.tgz').type, 'tar');
    assert.equal(Resource.get('http://foo/foo/').type, 'index');
  });

  it('.tgz get packagename', function() {
    assert.equal(Resource.get('http://registry.npmjs.com/foo/-/foo-1.0.0.tgz').getPackageName(), 'foo');
  });

  describe('index resource', function() {

    it('if it exists and is up to date, success', function(done) {
      var r = Resource.get('http://registry.npmjs.com/local-cached');

      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'local-cached');
        done();
      });
    });

    it('if it does not exist and the response is a JSON object, success', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-valid');

      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'remote-valid');
        done();
      });
    });

    it('if it does not exist and the response is not a JSON object, retry', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-retry');

      r.getReadablePath(function(err, data) {
        console.log('err: ', err);
        console.log('data: ', data);
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'remote-retry');
        done();
      });
    });

    it('if retries > maxRetries, throw a error', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-invalid');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(!read(data));
        done();
      });
    });

    it('if retries > maxRetries on 500, throw a error', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-503');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(err.content);
        assert.equal(JSON.parse(err.content).error, 'remote-error', err.content);
        done();
      });
    });

    it('if the resource exists but is outdated, fetch a new version and return it', function(done) {
      var r = Resource.get('http://registry.npmjs.com/local-outdated');

      r.isUpToDate = function() { return false; };
      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'uptodate');
        done();
      });
    });

    it('if the resource is outdated and the fetch fails, return the cached version', function(done) {
      var r = Resource.get('http://registry.npmjs.com/local-outdated-fail');

      r.isUpToDate = function() { return false; };
      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'outdated-fail');
        done();
      });
    });

    it('if the resource is outdated and the fetch responds with error 500, return the cached version', function(done) {
      var r = Resource.get('http://registry.npmjs.com/local-outdated-fail-500');

      r.isUpToDate = function() { return false; };
      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(JSON.parse(read(data)).name, 'outdated-fail-500', read(data));
        done();
      });
    });

    it('should respond with 404 with upstream response', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-404');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(err.content);
        assert.equal(JSON.parse(err.content).error, 'not_found', err.content);
        done();
      });
    });

    it('should keep responding with 404 with upstream response', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-nocache-404');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(err.content);
        assert.equal(JSON.parse(err.content).error, 'not_found', err.content);

        var r2 = Resource.get('http://registry.npmjs.com/remote-nocache-404');

        r2.getReadablePath(function(err, data) {
          assert.ok(err);
          assert.ok(err.content);
          assert.equal(JSON.parse(err.content).error, 'not_found', err.content);
          done();
        });
      });
    });

    describe('with granular control', function() {

      before(function() {
        Resource.prototype._fetchTask = function() { };
        oldIsUpToDate = Resource.prototype.isUpToDate;
        Resource.prototype.isUpToDate = function() {
          return false;
        };
        Resource.configure({ timeout: 10 });
      });

      after(function() {
        Resource.prototype._fetchTask = mockFetch;
        Resource.prototype.isUpToDate = oldIsUpToDate;
        Resource.configure({ timeout: 2000 });
      });

      it('if the fetch times out, use the cached version', function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.com/local-cached'),
            errors = [];

        r.on('fetch-error', function(err) {
          // console.log(err);
          errors.push(err);
        });

        r.getReadablePath(function(err, data) {
          assert.ok(!err, err);
          assert.ok(errors.length > 0);
          assert.equal(JSON.parse(read(data)).name, 'local-cached');
          done();
        });
      });

      it('if the fetch times out, and the object is not cached, throw', function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.com/local-missing'),
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
      });

      it('when the resource is already fetching, block all pending requests', function(done) {
        this.timeout(10000);
        Resource.prototype._fetchTask = function(onDone) {
          var u = this.url;
          setTimeout(function() {
            onDone(null, fakeResponse(remoteDir + '/' + getTargetBasename(u)));
          }, 50);
        };

        var r = Resource.get('http://registry.npmjs.com/remote-valid'),
            r2 = Resource.get('http://registry.npmjs.com/remote-valid'),
            counter = 0;

        r.getReadablePath(onDone);
        r2.getReadablePath(onDone);

        function onDone(err, data) {
          assert.ok(!err, err);
          assert.equal(JSON.parse(read(data)).name, 'remote-valid');
          counter++;
          if (counter == 2) {
            done();
          }
        }
      });
    });
  });

  describe('tar resource', function() {

    it('if it exists, success', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-cached/-/remote-cached.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(read(data), 'remote-cached-tar');
        done();
      });
    });

    it('when the response passes checksum, success', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-valid/-/remote-valid.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(read(data).trim(), 'remote-valid-tar');
        done();
      });
    });

    it('when the response fails checksum, retry', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-retry-3/-/remote-retry-3.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(!err, err);
        assert.equal(read(data).trim(), 'remote-retry-valid-tar');
        done();
      });
    });

    it('if retries > maxRetries, throw a error', function(done) {
      var r = Resource.get('http://registry.npmjs.com/remote-retries/-/remote-retries.tgz');

      r.getReadablePath(function(err, data) {
        assert.ok(err);
        assert.ok(!read(data));
        done();
      });
    });
      
    describe('with granular control', function() {

      before(function() {
        Resource.prototype._fetchTask = function() { };
        oldIsUpToDate = Resource.prototype.isUpToDate;
        Resource.configure({ timeout: 10 });
      });

      after(function() {
        Resource.prototype._fetchTask = mockFetch;
        Resource.configure({ timeout: 2000 });
      });

      it('if the fetch times out, and the object is not cached, throw', function(done) {
        this.timeout(10000);
        var r = Resource.get('http://registry.npmjs.com/remote-missing/-/remote-missing.tgz'),
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
      });

      it('when the resource is already fetching, block all pending requests', function(done) {
        this.timeout(10000);
        Resource.prototype._fetchTask = function(onDone) {
          var u = this.url;
          setTimeout(function() {
            onDone(null, fakeResponse(remoteDir + '/' + getTargetBasename(u)));
          }, 50);
        };

        var r = Resource.get('http://registry.npmjs.com/remote-valid2/-/remote-valid2.tgz'),
            r2 = Resource.get('http://registry.npmjs.com/remote-valid2/-/remote-valid2.tgz'),
            counter = 0;

        r.getReadablePath(onDone);
        r2.getReadablePath(onDone);

        function onDone(err, data) {
          assert.ok(!err, err);
          assert.equal(read(data).trim(), 'remote-valid-tar');
          counter++;
          if (counter == 2) {
            done();
          }
        }
      });
      
      it('when the resource is already fetching, block all pending requests but still respond with errors', function(done) {
        this.timeout(10000);
        Resource.prototype._fetchTask = function(onDone) {
          var u = this.url;
          return setTimeout(function() {
            return onDone(null, fakeResponse(remoteDir + '/' + getTargetBasename(u), 500));
          }, 10);
        };

        var r = Resource.get('http://registry.npmjs.com/remote-500'),
            r2 = Resource.get('http://registry.npmjs.com/remote-500'),
            r3 = Resource.get('http://registry.npmjs.com/remote-500'),
            r4 = Resource.get('http://registry.npmjs.com/remote-500'),
            counter = 0;

        r.getReadablePath(onDone);
        r2.getReadablePath(onDone);
        r3.getReadablePath(onDone);
        r4.getReadablePath(onDone);

        function onDone(err, data) {
          assert.ok(err);
          assert.equal(err.statusCode, 500);
          assert.equal(JSON.parse(err.content).error, 'remote-error');
          counter++;
          if (counter == 4) {
            done();
          }
        }
      });
    });
  });
});
