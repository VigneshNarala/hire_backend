const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static files for uploaded resumes (optional, for local testing)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/placement', require('./routes/placementRoutes'));

// Health check / root
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Aditya AI-Resume API is running...',
    env: process.env.NODE_ENV || 'development',
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.message);

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

module.exports = app;