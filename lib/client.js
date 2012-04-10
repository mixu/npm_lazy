var https = require('https'),
    http = require('http'),
    qs = require('querystring'),
    url = require('url');

function Client(opts) {
  this.opts = opts || {};
  this.opts.headers || (this.opts.headers = {});
};

Client.prototype.header = function(key, value) {
  this.opts.headers[key] = value;
  return this;
};

Client.prototype.data = function(data) {
  if(this.opts.method == 'GET') {
    // append to QS
    this.opts.path += '?'+qs.stringify(data);
  } else {
    // JSON encoding
    this.opts.headers['Content-Type'] = 'application/json';
    this.opts.data = JSON.stringify(data);
    this.opts.headers['Content-Length'] = this.opts.data.length;
  }
  return this;
};

Client.prototype.end = function(callback) {
  request(this.opts, callback);
};

function request(options, callback) {
  var res_data = '',
      protocol = (options.secure ? https : http),
      proxy;

  proxy = protocol.request(options, function(response) {
    response.on('data', function(chunk) { res_data += chunk; });
    response.on('end', function() {
      var isRedirect = Math.floor(response.statusCode / 100) == 3 && response.headers && response.headers.location;

      if(isRedirect) {
        console.log('Redirect to: ', response.headers.location);
        throw new Error('Not implemented');
      }

      if(response.headers['content-type'] && response.headers['content-type'].toLowerCase().indexOf('application/json') > -1 ) {
        try {
          res_data = JSON.parse(res_data);
        } catch(jsonParseError) {
          return callback(jsonParseError, res_data);
        }
      }

      callback && callback(undefined, res_data);
    });
  }).on('error', function(err) { callback(err, res_data); });

  if (options.data && options.method != 'GET') {
    proxy.write(options.data);
  }

  proxy.end();
}

module.exports = {
  get: function(urlStr) {
    var u = url.parse(urlStr);
    return new Client({ method: 'GET', path: u.path, port: u.port, host: u.host });
  },
  post: function(urlStr) {
    var u = url.parse(urlStr);
    return new Client({ method: 'POST', path: u.path, port: u.port, host: u.host });
}
};
