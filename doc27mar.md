1- Centralização de Rotas e Tipagem de Telas
🔹 Centralizamos os nomes das telas em `src/routes/paths.ts`, definindo constantes e o tipo `ScreenName` para navegação tipada.
🔹 Decidimos usar um único ponto de verdade para nomes de rotas, evitando strings espalhadas e erros de digitação; atualizamos usos em `NavigationContext` e `AppRoutes`.
🔹 Processo: leitura do código existente, definição do enum/consts, refatoração incremental e correção de chamadas de `navigate`.
✔️ Benefícios:
Melhora na manutenção e refatoração de rotas.
Redução de bugs por nomes incorretos de tela.
Facilidade para autocompletar e verificação estática com TypeScript.

2- Refatoração do `NavigationContext` para usar `ScreenName`
🔹 Atualizamos `src/routes/NavigationContext.tsx` para expor `currentScreen: ScreenName` e `navigate(screen: ScreenName, params?)`.
🔹 Decisão: garantir que todos os componentes consumindo o contexto só passem valores validados pelo tipo central.
🔹 Processo: importar `ScreenName`, ajustar inicialização e tipos das funções de navegação.
✔️ Benefícios:
Consistência na API de navegação.
Menor risco de runtime por rotas inválidas.
Ajuda no autocompletar ao navegar entre telas.

3- Reestruturação de `AppRoutes` com mapeamento de componentes
🔹 Refatoramos `src/routes/AppRoutes.tsx` para usar um `Record<ScreenName, Component>` e conjuntos de rotas públicas/privadas.
🔹 Decisão: implementar guardas que redirecionam usuários autenticados/não autenticados conforme o tipo de rota.
🔹 Processo: construir mapeamento, adicionar lógica de checagem de linguagem e autenticação, fallback seguro.
✔️ Benefícios:
Fluxo de navegação previsível e centralizado.
Proteção clara de rotas sensíveis.
Código mais simples para adicionar novas telas.

4- Correção e recriação do `Sidebar` tipado
🔹 Recriamos `src/components/Sidebar/Sidebar.tsx` usando `ScreenName` para cada item de menu e `currentRoute: ScreenName`.
🔹 Decisão: substituir strings de rota por valores tipados para evitar discrepâncias com `paths.ts`.
🔹 Processo: definir `MenuItem[]` com `route: ScreenName`, ajustar `handleNavigate` e estilos mínimos.
✔️ Benefícios:
Menu robusto com menos chance de navegação inválida.
Sincronia automática com mudanças de rota centralizadas.
Melhor experiência de manutenção e leitura do código.

5- Correção de navegação na `Login` e retorno à seleção de idioma
🔹 Ajustamos `src/pages/Login/Login.tsx` para usar `navigate(paths.languageSelection)` tipado, removendo casts desnecessários.
🔹 Decisão: padronizar chamadas de navegação e remover práticas inseguras de cast.
🔹 Processo: localizar chamadas errôneas, substituir por uso do `paths` tipado e testar integridade local (tipo/compilação).
✔️ Benefícios:
Eliminação de assertions inseguras.
Maior clareza do fluxo de onboarding.
Menos dívidas técnicas no ponto de entrada do app.

6- Redesenho da tela `Dashboard` com agregação de KPIs
🔹 Reescrevemos `src/pages/Dashboard/Dashboard.tsx` para agregar métricas de vários serviços (`cutService`, `batchService`, `workshopService`, `paymentService`, `receivePiecesService`).
🔹 Decisões: buscar dados de forma concorrente, apresentar KPIs principais (cortes, peças, lotes, receitas) e cartões de operações rápidas.
🔹 Processo: definir o tipo `Stats`, criar `useEffect` com chamadas paralelas, computar indicadores derivados (ex.: workshops em estado crítico) e construir layout de destaques.
✔️ Benefícios:
Visão consolidada do estado operacional.
Acesso rápido a métricas acionáveis.
Base para futuros gráficos e alertas.

7- Inclusão de traduções específicas do Dashboard (pt/es)
🔹 Atualizamos `src/i18n/translations.ts` com blocos de tradução para as novas strings do Dashboard em português e espanhol.
🔹 Decisão: manter a paridade entre idiomas e nomear chaves claras para facilitar uso em componentes.
🔹 Processo: listar novas chaves necessárias, inserir traduções e validar importação nas telas.
✔️ Benefícios:
Melhora na experiência multilíngue.
Preparação para suporte a outros idiomas.
Consistência textual entre telas.

8- Implementação de guardas de rota (guestOnly / protected)
🔹 Implementamos conjuntos que definem rotas `guestOnly` e `authRequired` dentro da lógica de `AppRoutes`.
🔹 Decisão: separar lógica de exibição de tela da política de acesso, facilitando alterações futuras.
🔹 Processo: mapear cada `ScreenName` aos conjuntos apropriados e aplicar redirecionamentos condicionais.
✔️ Benefícios:
Segurança de fluxo (usuários sem sessão não acessam áreas restritas).
Fluxo UX previsível para novos usuários.
Facilidade de auditoria das rotas acessíveis.

9- Correção de um conflito de edição no `Sidebar` e restauração
🔹 Detectamos um patch intermediário malformado no `Sidebar` durante as refatorações e recriamos o arquivo com conteúdo válido e tipado.
🔹 Decisão: descartar o estado inválido e recriar a versão correta para garantir estabilidade do repositório.
🔹 Processo: revisar o histórico, aplicar a correção e validar com checagem estática.
✔️ Benefícios:
Restaurou integridade do projeto.
Evitou regressões causadas por conteúdo sintaticamente inválido.
Melhorou confiança na sequência de commits e patches aplicados.

10- Integração dos serviços de estatísticas no Dashboard
🔹 Integramos chamadas a `getCutStatistics`, `getBatchStatistics`, `getWorkshopsByUser`, `getPaymentStatistics` e `getReceivePiecesStatistics` para compor o painel.
🔹 Decisão: assumir shapes conhecidos dos retornos e consolidar valores relevantes para KPIs.
🔹 Processo: chamada paralela com `Promise.all`, normalização dos dados e tratamento de estados de loading/erro.
✔️ Benefícios:
Dados consolidados em uma única view.
Melhor observabilidade operacional.
Possibilidade de acionar ações diretamente a partir dos KPIs.

11- Adoção de formatação monetária e estados de carregamento
🔹 Implementamos funções utilitárias para `formatCurrency` e gerenciamento de `loading` na tela de Dashboard.
🔹 Decisão: exibir valores financeiros formatados e indicar processo de carregamento para evitar UX confusa.
🔹 Processo: encapsular formatação simples e usar flags de loading ao aguardar respostas de serviços.
✔️ Benefícios:
Apresentação consistente de valores financeiros.
Melhora na percepção do usuário durante carregamentos.
Redução de flash de conteúdo vazio.

12- Verificação estática e checagens de tipos após mudanças
🔹 Executamos checagens estáticas/TypeScript nas áreas modificadas para garantir ausência de erros óbvios antes da entrega.
🔹 Decisão: rodar validações apenas nas alterações para acelerar feedback sem reexecutar toda a pipeline.
🔹 Processo: validar arquivos alterados (`AppRoutes.tsx`, `NavigationContext.tsx`, `paths.ts`, `Sidebar.tsx`, `Dashboard.tsx`, `Login.tsx`, `translations.ts`).
✔️ Benefícios:
Confiabilidade nas alterações aplicadas.
Detecção precoce de incompatibilidades de tipo.
Menor risco de introduzir regressões de compilação.

13- Ajustes na tipagem dos menus e props de layout
🔹 Tipamos explicitamente `menuItems` e `currentRoute` para garantir que `Layout` e `Sidebar` compartilhem a mesma representação de tela.
🔹 Decisão: propagar `ScreenName` em props visíveis entre componentes para manter coerência.
🔹 Processo: alterar definições de interfaces e atualizar chamadas onde necessário.
✔️ Benefícios:
Redução de casts e `any` espalhados.
Interfaces mais autoexplicativas para novos contribuidores.
Menos bugs por incompatibilidade de props.

14- Tratamento de erros e comportamento de fallback de tela
🔹 Implementamos fallback seguro em `AppRoutes` (exibe `LanguageSelection` ou tela padrão quando mapping não contém a rota solicitada).
🔹 Decisão: priorizar estabilidade da UI ao invés de falhas inesperadas em caso de rota inexistente.
🔹 Processo: adicionar verificação de existência no `screenComponents` e renderizar fallback apropriado.
✔️ Benefícios:
Evita crashs por rota não mapeada.
Permite correções posteriores sem quebrar a navegação.
Melhora a resiliência do app em cenários atípicos.

15- Boas práticas de refatoração e commit incremental
🔹 Adotamos pequenas alterações atomizadas para cada arquivo e verificações estáticas entre passos, minimizando pontos de falha.
🔹 Decisão: preferir patches pequenos e reversíveis em vez de grandes mudanças simultâneas.
🔹 Processo: aplicar patches por arquivo, validar tipos e ajustar quando necessário.
✔️ Benefícios:
Facilidade para revisar mudanças em PRs.
Rápida identificação de regressões.
Melhor rastreabilidade das alterações no histórico.

16- Recomendações e próximos passos técnicos
🔹 Sugerimos rodar o app localmente (em emulador/dispositivo) para validar fluxos de navegação e shapes de retorno dos serviços; também recomendamos testes unitários nas funções de agregação de métricas.
🔹 Decisões futuras: adicionar contratos (types/interfaces) para respostas de serviços e testes end-to-end para os fluxos críticos.
🔹 Processo recomendado: executar `yarn start`/`expo start`, navegar pelas telas e inspecionar logs, além de escrever testes para `get*Statistics`.
✔️ Benefícios:
Validação runtime das integrações.
Maior cobertura de qualidade e confiança para deploy.
Base sólida para evoluções futuras.

---
Arquivo salvo como `doc27mar.md` na raiz do projeto com os tópicos acima.
