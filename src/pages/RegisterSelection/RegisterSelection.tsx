import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RegisterSelection() {
  const { navigate } = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(20, insets.bottom + 12),
        },
      ]}
    >
      <TouchableOpacity onPress={() => navigate(paths.login)} style={styles.backButton}>
        <MaterialIcons name="arrow-back-ios" size={18} color="#6366F1" />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../../assets/logo1.jpeg")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Costura Conectada</Text>
        <Text style={styles.title}>Escolha o tipo de cadastro</Text>

        <TouchableOpacity style={styles.optionBox} onPress={() => navigate(paths.registerWorkshop)}>
          <Text style={styles.optionText}>oficina de confeccao</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionBox} onPress={() => navigate(paths.register)}>
          <Text style={styles.optionText}>dono de confeção</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  backButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 2,
    justifyContent: "flex-start",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  backText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 12,
  },
  optionBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
});
