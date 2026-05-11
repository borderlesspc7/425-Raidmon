  export type Language = 'pt' | 'es';

  export type WorkshopAsaasStored = {
    address: string;
    addressNumber: string;
    province: string;
    postalCode: string;
    incomeValue: number;
    complement?: string;
    birthDate?: string;
    companyType?: string;
  };

  /** Status reportados pelo Asaas para uma assinatura. */
  export type AsaasSubscriptionStatus =
    | 'ACTIVE'
    | 'OVERDUE'
    | 'INACTIVE'
    | 'CANCELLED'
    | 'EXPIRED';

  export interface User {
    id: string;
    name: string;
    email: string;
    // Current plan id: 'basic' | 'premium' | 'enterprise'
    plan?: 'basic' | 'premium' | 'enterprise';
    username?: string;
    phone?: string;
    companyName?: string;
    photoURL?: string;
    language?: Language;
    address?: string;
    about?: string;
    estimatedRevenue?: number;
    userType?: 'owner' | 'workshop' | 'admin';
    /** Preenchido pelo backend após integração Asaas */
    asaasCustomerId?: string;
    /** Subconta Asaas (oficina); preenchido pela Cloud Function */
    asaasSubaccountId?: string;
    asaasSubaccountError?: string;
    /** Dados fiscais/endereço da oficina (sincronizados com a subconta Asaas) */
    workshopAsaas?: WorkshopAsaasStored;
    /** Assinatura ativa no Asaas (Cloud Function `createAsaasSubscription`). */
    asaasSubscriptionId?: string;
    /** Plano contratado nessa assinatura (pode estar à frente de `plan` em estados transitórios). */
    subscriptionPlan?: 'basic' | 'premium' | 'enterprise';
    /** Status reportado pelos webhooks Asaas / reconciliação diária. */
    subscriptionStatus?: AsaasSubscriptionStatus | string;
    /** Próxima data de vencimento (YYYY-MM-DD) reportada pelo Asaas. */
    subscriptionNextDueDate?: string;
    /** Valor da assinatura em reais. */
    subscriptionValue?: number;
    cpf: string;
    rg: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface authState {
      user: User | null;
      isLoading: boolean;
      error: string | null;
  }
  
  export interface LoginCredentials {
      email: string;
      password: string;
  }
  
  /**
   * Dados para criação de subconta Asaas (obrigatórios no POST /v3/accounts).
   * Enviados à callable; o backend confere e-mail, CPF/CNPJ, celular e faturamento com o Firestore.
   */
  export interface WorkshopAsaasSubaccountInput {
    email: string;
    cpfCnpj: string;
    mobilePhone: string;
    incomeValue: number;
    address: string;
    addressNumber: string;
    province: string;
    postalCode: string;
    complement?: string;
    /** AAAA-MM-DD (obrigatório se CPF, 11 dígitos) */
    birthDate?: string;
    /** Obrigatório se CNPJ (14 dígitos) */
    companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  }

  /** Campos de endereço e renda da oficina; gravados em `users/{uid}.workshopAsaas` */
  export interface WorkshopAsaasFormData {
    address: string;
    addressNumber: string;
    province: string;
    postalCode: string;
    incomeValue: number;
    complement?: string;
    /** DD/MM/AAAA — obrigatório se CPF (11 dígitos) */
    birthDate?: string;
    /** Obrigatório se CNPJ (14 dígitos) */
    companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  }

  export interface RegisterCredentials extends LoginCredentials {
    name: string;
    companyName?: string;
    phone?: string;
    password: string;
    confirmPassword?: string;
    cpf?: string;
    estimatedRevenue?: number;
    userType: 'owner' | 'workshop' | 'admin';
    /** Só oficina: persistido e usado na subconta Asaas */
    workshopAsaas?: WorkshopAsaasFormData;
  }