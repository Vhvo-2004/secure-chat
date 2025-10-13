# Documentação do Secure Chat

Bem-vindo ao hub de documentação detalhada do projeto **Secure Chat – X3DH + 3DES**. Este diretório consolida as decisões de arquitetura, fluxos criptográficos, estrutura de código e orientações operacionais da versão atual do sistema.

## Como navegar

| Documento | Conteúdo principal |
| --- | --- |
| [`architecture.md`](architecture.md) | Visão de arquitetura, componentes, sequências de autenticação e armazenamento de dados. |
| [`crypto-flows.md`](crypto-flows.md) | Passo a passo do X3DH, compartilhamento de chaves e cifragem 3DES no projeto. |
| [`backend.md`](backend.md) | Estrutura do backend NestJS, esquemas Mongoose, endpoints e eventos importantes. |
| [`frontend.md`](frontend.md) | Organização do cliente React, estado local, UX e manipulação de chaves no navegador. |
| [`security.md`](security.md) | Detalhes criptográficos sobre o uso de X3DH e 3DES, além de recomendações de segurança. |
| [`setup.md`](setup.md) | Passo a passo para executar o projeto via Docker ou manualmente, com variáveis de ambiente e scripts auxiliares. |
| [`troubleshooting.md`](troubleshooting.md) | Guia de resolução para erros comuns observados durante o desenvolvimento e execução. |

Cada arquivo pode ser lido isoladamente, mas recomendamos seguir a ordem acima para obter uma compreensão completa do fluxo de ponta a ponta.

## Público-alvo

- **Desenvolvedores** que pretendem evoluir o backend/ frontend ou integrar novos clientes.
- **Analistas de segurança** que desejam avaliar o modelo de ameaça, fluxo de chaves e mecanismos criptográficos.
- **Equipe de DevOps** responsável por disponibilizar, monitorar e manter o ambiente executando os serviços.

## Convenções

- Trechos de código e comandos shell aparecem em blocos formatados (` ``` `).
- Diagramas de sequência são descritos textualmente para facilitar a leitura em ambientes sem renderização gráfica.
- Todas as URLs de API assumem o host padrão `http://localhost:3000` quando não especificado.

## Próximos passos

1. Leia [`architecture.md`](architecture.md) para contextualizar os componentes.
2. Consulte [`setup.md`](setup.md) antes de executar localmente.
3. Utilize [`troubleshooting.md`](troubleshooting.md) caso encontre mensagens de erro semelhantes às listadas.

> Caso encontre divergências entre o comportamento observado e a documentação, abra uma issue descrevendo o cenário para que possamos atualizar estes materiais.
