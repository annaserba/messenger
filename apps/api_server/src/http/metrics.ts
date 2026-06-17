import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

export const wsConnections = new client.Gauge({
  name: 'ws_connections',
  help: 'Current WebSocket connections',
  registers: [register],
});

export const messagesSent = new client.Counter({
  name: 'messages_sent_total',
  help: 'Total messages sent',
  registers: [register],
});

export async function metricsHandler(): Promise<string> {
  return register.metrics();
}
