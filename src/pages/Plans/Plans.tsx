import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { useTheme } from "../../hooks/useTheme";
import { PLAN_PRICES_BRL } from "../../constants/planPricing";
import { cancelAsaasSubscription } from "../../services/asaasPayments";
import {
  canSubscribeTo,
  formatNextDueDate,
  getCurrentPlan,
  getSubscriptionState,
  isUserOnPlan,
} from "../../utils/subscriptionStatus";

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
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { navigate } = useNavigation();
  const { theme, isDark } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState(false);

  const currentPlanId = getCurrentPlan(user);
  const subscriptionState = getSubscriptionState(user);
  const nextDueFormatted = formatNextDueDate(user?.subscriptionNextDueDate);

  const planLabelById: Record<PlanType, string> = {
    basic: t("plans.basic.name"),
    premium: t("plans.premium.name"),
    enterprise: t("plans.enterprise.name"),
  };

  const statusLabel: Record<ReturnType<typeof getSubscriptionState>, string> = {
    active: t("plans.statusActive"),
    overdue: t("plans.statusOverdue"),
    cancelled: t("plans.statusCancelled"),
    inactive: t("plans.statusInactive"),
    expired: t("plans.statusExpired"),
  };

  const plans: Plan[] = [
    {
      id: "basic",
      name: t("plans.basic.name"),
      price: 0,
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
      price: PLAN_PRICES_BRL.premium,
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
      price: PLAN_PRICES_BRL.enterprise,
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

  const goToPlanDetails = (planId: PlanType) => {
    if (planId === "basic") {
      navigate("BasicPlan");
      return;
    }
    if (planId === "premium") {
      navigate("PremiumPlan");
      return;
    }
    if (planId === "enterprise") {
      navigate("EnterprisePlan");
      return;
    }
  };

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

  const handleCancelSubscription = () => {
    if (currentPlanId === "basic") return;
    Alert.alert(
      t("plans.cancelConfirmTitle"),
      t("plans.cancelConfirmBody").replace("{plan}", planLabelById[currentPlanId]),
      [
        { text: t("plans.cancelKeep"), style: "cancel" },
        {
          text: t("plans.cancelConfirmOk"),
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              await cancelAsaasSubscription({});
              await refreshUser();
              Alert.alert(t("common.success"), t("plans.cancelSuccess"));
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.message || String(e));
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Layout>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t("plans.title")}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("plans.subtitle")}</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.colors.iconSoft }]}>
            <MaterialIcons name="card-membership" size={28} color={theme.colors.primary} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Plan Info */}
          {user && (
            <View
              style={[
                styles.currentPlanCard,
                {
                  backgroundColor: theme.colors.iconSoft,
                  borderLeftColor:
                    subscriptionState === "overdue"
                      ? theme.colors.danger
                      : theme.colors.primary,
                },
              ]}
            >
              <View style={styles.currentPlanHeader}>
                <MaterialIcons
                  name={subscriptionState === "overdue" ? "warning" : "info"}
                  size={20}
                  color={
                    subscriptionState === "overdue"
                      ? theme.colors.danger
                      : theme.colors.primary
                  }
                />
                <Text style={[styles.currentPlanTitle, { color: theme.colors.text }]}>
                  {t("plans.currentPlan")}
                </Text>
                {currentPlanId !== "basic" ? (
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          subscriptionState === "overdue"
                            ? theme.colors.danger
                            : subscriptionState === "active"
                              ? "#10B981"
                              : theme.colors.textMuted,
                      },
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {statusLabel[subscriptionState]}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.currentPlanText, { color: theme.colors.textMuted }]}>
                {currentPlanId === "basic"
                  ? t("plans.currentPlanDescription")
                  : t("plans.currentPlanCardActive").replace(
                      "{plan}",
                      planLabelById[currentPlanId],
                    )}
              </Text>
              {currentPlanId !== "basic" && nextDueFormatted ? (
                <Text style={[styles.currentPlanMeta, { color: theme.colors.textMuted }]}>
                  <MaterialIcons name="event" size={13} color={theme.colors.textMuted} />{" "}
                  {t("plans.currentPlanNextDue").replace("{date}", nextDueFormatted)} ·{" "}
                  {t("plans.renewSoon")}
                </Text>
              ) : null}
              {subscriptionState === "overdue" ? (
                <Text style={[styles.currentPlanMeta, { color: theme.colors.danger }]}>
                  {t("plans.currentPlanOverdueNote")}
                </Text>
              ) : null}
              {currentPlanId !== "basic" &&
              (subscriptionState === "active" || subscriptionState === "overdue") ? (
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.colors.danger }]}
                  onPress={handleCancelSubscription}
                  disabled={cancelling}
                  activeOpacity={0.8}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color={theme.colors.danger} />
                  ) : (
                    <>
                      <MaterialIcons name="cancel" size={16} color={theme.colors.danger} />
                      <Text style={[styles.cancelButtonText, { color: theme.colors.danger }]}>
                        {t("plans.cancelSubscription")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Plans Grid */}
          <View style={styles.plansContainer}>
            {plans.map((plan) => {
              const isCurrent = isUserOnPlan(user, plan.id);
              const canSubscribe = canSubscribeTo(user, plan.id);
              return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  plan.popular && styles.planCardPopular,
                  isCurrent && {
                    borderColor: plan.color,
                    borderWidth: 2,
                  },
                  { backgroundColor: theme.colors.surface, borderColor: isCurrent ? plan.color : theme.colors.border },
                ]}
              >
                {/* Popular / Current Badge */}
                {isCurrent ? (
                  <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                    <Text style={styles.popularBadgeText}>
                      {t("plans.currentPlanBadge")}
                    </Text>
                  </View>
                ) : plan.popular ? (
                  <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                    <Text style={styles.popularBadgeText}>
                      {t("plans.popular")}
                    </Text>
                  </View>
                ) : null}

                {/* Plan Header */}
                <View
                  style={[
                    styles.planHeader,
                    {
                      backgroundColor: isDark
                        ? theme.colors.surfaceSoft
                        : plan.bgColor,
                    },
                  ]}
                >
                  <View style={[styles.planIconContainer, { backgroundColor: plan.color }]}>
                    <MaterialIcons name={plan.icon} size={32} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.planName, { color: theme.colors.text }]}>{plan.name}</Text>
                </View>

                {/* Price */}
                <View style={[styles.priceContainer, { borderBottomColor: theme.colors.border }]}>
                  {plan.price === 0 ? (
                    <>
                      <Text style={[styles.priceValue, { color: theme.colors.text }]}>{t("plans.freePrice")}</Text>
                      <Text style={[styles.pricePeriod, { color: theme.colors.textMuted }]}>
                        {" · "}
                        {t("plans.freePriceHint")}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.priceValue, { color: theme.colors.text }]}>
                        {formatCurrency(plan.price)}
                      </Text>
                      <Text style={[styles.pricePeriod, { color: theme.colors.textMuted }]}>/{plan.period}</Text>
                    </>
                  )}
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
                      <Text style={[styles.featureText, { color: theme.colors.text }]}>{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA Button */}
                {isCurrent ? (
                  <View
                    style={[
                      styles.selectButton,
                      styles.currentBadgeButton,
                      { borderColor: plan.color },
                    ]}
                  >
                    <MaterialIcons name="check-circle" size={18} color={plan.color} />
                    <Text style={[styles.currentBadgeButtonText, { color: plan.color }]}>
                      {t("plans.currentPlanBadge")}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      {
                        backgroundColor: plan.color,
                        opacity:
                          (loading && selectedPlan === plan.id) || !canSubscribe ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => goToPlanDetails(plan.id)}
                    disabled={loading || !canSubscribe}
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
                )}
              </View>
              );
            })}
          </View>

          {/* Additional Info - FAQ accordion */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => setFaqExpanded((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: faqExpanded }}
            >
              <View style={styles.infoHeader}>
                <MaterialIcons name="help-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>{t("plans.faq.title")}</Text>
              </View>
              <MaterialIcons
                name={faqExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={26}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {faqExpanded ? (
              <View style={styles.faqContainer}>
                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
                    {t("plans.faq.question1")}
                  </Text>
                  <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>
                    {t("plans.faq.answer1")}
                  </Text>
                </View>
                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
                    {t("plans.faq.question2")}
                  </Text>
                  <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>
                    {t("plans.faq.answer2")}
                  </Text>
                </View>
                <View style={styles.faqItem}>
                  <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>
                    {t("plans.faq.question3")}
                  </Text>
                  <Text style={[styles.faqAnswer, { color: theme.colors.textMuted }]}>
                    {t("plans.faq.answer3")}
                  </Text>
                </View>
              </View>
            ) : null}
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
  currentPlanMeta: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: "auto",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  currentBadgeButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  currentBadgeButtonText: {
    fontSize: 15,
    fontWeight: "700",
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
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  faqContainer: {
    gap: 16,
    marginTop: 16,
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
