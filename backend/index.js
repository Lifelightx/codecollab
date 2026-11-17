require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

const initializeSocket = require('./socket/socketHandler');
const codespaceApiRoutes = require('./routes/codeSpaceApi');
const authRoutes = require('./routes/authApi');
const uploadRoutes = require('./routes/uploadApi');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// HTTP Request Logger
app.use(requestLogger);

const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: "*",
    credentials: true,
  }
});

// Connect to MongoDB with rich event logging
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/appdb';
logger.info('Connecting to MongoDB...', null, 'DB');

mongoose.connect(mongoUri)
  .then(() => {
    logger.info(`MongoDB connected successfully [Host: ${mongoose.connection.host}, DB: ${mongoose.connection.name}]`, null, 'DB');
  })
  .catch((err) => {
    logger.error(`MongoDB connection failed: ${err.message}`, err, 'DB');
  });

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected!', null, 'DB');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected!', null, 'DB');
});

// Initialize Socket.io logic
initializeSocket(io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/codespaces', codespaceApiRoutes(io));
app.use('/api/uploads', uploadRoutes);

// Public share: GET /s/:id → serve file by MongoDB _id (clean URL, no filename exposed)
const Upload = require('./models/Upload');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.get('/s/:id', async (req, res, next) => {
  try {
    const doc = await Upload.findById(req.params.id);
    if (!doc) {
      logger.warn(`Shared file not found in DB: ${req.params.id}`, null, 'SHARE');
      return res.status(404).send('Not found');
    }
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(filePath)) {
      logger.error(`Shared file missing on disk: ${filePath}`, null, 'SHARE');
      return res.status(404).send('File missing on disk');
    }
    logger.info(`Serving shared file: '${doc.originalName}' (${doc.size} bytes)`, null, 'SHARE');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName}"`);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// 404 Handler for undefined routes
app.use((req, res) => {
  logger.warn(`404 Route Not Found: ${req.method} ${req.originalUrl}`, null, 'ROUTER');
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use(errorHandler);

// Process-level crash prevention and diagnostics
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, err, 'FATAL');
});

process.on('unhandledRejection', (reason) => {
  logger.error(
    `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : reason}`,
    reason instanceof Error ? reason : null,
    'FATAL'
  );
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Gracefully terminating server...`, null, 'SERVER');
  server.close(() => {
    logger.info('HTTP & WebSocket server closed.', null, 'SERVER');
    mongoose.connection.close(false)
      .then(() => {
        logger.info('MongoDB connection closed cleanly.', null, 'SERVER');
        process.exit(0);
      })
      .catch(() => process.exit(0));
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`CodeCollab Server is running on port ${PORT} [Mode: ${process.env.NODE_ENV || 'development'}]`, null, 'SERVER');
});
