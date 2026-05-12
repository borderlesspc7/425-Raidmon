import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  Keyboard,
  Alert,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../hooks/useTheme";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
}

function parseBrMoney(s: string): number {
  const t = s
    .replace(/\s/g, "")
    .replace(/R\$\s?/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function formatInputMoney(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

export type PreInviteStep = "agreement" | "share";

export type OwnerBatchPreInviteData = {
  step: PreInviteStep;
  batchId: string;
  inviteUrl: string;
  batchRef: string;
  pieceName: string;
  quantity: number;
  pricePerPiece: number;
  guaranteedTotal: number;
  batchObservations: string;
  cutObservations: string;
  workshopName: string;
  photoURL?: string;
  userFirstName: string;
  companyName?: string;
};

type Props = {
  visible: boolean;
  data: OwnerBatchPreInviteData | null;
  onClose: () => void;
  onConfirmAgreement: (
    pricePerPiece: number,
    guaranteedTotal: number,
  ) => Promise<void>;
  offerLinkJustCopied: boolean;
  onCopyLink: () => void;
  onShareLink: () => void;
};

export default function OwnerBatchPreInviteModal({
  visible,
  data,
  onClose,
  onConfirmAgreement,
  offerLinkJustCopied,
  onCopyLink,
  onShareLink,
}: Props) {
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const [unitInput, setUnitInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qty = data?.quantity ?? 0;
  const unitFromProps = data?.pricePerPiece ?? 0;

  useEffect(() => {
    if (visible && data?.step === "agreement" && data) {
      setUnitInput(formatInputMoney(unitFromProps));
    }
  }, [visible, data?.step, data?.pricePerPiece, unitFromProps, data]);

  const parsedUnit = useMemo(() => parseBrMoney(unitInput), [unitInput]);
  const computedTotal = useMemo(() => {
    if (!Number.isFinite(parsedUnit) || parsedUnit < 0 || !qty) return 0;
    return Math.round(qty * parsedUnit * 100) / 100;
  }, [parsedUnit, qty]);

  const handlePrimary = async () => {
    if (!data || data.step !== "agreement") return;
    if (!Number.isFinite(parsedUnit) || parsedUnit <= 0) {
      Alert.alert(t("common.error"), t("batches.preInviteInvalidUnit"));
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await onConfirmAgreement(parsedUnit, computedTotal);
    } finally {
      setSubmitting(false);
    }
  };

  if (!data) return null;

  const workshopLabel =
    data.workshopName?.trim() || t("batches.preInviteWorkshopUnnamed");
  const first = data.userFirstName;

  const cardSurface = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          {data.step === "agreement" ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.brandRow}>
                <View
                  style={[
                    styles.logoWrap,
                    { borderColor: theme.colors.border },
                  ]}
                >
                  <Image
                    source={require("../../../assets/logo1.jpeg")}
                    style={styles.logo}
                    resizeMode="cover"
                  />
                </View>
                <Text style={[styles.brandSub, { color: theme.colors.textMuted }]}>
                  {t("batches.preInviteBrand")}
                </Text>
              </View>
              <Text style={[styles.screenTitle, { color: theme.colors.text }]}>
                {t("batches.preInviteTitle")}
              </Text>

              <View style={styles.profileRow}>
                {data.photoURL ? (
                  <Image
                    source={{ uri: data.photoURL }}
                    style={[styles.avatar, { borderColor: theme.colors.border }]}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surfaceSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="person"
                      size={40}
                      color={theme.colors.textMuted}
                    />
                  </View>
                )}
                <View style={styles.profileText}>
                  <Text style={[styles.welcomeLine, { color: theme.colors.text }]}>
                    {t("batches.preInviteWelcome").replace("{name}", first)}
                  </Text>
                  <Text
                    style={[styles.workshopLine, { color: theme.colors.textMuted }]}
                    numberOfLines={2}
                  >
                    {t("batches.preInviteWorkshopLine").replace(
                      "{name}",
                      workshopLabel,
                    )}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.contextLabel, { color: theme.colors.textMuted }]}
              >
                {t("batches.preInviteContext")}
              </Text>
              <View style={styles.twoCards}>
                <View style={[styles.summaryCard, cardSurface]}>
                  <Text
                    style={[styles.summaryCardLabel, { color: theme.colors.textMuted }]}
                  >
                    {t("batches.preInviteLot")}
                  </Text>
                  <Text style={[styles.summaryCardBig, { color: theme.colors.primary }]}>
                    {data.batchRef}
                  </Text>
                  <Text
                    style={[styles.summaryCardPiece, { color: theme.colors.text }]}
                    numberOfLines={2}
                  >
                    {data.pieceName}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardSurface]}>
                  <Text
                    style={[styles.summaryCardLabel, { color: theme.colors.textMuted }]}
                  >
                    {t("batches.preInviteQuantityShort")}
                  </Text>
                  <Text style={[styles.summaryCardBig, { color: theme.colors.primary }]}>
                    {data.quantity} {t("batches.preInviteUnits")}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.sectionTitle, { color: theme.colors.text }]}
              >
                {t("batches.preInviteValueSection")}
              </Text>
              <View style={styles.valueRow}>
                <View style={[styles.valueCard, cardSurface]}>
                  <Text
                    style={[styles.valueCardLabel, { color: theme.colors.textMuted }]}
                  >
                    {t("batches.preInviteUnitLabel")}
                  </Text>
                  <View style={styles.unitInputWrap}>
                    <View
                      style={[
                        styles.unitBox,
                        {
                          backgroundColor: theme.colors.surfaceSoft,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.rs, { color: theme.colors.primary }]}
                      >
                        R$
                      </Text>
                      <TextInput
                        style={[styles.unitInput, { color: theme.colors.text }]}
                        value={unitInput}
                        onChangeText={setUnitInput}
                        placeholder="0,00"
                        placeholderTextColor={theme.colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <Text style={[styles.unitHint, { color: theme.colors.textMuted }]}>
                    {t("batches.preInviteUnitHint")}
                  </Text>
                </View>
                <View style={[styles.valueCard, cardSurface]}>
                  <View
                    style={[
                      styles.calcHead,
                      { backgroundColor: theme.colors.surfaceSoft },
                    ]}
                  >
                    <Text
                      style={[styles.calcHeadText, { color: theme.colors.textMuted }]}
                    >
                      {t("batches.preInviteCalcLabel")}
                    </Text>
                  </View>
                  <Text style={[styles.totalHuge, { color: theme.colors.primary }]}>
                    {formatBRL(computedTotal)}
                  </Text>
                  <Text
                    style={[styles.totalSub, { color: theme.colors.textMuted }]}
                  >
                    {t("batches.preInviteTotalLot")}
                  </Text>
                  <Text
                    style={[styles.breakLine, { color: theme.colors.textMuted }]}
                  >
                    {t("batches.preInviteBreak")
                      .replace("{q}", String(qty))
                      .replace(
                        "{u}",
                        formatBRL(
                          Number.isFinite(parsedUnit) && parsedUnit > 0
                            ? parsedUnit
                            : 0,
                        ),
                      )}
                  </Text>
                </View>
              </View>

              <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
                {t("batches.preInviteFootnote")}
              </Text>

              <TouchableOpacity
                style={[styles.cta, { backgroundColor: theme.colors.primary }]}
                onPress={handlePrimary}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.ctaText}>{t("batches.preInviteCta")}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipX} onPress={onClose} hitSlop={12}>
                <Text style={[styles.skipXText, { color: theme.colors.textMuted }]}>
                  {t("common.close")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollShare}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.shareHead, { color: theme.colors.text }]}>
                {t("batches.preInviteShareHead")}
              </Text>
              <Text style={[styles.shareSub, { color: theme.colors.textMuted }]}>
                {t("batches.preInviteShareSub")}
              </Text>
              <View style={[styles.linkBox, cardSurface]}>
                <Text
                  style={[styles.linkUrl, { color: theme.colors.text }]}
                  selectable
                  numberOfLines={6}
                >
                  {data.inviteUrl}
                </Text>
                {offerLinkJustCopied ? (
                  <View style={styles.copiedPill}>
                    <MaterialIcons name="check-circle" size={16} color="#34D399" />
                    <Text style={styles.copiedText}>{t("common.linkCopied")}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.rowBtns}>
                <TouchableOpacity
                  style={[
                    styles.outlineBtn,
                    { borderColor: theme.colors.primary },
                  ]}
                  onPress={onCopyLink}
                >
                  <MaterialIcons
                    name="content-copy"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.outlineBtnText, { color: theme.colors.primary }]}>
                    {t("batches.offerCopyLink")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.solidBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={onShareLink}
                >
                  <MaterialIcons name="share" size={20} color="#FFFFFF" />
                  <Text style={styles.solidBtnText}>{t("common.share")}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.doneBtn,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.doneBtnText, { color: theme.colors.text }]}>
                  {t("batches.offerConfirm")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    flexGrow: 1,
  },
  scrollShare: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  brandRow: { alignItems: "center", marginTop: 10, marginBottom: 10 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    borderWidth: 2,
  },
  logo: { width: "100%", height: "100%" },
  brandSub: { fontSize: 11, marginTop: 6, letterSpacing: 0.5 },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 14,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  profileText: { flex: 1 },
  welcomeLine: { fontSize: 18, fontWeight: "700" },
  workshopLine: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  contextLabel: { fontSize: 14, marginBottom: 8, textAlign: "center" },
  twoCards: { flexDirection: "row", gap: 10, marginBottom: 22 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  summaryCardBig: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
  },
  summaryCardPiece: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  valueRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  valueCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  valueCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  unitInputWrap: { width: "100%", paddingHorizontal: 4 },
  unitBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    width: "100%",
  },
  rs: { fontSize: 16, fontWeight: "800", marginRight: 4 },
  unitInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  unitHint: { fontSize: 11, marginTop: 8, textAlign: "center", lineHeight: 16 },
  calcHead: {
    width: "100%",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -12,
    marginTop: -12,
    paddingHorizontal: 12,
  },
  calcHeadText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  totalHuge: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  totalSub: { fontSize: 12, marginTop: 6, textAlign: "center", fontWeight: "600" },
  breakLine: {
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 16,
  },
  footnote: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "500",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    flex: 1,
    paddingRight: 8,
  },
  skipX: { alignItems: "center", marginTop: 20, padding: 8 },
  skipXText: { fontSize: 15 },
  shareHead: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 30,
  },
  shareSub: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  linkBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
  },
  linkUrl: { fontSize: 14, lineHeight: 22 },
  copiedPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  copiedText: { color: "#34D399", fontWeight: "700", fontSize: 13 },
  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 16 },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
  },
  outlineBtnText: { fontWeight: "800", fontSize: 15 },
  solidBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  solidBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  doneBtn: {
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  doneBtnText: { fontWeight: "700", fontSize: 16 },
});
