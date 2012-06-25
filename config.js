module.exports = {
  // directory to store cached packages (full path)
  cacheDirectory: __dirname+'/db/',
  // maximum age before an index is refreshed from npm
  cacheAge: 60 * 60 * 1000,
  // external url to npm_lazy, no trailing /
  externalUrl: 'http://localhost:8080',
  // bind port and host
  port: 8080,
  host: 'localhost'
};
