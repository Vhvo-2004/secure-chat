# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-10-12

### Adicionado
- Validação prévia de usuários antes de iniciar conversas
- Verificação HEAD request para existência de key bundles
- Tratamento completo de erros com try-catch em todos os endpoints críticos
- Mensagens de erro específicas para diferentes cenários
- Logging detalhado para debugging
- Comentários de documentação no código fonte
- Arquivo .gitignore inteligente para controle de versionamento

### Corrigido
- **CRÍTICO**: Erro 500 em `/sessions/initiate` quando usuário destinatário não existe
- **CRÍTICO**: Erro 404 confuso em `/conversations/with/:username`
- Variáveis undefined (`recipientId`, `conversationId`) no backend
- ConversationId não sendo retornado corretamente para o frontend
- Tratamento inadequado de casos edge (usuário inexistente)

### Melhorado
- UX: Feedback imediato quando usuário destinatário não existe
- Backend: Error handling robusto com mensagens padronizadas
- Frontend: Validação prévia evita tentativas desnecessárias de X3DH
- Código: Removidos arquivos duplicados (.js compilados)
- Estrutura: Limpeza de endpoints legacy não utilizados

### Técnico
- Refatoração do endpoint `/sessions/initiate` com validação completa
- Melhoria do `ConversationManager.tsx` com pre-flight validation
- Implementação de mensagens de erro estruturadas no backend
- Otimização do fluxo de criação de conversas no frontend

## [1.2.0] - 2024-12-01

### Adicionado
- Sistema de logout dual (normal vs. completo)
- Confirmações para ações destrutivas
- Interface minimalista sem alertas desnecessários
- Polling adaptativo (3s ativo, 30s background)
- Storage seletivo para dados de usuário

### Melhorado
- UX: Preservação de dados por padrão no logout
- Interface: Remoção de elementos visuais desnecessários
- Performance: Polling inteligente baseado na atividade do usuário

## [1.1.0] - 2024-11-01

### Adicionado
- Chat assíncrono funcional com REST API
- Sistema de message queue com status tracking
- Persistência de mensagens entre sessões
- Criptografia robusta X3DH + 3DES-CBC + HMAC-SHA256

### Implementado
- Protocolo X3DH completo para estabelecimento de chaves
- Polling para sincronização de mensagens em tempo real
- Armazenamento seguro de chaves criptográficas com AES-GCM
- Interface React com componentes modulares

## [1.0.0] - 2024-10-01

### Adicionado
- Estrutura inicial do monorepo (backend + frontend + crypto)
- Implementação básica do protocolo X3DH
- Sistema de autenticação com JWT
- Banco de dados PostgreSQL com schema completo
- Testes unitários para componentes criptográficos
- Documentação técnica (README, ARCHITECTURE, SECURITY)

### Funcionalidades Iniciais
- Registro e login de usuários
- Geração e publicação de key bundles
- Estabelecimento básico de sessões criptográficas
- Interface de desenvolvimento para testes

---

## Tipos de Mudanças
- **Adicionado** para novas funcionalidades
- **Alterado** para mudanças em funcionalidades existentes
- **Descontinuado** para funcionalidades que serão removidas
- **Removido** para funcionalidades removidas
- **Corrigido** para correções de bugs
- **Segurança** para vulnerabilidades corrigidas
- **Técnico** para mudanças internas sem impacto no usuário