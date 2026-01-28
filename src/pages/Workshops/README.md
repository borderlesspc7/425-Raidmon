# 📋 Módulo de Oficinas - Documentação

## 🎯 Visão Geral

O módulo de Oficinas permite que o dono da confecção cadastre, gerencie e monitore todas as oficinas que trabalham para ele. Inclui gerenciamento de status por cores, contatos, endereços e controle de peças.

## ✨ Funcionalidades

### ✅ Cadastro de Oficinas
- **Nome da oficina**: Campo obrigatório (mínimo 3 caracteres)
- **Endereço completo**: Campo obrigatório (mínimo 5 caracteres)
- **Contato 1 (WhatsApp)**: Campo obrigatório, com formatação automática
- **Contato 2**: Campo opcional para contato secundário
- **Status inicial**: Amarelo (Em Produção) por padrão

### 📊 Sistema de Status por Cores
- 🟢 **Verde**: Oficina livre, disponível para novos lotes
- 🟡 **Amarelo**: Em produção normal
- 🟠 **Laranja**: Produção atrasada
- 🔴 **Vermelho**: Situação crítica, requer atenção

### 📱 Visualização e Gerenciamento
- Lista todas as oficinas cadastradas
- Exibe status visual com bolinhas coloridas
- Mostra total de peças em cada oficina
- Permite editar informações
- Permite excluir oficinas (com confirmação)
- Troca rápida de status tocando nas bolinhas coloridas

### 🌍 Internacionalização
- Suporte completo para Português e Espanhol
- Todas as mensagens e textos são traduzidos automaticamente

## 🏗️ Arquitetura

### Estrutura de Arquivos

```
src/
├── types/
│   └── workshop.ts              # Interfaces TypeScript
├── services/
│   └── workshopService.ts       # Lógica de negócio e Firebase
├── pages/
│   └── Workshops/
│       ├── Workshops.tsx        # Componente principal
│       └── README.md           # Esta documentação
└── i18n/
    └── translations.ts          # Traduções PT/ES
```

### Tipos (workshop.ts)

#### WorkshopStatus
```typescript
type WorkshopStatus = 'green' | 'yellow' | 'orange' | 'red';
```

#### Workshop
```typescript
interface Workshop {
  id: string;
  name: string;
  address: string;
  contact1: string;        // WhatsApp principal
  contact2?: string;       // Contato secundário
  status: WorkshopStatus;
  totalPieces: number;
  userId: string;          // Dono da confecção
  createdAt: Date;
  updatedAt: Date;
}
```

### Serviços (workshopService.ts)

#### Funções Disponíveis

1. **createWorkshop(userId, workshopData)**
   - Cria uma nova oficina
   - Valida campos obrigatórios
   - Define status padrão como 'yellow'
   - Retorna: Promise<Workshop>

2. **getWorkshopsByUser(userId)**
   - Lista todas as oficinas de um usuário
   - Ordenadas por data de criação (mais recentes primeiro)
   - Retorna: Promise<Workshop[]>

3. **getWorkshopById(workshopId)**
   - Busca uma oficina específica
   - Retorna: Promise<Workshop | null>

4. **updateWorkshop(workshopId, updateData)**
   - Atualiza dados de uma oficina
   - Atualiza automaticamente o campo `updatedAt`
   - Retorna: Promise<void>

5. **deleteWorkshop(workshopId)**
   - Remove uma oficina
   - Retorna: Promise<void>

6. **updateWorkshopStatus(workshopId, status)**
   - Atualiza apenas o status da oficina
   - Retorna: Promise<void>

7. **updateWorkshopPieces(workshopId, totalPieces)**
   - Atualiza o total de peças
   - Valida se o número não é negativo
   - Retorna: Promise<void>

### Validações Implementadas

#### Nome da Oficina
- Obrigatório
- Mínimo 3 caracteres
- Remove espaços extras

#### Endereço
- Obrigatório
- Mínimo 5 caracteres
- Remove espaços extras

#### Contato 1 (WhatsApp)
- Obrigatório
- Mínimo 10 caracteres (formato com números)
- Formatação automática: (XX) XXXXX-XXXX

#### Contato 2
- Opcional
- Mesma formatação do Contato 1

## 🎨 UI/UX

### Tela Principal
- **Header**: Título, contador de oficinas e botão "+" para adicionar
- **Lista de Cards**: Cada oficina é exibida em um card elegante
- **Empty State**: Mensagem amigável quando não há oficinas

### Card de Oficina
Cada card contém:
- Status visual (bolinha colorida)
- Nome da oficina
- Endereço com ícone de localização
- Contatos com ícone de telefone
- Total de peças com ícone
- Botões rápidos de status (4 bolinhas coloridas)
- Ações: Editar e Excluir

### Modal de Cadastro/Edição
- Design moderno com bottom sheet
- Campos organizados com ícones
- Seletor visual de status com cores
- Validação em tempo real
- Botões de Cancelar e Salvar

### Cores e Estilo
- Tema principal: #6366F1 (Indigo)
- Background: #F8F9FA (Cinza claro)
- Cards: Branco com sombra sutil
- Status: Cores vibrantes e significativas

## 🔧 Como Usar

### Adicionar uma Oficina

```typescript
import { createWorkshop } from '../../services/workshopService';

const newWorkshop = await createWorkshop(userId, {
  name: 'Oficina do João',
  address: 'Rua das Flores, 123 - Centro',
  contact1: '11987654321',
  contact2: '11912345678',
  status: 'yellow'
});
```

### Listar Oficinas

```typescript
import { getWorkshopsByUser } from '../../services/workshopService';

const workshops = await getWorkshopsByUser(userId);
```

### Atualizar Status

```typescript
import { updateWorkshopStatus } from '../../services/workshopService';

await updateWorkshopStatus(workshopId, 'green');
```

### Deletar Oficina

```typescript
import { deleteWorkshop } from '../../services/workshopService';

await deleteWorkshop(workshopId);
```

## 🔐 Segurança

- Todas as oficinas são vinculadas ao userId do dono da confecção
- Apenas o usuário logado pode ver suas próprias oficinas
- Validações no frontend e backend
- Timestamps automáticos (createdAt, updatedAt)

## 🌐 Firebase/Firestore

### Coleção: `workshops`

```
workshops/
  └── {workshopId}/
      ├── name: string
      ├── address: string
      ├── contact1: string
      ├── contact2: string
      ├── status: string
      ├── totalPieces: number
      ├── userId: string
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

### Índices Recomendados
- `userId` + `createdAt` (desc) - Para listagem rápida

## 📱 Responsividade

- Layout adaptável a diferentes tamanhos de tela
- ScrollView com otimização de performance
- Modal responsivo com altura máxima de 90%
- Cards que se adaptam ao conteúdo

## 🚀 Próximas Melhorias

- [ ] Busca e filtro de oficinas
- [ ] Ordenação customizável (nome, status, peças)
- [ ] Exportação de dados (PDF/Excel)
- [ ] Integração com WhatsApp para contato direto
- [ ] Histórico de alterações de status
- [ ] Dashboard com métricas por oficina
- [ ] Notificações quando status ficar vermelho

## 🐛 Tratamento de Erros

Todos os erros são capturados e exibidos ao usuário através de:
- `Alert.alert()` para mensagens de erro
- Mensagens traduzidas em PT/ES
- Loading states durante operações assíncronas
- Validações antes de submeter ao Firebase

## 📄 Licença

Parte do sistema Costura Conectada © 2026
