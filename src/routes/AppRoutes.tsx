import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Dashboard from "../pages/Dashboard/Dashboard";
import { useNavigation } from "../routes/NavigationContext";
import { useAuth } from "../hooks/useAuth";

export const AppRoutes = () => {
  const { currentScreen, navigate } = useNavigation();
  const { user, loading } = useAuth();

  // Redirecionar para Dashboard se estiver autenticado e na tela de Login/Register
  useEffect(() => {
    if (!loading && user && (currentScreen === "Login" || currentScreen === "Register")) {
      navigate("Dashboard");
    }
  }, [user, loading, currentScreen, navigate]);

  // Redirecionar para Login se não estiver autenticado e tentar acessar Dashboard
  useEffect(() => {
    if (!loading && !user && currentScreen === "Dashboard") {
      navigate("Login");
    }
  }, [user, loading, currentScreen, navigate]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  // Renderizar tela baseada no currentScreen
  switch (currentScreen) {
    case "Login":
      return <Login />;
    case "Register":
      return <Register />;
    case "Dashboard":
      // Só mostrar Dashboard se estiver autenticado
      if (user) {
        return <Dashboard />;
      }
      return <Login />;
    default:
      return <Login />;
  }
};
