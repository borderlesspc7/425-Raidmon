import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Layout from "../../components/Layout/Layout";

export default function WorkshopHome() {
  return (
    <Layout>
      <View style={styles.container}>
        <Text style={styles.title}>Área da Oficina</Text>
        <Text style={styles.subtitle}>
          Placeholder do fluxo workshop.
        </Text>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
