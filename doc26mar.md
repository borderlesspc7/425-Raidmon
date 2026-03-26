1- Tornar os cards das páginas roláveis
* Tornamos os cards roláveis substituindo o contêiner de conteúdo por um `ScrollView` central no `Layout`, garantindo que todas as páginas filhas herdem comportamento de rolagem.
* 🔹 Objetivos, decisões e processos: Adotar um ponto único de rolagem para evitar comportamentos `sticky` indesejados; aplicar `contentContainerStyle` padronizado; priorizar compatibilidade com telas móveis e web via `react-native`.
* ✔️ Benefícios:
  - Consistência no comportamento de rolagem entre telas.
  - Menos duplicação de código nas páginas individuais.
  - Melhora na experiência do usuário em telas longas.

2- Atualizar `Layout` para envolver o conteúdo em `ScrollView`
* Alteramos `src/components/Layout/Layout.tsx` para envolver `children` com `ScrollView`, centralizando o controle de rolagem.
* 🔹 Objetivos, decisões e processos: Simplificar a estrutura das páginas e permitir que todas herdem estilos de rolagem; optamos por `ScrollView` com `showsVerticalScrollIndicator={false}` e `contentContainerStyle` padronizado.
* ✔️ Benefícios:
  - Implementação única reduz pontos de erro.
  - Facilita alterações visuais globais futuras (padding, gaps, comportamento de overscroll).

3- Habilitar seleção de planos pelo usuário
* Implementamos ações reais de assinatura que alteram o plano do usuário ao clicar em CTAs (`Basic` / `Premium`) nas telas de plano.
* 🔹 Objetivos, decisões e processos: Adicionar lógica que chama atualização de perfil em vez de apenas navegar; manter fluxo simples (alerta de sucesso e retorno para a tela de planos); simular processamento com estado `loading` para feedback imediato.
* ✔️ Benefícios:
  - Usuário percebe efeito imediato da ação.
  - Fluxo pronto para integrar gateways de pagamento no futuro.

4- Expor `updateProfile` no `AuthContext`
* Adicionamos `updateProfile` em `src/contexts/AuthContext.tsx`, que chama `authService.updateProfile` e atualiza o estado `user` do contexto.
* 🔹 Objetivos, decisões e processos: Centralizar atualizações de perfil no contexto para propagar mudanças por toda a aplicação; tratar estado de carregamento e erros internamente.
* ✔️ Benefícios:
  - Consistência no estado do usuário em toda a aplicação.
  - API simples para componentes alterarem propriedades do usuário (ex.: `plan`).

5- Assinatura prática em `BasicPlan` e `PremiumPlan`
* Modificamos `src/pages/Plans/BasicPlan.tsx` e `src/pages/Plans/PremiumPlan.tsx` para chamar `updateProfile({ plan: 'basic' | 'premium' })` e exibir feedback (alerta + navegação).
* 🔹 Objetivos, decisões e processos: Reaproveitar o `AuthContext` para persistir a escolha do plano; bloquear o botão durante processamento para evitar cliques duplicados.
* ✔️ Benefícios:
  - Operação de assinatura integrada ao perfil do usuário.
  - Feedback visual claro durante o processamento.

6- Definir cores e ícones por plano
* Padronizamos um mapeamento de cores, `bgColor` e ícones para `basic`, `premium` e `enterprise` e usamos essas cores para destacar a badge do plano.
* 🔹 Objetivos, decisões e processos: Reutilizar a paleta já utilizada nas páginas (ex.: roxos e verdes); definir ícones coerentes (`star`, `workspace-premium`, `business`).
* ✔️ Benefícios:
  - Identificação visual imediata do plano do usuário.
  - Coerência estética com o restante da aplicação.

7- Atualizar a badge do perfil para estilo "pill" com ícone
* Em `src/pages/Profile/Profile.tsx` trocamos o badge antigo por um componente em formato "pill" com fundo colorido e texto em branco, acompanhado de um ícone.
* 🔹 Objetivos, decisões e processos: Melhorar legibilidade e foco, aproximando o visual ao design mostrado no anexo (badge abaixo do email); reduzir a complexidade do estilo anterior.
* ✔️ Benefícios:
  - Visual mais moderno e alinhado ao produto.
  - Badge mais legível em diferentes temas e dispositivos.

8- Remover duplicata do bloco de plano e ajustar espaçamento
* Removemos um bloco duplicado do plano que aparecia abaixo da data de criação e adicionamos espaçamento entre o email e a badge (aumentando `marginTop`).
* 🔹 Objetivos, decisões e processos: Eliminar redundância de informação e alinhar o layout à referência visual; aplicar `marginTop` na `planBadgePill`.
* ✔️ Benefícios:
  - Layout mais limpo e sem repetições.
  - Melhora na hierarquia visual e no foco do usuário.

9- Redesenho inicial do `Dashboard` com cartões coloridos
* Criamos uma versão inicial de `src/pages/Dashboard/Dashboard.tsx` com cartões de estatísticas coloridos (Cortes, Peças, Oficinas, Pagamentos), atalhos rápidos e uma área de insights.
* 🔹 Objetivos, decisões e processos: Aplicar padrões visuais já presentes no app; priorizar cartões clicáveis para atalhos; manter placeholder para insights que receberão dados avançados depois.
* ✔️ Benefícios:
  - Tela inicial mais informativa e útil ao usuário.
  - Base pronta para adicionar gráficos e métricas detalhadas.

10- Conectar `Dashboard` a serviços reais
* Integramos o `Dashboard` às APIs internas: `getCutStatistics`, `getWorkshopsByUser` e `getPaymentStatistics` para preencher os cartões com dados reais do usuário.
* 🔹 Objetivos, decisões e processos: Usar `user.id` do `AuthContext` para buscar dados; executar `Promise.all` para carregamento paralelo; tratar erros silenciosamente para não interromper a experiência.
* ✔️ Benefícios:
  - Dados reais exibidos ao usuário sem necessidade de navegação adicional.
  - Melhor compreensão do estado do negócio na visão principal.

11- Tornar os cartões do `Dashboard` navegáveis
* Transformamos os cartões de estatísticas em `TouchableOpacity` e mapeamos para rotas existentes (`Cuts`, `Batches`, `Workshops`, `Payments`).
* 🔹 Objetivos, decisões e processos: Facilitar acesso rápido às telas mais usadas; usar `useNavigation` do provedor de rotas já implementado.
* ✔️ Benefícios:
  - Melhora na eficiência de navegação do usuário.
  - Redução de passos para executar ações prioritárias.

12- Padronização de estilos entre páginas
* Aplicamos padrões de estilo consistentes para cartões, botões e seções (sombras, bordas arredondadas, padding) seguindo a linguagem visual existente.
* 🔹 Objetivos, decisões e processos: Reutilizar tokens visuais existentes (cores, elevações); reduzir divergências em telas como `Workshops`, `Cuts`, `Plans` e `Profile`.
* ✔️ Benefícios:
  - Aparência coesa em todas as telas.
  - Menor custo ao replicar novos componentes com o mesmo visual.

13- Uso das APIs de serviço com tratamento robusto
* Garantimos chamadas a serviços (`cutService`, `workshopService`, `paymentService`) com validações e tratamento de erros já presentes nas funções (try/catch, mensagens amigáveis).
* 🔹 Objetivos, decisões e processos: Reaproveitar lógica de negócio existente; manter mensagens de erro claras e logs para debug.
* ✔️ Benefícios:
  - Menor risco de falha aparente para o usuário.
  - Diagnóstico mais simples para desenvolvedores em caso de falhas.

14- Feedback visual em ações assíncronas
* Adicionamos estados `loading` e desabilitação de botões nas ações de assinatura e submissão de formulários para evitar ações duplicadas.
* 🔹 Objetivos, decisões e processos: Proteger endpoints e melhorar UX; exibir texto de processamento nos botões e usar `Alert` para confirmação.
* ✔️ Benefícios:
  - Prevenção de requisições duplicadas.
  - Usuário recebe feedback claro sobre o andamento da operação.

15- Planejamento e rastreabilidade das tarefas realizadas
* Mantivemos um registro interno de tarefas (uso do `manage_todo_list`) para acompanhar etapas: identificar páginas com problemas, aplicar mudanças e testar.
* 🔹 Objetivos, decisões e processos: Quebrar o trabalho em etapas verificáveis; atualizar status de cada item conforme a execução.
* ✔️ Benefícios:
  - Transparência do progresso das entregas.
  - Facilita retomada e revisão por outros desenvolvedores.

16- Boas práticas aplicadas e próximos passos sugeridos
* Aplicamos padrões como centralização de rolagem, tratamento de estados e reutilização de serviços; sugerimos próximas entregas: formatar números/valores, ligar atalhos do Dashboard, adicionar gráficos e integração de pagamento.
* 🔹 Objetivos, decisões e processos: Deixar a base pronta para evolução incremental e fácil integração com features futuras.
* ✔️ Benefícios:
  - Projeto preparado para evolução ágil.
  - Menor esforço ao integrar funcionalidades de produto.

----
Arquivo criado: `doc26mar.md` (raiz do projeto)

Se quiser, eu:
- 🔹 Conecto os atalhos do Dashboard à navegação agora;
- 🔹 Formato os números (BRL / inteiros) nos cartões;
- 🔹 Adiciono estados visuais de carregamento nos cartões do Dashboard.

Diga qual opção prefere que eu execute a seguir.