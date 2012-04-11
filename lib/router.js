var url = require('url'),
    time = require('./time.js');

function Router() {
  this.routes = [];
};

// Route an incoming request
Router.prototype.route = function(req, res) {
  var pathname = url.parse(req.url).pathname,
      match = false;

  console.log(time() + 'Routing '+req.method+' '+req.url);

  this.routes.some(function(item) {
    if(item.method == req.method && item.re.test(pathname)) {
      match = item;
      return true;
    }
    return false;
  });

  if(!match) { return false; }

  if(req.method == 'POST') {
    var data = '';
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function() {
      match.callback.apply(undefined, [req, res, match.re.exec(pathname), data ]);
    });
  } else {
    match.callback.apply(undefined, [req, res, match.re.exec(pathname) ]);
  }
  return true;
};

Router.prototype.get = function(regexp, callback) {
  this.routes.push({ method: 'GET', re: regexp, callback: callback });
};

Router.prototype.post = function(regexp, callback) {
  this.routes.push({ method: 'POST', re: regexp, callback: callback });
};

module.exports = Router;
