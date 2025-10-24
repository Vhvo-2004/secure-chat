# Componentização do frontend

Este documento descreve em detalhes como o frontend do Secure Chat foi componentizado. A intenção é orientar novas contribuições e garantir consistência entre telas que compartilham fluxos semelhantes de criptografia ponta a ponta.

## Entrypoints principais

- `src/main.jsx` monta a árvore React com `<App />`, envolta por `React.StrictMode` e importação global de estilos (`index.css`).
- `src/App.jsx` é deliberadamente fino: apenas importa `App.css` e delega toda a composição visual para `AppRoutes`.
- `src/routes/AppRoutes.jsx` encapsula o roteamento com `react-router-dom`, expondo a tela integrada (`/`) e páginas de protótipo para futuros módulos de grupos.

Essa separação permite testar o roteamento isoladamente e manter o bundle principal sem lógica de layout.

## Organização por domínios

Os componentes estão agrupados em subpastas dentro de `src/components`, cada qual responsável por uma área funcional:

### 1. Layout (`components/layout`)

| Componente | Responsabilidade | Principais props |
|------------|-----------------|------------------|
| `AppHeader.jsx` | Renderiza o cabeçalho fixo com branding e ações de sessão. Alterna entre formulário de registro (usuário anônimo) e informações do usuário autenticado. | `currentUser`, `usernameInput`, callbacks de registro, logout e atualização de campo |

O cabeçalho não conhece detalhes criptográficos; ele apenas encaminha eventos para o hook de orquestração.

### 2. Utilidades comuns (`components/common`)

| Componente | Responsabilidade | Observações |
|------------|-----------------|-------------|
| `StatusBanner.jsx` | Exibe mensagens de status globais (sucesso/erro) sempre que há feedback do hook `useSecureChat`. Retorna `null` quando não há mensagem, evitando nós extras. | Ideal para mensagens de fluxo como "Gerando par de chaves" |

### 3. Usuários (`components/users`)

| Componente | Responsabilidade | Principais props |
|------------|-----------------|------------------|
| `UserList.jsx` | Lista usuários cadastrados, ocultando o usuário corrente e qualquer conteúdo quando não há sessão válida. | `users`, `currentUserId` |

### 4. Grupos (`components/groups`)

| Componente | Responsabilidade | Principais props |
|------------|-----------------|------------------|
| `GroupCreateForm.jsx` | Formulário completo para criação de grupos e disparo de compartilhamentos de chave 3DES. Administra o grid de seleção de membros e bloqueia submissão enquanto `isBusy`. | `users`, `currentUserId`, `groupName`, `selectedMembers`, callbacks para mudanças e envio |
| `GroupList.jsx` | Lista de grupos disponíveis, destacando o selecionado e informando o status da chave local (aguardando, fingerprint divergente, etc.). | `groups`, `groupKeys`, `selectedGroupId`, `onSelectGroup` |
| `PendingSharesList.jsx` | Exibe convites pendentes com detalhes do remetente e fingerprint esperada. Aciona `onAccept` ao importar a chave compartilhada. | `pendingShares`, `onAccept` |

Esses componentes são agnósticos do protocolo X3DH: recebem apenas dados já normalizados pelo hook principal e retornam eventos brutos (IDs, strings).

### 5. Mensageria (`components/chat`)

| Componente | Responsabilidade | Principais props |
|------------|-----------------|------------------|
| `ChatPanel.jsx` | Painel central do chat. Resolve estados vazios (sem usuário/grupo), renderiza mensagens decifradas e controla o formulário de envio. | `currentUser`, `selectedGroup`, `messages`, `users`, `messageInput`, `onMessageChange`, `onSendMessage`, `groupKey` |

`ChatPanel` recebe o material criptográfico pronto (`groupKey`) e invoca `decryptMessage3DES` localmente para cada mensagem, garantindo que o log auditável reflita exatamente o que o usuário visualiza.

### 6. Diário criptográfico (`components/logs`)

| Componente | Responsabilidade | Observações |
|------------|-----------------|-------------|
| `CryptoLog.jsx` | Renderiza a linha do tempo detalhada das operações de X3DH/3DES. Usa listas aninhadas para motivos e artefatos (fingerprints, IVs, envelopes). | Recebe uma coleção de `entries` já enriquecidas com `phase`, `title`, `description` e metadados |

O layout em colunas garante que o diário seja opcional (quando `entries` está vazio, exibe uma mensagem contextual).

## Páginas e roteamento

- `pages/SecureChatPage.jsx` é a composição principal. Ele consome `useSecureChat` e instancia todos os componentes acima, distribuídos em colunas responsivas (`column`, `column wide`, etc.).
- O hook expõe `state` e `actions`, permitindo encadear propriedades e callbacks diretamente na marcação JSX.
- Páginas em `pages/groups/*` são mockadas: servem como blueprint para futuras telas autônomas (overview, chat dedicado, gerenciamento de membros), reaproveitando classes de estilo (`page-container`, `card`, `chat`).

## Hook orquestrador (`hooks/useSecureChat.js`)

O hook concentra a lógica de estado e comunicação com a API:

- Mantém stores locais (`users`, `groups`, `groupKeys`, `pendingShares`, `messages`, etc.).
- Persiste informações sensíveis em `localStorage`/`sessionStorage` com chaves namespaced.
- Expõe ações idempotentes: `handleRegisterUser`, `handleCreateGroup`, `handleSendMessage`, `handleShare`, entre outras.
- Disponibiliza helpers como `resolveGroupKey` (recupera e valida a chave do grupo antes de repassar ao `ChatPanel`).

Ao manter o protocolo X3DH encapsulado no hook, os componentes permanecem declarativos e facilmente testáveis.

## Estilização compartilhada

Todos os componentes consomem classes definidas em `App.css`. A adição de `overflow-wrap: anywhere` e `word-break: break-word` nas entradas do diário evita que fingerprints ou blobs Base64 extravasem o cartão visual, preservando a responsividade sem truncar conteúdo sensível.

## Diretrizes para novos componentes

1. **Receba apenas dados normalizados**: deixe serialização, parsing e fallback de chaves para hooks ou utilitários.
2. **PropTypes obrigatórios**: declare-os para documentar o contrato e facilitar o consumo em Storybook/Testes futuros.
3. **Retorne `null` para estados vazios**: reduz markup desnecessário e simplifica o layout responsivo.
4. **Reutilize classes existentes** (`card`, `list`, `column`) para manter consistência visual.
5. **Centralize efeitos colaterais** (HTTP, storage) em hooks, mantendo componentes como funções puras.

Seguindo essas práticas, a evolução do frontend permanece previsível, com cada componente focado em uma única responsabilidade.
