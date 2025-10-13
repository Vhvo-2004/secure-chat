import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db/client.js';

interface DbUser { id: string; username: string; password_hash: string }

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const body = req.body as any;
    const { username, password } = body || {};
    if (!username || !password) return reply.code(400).send({ error: 'missing' });
    const existing = await pool.query<DbUser>('SELECT id FROM users WHERE username=$1', [username]);
    if (existing.rowCount) return reply.code(409).send({ error: 'exists' });
    const id = 'u_' + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (id, username, password_hash) VALUES ($1,$2,$3)', [id, username, passwordHash]);
    return { id };
  });

  app.post('/auth/login', async (req, reply) => {
    const body = req.body as any;
    const { username, password } = body || {};
    const res = await pool.query<DbUser>('SELECT id, password_hash FROM users WHERE username=$1', [username]);
    if (!res.rowCount) return reply.code(401).send({ error: 'invalid' });
    const user = res.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return reply.code(401).send({ error: 'invalid' });
    const secret = process.env.JWT_SECRET || 'dev';
    const token = jwt.sign({ sub: user.id, username }, secret, { expiresIn: '1h' });
    return { token };
  });
}
