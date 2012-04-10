# npm-lazy: a lazy local cache for NPM

WIP!!!

Use case: you have a bunch of servers that pull in dependencies as part of your deploy script from NPM.

NPM is slow and can cause errors if you have many servers that access it at the same time.

This server caches the NPM packages locally for local deployment. In the future, it may also do package distribution (maybe not?).

## Lazy caching instead of replication

Setting up full replication with CouchDB is overkill if all you want is a to keep a few dozen packages cached locally.

npm-lazy caches metadata and package files, and only asks NPM about new versions if a long time (e.g. an hour) has passed. Since caching is lazy, you don't need to explicitly manage it. Just point npm on your deployment to the local npm-lazy server and it'll do the right thing and you'll have local copies of the npm packages.

## No database dependencies

Everything is stored in files: JSON text for metadata and tar files for the packages for minimal hassle.

## Resources are fetched locally

The response URLs for NPM packages are rewrittent on the fly so that npm will install them from npm-lazy.
