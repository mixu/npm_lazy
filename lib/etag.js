var ETag = {
  handle304: function(req, res, etag) {
    if (etag) {
      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304;
        res.end();
        return true;
      }
      res.setHeader('ETag', etag);
    }
  }
};

module.exports = ETag;
