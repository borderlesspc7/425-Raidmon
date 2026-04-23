import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import {
  getReceiveCheckoutPreview,
  respondReceiveCheckout,
} from "../../services/receiveCheckoutFunctions";

function money(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function ReceiveCheckout() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const receiveId = navigationParams.receiveCheckout?.receiveId;
  const token = navigationParams.receiveCheckout?.token;

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof getReceiveCheckoutPreview>
  > | null>(null);

  const load = useCallback(async () => {
    if (!receiveId || !token) {
      setError(t("receiveCheckout.missingParams"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getReceiveCheckoutPreview(receiveId, token);
      setPreview(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || t("receiveCheckout.loadError"));
    } finally {
      setLoading(false);
    }
  }, [receiveId, token, t]);

  useEffect(() => {
    if (!user || user.userType !== "workshop") {
      setLoading(false);
      return;
    }
    void load();
  }, [user, load]);

  const onApprove = async () => {
    if (!receiveId || !token) return;
    setActing(true);
    try {
      await respondReceiveCheckout(receiveId, token, "approve");
      Alert.alert(t("common.success"), t("receiveCheckout.approved"));
      navigate(paths.generalHistory);
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!receiveId || !token) return;
    setActing(true);
    try {
      await respondReceiveCheckout(receiveId, token, "reject");
      Alert.alert(t("common.success"), t("receiveCheckout.rejected"));
      navigate(paths.generalHistory);
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setActing(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Layout>
    );
  }

  if (user.userType !== "workshop") {
    return (
      <Layout>
        <View style={styles.center}>
          <MaterialIcons name="block" size={48} color="#EF4444" />
          <Text style={styles.err}>{t("receiveCheckout.workshopOnly")}</Text>
          <TouchableOpacity style={styles.link} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.linkText}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Layout>
    );
  }

  if (error || !preview) {
    return (
      <Layout>
        <View style={styles.centerPadded}>
          <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          <Text style={styles.err}>{error || "—"}</Text>
          <TouchableOpacity style={styles.link} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.linkText}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  const done = preview.workshopApprovalStatus === "approved" || preview.workshopApprovalStatus === "rejected";

  return (
    <Layout>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("receiveCheckout.title")}</Text>
        <Text style={styles.muted}>{t("receiveCheckout.subtitle")}</Text>

        <View style={styles.card}>
          <Row label={t("receiveCheckout.batch")} value={preview.batchName} />
          <Row
            label={t("receiveCheckout.pieces")}
            value={String(preview.piecesReceived)}
          />
          <Row
            label={t("receiveCheckout.defects")}
            value={String(preview.defectivePieces)}
          />
          <Row
            label={t("receiveCheckout.toPay")}
            value={money(preview.amountDue)}
            emphasize
          />
          {preview.pricePerPiece != null ? (
            <Row
              label={t("batchOffer.pricePerPiece")}
              value={money(preview.pricePerPiece)}
            />
          ) : null}
        </View>

        {preview.observations ? (
          <View style={styles.obs}>
            <Text style={styles.obsLabel}>{t("batches.observations")}</Text>
            <Text style={styles.obsText}>{preview.observations}</Text>
          </View>
        ) : null}

        {done ? (
          <Text style={styles.done}>
            {preview.workshopApprovalStatus === "approved"
              ? t("receiveCheckout.alreadyApproved")
              : t("receiveCheckout.alreadyRejected")}
          </Text>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primary, acting && styles.dis]}
              onPress={onApprove}
              disabled={acting}
            >
              {acting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryText}>{t("receiveCheckout.approve")}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outline, acting && styles.dis]}
              onPress={onReject}
              disabled={acting}
            >
              <Text style={styles.outlineText}>{t("receiveCheckout.reject")}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </Layout>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={rstyles.row}>
      <Text style={rstyles.l}>{label}</Text>
      <Text style={[rstyles.v, emphasize && rstyles.vem]}>{value}</Text>
    </View>
  );
}

const rstyles = StyleSheet.create({
  row: { gap: 4 },
  l: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  v: { fontSize: 16, color: "#111827" },
  vem: { fontWeight: "800", color: "#6366F1", fontSize: 18 },
});

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerPadded: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  muted: { fontSize: 14, color: "#6B7280" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  err: { color: "#991B1B", textAlign: "center", marginTop: 8 },
  link: { marginTop: 12 },
  linkText: { color: "#6366F1", fontWeight: "600" },
  obs: { backgroundColor: "#F9FAFB", padding: 12, borderRadius: 10 },
  obsLabel: { fontSize: 12, color: "#6B7280" },
  obsText: { fontSize: 14, color: "#374151", marginTop: 4 },
  primary: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  outline: {
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  outlineText: { color: "#DC2626", fontWeight: "700" },
  dis: { opacity: 0.6 },
  done: { textAlign: "center", color: "#6B7280", fontSize: 15 },
});
