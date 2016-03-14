## New in version 1.4.x

Bug fixes and improvements:

- Fixed a bug with garbage collecting `package.json` files.
- Fixed a bug which occurred when the package file on the registry was updated by the author without bumping the version, resulting in a checksum mismatch between the cached tarfile and the metadata. Thanks @univerio!
- Added support for logging to file (`loggingOpts`). Thanks @Damiya!

## New in version 1.3.x

`npm search` and other non-installation related npm queries are now proxied to the registry.

## New in version 1.2.x

Reworked the behavior with regards to index files, where npm_lazy would return a 500 even though it had an package.json file in it's cache once the maxRetries were exhausted if the file was considered to be up to date. The new/fixed behavior is to always fall back to the cached file.

## New in version 1.x

In response to the npm outage, I've made some improvements to npm_lazy. Previously, the primary use case was to prevent multiple servers in a large deploy from causing duplicate requests.

The new version adds better caching support and resiliency to registry failures.
