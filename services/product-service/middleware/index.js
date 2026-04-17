const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const multer = require('multer');
const sharp = require('sharp');
const morgan = require('morgan');
const onHeaders = require('on-headers');

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { uploadBuffer } = require('../config/cloudinary');
const logger = require('../utils/logger');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX) || 200,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Authentication ───────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
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

// ─── Optional Auth (public routes that benefit from user context) ─────────────
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token) return next();

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (user && user.isActive && !user.isBanned) req.user = user;
    next();
  } catch {
    next(); // Non-fatal — continue as unauthenticated
  }
};

// ─── RBAC ─────────────────────────────────────────────────────
const requireSeller = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!['seller', 'admin', 'superadmin'].includes(req.user.role)) {
    return next(ApiError.forbidden('Seller account required'));
  }
  if (req.user.role === 'seller' && !req.user.sellerProfile?.isApproved) {
    return next(ApiError.forbidden('Seller account pending approval'));
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!['admin', 'superadmin'].includes(req.user.role)) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

// ─── Rate Limiting ────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 30,
  message: { success: false, message: 'Upload limit reached' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── File Upload (Multer) ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, 'Only image files are allowed (JPEG, PNG, WebP, GIF)'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

const processImages = (options = {}) => async (req, res, next) => {
  if (!req.files && !req.file) return next();

  const { width = 800, height = 800, quality = 85, format = 'webp', folder = 'cartly/uploads' } = options;

  const processFile = async (file) => {
    const buffer = await sharp(file.buffer)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, { quality })
      .toBuffer();
    const { url, public_id } = await uploadBuffer(buffer, { folder, format });
    return { url, public_id, originalname: file.originalname };
  };

  try {
    if (req.files) {
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      req.processedImages = await Promise.all(files.map(processFile));
    } else if (req.file) {
      req.processedImage = await processFile(req.file);
    }
    next();
  } catch (err) {
    next(new ApiError(500, `Image processing failed: ${err.message}`));
  }
};

// ─── HTTP Logger & Metadata ───────────────────────────────────
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
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    res.setHeader('X-Response-Time', `${ms.toFixed(2)}ms`);
  });
  next();
};

// ─── Error Handling ───────────────────────────────────────────
const notFound = (req, res, next) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) logger.error(`${statusCode} - ${err.message}`);
  else logger.warn(`${statusCode} - ${err.message}`);

  if (err.name === 'CastError') err = ApiError.notFound(`Invalid ID: ${err.value}`);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err = ApiError.conflict(`${field} already exists`);
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    err = new ApiError(422, 'Validation failed', errors);
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || [],
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  globalLimiter, authenticate, optionalAuth, requireSeller, requireAdmin,
  uploadLimiter, upload, processImages, mongoSanitize,
  httpLogger, addRequestMetadata, performanceTiming, notFound, errorHandler,
};
