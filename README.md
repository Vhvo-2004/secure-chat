# Chat E2E (Protótipo Educacional)

Protótipo funcional de chat end-to-end usando X3DH para estabelecimento de chaves e 3DES-CBC + HMAC-SHA256 para criptografia de mensagens.

## ✅ Status do Projeto

**FUNCIONAL E OPERACIONAL (REST-ONLY)**

### 🔧 Correções Críticas Implementadas (v1.4)

- ✅ **X3DH Protocol Compliance**: Chaves ephemeral únicas por sessão
- ✅ **One-Time Key Matching**: Fallback automático para IDs (`Bob:otpk-0` → `otpk-0`)
- ✅ **Polling Timestamp Sync**: Always update com serverTimestamp
- ✅ **MAC Verification**: Eliminados erros de MAC mismatch
- ✅ **Error Recovery**: Tratamento robusto de casos edge

### 🎯 Funcionalidades Principais

- ✅ **X3DH Protocol**: Implementação completa com Ed25519/X25519
- ✅ **Registro de Usuários**: Geração automática de key bundles
- ✅ **Handshake Criptográfico**: Estabelecimento seguro de chaves
- ✅ **Criptografia E2E**: 3DES-CBC + HMAC-SHA256
- ✅ **Chat Assíncrono**: REST API + Polling adaptativo (3s ativo, 30s background)
- ✅ **Message Queue**: Sistema de delivery assíncrono com status tracking
- ✅ **Logout Inteligente**: Preserva histórico por padrão, opção de limpeza completa
- ✅ **Interface Simplificada**: Foco na comunicação essencial
- ✅ **Banco PostgreSQL**: Schema completo com sessões, conversas, chaves
- ✅ **Frontend React**: Interface limpa com polling automático
- ✅ **Testes**: Cobertura total para backend, frontend e crypto

## 🚀 Como Usar

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- Docker (opcional)

### Instalação

1. **Clone e instale dependências:**
```bash
git clone <repo-url>
cd Redes_II
npm install
```

2. **Configure o banco de dados:**
```bash
# Com Docker
docker-compose up -d

# Ou PostgreSQL local
createdb chat_e2e
```

3. **Execute o projeto:**
```bash
npm run dev
```

4. **Acesse a aplicação:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Testando o Chat E2E

1. **Registre dois usuários** (ex: Alice e Bob)
   - ⚠️ **Importante**: Ambos usuários devem fazer registro E login pelo menos uma vez
2. **Alice inicia conversa** com Bob (estabelece X3DH)
   - ✅ Sistema agora valida se Bob existe antes de tentar conectar
3. **Troque mensagens** - todas são criptografadas E2E
4. **Teste o logout**: Use "Logout Normal" para preservar histórico
5. **Verifique os logs** do console para acompanhar o processo criptográfico

### Funcionalidades da Interface

- **Validação de Usuários**: Verifica se destinatário existe antes de iniciar conversa
- **Mensagens de Erro Claras**: Feedback específico para diferentes problemas
- **Logout Normal**: Mantém mensagens e chaves de conversa (padrão)
- **Logout Completo**: Remove todos os dados (com confirmação)
- **Polling adaptativo**: Atualização automática de mensagens (REST-only)
- **Logs criptográficos**: Todas as etapas e chaves exibidas apenas no frontend
- **Interface limpa**: Sem alertas ou notificações desnecessárias

## 🏗️ Arquitetura

### Monorepo Structure
```
├── backend/           # API Fastify + PostgreSQL (REST-only)
├── frontend/          # Interface React + Polling adaptativo
├── packages/crypto/   # Primitivas criptográficas compartilhadas
└── docs/              # Documentação técnica
```

### Fluxo de Criptografia

1. **Registro**: Usuário gera material criptográfico (IK, SPK, OTKs)
2. **X3DH Handshake**: Estabelecimento de chaves compartilhadas
3. **Envio/Recepção de Mensagens**: Criptografia 3DES-CBC + HMAC-SHA256
4. **Logs Educacionais**: Todas as etapas e chaves exibidas no painel do frontend
5. **Polling REST**: Mensagens sincronizadas via REST, sem WebSocket

## 🧪 Primitivas Criptográficas

- **Curvas Elípticas**: Ed25519 (assinaturas) + X25519 (ECDH)
- **Derivação de Chaves**: HKDF com SHA-256
- **Criptografia Simétrica**: 3DES-CBC (educacional)
- **Autenticação**: HMAC-SHA256
- **Protocolo**: X3DH (Signal Protocol Foundation)

## 📊 Scripts Disponíveis

```bash
# Instalar dependências
npm install

# Desenvolvimento (backend + frontend)
npm run dev

# Apenas backend
npm run dev:backend

# Apenas frontend  
npm run dev:frontend

# Testes
npm test

# Build completo
npm run build

# Verificação de tipos
npm run typecheck
```

## ⚠️ Avisos de Segurança

**APENAS PARA FINS EDUCACIONAIS**

- 3DES é considerado legado (use AES-GCM em produção)
- Sem forward secrecy (implementar Double Ratchet)
- Sem auditoria de segurança externa
- Pool de OTK pode esgotar sem monitoramento

Veja [SECURITY.md](./SECURITY.md) para detalhes completos.

## 🔄 Próximos Passos

1. **Migração para AES-GCM**: Substituir 3DES
2. **Double Ratchet**: Implementar forward secrecy
3. **Key Verification**: Sistema de fingerprints
4. **Performance**: Otimizações de memória e rede

## 🆕 Melhorias Recentes

### v1.3 - Estabilidade e UX (Outubro 2025)
- ✅ **Correções Críticas**: Resolvidos erros 404/500 ao iniciar conversas
- ✅ **Validação Prévia**: Sistema agora verifica se usuário destinatário existe
- ✅ **Mensagens Claras**: Feedback específico para cada tipo de erro
- ✅ **Backend Robusto**: Try-catch completo com tratamento de edge cases
- ✅ **Limpeza de Código**: Removidos arquivos duplicados e endpoints legados
- ✅ **GitIgnore Inteligente**: Controle adequado de versionamento

### v1.2 - Interface Simplificada (Dezembro 2024)
- ✅ **Logout Inteligente**: Preserva mensagens por padrão, opção de limpeza total
- ✅ **UI Minimalista**: Removido sistema de alertas e notificações desnecessárias
- ✅ **UX Melhorada**: Confirmações para ações destrutivas e transparência

### v1.1 - Chat Funcional Completo
- ✅ **Chat assíncrono**: REST API + Polling adaptativo
- ✅ **Criptografia robusta**: X3DH + 3DES-CBC + HMAC-SHA256
- ✅ **Persistência**: Mensagens e chaves mantidas entre sessões

## 📚 Recursos de Aprendizagem

- [X3DH Specification](https://signal.org/docs/specifications/x3dh/)
- [Signal Protocol Overview](https://signal.org/docs/)
- [Noble Cryptography Library](https://github.com/paulmillr/noble-secp256k1)

---

**Projeto desenvolvido para fins educacionais em Redes II - Demonstração de protocolos criptográficos modernos**
