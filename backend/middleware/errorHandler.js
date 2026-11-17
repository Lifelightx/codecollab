const logger = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
  const statusCode = res.statusCode && res.statusCode >= 400 ? res.statusCode : 500;
  
  logger.error(
    `Unhandled error on ${req.method} ${req.originalUrl || req.url}: ${err.message}`,
    err,
    'EXPRESS'
  );

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};

module.exports = errorHandler;
