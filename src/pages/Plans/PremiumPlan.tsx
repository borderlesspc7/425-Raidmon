import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";

export default function PremiumPlan() {
  const { t } = useLanguage();
  const { navigate } = useNavigation();

  const handleBack = () => {
    navigate("Plans");
  };

  const handleSubscribe = () => {
    // Lógica real de assinatura pode ser adicionada depois
  };

  return (
    <Layout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color="#4B5563" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>{t("plans.premium.name")}</Text>
            <Text style={styles.subtitle}>{t("plans.premium.subtitle")}</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: "#DCFCE7" }]}>
            <MaterialIcons name="workspace-premium" size={26} color="#10B981" />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Overview */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("plans.overview")}</Text>
            <Text style={styles.sectionText}>{t("plans.premium.description")}</Text>
          </View>

          {/* For who */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="insights" size={20} color="#0EA5E9" />
              <Text style={styles.sectionTitle}>{t("plans.premium.forWhoTitle")}</Text>
            </View>
            <Text style={styles.sectionText}>{t("plans.premium.forWho")}</Text>
          </View>

          {/* Features */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="bolt" size={20} color="#F97316" />
              <Text style={styles.sectionTitle}>{t("plans.features")}</Text>
            </View>

            {[
              t("plans.premium.feature1"),
              t("plans.premium.feature2"),
              t("plans.premium.feature3"),
              t("plans.premium.feature4"),
              t("plans.premium.feature5"),
              t("plans.premium.feature6"),
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <MaterialIcons name="check" size={18} color="#10B981" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSubscribe}>
              <Text style={styles.primaryButtonText}>{t("plans.premium.cta")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  sectionText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  footer: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});

