const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { sendAuditAlertEmail } = require('./mailer');

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'audit.log');

/**
 * Record an audit log entry to audit.log and send an email alert to self.
 *
 * @param {Object} options
 * @param {string} options.action - 'FILE_CREATED' | 'FILE_DELETED' | 'FILE_UPLOADED'
 * @param {Object|string} options.actor - User doc/object or string
 * @param {string} options.ip - Client IP address
 * @param {string} options.spaceName - Codespace name
 * @param {string} options.details - Human readable details (size, filename, path)
 */
function recordAuditEvent({ action, actor, ip, spaceName, details }) {
  const timestamp = new Date().toISOString();
  const actorName = actor?.username || actor?.name || (typeof actor === 'string' ? actor : 'Guest');
  const actorEmail = actor?.email || 'N/A';
  const actorRole = actor?.role || (actorName?.toLowerCase() === 'admin' ? 'admin' : (actor ? 'user' : 'guest'));
  const safeIp = ip || 'unknown';
  const safeSpace = (spaceName || 'unknown').toLowerCase();

  const logEntry = `[${timestamp}] [${action}] PerformedBy: ${actorName} (${actorEmail}) [Role: ${actorRole}] | IP: ${safeIp} | Space: ${safeSpace} | Details: ${details}\n`;

  // 1. Append to local audit.log file
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    logger.error(`Failed to write to audit.log: ${err.message}`, err, 'AUDIT');
  }

  // 2. Output to central logger
  logger.info(`[AUDIT] [${action}] ${actorName} | IP: ${safeIp} | Space: ${safeSpace} | ${details}`, null, 'AUDIT');

  // 3. Trigger email notification to self (non-blocking)
  sendAuditAlertEmail({
    action,
    actor: { username: actorName, email: actorEmail, role: actorRole },
    ip: safeIp,
    spaceName: safeSpace,
    details,
    timestamp,
  }).catch((err) => {
    logger.error(`Audit alert email dispatch error: ${err.message}`, err, 'AUDIT');
  });
}

/**
 * Extract real client IP from Express request, considering reverse proxies
 */
function getClientIp(req) {
  if (!req) return 'unknown';
  const xForwardedFor = req.headers ? req.headers['x-forwarded-for'] : null;
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return first;
  }
  return (
    req.headers?.['cf-connecting-ip'] ||
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

module.exports = {
  recordAuditEvent,
  getClientIp,
  AUDIT_LOG_FILE,
};
