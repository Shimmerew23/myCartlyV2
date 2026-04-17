require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');

const connectDB = require('./config/db');
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression({ level: 6, threshold: 1024 }));
app.use(hpp());

// ── Rate limiting & Observability ─────────────────────────────
app.use('/api/', globalLimiter);
app.use(addRequestMetadata);
app.use(performanceTiming);
app.use(httpLogger);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/users', router);

app.get('/health', (_req, res) =>
  res.json({ status: 'healthy', service: 'user-service', timestamp: new Date().toISOString() })
);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();

    try {
      await connectCloudinary();
      logger.info('Cloudinary connected');
    } catch (err) {
      logger.warn(`Cloudinary unavailable: ${err.message}`);
    }

    const PORT = parseInt(process.env.PORT) || 3002;
    const server = app.listen(PORT, () => {
      logger.info(`user-service running on port ${PORT}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received — shutting down user-service`);
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
    logger.error(`Failed to start user-service: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;
