var http = require('http'),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter,

    Lifecycle = require('../lib/lifecycle.js');

var temp = null;

exports['given a lifecycle'] = {

  before: function(done) {
    this.cycle = new Lifecycle();
    done();
  },

  'can block and release': function(done) {
    this.cycle.block('foo');
    assert.ok(this.cycle.isBlocking('foo'));
    this.cycle.release('foo');
    assert.ok(!this.cycle.isBlocking('foo'));
    done();
  },

  'when blocking, can add a onrelease action': function(done) {
    var assertions = 0;
    this.cycle.block('foo');
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } })
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } })
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } })
    this.cycle.release('foo');
  }

};

// if this module is the script being run, then run the tests:
if (module == require.main) {
  var mocha = require('child_process').spawn('mocha', [ '--colors', '--ui', 'exports', '--reporter', 'spec', __filename ]);
  mocha.on('error', function() {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
  });
  mocha.stderr.on('data', function (data) {
    if (/^execvp\(\)/.test(data)) {
     console.log('Failed to start child process. You need mocha: `npm install -g mocha`');
    }
  });
  mocha.stdout.pipe(process.stdout);
  mocha.stderr.pipe(process.stderr);
}
