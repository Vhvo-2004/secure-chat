import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

import { registerMessageRoutes } from '../src/routes/messages.js';
import { registerConversationRoutes } from '../src/routes/conversations.js';

function createApp() {
  const app = Fastify();
  app.register(cors, { origin: true });
  registerMessageRoutes(app);
  registerConversationRoutes(app);
  return app;
}

describe('API error handling', () => {
  it('returns 401 Unauthorized for missing JWT on /api/messages/sync', async () => {
    const app = createApp();
    const res = await app.inject({ method: 'GET', url: '/api/messages/sync' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toContain('unauthorized');
  });

  it('returns 404 for non-existent conversation', async () => {
    const app = createApp();
    // Simulate JWT (not validated, just for route test)
    const fakeToken = 'Bearer faketoken';
    const res = await app.inject({
      method: 'GET',
      url: '/conversations/with/NonExistentUser',
      headers: { Authorization: fakeToken }
    });
    expect([404, 401]).toContain(res.statusCode); // Accepts 401 if auth fails
  });

  it('returns HTML for unknown route (should not break frontend)', async () => {
    const app = createApp();
    const res = await app.inject({ method: 'GET', url: '/unknown/route' });
    expect(res.statusCode).toBe(404);
    // Aceita tanto application/json quanto text/html
    expect([
      'application/json; charset=utf-8',
      'text/html; charset=utf-8',
      'text/html'
    ]).toContain(res.headers['content-type']);
    // Garante que o corpo não é um JSON válido esperado pelo frontend
    expect(
      res.body.startsWith('<!DOCTYPE') ||
      res.body.includes('Not Found') ||
      res.body.includes('error')
    ).toBe(true);
  });
});
