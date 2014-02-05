# npm_lazy

A lazy local cache for npm

### Why?

- npm can be slow, down or return random errors if you have large deploys
- npm_lazy caches packages on your local network, making things faster and more predictable
- If 100 servers request the same package metadata at the same time, npm_lazy makes sure that (at most) only one request goes out to the npm registry.
- No database to install, replicate or manage. Data is stored under ./db/ as JSON and tar files.
- Lazy caching: When a package is requested the first time, it is cached locally. No explicit need to manage packages or replication.
- Metadata is expired periodically (default: 1 hour) so that the latest versions of packages are fetched.

## New in version 1.4.x

Bug fixes and improvements:

- Fixed a bug with garbage collecting `package.json` files.
- Fixed a bug which occurred when the package file on the registry was updated by the author without bumping the version, resulting in a checksum mismatch between the cached tarfile and the metadata. Thanks @univerio!
- Added support for logging to file (`loggingOpts`). Thanks @Damiya!

## New in version 1.3.x

`npm search` and other non-installation related npm queries are now proxied to the registry.

Note that only package index metadata and package tarfiles are cached; all other endpoints are just a transparently proxied (e.g. you can always run `npm install` for cached packages but more exotic npm endpoints will not work if the registry is down; they will simply act like their non-npm_lazy equivalents).

Also, note that if you intend to write through npm_lazy you must set `cacheAge` to `0` so that npm metadata is always refreshed because npm wants to know that you have the most recent package `_id` before it allows writing. This will still return cached data for package.json indexes needed for installation if the registry is down, but only after attempting to contact the registry (this seems like a decent, but not perfect compromise).

## New in version 1.2.x

Reworked the behavior with regards to index files, where npm_lazy would return a 500 even though it had an package.json file in it's cache once the maxRetries were exhausted if the file was considered to be up to date. The new/fixed behavior is to always fall back to the cached file.

## New in version 1.x

In response to the npm outage, I've made some improvements to npm_lazy. Previously, the primary use case was to prevent multiple servers in a large deploy from causing duplicate requests.

The new version adds better caching support and resiliency to registry failures.

Here are all the ways in which npm_lazy is resilient to registry failures:

- All HTTP requests are retried.
- All HTTP requests are subject to a maximum fetch timeout (default: 5000 ms). If this fails, the request is retried (or failed).
- Invalid responses are rejected and retried:
  - Tarfiles are checked against the expected shasum, and cached forever if they match; if not, they are retried.
  - Metadata files must parse as JSON; if not, they are retried.
- Metadata files are never discarded until a newer version can be fetched successfully. If the JSON metadata is older than `cacheAge` (default: 1 hour), we will attempt to contact the registry first. However, if contacting the registry fails, then the old version of the metadata is sent instead. This means that even when outages occur, you can install any package that has been installed at least once before.

## Installation (updated in 1.1.x)

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
- Restarting npm_lazy will clear the package.json metadata refresh timeout and the max retries counter. All cached entries, including package.json files and tarfiles are kept, so you can safely restart the server to expire the metadata `cacheAge` while retaining all cached artifacts.
- npm_lazy works by rewriting the download URLs for package.json results, so old files from `npm shrinkwrap` may interfere with it since they may contain direct references to registry.npmjs.org. Make sure you clean up that stuff.
- If you are using self-signed certs, set `rejectUnauthorized` to false in the config.

### Resiliency to registry failures (new in 1.x!)

First, install a package successfully so that it is cached.

Next, to simulate a network failure, add `0.0.0.1 registry.npmjs.org` to `/etc/hosts` and try installing that same package again (in another folder). You should see something like this:

    npm_lazy at localhost port 8080
    npm_lazy cache directory: /home/m/.npm_lazy
    Fetch failed (1/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (2/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (3/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (4/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (5/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    [OK] Reusing cached result for http://registry.npmjs.org/socket.io

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
  //
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
  remoteUrl: 'https://registry.npmjs.org/',
  // bind port and host
  port: 8080,
  host: '0.0.0.0'
};

````

## Caching logic

When a resource is requested:

- Anything that we don't have locally gets fetched from registry.npmjs.org on demand.
- Metadata is updated when the resource is requested the first time after a restart, and if the resource is requested an hour later (which is the max age for package metadata).

