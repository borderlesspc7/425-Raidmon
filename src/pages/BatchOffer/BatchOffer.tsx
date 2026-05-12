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
import { useTheme } from "../../hooks/useTheme";
import ThemedNoticeModal from "../../components/ThemedNoticeModal/ThemedNoticeModal";
import {
  getBatchInvitePreview,
  respondBatchInvite,
  type BatchInvitePreview,
} from "../../services/batchInviteFunctions";

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

function SectionLine({
  title,
  textColor,
  lineColor,
}: {
  title: string;
  textColor: string;
  lineColor: string;
}) {
  return (
    <View style={sectionStyles.headerRow}>
      <Text style={[sectionStyles.h2, { color: textColor }]}>{title}</Text>
      <View style={[sectionStyles.line, { backgroundColor: lineColor }]} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  h2: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  line: { flex: 1, height: 1 },
});

export default function BatchOffer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const { theme, isDark } = useTheme();

  const batchId = navigationParams.batchOffer?.batchId;
  const token = navigationParams.batchOffer?.token;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BatchInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [deliveryInput, setDeliveryInput] = useState("");
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });

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
      setFeedback({
        visible: true,
        title: t("common.success"),
        message: t("batchOffer.alreadyAccepted"),
      });
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
    const today = new Date();
    const startDelivery = new Date(deliveryD.getFullYear(), deliveryD.getMonth(), deliveryD.getDate()).getTime();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (startDelivery < startToday) {
      Alert.alert(t("common.error"), t("batches.deliveryDateMinToday"));
      return;
    }
    const deliveryIso = deliveryD.toISOString();

    try {
      setActing(true);
      const res = await respondBatchInvite(batchId, token, "accept", deliveryIso);
      setFeedback({
        visible: true,
        title: t("common.success"),
        message: res.alreadyAccepted
          ? t("batchOffer.alreadyAccepted")
          : t("batchOffer.acceptSuccess"),
      });
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

  const bg = theme.colors.background;
  const surface = theme.colors.surface;
  const border = theme.colors.border;
  const text = theme.colors.text;
  const muted = theme.colors.textMuted;
  const primary = theme.colors.primary;

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SafeAreaView style={styles.centerFill}>
          <ActivityIndicator size="large" color={primary} />
        </SafeAreaView>
      </View>
    );
  }

  if (user.userType !== "workshop") {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SafeAreaView style={styles.centerFillPadded}>
          <MaterialIcons name="block" size={48} color={theme.colors.danger} />
          <Text style={[styles.errText, { color: theme.colors.danger }]}>{t("batchOffer.workshopOnly")}</Text>
          <TouchableOpacity style={styles.textLink} onPress={() => navigate(paths.dashboard)}>
            <Text style={[styles.textLinkT, { color: primary }]}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SafeAreaView style={styles.centerFill}>
          <ActivityIndicator size="large" color={primary} />
        </SafeAreaView>
      </View>
    );
  }

  if (error && !preview) {
    return (
      <View style={[styles.root, { backgroundColor: bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <SafeAreaView style={styles.centerFillPadded}>
          <MaterialIcons name="error-outline" size={48} color={theme.colors.danger} />
          <Text style={[styles.errText, { color: text }]}>{error}</Text>
          <TouchableOpacity style={styles.textLink} onPress={() => navigate(paths.dashboard)}>
            <Text style={[styles.textLinkT, { color: primary }]}>{t("batchOffer.backHome")}</Text>
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
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <View style={[styles.logoWrap, { borderColor: border }]}>
              <Image source={require("../../../assets/logo1.jpeg")} style={styles.logo} resizeMode="cover" />
            </View>
          </View>
          <Text style={[styles.screenTitle, { color: text }]}>{t("batchOffer.screenTitle")}</Text>

          <View style={styles.profileRow}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={[styles.avatar, { borderColor: border }]} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPh,
                  { borderColor: border, backgroundColor: theme.colors.surfaceSoft },
                ]}
              >
                <MaterialIcons name="person" size={36} color={muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.welcome, { color: text }]}>
                {t("batchOffer.welcomeGreeting").replace("{name}", firstName)}
              </Text>
              <Text style={[styles.subLine, { color: muted }]}>
                {t("batchOffer.subLine").replace("{name}", preview.ownerName || "—")}
              </Text>
            </View>
          </View>

          <SectionLine
            title={t("batchOffer.sectionWorkSummary")}
            textColor={muted}
            lineColor={border}
          />
          <Text style={[styles.contextLabel, { color: muted }]}>{t("batchOffer.contextSmall")}</Text>
          <View style={styles.twoCards}>
            <View style={[styles.infoCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.cardTag, { color: primary }]}>{t("batchOffer.lotCardTitle")}</Text>
              <Text style={[styles.cardRef, { color: text }]}>{lotRef}</Text>
              <Text style={[styles.cardPiece, { color: muted }]} numberOfLines={2}>
                {preview.name}
              </Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.cardTag, { color: primary }]}>{t("batchOffer.quantityCardTitle")}</Text>
              <Text style={[styles.cardBig, { color: text }]}>
                {preview.totalPieces} {t("batchOffer.unitsShort")}
              </Text>
            </View>
          </View>

          <View style={{ height: 8 }} />
          <SectionLine title={t("batchOffer.sectionValueOffer")} textColor={muted} lineColor={border} />
          <View style={styles.valueRow}>
            <View style={[styles.valueBox, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.vLabel, { color: muted }]}>{t("batchOffer.valueUnitLabelCaps")}</Text>
              <View style={[styles.valuePill, { backgroundColor: theme.colors.iconSoft }]}>
                <Text style={[styles.valuePillText, { color: text }]}>{formatMoney(preview.pricePerPiece ?? 0)}</Text>
              </View>
              <Text style={[styles.vFooter, { color: muted }]}>{t("batchOffer.valueUnitFooter")}</Text>
            </View>
            <View style={[styles.valueBox, { backgroundColor: surface, borderColor: border }]}>
              <View style={[styles.calcHead, { backgroundColor: theme.colors.surfaceSoft }]}>
                <Text style={[styles.calcHeadText, { color: muted }]}>{t("batchOffer.autoCalcLabel")}</Text>
              </View>
              <Text style={[styles.totalSub, { color: muted }]}>{t("batchOffer.totalLotShort")}</Text>
              <View style={[styles.valuePill, { backgroundColor: theme.colors.iconSoft }]}>
                <Text style={[styles.valuePillText, { color: text }]}>
                  {formatMoney(preview.guaranteedTotal ?? 0)}
                </Text>
              </View>
              <Text style={[styles.vFooter, { color: muted }]}>{t("batchOffer.guaranteedFooter")}</Text>
            </View>
          </View>

          {preview.observations ? (
            <Text style={[styles.obs, { color: muted }]}>{preview.observations}</Text>
          ) : null}
          {preview.cutObservations ? (
            <Text style={[styles.obs, { color: muted }]}>{preview.cutObservations}</Text>
          ) : null}

          <Text style={[styles.footnote, { color: muted }]}>{t("batchOffer.footnoteAccept")}</Text>

          {blocked ? (
            <Text style={[styles.warnBox, { color: "#CA8A04" }]}>{t("batchOffer.takenByOther")}</Text>
          ) : null}
          {alreadyYours ? (
            <Text style={[styles.infoBox, { color: "#16A34A" }]}>{t("batchOffer.alreadyAccepted")}</Text>
          ) : null}

          {!blocked && !alreadyYours ? (
            <View style={[styles.deliveryBox, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.deliveryLabel, { color: text }]}>{t("batchOffer.deliveryDateLabel")}</Text>
              <TextInput
                style={[
                  styles.deliveryInput,
                  {
                    borderColor: border,
                    color: text,
                    backgroundColor: theme.colors.surfaceSoft,
                  },
                ]}
                value={deliveryInput}
                onChangeText={(x) => setDeliveryInput(formatDateInput(x))}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={muted}
                keyboardType="numeric"
                maxLength={10}
              />
              <Text style={[styles.deliveryHint, { color: muted }]}>{t("batchOffer.deliveryDateHint")}</Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.btnAccept,
                { backgroundColor: "#059669" },
                (!canStartProduction || acting) && styles.btnDisabled,
              ]}
              onPress={onAccept}
              disabled={!canStartProduction || acting}
              activeOpacity={0.9}
            >
              {acting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={22} color="#FFF" />
                  <Text style={styles.btnAcceptText} numberOfLines={2}>
                    {t("batchOffer.acceptCtaCaps")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backDash} onPress={() => navigate(paths.dashboard)}>
            <Text style={[styles.backDashT, { color: primary }]}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <ThemedNoticeModal
        visible={feedback.visible}
        title={feedback.title}
        message={feedback.message}
        hint={t("batchOffer.feedbackProductionLegend")}
        actionLabel={t("batchOffer.goToProduction")}
        onDismiss={() => {
          setFeedback({ visible: false, title: "", message: "" });
          navigate(paths.workshopProduction);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerFillPadded: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  logoRow: { alignItems: "center", marginTop: 8, marginBottom: 10 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    borderWidth: 2,
  },
  logo: { width: "100%", height: "100%" },
  screenTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 22,
  },
  profileRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  avatarPh: { alignItems: "center", justifyContent: "center" },
  welcome: { fontSize: 18, fontWeight: "800" },
  subLine: { fontSize: 13, marginTop: 4, lineHeight: 20 },
  contextLabel: { fontSize: 13, marginBottom: 8, textAlign: "center" },
  twoCards: { flexDirection: "row", gap: 10, marginBottom: 6 },
  infoCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cardTag: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" },
  cardRef: { fontSize: 19, fontWeight: "800", marginTop: 6, textAlign: "center" },
  cardPiece: { fontSize: 12, marginTop: 4, textAlign: "center", fontWeight: "600" },
  cardBig: { fontSize: 17, fontWeight: "800", marginTop: 10, textAlign: "center" },
  valueRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  valueBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  vLabel: { fontSize: 10, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  totalSub: { fontSize: 10, fontWeight: "800", marginTop: 10, marginBottom: 4, textAlign: "center" },
  valuePill: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    minWidth: "88%",
  },
  valuePillText: { fontSize: 15, fontWeight: "800" },
  vFooter: { fontSize: 10, marginTop: 8, lineHeight: 14, textAlign: "center" },
  calcHead: {
    alignSelf: "stretch",
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    marginBottom: 4,
  },
  calcHeadText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  obs: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  footnote: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
    lineHeight: 18,
    fontStyle: "italic",
  },
  warnBox: { textAlign: "center", marginBottom: 10, fontWeight: "600" },
  infoBox: { textAlign: "center", marginBottom: 10, fontWeight: "600" },
  deliveryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  deliveryLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  deliveryInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
  },
  deliveryHint: { fontSize: 11, marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnAccept: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 88,
  },
  btnAcceptText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center",
    flex: 1,
  },
  btnDisabled: { opacity: 0.5 },
  backDash: { alignItems: "center", marginTop: 20, padding: 8 },
  backDashT: { fontSize: 14, fontWeight: "600" },
  errText: { textAlign: "center", marginTop: 12, fontSize: 15 },
  textLink: { marginTop: 16, padding: 8 },
  textLinkT: { fontWeight: "700" },
});
