var Cache = require('./cache.js'),
    Api = require('./api.js');

module.exports = {
  Cache: Cache,

  configure: function(config) {
    Cache.configure(config);
    Api.configure(config);
  }
};
