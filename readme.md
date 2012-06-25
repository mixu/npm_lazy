# npm_lazy

A lazy local cache for npm

### Why?

- npm can be slow, down or return random errors if you have large deploys
- npm_lazy caches packages on your local network, making things faster and more predictable
- No database to install, replicate or manage. Data is stored under ./db/ as JSON and tar files.
- Lazy caching: When a package is requested the first time, it is cached locally. No explicit need to manage packages or replication.
- Metadata is expired periodically (default: 1 hour) so that the latest versions of packages are fetched.

## Installing

    git clone git://github.com/mixu/npm_push.git

Edit configuration in config.js (e.g. port and external URL) and start the server:

    node server.js

## Pointing npm to npm_lazy

To temporarily set the registry:

    npm --registry http://localhost:8080/ install socket.io

To permanently set the registry:

     npm config set registry http://localhost:8080/

## Caching logic

When a resource is requested:

- Anything that we don't have locally gets fetched from registry.npmjs.org on demand.
- Metadata is updated when the resource is requested the first time after a restart, and if the resource is requested an hour later (which is the max age for package metadata).

