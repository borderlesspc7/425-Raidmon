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
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import {
  canSubscribeTo,
  formatNextDueDate,
  getSubscriptionState,
  isUserOnPlan,
} from "../../utils/subscriptionStatus";
import { cancelAsaasSubscription } from "../../services/asaasPayments";

export default function PremiumPlan() {
  const { t } = useLanguage();
  const { navigate } = useNavigation();
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();

  const isCurrent = isUserOnPlan(user, "premium");
  const canSubscribe = canSubscribeTo(user, "premium");
  const subscriptionState = getSubscriptionState(user);
  const nextDueFormatted = formatNextDueDate(user?.subscriptionNextDueDate);
  const [cancelling, setCancelling] = useState(false);

  const handleBack = () => {
    navigate("Plans");
  };

  const handleSubscribeAction = () => {
    navigate(paths.planCheckout, { planId: "premium" });
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      t("plans.cancelConfirmTitle"),
      t("plans.cancelConfirmBody").replace("{plan}", t("plans.premium.name")),
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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t("plans.premium.name")}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t("plans.premium.subtitle")}</Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: theme.colors.iconSoft }]}>
            <MaterialIcons name="workspace-premium" size={26} color="#10B981" />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Overview */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("plans.overview")}</Text>
            <Text style={[styles.sectionText, { color: theme.colors.textMuted }]}>{t("plans.premium.description")}</Text>
          </View>

          {/* For who */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="insights" size={20} color="#0EA5E9" />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("plans.premium.forWhoTitle")}</Text>
            </View>
            <Text style={[styles.sectionText, { color: theme.colors.textMuted }]}>{t("plans.premium.forWho")}</Text>
          </View>

          {/* Features */}
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="bolt" size={20} color="#F97316" />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("plans.features")}</Text>
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
                <Text style={[styles.featureText, { color: theme.colors.text }]}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <View style={styles.footer}>
            {isCurrent ? (
              <>
                <View style={[styles.currentBadge, { borderColor: "#10B981" }]}>
                  <MaterialIcons name="check-circle" size={18} color="#10B981" />
                  <Text style={[styles.currentBadgeText, { color: "#10B981" }]}>
                    {t("plans.currentPlanBadge")}
                  </Text>
                </View>
                {nextDueFormatted ? (
                  <Text style={[styles.currentMeta, { color: theme.colors.textMuted }]}>
                    {t("plans.currentPlanNextDue").replace("{date}", nextDueFormatted)} ·{" "}
                    {t("plans.renewSoon")}
                  </Text>
                ) : null}
                {subscriptionState === "overdue" ? (
                  <Text style={[styles.currentMeta, { color: theme.colors.danger }]}>
                    {t("plans.currentPlanOverdueNote")}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: theme.colors.danger }]}
                  onPress={handleCancelSubscription}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <ActivityIndicator size="small" color={theme.colors.danger} />
                  ) : (
                    <>
                      <MaterialIcons name="cancel" size={18} color={theme.colors.danger} />
                      <Text style={[styles.cancelButtonText, { color: theme.colors.danger }]}>
                        {t("plans.cancelSubscription")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, !canSubscribe && { opacity: 0.6 }]}
                onPress={handleSubscribeAction}
                disabled={!canSubscribe}
              >
                <Text style={styles.primaryButtonText}>{t("plans.premium.cta")}</Text>
              </TouchableOpacity>
            )}
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
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 14,
  },
  currentBadgeText: {
    fontSize: 15,
    fontWeight: "700",
  },
  currentMeta: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

