const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const multer = require('multer');
const morgan = require('morgan');
const Joi = require('joi');
const onHeaders = require('on-headers');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

// ─── Authentication ───────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return next(ApiError.unauthorized('Authentication required. Please log in.'));

    const isBlacklisted = await cache.isTokenBlacklisted(token);
    if (isBlacklisted) return next(ApiError.unauthorized('Token has been invalidated. Please log in again.'));

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) return next(ApiError.unauthorized('User not found'));
    if (!user.isActive) return next(ApiError.forbidden('Account is deactivated'));
    if (user.isBanned) return next(ApiError.forbidden(`Account banned: ${user.banReason}`));
    if (user.changedPasswordAfter(decoded.iat)) {
      return next(ApiError.unauthorized('Password changed recently. Please log in again.'));
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(ApiError.unauthorized('Token expired.'));
    if (error.name === 'JsonWebTokenError') return next(ApiError.unauthorized('Invalid token'));
    next(error);
  }
};

// ─── Rate Limiters ────────────────────────────────────────────
const createRateLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs, max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooMany(message)),
    skip: (req) => req.user?.role === 'superadmin',
  });

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = createRateLimiter(
  5 * 60 * 1000,
  parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  'Too many login attempts, please try again after 5 minutes'
);

// ─── Validation (Joi) ─────────────────────────────────────────
const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(new ApiError(422, 'Validation failed', errors));
  }
  if (source === 'body') req.body = value;
  else if (source === 'query') req.query = value;
  else req.params = value;
  next();
};

const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .required()
      .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character' }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false),
  }),
};

// ─── HTTP Logger ──────────────────────────────────────────────
const httpLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: logger.stream }
);

// ─── Request Metadata ─────────────────────────────────────────
const addRequestMetadata = (req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// ─── Performance Timing ───────────────────────────────────────
const performanceTiming = (req, res, next) => {
  const start = process.hrtime.bigint();
  onHeaders(res, () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  next();
};

// ─── Error Handling ───────────────────────────────────────────
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  if (error.statusCode >= 500) {
    logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method}`);
  } else {
    logger.warn(`${error.statusCode} - ${error.message} - ${req.originalUrl}`);
  }

  if (err.name === 'CastError') error = ApiError.notFound(`Invalid ID: ${err.value}`);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`${field} already exists`);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    error = new ApiError(422, 'Validation failed', errors);
  }
  if (err.name === 'JsonWebTokenError') error = ApiError.unauthorized('Invalid token');
  if (err.name === 'TokenExpiredError') error = ApiError.unauthorized('Token expired');

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  authenticate,
  globalLimiter,
  authLimiter,
  validate,
  schemas,
  mongoSanitize,
  httpLogger,
  addRequestMetadata,
  performanceTiming,
  notFound,
  errorHandler,
};
