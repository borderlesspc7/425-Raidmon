import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";

export interface AppTheme {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    surfaceSoft: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    danger: string;
    overlay: string;
    iconSoft: string;
  };
}

interface ThemeContextType {
  theme: AppTheme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = "@costura_conectada:theme_mode";

const lightTheme: AppTheme = {
  mode: "light",
  colors: {
    background: "#F8F9FA",
    surface: "#FFFFFF",
    surfaceSoft: "#F3F4F6",
    text: "#111827",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    primary: "#6366F1",
    danger: "#EF4444",
    overlay: "rgba(0, 0, 0, 0.5)",
    iconSoft: "#F0F4FF",
  },
};

const darkTheme: AppTheme = {
  mode: "dark",
  colors: {
    background: "#0B1020",
    surface: "#131A2D",
    surfaceSoft: "#1B243B",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    border: "#27324A",
    primary: "#818CF8",
    danger: "#F87171",
    overlay: "rgba(0, 0, 0, 0.7)",
    iconSoft: "#1E293B",
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") {
          setModeState(saved);
        }
      } catch (error) {
        console.error("Erro ao carregar tema:", error);
      }
    })();
  }, []);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (error) {
      console.error("Erro ao salvar tema:", error);
    }
  };

  const toggleTheme = async () => {
    await setMode(mode === "light" ? "dark" : "light");
  };

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      mode,
      isDark: mode === "dark",
      setMode,
      toggleTheme,
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext deve ser usado dentro de ThemeProvider");
  }
  return context;
};
