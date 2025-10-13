# Segurança e criptografia

Esta seção descreve os mecanismos de segurança utilizados no Secure Chat, destacando como o protocolo X3DH foi adaptado, como a chave de grupo é manipulada e quais são as melhores práticas para manter a confidencialidade.

## Objetivos de segurança

1. **Confidencialidade ponta a ponta**: mensagens e chaves simétricas nunca trafegam em texto plano pelo backend.
2. **Assincronicidade**: participantes podem aceitar convites sem que o emissor esteja online.
3. **Integridade das chaves**: fingerprint compartilhado permite detectar chaves divergentes ou ataques de substituição.
4. **Minimização de confiança no backend**: o servidor apenas orquestra o protocolo e persiste envelopes criptografados.

## Triple Diffie-Hellman (X3DH)

O X3DH é utilizado para estabelecer um segredo compartilhado entre o emissor (Alice) e o receptor (Bob) utilizando diferentes combinações de chaves privadas e públicas. O Secure Chat aplica as seguintes etapas:

1. **Bundle público do receptor**
   - `identityKey` (IK_B)
   - `signedPreKey` (SPK_B)
   - `oneTimePreKey` (OPK_B) reservado dinamicamente
2. **Chaves efêmeras do emissor**
   - `identityKey` (IK_A) proveniente do registro
   - `ephemeralKey` (EK_A) gerada apenas para o convite atual
3. **Cálculo dos DHs**
   - DH1 = DH(IK_A, SPK_B)
   - DH2 = DH(EK_A, IK_B)
   - DH3 = DH(EK_A, SPK_B)
   - DH4 = DH(IK_A, OPK_B) — opcional, depende da disponibilidade da pré-chave
4. **Derivação**
   - Concatenação das saídas => `IKM`
   - Aplicação de HKDF-SHA256 com `salt` aleatório para extrair `rootKey` e `encKey`
5. **Encapsulamento**
   - A chave 3DES, IV e AAD são cifrados usando `encKey` em modo AES-256-GCM.
   - O pacote resultante é enviado ao backend.

O receptor repete os DHs com suas chaves privadas para decapsular os dados. Após o uso, a `oneTimePreKey` é marcada como consumida, evitando reutilização.

## Chave de grupo (3DES)

- Cada grupo possui uma chave simétrica de 24 bytes (192 bits) usada em modo DES-EDE3-CBC.
- Fingerprint: `SHA-256(key)`, truncado e convertido em Base64 para exibição.
- O IV de cada mensagem é gerado aleatoriamente (8 bytes) e enviado junto ao ciphertext.
- Mensagens são preenchidas com PKCS#7 antes da cifragem.

## Armazenamento seguro

- **Backend**: armazena apenas dados cifrados (`ciphertext`, `iv`, `aad`). Nenhuma chave privada é persistida.
- **Frontend**: guarda chaves privadas em `localStorage`. Recomenda-se limpar o navegador de máquinas compartilhadas.
- **MongoDB**: os documentos contém apenas material público ou envelopes criptografados.

## Proteções adicionais implementadas

- **Fingerprint exibido na UI**: permite que membros comparem manualmente a chave via canal seguro secundário.
- **Normalização de IDs**: evita confusão de identidade por diferenças `_id`/`id` em respostas.
- **Tratamento de erros**: respostas 404/400 claras para impedir vazamento de informações sensíveis.

## Recomendações de segurança operacionais

1. **HTTPS obrigatório** em produção para proteger metadados e requisições.
2. **Rotação periódica de chaves**: recrie grupos periodicamente se houver suspeita de comprometimento.
3. **Proteção do MongoDB**: restringir acesso por firewall, usar autenticação e backups criptografados.
4. **Monitoramento**: registre tentativas de acesso indevido aos endpoints.
5. **Política de expiração**: implemente limites para convites pendentes se necessário.

## Possíveis melhorias futuras

- Suporte a **Double Ratchet** para garantir sigilo direto futuro nas mensagens.
- Utilização de **WebCrypto API** ao invés de implementações em JavaScript puro.
- Integração com **WebAuthn** para proteger a identidade local.
- Armazenamento das chaves privadas em **IndexedDB** cifrado com senha do usuário.

A segurança depende tanto da implementação quanto da operação. Revise este documento periodicamente ao introduzir novas funcionalidades.
