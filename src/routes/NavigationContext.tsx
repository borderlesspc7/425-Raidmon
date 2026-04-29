import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BackHandler, Platform } from "react-native";
import { paths, type ScreenName } from "./paths";

interface NavigationParams {
  userId?: string;
  planId?: "basic" | "premium" | "enterprise";
  batchOffer?: { batchId: string; token: string };
  receiveCheckout?: { receiveId: string; token: string };
  ownerWorkshopPay?: { paymentId: string; token: string };
  /** Dono: conferir peças recebidas antes de gerar PIX */
  ownerBatchCheckout?: { batchId: string; token: string };
  /** Oficina: painel visual do lote (hub) */
  workshopBatchHub?: { batchId: string };
  /** Oficina: abrir detalhes / ações deste lote em Sua produção */
  workshopFocusBatchId?: string;
}

interface NavigationContextType {
  currentScreen: ScreenName;
  navigationParams: NavigationParams;
  navigate: (screen: ScreenName, params?: NavigationParams) => void;
  goBack: () => boolean;
  canGoBack: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined
);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(paths.languageSelection);
  const [navigationParams, setNavigationParams] = useState<NavigationParams>({});
  const [history, setHistory] = useState<ScreenName[]>([]);
  const [paramsHistory, setParamsHistory] = useState<NavigationParams[]>([]);

  const navigate = (screen: ScreenName, params?: NavigationParams) => {
    if (screen !== currentScreen) {
      setHistory((prev) => [...prev, currentScreen]);
      setParamsHistory((prev) => [...prev, navigationParams]);
    }
    setCurrentScreen(screen);
    setNavigationParams(params || {});
  };

  const goBack = () => {
    if (history.length === 0) return false;

    const previousScreen = history[history.length - 1];
    const previousParams =
      paramsHistory.length > 0 ? paramsHistory[paramsHistory.length - 1] : {};

    setHistory((prev) => prev.slice(0, -1));
    setParamsHistory((prev) => prev.slice(0, -1));
    setCurrentScreen(previousScreen);
    setNavigationParams(previousParams);
    return true;
  };

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => goBack());
    return () => sub.remove();
  }, [history, paramsHistory]);

  return (
    <NavigationContext.Provider
      value={{
        currentScreen,
        navigationParams,
        navigate,
        goBack,
        canGoBack: history.length > 0,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
};
