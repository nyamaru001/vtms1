function notFound(req, res) {
  res.status(404).json({ message: 'Resource not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      message: 'Validation failed.',
      details: err.errors ? err.errors.map((e) => e.message) : undefined,
    });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on our end. Please try again.' : err.message;
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
