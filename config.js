var path = require('path'),
    homePath = path.normalize(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);

module.exports = {
  // Cache config

  // Directory to store cached packages.
  // Since any relative path is resolved relative to the current working
  // directory when the server is started, you should use a full path.
  cacheDirectory: homePath + '/.npm_lazy',
  // maximum age before an index is refreshed from remoteUrl
  // negative value means no refresh
  cacheAge: 60 * 60 * 1000,

  // Request config

  // max milliseconds to wait for each HTTP response
  httpTimeout: 10000,
  // maximum number of retries per HTTP resource to get
  maxRetries: 5,
  // whether or not HTTPS requests are checked against Node's list of CAs
  // set false if you are using your own npm mirror with a self-signed SSL cert
  rejectUnauthorized: true,

  // Remote and local URL

  // external url to npm_lazy, no trailing /
  externalUrl: 'http://localhost:8080',
  // registry url with trailing /
  remoteUrl: 'http://registry.npmjs.org/',
  // bind port and host
  port: 8080,
  host: 'localhost'
};
