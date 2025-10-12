# Secure Chat – X3DH + 3DES

Aplicação de chat segura que combina **Triple Diffie-Hellman (X3DH)** para distribuição de chaves com criptografia simétrica **3DES** por grupo. O projeto contempla backend em NestJS/MongoDB e frontend em React que realiza todo o fluxo de geração de identidade, convite aos grupos e cifragem/decifragem das mensagens no cliente.

## Visão geral da arquitetura

1. **Identidade de usuário** – cada participante gera um bundle local (`IdentityKey`, `SignedPreKey`, `One-Time Pre-Keys`). Somente as chaves públicas são enviadas ao backend.
2. **Distribuição de chaves de grupo** – o criador do grupo gera uma chave 3DES aleatória (24 bytes) e utiliza X3DH para criar sessões seguras com cada convidado. A chave 3DES é encapsulada com o root key derivado e armazenada no backend para que o convidado recupere posteriormente.
3. **Mensagens** – após aceitar o convite, o membro armazena a chave 3DES localmente e passa a cifrar/decifrar mensagens em modo **DES-EDE3-CBC** (implementação pura em JavaScript). O backend nunca acessa as chaves simétricas; apenas persiste envelopes e ciphertexts.

## Principais endpoints

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/users` | Registra/atualiza identidade pública e One-Time Pre-Keys. |
| `GET` | `/users` | Lista usuários registrados. |
| `POST` | `/groups` | Cria um grupo e salva o fingerprint da chave 3DES distribuída. |
| `GET` | `/groups?userId=...` | Lista grupos dos quais o usuário participa. |
| `POST` | `/key-exchange/request` | Reserva um One-Time Pre-Key do convidado e devolve o bundle público. |
| `POST` | `/key-exchange/share` | Persiste o pacote X3DH + chave 3DES cifrada para um destinatário. |
| `GET` | `/key-exchange/pending/:userId` | Convites pendentes para o usuário. |
| `POST` | `/key-exchange/pending/:shareId/consume` | Marca convite como consumido após importar a chave. |
| `POST` | `/groups/:groupId/messages` | Persiste mensagem cifrada (ciphertext + IV). |
| `GET` | `/groups/:groupId/messages` | Recupera mensagens cifradas de um grupo. |

## Como executar

### 1. Via Docker Compose

```bash
docker compose up --build
```

Serviços expostos:
- Backend NestJS: `http://localhost:8080`
- MongoDB: `localhost:27017`

Para executar o frontend, abra um novo terminal:

```bash
cd frontend
npm install  # apenas para instalar dependências locais
npm run dev -- --host 0.0.0.0 --port 5173
```

Acesse `http://localhost:5173`.

> **Nota:** caso não possua acesso externo ao npm, as dependências já estão vendorizadas no repositório (`node_modules`).

### 2. Execução manual (sem Docker)

1. Certifique-se de ter MongoDB em execução e defina as variáveis de ambiente:

```bash
export DATABASE_HOST=localhost
export DATABASE_PORT=27017
export DATABASE_NAME=chat
export DATABASE_USER=user
export DATABASE_PASSWORD=password
```

2. Backend:

```bash
cd backend
npm install
npm run start:dev
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Fluxo no frontend

1. Gere e registre um usuário – o bundle privado é salvo apenas no navegador (localStorage).
2. Crie um grupo selecionando participantes. O frontend gera a chave 3DES, calcula o fingerprint e envia convites X3DH automaticamente.
3. Convites pendentes aparecem na coluna da esquerda. Ao importar, a chave simétrica é decapsulada e armazenada localmente.
4. As mensagens digitadas são cifradas com 3DES no cliente antes de serem enviadas.

## Implementação 3DES

Foi implementada uma versão reduzida do algoritmo 3DES (DES-EDE3-CBC com PKCS#7) em `frontend/src/crypto/triple-des.js`. A implementação segue FIPS 46-3 e utiliza apenas recursos nativos do browser.

## Estrutura do repositório

```
backend/   # NestJS + Mongoose (API e persistência)
frontend/  # React + Vite (interface, X3DH, 3DES client-side)
shared/    # utilidades compartilhadas (reservado)
```

## Testes rápidos

- `npm run lint` (backend/frontend) – validações estáticas
- `npm run test` (backend) – testes unitários (quando implementados)
- `npm run build` (frontend) – build Vite de produção

## Segurança

- O backend não recebe chaves privadas nem texto plano.
- Cada grupo possui fingerprint da chave 3DES para validação cruzada entre participantes.
- One-Time Pre-Keys são marcadas como consumidas ao serem entregues para garantir sigilo futuro.

## Licença

Projeto para fins acadêmicos/demonstração. Ajuste conforme sua necessidade.
