  export type Language = 'pt' | 'es';

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
  
  export interface RegisterCredentials extends LoginCredentials {
    name: string;
    companyName?: string;
    phone?: string;
    password: string;
    confirmPassword?: string;
    cpf: string;
    rg: string;
  }