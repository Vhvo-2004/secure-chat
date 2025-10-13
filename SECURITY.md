# Avisos de Segurança

Este repositório é um protótipo educacional demonstrando conceitos de estabelecimento de chaves usando X3DH e cifragem simétrica com 3DES-CBC + HMAC-SHA256.

## ⚠️ APENAS FINS EDUCACIONAIS

**NÃO USE EM PRODUÇÃO** - Este projeto é exclusivamente para aprendizagem de protocolos criptográficos.

## 🔐 Implementação Atual

### Funcionalidades de Segurança Implementadas:
- ✅ **X3DH Protocol**: Estabelecimento seguro de chaves entre usuários
- ✅ **Ed25519/X25519**: Curvas elípticas modernas para assinaturas e ECDH
- ✅ **HKDF**: Derivação adequada de chaves criptográficas
- ✅ **Encrypt-then-MAC**: 3DES-CBC seguido de HMAC-SHA256
- ✅ **Key Verification**: Validação de chaves pré-assinadas
- ✅ **Session Management**: Linking adequado de sessões e conversas
- ✅ **User Validation**: Verificação de existência antes de iniciar handshake
- ✅ **Error Handling**: Tratamento seguro sem vazamento de informações
- ✅ **Logout Inteligente**: Preservação de dados vs. limpeza completa
- ✅ **Interface Minimalista**: Redução de superfície de ataque UI

### Limitações de Segurança Conhecidas:

#### 1. **Algoritmo de Criptografia Legado**
- **3DES**: Considerado obsoleto, bloco de 64 bits suscetível a colisões
- **Recomendação**: AES-256-GCM ou ChaCha20-Poly1305 em produção
- **Impacto**: Vulnerável com grandes volumes de dados

#### 2. **Ausência de Forward Secrecy**
- **Limitação**: Sem Double Ratchet implementado
- **Risco**: Comprometimento de chaves afeta mensagens passadas/futuras
- **Recomendação**: Implementar Signal Protocol completo

#### 3. **Gerenciamento de One-Time Keys**
- **Risco**: Pool pode esgotar causando falhas de handshake
- **Monitoramento**: Necessário reabastecimento automático
- **Fallback**: Sistema continua sem OTK mas com menor segurança

#### 4. **Verificação de Identidade**
- **Limitação**: Sem fingerprinting ou verificação fora-de-banda
- **Risco**: Possíveis ataques man-in-the-middle
- **Recomendação**: Implementar SAS (Short Authentication String) ou QR codes

#### 5. **Gestão de Dados Locais**
- **Consideração**: Logout preserva mensagens por conveniência do usuário
- **Trade-off**: Usabilidade vs. limpeza completa de dados
- **Controle**: Usuário pode escolher logout completo quando necessário

## 🛡️ Mitigações Implementadas

### CBC Padding Oracle Prevention:
- Uso de Encrypt-then-MAC previne ataques de padding oracle
- MAC verificado antes da descriptografia
- Erros de MAC e padding retornam mensagens genéricas

### Key Material Protection:
- Chaves armazenadas com AES-GCM no localStorage
- Separação clara entre chaves públicas e privadas
- Limpeza adequada de materiais sensíveis na memória
- Logout seletivo: preserva dados vs. limpeza completa

### User Experience Security:
- Interface simplificada reduz vetores de ataque UI
- Confirmações para ações destrutivas (logout completo)
- Transparência nas opções de persistência de dados
- Logs de atividade para auditoria de desenvolvimento
- **Validação prévia de usuários**: Evita tentativas de handshake desnecessárias
- **Mensagens de erro padronizadas**: Não vazam informações sensíveis do sistema

### Protocol Validation:
- Verificação de assinaturas em chaves pré-assinadas
- Validação de parâmetros X3DH completa
- Logging extensivo para auditoria (apenas desenvolvimento)

## 🔮 Recomendações para Produção

### Imediatas:
1. **Substituir 3DES** por AES-256-GCM
2. **Implementar Double Ratchet** para forward secrecy
3. **Adicionar verificação de identidade** com fingerprints
4. **Hardening de memória** e secure deletion

### Médio Prazo:
1. **Auditoria de segurança** externa
2. **Testes de penetração** especializados
3. **Política de rotação** de chaves automática
4. **Monitoramento** de tentativas de ataque

### Longo Prazo:
1. **Post-quantum cryptography** (preparação futura)
2. **Formal verification** dos protocolos
3. **Hardware security modules** para chaves críticas

## 📚 Recursos de Referência

- [Signal Protocol Documentation](https://signal.org/docs/)
- [X3DH Specification](https://signal.org/docs/specifications/x3dh/)
- [Double Ratchet Specification](https://signal.org/docs/specifications/doubleratchet/)
- [NIST Cryptographic Standards](https://csrc.nist.gov/)

---

**Lembre-se: Este projeto é uma ferramenta de aprendizagem. Para aplicações reais, consulte especialistas em segurança e use bibliotecas auditadas.**
