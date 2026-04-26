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
  getBatchInvitePreview,
  respondBatchInvite,
  type BatchInvitePreview,
} from "../../services/batchInviteFunctions";

export default function BatchOffer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();

  const batchId = navigationParams.batchOffer?.batchId;
  const token = navigationParams.batchOffer?.token;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BatchInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const mapInviteErrorMessage = useCallback(
    (e: unknown, fallbackKey: "batchOffer.loadError" | "batchOffer.actionError") => {
      const errorObj = e as { code?: string; message?: string } | null;
      const rawCode = typeof errorObj?.code === "string" ? errorObj.code : "";
      const code = rawCode.replace(/^functions\//, "");
      const msg = typeof errorObj?.message === "string" ? errorObj.message : "";

      if (code === "unauthenticated") return t("batchOffer.loginRequired");
      if (code === "permission-denied") return t("batchOffer.invalidOrExpired");
      if (code === "failed-precondition") return msg || t("batchOffer.unavailableState");

      // Cenário esperado antes do deploy das Cloud Functions
      if (code === "unavailable" || code === "not-found" || code === "internal") {
        return t("batchOffer.functionsUnavailable");
      }

      return msg || t(fallbackKey);
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!batchId || !token) {
      setError(t("batchOffer.missingParams"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getBatchInvitePreview(batchId, token);
      setPreview(data);
    } catch (e: unknown) {
      setError(mapInviteErrorMessage(e, "batchOffer.loadError"));
    } finally {
      setLoading(false);
    }
  }, [batchId, token, mapInviteErrorMessage]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.userType !== "workshop") {
      setError(t("batchOffer.workshopOnly"));
      setLoading(false);
      return;
    }
    if (!batchId || !token) {
      setError(t("batchOffer.missingParams"));
      setLoading(false);
      return;
    }
    void load();
  }, [user, batchId, token, load, t]);

  const formatMoney = (n: number | null) => {
    if (n === null || Number.isNaN(n)) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(n);
  };

  const onAccept = async () => {
    if (!batchId || !token || !preview) return;
    const alreadyYours = !preview.canAccept && preview.reason === "already_yours";
    if (!preview.canAccept && !alreadyYours) return;

    if (alreadyYours) {
      Alert.alert(t("common.success"), t("batchOffer.alreadyAccepted"));
      navigate(paths.workshopProduction);
      return;
    }

    try {
      setActing(true);
      const res = await respondBatchInvite(batchId, token, "accept");
      if (res.alreadyAccepted) {
        Alert.alert(t("common.success"), t("batchOffer.alreadyAccepted"));
      } else {
        Alert.alert(t("common.success"), t("batchOffer.acceptSuccess"));
      }
      navigate(paths.workshopProduction);
    } catch (e: unknown) {
      Alert.alert(t("common.error"), mapInviteErrorMessage(e, "batchOffer.actionError"));
    } finally {
      setActing(false);
    }
  };

  const onRequestAdjust = () => {
    navigate(paths.dashboard);
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
          <Text style={styles.err}>{t("batchOffer.workshopOnly")}</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigate(paths.dashboard)}
          >
            <Text style={styles.secondaryBtnText}>{t("batchOffer.backHome")}</Text>
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

  if (error && !preview) {
    return (
      <Layout>
        <View style={styles.centerPadded}>
          <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          <Text style={styles.err}>{error}</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigate(paths.dashboard)}
          >
            <Text style={styles.secondaryBtnText}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  if (!preview) return null;

  const blocked = !preview.canAccept && preview.reason === "other_workshop";
  const alreadyYours = !preview.canAccept && preview.reason === "already_yours";
  const canStartProduction = preview.canAccept || alreadyYours;

  return (
    <Layout>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.welcome}>
          {t("batchOffer.welcome").replace("{name}", user.name || "…")}
        </Text>
        <Text style={styles.context}>{t("batchOffer.context")}</Text>

        <View style={styles.card}>
          <Row label={t("batchOffer.ownerLabel")} value={preview.ownerName || "—"} />
          <Row
            label={t("batchOffer.batchIdLabel")}
            value={
              preview.cutListNumber != null
                ? `#${preview.cutListNumber}`
                : preview.batchId
            }
          />
          <Row label={t("batchOffer.pieceName")} value={preview.name} />
          <Row
            label={t("batchOffer.quantity")}
            value={`${preview.totalPieces}`}
          />
          <Row
            label={t("batchOffer.pricePerPiece")}
            value={formatMoney(preview.pricePerPiece)}
          />
          <Row
            label={t("batchOffer.guaranteedTotal")}
            value={formatMoney(preview.guaranteedTotal)}
            emphasize
          />
        </View>

        {blocked ? (
          <Text style={styles.warn}>{t("batchOffer.takenByOther")}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (!canStartProduction || acting) && styles.btnDisabled,
          ]}
          onPress={onAccept}
          disabled={!canStartProduction || acting}
        >
          {acting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("batchOffer.acceptAndStart")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineBtn}
          onPress={onRequestAdjust}
        >
          <Text style={styles.outlineBtnText}>
            {t("batchOffer.requestAdjust")}
          </Text>
        </TouchableOpacity>
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
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.rowValueEm]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerPadded: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  welcome: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  context: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  row: { gap: 4 },
  rowLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  rowValue: { fontSize: 16, color: "#111827" },
  rowValueEm: { fontWeight: "800", color: "#6366F1", fontSize: 18 },
  muted: { fontSize: 15, color: "#6B7280", textAlign: "center" },
  err: {
    marginTop: 12,
    fontSize: 15,
    color: "#991B1B",
    textAlign: "center",
  },
  warn: {
    fontSize: 14,
    color: "#B45309",
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  outlineBtnText: { color: "#6366F1", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: { color: "#6366F1", fontWeight: "600" },
});
