import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import { getBatchById } from "../../services/batchService";
import type { Batch } from "../../types/batch";
import {
  computeGuaranteedEarningsProgress,
  computeWorkshopHubPieceColumns,
} from "../../utils/workshopBatchHubMetrics";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const GOLD = {
  top: "#E8D5A3",
  bottom: "#B8952E",
  shadow: "rgba(139, 105, 20, 0.35)",
};

function MetricRing({
  label,
  valueText,
  sublabel,
  accent,
}: {
  label: string;
  valueText: string;
  sublabel: string;
  accent: string;
}) {
  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.ring, { borderColor: accent + "99" }]}>
        <Text style={ringStyles.value}>{valueText}</Text>
        <Text style={ringStyles.sublabel} numberOfLines={2}>
          {sublabel}
        </Text>
      </View>
      <Text style={[ringStyles.label, { color: accent }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 108, alignItems: "center" },
  ring: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    backgroundColor: "#FDF8EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
  },
  sublabel: {
    fontSize: 9,
    color: "#57534E",
    textAlign: "center",
    marginTop: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
    letterSpacing: 0.3,
  },
});

function Gold3DButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={btnStyles.wrap}
      activeOpacity={0.88}
    >
      <View style={btnStyles.shade} />
      <View style={btnStyles.face}>
        <MaterialIcons name="menu" size={20} color="#5C4A1A" style={{ marginRight: 10 }} />
        <Text style={btnStyles.text}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  shade: {
    position: "absolute",
    left: 4,
    right: 4,
    top: 6,
    bottom: -2,
    backgroundColor: "#6B5A2C",
    borderRadius: 14,
    opacity: 0.35,
  },
  face: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GOLD.top,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: GOLD.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#3D2E0A",
  },
});

export default function WorkshopBatchHub() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const batchId = navigationParams.workshopBatchHub?.batchId;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!batchId) {
      setErr("missing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const b = await getBatchById(batchId);
      if (!b) {
        setErr("404");
        setBatch(null);
        return;
      }
      if (
        user?.id &&
        b.linkedWorkshopUserId != null &&
        b.linkedWorkshopUserId !== user.id
      ) {
        setErr("forbidden");
        setBatch(null);
        return;
      }
      setBatch(b);
    } catch (e: unknown) {
      setErr(String((e as Error)?.message));
    } finally {
      setLoading(false);
    }
  }, [batchId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBack = () => {
    navigate(paths.workshopProduction, {});
  };

  const onConfirmArrival = () => {
    Alert.alert(
      t("workshopBatchHub.confirmTitle"),
      t("workshopBatchHub.confirmBody"),
    );
  };

  const onFinishCut = () => {
    if (!batch) return;
    navigate(paths.workshopProduction, { workshopFocusBatchId: batch.id });
  };

  const onReport = () => {
    if (!batch) return;
    navigate(paths.workshopProduction, { workshopFocusBatchId: batch.id });
  };

  if (!user || user.userType !== "workshop") {
    return (
      <Layout>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("workshopProduction.workshopOnly")}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.outlineText}>{t("workshopBatchHub.back")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GOLD.bottom} />
        </View>
      </Layout>
    );
  }

  if (err || !batch) {
    return (
      <Layout>
        <View style={styles.center}>
          <Text style={styles.muted}>
            {err === "missing" || err === "404"
              ? t("workshopBatchHub.notFound")
              : err === "forbidden"
                ? t("workshopBatchHub.forbidden")
                : err || t("workshopBatchHub.loadError")}
          </Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={onBack}>
            <Text style={styles.outlineText}>{t("workshopBatchHub.back")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  const cols = computeWorkshopHubPieceColumns(batch);
  const { current, goal, ratio } = computeGuaranteedEarningsProgress(batch);
  const first = user.name?.split(" ")[0] || user.name;
  const tagline = user.about?.trim() || user.companyName?.trim() || "—";

  return (
    <Layout>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={onBack} style={styles.topBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#5C4A1A" />
          <Text style={styles.topBackText}>{t("workshopBatchHub.back")}</Text>
        </TouchableOpacity>

        <View style={styles.brandRow}>
          <View style={styles.brandC}>
            <Text style={styles.brandCtext}>C</Text>
            <View style={styles.brandCsecond}>
              <Text style={styles.brandCtextSm}>C</Text>
            </View>
          </View>
          <Text style={styles.brandName}>{t("workshopBatchHub.brandName")}</Text>
        </View>

        <View style={styles.profileBlock}>
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <MaterialIcons name="person" size={36} color="#A8A29E" />
            </View>
          )}
          <View style={styles.greetCol}>
            <Text style={styles.hello}>
              {t("workshopBatchHub.hello")}{" "}
              <Text style={styles.helloName}>{first}</Text>
            </Text>
            <Text style={styles.tagline} numberOfLines={2}>
              “{tagline}”
            </Text>
            <Text style={styles.batchName} numberOfLines={1}>
              {batch.name}
            </Text>
          </View>
        </View>

        <View style={styles.ringsRow}>
          <MetricRing
            label={t("workshopBatchHub.toReceive")}
            valueText={`${cols.toReceiveCuts} ${t("workshopBatchHub.cut")}`}
            sublabel={t("workshopBatchHub.toReceiveSub")}
            accent="#3B82F6"
          />
          <MetricRing
            label={t("workshopBatchHub.onTable")}
            valueText={
              cols.onTablePieces > 0
                ? `${cols.onTablePieces} ${t("workshopBatchHub.pieces")}`
                : "0"
            }
            sublabel={t("workshopBatchHub.onTableSub")}
            accent="#F97316"
          />
          <MetricRing
            label={t("workshopBatchHub.ready")}
            valueText={
              cols.readyPieces > 0
                ? `${cols.readyPieces} ${t("workshopBatchHub.pieces")}`
                : "0"
            }
            sublabel={t("workshopBatchHub.readySub")}
            accent="#22C55E"
          />
        </View>

        <View style={styles.barCard}>
          <Text style={styles.barTitle}>{t("workshopBatchHub.guaranteedGain")}</Text>
          <View style={styles.barRow}>
            <Text style={styles.barCurrent}>
              {goal > 0 ? formatBRL(current) : "—"}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
            </View>
          </View>
          <View style={styles.barMetaRow}>
            <View />
            <Text style={styles.barGoal}>
              {t("workshopBatchHub.goalMeta").replace(
                "{v}",
                goal > 0 ? formatBRL(goal) : "—",
              )}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Gold3DButton
            title={t("workshopBatchHub.btnConfirmArrival")}
            onPress={onConfirmArrival}
          />
          <Gold3DButton
            title={t("workshopBatchHub.btnFinishCut")}
            onPress={onFinishCut}
          />
          <Gold3DButton
            title={t("workshopBatchHub.btnReportOwner")}
            onPress={onReport}
          />
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { color: "#78716C", textAlign: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, backgroundColor: "#F2EBE0" },
  topBack: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  topBackText: { fontSize: 15, fontWeight: "700", color: "#5C4A1A" },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8 },
  brandC: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#C9A54D",
    alignItems: "center",
    justifyContent: "center",
  },
  brandCtext: { fontSize: 22, fontWeight: "900", color: "#FFF", fontStyle: "italic" },
  brandCsecond: { position: "absolute", right: 2, bottom: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#8B7329", alignItems: "center", justifyContent: "center" },
  brandCtextSm: { fontSize: 9, fontWeight: "800", color: "#FFF" },
  brandName: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: "#57534E" },
  profileBlock: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E7E5E4" },
  avatarPh: { alignItems: "center", justifyContent: "center" },
  greetCol: { flex: 1, minWidth: 0 },
  hello: { fontSize: 20, color: "#44403C" },
  helloName: { fontWeight: "800", color: "#B8952E" },
  tagline: { fontSize: 12, color: "#78716C", marginTop: 4, fontStyle: "italic" },
  batchName: { fontSize: 15, fontWeight: "800", color: "#292524", marginTop: 6 },
  ringsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    paddingHorizontal: 2,
  },
  barCard: {
    backgroundColor: "#FDF8EE",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(201, 165, 77, 0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  barTitle: { fontSize: 14, fontWeight: "800", color: "#44403C", marginBottom: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  barCurrent: { fontSize: 16, fontWeight: "800", color: "#166534" },
  barTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#E7E5E4",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: "#22C55E",
  },
  barMetaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  barGoal: { fontSize: 12, color: "#78716C", fontWeight: "600" },
  actions: { marginTop: 4 },
  outlineBtn: { marginTop: 12, padding: 12 },
  outlineText: { color: "#8B5A2B", fontWeight: "700" },
});
