  export type Language = 'pt' | 'es';

  export interface User {
    id: string;
    name: string;
    email: string;
    username?: string;
    phone?: string;
    photoURL?: string;
    language?: Language;
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
  }