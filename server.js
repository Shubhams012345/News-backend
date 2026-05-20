/**
 * Main Server Entry Point
 * Context-Aware Personalized News Recommendation System
 *
 * Stack: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

// CORS - allow React frontend (adjust origin in production)
app.use(cors());

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'News Recommendation API is running',
    project:
      'Context-Aware Personalized News Recommendation System Using Deep Learning',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Error handling (must be after routes)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
console.log("NEW SERVER FILE RUNNING");
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
