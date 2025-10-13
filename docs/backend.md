# Backend NestJS

Este documento detalha a implementação do backend baseado em NestJS e MongoDB, incluindo módulos, serviços, esquemas e fluxos relevantes.

## Visão geral

- **Framework**: NestJS 10
- **Banco**: MongoDB com ODM Mongoose
- **Scripts**: `scripts/ensure-mongo.js` e `scripts/start-dev.js` auxiliam no provisionamento do banco para desenvolvimento.

A aplicação é estruturada em módulos independentes: `Users`, `Groups`, `KeyExchange` e `Messages`. Cada módulo expõe controllers REST e utiliza services para encapsular a lógica de negócio.

## Estrutura de diretórios

```
backend/
├─ src/
│  ├─ app.module.ts
│  ├─ users/
│  ├─ groups/
│  ├─ key-exchange/
│  └─ messages/
├─ scripts/
│  ├─ ensure-mongo.js
│  └─ start-dev.js
└─ Dockerfile
```

### `app.module.ts`

- Configura a conexão com o MongoDB utilizando variáveis `DATABASE_URI`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` e `DATABASE_AUTH_SOURCE`.
- Importa os módulos `UsersModule`, `GroupsModule`, `KeyExchangeModule` e `MessagesModule`.
- Habilita CORS e validação global.

## Módulo de Usuários (`UsersModule`)

### DTOs
- `CreateUserDto`: valida displayName, identityKey, signedPreKey e lote de One-Time Pre-Keys.
- `AddPrekeysDto`: permite enviar novas One-Time Pre-Keys quando o estoque está baixo.

### Service (`UsersService`)
- Upsert de usuários (`createOrUpdate`). Converte documentos para objetos planos com `toObject()` para evitar campos `_id`.
- Gerencia o estoque de One-Time Pre-Keys, marcando-as como consumidas durante o X3DH.
- Expõe métodos para consulta de usuários (`findAll`, `findById`).

### Controller (`UsersController`)
- `POST /users`: registra/atualiza uma identidade.
- `GET /users`: lista usuários com campos sanitizados (id string, displayName, chaves públicas).
- `POST /users/:id/prekeys`: adiciona novas One-Time Pre-Keys (não utilizado pelo frontend atual, mas disponível).

## Módulo de Grupos (`GroupsModule`)

### DTOs
- `CreateGroupDto`: recebe nome do grupo, identificador do dono e lista de membros (IDs de usuário) além do fingerprint da chave 3DES.

### Service (`GroupsService`)
- Cria grupos associando o criador e membros iniciais.
- Expõe `addMember` para sincronizar a entrada de novos usuários durante a importação de convites.
- Normaliza as respostas convertendo `members` para strings e preenchendo `owner`.

### Controller (`GroupsController`)
- `POST /groups`: cria o grupo e retorna o objeto completo com `id` string.
- `GET /groups`: permite filtrar por `userId` para obter apenas os grupos de um usuário.

## Módulo de Troca de Chaves (`KeyExchangeModule`)

### DTOs
- `RequestBundleDto`: recebe `receiverId` e `requesterId` para reservar uma One-Time Pre-Key do destinatário.
- `ShareGroupKeyDto`: inclui metadados do grupo, ciphertext e parâmetros do envelope (IV, AAD, salt).
- `ConsumeShareDto`: recebe o `shareId` e `receiverId` para marcar o convite como consumido.

### Service (`KeyExchangeService`)
- `requestBundle`: seleciona uma One-Time Pre-Key disponível do destinatário, marcando-a como usada.
- `shareGroupKey`: cria um `GroupKeyShare` com dados suficientes para o receptor decifrar a chave 3DES.
- `findPendingShares`: retorna convites pendentes populados com referências de `group`, `sender` e `receiver`.
- `consumeShare`: marca o convite como consumido, adiciona o receptor ao grupo via `GroupsService.addMember` e devolve o grupo atualizado.

### Controller (`KeyExchangeController`)
- `POST /key-exchange/request`
- `POST /key-exchange/share`
- `GET /key-exchange/pending/:userId`
- `POST /key-exchange/pending/:shareId/consume`

As respostas são normalizadas para incluir `id` string e remover campos MongoDB internos.

## Módulo de Mensagens (`MessagesModule`)

### DTOs
- `CreateMessageDto`: exige `groupId`, `senderId`, `ciphertext` e `iv`.

### Service (`MessagesService`)
- `create`: grava uma mensagem cifrada com metadados.
- `findByGroup`: recupera mensagens ordenadas por `createdAt` crescente.
- Em ambos os casos, converte documentos para objetos planos para retornar `id` como string.

### Controller (`MessagesController`)
- `POST /groups/:groupId/messages`: delega para `MessagesService.create`.
- `GET /groups/:groupId/messages`: retorna o histórico para o frontend decifrar.

## Esquemas Mongoose

Todos os esquemas são definidos com tipos explícitos (`@Prop({ type: String })`, etc.) para evitar erros de reflexão. Campos relevantes:

- `UserSchema`
  - `identityKey`, `signedPreKey`, `oneTimePreKeys.key`.
  - `oneTimePreKeys.consumed`: marcações booleanas.
- `GroupSchema`
  - `keyFingerprint`: string opcional com default `null`.
- `GroupKeyShareSchema`
  - `keyIv`, `keyAad`, `salt`: buffers armazenados como `String` Base64.
  - `consumedAt`: `Date | null`.
- `MessageSchema`
  - `ciphertext` e `iv` como `String`.

## Serialização e normalização

Para evitar inconsistências entre `_id` e `id`, todos os services utilizam `document.toObject({ versionKey: false })` e adicionam manualmente `id: _id.toString()`. Isso garante que o frontend sempre receba identificadores de forma consistente.

## Tratamento de erros

- **Share não encontrado**: `consumeShare` lança `NotFoundException` caso o `shareId` seja inválido ou já tenha sido consumido.
- **Usuário sem pré-chaves**: `requestBundle` lança `BadRequestException` se não houver One-Time Pre-Key disponível.
- **Validação**: decorators `class-validator` garantem que as entradas tenham o formato esperado.

## Logs

O NestJS usa o logger padrão. Os scripts de bootstrap imprimem mensagens amigáveis quando não conseguem iniciar o MongoDB automaticamente.

## Scripts auxiliares

### `scripts/ensure-mongo.js`

- Tenta conectar no MongoDB usando `DATABASE_URI` ou `mongodb://localhost:27017`.
- Se falhar, executa `docker compose up -d mongodb` (requer Docker e permissão no socket).
- Se o comando Docker falhar, tenta iniciar uma instância `mongodb-memory-server` (dependência opcional).
- Exporta a string de conexão via `process.env.DATABASE_URI` quando usa o fallback em memória.
- Trata exceções com mensagens claras e sugere ações corretivas.

### `scripts/start-dev.js`

- Executa `ensure-mongo`.
- Ao obter sucesso, inicia `nest start --watch` (`npm run start:dev:native`).
- Propaga sinais de encerramento para finalizar eventuais instâncias temporárias do MongoDB.

### `scripts/reset-db.js`

- Reaproveita o `ensure-mongo` para garantir que haja uma instância de MongoDB acessível.
- Resolve a URI de conexão com as mesmas variáveis utilizadas pelo `AppModule`.
- Limpa todas as coleções com `deleteMany({})`, preservando índices e a estrutura do banco.
- Pode ser executado via `npm run db:purge` (dentro da pasta `backend/`).

## Considerações finais

O backend está pronto para receber melhorias como auditoria de eventos, limites de taxa, autenticação adicional ou suporte a múltiplos algoritmos de cifra. Mantenha a normalização de IDs e o encapsulamento da lógica de negócio nos services ao realizar novas alterações.
