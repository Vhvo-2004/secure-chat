interface QueuedMessage {
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

interface MessageSyncResponse {
  messages: QueuedMessage[];
  hasMore: boolean;
  nextCursor?: string;
  serverTimestamp: string;
}

interface ConversationStatus {
  conversationId: string;
  lastMessageId?: string;
  unreadCount: number;
  lastActivity: Date;
  participantLastSeen: Date;
}

interface Notification {
  id: number;
  recipient_username: string;
  type: 'new_conversation' | 'session_initiated' | 'session_finalized' | 'message_received';
  data: any;
  created_at: string;
  read_at?: string;
}

interface ApiClient {
  get<T>(url: string, config?: any): Promise<{ data: T }>;
  post<T>(url: string, data?: any, config?: any): Promise<{ data: T }>;
}

export class PollingService {
  private pollingInterval: number = 3000; // 3 seconds
  private longPollingInterval: number = 30000; // 30 seconds when inactive
  private isPolling = false;
  private timeoutId: number | null = null;
  private lastSyncTimestamp: string | null = null;
  private isActive = true;
  
  constructor(
    private api: ApiClient,
    private messageHandler: (messages: QueuedMessage[]) => void,
    private statusHandler: (status: ConversationStatus[]) => void,
    private conversationRefreshHandler: () => Promise<void>,
    private notificationHandler: (notifications: Notification[]) => void,
    private errorHandler?: (error: any) => void
  ) {
    this.lastSyncTimestamp = localStorage.getItem('lastMessageSync');
    this.setupVisibilityHandling();
  }

  startPolling(): void {
    if (this.isPolling) return;
    
    console.log('Starting message polling...');
    this.isPolling = true;
    this.scheduleNextPoll();
    
    // Sync immediately
    this.performSync();
  }

  stopPolling(): void {
    console.log('Stopping message polling...');
    this.isPolling = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  // Manual sync trigger (pull-to-refresh, focus, etc.)
  async forceSync(): Promise<void> {
    if (!this.isPolling) return;
    
    console.log('Force syncing messages...');
    await this.performSync();
    this.resetPollingInterval(); // Reset to short interval
  }

  // Adaptive polling based on user activity
  setActiveMode(active: boolean): void {
    this.isActive = active;
    console.log(`Setting polling mode to: ${active ? 'active' : 'background'}`);
  }

  private scheduleNextPoll(): void {
    if (!this.isPolling) return;
    
    const interval = this.isActive && document.hasFocus() ? 
      this.pollingInterval : 
      this.longPollingInterval;
    
    this.timeoutId = setTimeout(() => {
      this.performSync().then(() => {
        this.scheduleNextPoll();
      });
    }, interval);
  }

  private async performSync(): Promise<void> {
    try {
      // Sync new messages
      console.log('PollingService: Starting sync, last timestamp:', this.lastSyncTimestamp);
      const messageResponse = await this.api.get<MessageSyncResponse>('/api/messages/sync', {
        params: { since: this.lastSyncTimestamp }
      });
      
      console.log('PollingService: Sync response:', messageResponse.data);
      
      if (messageResponse.data.messages.length > 0) {
        console.log(`Received ${messageResponse.data.messages.length} new messages`);
        this.messageHandler(messageResponse.data.messages);
        
        // Update last sync timestamp
        this.lastSyncTimestamp = messageResponse.data.serverTimestamp;
        localStorage.setItem('lastMessageSync', this.lastSyncTimestamp);
      }

      // Check for notifications
      const notificationResponse = await this.api.get<{ notifications: Notification[] }>(
        '/api/messages/notifications'
      );
      
      if (notificationResponse.data.notifications.length > 0) {
        console.log(`Received ${notificationResponse.data.notifications.length} new notifications`);
        this.notificationHandler(notificationResponse.data.notifications);
        
        // Only refresh conversations when we receive relevant notifications
        const hasConversationNotifications = notificationResponse.data.notifications.some(
          n => n.type === 'session_initiated' || n.type === 'session_finalized' || n.type === 'new_conversation'
        );
        
        if (hasConversationNotifications) {
          console.log('Refreshing conversations due to notification...');
          await this.conversationRefreshHandler();
        }
      }
      
      // Sync conversation status (less frequently)
      if (this.shouldSyncStatus()) {
        const statusResponse = await this.api.get<{ conversations: ConversationStatus[] }>(
          '/api/messages/conversations/status'
        );
        
        this.statusHandler(statusResponse.data.conversations);
        localStorage.setItem('lastStatusSync', new Date().toISOString());
      }
      
      // Reset polling interval on success
      this.resetPollingInterval();
      
    } catch (error) {
      console.error('Polling sync failed:', error);
      
      if (this.errorHandler) {
        this.errorHandler(error);
      }
      
      // Exponential backoff on error
      this.pollingInterval = Math.min(this.pollingInterval * 1.5, 30000);
    }
  }

  private shouldSyncStatus(): boolean {
    const lastStatusSync = localStorage.getItem('lastStatusSync');
    if (!lastStatusSync) return true;
    
    const timeSince = Date.now() - new Date(lastStatusSync).getTime();
    return timeSince > 10000; // Sync status every 10 seconds
  }

  private resetPollingInterval(): void {
    this.pollingInterval = 3000; // Reset to base interval
  }

  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.setActiveMode(false);
      } else {
        this.setActiveMode(true);
        this.forceSync(); // Immediate sync when returning
      }
    });
    
    // Also handle window focus/blur
    window.addEventListener('focus', () => {
      this.setActiveMode(true);
      this.forceSync();
    });
    
    window.addEventListener('blur', () => {
      this.setActiveMode(false);
    });
  }

  // Get current sync status
  getStatus() {
    return {
      isPolling: this.isPolling,
      isActive: this.isActive,
      currentInterval: this.isActive ? this.pollingInterval : this.longPollingInterval,
      lastSyncTimestamp: this.lastSyncTimestamp
    };
  }
}

// Export types for use in other files
export type { QueuedMessage, MessageSyncResponse, ConversationStatus, Notification };