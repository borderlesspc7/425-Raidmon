import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { useAuth } from "../../hooks/useAuth";
import { paths } from "../../routes/paths";
import {
  PLAN_PRICES_BRL,
  type SubscriptionPlanId,
  isSubscriptionPlanId,
} from "../../constants/planPricing";
import { createPayment } from "../../services/paymentService";
import { createAsaasChargeForPayment } from "../../services/asaasPayments";
import type { Payment } from "../../types/payment";

function planScreenName(planId: SubscriptionPlanId): (typeof paths)[keyof typeof paths] {
  switch (planId) {
    case "basic":
      return paths.basicPlan;
    case "premium":
      return paths.premiumPlan;
    case "enterprise":
      return paths.enterprisePlan;
    default:
      return paths.plans;
  }
}

export default function PlanCheckout() {
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const { user, updateProfile } = useAuth();

  const planId = navigationParams.planId;
  const [loading, setLoading] = useState(false);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixView, setPixView] = useState<{
    description: string;
    pixCopyPaste: string | null;
    pixEncodedImage: string | null;
    invoiceUrl: string | null;
    platformFeeAmount?: number;
  } | null>(null);

  useEffect(() => {
    if (!planId || !isSubscriptionPlanId(planId)) {
      navigate(paths.plans);
    }
  }, [planId]);

  const validPlan = planId && isSubscriptionPlanId(planId) ? planId : null;

  const price = validPlan ? PLAN_PRICES_BRL[validPlan] : 0;

  const planName = useMemo(() => {
    if (!validPlan) return "";
    if (validPlan === "basic") return t("plans.basic.name");
    if (validPlan === "premium") return t("plans.premium.name");
    return t("plans.enterprise.name");
  }, [validPlan, t]);

  const handleBack = () => {
    if (validPlan) navigate(planScreenName(validPlan));
    else navigate(paths.plans);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const copyPixCode = async (payload: string) => {
    await Clipboard.setStringAsync(payload);
    Alert.alert(t("common.success"), t("payments.pixCopied"));
  };

  const handleActivateFree = async () => {
    if (!user?.id) {
      Alert.alert(t("common.error"), t("plans.checkout.notAuthenticated"));
      return;
    }
    try {
      setLoading(true);
      await updateProfile({ plan: "basic" });
      Alert.alert(
        t("plans.success"),
        t("plans.successMessage").replace("{plan}", planName),
        [{ text: "OK", onPress: () => navigate(paths.plans) }]
      );
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePix = async () => {
    if (!validPlan || !user?.id) {
      Alert.alert(t("common.error"), t("plans.checkout.notAuthenticated"));
      return;
    }
    if (price <= 0) return;

    try {
      setLoading(true);
      const due = new Date();
      due.setDate(due.getDate() + 3);
      const description = t("plans.checkout.paymentDescription").replace(
        "{plan}",
        planName
      );
      const payment: Payment = await createPayment(user.id, {
        amount: price,
        dueDate: due,
        description,
        status: "pending",
        subscriptionPlan: validPlan,
      });
      const data = await createAsaasChargeForPayment(payment.id);
      setPixView({
        description,
        pixCopyPaste: data.pixCopyPaste,
        pixEncodedImage: data.pixEncodedImage,
        invoiceUrl: data.invoiceUrl,
        platformFeeAmount: data.platformFeeAmount,
      });
      setPixModalVisible(true);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.details ||
        (typeof error?.code === "string" ? error.code : "") ||
        t("payments.asaasError");
      Alert.alert(t("common.error"), String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!validPlan) {
    return (
      <Layout>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color="#4B5563" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>{t("plans.checkout.title")}</Text>
            <Text style={styles.subtitle}>{planName}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="payment" size={24} color="#6366F1" />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionCard}>
            <Text style={styles.amountLabel}>{t("plans.checkout.amountLabel")}</Text>
            <Text style={styles.amountValue}>{formatCurrency(price)}</Text>
            <Text style={styles.periodHint}>
              / {t("plans.monthly")}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.note}>
              {price <= 0 ? t("plans.checkout.freeNote") : t("plans.checkout.pixNote")}
            </Text>
          </View>

          <View style={styles.footer}>
            {price <= 0 ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleActivateFree}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {t("plans.checkout.activateFree")}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGeneratePix}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {t("plans.checkout.payWithPix")}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={pixModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setPixModalVisible(false);
            setPixView(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.pixModalBox]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("payments.pixModalTitle")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPixModalVisible(false);
                    setPixView(null);
                  }}
                >
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {pixView ? (
                  <>
                    <Text style={styles.pixDesc}>{pixView.description}</Text>
                    {pixView.platformFeeAmount != null && pixView.platformFeeAmount > 0 ? (
                      <Text style={styles.pixFee}>
                        {t("payments.platformFeeLabel")}:{" "}
                        {formatCurrency(pixView.platformFeeAmount)}
                      </Text>
                    ) : null}
                    {pixView.pixEncodedImage ? (
                      <Image
                        source={{
                          uri: `data:image/png;base64,${pixView.pixEncodedImage}`,
                        }}
                        style={styles.pixQr}
                        resizeMode="contain"
                      />
                    ) : null}
                    {pixView.invoiceUrl ? (
                      <TouchableOpacity
                        style={styles.pixLinkBtn}
                        onPress={() => Linking.openURL(pixView.invoiceUrl!)}
                      >
                        <MaterialIcons name="open-in-new" size={18} color="#6366F1" />
                        <Text style={styles.pixLinkText}>{t("payments.pixOpenInvoice")}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {pixView.pixCopyPaste ? (
                      <TouchableOpacity
                        style={styles.pixCopyBtn}
                        onPress={() => copyPixCode(pixView.pixCopyPaste!)}
                      >
                        <MaterialIcons name="content-copy" size={18} color="#FFFFFF" />
                        <Text style={styles.pixCopyBtnText}>{t("payments.pixCopy")}</Text>
                      </TouchableOpacity>
                    ) : pixView.invoiceUrl ? (
                      <Text style={styles.pixHint}>{t("payments.pixUseInvoiceLink")}</Text>
                    ) : null}
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  amountLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  periodHint: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
  },
  note: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  footer: {
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: "#6366F1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
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
  pixModalBox: {
    maxHeight: "88%",
    width: "92%",
    maxWidth: 420,
  },
  pixDesc: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  pixFee: {
    fontSize: 13,
    color: "#4F46E5",
    marginBottom: 12,
  },
  pixQr: {
    width: 220,
    height: 220,
    alignSelf: "center",
    marginVertical: 12,
  },
  pixLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  pixLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  pixCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  pixCopyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pixHint: {
    fontSize: 13,
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  modalScroll: {
    maxHeight: 480,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
