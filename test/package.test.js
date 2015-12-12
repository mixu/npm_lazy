var fs = require('fs'),
    util = require('util'),
    assert = require('assert'),

    Package = require('../lib/package.js'),
    verify = require('../lib/verify.js'),
    Cache = require('../lib/cache.js'),
    Resource = require('../lib/resource.js'),
    fixture = require('file-fixture');

describe('given a package', function() {

  before(function(done) {
    cache = new Cache({ path: __dirname + '/tmp' });
    Resource.configure({
      cache: cache
    });

    cache.clear();

    Package.configure({
      externalUrl: 'http://localhost:8080'
    });
    done();
  });

  it('can fetch a package index', function(done) {
    this.timeout(10000);

    // Note: this goes out the the real reg!

    Package.getIndex('foo', function(err, actual) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname + '/db/foo.json')
        .toString().replace('http://registry.npmjs.com/foo', 'http://localhost:8080/foo')
      );
      assert.deepEqual(actual, expected);
      done();
    });
  });

  it('can fetch a specific version in the index', function(done) {
    Package.getVersion('foo', '1.0.0', function(err, json) {
      var expected = JSON.parse(
        fs.readFileSync(__dirname + '/db/foo.json')
          .toString().replace('http://registry.npmjs.com/foo', 'http://localhost:8080/foo')
      ).versions['1.0.0'];
      assert.deepEqual(json, expected);
      done();
    });
  });

  it('can fetch a tarfile', function(done) {
    var out = __dirname + '/tmp/foo.tgz';
    if (fs.existsSync(out)) {
      fs.unlinkSync(out);
    }
    Resource.get('http://registry.npmjs.com/foo/-/foo-1.0.0.tgz')
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
  });

  it('can check file sha', function(done) {
    var requireincontextDir = fixture.dir({
      'index.json': '{"_id":"requireincontext","_rev":"5-988ff7c27a21e527ceeb50cbedc8d1b0","name":"requireincontext","description":"Wrapper to require() js files in a custom context","dist-tags":{"latest":"0.0.2"},"versions":{"0.0.1":{"name":"requireincontext","description":"Wrapper to require() js files in a custom context","version":"0.0.1","author":{"name":"Mikito Takada","email":"mixu@mixu.net"},"keywords":["require"],"repository":{"type":"git","url":"git://github.com/mixu/requireincontext.git"},"main":"index.js","_npmJsonOpts":{"file":"/home/mtakada/.npm/requireincontext/0.0.1/package/package.json","wscript":false,"contributors":false,"serverjs":false},"_id":"requireincontext@0.0.1","dependencies":{},"devDependencies":{},"engines":{"node":"*"},"_engineSupported":true,"_npmVersion":"1.0.22","_nodeVersion":"v0.4.11-pre","_defaultsLoaded":true,"dist":{"shasum":"a47054a6e05bc7d6d7b7965fd0631ee58f4e72ef","tarball":"http://registry.npmjs.com/requireincontext/-/requireincontext-0.0.1.tgz"},"scripts":{},"maintainers":[{"name":"mixu","email":"mixu@mixu.net"}],"directories":{}},"0.0.2":{"name":"requireincontext","description":"Wrapper to require() js files in a custom context","version":"0.0.2","author":{"name":"Mikito Takada","email":"mixu@mixu.net"},"keywords":["require"],"repository":{"type":"git","url":"git://github.com/mixu/requireincontext.git"},"main":"index.js","_npmJsonOpts":{"file":"/home/mtakada/.npm/requireincontext/0.0.2/package/package.json","wscript":false,"contributors":false,"serverjs":false},"_id":"requireincontext@0.0.2","dependencies":{},"devDependencies":{},"engines":{"node":"*"},"_engineSupported":true,"_npmVersion":"1.0.22","_nodeVersion":"v0.4.11-pre","_defaultsLoaded":true,"dist":{"shasum":"4a77c6f7ccbd43e095d9fc6c943e53707e042f41","tarball":"http://registry.npmjs.com/requireincontext/-/requireincontext-0.0.2.tgz"},"scripts":{},"maintainers":[{"name":"mixu","email":"mixu@mixu.net"}],"directories":{}}},"maintainers":[{"name":"mixu","email":"mixu@mixu.net"}],"time":{"0.0.1":"2011-08-17T21:20:46.028Z","0.0.2":"2011-08-17T21:52:41.196Z"},"author":{"name":"Mikito Takada","email":"mixu@mixu.net"},"repository":{"type":"git","url":"git://github.com/mixu/requireincontext.git"}}',
      'requireincontext-0.0.2.tgz': '{"error":"not_found","reason":"document not found"}\n'
    });

    verify.check(requireincontextDir + '/requireincontext-0.0.2.tgz', function(err, actual) {
      assert.notEqual('4a77c6f7ccbd43e095d9fc6c943e53707e042f41', actual);
      assert.equal('3bb7b8a676e95a33a0f28f081cf860176b8f67c7', actual);
      done();
    });
  });
});
