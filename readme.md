# npm_lazy

A lazy local cache for npm

### Why?

- npm can be slow, down or return random errors if you have large deploys
- npm_lazy caches packages on your local network, making things faster and more predictable
- If 100 servers request the same package metadata at the same time, npm_lazy makes sure that (at most) only one request goes out to the npm registry.
- No database to install, replicate or manage. Data is stored under ./db/ as JSON and tar files.
- Lazy caching: When a package is requested the first time, it is cached locally. No explicit need to manage packages or replication.
- Metadata is expired periodically (default: 1 hour) so that the latest versions of packages are fetched.

Here are all the ways in which npm_lazy is resilient to registry failures:

- All HTTP requests are retried.
- All HTTP requests are subject to a maximum fetch timeout (default: 5000 ms). If this fails, the request is retried (or failed).
- Invalid responses are rejected and retried:
  - Tarfiles are checked against the expected shasum, and cached forever if they match; if not, they are retried.
  - Metadata files must parse as JSON; if not, they are retried.
- Metadata files are never discarded until a newer version can be fetched successfully. If the JSON metadata is older than `cacheAge` (default: 1 hour), we will attempt to contact the registry first. However, if contacting the registry fails, then the old version of the metadata is sent instead. This means that even when outages occur, you can install any package that has been installed at least once before.

## New in version 1.8.x

- Better handling of npm private modules (#52, thanks @CL0SeY)

## New in version 1.7.x

- introducing @CL0SeY as a co-maintainer / core contributor, and a solid set of improvements to the error handling in npm_lazy.
- improved remote error handling (404's, 500's) for resources that are not in the cache (thanks @CL0SeY)
  - 404's for are returned immediately (previously, npm_lazy returned a generic 500 error for 404's).
  - for other errors are requests retried `maxRetries` times. The error response content and error status code are also now returned up from the registry to the npm_lazy clients.

## New in version 1.6.x

- improved etags handling (thanks @CL0SeY)
- use mikeal/request to improve compatibility with Windows-world proxies (thanks @garytaylor)
- fixed an error where hashing a package would incorrectly report a failure (thanks @kleini)
- fixed tests (thanks @CL0SeY) and converted tests to use Mocha BDD style
- 302 support (thanks @guig)
- fixed a broken reference (thanks @kwizzn)

## New in version 1.5.x

Added support for using a http proxy (note: not a [Socks5](http://en.wikipedia.org/wiki/SOCKS) proxy). This can be configured either via the config file or via the `http_proxy` environment variable, see the config at the end for an example. Thanks @migounette! As I am not using a proxy myself, please report any issues via GH (pull requests welcome!).

Note: if you already have a proxy for npm, make sure you don't run into an issue where npm uses the proxy when accessing npm_lazy. You don't want to have `npm install -> proxy -> npm_lazy -> proxy`, but rather `npm install -> npm_lazy -> proxy` since your proxy probably doesn't know how to connect to npm_lazy. You will need to disable npm's internal proxy config, [see this comment for the details](https://github.com/mixu/npm_lazy/issues/30#issuecomment-39546977).

## New in version 1.4.x

Bug fixes and improvements:

- Fixed a bug with garbage collecting `package.json` files.
- Fixed a bug which occurred when the package file on the registry was updated by the author without bumping the version, resulting in a checksum mismatch between the cached tarfile and the metadata. Thanks @univerio!
- Added support for logging to file (`loggingOpts`). Thanks @Damiya!

Check out the [changelog](changelog.md) for version history.

## Installation

_Requires node >= 0.10.x_

v1.1.x adds a command called `npm_lazy` to make things even easier. Install via npm:

    sudo npm install -g npm_lazy

To start the server, run:

    npm_lazy

To edit the configuration, start by initializing a file from the default config file:

    npm_lazy --init > ~/npm_lazy.config.js

To start the server with a custom configuration:

    npm_lazy --config ~/npm_lazy.config.js

## Installation by cloning the repo

Or alternatively, if you don't want to install this globally, you can just clone the repo: `git clone git@github.com:mixu/npm_lazy.git && cd npm_lazy && npm install` and edit `config.js`.

## Pointing npm to npm_lazy

To temporarily set the registry:

    npm --registry http://localhost:8080/ install socket.io

To permanently set the registry via command line:

     npm config set registry http://localhost:8080/

To permanently set the registry via config file, in ~/.npmrc:

    registry = http://localhost:8080/

For more info, see "npm help config" and "npm help registry".

### Tips and tricks:

A few things that might be useful to know:

- Start by running `npm cache clean` so that your local npm command will request every package you want at least once from npm_lazy.
- Starting with v1.2.0, npm_lazy will only return a 500 error if it does not have specific file.
- To clear out the npm_lazy cache, simply remove the cache directory and restart npm_lazy. npm_lazy prints out the cache location when it starts, and it defaults to `~/.npm_lazy`.
- Note that only package index metadata and package tarfiles are cached; all other endpoints are just a transparently proxied (e.g. you can always run `npm install` for cached packages but more exotic npm endpoints will not work if the registry is down; they will simply act like their non-npm_lazy equivalents).
- Also, note that if you intend to write through npm_lazy you must set `cacheAge` to `0` so that npm metadata is always refreshed because npm wants to know that you have the most recent package `_id` before it allows writing. This will still return cached data for package.json indexes needed for installation if the registry is down, but only after attempting to contact the registry (this seems like a decent, but not perfect compromise).
- Restarting npm_lazy will clear the package.json metadata refresh timeout and the max retries counter. All cached entries, including package.json files and tarfiles are kept, so you can safely restart the server to expire the metadata `cacheAge` while retaining all cached artifacts.
- npm_lazy works by rewriting the download URLs for package.json results, so old files from `npm shrinkwrap` may interfere with it since they may contain direct references to registry.npmjs.com. Make sure you clean up that stuff.
- If you are using self-signed certs, set `rejectUnauthorized` to false in the config.

### Resiliency to registry failures

First, install a package successfully so that it is cached.

Next, to simulate a network failure, add `0.0.0.1 registry.npmjs.com` to `/etc/hosts` and try installing that same package again (in another folder). You should see something like this:

    npm_lazy at localhost port 8080
    npm_lazy cache directory: /home/m/.npm_lazy
    Fetch failed (1/5): http://registry.npmjs.com/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (2/5): http://registry.npmjs.com/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (3/5): http://registry.npmjs.com/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (4/5): http://registry.npmjs.com/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (5/5): http://registry.npmjs.com/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    [OK] Reusing cached result for http://registry.npmjs.com/socket.io

## Configuration

Configured by editing `config.js` in the same directory:

````js
var path = require('path'),
    homePath = path.normalize(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);

module.exports = {
  // Logging config
  loggingOpts: {
    // Print to stdout with colors
    logToConsole: true,
    // Write to file
    logToFile: false,

    // This should be a file path.
    filename: homePath + '/npm_lazy.log'
  },

  // Cache config

  // `cacheDirectory`: Directory to store cached packages.
  //
  // Note: Since any relative path is resolved relative to the current working
  // directory when the server is started, you should use a full path.

  cacheDirectory: homePath + '/.npm_lazy',

  // `cacheAge`: maximum age before an index is refreshed from remoteUrl
  // - negative value means no refresh (e.g. once cached, never update the package.json metadata)
  // - zero means always refresh (e.g. always ask the registry for metadata)
  // - positive value means refresh every n milliseconds
  //   (e.g. 60 * 60 * 1000 = expire metadata every 60 minutes)
  //
  // Note: if you want to use `npm star` and other methods which update
  // npm metadata, you will need to set cacheAge to 0. npm generally wants the latest
  // package metadata version so caching package metadata will interfere with it.

  // Recommended setting: 0
  cacheAge: 0,

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
  remoteUrl: 'https://registry.npmjs.com/',
  // bind port and host
  port: 8080,
  host: '0.0.0.0',

  // Proxy config
  // You can also configure this using the http_proxy and https_proxy environment variables
  // cf. https://wiki.archlinux.org/index.php/proxy_settings
  proxy: {
    // http: 'http://1.2.3.4:80/',
    // https: 'http://4.3.2.1:80/'
  }
};
````

## Caching logic

When a resource is requested:

- Anything that we don't have locally gets fetched from registry.npmjs.com on demand.
- Metadata is updated when the resource is requested the first time after a restart, and if the resource is requested later than the max age set in configuration (which is currently set to 0. Set the max age for package metadata in the config.js file to override this).

