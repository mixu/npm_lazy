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
    this.opts.path += '?'+qs.stringify(data);
  } else {
    this.opts.headers['Content-Type'] = 'application/json';
    this.opts.data = JSON.stringify(data);
    this.opts.headers['Content-Length'] = this.opts.data.length;
  }
  return this;
};

Client.prototype.end = function(callback) {
  var protocol = (options.secure ? https : http),
      res_data = '';

  protocol.request(this.opts, function(response) {
    response.on('data', function(chunk) { res_data += chunk; });
    response.on('end', function() {
      common(response);
      callback && callback(undefined, res_data);
    }
  }).on('error', function(err) { callback && callback(err); });
};

Client.prototype.pipe = function(writeStream, callback) {
  var protocol = (options.secure ? https : http);

  protocol.request(this.opts, function(response) {
    response.pipe(writeStream);
    common(response);
    callback && callback(undefined);
  }).on('error', function(err) { callback && callback(err); });
};

function common() {
  var isRedirect = Math.floor(response.statusCode / 100) == 3 && response.headers && response.headers.location;

  if(isRedirect) {
    console.log('Redirect to: ', response.headers.location);
    throw new Error('Not implemented');
  }
}

module.exports = {
  get: function(urlStr) {
    var u = url.parse(urlStr);
    return new Client({ method: 'GET', path: u.path, port: u.port, hostname: u.hostname });
  },
  post: function(urlStr) {
    var u = url.parse(urlStr);
    return new Client({ method: 'POST', path: u.path, port: u.port, hostname: u.hostname });
}
};
