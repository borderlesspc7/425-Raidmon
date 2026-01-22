import { createContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import type {
  User,
  LoginCredentials,
  RegisterCredentials,
} from "../types/auth";
import type { ReactNode } from "react";
import type { FirebaseError } from "firebase/app";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (credentials: RegisterCredentials) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = authService.observeAuthState((user) => {
            setUser(user);
            setLoading(false);
        })

        return () => unsubscribe();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        try{
            setLoading(true);
            setError(null);
            const user = await authService.login(credentials);
            setUser(user);
            setLoading(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Erro ao fazer login");
            setLoading(false);
            throw error;
        }
    }

    const register = async (credentials: RegisterCredentials) => {
        try{
            setLoading(true);
            setError(null);
            const user = await authService.register(credentials);
            setUser(user);
            setLoading(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Erro ao fazer registro");
            setLoading(false);
            throw error;
        }
    }

    const logout = async () => {
        try{
            setLoading(true);
            await authService.logout();
            setUser(null);
            setLoading(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Erro ao fazer logout");
            setLoading(false);
            throw error;
        }
    } 

    const clearError = () => {
        setError(null)
    }

    const value = {
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export {AuthContext}