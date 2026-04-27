import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import {
  getBatchInvitePreview,
  respondBatchInvite,
  type BatchInvitePreview,
} from "../../services/batchInviteFunctions";

const BG = "#0F0820";
const BG_CARD = "#1a0f2e";
const BG_VALUE_RIGHT = "#2a2535";
const GOLD = "#E8C547";
const GOLD_MUTED = "rgba(232, 197, 71, 0.75)";
const TEXT_LIGHT = "rgba(255,255,255,0.88)";

function formatMoney(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateInput(text: string) {
  const numbers = text.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
}

function SectionLine({ title, gold }: { title: string; gold?: boolean }) {
  return (
    <View style={sectionStyles.headerRow}>
      <Text style={[sectionStyles.h2, gold && { color: GOLD }]}>{title}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  h2: { fontSize: 12, fontWeight: "900", color: TEXT_LIGHT, letterSpacing: 0.8 },
  line: { flex: 1, height: 1, backgroundColor: "rgba(232, 197, 71, 0.35)" },
});

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
  const [deliveryInput, setDeliveryInput] = useState("");

  const mapInviteErrorMessage = useCallback(
    (e: unknown, fallbackKey: "batchOffer.loadError" | "batchOffer.actionError") => {
      const errorObj = e as { code?: string; message?: string } | null;
      const rawCode = typeof errorObj?.code === "string" ? errorObj.code : "";
      const code = rawCode.replace(/^functions\//, "");
      const msg = typeof errorObj?.message === "string" ? errorObj.message : "";

      if (code === "unauthenticated") return t("batchOffer.loginRequired");
      if (code === "permission-denied") return t("batchOffer.invalidOrExpired");
      if (code === "failed-precondition") return msg || t("batchOffer.unavailableState");

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
      if (data.deliveryDateIso) {
        try {
          const d = new Date(data.deliveryDateIso);
          if (!Number.isNaN(d.getTime())) {
            setDeliveryInput(
              new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(d),
            );
          } else {
            setDeliveryInput("");
          }
        } catch {
          setDeliveryInput("");
        }
      } else {
        setDeliveryInput("");
      }
    } catch (e: unknown) {
      setError(mapInviteErrorMessage(e, "batchOffer.loadError"));
    } finally {
      setLoading(false);
    }
  }, [batchId, token, mapInviteErrorMessage, t]);

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

  const onAccept = async () => {
    if (!batchId || !token || !preview) return;
    const alreadyYours = !preview.canAccept && preview.reason === "already_yours";
    if (!preview.canAccept && !alreadyYours) return;

    if (alreadyYours) {
      Alert.alert(t("common.success"), t("batchOffer.alreadyAccepted"));
      navigate(paths.workshopProduction);
      return;
    }

    const parts = deliveryInput.split("/");
    if (parts.length !== 3) {
      Alert.alert(t("common.error"), t("batchOffer.deliveryInvalid"));
      return;
    }
    const [dd, mm, yy] = parts.map((x) => parseInt(x, 10));
    const deliveryD = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
    if (Number.isNaN(deliveryD.getTime())) {
      Alert.alert(t("common.error"), t("batchOffer.deliveryInvalid"));
      return;
    }
    const deliveryIso = deliveryD.toISOString();

    try {
      setActing(true);
      const res = await respondBatchInvite(batchId, token, "accept", deliveryIso);
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

  const onRequestAdjust = async () => {
    if (!batchId || !token) return;
    try {
      setActing(true);
      await respondBatchInvite(batchId, token, "request_adjust");
      Alert.alert(t("common.info"), t("batchOffer.adjustComingSoon"), [
        { text: t("common.close"), onPress: () => navigate(paths.dashboard) },
      ]);
    } catch (e: unknown) {
      Alert.alert(t("common.error"), mapInviteErrorMessage(e, "batchOffer.actionError"));
    } finally {
      setActing(false);
    }
  };

  const firstName = user?.name?.split(" ")?.[0] ?? user?.name ?? "…";
  const lotRef =
    preview && preview.cutListNumber != null
      ? `#${preview.cutListNumber}`
      : preview?.batchId?.slice(0, 8).toUpperCase() ?? "—";

  if (!user) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.centerFill}>
          <ActivityIndicator size="large" color={GOLD} />
        </SafeAreaView>
      </View>
    );
  }

  if (user.userType !== "workshop") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.centerFillPadded}>
          <MaterialIcons name="block" size={48} color="#F87171" />
          <Text style={styles.errLight}>{t("batchOffer.workshopOnly")}</Text>
          <TouchableOpacity style={styles.textLink} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.textLinkT}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.centerFill}>
          <ActivityIndicator size="large" color={GOLD} />
        </SafeAreaView>
      </View>
    );
  }

  if (error && !preview) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.centerFillPadded}>
          <MaterialIcons name="error-outline" size={48} color="#F87171" />
          <Text style={styles.errLight}>{error}</Text>
          <TouchableOpacity style={styles.textLink} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.textLinkT}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (!preview) return null;

  const blocked = !preview.canAccept && preview.reason === "other_workshop";
  const alreadyYours = !preview.canAccept && preview.reason === "already_yours";
  const canStartProduction = preview.canAccept || alreadyYours;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <View style={styles.wifiMark}>
              <MaterialIcons name="wifi-tethering" size={12} color={GOLD} />
            </View>
            <View style={styles.ccMark}>
              <Text style={styles.ccText}>CC</Text>
            </View>
          </View>
          <Text style={styles.screenTitle}>{t("batchOffer.screenTitle")}</Text>

          <View style={styles.profileRow}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <MaterialIcons name="person" size={36} color={GOLD_MUTED} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeGold}>
                {t("batchOffer.welcomeGreeting").replace("{name}", firstName)}
              </Text>
              <Text style={styles.subLine}>
                {t("batchOffer.subLine").replace(
                  "{name}",
                  preview.ownerName || "—",
                )}
              </Text>
            </View>
          </View>

          <SectionLine title={t("batchOffer.sectionWorkSummary")} />
          <Text style={styles.contextLabel}>{t("batchOffer.contextSmall")}</Text>
          <View style={styles.twoCards}>
            <View style={styles.goldLineCard}>
              <Text style={styles.cardTag}>{t("batchOffer.lotCardTitle")}</Text>
              <Text style={styles.cardRef}>{lotRef}</Text>
              <Text style={styles.cardPiece} numberOfLines={2}>
                {preview.name}
              </Text>
            </View>
            <View style={styles.goldLineCard}>
              <Text style={styles.cardTag}>{t("batchOffer.quantityCardTitle")}</Text>
              <Text style={styles.cardBig}>
                {preview.totalPieces} {t("batchOffer.unitsShort")}
              </Text>
            </View>
          </View>

          <View style={{ height: 8 }} />
          <SectionLine title={t("batchOffer.sectionValueOffer")} gold />
          <View style={styles.valueRow}>
            <View style={styles.valueLeft}>
              <Text style={styles.vLabel}>{t("batchOffer.valueUnitLabelCaps")}</Text>
              <View style={styles.goldPillBig}>
                <Text style={styles.goldPillText}>
                  {formatMoney(preview.pricePerPiece ?? 0)}
                </Text>
              </View>
              <Text style={styles.vFooter}>{t("batchOffer.valueUnitFooter")}</Text>
            </View>
            <View style={styles.valueRight}>
              <Text style={styles.vLabelRight}>{t("batchOffer.autoCalcLabel")}</Text>
              <Text style={styles.totalSub}>{t("batchOffer.totalLotShort")}</Text>
              <View style={styles.goldPillBig}>
                <Text style={styles.goldPillText}>
                  {formatMoney(preview.guaranteedTotal ?? 0)}
                </Text>
              </View>
              <Text style={styles.vFooter}>{t("batchOffer.guaranteedFooter")}</Text>
            </View>
          </View>

          {preview.observations ? (
            <Text style={styles.obs}>{preview.observations}</Text>
          ) : null}
          {preview.cutObservations ? (
            <Text style={styles.obs}>{preview.cutObservations}</Text>
          ) : null}

          <Text style={styles.footnote}>{t("batchOffer.footnoteAccept")}</Text>

          {blocked ? (
            <Text style={styles.warnBox}>{t("batchOffer.takenByOther")}</Text>
          ) : null}
          {alreadyYours ? (
            <Text style={styles.infoBox}>{t("batchOffer.alreadyAccepted")}</Text>
          ) : null}

          {!blocked && !alreadyYours ? (
            <View style={styles.deliveryBox}>
              <Text style={styles.deliveryLabel}>{t("batchOffer.deliveryDateLabel")}</Text>
              <TextInput
                style={styles.deliveryInput}
                value={deliveryInput}
                onChangeText={(x) => setDeliveryInput(formatDateInput(x))}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={GOLD_MUTED}
                keyboardType="numeric"
                maxLength={10}
              />
              <Text style={styles.deliveryHint}>{t("batchOffer.deliveryDateHint")}</Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.btnAccept,
                (!canStartProduction || acting) && styles.btnDisabled,
              ]}
              onPress={onAccept}
              disabled={!canStartProduction || acting}
              activeOpacity={0.9}
            >
              {acting ? (
                <ActivityIndicator color="#F0FDF4" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={22} color="#F0FDF4" />
                  <Text style={styles.btnAcceptText} numberOfLines={2}>
                    {t("batchOffer.acceptCtaCaps")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnNegotiate, acting && styles.btnDisabled]}
              onPress={onRequestAdjust}
              disabled={acting}
              activeOpacity={0.9}
            >
              <MaterialIcons name="close" size={22} color="#FEF2F2" />
              <Text style={styles.btnNegotiateText} numberOfLines={2}>
                {t("batchOffer.negotiateCtaCaps")}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backDash} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.backDashT}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerFillPadded: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  logoRow: { alignItems: "center", marginTop: 4, marginBottom: 8 },
  wifiMark: { marginBottom: 4 },
  ccMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(232, 197, 71, 0.6)",
    backgroundColor: "rgba(90, 70, 130, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ccText: { fontSize: 20, fontWeight: "900", color: "#F5F0FF", letterSpacing: 1 },
  screenTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: GOLD,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 22,
  },
  profileRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: "rgba(232, 197, 71, 0.45)" },
  avatarPh: { backgroundColor: BG_CARD, alignItems: "center", justifyContent: "center" },
  welcomeGold: { fontSize: 18, fontWeight: "800", color: GOLD },
  subLine: { fontSize: 13, color: TEXT_LIGHT, marginTop: 4, lineHeight: 20 },
  contextLabel: { fontSize: 12, color: TEXT_LIGHT, marginBottom: 8 },
  twoCards: { flexDirection: "row", gap: 10, marginBottom: 6 },
  goldLineCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.45)",
    backgroundColor: BG_CARD,
    padding: 12,
    minHeight: 96,
  },
  cardTag: { fontSize: 9, fontWeight: "800", color: GOLD_MUTED, letterSpacing: 0.5 },
  cardRef: { fontSize: 18, fontWeight: "900", color: GOLD, marginTop: 6 },
  cardPiece: { fontSize: 12, color: TEXT_LIGHT, marginTop: 4 },
  cardBig: { fontSize: 16, fontWeight: "800", color: TEXT_LIGHT, marginTop: 10 },
  valueRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  valueLeft: {
    flex: 1,
    backgroundColor: "#2d1f4a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.2)",
    padding: 12,
  },
  valueRight: {
    flex: 1,
    backgroundColor: BG_VALUE_RIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
  },
  vLabel: { fontSize: 9, fontWeight: "800", color: TEXT_LIGHT, marginBottom: 6 },
  vLabelRight: { fontSize: 9, fontWeight: "800", color: GOLD_MUTED, marginBottom: 2 },
  totalSub: { fontSize: 9, fontWeight: "800", color: TEXT_LIGHT, marginBottom: 4 },
  goldPillBig: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  goldPillText: { fontSize: 15, fontWeight: "900", color: "#1a0f0a" },
  vFooter: { fontSize: 10, color: TEXT_LIGHT, marginTop: 8, lineHeight: 14 },
  obs: { fontSize: 12, color: GOLD_MUTED, marginTop: 8, lineHeight: 18 },
  footnote: {
    fontSize: 12,
    color: TEXT_LIGHT,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
    lineHeight: 18,
    fontStyle: "italic",
  },
  warnBox: { color: "#FBBF24", textAlign: "center", marginBottom: 10 },
  infoBox: { color: "#86EFAC", textAlign: "center", marginBottom: 10 },
  deliveryBox: {
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.35)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "rgba(26, 15, 46, 0.8)",
  },
  deliveryLabel: { fontSize: 13, fontWeight: "700", color: GOLD, marginBottom: 6 },
  deliveryInput: {
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.4)",
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    color: "#FFF",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  deliveryHint: { fontSize: 11, color: GOLD_MUTED, marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnAccept: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#15803D",
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: 12,
    minHeight: 88,
  },
  btnAcceptText: {
    color: "#F0FDF4",
    fontWeight: "900",
    fontSize: 10,
    textAlign: "center",
    flex: 1,
  },
  btnNegotiate: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#B91C1C",
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: 12,
    minHeight: 88,
  },
  btnNegotiateText: {
    color: "#FEF2F2",
    fontWeight: "900",
    fontSize: 9,
    textAlign: "center",
    flex: 1,
  },
  btnDisabled: { opacity: 0.5 },
  backDash: { alignItems: "center", marginTop: 20, padding: 8 },
  backDashT: { color: GOLD_MUTED, fontSize: 14, fontWeight: "600" },
  errLight: { color: "#FECACA", textAlign: "center", marginTop: 12, fontSize: 15 },
  textLink: { marginTop: 16, padding: 8 },
  textLinkT: { color: GOLD, fontWeight: "700" },
});
