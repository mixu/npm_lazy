module.exports = {
  // Cache config

  // directory to store cached packages (full path)
  cacheDirectory: __dirname+'/db/',
  // maximum age before an index is refreshed from npm
  cacheAge: 60 * 60 * 1000,

  // Request config

  // max milliseconds to wait for each HTTP response
  httpTimeout: 5000,
  // maximum number of retries per HTTP resource to get
  maxRetries: 5,

  // Remote and local URL

  // external url to npm_lazy, no trailing /
  externalUrl: 'http://localhost:8080',
  // registry url with trailing /
  remoteUrl: 'http://registry.npmjs.org/',
  // bind port and host
  port: 8080,
  host: 'localhost'
};
