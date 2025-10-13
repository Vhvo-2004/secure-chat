import { Pool } from 'pg';

export type NotificationType = 'new_conversation' | 'session_initiated' | 'session_finalized' | 'message_received';

export interface Notification {
  id: number;
  recipient_username: string;
  type: NotificationType;
  data: any;
  created_at: string;
  read_at?: string;
}

export class NotificationService {
  constructor(private db: Pool) {}

  async createNotification(
    recipientUsername: string, 
    type: NotificationType, 
    data: any
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO notifications (recipient_username, type, data) 
         VALUES ($1, $2, $3)`,
        [recipientUsername, type, JSON.stringify(data)]
      );
      console.log(`📢 Notification created for ${recipientUsername}: ${type}`);
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  async getUnreadNotifications(username: string): Promise<Notification[]> {
    const result = await this.db.query(
      `SELECT id, recipient_username, type, data, created_at, read_at
       FROM notifications 
       WHERE recipient_username = $1 AND read_at IS NULL
       ORDER BY created_at DESC`,
      [username]
    );

    return result.rows.map(row => ({
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    }));
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1`,
      [notificationId]
    );
  }

  async markAllNotificationsAsRead(username: string): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET read_at = NOW() 
       WHERE recipient_username = $1 AND read_at IS NULL`,
      [username]
    );
  }

  async notifyNewConversation(recipientUsername: string, conversationId: string, initiatorUsername: string): Promise<void> {
    await this.createNotification(recipientUsername, 'new_conversation', {
      conversationId,
      initiator: initiatorUsername,
      message: `${initiatorUsername} iniciou uma conversa com você`
    });
  }

  async notifySessionInitiated(recipientUsername: string, sessionId: string, initiatorUsername: string): Promise<void> {
    await this.createNotification(recipientUsername, 'session_initiated', {
      sessionId,
      initiator: initiatorUsername,
      message: `${initiatorUsername} iniciou uma sessão X3DH. Suas chaves estão sendo configuradas automaticamente.`
    });
  }

  async notifySessionFinalized(recipientUsername: string, sessionId: string, initiatorUsername: string): Promise<void> {
    await this.createNotification(recipientUsername, 'session_finalized', {
      sessionId,
      initiator: initiatorUsername,
      message: `Chaves X3DH disponíveis! ${initiatorUsername} finalizou a configuração da conversa.`
    });
  }

  async notifyNewMessage(recipientUsername: string, conversationId: string, senderUsername: string): Promise<void> {
    await this.createNotification(recipientUsername, 'message_received', {
      conversationId,
      sender: senderUsername,
      message: `Nova mensagem de ${senderUsername}`
    });
  }

  // Clean up old read notifications (optional maintenance)
  async cleanupOldNotifications(olderThanDays: number = 7): Promise<void> {
    await this.db.query(
      `DELETE FROM notifications 
       WHERE read_at IS NOT NULL AND read_at < NOW() - INTERVAL '$1 days'`,
      [olderThanDays]
    );
  }
}