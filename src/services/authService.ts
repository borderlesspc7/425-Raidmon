import { auth, db } from "../lib/firebaseconfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import type {
  LoginCredentials,
  RegisterCredentials,
  User,
} from "../types/auth";

export const authService = {
    async login(credentials: LoginCredentials): Promise<User> {
        try{
            const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);

            const firebaseUser = userCredential.user
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

            if(!userDoc.exists()){
                throw new Error("User not found");
            }

            const userData = userDoc.data() as User;

            const updateUserData = {
                ...userData,
                lastLogin: new Date(),
            }

            await setDoc(doc(db, "users", firebaseUser.uid), updateUserData);

            return updateUserData;
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    },

    async register(credentials: RegisterCredentials): Promise<User> {
        try{
            if (!credentials.email || !credentials.password || !credentials.name) {
                throw new Error("Todos os campos são obrigatórios");
              }
        
              if (credentials.password.length < 6) {
                throw new Error("A senha deve ter pelo menos 6 caracteres");
              }

              const userCredential = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);

              const firebaseUser= userCredential.user;

              const userData: User = {
                uid: firebaseUser.uid,
                name: credentials.name,
                email: credentials.email,
                createdAt: new Date(),
                updatedAt: new Date(),
                role: credentials.role || "user",
              }

              await setDoc(doc(db, "users", firebaseUser.uid), userData);

              return userData;
        
        } catch (error) {
            console.error("Register error:", error);
            throw error;
        }
    },

    async logout(): Promise<void> {
        try{
            await signOut(auth);
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    },

    observeAuthState(callback: (user: User | null) => void): Unsubscribe {
        try {
          return onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              // Usuário está logado, busca dados completos no Firestore
              try {
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                if (userDoc.exists()) {
                  const userData = userDoc.data() as User;
                  callback(userData);
                } else {
                  callback(null); // Usuário não encontrado no Firestore
                }
              } catch (error) {
                console.error("Erro ao buscar dados do usuário:", error);
                callback(null);
              }
            } else {
              // Usuário não está logado
              callback(null);
            }
          });
        } catch (error) {
          throw new Error("Erro ao observar estado de autenticação: " + error);
        }
      },
    
}
    
