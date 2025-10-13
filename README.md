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
- Backend NestJS: `http://localhost:3000`
- MongoDB: `localhost:27017`

Para executar o frontend, abra um novo terminal:

```bash
cd frontend
npm install  # apenas para instalar dependências locais
VITE_API_URL=http://localhost:3000 npm run dev -- --host 0.0.0.0 --port 5173
```

Acesse `http://localhost:5173`.

> **Dica:** o frontend assume por padrão `http://localhost:3000` como base da API. Ajuste a variável `VITE_API_URL` caso exponha o backend em outra porta/host.

> **Nota:** caso não possua acesso externo ao npm, as dependências já estão vendorizadas no repositório (`node_modules`).

### 2. Execução manual (sem Docker)

1. **Banco de dados** – o comando `npm run start:dev` do backend agora verifica se há MongoDB disponível em `localhost:27017`.
   - Caso não encontre uma instância ativa, ele tentará automaticamente executar `docker compose up -d mongodb` na raiz do projeto (requer Docker instalado e permissão para acessar `/var/run/docker.sock`).
   - Se o Docker não estiver disponível, se ocorrer erro de permissão ou o container não iniciar a tempo, o script pode criar uma instância temporária usando [`mongodb-memory-server`](https://github.com/nodkz/mongodb-memory-server) (execute `npm install --save-dev mongodb-memory-server` dentro da pasta `backend` para habilitar o fallback). A string de conexão será exportada via `DATABASE_URI` e a instância é finalizada automaticamente quando o processo termina.
   - Se preferir iniciar o banco manualmente ou estiver usando outro host/porta, defina `AUTO_START_MONGO=false` antes de rodar o script. Nesse cenário, garanta que as variáveis `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` (ou diretamente `DATABASE_URI`) estejam configuradas.
   - Recebeu uma mensagem de que nem o Docker nem o fallback puderam ser utilizados? Suba o MongoDB manualmente (por exemplo, `docker compose up mongodb` em um terminal com privilégios) ou instale o fallback e execute novamente.

2. **Backend**

```bash
cd backend
npm install
npm run start:dev
```

   - Para iniciar o NestJS sem a verificação automática, utilize `npm run start:dev:native`.
   - Para builds fora do modo watch, rode `npm run build` diretamente dentro da pasta `backend`. O comando `npm run build --prefix backend` só funciona a partir da raiz do repositório.

3. **Frontend**

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

## Guia passo a passo: criando e usando um chat seguro

1. **Registrar identidade**
   - Informe um nome de usuário e clique em **Gerar identidade & registrar**.
   - O navegador gera par de chaves X25519 para cifragem, assina uma Signed Pre-Key e cria 10 One-Time Pre-Keys.
   - Apenas as chaves públicas são enviadas ao backend; o restante permanece em `localStorage`.

2. **Convidar participantes e criar o grupo**
   - Após registrar-se, utilize o painel “Usuários disponíveis” para selecionar quem participará.
   - Clique em **Criar grupo**, defina um nome e confirme. Automaticamente:
     - Uma chave 3DES aleatória de 24 bytes é gerada no cliente.
     - Para cada convidado, o frontend solicita ao backend o bundle público (`/key-exchange/request`).
     - O X3DH é executado localmente e o segredo resultante encapsula a chave 3DES, enviada via `/key-exchange/share`.

3. **Aceitar convites**
   - Usuários convidados verão notificações na coluna “Convites pendentes”.
   - Ao clicar em **Importar chave**, o aplicativo:
     - Recupera o pacote X3DH, decapsula a chave 3DES e grava o fingerprint localmente.
     - Marca o convite como consumido em `/key-exchange/pending/:shareId/consume`.
     - O cartão do convite exibe o nome do grupo e o fingerprint esperado; após a importação o grupo correspondente deixa o
       estado “Chave aguardando” e passa a mostrar o fingerprint salvo, confirmando que a chave foi sincronizada.

4. **Enviar e receber mensagens**
   - Com a chave 3DES disponível, basta selecionar o grupo e digitar a mensagem.
   - O texto é cifrado com DES-EDE3-CBC (PKCS#7) antes de ser enviado para `/groups/:groupId/messages`.
   - Mensagens recebidas são decifradas automaticamente usando a chave local.

5. **Rotina de segurança recomendada**
   - Reimporte sua identidade em um novo navegador copiando o conteúdo salvo em `localStorage`.
   - Caso suspeite de comprometimento, crie um novo grupo para os mesmos participantes; uma nova chave 3DES será distribuída.

## Solução de problemas

- `CannotDetermineTypeError: Cannot determine a type for the "Group.keyFingerprint" field` – ocorre quando o Mongoose não consegue inferir o tipo de uma propriedade opcional. O schema já foi atualizado com `@Prop({ type: String, default: null })`, portanto basta reinstalar e reconstruir o backend (`cd backend && npm install && npm run start:dev`).
- `MongoParseError: Invalid connection string "mongodb://:@:/?authSource="` – indica que as variáveis de ambiente de banco foram deixadas vazias. Remova-as para usar a conexão local padrão ou configure `DATABASE_URI` com a string correta.
- `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` – significa que não há MongoDB escutando no host/porta configurados. Ao executar `npm run start:dev`, o projeto tenta subir `docker compose up -d mongodb` automaticamente; se isso falhar e você tiver instalado `mongodb-memory-server` (`npm install --save-dev mongodb-memory-server`), um MongoDB em memória será iniciado e usado através de `DATABASE_URI`. Caso contrário, suba o banco manualmente ou execute `AUTO_START_MONGO=false npm run start:dev:native` apontando para uma instância acessível.
- `mongodb-memory-server is not installed, so an in-memory MongoDB fallback cannot be started.` – indica que a dependência opcional não está instalada. Entre em `backend/` e rode `npm install --save-dev mongodb-memory-server`, ou então suba o MongoDB manualmente (via Docker ou instalação local) e execute `AUTO_START_MONGO=false npm run start:dev:native`.

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
