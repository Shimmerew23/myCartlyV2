require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');

const { connectCloudinary } = require('./config/cloudinary');
const logger = require('./utils/logger');

const {
  globalLimiter,
  httpLogger,
  notFound,
  errorHandler,
  performanceTiming,
  addRequestMetadata,
} = require('./middleware/index');

const router = require('./routes/index');

const app = express();
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'https://mcartly.vercel.app',
        process.env.FRONTEND_URL,
      ].filter(Boolean);
      if (!origin || allowed.includes(origin) || origin.startsWith('http://192.168.')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Response-Time', 'X-Request-ID'],
  })
);

// ── Parsing ───────────────────────────────────────────────────
// NOTE: multer handles multipart/form-data — keep json limit small
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression({ level: 6, threshold: 1024 }));
app.use(hpp());

// ── Rate limiting & Observability ─────────────────────────────
app.use('/api/', globalLimiter);
app.use(addRequestMetadata);
app.use(performanceTiming);
app.use(httpLogger);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/upload', router);

app.get('/health', (_req, res) =>
  res.json({ status: 'healthy', service: 'upload-service', timestamp: new Date().toISOString() })
);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    try {
      await connectCloudinary();
      logger.info('Cloudinary connected');
    } catch (err) {
      // Upload service is useless without Cloudinary — treat as fatal
      logger.error(`Cloudinary connection failed: ${err.message}`);
      process.exit(1);
    }

    const PORT = parseInt(process.env.PORT) || 3010;
    const server = app.listen(PORT, () => {
      logger.info(`upload-service running on port ${PORT}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received — shutting down upload-service`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      gracefulShutdown('unhandledRejection');
    });
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      gracefulShutdown('uncaughtException');
    });

    return server;
  } catch (error) {
    logger.error(`Failed to start upload-service: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;
