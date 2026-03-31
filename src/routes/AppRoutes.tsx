import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import WorkshopHome from "../pages/Workshop/WorkshopHome";
import Dashboard from "../pages/Dashboard/Dashboard";
import LanguageSelection from "../pages/LanguageSelection/LanguageSelection";
import Workshops from "../pages/Workshops/Workshops";
import Cuts from "../pages/Cuts/Cuts";
import Profile from "../pages/Profile/Profile";
import Batches from "../pages/Batches/Batches";
import WorkshopStatus from "../pages/WorkshopStatus/WorkshopStatus";
import FinishedProduction from "../pages/FinishedProduction/FinishedProduction";
import ReceivePieces from "../pages/ReceivePieces/ReceivePieces";
import Payments from "../pages/Payments/Payments";
import FinancialHistory from "../pages/FinancialHistory/FinancialHistory";
import GeneralHistory from "../pages/GeneralHistory/GeneralHistory";
import Metrics from "../pages/Metrics/Metrics";
import Plans from "../pages/Plans/Plans";
import BasicPlan from "../pages/Plans/BasicPlan";
import PremiumPlan from "../pages/Plans/PremiumPlan";
import EnterprisePlan from "../pages/Plans/EnterprisePlan";
import { useNavigation } from "../routes/NavigationContext";
import { useAuth } from "../hooks/useAuth";
import {
  adminRoutes,
  paths,
  protectedRoutes,
  workshopRoutes,
  type ScreenName,
} from "./paths";

const LANGUAGE_STORAGE_KEY = "@costura_conectada:language";

const screenComponents: Record<ScreenName, React.ComponentType> = {
  LanguageSelection,
  Login,
  Register,
  WorkshopHome,
  Dashboard,
  Profile,
  Workshops,
  Cuts,
  Batches,
  WorkshopStatus,
  FinishedProduction,
  ReceivePieces,
  Payments,
  FinancialHistory,
  GeneralHistory,
  Metrics,
  Plans,
  BasicPlan,
  PremiumPlan,
  EnterprisePlan,
};

const guestOnlyRoutes = new Set<ScreenName>([paths.login, paths.register]);
const authRequiredRoutes = new Set<ScreenName>(protectedRoutes);
const adminOnlyRoutes = new Set<ScreenName>(adminRoutes);
const workshopOnlyRoutes = new Set<ScreenName>(workshopRoutes);

const getHomeRoute = (role?: string): ScreenName => {
  return role === "workshop" ? paths.workshopHome : paths.dashboard;
};

export const AppRoutes = () => {
  const { currentScreen, navigate } = useNavigation();
  const { user, loading } = useAuth();
  const [checkingLanguage, setCheckingLanguage] = useState(true);

  // Verificar se já tem idioma salvo para pular seleção
  useEffect(() => {
    const checkLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if ((savedLanguage || user?.language) && currentScreen === paths.languageSelection) {
          if (user) {
            navigate(getHomeRoute(user.role));
          } else {
            navigate(paths.login);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar idioma:", error);
      } finally {
        setCheckingLanguage(false);
      }
    };

    if (!loading) {
      checkLanguage();
    }
  }, [loading, user, currentScreen, navigate]);

  // Usuário autenticado não deve ficar em tela de autenticação
  useEffect(() => {
    if (
      !loading &&
      !checkingLanguage &&
      user &&
      guestOnlyRoutes.has(currentScreen)
    ) {
      navigate(getHomeRoute(user.role));
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  // Usuário não autenticado não acessa rotas protegidas
  useEffect(() => {
    if (
      !loading &&
      !checkingLanguage &&
      !user &&
      authRequiredRoutes.has(currentScreen)
    ) {
      navigate(paths.login);
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  useEffect(() => {
    if (
      !loading &&
      !checkingLanguage &&
      user?.role === "workshop" &&
      adminOnlyRoutes.has(currentScreen)
    ) {
      navigate(paths.workshopHome);
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  useEffect(() => {
    if (
      !loading &&
      !checkingLanguage &&
      user?.role === "admin" &&
      workshopOnlyRoutes.has(currentScreen)
    ) {
      navigate(paths.dashboard);
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate]);

  if (loading || checkingLanguage) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F8F9FA",
        }}
      >
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!user && authRequiredRoutes.has(currentScreen)) {
    return <Login />;
  }

  const ActiveScreen = screenComponents[currentScreen] || LanguageSelection;
  return <ActiveScreen />;
};
