import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client.js';
import { MessageQueueService, QueuedMessage, MessageSyncResponse } from '../services/MessageQueueService.js';
import { NotificationService } from '../services/NotificationService.js';

interface DbUser { id: string; username: string }

async function getUserId(username: string): Promise<string | null> {
  const res = await pool.query<DbUser>('SELECT id FROM users WHERE username=$1', [username]);
  return res.rowCount ? res.rows[0].id : null;
}

async function authenticate(req: any): Promise<string> {
  const auth = (req.headers['authorization'] || '').split(' ')[1];
  const secret = process.env.JWT_SECRET || 'dev';
  try {
    const decoded: any = jwt.verify(auth, secret);
    return decoded.username;
  } catch {
    throw new Error('unauthorized');
  }
}

export function registerMessageRoutes(app: FastifyInstance) {
  const messageQueue = new MessageQueueService(pool);
  const notificationService = new NotificationService(pool);

  // Send message (replaces WebSocket send)
  app.post<{
    Body: {
      messageId: string;
      conversationId: string;
      recipient: string;
      encryptedContent: string;
      mac: string;
      iv: string;
      messageType?: 'text' | 'system' | 'key_exchange';
    }
  }>('/api/messages/send', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const { messageId, conversationId, recipient, encryptedContent, mac, iv, messageType = 'text' } = request.body;
      
      if (!messageId || !conversationId || !recipient || !encryptedContent || !mac || !iv) {
        return reply.code(400).send({ error: 'missing_required_fields' });
      }
      
      const message: QueuedMessage = {
        id: messageId,
        conversationId,
        sender: username,
        recipient,
        encryptedContent,
        mac,
        iv,
        timestamp: new Date(),
        status: 'sent',
        messageType
      };
      
      const result = await messageQueue.sendMessage(message);
      reply.send(result);
      
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      if (error.code === '23505') { // Duplicate key
        return reply.code(409).send({ error: 'duplicate_message' });
      }
      if (error.code === '23503') { // Foreign key violation
        return reply.code(400).send({ error: 'invalid_conversation_or_user' });
      }
      console.error('Unexpected error in message send:', error.message, error.stack);
      reply.code(500).send({ error: 'internal_server_error', details: error.message });
    }
  });

  // Sync messages (replaces WebSocket polling)
  app.get<{
    Querystring: {
      since?: string;
      limit?: number;
    }
  }>('/api/messages/sync', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const { since, limit = 50 } = request.query;
      
      const syncResult = await messageQueue.getMessagesForUser(username, since, limit);
      
      // Update user presence
      await messageQueue.updateUserPresence(username);
      
      reply.send(syncResult);
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Get conversation status (unread counts, last activity)
  app.get('/api/messages/conversations/status', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const status = await messageQueue.getConversationStatus(username);
      reply.send({ conversations: status });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Mark messages as read
  app.post<{
    Body: {
      messageIds: string[];
    }
  }>('/api/messages/mark-read', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const { messageIds } = request.body;
      
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return reply.code(400).send({ error: 'missing_message_ids' });
      }
      
      await messageQueue.markMessagesAsRead(messageIds, username);
      reply.send({ success: true });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Get conversation history with pagination
  app.get<{
    Params: { conversationId: string };
    Querystring: {
      before?: string;
      limit?: number;
    }
  }>('/api/messages/conversations/:conversationId/history', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const { conversationId } = request.params;
      const { before, limit = 30 } = request.query;
      
      const messages = await messageQueue.getConversationHistory(
        conversationId, 
        username,
        before,
        limit
      );
      
      reply.send(messages);
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      if (error.message === 'Conversation not found or access denied') {
        return reply.code(404).send({ error: 'conversation_not_found' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Legacy endpoint for backward compatibility (optional - can be removed)
  app.get('/pending/:username', async (req, reply) => {
    try {
      const username = (req.params as any).username;
      const authUser = await authenticate(req);
      
      if (username !== authUser) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      
      const syncResult = await messageQueue.getMessagesForUser(username);
      reply.send({ messages: syncResult.messages });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Legacy endpoint for backward compatibility (optional - can be removed)
  app.post('/ack', async (req, reply) => {
    try {
      const username = await authenticate(req);
      const body = req.body as any;
      const { ids } = body || {};
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.code(400).send({ error: 'missing_ids' });
      }
      
      await messageQueue.markMessagesAsRead(ids, username);
      reply.send({ acked: ids, count: ids.length });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Get unread notifications
  app.get('/api/messages/notifications', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const notifications = await notificationService.getUnreadNotifications(username);
      reply.send({ notifications });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });

  // Mark notification as read
  app.post('/api/messages/notifications/:id/read', async (request, reply) => {
    try {
      const username = await authenticate(request);
      const { id } = request.params as any;
      
      console.log(`[DEBUG] Mark notification as read - User: ${username}, ID: ${id}, Type: ${typeof id}`);
      
      // Validate ID is a number
      const notificationId = parseInt(id);
      if (isNaN(notificationId)) {
        console.log(`[ERROR] Invalid notification ID: ${id}`);
        return reply.code(400).send({ error: 'invalid_notification_id' });
      }
      
      await notificationService.markNotificationAsRead(notificationId);
      console.log(`[SUCCESS] Notification ${notificationId} marked as read for user ${username}`);
      reply.send({ success: true });
      
    } catch (error: any) {
      console.error(`[ERROR] Failed to mark notification as read:`, error);
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error', details: error.message });
    }
  });

  // Mark all notifications as read
  app.post('/api/messages/notifications/read-all', async (request, reply) => {
    try {
      const username = await authenticate(request);
      
      await notificationService.markAllNotificationsAsRead(username);
      reply.send({ success: true });
      
    } catch (error: any) {
      if (error.message === 'unauthorized') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      reply.code(500).send({ error: 'internal_server_error' });
    }
  });
}
