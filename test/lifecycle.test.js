var http = require('http'),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter,

    Lifecycle = require('../lib/lifecycle.js');

var temp = null;

describe('given a lifecycle', function() {

  before(function(done) {
    this.cycle = new Lifecycle();
    done();
  });

  it('can block and release', function(done) {
    this.cycle.block('foo');
    assert.ok(this.cycle.isBlocking('foo'));
    this.cycle.release(null, 'foo');
    assert.ok(!this.cycle.isBlocking('foo'));
    done();
  });

  it('when blocking, can add a onrelease action', function(done) {
    var assertions = 0;
    this.cycle.block('foo');
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } });
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } });
    this.cycle.onRelease('foo', function() { assertions++; if (assertions == 3) { done(); } });
    this.cycle.release(null, 'foo');
  });

});
