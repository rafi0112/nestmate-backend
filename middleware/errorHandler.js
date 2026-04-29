function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).send({
    message: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;