1- Análise do Repositório e Mapeamento Inicial
Iniciamos a investigação do código-fonte para identificar onde integrar limites por plano.
🔹 Levantamos os arquivos-chave: páginas (`Workshops`, `Batches`, `Plans`, `Profile`), serviços (`batchService`, `authService`), hooks existentes (`useAuth`) e configurações do Firebase.
🔹 Decidimos aplicar a validação principal no cliente e oferecer helpers que consultam contagens no Firestore para apoio ao UX.
✔️ Benefícios:
Melhora no entendimento da arquitetura atual; decisões alinhadas com as limitações do Firestore; redução de risco ao não alterar contratos existentes.

2- Criação do Hook `usePlanGuard` (src/hooks/usePlanGuard.ts)
Implementamos um hook centralizado para regras de limite por plano e navegação para a tela de planos.
🔹 Definimos `PLAN_LIMITS` (ex.: Basic: 3 workshops / 10 batches mês) e funções utilitárias: `getUserLimits`, `canAddWorkshop`, `canAddBatch`, `getRemainingWorkshops`, `getRemainingBatches`, `navigateToPlans`.
🔹 Optamos por manter valores como constantes no hook, facilitando ajustes e testes.
✔️ Benefícios:
Centralização da lógica de limites, reutilização entre páginas, facilidade de manutenção e testes.

3- Criação do componente `PlanLimitModal` (src/components/PlanLimitModal.tsx)
Desenvolvemos um modal informativo para notificar usuários que atingiram o limite do plano.
🔹 O modal exibe ícone de bloqueio, título, mensagem personalizada, barra de progresso e ações CTAs: ir para `Plans` ou fechar.
🔹 Integração com `usePlanGuard` para navegação direta e tradução via `useLanguage` quando aplicável.
✔️ Benefícios:
Melhora da experiência do usuário com feedback claro; encaminhamento direto para upgrade de plano.

4- Atualização da página `Workshops` (src/pages/Workshops/Workshops.tsx)
Integramos o guard de planos para bloquear criação quando o limite for atingido.
🔹 Adicionamos estado para controlar a visibilidade do `PlanLimitModal` e a função `handleAddWorkshop` que chama `canAddWorkshop` antes de permitir a navegação/criação.
🔹 Substituímos o fluxo do botão “+” (header) e botão de estado vazio para chamar o guard.
✔️ Benefícios:
Prevenção de ações inválidas no cliente; UX consistente com feedback imediato; menor necessidade de rollback no servidor.

5- Adição de `getBatchCountThisMonth` em `batchService` (src/services/batchService.ts)
Implementamos helper para contar batches do usuário no mês corrente no Firestore.
🔹 A função calcula o início do mês (Timestamp) e consulta `batches` filtrando por `userId` e `createdAt >= startOfMonth`.
🔹 Tratamento de erros com logging e repasse de exceções para o chamador.
✔️ Benefícios:
Fonte confiável para contagem mensal no cliente; reduz necessidade de consultas caras e padroniza a forma de obter estatísticas.

6- Atualização da página `Batches` (src/pages/Batches/Batches.tsx)
Integramos a contagem mensal e bloqueio de criação de novos batches quando o limite do plano for excedido.
🔹 Em `loadBatches()` incluímos chamada a `getBatchCountThisMonth(user.id)` e armazenamos `batchesThisMonth` no estado.
🔹 Criamos `handleAddBatch()` que valida via `canAddBatch(batchesThisMonth)` e exibe `PlanLimitModal` quando necessário.
✔️ Benefícios:
Controle de criação alinhado ao comportamento do produto; prevenção de uso indevido do plano básico.

7- Geração de `firestore.rules` (firestore.rules)
Escrevemos regras de segurança que cobrem autenticação e propriedade dos documentos.
🔹 Regras definem `isAuthenticated()` e `isOwner()` para `users`, `workshops` e `batches` garantindo somente leituras/escritas autorizadas.
🔹 Comentários explicam que limites numéricos (ex.: contagens) são aplicados no cliente e que aplicação de limites server-side demandaria Cloud Functions ou endpoint transacional.
✔️ Benefícios:
Melhora da segurança básica (autenticação/ownership); documentação in-line das limitações atuais e caminhos de mitigação.

8- Pesquisa e leitura de arquivos relevantes (varredura inicial)
Realizamos leitura seletiva de múltiplos arquivos para definir pontos de integração.
🔹 Arquivos lidos: `authService.ts`, `translations.ts`, `AppRoutes.tsx`, `Profile.tsx`, páginas de `Plans`, tipos em `src/types/*`, `firebaseconfig.ts` e mais.
🔹 Identificamos onde o campo `plan` do usuário é lido e escrito (`users/{userId}` e `updateProfile`).
✔️ Benefícios:
Tomada de decisão informada; integração minimamente invasiva; menor risco de quebrar fluxos existentes.

9- Estratégia de responsabilidade (decisão arquitetural)
Optamos por aplicar a regra de limite de forma principal no cliente, com suporte de helpers que consultam o backend.
🔹 Justificativa: Firestore Rules não suportam agregações atômicas/contagens sem infra adicional; Cloud Functions seriam necessários para enforce transacional.
🔹 Documentamos essa limitação nas regras e no relatório para transparência.
✔️ Benefícios:
Rapidez de entrega, menor custo imediato, clareza sobre próximos passos para enforcement server-side.

10- Tratamento de tradução e textos UX
Adicionamos/ajustamos chaves textuais e uso de `useLanguage`/`translations` para mensagens do modal e botões.
🔹 Garantimos que o modal e mensagens de bloqueio possam ser traduzidas facilmente; mantivemos textos claros e acionáveis.
✔️ Benefícios:
Consistência de UX em diferentes idiomas; menor esforço para i18n.

11- Testes básicos de sanidade e verificações estáticas
Executamos checagens de erros por arquivo após cada patch aplicado para detectar erros sintáticos/TS.
🔹 Verificamos que `Workshops.tsx`, `Batches.tsx` e `batchService.ts` não apresentaram erros de compilação a nível de arquivo após as alterações.
🔹 Validamos importações e tipos usados nas funções adicionadas.
✔️ Benefícios:
Redução de regressões óbvias; confiança inicial antes de testes em dispositivo/emulador.

12- Aplicação de patches e commits (criação/alteração de arquivos)
Criamos e atualizamos arquivos usando patches direcionados ao repositório para preservar estilo e histórico.
🔹 Arquivos adicionados: `src/hooks/usePlanGuard.ts`, `src/components/PlanLimitModal.tsx`, `firestore.rules`, `doc30mar.md` (relatório atual).
🔹 Arquivos atualizado: `src/pages/Workshops/Workshops.tsx`, `src/pages/Batches/Batches.tsx`, `src/services/batchService.ts`.
✔️ Benefícios:
Mudanças coesas e localizadas; fácil revisão de PR; minimiza alterações desnecessárias.

13- Considerações de segurança e limites de confiança
Indicamos claramente que contagens e limites aplicados no cliente não substituem validação server-side em cenários adversos.
🔹 Sugerimos caminho de melhoria: implementar Cloud Function/endpoint que verifique e crie documentos de forma atômica para enforcement real.
🔹 Recomendamos auditoria e logs para operações críticas (criação de batches/workshops) quando enforcement server-side for implementado.
✔️ Benefícios:
Plano claro de evolução para segurança; mitigação de riscos conhecidos; alinhamento com boas práticas.

14- Orientações para testes e próximos passos práticos
Propusemos passos concretos para validar em dispositivo e evoluir a solução.
🔹 Testes locais sugeridos: validar fluxo de criação como usuário Basic (ex.: tentar criar 4º workshop e 11º batch no mês) em emulador/dispositivo.
🔹 Próximas melhorias: endpoints transactivos, integração de cobrança/upgrade e notificações in-app sobre uso do plano.
✔️ Benefícios:
Roteiro de QA claro; prioridades de curto e médio prazo definidas; menor margem para surpresas em produção.

15- Comunicação das decisões e limitações ao time
Registramos as decisões arquiteturais e suas motivações para facilitar code review e alinhamento.
🔹 Inclamamos transparência sobre a decisão de enforcement no cliente e onde o servidor precisa ser melhorado futuramente.
🔹 Recomendamos incluir esse relatório em checkpoints de sprint e revisão de segurança.
✔️ Benefícios:
Alinhamento entre desenvolvedores e stakeholders; documentação operacional embutida no repositório.

16- Estado atual e resumo executivo
Consolidei as mudanças em hooks, componentes, páginas e regras para entregar guardas de plano funcionais e documentadas.
🔹 O aplicativo agora previne ações de usuários Basic que excedem limites, informa o usuário via modal e fornece navegação rápida para planos.
🔹 A camada server-side foi protegida quanto à propriedade dos dados; however, enforcement numérico exige infra adicional.
✔️ Benefícios:
Entrega de valor tangível ao produto (controle por plano e melhor UX); menor risco imediato; caminho definido para reforço server-side.

---

Observações finais:
- Este relatório foi gerado conforme solicitado e salvo em `doc30mar.md` na raiz do projeto.
- Evitei a palavra restrita pedida e foquei em registrar ações, decisões, impactos e próximos passos técnicos.
