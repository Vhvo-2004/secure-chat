# Fluxos criptográficos detalhados (X3DH + 3DES)

Este guia didático acompanha cada passo executado pelo Secure Chat para compartilhar identidades,
negociar chaves com **Triple Diffie-Hellman (X3DH)** e cifrar mensagens de grupo com **3DES**.
Ele serve como complemento à visão geral em [`security.md`](security.md) e às camadas de
arquitetura descritas em [`architecture.md`](architecture.md).

## Atores e notação

| Símbolo | Descrição |
| --- | --- |
| `IK_X` | Chave de identidade (Identity Key) do usuário X. Par longo prazo Curve25519. |
| `SPK_X` | Signed Pre-Key do usuário X. Par Curve25519 assinado por `IK_X`. |
| `OPK_X` | One-Time Pre-Key do usuário X. Par Curve25519 descartado após o consumo. |
| `EK_X` | Chave efêmera gerada apenas para um convite específico. |
| `HKDF()` | Função HKDF-SHA256 usada para derivar material de chave a partir dos DHs. |
| `3DES(key, iv, plaintext)` | Cifra DES-EDE3-CBC com padding PKCS#7. |

Todos os Diffie-Hellman utilizam Curve25519/X25519.

## Fluxo 0 – Registro e publicação de pré-chaves

1. **Cadastro de identidade**
   - Endpoint: `POST /users`
   - Frontend invoca `generateBundle` para produzir `IK_user`, `SPK_user`, assinatura e pré-chaves únicas
     (`frontend/src/crypto/x3dh.js#generateBundle`).
   - As chaves privadas são serializadas com `serializePrivateBundle` e ficam no `localStorage`; apenas o
     material público é enviado ao backend via `exportPublicBundle`.

2. **Reabastecimento opcional de One-Time Pre-Keys**
   - Endpoint: `POST /users/:id/one-time-pre-keys`
   - Permite enviar novas pré-chaves únicas após o cadastro inicial, mantendo o estoque para convites futuros.

> **Resultado**: o backend agora expõe o bundle `{IK, SPK, assinatura, OPK disponível}` quando outro usuário
> solicitar um convite.

## Fluxo 1 – Criação de grupo e convite inicial

1. Criador gera chave simétrica do grupo: `groupKey` (24 bytes).
   - Implementação: `frontend/src/crypto/triple-des.js#random3DesKey`.

2. Criador envia `POST /groups` com nome e `groupKeyFingerprint` (`SHA-256(groupKey)`).
   - Backend armazena fingerprint e membros iniciais com apenas o criador.

3. Para convidar membros, o frontend chama `POST /key-exchange/shares` com `{receiverId, groupId}`.
   - Service `KeyExchangeService.shareGroupKey` obtém o bundle de Bob (`IK_B`, `SPK_B`, `OPK_B`).
   - Frontend gera `EK_A` (curva X25519) e calcula os quatro DHs:
     1. `DH1 = DH(IK_A, SPK_B)`
     2. `DH2 = DH(EK_A, IK_B)`
     3. `DH3 = DH(EK_A, SPK_B)`
     4. `DH4 = DH(IK_A, OPK_B)` (se existir)
   - O concatenado `IKM = DH1 || DH2 || DH3 || DH4` alimenta `HKDF` (salt de 16 bytes zerados) -> `rootKey`.
   - De `rootKey` derivamos `encKey` (32 bytes) para proteger a chave do grupo.

4. Com `encKey`, o frontend cifra os bytes da chave 3DES via AES-256-GCM.
   - Implementação: `frontend/src/crypto/x3dh.js#wrapDataWithRootKey`.
   - Payload final inclui:
     - `packet`: `{ EK_A_pub, IK_A_pub, opk_index, iv, cipher, aad }` (metadados do X3DH).
     - `encryptedGroupKey`, `keyIv`, `keyAad`: envoltório AES-GCM contendo a chave 3DES.

5. Backend salva o share (coleção `group_key_shares`). O `OPK_B` usado é marcado como consumido.

## Fluxo 2 – Aceitação do convite e consumo do share

1. Usuário convidado lista convites via `GET /key-exchange/shares`.
   - Controller `KeyExchangeController.listShares` filtra por `receiverId` e devolve metadados
     (nome do grupo, fingerprint e material criptografado).

2. Ao aceitar, o frontend envia `POST /key-exchange/shares/:id/consume`.
   - Frontend recalcula os DHs usando suas chaves privadas: `DH(IK_B, SPK_B)`, `DH(IK_B, EK_A)`, etc.
   - Com a mesma `HKDF`, recupera `encKey` e usa `unwrapDataWithRootKey` para decifrar `encryptedGroupKey` com `keyIv` e
     `keyAad`.

3. O frontend armazena `groupKey` localmente (Base64) e confirma o fingerprint mostrado.

4. Backend atualiza o grupo adicionando o novo membro e marca o share como consumido.

> **Agora todos os membros possuem a mesma chave 3DES do grupo.**

## Fluxo 3 – Envio de mensagens cifradas

1. Remetente busca a chave do grupo no storage local (`frontend/src/App.jsx#sendGroupMessage`).

2. Um IV aleatório de 8 bytes é gerado para cada mensagem (`generateIv`).

3. O plaintext corresponde ao texto digitado pelo usuário, convertido para bytes UTF-8.

4. O módulo `frontend/src/crypto/triple-des.js#encryptMessage3DES` aplica PKCS#7 e usa `3DES-CBC`
   com `groupKey` e `iv` para gerar `ciphertext`.

5. A mensagem cifrada é enviada via `POST /messages` com `{ groupId, ciphertext, iv }`.

6. Backend apenas persiste os campos brutos; nenhuma decifragem ocorre no servidor.

## Fluxo 4 – Recepção e decifragem

1. Cliente consulta periodicamente `GET /groups/:groupId/messages` para obter novas mensagens.

2. Ao receber `{ciphertext, iv}`, o frontend localiza `groupKey` do grupo.

3. O módulo `frontend/src/crypto/triple-des.js#decryptMessage3DES` reverte o PKCS#7 e devolve o plaintext legível.

4. UI valida o fingerprint exibido no cabeçalho para confirmar que todos os membros
   utilizam a mesma chave.

## Verificações e logs úteis

- **Fingerprint no convite**: compare com outro membro via canal fora de banda.
- **Histórico de DHs**: console do navegador exibe `X3DH: derived shared secret` em modo desenvolvimento.
- **Fallbacks de pré-chaves**: se não existir `OPK`, ainda assim o compartilhamento ocorre com `DH4` ausente, mas o log alerta.

## Caminhos de código relacionados

| Arquivo | Responsabilidade |
| --- | --- |
| `frontend/src/crypto/x3dh.js` | Geração de identidades, pré-chaves, DHs e derivação HKDF. |
| `frontend/src/crypto/triple-des.js` | Geração de chave de grupo, cifragem e decifragem 3DES. |
| `backend/src/key-exchange/key-exchange.service.ts` | Orquestração de shares, persistência e marcação de `OPK`. |
| `backend/src/groups/groups.service.ts` | Criação de grupos, fingerprints e associação de membros. |
| `backend/src/messages/messages.service.ts` | Armazenamento pass-through das mensagens cifradas. |

Com estes fluxos, qualquer pessoa pode reproduzir manualmente cada fase do protocolo,
realizar testes de interoperabilidade ou adaptar o projeto para outras primitivas criptográficas.
