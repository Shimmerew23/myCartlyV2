const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = format;

const devFormat = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`
);

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports: [
    new transports.Console({
      format: combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss' }), devFormat),
    }),
    new transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      format: combine(json()),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join('logs', 'combined.log'),
      format: combine(json()),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

logger.stream = { write: (message) => logger.http(message.trim()) };

module.exports = logger;
