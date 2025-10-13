// Local message storage utility
export interface StoredMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  content: string; // Decrypted content
  timestamp: number;
  direction: 'sent' | 'received';
  delivered?: boolean;
  acknowledged?: boolean;
}

export interface MessageStorage {
  [conversationId: string]: StoredMessage[];
}

const MESSAGES_STORAGE_KEY = 'chat-e2e-messages';

// Get all stored messages
export function getStoredMessages(): MessageStorage {
  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to get stored messages:', error);
    return {};
  }
}

// Get messages for a specific conversation
export function getConversationMessages(conversationId: string): StoredMessage[] {
  const allMessages = getStoredMessages();
  return allMessages[conversationId] || [];
}

// Store a new message
export function storeMessage(message: StoredMessage): void {
  try {
    const allMessages = getStoredMessages();
    
    if (!allMessages[message.conversationId]) {
      allMessages[message.conversationId] = [];
    }
    
    // Check if message already exists (prevent duplicates)
    const existingIndex = allMessages[message.conversationId].findIndex(m => m.id === message.id);
    
    if (existingIndex >= 0) {
      // Update existing message (for delivery/acknowledgment status)
      allMessages[message.conversationId][existingIndex] = { 
        ...allMessages[message.conversationId][existingIndex], 
        ...message 
      };
    } else {
      // Add new message
      allMessages[message.conversationId].push(message);
      
      // Sort by timestamp to maintain order
      allMessages[message.conversationId].sort((a, b) => a.timestamp - b.timestamp);
    }
    
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
  } catch (error) {
    console.error('Failed to store message:', error);
  }
}

// Update message status (delivered/acknowledged)
export function updateMessageStatus(messageId: string, updates: Partial<Pick<StoredMessage, 'delivered' | 'acknowledged'>>): void {
  try {
    const allMessages = getStoredMessages();
    let found = false;
    
    // Find and update the message across all conversations
    for (const conversationId in allMessages) {
      const messageIndex = allMessages[conversationId].findIndex(m => m.id === messageId);
      if (messageIndex >= 0) {
        allMessages[conversationId][messageIndex] = {
          ...allMessages[conversationId][messageIndex],
          ...updates
        };
        found = true;
        break;
      }
    }
    
    if (found) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
    }
  } catch (error) {
    console.error('Failed to update message status:', error);
  }
}

// Get conversation summary (last message, unread count, etc.)
export function getConversationSummary(conversationId: string): {
  lastMessage?: StoredMessage;
  totalMessages: number;
  unreadCount: number;
} {
  const messages = getConversationMessages(conversationId);
  
  if (messages.length === 0) {
    return { totalMessages: 0, unreadCount: 0 };
  }
  
  const lastMessage = messages[messages.length - 1];
  const unreadCount = messages.filter(m => 
    m.direction === 'received' && !m.acknowledged
  ).length;
  
  return {
    lastMessage,
    totalMessages: messages.length,
    unreadCount
  };
}

// Mark all messages in a conversation as read
export function markConversationAsRead(conversationId: string): void {
  try {
    const allMessages = getStoredMessages();
    
    if (allMessages[conversationId]) {
      allMessages[conversationId] = allMessages[conversationId].map(message => ({
        ...message,
        acknowledged: message.direction === 'received' ? true : message.acknowledged
      }));
      
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
    }
  } catch (error) {
    console.error('Failed to mark conversation as read:', error);
  }
}

// Delete all messages for a conversation
export function deleteConversationMessages(conversationId: string): void {
  try {
    const allMessages = getStoredMessages();
    delete allMessages[conversationId];
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
  } catch (error) {
    console.error('Failed to delete conversation messages:', error);
  }
}

// Clear all stored messages (logout)
export function clearAllMessages(): void {
  try {
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear all messages:', error);
  }
}

// Get messages from last N days
export function getRecentMessages(conversationId: string, days: number = 7): StoredMessage[] {
  const messages = getConversationMessages(conversationId);
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  return messages.filter(message => message.timestamp >= cutoffTime);
}

// Export conversation as text (for backup/export features)
export function exportConversationAsText(conversationId: string): string {
  const messages = getConversationMessages(conversationId);
  
  if (messages.length === 0) {
    return 'No messages in this conversation.';
  }
  
  return messages.map(message => {
    const date = new Date(message.timestamp).toLocaleString();
    const sender = message.direction === 'sent' ? 'You' : message.from;
    return `[${date}] ${sender}: ${message.content}`;
  }).join('\n');
}