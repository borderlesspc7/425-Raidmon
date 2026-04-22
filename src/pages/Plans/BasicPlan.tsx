import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";

export default function BasicPlan() {
  const { t } = useLanguage();
  const { navigate } = useNavigation();

  const handleBack = () => {
    navigate("Plans");
  };

  const handleSubscribeAction = () => {
    navigate(paths.planCheckout, { planId: "basic" });
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
            <Text style={styles.title}>{t("plans.basic.name")}</Text>
            <Text style={styles.subtitle}>{t("plans.basic.subtitle")}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="star" size={26} color="#6366F1" />
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
            <Text style={styles.sectionText}>{t("plans.basic.description")}</Text>
          </View>

          {/* For who */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="group" size={20} color="#2563EB" />
              <Text style={styles.sectionTitle}>{t("plans.basic.forWhoTitle")}</Text>
            </View>
            <Text style={styles.sectionText}>{t("plans.basic.forWho")}</Text>
          </View>

          {/* Features */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="check-circle" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>{t("plans.features")}</Text>
            </View>

            {[
              t("plans.basic.feature1"),
              t("plans.basic.feature2"),
              t("plans.basic.feature3"),
              t("plans.basic.feature4"),
              t("plans.basic.feature5"),
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <MaterialIcons name="check" size={18} color="#10B981" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSubscribeAction}
            >
              <Text style={styles.primaryButtonText}>{t("plans.basic.cta")}</Text>
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
    backgroundColor: "#EEF2FF",
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
    backgroundColor: "#6366F1",
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

