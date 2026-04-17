const morgan = require('morgan');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const httpLogger = morgan(':method :url :status :res[content-length] - :response-time ms', { stream: logger.stream });

const notFound = (req, res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(`${statusCode} - ${err.message}`);
  else logger.warn(`${statusCode} - ${err.message}`);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { httpLogger, notFound, errorHandler };
