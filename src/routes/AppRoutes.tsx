import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import Login from "../pages/Login/Login";
import RegisterSelection from "../pages/RegisterSelection/RegisterSelection";
import Register from "../pages/Register/Register";
import RegisterWorkshop from "../pages/RegisterWorkshop/RegisterWorkshop";
import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";
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
import PlanCheckout from "../pages/Plans/PlanCheckout";
import BatchOffer from "../pages/BatchOffer/BatchOffer";
import { useNavigation } from "../routes/NavigationContext";
import { useAuth } from "../hooks/useAuth";
import {
  paths,
  protectedRoutes,
  type ScreenName,
} from "./paths";
import {
  storePendingBatchOffer,
  readPendingBatchOffer,
  clearPendingBatchOffer,
} from "../utils/pendingBatchOffer";

const LANGUAGE_STORAGE_KEY = "@costura_conectada:language";
const ADMIN_EMAIL = "costuraconectada@gmail.com";

const screenComponents: Record<ScreenName, React.ComponentType> = {
  LanguageSelection,
  Login,
  RegisterSelection,
  Register,
  RegisterWorkshop,
  AdminDashboard,
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
  PlanCheckout,
  BatchOffer,
};

const guestOnlyRoutes = new Set<ScreenName>([
  paths.login,
  paths.registerSelection,
  paths.register,
  paths.registerWorkshop,
]);
const authRequiredRoutes = new Set<ScreenName>(protectedRoutes);

export const AppRoutes = () => {
  const { currentScreen, navigate } = useNavigation();
  const { user, loading } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const [checkingLanguage, setCheckingLanguage] = useState(true);
  const isAdmin = !!user && (user.userType === "admin" || user.email?.toLowerCase() === ADMIN_EMAIL);

  const navigateFromBatchOfferUrl = useCallback((url: string | null) => {
    if (!url) return false;
    const parsed = Linking.parse(url);
    const batchId = parsed.queryParams?.batchId;
    const token = parsed.queryParams?.token;
    if (!batchId || !token || typeof batchId !== "string" || typeof token !== "string") {
      return false;
    }
    const u = userRef.current;
    if (u?.userType === "workshop") {
      void clearPendingBatchOffer();
      navigate(paths.batchOffer, { batchOffer: { batchId, token } });
      return true;
    }
    if (!u) {
      void storePendingBatchOffer({ batchId, token });
      navigate(paths.login);
      return true;
    }
    void clearPendingBatchOffer();
    Alert.alert(
      "Costura Conectada",
      "Este convite é apenas para contas de oficina.",
    );
    return true;
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    void Linking.getInitialURL().then((initial) => {
      if (initial) void navigateFromBatchOfferUrl(initial);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      void navigateFromBatchOfferUrl(url);
    });
    return () => sub.remove();
  }, [loading, navigateFromBatchOfferUrl]);

  // Verificar se já tem idioma salvo para pular seleção
  useEffect(() => {
    const checkLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if ((savedLanguage || user?.language) && currentScreen === paths.languageSelection) {
          if (user) {
            navigate(isAdmin ? paths.adminDashboard : paths.dashboard);
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
  }, [loading, user, currentScreen, navigate, isAdmin]);

  // Usuário autenticado não deve ficar em tela de autenticação (convite de lote tem prioridade)
  useEffect(() => {
    if (!loading && !checkingLanguage && user && guestOnlyRoutes.has(currentScreen)) {
      void (async () => {
        const pending = await readPendingBatchOffer();
        if (pending && user.userType === "workshop") {
          await clearPendingBatchOffer();
          navigate(paths.batchOffer, { batchOffer: pending });
          return;
        }
        navigate(isAdmin ? paths.adminDashboard : paths.dashboard);
      })();
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate, isAdmin]);

  // Usuário comum não pode acessar dashboard de admin
  useEffect(() => {
    if (!loading && !checkingLanguage && user && currentScreen === paths.adminDashboard && !isAdmin) {
      navigate(paths.dashboard);
    }
  }, [user, loading, checkingLanguage, currentScreen, navigate, isAdmin]);

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
