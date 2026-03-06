import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";

type PlanType = "basic" | "premium" | "enterprise";

interface Plan {
  id: PlanType;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  bgColor: string;
}

export default function Plans() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(false);

  const plans: Plan[] = [
    {
      id: "basic",
      name: t("plans.basic.name"),
      price: 29.90,
      period: t("plans.monthly"),
      features: [
        t("plans.basic.feature1"),
        t("plans.basic.feature2"),
        t("plans.basic.feature3"),
        t("plans.basic.feature4"),
        t("plans.basic.feature5"),
      ],
      icon: "star",
      color: "#6366F1",
      bgColor: "#F0F4FF",
    },
    {
      id: "premium",
      name: t("plans.premium.name"),
      price: 79.90,
      period: t("plans.monthly"),
      features: [
        t("plans.premium.feature1"),
        t("plans.premium.feature2"),
        t("plans.premium.feature3"),
        t("plans.premium.feature4"),
        t("plans.premium.feature5"),
        t("plans.premium.feature6"),
      ],
      popular: true,
      icon: "workspace-premium",
      color: "#10B981",
      bgColor: "#D1FAE5",
    },
    {
      id: "enterprise",
      name: t("plans.enterprise.name"),
      price: 199.90,
      period: t("plans.monthly"),
      features: [
        t("plans.enterprise.feature1"),
        t("plans.enterprise.feature2"),
        t("plans.enterprise.feature3"),
        t("plans.enterprise.feature4"),
        t("plans.enterprise.feature5"),
        t("plans.enterprise.feature6"),
        t("plans.enterprise.feature7"),
      ],
      icon: "business",
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
    },
  ];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleSelectPlan = async (planId: PlanType) => {
    setSelectedPlan(planId);
    setLoading(true);

    // Simular processamento de assinatura
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        t("plans.success"),
        t("plans.successMessage").replace("{plan}", plans.find((p) => p.id === planId)?.name || ""),
        [
          {
            text: "OK",
            onPress: () => setSelectedPlan(null),
          },
        ]
      );
    }, 1500);
  };

  return (
    <Layout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("plans.title")}</Text>
            <Text style={styles.subtitle}>{t("plans.subtitle")}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="card-membership" size={28} color="#6366F1" />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Plan Info */}
          {user && (
            <View style={styles.currentPlanCard}>
              <View style={styles.currentPlanHeader}>
                <MaterialIcons name="info" size={20} color="#6366F1" />
                <Text style={styles.currentPlanTitle}>
                  {t("plans.currentPlan")}
                </Text>
              </View>
              <Text style={styles.currentPlanText}>
                {t("plans.currentPlanDescription")}
              </Text>
            </View>
          )}

          {/* Plans Grid */}
          <View style={styles.plansContainer}>
            {plans.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  plan.popular && styles.planCardPopular,
                ]}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                    <Text style={styles.popularBadgeText}>
                      {t("plans.popular")}
                    </Text>
                  </View>
                )}

                {/* Plan Header */}
                <View style={[styles.planHeader, { backgroundColor: plan.bgColor }]}>
                  <View style={[styles.planIconContainer, { backgroundColor: plan.color }]}>
                    <MaterialIcons name={plan.icon} size={32} color="#FFFFFF" />
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                </View>

                {/* Price */}
                <View style={styles.priceContainer}>
                  <Text style={styles.priceValue}>
                    {formatCurrency(plan.price)}
                  </Text>
                  <Text style={styles.pricePeriod}>/{plan.period}</Text>
                </View>

                {/* Features */}
                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <MaterialIcons
                        name="check-circle"
                        size={18}
                        color={plan.color}
                      />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: plan.color,
                      opacity: loading && selectedPlan === plan.id ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => handleSelectPlan(plan.id)}
                  disabled={loading}
                >
                  {loading && selectedPlan === plan.id ? (
                    <Text style={styles.selectButtonText}>
                      {t("plans.processing")}...
                    </Text>
                  ) : (
                    <Text style={styles.selectButtonText}>
                      {plan.popular
                        ? t("plans.selectPopular")
                        : t("plans.select")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Additional Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <MaterialIcons name="help-outline" size={20} color="#6366F1" />
              <Text style={styles.infoTitle}>{t("plans.faq.title")}</Text>
            </View>
            <View style={styles.faqContainer}>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>
                  {t("plans.faq.question1")}
                </Text>
                <Text style={styles.faqAnswer}>
                  {t("plans.faq.answer1")}
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>
                  {t("plans.faq.question2")}
                </Text>
                <Text style={styles.faqAnswer}>
                  {t("plans.faq.answer2")}
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={styles.faqQuestion}>
                  {t("plans.faq.question3")}
                </Text>
                <Text style={styles.faqAnswer}>
                  {t("plans.faq.answer3")}
                </Text>
              </View>
            </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  currentPlanCard: {
    backgroundColor: "#F0F4FF",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  currentPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  currentPlanTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  currentPlanText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  plansContainer: {
    gap: 20,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  planCardPopular: {
    borderColor: "#10B981",
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  planHeader: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  planIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  planName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  priceValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#1F2937",
  },
  pricePeriod: {
    fontSize: 16,
    color: "#6B7280",
    marginLeft: 4,
  },
  featuresContainer: {
    padding: 20,
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  selectButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  faqContainer: {
    gap: 16,
  },
  faqItem: {
    gap: 6,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  faqAnswer: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
