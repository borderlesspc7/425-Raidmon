import React, { createContext, useContext, useState, ReactNode } from "react";

export type ScreenName =
  | "Login"
  | "Register"
  | "Dashboard"

interface NavigationParams {
  userId?: string;
}

interface NavigationContextType {
  currentScreen: ScreenName;
  navigationParams: NavigationParams;
  navigate: (screen: ScreenName, params?: NavigationParams) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined
);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("Login");
  const [navigationParams, setNavigationParams] = useState<NavigationParams>({});

  const navigate = (screen: ScreenName, params?: NavigationParams) => {
    setCurrentScreen(screen);
    setNavigationParams(params || {});
  };

  return (
    <NavigationContext.Provider value={{ currentScreen, navigationParams, navigate }}>
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
