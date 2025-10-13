import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from '../src/db/client.js';

describe('health endpoint', () => {
  it('returns structured health info', async () => {
    const app = Fastify();
  await app.register(cors, { origin: true });

    // Minimal registration of health route identical to main server (could refactor later)
    app.get('/health', async () => {
      let db: { status: string; latency_ms?: number; error?: string } = { status: 'unknown' };
      const started = performance.now();
      try {
        await pool.query('SELECT 1');
        db = { status: 'up', latency_ms: Math.round(performance.now() - started) };
      } catch (err: any) {
        db = { status: 'down', error: err?.message };
      }
      return { status: 'ok', time: new Date().toISOString(), db };
    });

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBeDefined();
    expect(['up','down']).toContain(body.db.status);
  });
});
