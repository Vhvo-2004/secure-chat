# Frontend React

Este documento descreve a camada de apresentação implementada com React + Vite, responsável por toda a experiência do usuário, geração de chaves e execução de criptografia no navegador.

## Stack e dependências

- **React 18** com hooks e estado local.
- **Vite** para desenvolvimento e build de produção.
- **pure JavaScript** para algoritmos criptográficos (sem dependências nativas externas).
- **LocalStorage** para persistir chaves privadas e configurações por usuário.

## Estrutura de diretórios relevante

```
frontend/
├─ src/
│  ├─ App.jsx
│  ├─ App.css
│  ├─ crypto/
│  │  ├─ triple-des.js
│  │  ├─ utils.js
│  │  └─ x3dh.js
│  └─ index.css
└─ vite.config.js
```

## Organização da interface (`App.jsx`)

A interface está dividida em três colunas principais:

1. **Painel de identidade e convites**
   - Botão **Gerar identidade & registrar**.
   - Lista de convites pendentes com informações do grupo, fingerprint esperado e botões para aceitar.
   - Indicadores de status (aguardando chave, chave importada, convite consumido).

2. **Painel de usuários e grupos**
   - Tabela com usuários disponíveis e checkbox para seleção ao criar novo grupo.
   - Formulário para definir o nome do grupo e criar convites.
   - Lista de grupos aos quais o usuário pertence, exibindo fingerprint da chave sincronizada.

3. **Painel de mensagens**
   - Histórico de mensagens cifradas/decifradas.
   - Formulário de envio de mensagem com validações.

## Estado e armazenamento

- **`useState`** gerencia coleções como `users`, `groups`, `pendingShares`, `messages`.
- **`useEffect`** realiza sincronização inicial e polling leve após eventos (ex.: aceitar convite).
- **LocalStorage** armazena:
  - `secure-chat.identity`: chaves privadas X25519/Ed25519 e metadados.
  - `secure-chat.sessions`: dados de sessões X3DH por contato (utilizados para envelopes).
  - `secure-chat.groupKeys`: chaves 3DES e fingerprints por grupo.

Os dados armazenados localmente nunca são enviados ao backend, garantindo que as chaves privadas permaneçam no cliente.

## Fluxos principais

### 1. Registro de identidade
- Geração local de chaves através de utilitários em `crypto/x3dh.js`.
- Envio de `POST /users` com chaves públicas e metadados.
- Atualização do estado `currentUser` e armazenamento das chaves privadas.

### 2. Criação de grupo
- Seleção de participantes -> `selectedUserIds`.
- Geração de chave 3DES em `crypto/triple-des.js` + `crypto/utils.js`.
- Fingerprint calculado com SHA-256 e convertido para Base64.
- Invocações a `POST /key-exchange/request` e `POST /key-exchange/share` em série para cada convidado.
- Criação do grupo via `POST /groups` e sincronização da lista local.

### 3. Aceitação de convite
- Chamada `GET /key-exchange/pending/:userId` para obter convites com dados populados.
- Ao aceitar, reconstrução do X3DH usando `crypto/x3dh.js` e decapsulamento AES-GCM para obter a chave 3DES.
- Persistência da chave em `localStorage`, atualização do grupo e remoção do convite do estado.

### 4. Envio e leitura de mensagens
- Recuperação da chave 3DES pelo `groupId` no armazenamento local.
- Cifragem/decifragem usando `crypto/triple-des.js` com modo DES-EDE3-CBC e padding PKCS#7.
- `POST /groups/:groupId/messages` envia apenas texto cifrado + IV.
- `GET /groups/:groupId/messages` popula o histórico que é decifrado no cliente.

## Tratamento de erros

- Todas as chamadas HTTP passam por `fetchJson`, que adiciona mensagens amigáveis na interface em caso de falha.
- Caso a API retorne 404/409 ao compartilhar chaves, o frontend remove membros inválidos e exibe alertas sem travar o fluxo.
- O estado impede que convites sem `receiverId` sejam processados.

## Estilos (`App.css` e `index.css`)

- Layout responsivo com grid de três colunas para desktops.
- Utilização de variáveis CSS para cores e espaçamento.
- Destaque para estados de erro e sucesso (ex.: cartões de convite, status do fingerprint).

## Construção e execução

- `npm run dev`: ambiente local com hot reload.
- `npm run build`: gera assets otimizados, utilizados pelo Dockerfile do frontend (quando existir).
- Variável `VITE_API_URL`: define a base da API. O default é `http://localhost:3000`.

## Próximas melhorias sugeridas

- Migração para gerenciador de estado (ex.: Zustand ou Redux) se o número de componentes crescer.
- Armazenamento seguro (ex.: WebCrypto + IndexedDB) para chaves privadas.
- UI para exportar/importar identidade manualmente.

Este frontend foi projetado para funcionar com o backend descrito em [`backend.md`](backend.md), mantendo todas as operações sensíveis dentro do navegador.
