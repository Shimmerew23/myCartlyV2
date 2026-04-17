const multer = require('multer');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const onHeaders = require('on-headers');

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// JWT authentication for upload requests
const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
    else if (req.cookies?.accessToken) token = req.cookies.accessToken;
    if (!token) return next(ApiError.unauthorized('Authentication required.'));

    const decoded = verifyAccessToken(token);
    req.user = { _id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(ApiError.unauthorized('Token expired.'));
    if (error.name === 'JsonWebTokenError') return next(ApiError.unauthorized('Invalid token'));
    next(error);
  }
};

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 30,
  message: { success: false, message: 'Upload limit reached' },
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, 'Only image files are allowed'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const httpLogger = morgan(':method :url :status :res[content-length] - :response-time ms', { stream: logger.stream });

const addRequestMetadata = (req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  req.clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

const performanceTiming = (req, res, next) => {
  const start = process.hrtime.bigint();
  onHeaders(res, () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
  });
  next();
};

const notFound = (req, res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(`${statusCode} - ${err.message}`);
  else logger.warn(`${statusCode} - ${err.message}`);
  if (err.code === 'LIMIT_FILE_SIZE') err = new ApiError(400, 'File too large (max 10MB)');
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { authenticate, globalLimiter, uploadLimiter, upload, httpLogger, addRequestMetadata, performanceTiming, notFound, errorHandler };
