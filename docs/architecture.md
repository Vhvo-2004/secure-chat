# Arquitetura do Secure Chat

Este documento descreve a arquitetura atual do projeto, contemplando componentes, integrações, fluxos de dados e decisões de design que sustentam o chat seguro.

## Componentes principais

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Frontend | React + Vite | Interface do usuário, geração e armazenamento de chaves, execução do protocolo X3DH no cliente e cifragem 3DES. |
| Backend | NestJS + Mongoose | Exposição dos endpoints REST, orquestração do X3DH, persistência das entidades e dos envelopes criptografados. |
| Banco de dados | MongoDB | Armazena usuários, grupos, convites (GroupKeyShare) e mensagens cifradas. |
| Scripts auxiliares | Node.js | Automatizam o provisionamento do MongoDB para desenvolvimento (`scripts/ensure-mongo.js`). |

## Fluxo de identidade e pré-chaves

1. O usuário acessa o frontend e clica em **Gerar identidade & registrar**.
2. O cliente gera localmente:
   - Chave de identidade (par X25519) e assinatura baseada em Ed25519.
   - Signed Pre-Key e lote de 10 One-Time Pre-Keys.
3. Apenas as chaves públicas são enviadas para o backend via `POST /users`.
4. O backend persiste as chaves, marcando cada One-Time Pre-Key como disponível.

## Criação de grupo e compartilhamento da chave 3DES

1. O criador seleciona integrantes e informa o nome do grupo.
2. O frontend gera uma chave 3DES de 24 bytes e calcula seu fingerprint (SHA-256 truncado).
3. Para cada convidado:
   - Solicita o bundle público do usuário (`POST /key-exchange/request`).
   - Executa o Triple Diffie-Hellman localmente (IK + EK + OPK) para derivar uma root key.
   - Utiliza HKDF para extrair uma chave de encapsulamento AES-GCM e cifrar a chave 3DES + IV + AAD.
   - Envia o pacote para o backend através de `POST /key-exchange/share`.
4. O backend cria um documento `GroupKeyShare` com o ciphertext, dados auxiliares e metadados do grupo.
5. O grupo é registrado (`POST /groups`) com o criador na lista de membros e o fingerprint salvo.

## Aceitação de convite e sincronização de chave

1. O convidado consulta convites pendentes via `GET /key-exchange/pending/:userId`.
2. Ao clicar em **Importar chave**, o frontend:
   - Baixa o pacote e reconstrói a sessão X3DH com suas chaves privadas locais.
   - Decapsula a chave 3DES e verifica o fingerprint com o fornecido pelo grupo.
   - Persiste a chave simétrica e o fingerprint em `localStorage`.
   - Chama `POST /key-exchange/pending/:shareId/consume` para marcar o convite como consumido.
   - O backend adiciona o membro ao grupo e devolve os dados atualizados.

## Troca de mensagens cifradas

1. Mensagens são enviadas pelo frontend através de `POST /groups/:groupId/messages`.
2. Antes de enviar, o texto é cifrado com DES-EDE3-CBC + PKCS#7 utilizando a chave do grupo e um IV aleatório.
3. O backend persiste apenas os bytes cifrados, o IV e metadados (autor, timestamp).
4. O histórico é recuperado com `GET /groups/:groupId/messages`. O frontend decifra mensagem a mensagem usando a chave local.

## Diagrama de sequência textual

```
Usuário A               Backend                   Usuário B
    |                     |                          |
    |--- POST /users ---->|                          |
    |<-- lista usuarios --|                          |
    |--- POST /groups --->|                          |
    |--- share key A->B --|                          |
    |                     |--- notifica convite ---> |
    |                     |<-- GET pending --------- |
    |                     |--- pacote X3DH -------->|
    |                     |<-- consume share ------- |
    |                     |--- adiciona ao grupo --->|
    |<-- GET mensagens ---|--- GET mensagens ------->|
```

## Modelagem de dados

### Usuário (`User`)
- `identityKey`, `signedPreKey`, `oneTimePreKeys`: chaves públicas.
- `displayName`: nome escolhido para exibição.
- `lastRegistration`: data de atualização.

### Grupo (`Group`)
- `name`: nome público.
- `members`: referência para `User`.
- `owner`: referência para o criador.
- `keyFingerprint`: string Base64 com hash da chave 3DES distribuída.

### Convite (`GroupKeyShare`)
- `group`: referência ao grupo.
- `sender`, `receiver`: referências de usuário.
- `ciphertext`, `keyIv`, `keyAad`: dados cifrados necessários para reconstruir a chave 3DES.
- `consumedAt`: timestamp quando o convite é importado.

### Mensagem (`Message`)
- `group`: referência ao grupo.
- `author`: referência ao usuário.
- `ciphertext`: Base64 da mensagem cifrada.
- `iv`: vetores de inicialização (Base64).
- `createdAt`: timestamp.

## Decisões de arquitetura

- **Cifrar no cliente**: garante que o backend nunca manipule texto plano, reduzindo a superfície de ataque.
- **X3DH assíncrono**: permite convites em que o emissor não precisa estar online quando o destinatário aceita.
- **MongoDB**: flexibilidade para armazenar documentos com metadados criptográficos variáveis.
- **Scripts de bootstrap**: evitam erros comuns de ambiente ao provisionar automaticamente o MongoDB.

## Limitações atuais

- Não há verificação de assinatura de mensagens além do fingerprint compartilhado da chave 3DES.
- Rotação de chaves de grupo depende da criação de um novo grupo.
- O fallback `mongodb-memory-server` é recomendado apenas para desenvolvimento local.

Consulte os demais documentos neste diretório para detalhes específicos de implementação.
