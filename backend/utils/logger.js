const util = require('util');

// ANSI Color Codes
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  
  // Levels
  debug: '\x1b[35m', // Magenta
  info: '\x1b[36m',  // Cyan
  http: '\x1b[34m',  // Blue
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  
  // Statuses
  success: '\x1b[32m', // Green
  warning: '\x1b[33m', // Yellow
  danger: '\x1b[31m',  // Red
  gray: '\x1b[90m',
};

const LOG_LEVELS = {
  debug: 0,
  http: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const currentLogLevel = process.env.LOG_LEVEL 
  ? (LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] ?? LOG_LEVELS.info)
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.http : LOG_LEVELS.debug);

function getTimestamp() {
  const d = new Date();
  const pad = (n, s = 2) => String(n).padStart(s, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const ms = pad(d.getMilliseconds(), 3);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

function formatMeta(meta) {
  if (!meta) return '';
  if (meta instanceof Error) {
    return `\n${COLORS.error}${meta.stack || meta.message}${COLORS.reset}`;
  }
  if (typeof meta === 'object') {
    return ' ' + util.inspect(meta, { depth: 3, colors: true, compact: true });
  }
  return ' ' + String(meta);
}

function log(level, message, meta, tag) {
  if (LOG_LEVELS[level] < currentLogLevel) return;

  const timestamp = `${COLORS.gray}[${getTimestamp()}]${COLORS.reset}`;
  const levelBadge = `${COLORS[level]}${COLORS.bold}[${level.toUpperCase().padEnd(5)}]${COLORS.reset}`;
  const tagBadge = tag ? `${COLORS.dim}[${tag}]${COLORS.reset} ` : '';
  const metaStr = formatMeta(meta);

  const formattedMsg = `${timestamp} ${levelBadge} ${tagBadge}${message}${metaStr}`;

  if (level === 'error') {
    console.error(formattedMsg);
  } else if (level === 'warn') {
    console.warn(formattedMsg);
  } else {
    console.log(formattedMsg);
  }
}

const logger = {
  debug: (message, meta, tag) => log('debug', message, meta, tag),
  http: (message, meta, tag) => log('http', message, meta, tag),
  info: (message, meta, tag) => log('info', message, meta, tag),
  warn: (message, meta, tag) => log('warn', message, meta, tag),
  error: (message, meta, tag) => log('error', message, meta, tag),
};

module.exports = logger;
