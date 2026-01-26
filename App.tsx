import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationProvider } from "./src/routes/NavigationContext";
import { AuthProvider } from "./src/contexts/AuthContext";
import { LanguageProvider } from "./src/contexts/LanguageContext";
import { AppRoutes } from "./src/routes/AppRoutes";

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <NavigationProvider>
            <AppRoutes />
          </NavigationProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;