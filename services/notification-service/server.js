require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const hpp = require('hpp');

const logger = require('./utils/logger');

const { httpLogger, notFound, errorHandler } = require('./middleware/index');

const router = require('./routes/index');

const app = express();
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
// Notification service is internal-only (no browser clients) — minimal helmet
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Only allow calls from internal services (same Docker network) and local dev
app.use(
  cors({
    origin: (origin, callback) => {
      // Internal service-to-service calls have no origin, or come from localhost
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.')) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: false,
  })
);

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(hpp());

// ── Observability ─────────────────────────────────────────────
app.use(httpLogger);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/notifications', router);

app.get('/health', (_req, res) =>
  res.json({ status: 'healthy', service: 'notification-service', timestamp: new Date().toISOString() })
);

// ── Error handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Verify SMTP config on startup
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    try {
      await transporter.verify();
      logger.info('SMTP connection verified');
    } catch (err) {
      logger.warn(`SMTP verification failed: ${err.message} — emails may not send`);
    }

    const PORT = parseInt(process.env.PORT) || 3009;
    const server = app.listen(PORT, () => {
      logger.info(`notification-service running on port ${PORT}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received — shutting down notification-service`);
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
    logger.error(`Failed to start notification-service: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;
