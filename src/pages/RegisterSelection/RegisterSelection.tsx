import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";

export default function RegisterSelection() {
  const { navigate } = useNavigation();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigate(paths.login)} style={styles.backButton}>
        <MaterialIcons name="arrow-back-ios" size={22} color="#6366F1" />
      </TouchableOpacity>

      <View style={styles.content}>
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
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
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
