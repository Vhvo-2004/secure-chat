# Solução de problemas

Esta seção reúne erros comuns observados durante a configuração e uso do Secure Chat, com orientações para diagnóstico e correção.

## Erros relacionados ao MongoDB

### `CannotDetermineTypeError: Cannot determine a type for ...`
- **Causa**: falta de metadados de tipo em esquemas Mongoose.
- **Status**: já endereçado no código adicionando `@Prop({ type: String })` e defaults adequados.
- **Ação**: certifique-se de que a versão mais recente foi instalada (`cd backend && npm install`).

### `MongoParseError: Invalid connection string "mongodb://:@:/?authSource="`
- **Causa**: variáveis de ambiente vazias resultam em string inválida.
- **Correção**: remova as variáveis `DATABASE_USER`, `DATABASE_PASSWORD` e `DATABASE_AUTH_SOURCE` quando não usadas ou defina `DATABASE_URI` completo.

### `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`
- **Causa**: MongoDB não está em execução na porta configurada.
- **Correção**:
  1. Execute `npm run start:dev` (o script tentará iniciar Docker ou fallback em memória).
  2. Se faltar permissão para Docker, instale `mongodb-memory-server` (dentro de `backend/`) e execute novamente.
  3. Alternativamente, suba o MongoDB manualmente e defina `AUTO_START_MONGO=false`.

### `mongodb-memory-server is not installed`
- **Causa**: fallback opcional não está disponível.
- **Correção**: `cd backend && npm install --save-dev mongodb-memory-server`.

## Erros no script de desenvolvimento

### `permission denied while trying to connect to the Docker daemon socket`
- **Causa**: usuário sem permissão para acessar `/var/run/docker.sock`.
- **Correção**: adicione o usuário ao grupo `docker` ou execute o comando com privilégios elevados.
- **Alternativa**: desabilite o auto-start via `AUTO_START_MONGO=false` e utilize um MongoDB manual.

### `Cannot find module 'mongodb-memory-server'`
- **Causa**: fallback não instalado quando Docker não está disponível.
- **Correção**: instale a dependência (`npm install --save-dev mongodb-memory-server`) ou providencie o MongoDB manualmente.

## Erros de API / Fluxos de grupo

### `Receiver not found (404)` ao compartilhar chave
- **Causa**: membro selecionado não existe ou resposta do backend veio sem `id` normalizado.
- **Correção**: a versão atual normaliza IDs automaticamente. Se persistir, recarregue a lista de usuários antes de criar o grupo.

### Convite fica em "aguardando" indefinidamente
- **Causa**: anteriormente o backend não preservava referências populadas ao retornar convites.
- **Status**: resolvido. Agora `GroupKeyShare` retorna o grupo populado e o frontend associa corretamente o fingerprint.

### Apenas o criador envia mensagens
- **Causa**: receptor não era adicionado ao grupo após consumir o convite.
- **Status**: corrigido. `consumeShare` chama `GroupsService.addMember` e devolve o grupo atualizado.

### `Falha ao aceitar envelope` / "Erro ao importar a chave"
- **Causa**: convite com metadados inconsistentes (por exemplo, OPK reutilizada, índices divergentes ou identidade regenerada).
- **Status**: o frontend agora tenta automaticamente todos os one-time pre-keys armazenados até encontrar uma combinação válida e registra quando um fallback foi necessário.
- **Correção**:
  1. Certifique-se de estar usando a versão mais recente do frontend (recarregue a página para carregar o bundle atualizado).
  2. Ao aceitar o convite, observe o "Diário criptográfico": se aparecer `fallback aplicado`, a chave foi conciliada com sucesso e a OPK correspondente foi removida do bundle local.
  3. Se, mesmo após o fallback, o erro persistir, peça ao remetente para reenviar o convite (um envelope antigo baseado em uma identidade descartada não pode ser recuperado).
  4. Como último recurso, regenere sua identidade (limpe o storage local pelo botão "Encerrar sessão local") e solicite novos convites.


## Problemas no frontend

### Botão "Gerar identidade & registrar" não funciona
- **Causa**: backend inacessível (porta incorreta, CORS ou API fora do ar).
- **Correção**: confirme se o backend está em `http://localhost:3000` e atualize `VITE_API_URL` conforme necessário.

### Erros de CORS
- **Causa**: frontend rodando em host/porta diferente sem configuração CORS.
- **Correção**: o backend já habilita `app.enableCors()`. Caso sirva em domínios diferentes, ajuste as opções de CORS em `main.ts`.

## Boas práticas de diagnóstico

1. **Verifique o log do backend** (`npm run start:dev`) para mensagens amigáveis emitidas pelos scripts.
2. **Observe o console do navegador** para capturar erros de rede ou exceções de JavaScript.
3. **Valide variáveis de ambiente** com `printenv | grep DATABASE` para confirmar configurações.
4. **Reinstale dependências** sempre que atualizar a versão (`npm install` na raiz de cada projeto).

Caso encontre um erro não listado, documente os passos para reproduzir e abra uma issue anexando logs relevantes.
