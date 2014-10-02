var microee = require('microee');

function Lifecycle() {
  this.blocked = {};
}

microee.mixin(Lifecycle);

Lifecycle.prototype.block = function(resource) {
  // console.log('Blocking', resource);
  this.blocked[resource] = true;
};

Lifecycle.prototype.release = function(err, resource) {
  // console.log('Releasing', resource);
  if (this.isBlocking(resource)) {
    delete this.blocked[resource];
    // console.log('Released: '+resource+' - run callbacks');
    this.emit('resource', resource);
  }
};

Lifecycle.prototype.isBlocking = function(resource) {
  return this.blocked.hasOwnProperty(resource);
};

Lifecycle.prototype.onRelease = function(resource, callback) {
  // console.log('Blocked: '+resource+' - setting callback for release');
  this.when('resource', function(name) {
    var isMatch = (name == resource);
    if (isMatch) {
      callback();
    }
    return isMatch;
  });
};

module.exports = Lifecycle;
