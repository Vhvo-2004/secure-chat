import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { bundles } from './keys.js';
import { pool } from '../db/client.js';
import { NotificationService } from '../services/NotificationService.js';

interface StoredOneTimePreKey { id: string; key: string; consumed?: boolean }
interface StoredKeyBundle {
  identityKey: string;
  signingPublicKey?: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: StoredOneTimePreKey[];
  publishedAt: number;
  unverified?: boolean;
}

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

export function registerSessionRoutes(app: FastifyInstance) {
  const notificationService = new NotificationService(pool);
  async function getUserId(username: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    return res.rowCount ? res.rows[0].id : null;
  }

  // Initiate a session (persisted)
  // Enhanced with comprehensive error handling and user validation (v1.3)
  app.post('/sessions/initiate', async (req, reply) => {
    try {
      const authUser = requireAuth(req, reply); if (!authUser) return;
      const { to, conversationId, initiatorIdentityKey, initiatorEphemeralKey } = (req.body as any) || {};
      if (!to) return reply.code(400).send({ error: 'missing_recipient' });
      if (!initiatorIdentityKey) return reply.code(400).send({ error: 'missing_field', field: 'initiatorIdentityKey' });
      if (!initiatorEphemeralKey) return reply.code(400).send({ error: 'missing_field', field: 'initiatorEphemeralKey' });
      if (to === authUser.username) return reply.code(400).send({ error: 'self_not_allowed' });

      // NEW v1.3: Check if target user exists before proceeding
      // This prevents unnecessary X3DH attempts and provides clear feedback
      const targetUserId = await getUserId(to);
      if (!targetUserId) {
        return reply.code(404).send({ error: 'recipient_not_found', message: `User '${to}' does not exist` });
      }

      // Se conversationId não for fornecido, crie uma nova conversa
      let convId = conversationId;
      if (!convId) {
        // Cria nova conversa entre os usuários
        const initiatorId = await getUserId(authUser.username);
        if (!initiatorId) return reply.code(400).send({ error: 'initiator_not_found' });
        
        const convIdGenerated = 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
        const newConvRes = await pool.query(
          `INSERT INTO conversations (id, user_a_id, user_b_id, enc_key, mac_key, last_activity)
           VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
          [convIdGenerated, initiatorId, targetUserId, Buffer.alloc(0), Buffer.alloc(0)]
        );
        convId = newConvRes.rows[0].id;
      }

      const bundle = bundles[to];
      if (!bundle) return reply.code(404).send({ error: 'recipient_no_bundle', message: `No key bundle found for user '${to}'` });

      const initiatorId = await getUserId(authUser.username);
      if (!initiatorId) return reply.code(400).send({ error: 'initiator_not_found' });

    // Atomically select and consume one OTPK from table
    let otpk: { id: string; key: string } | null = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `SELECT op.id, op.public_key FROM one_time_prekeys op
           JOIN users u ON op.user_id=u.id
          WHERE u.username=$1 AND op.consumed_at IS NULL
          ORDER BY op.created_at ASC
          LIMIT 1 FOR UPDATE SKIP LOCKED`, [to]
      );
      if (row.rowCount) {
        const chosen = row.rows[0];
        await client.query('UPDATE one_time_prekeys SET consumed_at=NOW() WHERE id=$1', [chosen.id]);
        otpk = { id: chosen.id, key: Buffer.from(chosen.public_key).toString('base64') };
      }
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const sessionId = 'sess_' + randomUUID();
    await pool.query(
      `INSERT INTO sessions (id, initiator_user_id, recipient_user_id, conversation_id, one_time_prekey_id, 
                            initiator_identity_key, initiator_ephemeral_key, finalized)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
      [sessionId, initiatorId, targetUserId, convId, otpk?.id || null, 
       Buffer.from(initiatorIdentityKey, 'base64'), Buffer.from(initiatorEphemeralKey, 'base64')]
    );

    // Notify the recipient that a new session was initiated
    await notificationService.notifySessionInitiated(to, sessionId, authUser.username);

    return {
      session: {
        id: sessionId,
        recipient: to,
        conversationId: convId,
        usedOneTimePreKeyId: otpk?.id,
        recipientBundle: {
          identityKey: bundle.identityKey,
          signedPreKey: bundle.signedPreKey,
          signedPreKeySignature: bundle.signedPreKeySignature,
          oneTimePreKey: otpk,
          signingPublicKey: bundle.signingPublicKey
        },
        note: 'Generate an ephemeral key locally and use initiatorDeriveSharedSecret with these values.'
      }
    };
    } catch (error) {
      console.error('Error in /sessions/initiate:', error);
      return reply.code(500).send({ error: 'internal_server_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Inspection (debug)
  app.get('/sessions/:id', async (req, reply) => {
    const sid = (req.params as any).id;
    const res = await pool.query(
      `SELECT s.id, ui.username AS initiator, ur.username AS recipient, s.conversation_id, s.one_time_prekey_id, s.finalized,
              s.initiator_identity_key, s.initiator_ephemeral_key, s.created_at, otk.public_key AS otk_public_key
         FROM sessions s
         JOIN users ui ON s.initiator_user_id=ui.id
         JOIN users ur ON s.recipient_user_id=ur.id
         LEFT JOIN one_time_prekeys otk ON s.one_time_prekey_id=otk.id
        WHERE s.id=$1`, [sid]
    );
    if (!res.rowCount) return reply.code(404).send({ error: 'not_found' });
    const row = res.rows[0];
    return {
      session: {
        id: row.id,
        initiator: row.initiator,
        recipient: row.recipient,
        conversationId: row.conversation_id,
        oneTimePreKeyId: row.one_time_prekey_id,
        oneTimePreKey: row.otk_public_key ? {
          id: row.one_time_prekey_id,
          key: Buffer.from(row.otk_public_key).toString('base64')
        } : undefined,
        finalized: row.finalized,
        initiatorIdentityKey: row.initiator_identity_key ? Buffer.from(row.initiator_identity_key).toString('base64') : undefined,
        initiatorEphemeralKey: row.initiator_ephemeral_key ? Buffer.from(row.initiator_ephemeral_key).toString('base64') : undefined,
        createdAt: row.created_at
      }
    };
  });

  // Finalize (initiator posts pub keys)
  app.post('/sessions/:id/finalize', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const sid = (req.params as any).id;
    const { initiatorIdentityKey, initiatorEphemeralKey } = (req.body as any) || {};
    if (!initiatorIdentityKey || !initiatorEphemeralKey) return reply.code(400).send({ error: 'missing_keys' });
    // Validate ownership
    const res = await pool.query(
      `SELECT s.id, ui.username AS initiator, ur.username AS recipient, s.finalized
         FROM sessions s
         JOIN users ui ON s.initiator_user_id=ui.id
         JOIN users ur ON s.recipient_user_id=ur.id
        WHERE s.id=$1`, [sid]
    );
    if (!res.rowCount) return reply.code(404).send({ error: 'not_found' });
    const row = res.rows[0];
    if (row.initiator !== authUser.username) return reply.code(403).send({ error: 'forbidden' });
    if (row.finalized) return reply.code(409).send({ error: 'already_finalized' });
    await pool.query(
      `UPDATE sessions SET initiator_identity_key=$1, initiator_ephemeral_key=$2, finalized=true WHERE id=$3`,
      [Buffer.from(initiatorIdentityKey, 'base64'), Buffer.from(initiatorEphemeralKey, 'base64'), sid]
    );
    
    // Session finalized - notify recipient immediately via push notification
    console.log(`Session ${sid} finalized for recipient: ${row.recipient}`);
    await notificationService.notifySessionFinalized(
      row.recipient,
      sid,
      authUser.username
    );
    
    return { ok: true };
  });

  // Recipient polling for initiator material
  app.get('/sessions/:id/initiator-material', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const sid = (req.params as any).id;
    const res = await pool.query(
      `SELECT s.id, s.one_time_prekey_id, s.finalized, s.initiator_identity_key, s.initiator_ephemeral_key,
              ui.username AS initiator, ur.username AS recipient
         FROM sessions s
         JOIN users ui ON s.initiator_user_id=ui.id
         JOIN users ur ON s.recipient_user_id=ur.id
        WHERE s.id=$1`, [sid]
    );
    if (!res.rowCount) return reply.code(404).send({ error: 'not_found' });
    const row = res.rows[0];
    if (row.recipient !== authUser.username) return reply.code(403).send({ error: 'forbidden' });
    if (!row.finalized || !row.initiator_identity_key || !row.initiator_ephemeral_key) {
      return reply.code(202).send({ status: 'pending' });
    }
    return {
      initiator: row.initiator,
      initiatorIdentityKey: Buffer.from(row.initiator_identity_key).toString('base64'),
      initiatorEphemeralKey: Buffer.from(row.initiator_ephemeral_key).toString('base64'),
      oneTimePreKeyId: row.one_time_prekey_id
    };
  });

  // Check for pending sessions where current user is recipient
  app.get('/sessions/pending/:fromUser', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const fromUser = (req.params as any).fromUser;
    
    const res = await pool.query(
      `SELECT s.id, s.one_time_prekey_id, s.initiator_identity_key, s.initiator_ephemeral_key,
              ui.username AS initiator, otk.public_key AS otk_public_key
         FROM sessions s
         JOIN users ui ON s.initiator_user_id=ui.id
         JOIN users ur ON s.recipient_user_id=ur.id
         LEFT JOIN one_time_prekeys otk ON s.one_time_prekey_id=otk.id
        WHERE ui.username=$1 AND ur.username=$2 AND s.finalized=false
        ORDER BY s.created_at DESC LIMIT 1`, [fromUser, authUser.username]
    );
    
    if (!res.rowCount) return reply.code(404).send({ error: 'no_pending_session' });
    
    const row = res.rows[0];
    return {
      sessionId: row.id,
      initiator: row.initiator,
      initiatorIdentityKey: row.initiator_identity_key ? Buffer.from(row.initiator_identity_key).toString('base64') : undefined,
      initiatorEphemeralKey: row.initiator_ephemeral_key ? Buffer.from(row.initiator_ephemeral_key).toString('base64') : undefined,
      oneTimePreKey: row.otk_public_key ? {
        id: row.one_time_prekey_id,
        key: Buffer.from(row.otk_public_key).toString('base64')
      } : undefined
    };
  });
}
