const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const connectWithRetry = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
      logger.error(`MongoDB Connection Failed: ${err.message}`);
      logger.info('Retrying in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    }
  };

  connectWithRetry();

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  });
};

mongoose.set('strictQuery', true);

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = connectDB;