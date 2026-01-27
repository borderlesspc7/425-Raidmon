import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from '../lib/firebaseconfig';
import { User, LoginCredentials, RegisterCredentials } from '../types/auth';

// Função auxiliar para converter Timestamp do Firestore para Date
const convertTimestampToDate = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date();
  }
  
  // Se for Timestamp do Firestore
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  // Se for Date do JavaScript
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // Se for Timestamp (objeto com seconds e nanoseconds)
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  // Se for string ou número
  return new Date(timestamp);
};

// Função auxiliar para converter Firebase User para User do sistema
const convertFirebaseUserToUser = async (firebaseUser: FirebaseUser): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    
    return {
      id: firebaseUser.uid,
      name: userData.name || '',
      email: userData.email || firebaseUser.email || '',
      username: userData.username,
      phone: userData.phone,
      photoURL: userData.photoURL || firebaseUser.photoURL || '',
      language: userData.language || 'pt',
      cpf: userData.cpf || '',
      rg: userData.rg || '',
      createdAt: convertTimestampToDate(userData.createdAt),
      updatedAt: convertTimestampToDate(userData.updatedAt),
    };
  } catch (error) {
    console.error('Erro ao converter Firebase User:', error);
    return null;
  }
};

export const authService = {
  // Login com email e senha
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        credentials.email, 
        credentials.password
      );

      const firebaseUser = userCredential.user;
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (!userDoc.exists()) {
        throw new Error('Usuário não encontrado no banco de dados');
      }

      const userData = userDoc.data();
      
      const user: User = {
        id: firebaseUser.uid,
        name: userData.name || '',
        email: userData.email || firebaseUser.email || '',
        username: userData.username,
        phone: userData.phone,
        photoURL: userData.photoURL || firebaseUser.photoURL || '',
        language: userData.language || 'pt',
        cpf: userData.cpf || '',
        rg: userData.rg || '',
        createdAt: convertTimestampToDate(userData.createdAt),
        updatedAt: new Date(),
      };

      // Atualiza o updatedAt no Firestore
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        updatedAt: serverTimestamp(),
      });

      return user;
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      
      // Tratamento de erros específicos do Firebase
      if (error.code === 'auth/user-not-found') {
        throw new Error('Usuário não encontrado');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Senha incorreta');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('E-mail inválido');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('Usuário desabilitado');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas. Tente novamente mais tarde');
      }
      
      throw new Error(error.message || 'Erro ao fazer login');
    }
  },

  // Registro de novo usuário
  async register(credentials: RegisterCredentials): Promise<User> {
    try {
      // Validações
      if (!credentials.email || !credentials.password || !credentials.name) {
        throw new Error('Todos os campos são obrigatórios');
      }

      if (credentials.password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      if (credentials.confirmPassword && credentials.password !== credentials.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      // Cria o usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        credentials.email, 
        credentials.password
      );

      const firebaseUser = userCredential.user;

      // Cria o documento do usuário no Firestore
      const userData: User = {
        id: firebaseUser.uid,
        name: credentials.name,
        email: credentials.email,
        cpf: credentials.cpf,
        rg: credentials.rg,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return userData;
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      
      // Tratamento de erros específicos do Firebase
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este e-mail já está em uso');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('E-mail inválido');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('A senha é muito fraca');
      }
      
      throw new Error(error.message || 'Erro ao criar conta');
    }
  },

  // Logout
  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      throw new Error(error.message || 'Erro ao fazer logout');
    }
  },

  // Observa mudanças no estado de autenticação
  observeAuthState(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await convertFirebaseUserToUser(firebaseUser);
        callback(user);
      } else {
        callback(null);
      }
    });
  },

  // Buscar dados de um usuário por ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        console.log('Documento não existe para userId:', userId);
        return null;
      }

      const userData = userDoc.data();
      
      return {
        id: userDoc.id,
        name: userData.name || '',
        email: userData.email || '',
        username: userData.username,
        phone: userData.phone,
        photoURL: userData.photoURL || '',
        language: userData.language || 'pt',
        cpf: userData.cpf || '',
        rg: userData.rg || '',
        createdAt: convertTimestampToDate(userData.createdAt),
        updatedAt: convertTimestampToDate(userData.updatedAt),
      };
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      throw error;
    }
  },

  // Atualizar perfil do usuário
  async updateProfile(userId: string, data: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      // Remover campos que não devem ser atualizados
      delete updateData.id;
      delete updateData.email;
      delete updateData.createdAt;
      
      await updateDoc(userRef, updateData);
      console.log('Perfil atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  },

  // Atualizar foto de perfil
  async updateProfilePhoto(userId: string, photoURL: string): Promise<void> {
    try {
      await this.updateProfile(userId, { photoURL });
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error);
      throw error;
    }
  },

};
