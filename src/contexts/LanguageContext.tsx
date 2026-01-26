import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../types/auth';
import { translations } from '../i18n/translations';
import { useAuth } from '../hooks/useAuth';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  updateUserLanguage?: (userId: string, lang: Language) => Promise<void>;
  syncUserLanguage?: (userLanguage?: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = '@costura_conectada:language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt');
  const [initialized, setInitialized] = useState(false);
  const { user } = useAuth();

  // Carregar idioma salvo ao iniciar
  useEffect(() => {
    const init = async () => {
      await loadLanguage();
      setInitialized(true);
    };
    init();
  }, []);

  // Sincronizar idioma quando o usuário fizer login (mas só depois da inicialização)
  useEffect(() => {
    if (initialized && user?.language && user.language !== language) {
      console.log('Sincronizando idioma do usuário:', user.language);
      setLanguageState(user.language);
      saveLanguageToStorage(user.language);
    }
  }, [user?.language, initialized]);

  const loadLanguage = async () => {
    try {
      // Carrega do AsyncStorage
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      console.log('Idioma carregado do storage:', savedLanguage);
      if (savedLanguage && (savedLanguage === 'pt' || savedLanguage === 'es')) {
        setLanguageState(savedLanguage as Language);
      }
    } catch (error) {
      console.error('Erro ao carregar idioma:', error);
    }
  };

  const saveLanguageToStorage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
      console.error('Erro ao salvar idioma:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    console.log('Alterando idioma para:', lang);
    setLanguageState(lang);
    await saveLanguageToStorage(lang);
  };

  const updateUserLanguage = async (userId: string, lang: Language) => {
    try {
      const { authService } = await import('../services/authService');
      await authService.updateProfile(userId, { language: lang });
      // Atualiza o idioma local também
      setLanguageState(lang);
      await saveLanguageToStorage(lang);
    } catch (error) {
      console.error('Erro ao atualizar idioma do usuário:', error);
    }
  };

  const syncUserLanguage = async (userLanguage?: Language) => {
    if (userLanguage) {
      setLanguageState(userLanguage);
      await saveLanguageToStorage(userLanguage);
    }
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback para português se a chave não existir
        let fallbackValue: any = translations.pt;
        for (const fk of keys) {
          fallbackValue = fallbackValue?.[fk];
        }
        return fallbackValue || key;
      }
    }
    
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, updateUserLanguage, syncUserLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
