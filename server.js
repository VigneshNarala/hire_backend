require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

let server;

// Global handlers for unexpected errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION 💥 Shutting down...', err);
  process.exit(1);
});

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`🚀 Aditya AI-Resume API running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB', err.message);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION 💥 Shutting down...', err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on SIGTERM/SIGINT (Render/Heroku/Vercel)
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully...');
  if (server) {
    server.close(() => process.exit(0));
  }
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT RECEIVED. Shutting down gracefully...');
  if (server) {
    server.close(() => process.exit(0));
  }
});