const mongoose = require('mongoose');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

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

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected. Attempting to reconnect...'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
};

module.exports = connectDB;
