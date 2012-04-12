function Lifecycle() {
  this.blocked = {};
}

Lifecycle.prototype.block = function(resource) {
  console.log('Blocking', resource);
  this.blocked[resource] = [];
};

Lifecycle.prototype.release = function(resource) {
  console.log('Releasing', resource);
  if(this.isBlocking(resource)) {
    var callbacks = this.blocked[resource];
    delete this.blocked[resource];
    callbacks.forEach(function(callback) {
      console.log('Released: '+resource+' - run callback');
      callback();
    });
  }
};

Lifecycle.prototype.isBlocking = function(resource) {
  return this.blocked.hasOwnProperty(resource);
};

Lifecycle.prototype.onRelease = function(resource, callback) {
  if(!this.isBlocking(resource)) {
    return callback();
  }
  console.log('Blocked: '+resource+' - setting callback for release');
  this.blocked[resource].push(callback);
};

module.exports = Lifecycle;
