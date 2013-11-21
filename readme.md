# npm_lazy

A lazy local cache for npm

### Why?

- npm can be slow, down or return random errors if you have large deploys
- npm_lazy caches packages on your local network, making things faster and more predictable
- If 100 servers request the same package metadata at the same time, npm_lazy makes sure that (at most) only one request goes out to the npm registry.
- No database to install, replicate or manage. Data is stored under ./db/ as JSON and tar files.
- Lazy caching: When a package is requested the first time, it is cached locally. No explicit need to manage packages or replication.
- Metadata is expired periodically (default: 1 hour) so that the latest versions of packages are fetched.

## New in version 1.x

In response to the npm outage, I've made some improvements to npm_lazy. Previously, the primary use case was to prevent multiple servers in a large deploy from causing duplicate requests.

The new version adds better caching support and resiliency to registry failures.

Here are all the ways in which npm_lazy is resilient to registry failures:

- All HTTP requests are retried up to a configurable number (default: 5 times).
- All HTTP requests are subject to a maximum fetch timeout (default: 5000 ms). If this fails, the request is retried (or failed).
- Invalid responses are rejected and retried:
  - Tarfiles are checked against the expected shasum, and cached forever if they match; if not, they are retried.
  - Metadata files must parse as JSON; if not, they are retried.
- Metadata files are never discarded until a newer version can be fetched successfully. If the JSON metadata is older than `cacheAge` (default: 1 hour), we will attempt to contact the registry first. However, if contacting the registry fails, then the old version of the metadata is sent instead. This means that even when outages occur, you can install any package that has been installed at least once before.

## Installation

    npm install npm_lazy

Or: `git clone git@github.com:mixu/npm_lazy.git && cd npm_lazy && npm install`.

Edit configuration in config.js (e.g. port and external URL) and start the server:

    node server.js

## Pointing npm to npm_lazy

To temporarily set the registry:

    npm --registry http://localhost:8080/ install socket.io

To permanently set the registry via command line:

     npm config set registry http://localhost:8080/

To permanently set the registry via config file, in ~/.npmrc:

    registry = http://localhost:8080/

For more info, see "npm help config" and "npm help registry".

### Resiliency to registry failures (new in 1.x!)

First, install a package successfully so that it is cached.

Next, to simulate a network failure, add `0.0.0.1 registry.npmjs.org` to `/etc/hosts` and try installing that same package again (in another folder). You should see something like this:

    npm_lazy at localhost port 8080
    Fetch failed (1/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (2/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (3/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (4/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    Fetch failed (5/5): http://registry.npmjs.org/socket.io { [Error: connect EINVAL] code: 'EINVAL', errno: 'EINVAL', syscall: 'connect' }
    [OK] Reusing cached result for http://registry.npmjs.org/socket.io

## Configuration

Configured by editing `config.js` in the same directory:

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

## Caching logic

When a resource is requested:

- Anything that we don't have locally gets fetched from registry.npmjs.org on demand.
- Metadata is updated when the resource is requested the first time after a restart, and if the resource is requested an hour later (which is the max age for package metadata).

