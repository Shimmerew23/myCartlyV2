require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const hpp = require('hpp');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const passport = require('./config/passport');
const logger = require('./utils/logger');

const {
  globalLimiter,
  authLimiter,
  mongoSanitize,
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
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(hpp());
app.use(mongoSanitize({ replaceWith: '_' }));

// ── Session & Passport ────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ── Rate limiting ─────────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api/', globalLimiter);

// ── Observability ─────────────────────────────────────────────
app.use(addRequestMetadata);
app.use(performanceTiming);
app.use(httpLogger);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', router);

app.get('/health', (_req, res) =>
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() })
);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    const PORT = parseInt(process.env.PORT) || 3001;
    const server = app.listen(PORT, () => {
      logger.info(`auth-service running on port ${PORT}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received — shutting down auth-service`);
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
    logger.error(`Failed to start auth-service: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;
