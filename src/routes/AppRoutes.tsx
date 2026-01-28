import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text as RNText } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Dashboard from "../pages/Dashboard/Dashboard";
import LanguageSelection from "../pages/LanguageSelection/LanguageSelection";
import Workshops from "../pages/Workshops/Workshops";
import { useNavigation } from "../routes/NavigationContext";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";

const LANGUAGE_STORAGE_KEY = '@costura_conectada:language';

export const AppRoutes = () => {
  const { currentScreen, navigate } = useNavigation();
  const { user, loading } = useAuth();
  const { language, t } = useLanguage();
  const [checkingLanguage, setCheckingLanguage] = useState(true);

  // Verificar se já tem idioma salvo na primeira vez
  useEffect(() => {
    const checkLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        // Se já tem idioma salvo (no storage ou no perfil do usuário), pula a tela de seleção
        if (savedLanguage || user?.language) {
          if (currentScreen === "LanguageSelection") {
            if (user) {
              navigate("Dashboard");
            } else {
              navigate("Login");
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar idioma:', error);
      } finally {
        setCheckingLanguage(false);
      }
    };

    if (!loading) {
      checkLanguage();
    }
  }, [loading, user, currentScreen, navigate]);

  // Redirecionar para Dashboard se estiver autenticado e na tela de Login/Register
  useEffect(() => {
    if (!loading && !checkingLanguage && user && (currentScreen === "Login" || currentScreen === "Register")) {
      navigate("Dashboard");
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  // Redirecionar para Login se não estiver autenticado e tentar acessar Dashboard
  useEffect(() => {
    if (!loading && !checkingLanguage && !user && currentScreen === "Dashboard") {
      navigate("Login");
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  // Mostrar loading enquanto verifica autenticação ou idioma
  if (loading || checkingLanguage) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Renderizar tela baseada no currentScreen
  switch (currentScreen) {
    case "LanguageSelection":
      return <LanguageSelection />;
    case "Login":
      return <Login />;
    case "Register":
      return <Register />;
    case "Dashboard":
    case "Profile":
    case "Workshops":
    case "Cuts":
    case "Batches":
    case "WorkshopStatus":
    case "FinishedProduction":
    case "ReceivePieces":
    case "Payments":
    case "FinancialHistory":
    case "GeneralHistory":
    case "Metrics":
    case "Plans":
      // Só mostrar telas protegidas se estiver autenticado
      if (user) {
        if (currentScreen === "Dashboard") {
          return <Dashboard />;
        }
        if (currentScreen === "Workshops") {
          return <Workshops />;
        }
        // Placeholder para outras telas - você pode criar componentes específicos depois
        return (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
            <RNText style={{ fontSize: 18, color: "#1F2937", fontWeight: "600" }}>{currentScreen}</RNText>
            <RNText style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>{t('common.loading')}</RNText>
          </View>
        );
      }
      return <Login />;
    default:
      return <LanguageSelection />;
  }
};
