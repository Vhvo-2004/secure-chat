import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import { verifySignedPreKey } from '@chat-e2e/crypto';

// Bundle stored as base64 strings for transport
interface InMemoryBundle {
  identityKey: string;
  signingPublicKey?: string;
  signedPreKey: string;
  signedPreKeySignature: string;
  publishedAt: number;
  unverified?: boolean;
}

export const bundles: Record<string, InMemoryBundle> = {}; // in-memory cache (OTPks now in table)

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

export function registerKeyRoutes(app: FastifyInstance) {
  // Publisher posts their full bundle (identity, signed prekey, signature, list of OTPKs)
  app.post('/keys/publish', async (req, reply) => {
    const authUser = requireAuth(req, reply);
    if (!authUser) return; // response already sent
    const body = req.body as any;
    const { bundle } = body || {};
    if (!bundle) return reply.code(400).send({ error: 'missing_bundle' });
    const { identityKey, signingPublicKey, signedPreKey, signedPreKeySignature, oneTimePreKeys } = bundle || {};
    if (!identityKey || !signedPreKey || !signedPreKeySignature || !Array.isArray(oneTimePreKeys)) {
      return reply.code(400).send({ error: 'invalid_bundle' });
    }
    let unverified = false;
    if (signingPublicKey) {
      try {
        const signingPubBytes = Buffer.from(signingPublicKey, 'base64');
        const signedPreKeyBytes = Buffer.from(signedPreKey, 'base64');
        const sigBytes = Buffer.from(signedPreKeySignature, 'base64');
        const verified = verifySignedPreKey(signingPubBytes, signedPreKeyBytes, sigBytes);
        if (!verified) return reply.code(400).send({ error: 'invalid_signature' });
      } catch {
        return reply.code(400).send({ error: 'signature_decode_error' });
      }
    } else {
      // Fall back: allow but mark unverified (NOT recommended for production)
      unverified = true;
    }

    bundles[authUser.username] = {
      identityKey,
      signingPublicKey,
      signedPreKey,
      signedPreKeySignature,
      publishedAt: Date.now(),
      unverified
    };
    // Persist base bundle (legacy JSON field kept but no longer authoritative for OTPKs)
    await pool.query(
      `INSERT INTO key_bundles (user_id, identity_key, signing_key, signed_prekey, signed_prekey_sig)
       VALUES ((SELECT id FROM users WHERE username=$1), $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET identity_key=EXCLUDED.identity_key, signing_key=EXCLUDED.signing_key,
         signed_prekey=EXCLUDED.signed_prekey, signed_prekey_sig=EXCLUDED.signed_prekey_sig, published_at=NOW()`,
      [
        authUser.username,
        Buffer.from(identityKey, 'base64'),
        signingPublicKey ? Buffer.from(signingPublicKey, 'base64') : null,
        Buffer.from(signedPreKey, 'base64'),
        Buffer.from(signedPreKeySignature, 'base64')
      ]
    );
    // Replace existing OTPKs for user (delete + bulk insert) within a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM one_time_prekeys WHERE user_id=(SELECT id FROM users WHERE username=$1)', [authUser.username]);
      for (const p of oneTimePreKeys) {
        const compositeId = `${authUser.username}:${p.id}`;
        await client.query(
          `INSERT INTO one_time_prekeys (id, user_id, public_key) VALUES ($1,(SELECT id FROM users WHERE username=$2),$3)`,
          [compositeId, authUser.username, Buffer.from(p.key, 'base64')]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: 'otpk_persist_failed' });
    } finally {
      client.release();
    }
    return { ok: true, persisted: true, unverified };
  });

  // Replenish OTPKs without republishing full bundle
  app.post('/keys/replenish-otpk', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const { oneTimePreKeys } = (req.body as any) || {};
    if (!Array.isArray(oneTimePreKeys) || oneTimePreKeys.length === 0) {
      return reply.code(400).send({ error: 'missing_otpks' });
    }
    const client = await pool.connect();
    let inserted = 0, skipped = 0;
    try {
      await client.query('BEGIN');
      for (const p of oneTimePreKeys) {
        const compositeId = `${authUser.username}:${p.id}`;
        try {
          await client.query(
            `INSERT INTO one_time_prekeys (id, user_id, public_key)
             VALUES ($1,(SELECT id FROM users WHERE username=$2),$3)`,
            [compositeId, authUser.username, Buffer.from(p.key, 'base64')]
          );
          inserted++;
        } catch (e: any) {
          // likely duplicate primary key -> skip
          skipped++;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: 'otpk_replenish_failed' });
    } finally {
      client.release();
    }
    return { ok: true, inserted, skipped };
  });

  // Retrieve bundle (without marking OTPKs). Caller will later request reservation/consumption.
  app.get('/keys/:username/bundle', async (req, reply) => {
    const username = (req.params as any).username;
    let base = bundles[username];
    if (!base) {
      const dbRes = await pool.query('SELECT identity_key, signing_key, signed_prekey, signed_prekey_sig FROM key_bundles kb JOIN users u ON kb.user_id=u.id WHERE u.username=$1', [username]);
      if (!dbRes.rowCount) return reply.code(404).send({ error: 'not_found' });
      const row = dbRes.rows[0];
      base = bundles[username] = {
        identityKey: Buffer.from(row.identity_key).toString('base64'),
        signingPublicKey: row.signing_key ? Buffer.from(row.signing_key).toString('base64') : undefined,
        signedPreKey: Buffer.from(row.signed_prekey).toString('base64'),
        signedPreKeySignature: Buffer.from(row.signed_prekey_sig).toString('base64'),
        publishedAt: Date.now(),
        unverified: !row.signing_key
      };
    }
    const otRes = await pool.query('SELECT op.id, op.public_key FROM one_time_prekeys op JOIN users u ON op.user_id=u.id WHERE u.username=$1 AND op.consumed_at IS NULL ORDER BY op.created_at ASC LIMIT 50', [username]);
    return {
      bundle: {
        identityKey: base.identityKey,
        signingPublicKey: base.signingPublicKey,
        signedPreKey: base.signedPreKey,
        signedPreKeySignature: base.signedPreKeySignature,
        oneTimePreKeys: otRes.rows.map(r => ({ id: r.id, key: Buffer.from(r.public_key).toString('base64') }))
      }
    };
  });

  // Reserve (consume) a one-time prekey. Initiator should call before handshake finalize.
  app.post('/keys/:username/consume', async (req, reply) => {
    const authUser = requireAuth(req, reply); if (!authUser) return;
    const target = (req.params as any).username;
    const body = req.body as any;
    const { oneTimePreKeyId } = body || {};
    if (!oneTimePreKeyId) return reply.code(400).send({ error: 'missing_id' });
    // Atomic consume
    const res = await pool.query(
      `UPDATE one_time_prekeys SET consumed_at=NOW()
         WHERE id=$1 AND user_id=(SELECT id FROM users WHERE username=$2) AND consumed_at IS NULL
         RETURNING id`, [oneTimePreKeyId, target]
    );
    if (!res.rowCount) return reply.code(410).send({ error: 'gone' });
    return { ok: true, id: res.rows[0].id };
  });
}
