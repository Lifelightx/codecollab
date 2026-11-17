const client = require('prom-client');

// Dedicated Prometheus registry
const register = new client.Registry();

// Enable collection of default runtime metrics (heap, cpu, event loop, handles)
client.collectDefaultMetrics({
  register,
  prefix: 'codecollab_',
  labels: { app: 'codecollab-backend' },
});

// 1. HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'codecollab_http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
});

// 2. HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: 'codecollab_http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // 5ms to 10s
});

// 3. WebSocket Active Connections Gauge
const websocketConnectedClients = new client.Gauge({
  name: 'codecollab_websocket_connected_clients',
  help: 'Current number of active WebSocket connections',
});

// 4. WebSocket Event Counter
const websocketEventsCounter = new client.Counter({
  name: 'codecollab_websocket_events_total',
  help: 'Total number of WebSocket events handled',
  labelNames: ['event'],
});

// 5. File Upload Counters
const uploadCountTotal = new client.Counter({
  name: 'codecollab_uploads_total',
  help: 'Total count of files uploaded to CodeCollab',
});

const uploadBytesTotal = new client.Counter({
  name: 'codecollab_upload_bytes_total',
  help: 'Total volume of file uploads in bytes',
});

// 6. Authentication Events Counter
const authEventsTotal = new client.Counter({
  name: 'codecollab_auth_events_total',
  help: 'Total count of authentication events (login, register, otp)',
  labelNames: ['action', 'status'],
});

// Register all custom metrics
register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDuration);
register.registerMetric(websocketConnectedClients);
register.registerMetric(websocketEventsCounter);
register.registerMetric(uploadCountTotal);
register.registerMetric(uploadBytesTotal);
register.registerMetric(authEventsTotal);

module.exports = {
  client,
  register,
  httpRequestCounter,
  httpRequestDuration,
  websocketConnectedClients,
  websocketEventsCounter,
  uploadCountTotal,
  uploadBytesTotal,
  authEventsTotal,
};
