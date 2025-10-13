import { Pool } from 'pg';

export interface QueuedMessage {
  id: string;
  conversationId: string;
  sender: string;
  recipient: string;
  encryptedContent: string;
  mac: string;
  iv: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  messageType: 'text' | 'system' | 'key_exchange';
}

export interface MessageSyncResponse {
  messages: QueuedMessage[];
  hasMore: boolean;
  nextCursor?: string;
  serverTimestamp: string;
}

export interface ConversationStatus {
  conversationId: string;
  lastMessageId?: string;
  unreadCount: number;
  lastActivity: Date;
  participantLastSeen: Date;
}

export class MessageQueueService {
  constructor(private db: Pool) {}

  async sendMessage(message: QueuedMessage): Promise<{ messageId: string; status: string }> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store encrypted message - use message.id for both id and message_id
      const result = await client.query(
        `INSERT INTO messages 
         (id, message_id, conversation_id, sender, recipient, encrypted_content, mac, iv, status, message_type)
         VALUES ($1, $1, $2, $3, $4, $5, $6, $7, 'sent', $8)
         RETURNING id`,
        [message.id, message.conversationId, message.sender, 
         message.recipient, message.encryptedContent, message.mac, message.iv, message.messageType]
      );
      
      // Update conversation activity
      await client.query(
        `UPDATE conversations 
         SET last_message_id = $1, last_activity = NOW()
         WHERE id = $2`,
        [message.id, message.conversationId]
      );
      
      // Update user presence for sender
      await client.query(
        `INSERT INTO user_presence (username, last_seen, last_sync)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (username) 
         DO UPDATE SET last_seen = NOW(), last_sync = NOW()`,
        [message.sender]
      );
      
      await client.query('COMMIT');
      
      return { messageId: message.id, status: 'sent' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('MessageQueueService.sendMessage error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMessagesForUser(
    username: string, 
    since?: string,
    limit: number = 50
  ): Promise<MessageSyncResponse> {
    let query = `
      SELECT m.message_id, m.conversation_id, m.sender, m.recipient,
             m.encrypted_content, m.mac, m.iv, m.created_at, m.status, m.message_type
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user_a_id = (SELECT id FROM users WHERE username = $1) 
             OR c.user_b_id = (SELECT id FROM users WHERE username = $1))
    `;
    
    const params: any[] = [username];
    
    if (since && since !== 'null') {
      // Add 1 second buffer to avoid timestamp precision issues
      const sinceDate = new Date(since);
      const bufferedSince = new Date(sinceDate.getTime() - 1000); // 1 second buffer
      query += ` AND m.created_at > $${params.length + 1}`;
      params.push(bufferedSince.toISOString());
    }
    
    query += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit + 1); // +1 to check if hasMore
    
    const result = await this.db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const messages = result.rows.slice(0, limit);
    
    // Mark messages as delivered for recipient
    if (messages.length > 0) {
      const messageIds = messages
        .filter(m => m.recipient === username && m.status === 'sent')
        .map(m => m.message_id);
        
      if (messageIds.length > 0) {
        await this.markAsDelivered(messageIds);
      }
    }
    
    return {
      messages: messages.map(this.mapToQueuedMessage),
      hasMore,
      nextCursor: hasMore ? messages[messages.length - 1].created_at : undefined,
      serverTimestamp: new Date().toISOString()
    };
  }

  async getConversationStatus(username: string): Promise<ConversationStatus[]> {
    const result = await this.db.query(`
      SELECT 
        c.id as conversation_id,
        c.last_message_id,
        c.last_activity,
        COALESCE(unread.count, 0) as unread_count,
        COALESCE(presence.last_seen, c.created_at) as participant_last_seen
      FROM conversations c
      LEFT JOIN (
        SELECT conversation_id, COUNT(*) as count
        FROM messages 
        WHERE recipient = $1 AND status IN ('sent', 'delivered')
        GROUP BY conversation_id
      ) unread ON c.id = unread.conversation_id
      LEFT JOIN user_presence presence ON (
        CASE 
          WHEN c.user_a_id = (SELECT id FROM users WHERE username = $1) THEN 
            (SELECT username FROM users WHERE id = c.user_b_id)
          ELSE 
            (SELECT username FROM users WHERE id = c.user_a_id)
        END = presence.username
      )
      WHERE c.user_a_id = (SELECT id FROM users WHERE username = $1) 
         OR c.user_b_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY c.last_activity DESC
    `, [username]);
    
    return result.rows.map(row => ({
      conversationId: row.conversation_id,
      lastMessageId: row.last_message_id,
      unreadCount: parseInt(row.unread_count),
      lastActivity: row.last_activity,
      participantLastSeen: row.participant_last_seen
    }));
  }

  async getConversationHistory(
    conversationId: string,
    username: string,
    before?: string,
    limit: number = 30
  ): Promise<MessageSyncResponse> {
    // Verify user has access to conversation
    const convCheck = await this.db.query(
      `SELECT 1 FROM conversations WHERE id = $1 AND 
       (user_a_id = (SELECT id FROM users WHERE username = $2) 
        OR user_b_id = (SELECT id FROM users WHERE username = $2))`,
      [conversationId, username]
    );
    
    if (convCheck.rowCount === 0) {
      throw new Error('Conversation not found or access denied');
    }
    
    let query = `
      SELECT message_id, conversation_id, sender, recipient,
             encrypted_content, mac, iv, created_at, status, message_type
      FROM messages
      WHERE conversation_id = $1
    `;
    
    const params: any[] = [conversationId];
    
    if (before) {
      query += ` AND created_at < $${params.length + 1}`;
      params.push(before);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);
    
    const result = await this.db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const messages = result.rows.slice(0, limit).reverse(); // Reverse to get chronological order
    
    return {
      messages: messages.map(this.mapToQueuedMessage),
      hasMore,
      nextCursor: hasMore ? result.rows[limit].created_at : undefined,
      serverTimestamp: new Date().toISOString()
    };
  }

  async markMessagesAsRead(messageIds: string[], username: string): Promise<void> {
    await this.db.query(`
      UPDATE messages 
      SET status = 'read', read_at = NOW()
      WHERE message_id = ANY($1) AND recipient = $2 AND status IN ('sent', 'delivered')
    `, [messageIds, username]);
  }

  async updateUserPresence(username: string): Promise<void> {
    await this.db.query(
      `INSERT INTO user_presence (username, last_seen, last_sync)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (username) 
       DO UPDATE SET last_seen = NOW(), last_sync = NOW()`,
      [username]
    );
  }

  private async markAsDelivered(messageIds: string[]): Promise<void> {
    await this.db.query(`
      UPDATE messages 
      SET status = 'delivered', delivered_at = NOW()
      WHERE message_id = ANY($1) AND status = 'sent'
    `, [messageIds]);
  }

  private mapToQueuedMessage(row: any): QueuedMessage {
    return {
      id: row.message_id,
      conversationId: row.conversation_id,
      sender: row.sender,
      recipient: row.recipient,
      encryptedContent: row.encrypted_content,
      mac: row.mac,
      iv: row.iv,
      timestamp: row.created_at,
      status: row.status,
      messageType: row.message_type || 'text'
    };
  }
}