# Guia de configuração e execução

Este guia explica como colocar o Secure Chat em funcionamento em diferentes cenários (Docker, desenvolvimento local e produção). Inclui todos os pré-requisitos, variáveis de ambiente e comandos necessários.

## Pré-requisitos

- Node.js >= 18
- npm >= 9
- Docker + Docker Compose (opcional, porém recomendado)
- Acesso à porta `3000` (backend), `27017` (MongoDB) e `5173` (frontend)

## Variáveis de ambiente

| Variável | Descrição | Default |
| --- | --- | --- |
| `DATABASE_URI` | String de conexão completa com MongoDB. | `mongodb://localhost:27017/secure-chat` |
| `DATABASE_HOST` | Host utilizado quando `DATABASE_URI` não é informado. | `localhost` |
| `DATABASE_PORT` | Porta do MongoDB. | `27017` |
| `DATABASE_NAME` | Nome do banco. | `secure-chat` |
| `DATABASE_USER` | Usuário para autenticação. | _vazio_ |
| `DATABASE_PASSWORD` | Senha do usuário. | _vazio_ |
| `DATABASE_AUTH_SOURCE` | Database de autenticação. | _vazio_ |
| `AUTO_START_MONGO` | Controla se o script de desenvolvimento deve tentar iniciar o MongoDB automaticamente. | `true` |
| `VITE_API_URL` | URL base da API consumida pelo frontend. | `http://localhost:3000` |

> Em produção, configure `DATABASE_URI` com credenciais seguras e utilize HTTPS para servir o frontend.

## Execução com Docker Compose

1. Navegue até a raiz do projeto.
2. Execute:

```bash
docker compose up --build
```

### Serviços iniciados
- **backend**: NestJS exposto em `http://localhost:3000`.
- **mongodb**: Banco de dados persistente (volume `mongo-data`).

O frontend não possui container dedicado. Para utilizá-lo:

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:3000 npm run dev -- --host 0.0.0.0 --port 5173
```

A aplicação ficará disponível em `http://localhost:5173`.

## Execução manual (sem Docker)

### 1. Inicializar o MongoDB

- Se já possui um MongoDB local, garanta que esteja ativo em `localhost:27017`.
- Caso contrário, utilize o script automático que tenta subir o container `mongodb` ou um fallback em memória.

### 2. Backend

```bash
cd backend
npm install
npm run start:dev
```

O comando acima executa `scripts/start-dev.js`, que segue o seguinte fluxo:

1. Tenta conectar ao MongoDB usando `DATABASE_URI`.
2. Se falhar, executa `docker compose up -d mongodb`.
3. Se não houver permissão para usar Docker, tenta iniciar `mongodb-memory-server` (instale com `npm install --save-dev mongodb-memory-server`).
4. Exporta `DATABASE_URI` com a string de conexão obtida (inclusive para o fallback em memória).
5. Inicializa o NestJS em modo watch (`npm run start:dev:native`).

#### Comandos alternativos

- `npm run start:dev:native`: inicia o NestJS diretamente sem checar MongoDB.
- `npm run build`: gera artefatos de produção (`dist/`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Utilize `VITE_API_URL` quando o backend estiver em host/porta diferente:

```bash
VITE_API_URL=https://api.meuservico.com npm run dev
```

### 4. Testes rápidos

- `npm run build --prefix backend`
- `npm run build --prefix frontend`

Use esses comandos para validar se o código compila antes de abrir pull requests.

## Deploy em produção

1. Execute `npm run build` em `backend/` e `frontend/`.
2. Sirva o diretório `frontend/dist` via CDN ou servidor estático.
3. Publique o backend (por exemplo, usando PM2 ou Docker). Certifique-se de configurar as variáveis de ambiente do banco.
4. Habilite HTTPS, preferencialmente atrás de um reverse proxy (Nginx ou Traefik).

## Importação/exportação de dados

- O MongoDB persiste dados em `mongo-data` (quando usando Docker). Faça backup do volume periodicamente.
- Chaves privadas ficam apenas no navegador. Para migrar usuários, exporte manualmente o conteúdo de `localStorage` (`secure-chat.identity`, `secure-chat.groupKeys`, `secure-chat.sessions`).

## Limpeza

- Parar containers: `docker compose down`
- Remover volume: `docker compose down -v`

## Checklist pós-instalação

- [ ] Backend responde em `http://localhost:3000/health` (ou endpoint equivalente).
- [ ] Frontend acessa a API sem erros CORS.
- [ ] Usuário consegue registrar identidade e visualizar lista de usuários.
- [ ] Criação de grupo distribui convites corretamente.
- [ ] Segundo usuário consegue aceitar convite e enviar mensagens.

Com esses passos o projeto deve operar corretamente no ambiente desejado. Consulte [`troubleshooting.md`](troubleshooting.md) caso encontre problemas específicos.
