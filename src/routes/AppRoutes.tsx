import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { appUrlFromParsedOrNull } from "../utils/appDeepLink";
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
import WorkshopProduction from "../pages/WorkshopProduction/WorkshopProduction";
import WorkshopBatchHub from "../pages/WorkshopBatchHub/WorkshopBatchHub";
import ReceiveCheckout from "../pages/ReceiveCheckout/ReceiveCheckout";
import OwnerWorkshopPayment from "../pages/OwnerWorkshopPayment/OwnerWorkshopPayment";
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
import {
  storePendingReceiveCheckout,
  readPendingReceiveCheckout,
  clearPendingReceiveCheckout,
} from "../utils/pendingReceiveCheckout";
import {
  storePendingOwnerPayment,
  readPendingOwnerPayment,
  clearPendingOwnerPayment,
} from "../utils/pendingOwnerPayment";
import {
  storePendingOwnerBatchCheckout,
  readPendingOwnerBatchCheckout,
  clearPendingOwnerBatchCheckout,
} from "../utils/pendingOwnerBatchCheckout";

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
  OwnerWorkshopPayment,
  WorkshopProduction,
  WorkshopBatchHub,
  ReceiveCheckout,
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

  const handleIncomingAppUrl = useCallback((url: string | null) => {
    if (!url) return false;
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams || {};
    const receiveId = qp.receiveId;
    const token = qp.token;
    const batchId = qp.batchId;
    const paymentId = qp.paymentId;
    const oc = qp.ownerCheckout;
    const ownerCheckout =
      oc === "1" || (Array.isArray(oc) && oc[0] === "1");

    if (
      typeof paymentId === "string" &&
      typeof token === "string" &&
      typeof batchId !== "string"
    ) {
      void clearPendingOwnerPayment();
      const u = userRef.current;
      if (!u) {
        void storePendingOwnerPayment({ paymentId, token });
        navigate(paths.login);
        return true;
      }
      navigate(paths.ownerWorkshopPayment, {
        ownerWorkshopPay: { paymentId, token },
      });
      return true;
    }

    if (
      typeof receiveId === "string" &&
      typeof token === "string" &&
      (!batchId || typeof batchId !== "string")
    ) {
      const u = userRef.current;
      if (u?.userType === "workshop") {
        void clearPendingReceiveCheckout();
        navigate(paths.receiveCheckout, { receiveCheckout: { receiveId, token } });
        return true;
      }
      if (!u) {
        void storePendingReceiveCheckout({ receiveId, token });
        navigate(paths.login);
        return true;
      }
      void clearPendingReceiveCheckout();
      Alert.alert(
        "Costura Conectada",
        "Este link de aprovação é apenas para contas de oficina.",
      );
      return true;
    }

    if (typeof batchId === "string" && typeof token === "string" && ownerCheckout) {
      void clearPendingOwnerBatchCheckout();
      const u = userRef.current;
      if (!u) {
        void storePendingOwnerBatchCheckout({ batchId, token });
        navigate(paths.login);
        return true;
      }
      if (u.userType === "workshop") {
        Alert.alert(
          "Costura Conectada",
          "Este link é para o dono da confecção conferir o lote e pagar.",
        );
        return true;
      }
      navigate(paths.ownerWorkshopPayment, {
        ownerBatchCheckout: { batchId, token },
      });
      return true;
    }

    if (typeof batchId === "string" && typeof token === "string") {
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
    }
    return false;
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    void (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) {
        void handleIncomingAppUrl(initial);
        return;
      }
      const parsed = await Linking.parseInitialURLAsync();
      const recovered = appUrlFromParsedOrNull(parsed);
      if (recovered) void handleIncomingAppUrl(recovered);
    })();
    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleIncomingAppUrl(url);
    });
    return () => sub.remove();
  }, [loading, handleIncomingAppUrl]);

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
        const batchPend = await readPendingBatchOffer();
        if (batchPend && user.userType === "workshop") {
          await clearPendingBatchOffer();
          navigate(paths.batchOffer, { batchOffer: batchPend });
          return;
        }
        const receivePend = await readPendingReceiveCheckout();
        if (receivePend && user.userType === "workshop") {
          await clearPendingReceiveCheckout();
          navigate(paths.receiveCheckout, { receiveCheckout: receivePend });
          return;
        }
        const ownerBatchPend = await readPendingOwnerBatchCheckout();
        if (
          ownerBatchPend &&
          (user.userType === "owner" || user.userType === "admin")
        ) {
          await clearPendingOwnerBatchCheckout();
          navigate(paths.ownerWorkshopPayment, {
            ownerBatchCheckout: ownerBatchPend,
          });
          return;
        }
        const ownerPayPend = await readPendingOwnerPayment();
        if (ownerPayPend) {
          await clearPendingOwnerPayment();
          navigate(paths.ownerWorkshopPayment, { ownerWorkshopPay: ownerPayPend });
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
