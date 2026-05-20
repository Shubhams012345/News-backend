/**
 * MongoDB connection configuration
 * Uses Mongoose to connect to the database defined in .env
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Exit process with failure - server cannot run without DB
    process.exit(1);
  }
};

module.exports = connectDB;
