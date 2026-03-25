1- Correção do erro Firestore ao criar lote
Criamos uma validação e sanitização dos dados enviados ao Firestore para evitar campos com valor `undefined`.
🔹 Objetivos, decisões e processos: Garantir que `addDoc` não receba campos undefined (especialmente `workshopId`). Decidimos construir um `payload` explícito em `src/services/batchService.ts` em vez de espalhar objetos do formulário. Processamos `deliveryDate` para `Timestamp` apenas quando presente.
✔️ Benefícios:
Melhora na confiabilidade das operações de escrita no Firestore.
Eliminação do erro "Unsupported field value: undefined" ao criar lotes.
Redução de falhas em produção relacionadas a dados inválidos.

2- Sanitização do payload em `createBatch` e `updateBatch`
Alteramos `createBatch` e `updateBatch` para remover chaves com valor `undefined` antes de chamar Firestore.
🔹 Objetivos, decisões e processos: Evitar que `updateDoc` e `addDoc` recebam propriedades inválidas. Implementamos lógica para construir `payload` e filtrar `undefined` dinamicamente.
✔️ Benefícios:
Evita rejeições por dados inválidos.
Mantém a modelagem do documento previsível no banco.
Facilita o rastreamento de erros e a manutenção.

3- Conversão condicional de datas para `Timestamp`
Convertimos `deliveryDate` para `Timestamp.fromDate()` somente quando o campo estiver definido.
🔹 Objetivos, decisões e processos: Converter datas para o formato Firestore apenas quando necessário, evitando enviar `undefined` ou valores inválidos.
✔️ Benefícios:
Dados de data consistentes no Firestore.
Previne erros de serialização/validação.

4- Movimentação dos cards de estatísticas para dentro do `ScrollView`
Realocamos o bloco de cards estatísticos em `src/pages/Batches/Batches.tsx` para que rolem junto com o conteúdo da tela.
🔹 Objetivos, decisões e processos: Melhorar a UX tornando o painel de estatísticas navegável em telas menores. Mantivemos a lógica de cálculo existente e apenas alteramos a hierarquia do layout.
✔️ Benefícios:
Melhor usabilidade em dispositivos móveis.
Interface mais consistente durante navegação por listas longas.

5- Adição do campo `plan` ao tipo `User`
Atualizamos `src/types/auth.ts` para incluir `plan?: 'basic' | 'premium' | 'enterprise'` no modelo `User`.
🔹 Objetivos, decisões e processos: Tornar explícito o suporte a planos de assinatura no tipo de usuário para facilitar exibições e lógica condicional.
✔️ Benefícios:
Tipagem mais clara para desenvolvedores.
Reduz risco de runtime ao acessar `user.plan`.

6- Mapeamento do `plan` em `authService`
Alteramos `src/services/authService.ts` para ler e mapear o campo `plan` do documento de usuário no Firebase.
🔹 Objetivos, decisões e processos: Garantir que o objeto `User` retornado pelas funções de leitura contenha a propriedade `plan` quando presente no banco.
✔️ Benefícios:
Dados do usuário mais completos para a UI.
Habilita exibição de informações de assinatura sem chamadas adicionais.

7- Inserção de badge de Plano no `Profile`
Adicionamos um badge visual e um bloco "Plano Atual" em `src/pages/Profile/Profile.tsx` exibindo o nome do plano com as cores já definidas em `Plans.tsx`.
🔹 Objetivos, decisões e processos: Reaproveitar paleta de cores e textos de `translations.ts` para manter consistência visual. Implementamos o badge próximo ao avatar e um card pequeno abaixo do campo "Membro desde".
✔️ Benefícios:
Usuário visualiza rapidamente seu nível de assinatura.
Consistência de identidade visual entre telas de plano e perfil.

8- Exibição condicional do texto do plano
Ajustamos a lógica para mostrar apenas o nome do plano quando definido, e a mensagem padrão (`plans.currentPlanDescription`) quando não houver plano.
🔹 Objetivos, decisões e processos: Seguir solicitação do usuário para sempre exibir informação sobre o plano, usando traduções existentes para texto padrão.
✔️ Benefícios:
Clareza para o usuário sobre seu estado de assinatura.
Evita áreas vazias no layout quando não há plano registrado.

9- Correção de estilos faltantes no `Profile`
Adicionamos estilos (`planBadge`, `planBadgeText`, `currentPlanCardSmall`, entre outros) para evitar erros de compilação após inserir o novo bloco de UI.
🔹 Objetivos, decisões e processos: Corrigir erros de lint/compile introduzidos pela adição do componente visual. Mantivemos o padrão de estilos já usado no arquivo.
✔️ Benefícios:
Compilação limpa sem erros de referência a estilos.
UI consistente e previsível.

10- Uso de traduções existentes para rótulos de planos
Utilizamos chaves de `src/i18n/translations.ts` (ex.: `plans.basic.name`) para rotular o badge e o card do plano.
🔹 Objetivos, decisões e processos: Reaproveitar strings i18n para manter suporte multilíngue sem duplicação de texto.
✔️ Benefícios:
Suporte imediato a múltiplos idiomas.
Menor esforço para manter textos alinhados entre telas.

11- Ajuste na leitura de dados do usuário para compatibilidade com `useAuth`
Garantimos que a função que retorna o `User` entregue a propriedade `plan` (quando existir), facilitando o consumo por `useAuth` e componentes de perfil.
🔹 Objetivos, decisões e processos: Evitar que componentes dependam de leituras adicionais ao renderizar dados do usuário.
✔️ Benefícios:
Melhora performance por reduzir chamadas extras.
Fluxo de dados mais simples para componentes de apresentação.

12- Aplicação de boas práticas ao escrever no Firestore
Adotamos padrão de construir payloads explícitos e filtrar campos antes de gravar no banco.
🔹 Objetivos, decisões e processos: Seguir abordagem defensiva para evitar enviar dados inválidos. Documentamos a decisão como comentário no código onde aplicável.
✔️ Benefícios:
Maior robustez nas operações CRUD.
Facilidade futura para adicionar validações adicionais.

13- Pequena refatoração em `Batches.tsx` para manter lógica separada do layout
Ao mover os cards para o `ScrollView` limpamos trechos de JSX repetidos e mantivemos a lógica de cálculo de estatísticas isolada.
🔹 Objetivos, decisões e processos: Melhor legibilidade e manutenção do componente, com mínima alteração funcional.
✔️ Benefícios:
Código mais fácil de entender e modificar.
Menos propensão a bugs ao alterar layout.

14- Testes manuais sugeridos e checklist de verificação
Incluímos passos sugeridos para validação local: criar lote, editar lote, verificar documento no Firestore e abrir perfil para confirmar exibição do plano.
🔹 Objetivos, decisões e processos: Fornecer caminho claro para o time validar alterações sem depender de ambiente remoto.
✔️ Benefícios:
Facilita aceitação das mudanças.
Reduz tempo para encontrar regressões.

15- Atualização do contrato de tipos para maior segurança
Reforçamos tipagem em retornos de serviços (ex.: retorno de usuário) para refletir o novo campo `plan`.
🔹 Objetivos, decisões e processos: Evitar asserts indefinidos em runtime e aproveitar checagem do TypeScript.
✔️ Benefícios:
Menos erros em tempo de execução.
Melhor auxílio do editor (autocompletion e refactors).

16- Limpeza mínima e commits granulares
As alterações foram aplicadas em patches pequenos e focados, facilitando revisão e revert quando necessário.
🔹 Objetivos, decisões e processos: Evitar mudanças massivas; cada alteração foi circunscrita ao arquivo e função afetados.
✔️ Benefícios:
Revisões de código mais rápidas.
Menor risco ao integrar no branch principal.

---

Observações finais:
- O relatório descreve todas as mudanças implementadas desde o início da sessão de suporte. Recomenda-se executar testes locais (build & run) e validar operações Firestore em ambiente de desenvolvimento ou emulador.
- Caso queira, posso também gerar uma versão em HTML ou abrir um PR com essas alterações já commitadas.
