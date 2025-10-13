import { API_CONFIG } from '../config/api.js';
import { PollingService, QueuedMessage, MessageSyncResponse, ConversationStatus, Notification } from './PollingService.js';
import { 
  getConversationKeys, 
  storeConversationKeys, 
  ConversationKeys 
} from '../utils/conversationStorage.js';
import { 
  storeMessage, 
  updateMessageStatus, 
  getConversationMessages, 
  StoredMessage 
} from '../utils/messageStorage.js';

// Simplified API client interface
interface ApiClient {
  get<T>(url: string, config?: any): Promise<{ data: T }>;
  post<T>(url: string, data?: any, config?: any): Promise<{ data: T }>;
}

// Create a simple API client
class SimpleApiClient implements ApiClient {
  constructor(private token: string) {}

  async get<T>(url: string, config?: any): Promise<{ data: T }> {
    const params = config?.params ? new URLSearchParams(config.params).toString() : '';
    const fullUrl = url + (params ? `?${params}` : '');
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { data };
  }

  async post<T>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...config?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseData = await response.json();
    return { data: responseData };
  }
}

export class MessageService {
  private pollingService: PollingService;
  private api: ApiClient;
  private currentUsername: string | null = null;
  private onNewMessageCallback?: (message: StoredMessage) => void;
  private onStatusUpdateCallback?: (status: ConversationStatus[]) => void;
  private onConversationRefreshCallback?: () => Promise<void>;
  private onNotificationCallback?: (notifications: Notification[]) => void;
  
  constructor(private token: string) {
    this.api = new SimpleApiClient(token);
    // Initialize with empty callback first, will be set later
    this.pollingService = new PollingService(
      this.api,
      this.handleIncomingMessages.bind(this),
      this.handleConversationStatus.bind(this),
      this.handleConversationRefresh.bind(this),
      this.handleNotifications.bind(this),
      this.handlePollingError.bind(this)
    );
  }

  start(username: string): void {
    console.log(`Starting MessageService for user: ${username}`);
    this.currentUsername = username;
    this.pollingService.startPolling();
  }

  stop(): void {
    console.log('Stopping MessageService');
    this.pollingService.stopPolling();
    this.currentUsername = null;
  }

  // Set callback for new messages
  onNewMessage(callback: (message: StoredMessage) => void): void {
    this.onNewMessageCallback = callback;
  }

  // Set callback for status updates
  onStatusUpdate(callback: (status: ConversationStatus[]) => void): void {
    this.onStatusUpdateCallback = callback;
  }

  onConversationRefresh(callback: () => Promise<void>): void {
    this.onConversationRefreshCallback = callback;
  }

  onNotification(callback: (notifications: Notification[]) => void): void {
    this.onNotificationCallback = callback;
  }

  async sendMessage(
    conversationId: string,
    content: string,
    recipient: string
  ): Promise<void> {
    const messageId = crypto.randomUUID();
    
    try {
      // Get conversation keys
      const conversationKeys = getConversationKeys(conversationId);
      if (!conversationKeys) {
        throw new Error('No encryption keys found for conversation');
      }
      
      // Encrypt message
      const encrypted = await this.encryptMessage(content, conversationKeys);
      
      // Store locally with optimistic UI
      const optimisticMessage: StoredMessage = {
        id: messageId,
        conversationId,
        from: this.currentUsername || 'self',
        to: recipient,
        content,
        timestamp: Date.now(),
        direction: 'sent',
        delivered: false
      };
      
      storeMessage(optimisticMessage);
      
      // Notify UI immediately (optimistic)
      if (this.onNewMessageCallback) {
        this.onNewMessageCallback(optimisticMessage);
      }
      
      // Send via REST API
      const response = await this.api.post(`${API_CONFIG.BASE_URL}/api/messages/send`, {
        messageId,
        conversationId,
        recipient,
        encryptedContent: encrypted.encryptedContent,
        mac: encrypted.mac,
        iv: encrypted.iv,
        messageType: 'text'
      });
      
      console.log('Message sent successfully:', response.data);
      
      // Update local status
      updateMessageStatus(messageId, { delivered: true });
      
      // Force immediate sync to check for delivery confirmation
      await this.pollingService.forceSync();
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Update local status to failed (using delivered: false as indicator)
      updateMessageStatus(messageId, { delivered: false });
      
      // Re-notify UI with failed status
      if (this.onNewMessageCallback) {
        const failedMessage: StoredMessage = {
          id: messageId,
          conversationId,
          from: this.currentUsername || 'self',
          to: recipient,
          content,
          timestamp: Date.now(),
          direction: 'sent',
          delivered: false,
          acknowledged: false
        };
        this.onNewMessageCallback(failedMessage);
      }
      
      throw error;
    }
  }

  // Force sync (for pull-to-refresh)
  async forceSync(): Promise<void> {
    await this.pollingService.forceSync();
  }

  // Get service status
  getStatus() {
    return this.pollingService.getStatus();
  }

  private async handleIncomingMessages(messages: QueuedMessage[]): Promise<void> {
    const readMessageIds: string[] = [];
    
    for (const message of messages) {
      try {
        // Skip messages we sent
        if (message.sender === this.currentUsername) {
          // Update status for our own messages
          updateMessageStatus(message.id, { 
            delivered: message.status === 'delivered' || message.status === 'read',
            acknowledged: message.status === 'read'
          });
          continue;
        }
        
        // Decrypt incoming message
        const conversationKeys = getConversationKeys(message.conversationId);
        
        if (!conversationKeys) {
          console.warn('Missing keys for conversation:', message.conversationId);
          continue;
        }
        
        const decrypted = await this.decryptMessage(message, conversationKeys);
        
        // Store locally
        const storedMessage: StoredMessage = {
          id: message.id,
          conversationId: message.conversationId,
          from: message.sender,
          to: message.recipient,
          content: decrypted,
          timestamp: new Date(message.timestamp).getTime(),
          direction: 'received',
          delivered: true,
          acknowledged: false
        };
        
        storeMessage(storedMessage);
        
        // Track for read receipt
        if (message.recipient === this.currentUsername) {
          readMessageIds.push(message.id);
        }
        
        // Notify UI
        if (this.onNewMessageCallback) {
          this.onNewMessageCallback(storedMessage);
        }
        
      } catch (error) {
        console.error('Failed to process message:', message.id, error);
      }
    }
    
    // Send read receipts for new messages
    if (readMessageIds.length > 0) {
      await this.markMessagesAsRead(readMessageIds);
    }
  }

  private handleConversationStatus(status: ConversationStatus[]): void {
    console.log('Conversation status update:', status);
    
    if (this.onStatusUpdateCallback) {
      this.onStatusUpdateCallback(status);
    }
  }

  private async handleConversationRefresh(): Promise<void> {
    console.log('Refreshing conversation list...');
    
    if (this.onConversationRefreshCallback) {
      await this.onConversationRefreshCallback();
    }
  }

  private handleNotifications(notifications: Notification[]): void {
    console.log('Received notifications:', notifications);
    
    if (this.onNotificationCallback) {
      this.onNotificationCallback(notifications);
    }
  }

  private handlePollingError(error: any): void {
    console.error('Polling error:', error);
    // Could implement retry logic or notify UI of connection issues
  }

  private async markMessagesAsRead(messageIds: string[]): Promise<void> {
    try {
      await this.api.post(`${API_CONFIG.BASE_URL}/api/messages/mark-read`, { messageIds });
      console.log(`Marked ${messageIds.length} messages as read`);
      
      // Update local storage
      messageIds.forEach(id => {
        updateMessageStatus(id, { acknowledged: true });
      });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }

  private async encryptMessage(content: string, keys: ConversationKeys): Promise<{
    encryptedContent: string;
    mac: string;
    iv: string;
  }> {
    // Import the crypto functions
    const { encrypt3DESCBC } = await import('@chat-e2e/crypto');
    
    const encoded = new TextEncoder().encode(content);
    
    // Encrypt with 3DES
    const result = encrypt3DESCBC(encoded, keys.encKey, keys.macKey);
    
    return {
      encryptedContent: result.ctB64,
      mac: result.macB64,
      iv: result.ivB64
    };
  }

  private async decryptMessage(message: QueuedMessage, keys: ConversationKeys): Promise<string> {
    // Import the crypto functions
    const { decrypt3DESCBC } = await import('@chat-e2e/crypto');
    
    // Decrypt
    const result = {
      ivB64: message.iv,
      ctB64: message.encryptedContent,
      macB64: message.mac
    };
    
    const decrypted = decrypt3DESCBC(result, keys.encKey, keys.macKey);
    
    return new TextDecoder().decode(decrypted);
  }
}

export type { QueuedMessage, MessageSyncResponse, ConversationStatus };