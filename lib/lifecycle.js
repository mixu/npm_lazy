var util = require('util'),
    EventEmitter = require('events').EventEmitter;

function Lifecycle() {
  this.blocked = {};
}

util.inherits(Lifecycle, EventEmitter);

Lifecycle.prototype.block = function(resource) {
  // console.log('Blocking', resource);
  this.blocked[resource] = true;
};

Lifecycle.prototype.release = function(resource) {
  // console.log('Releasing', resource);
  if(this.isBlocking(resource)) {
    delete this.blocked[resource];
    // console.log('Released: '+resource+' - run callbacks');
    this.emit('resource');
  }
};

Lifecycle.prototype.isBlocking = function(resource) {
  return this.blocked.hasOwnProperty(resource);
};

Lifecycle.prototype.onRelease = function(resource, callback) {
  // console.log('Blocked: '+resource+' - setting callback for release');
  this.once('resource', callback);
};

module.exports = Lifecycle;
