const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const onHeaders = require('on-headers');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
    else if (req.cookies?.accessToken) token = req.cookies.accessToken;
    if (!token) return next(ApiError.unauthorized('Authentication required.'));
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) return next(ApiError.unauthorized('User not found'));
    if (!user.isActive) return next(ApiError.forbidden('Account is deactivated'));
    if (user.isBanned) return next(ApiError.forbidden(`Account banned: ${user.banReason}`));
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(ApiError.unauthorized('Token expired.'));
    if (error.name === 'JsonWebTokenError') return next(ApiError.unauthorized('Invalid token'));
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

const requireWarehouse = (req, res, next) => {
  if (!req.user || !['warehouse', 'admin', 'superadmin'].includes(req.user.role)) {
    return next(ApiError.forbidden('Warehouse access required'));
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return next(ApiError.forbidden('Superadmin access required'));
  }
  next();
};

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true, legacyHeaders: false,
});

const performanceTiming = (req, res, next) => {
  const start = process.hrtime.bigint();
  onHeaders(res, () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  next();
};

const httpLogger = morgan(':method :url :status :res[content-length] - :response-time ms', { stream: logger.stream });

const addRequestMetadata = (req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

const notFound = (req, res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(`${statusCode} - ${err.message}`);
  else logger.warn(`${statusCode} - ${err.message}`);
  if (err.name === 'CastError') err = ApiError.notFound(`Invalid ID: ${err.value}`);
  if (err.code === 11000) err = ApiError.conflict(`${Object.keys(err.keyValue)[0]} already exists`);
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    err = new ApiError(422, 'Validation failed', errors);
  }
  res.status(err.statusCode || 500).json({
    success: false, message: err.message || 'Internal Server Error',
    errors: err.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  authenticate, requireAdmin, requireWarehouse, requireSuperAdmin, globalLimiter,
  mongoSanitize, httpLogger, performanceTiming, addRequestMetadata, notFound, errorHandler,
};
