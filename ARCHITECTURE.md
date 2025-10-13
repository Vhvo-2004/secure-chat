# Arquitetura do Sistema

Documentação técnica detalhada da implementação do chat E2E com protocolo X3DH.

## 🏗️ Visão Geral da Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │     Backend     │    │   PostgreSQL    │
│   React/TS      │◄──►│  Fastify/Node   │◄──►│   Database      │
│                 │    │                 │    │                 │
│ • WebSocket     │    │ • REST API      │    │ • Users         │
│ • Crypto Local  │    │ • WebSocket     │    │ • Conversations │
│ • Key Storage   │    │ • JWT Auth      │    │ • Sessions      │
│ • Message UI    │    │ • Key Bundles   │    │ • Messages      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Estrutura de Componentes

### Backend (`/backend`)
```
src/
├── index.ts           # Entry point + server setup
├── config/            # Environment variables
├── crypto/            # Crypto utilities (validation)
├── db/
│   └── client.ts      # PostgreSQL connection + schema
├── realtime/
│   └── ws.ts          # WebSocket handlers
└── routes/
    ├── auth.ts        # Authentication (register/login)
    ├── keys.ts        # Key bundle management
    ├── sessions.ts    # X3DH session handling
    ├── conversations.ts # Conversation management
    └── messages.ts    # Message storage/retrieval
```

### Frontend (`/frontend`)
```
src/
├── main.tsx          # React entry point
├── App.tsx           # Main application component
├── api/              # Backend API integration
├── crypto/           # Client-side cryptography
├── components/
│   ├── ConversationManager.tsx  # X3DH protocol handler
│   ├── ChatScreen.tsx          # Main chat interface
│   └── AuthScreen.tsx          # Login/register UI
└── utils/            # Helper functions
    ├── conversationStorage.ts   # Conversation keys management
    ├── messageStorage.ts        # Message persistence
    └── keyMaterialStorage.ts    # Encrypted key storage
```

### Crypto Package (`/packages/crypto`)
```
src/
├── index.ts          # Main exports
├── x3dh/
│   ├── types.ts      # TypeScript interfaces
│   └── x3dh.ts       # X3DH implementation
├── kdf/
│   └── hkdf.ts       # Key derivation (HKDF)
├── symmetric/
│   └── tripleDes.ts  # 3DES-CBC + HMAC
└── util/
    └── serialization.ts # Binary serialization
```

## 🔐 Protocolo X3DH Implementado

### 1. Geração de Material Criptográfico

```typescript
interface X3DHKeyMaterial {
  identityKey: IdentityKeyPair;      // IK - Long-term identity
  signedPreKey: SignedPreKeyPair;    // SPK - Signed by IK
  oneTimePreKeys: OneTimePreKey[];   // OTKs - Single-use keys
}
```

**Curvas Utilizadas:**
- **Ed25519**: Para assinaturas (signing)
- **X25519**: Para Diffie-Hellman (ECDH)

### 2. Fluxo de Estabelecimento de Chaves

#### Iniciador (Alice → Bob):
```
1. Validate user exists   HEAD /api/keys/bundle/:username (NEW)
2. Fetch Bob's bundle     GET /api/keys/bundle/:username
3. Initiate session       POST /api/sessions/initiate
4. Derive shared secret   X3DH calculation
5. Finalize session       POST /api/sessions/:id/finalize
```

**Error Handling (NEW)**:
- **404 User Not Found**: Clear message with registration hint
- **500 Internal Error**: Detailed logging with try-catch blocks
- **Bundle Missing**: Specific error for unpublished keys

#### Responder (Bob responde):
```
1. Receive notification  WebSocket: session-finalized
2. Fetch session details GET /api/sessions/:id
3. Derive shared secret  X3DH calculation (matching Alice)
4. Store conversation keys
```

### 3. Cálculo X3DH

**Componentes Diffie-Hellman:**
```
DH1 = ECDH(SPK_B, IK_A)    # Bob's signed prekey × Alice's identity
DH2 = ECDH(IK_B, EK_A)     # Bob's identity × Alice's ephemeral  
DH3 = ECDH(SPK_B, EK_A)    # Bob's signed prekey × Alice's ephemeral
DH4 = ECDH(OTK_B, EK_A)    # Bob's one-time key × Alice's ephemeral (optional)
```

**Derivação de Chaves:**
```
concat = DH1 || DH2 || DH3 || DH4
masterKey = HKDF(concat, salt=0x00, info="", length=32)
encKey = HKDF(masterKey, salt=0x00, info="ENC", length=24)  # 3DES
macKey = HKDF(masterKey, salt=0x00, info="MAC", length=32)  # HMAC
```

## 🗄️ Schema do Banco de Dados

### Tables

```sql
-- Usuários registrados
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    bundle JSONB NOT NULL,              -- Key bundle público
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversas entre usuários
CREATE TABLE conversations (
    id VARCHAR(50) PRIMARY KEY,
    user1 VARCHAR(50) REFERENCES users(username),
    user2 VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sessões X3DH para estabelecimento de chaves
CREATE TABLE sessions (
    id VARCHAR(100) PRIMARY KEY,
    initiator VARCHAR(50) REFERENCES users(username),
    recipient VARCHAR(50) REFERENCES users(username),
    conversation_id VARCHAR(50) REFERENCES conversations(id),
    one_time_prekey_id VARCHAR(50),
    finalized BOOLEAN DEFAULT FALSE,
    initiator_identity_key TEXT,
    initiator_ephemeral_key TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- One-time prekeys consumíveis
CREATE TABLE one_time_prekeys (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username),
    public_key TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens criptografadas
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(50) REFERENCES conversations(id),
    sender VARCHAR(50) REFERENCES users(username),
    encrypted_content TEXT NOT NULL,
    mac TEXT NOT NULL,
    iv TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Fluxo de Mensagens

### 1. Criptografia (Sender)
```typescript
// Message encryption flow
const iv = crypto.getRandomValues(new Uint8Array(8));
const encrypted = tripleDESEncrypt(message, encKey, iv);
const mac = hmacSHA256(encrypted, macKey);

const payload = {
  encrypted: base64(encrypted),
  mac: base64(mac),
  iv: base64(iv)
};
```

### 2. Descriptografia (Receiver)
```typescript
// Message decryption flow
const computedMAC = hmacSHA256(encrypted, macKey);
if (!constantTimeCompare(receivedMAC, computedMAC)) {
  throw new Error('MAC mismatch - message tampered');
}

const plaintext = tripleDESDecrypt(encrypted, encKey, iv);
```

### 3. Transport (WebSocket)
```typescript
// Real-time message delivery
socket.send(JSON.stringify({
  type: 'message',
  conversationId: 'conv_xxx',
  payload: encryptedPayload
}));
```

## 🔧 Configuração e Deploy

### Environment Variables
```bash
# Backend
DATABASE_URL=postgresql://user:pass@localhost:5432/chat_e2e
JWT_SECRET=your-secret-key
PORT=3001

# Frontend
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: chat_e2e
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
```

## 🧪 Testes

### Crypto Package Tests
- **HKDF**: Vetores de teste RFC 5869
- **3DES**: Encrypt/decrypt round-trip
- **X3DH**: Alice-Bob key agreement

### Integration Tests
- **Authentication**: Register/login flow
- **Key Exchange**: Full X3DH handshake
- **Messaging**: E2E message encryption

## 🚀 Performance Considerations

### Client-Side Optimizations
- **Key Caching**: Derived keys stored in memory
- **Batch Operations**: Multiple crypto operations
- **WebWorkers**: Heavy crypto in background threads (future)

### Server-Side Optimizations
- **Connection Pooling**: PostgreSQL connections
- **Key Bundle Caching**: Reduce DB queries
- **WebSocket Scaling**: Redis pub/sub (future)

## 🔮 Roadmap Técnico

### Próximas Implementações
1. **AES-GCM**: Substituir 3DES-CBC + HMAC
2. **Double Ratchet**: Forward secrecy
3. **Key Rotation**: Automatic OTK replenishment
4. **Message Ordering**: Sequence numbers

### Melhorias de Arquitetura
1. **Microservices**: Separar key server
2. **Redis**: WebSocket scaling
3. **Rate Limiting**: Abuse prevention
4. **Monitoring**: Prometheus + Grafana

## 🆕 Melhorias Implementadas

### v1.3 - Robustez e Confiabilidade (Outubro 2025)
- ✅ **Error Handling Completo**: Try-catch em todos os endpoints críticos
- ✅ **Validação de Usuários**: Verificação prévia antes de iniciar X3DH
- ✅ **Mensagens de Erro Específicas**: Feedback claro para cada cenário
- ✅ **Logging Detalhado**: Rastreamento completo para debugging
- ✅ **API Responses Padronizadas**: Estrutura consistente de erro/sucesso

### v1.2 - UX e Segurança (Dezembro 2024)
- ✅ **Logout Inteligente**: Sistema dual de logout preservando dados por padrão
- ✅ **Interface Minimalista**: Remoção de alertas e notificações para foco essencial
- ✅ **Storage Seletivo**: Controle granular sobre persistência de dados
- ✅ **Confirmações UX**: Proteção contra ações destrutivas acidentais

### Componentes Afetados:
```typescript
// ChatScreen.tsx - Logout behavior
function handleLogout() {        // Preserva dados
function handleCompleteLogout()  // Limpeza total

// ConversationManager.tsx - Interface simplificada
// Removido: Sistema de badges de notificação
// Removido: Animações de pulse para mensagens
```

---

**Esta arquitetura foi projetada para fins educacionais, demonstrando os conceitos fundamentais de criptografia end-to-end em uma aplicação real.**