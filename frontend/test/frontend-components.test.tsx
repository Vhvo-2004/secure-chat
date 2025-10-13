import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConversationManager } from '../src/components/ConversationManager';
import { ChatScreen } from '../src/components/ChatScreen';

// Mocks for required props and dependencies
const mockToken = 'test-token';
const mockUsername = 'alice';
const mockPassword = 'password123';
const mockOnLogout = vi.fn();
const mockOnLog = vi.fn();
const mockOnConversationSelect = vi.fn();
const mockOnSessionFinalized = vi.fn();

// Helper to create minimal key material
const mockKeyMaterial = {
  identityKey: {
    publicKey: new Uint8Array(32),
    privateKey: new Uint8Array(32),
    signingPublicKey: new Uint8Array(32),
    signingPrivateKey: new Uint8Array(32)
  },
  signedPreKey: {
    publicKey: new Uint8Array(32),
    privateKey: new Uint8Array(32),
    signature: new Uint8Array(64)
  },
  oneTimePreKeys: []
};

describe('ChatScreen', () => {
  it('renders and displays username', () => {
    render(
      <ChatScreen
        token={mockToken}
        username={mockUsername}
        password={mockPassword}
        onLogout={mockOnLogout}
      />
    );
    expect(screen.getByText(/Conectado como:/)).toBeDefined();
    expect(screen.getByText(mockUsername)).toBeDefined();
  });

  it('shows log panel and can add logs', async () => {
    render(
      <ChatScreen
        token={mockToken}
        username={mockUsername}
        password={mockPassword}
        onLogout={mockOnLogout}
      />
    );
    expect(screen.getByText(/Log de Atividades/)).toBeDefined();
  });
});

describe('ConversationManager', () => {
  beforeEach(() => {
    // Mock localStorage for conversation keys and metadata
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => {
        if (key === 'conversationKeys') {
          return JSON.stringify({
            'conv-1': {
              encKey: new Uint8Array([1,2,3]),
              macKey: new Uint8Array([4,5,6]),
              derivedAt: Date.now(),
              sessionId: 'sess-1'
            }
          });
        }
        if (key === 'conversations') {
          return JSON.stringify({
            'conv-1': {
              id: 'conv-1',
              otherUser: 'bob',
              lastActivity: Date.now()
            }
          });
        }
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    // Mock fetch for API endpoints
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      if (typeof url === 'string' && url.includes('/api/conversations')) {
        return {
          ok: true,
          json: async () => ({
            conversations: [
              { id: 'conv-1', other_user: 'bob', created_at: new Date().toISOString() }
            ]
          })
        };
      }
      if (typeof url === 'string' && url.includes('/api/sessions/pending')) {
        return { ok: false, status: 404 };
      }
      return { ok: false, status: 404 };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders and allows new conversation input', () => {
    render(
      <ConversationManager
        token={mockToken}
        username={mockUsername}
        currentMaterial={mockKeyMaterial}
        onConversationSelect={mockOnConversationSelect}
        onLog={mockOnLog}
        onSessionFinalized={mockOnSessionFinalized}
      />
    );
    expect(screen.getByPlaceholderText(/Nome do usuário/)).toBeDefined();
    expect(screen.getByText(/Conversas/)).toBeDefined();
  });

  it('shows a conversation with keys and triggers selection', async () => {
    render(
      <ConversationManager
        token={mockToken}
        username={mockUsername}
        currentMaterial={mockKeyMaterial}
        onConversationSelect={mockOnConversationSelect}
        onLog={mockOnLog}
        onSessionFinalized={mockOnSessionFinalized}
      />
    );
    // Wait for conversations to load
    expect(await screen.findByText('bob')).toBeDefined();
    // Simulate click
    fireEvent.click(screen.getByText('bob'));
    expect(mockOnConversationSelect).toHaveBeenCalledWith('conv-1', 'bob', expect.objectContaining({ encKey: expect.any(Uint8Array) }));
  });

  it('logs cryptographic steps when selecting a conversation', async () => {
    render(
      <ConversationManager
        token={mockToken}
        username={mockUsername}
        currentMaterial={mockKeyMaterial}
        onConversationSelect={mockOnConversationSelect}
        onLog={mockOnLog}
        onSessionFinalized={mockOnSessionFinalized}
      />
    );
    fireEvent.click(await screen.findByText('bob'));
    expect(mockOnLog).toHaveBeenCalledWith(expect.stringMatching(/Selecionando conversa/));
    expect(mockOnLog).toHaveBeenCalledWith(expect.stringMatching(/Chaves encontradas/));
  });

  it('allows creating a new conversation', async () => {
    render(
      <ConversationManager
        token={mockToken}
        username={mockUsername}
        currentMaterial={mockKeyMaterial}
        onConversationSelect={mockOnConversationSelect}
        onLog={mockOnLog}
        onSessionFinalized={mockOnSessionFinalized}
      />
    );
    const input = screen.getByPlaceholderText(/Nome do usuário/);
    fireEvent.change(input, { target: { value: 'bob' } });
    fireEvent.click(screen.getByText('Nova'));
    // Should log initiation
    expect(mockOnLog).toHaveBeenCalledWith(expect.stringMatching(/Iniciando conversa/));
  });
});
