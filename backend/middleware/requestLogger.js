const logger = require('../utils/logger');

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

const requestLogger = (req, res, next) => {
  const start = process.hrtime();

  // Listen for response completion
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(1);
    const status = res.statusCode;
    const ip = getClientIp(req);
    const contentLength = res.getHeader('content-length');
    const sizeStr = formatBytes(contentLength ? parseInt(contentLength, 10) : 0);
    const userStr = req.user ? ` (User: ${req.user.username || req.user.email})` : '';

    const message = `${req.method.padEnd(6)} ${req.originalUrl || req.url} ${status} ${durationMs}ms - ${sizeStr} [IP: ${ip}]${userStr}`;

    if (status >= 500) {
      logger.error(message, null, 'HTTP');
    } else if (status >= 400) {
      logger.warn(message, null, 'HTTP');
    } else {
      logger.http(message, null, 'HTTP');
    }
  });

  next();
};

module.exports = requestLogger;
