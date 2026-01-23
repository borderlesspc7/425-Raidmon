import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationProvider } from "./src/routes/NavigationContext";
import { AuthProvider } from "./src/contexts/AuthContext";
import { AppRoutes } from "./src/routes/AppRoutes";

function App() {
  return (
    <SafeAreaProvider>
          <AuthProvider>
            <NavigationProvider>
              <AppRoutes />
            </NavigationProvider>
          </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;