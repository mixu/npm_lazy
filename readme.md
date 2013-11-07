# npm_lazy

A lazy local cache for npm

### Why?

- npm can be slow, down or return random errors if you have large deploys
- npm_lazy caches packages on your local network, making things faster and more predictable
- No database to install, replicate or manage. Data is stored under ./db/ as JSON and tar files.
- Lazy caching: When a package is requested the first time, it is cached locally. No explicit need to manage packages or replication.
- Metadata is expired periodically (default: 1 hour) so that the latest versions of packages are fetched.

## New in version 1.x

In response to the npm outage, I've made some improvements to npm_lazy. Previously, the primary use case was to prevent multiple servers in a large deploy from causing duplicate requests.

The new setup is adds better caching support.

- The caching logic now only discards the index when it has a newer version. Previously, we would discard the cached index file when it was too old. Now, the index is only discarded *after* a new version has been successfully fetched.
- Failing tarfiles are retried. Previously, when a tarfile failed to pass the checksum we would just throw and require a restart. Now, the same fetch is retried multiple times.

## Installation

    npm install npm_lazy

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

## Configuration

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

## Caching logic

When a resource is requested:

- Anything that we don't have locally gets fetched from registry.npmjs.org on demand.
- Metadata is updated when the resource is requested the first time after a restart, and if the resource is requested an hour later (which is the max age for package metadata).

