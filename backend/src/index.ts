import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { registerAuthRoutes } from './routes/auth.js';
import { registerKeyRoutes } from './routes/keys.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerConversationRoutes } from './routes/conversations.js';
import { migrate, pool } from './db/client.js';

dotenv.config();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// Enhanced health endpoint: includes database connectivity check & basic metadata.
app.get('/health', async () => {
  let db: { status: string; latency_ms?: number; error?: string } = { status: 'unknown' };
  const started = performance.now();
  try {
    // Lightweight validation query; avoid full table scans.
    await pool.query('SELECT 1');
    db = { status: 'up', latency_ms: Math.round(performance.now() - started) };
  } catch (err: any) {
    db = { status: 'down', error: err?.message };
  }
  return {
    status: 'ok',
    time: new Date().toISOString(),
    db,
    uptime_s: process.uptime(),
    pid: process.pid,
    version: process.env.npm_package_version
  };
});

registerAuthRoutes(app);
registerKeyRoutes(app);
registerMessageRoutes(app);
registerSessionRoutes(app);
registerConversationRoutes(app);

// Attempt to bind to the requested port; if it's busy, try the next few ports.
async function start() {
  const basePort = Number(process.env.PORT || 3000);
  const maxAttempts = 10;
  // Run migrations before listening
  try {
    await migrate();
    app.log.info('Database migrated');
  } catch (err) {
    app.log.error({ err }, 'Migration failed');
  }
  for (let i = 0; i < maxAttempts; i++) {
    const tryPort = basePort + i;
    try {
      await app.listen({ port: tryPort, host: '0.0.0.0' });
      app.log.info(`Server running on :${tryPort}`);
      return;
    } catch (err: any) {
      if (err?.code === 'EADDRINUSE') {
        app.log.warn(`Port ${tryPort} in use, trying ${tryPort + 1}...`);
        continue;
      }
      app.log.error({ err }, 'Failed to start server');
      process.exit(1);
    }
  }
  app.log.error(`All ${maxAttempts} attempted ports starting at ${basePort} are in use.`);
  process.exit(1);
}

start();
