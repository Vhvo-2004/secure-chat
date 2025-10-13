import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';

function requireAuth(req: any, reply: any): { username: string } | undefined {
  const auth = (req.headers['authorization'] || '').split(' ')[1];
  if (!auth) { reply.code(401).send({ error: 'unauthorized' }); return; }
  const secret = process.env.JWT_SECRET || 'dev';
  try {
    const decoded: any = jwt.verify(auth, secret);
    return { username: decoded.username };
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
    return;
  }
}

async function getUserId(username: string): Promise<string | null> {
  const res = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
  return res.rowCount ? res.rows[0].id : null;
}

// For X3DH-based conversations, the server SHOULD NOT generate symmetric keys.
// We keep enc_key/mac_key columns as empty bytea placeholders for backward compatibility.

export function registerConversationRoutes(app: FastifyInstance) {
  // List all conversations for the authenticated user
  app.get('/conversations', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const userId = await getUserId(authUser.username);
    if (!userId) return reply.code(404).send({ error: 'user_not_found' });
    
    const res = await pool.query(`
      SELECT c.id, c.created_at,
             CASE 
               WHEN c.user_a_id = $1 THEN ub.username
               ELSE ua.username
             END as other_user
      FROM conversations c
      JOIN users ua ON c.user_a_id = ua.id
      JOIN users ub ON c.user_b_id = ub.id
      WHERE c.user_a_id = $1 OR c.user_b_id = $1
      ORDER BY c.created_at DESC
    `, [userId]);
    
    return { conversations: res.rows };
  });

  // Start or fetch existing conversation; generate symmetric key if new
  app.post('/conversations/start', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const { withUser } = (req.body as any) || {};
    if (!withUser || withUser === authUser.username) return reply.code(400).send({ error: 'invalid_user' });
    const a = await getUserId(authUser.username);
    const b = await getUserId(withUser);
    if (!a || !b) return reply.code(404).send({ error: 'user_not_found' });

    // Ensure canonical pair ordering for uniqueness
    const [u1, u2] = a < b ? [a,b] : [b,a];
    const existing = await pool.query('SELECT id FROM conversations WHERE (user_a_id=$1 AND user_b_id=$2)', [u1,u2]);
    if (existing.rowCount) {
      return reply.send({ id: existing.rows[0].id });
    }
    const id = 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    // Insert empty bytea for enc_key/mac_key to satisfy NOT NULL while signaling "no server-stored key"
    await pool.query('INSERT INTO conversations (id, user_a_id, user_b_id, enc_key, mac_key) VALUES ($1,$2,$3,$4,$5)', [id, u1, u2, Buffer.alloc(0), Buffer.alloc(0)]);
    return { id };
  });

  // Get conversation list with a given user
  app.get('/conversations/with/:username', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const other = (req.params as any).username;
    const me = await getUserId(authUser.username);
    const you = await getUserId(other);
    if (!me || !you) return reply.code(404).send({ error: 'user_not_found' });
    const [u1, u2] = me < you ? [me,you] : [you,me];
    const res = await pool.query('SELECT id FROM conversations WHERE user_a_id=$1 AND user_b_id=$2', [u1,u2]);
    if (!res.rowCount) return reply.code(404).send({ error: 'not_found' });
    return { id: res.rows[0].id };
  });
}
