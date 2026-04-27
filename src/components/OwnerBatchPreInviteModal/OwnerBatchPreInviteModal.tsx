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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "../../contexts/LanguageContext";
import { Alert, Platform } from "react-native";

const BG = "#0F0820";
const BG_ELEV = "#1a0f2e";
const GOLD = "#E8C547";
const GOLD_DIM = "#9A7B2D";
const TEXT_MUTED = "rgba(232, 197, 71, 0.7)";

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

  const workshopLabel = data.workshopName?.trim() || t("batches.preInviteWorkshopUnnamed");
  const first = data.userFirstName;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          {data.step === "agreement" ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.brandRow}>
                <View style={styles.ccMark}>
                  <Text style={styles.ccText}>C</Text>
                  <View style={styles.ccSub}>
                    <Text style={styles.ccSubT}>C</Text>
                  </View>
                </View>
                <Text style={styles.brandSub}>{t("batches.preInviteBrand")}</Text>
              </View>
              <Text style={styles.screenTitle}>{t("batches.preInviteTitle")}</Text>

              <View style={styles.profileRow}>
                {data.photoURL ? (
                  <Image source={{ uri: data.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPh]}>
                    <MaterialIcons name="person" size={40} color={GOLD_DIM} />
                  </View>
                )}
                <View style={styles.profileText}>
                  <Text style={styles.welcomeLine}>
                    {t("batches.preInviteWelcome").replace("{name}", first)}
                  </Text>
                  <Text style={styles.workshopLine} numberOfLines={2}>
                    {t("batches.preInviteWorkshopLine").replace(
                      "{name}",
                      workshopLabel,
                    )}
                  </Text>
                </View>
              </View>

              <Text style={styles.contextLabel}>{t("batches.preInviteContext")}</Text>
              <View style={styles.twoCards}>
                <View style={styles.goldCard}>
                  <Text style={styles.goldCardLabel}>{t("batches.preInviteLot")}</Text>
                  <Text style={styles.goldCardBig}>{data.batchRef}</Text>
                  <Text style={styles.goldCardPiece} numberOfLines={2}>
                    {data.pieceName}
                  </Text>
                </View>
                <View style={styles.goldCard}>
                  <Text style={styles.goldCardLabel}>
                    {t("batches.preInviteQuantityShort")}
                  </Text>
                  <Text style={styles.goldCardBig}>
                    {data.quantity} {t("batches.preInviteUnits")}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>{t("batches.preInviteValueSection")}</Text>
              <View style={styles.valueRow}>
                <View style={styles.valueCardLeft}>
                  <Text style={styles.valueCardLabel}>{t("batches.preInviteUnitLabel")}</Text>
                  <View style={styles.unitBox}>
                    <Text style={styles.rs}>R$</Text>
                    <TextInput
                      style={styles.unitInput}
                      value={unitInput}
                      onChangeText={setUnitInput}
                      placeholder="0,00"
                      placeholderTextColor={GOLD_DIM}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={styles.unitHint}>{t("batches.preInviteUnitHint")}</Text>
                </View>
                <View style={styles.valueCardRight}>
                  <Text style={styles.valueCardLabel}>{t("batches.preInviteCalcLabel")}</Text>
                  <Text style={styles.totalHuge}>{formatBRL(computedTotal)}</Text>
                  <Text style={styles.totalSub}>{t("batches.preInviteTotalLot")}</Text>
                  <Text style={styles.breakLine}>
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

              <Text style={styles.footnote}>{t("batches.preInviteFootnote")}</Text>

              <TouchableOpacity
                style={styles.cta}
                onPress={handlePrimary}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator color={BG} />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={22} color={BG} />
                    <Text style={styles.ctaText}>{t("batches.preInviteCta")}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipX} onPress={onClose} hitSlop={12}>
                <Text style={styles.skipXText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollShare}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.shareHead}>{t("batches.preInviteShareHead")}</Text>
              <Text style={styles.shareSub}>{t("batches.preInviteShareSub")}</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkUrl} selectable numberOfLines={5}>
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
                <TouchableOpacity style={styles.outlineBtn} onPress={onCopyLink}>
                  <MaterialIcons name="content-copy" size={20} color={GOLD} />
                  <Text style={styles.outlineBtnText}>{t("batches.offerCopyLink")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.solidBtn} onPress={onShareLink}>
                  <MaterialIcons name="share" size={20} color={BG} />
                  <Text style={styles.solidBtnText}>{t("common.share")}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>{t("batches.offerConfirm")}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  scrollShare: { padding: 20, paddingBottom: 40 },
  brandRow: { alignItems: "center", marginTop: 8, marginBottom: 8 },
  ccMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(232, 197, 71, 0.2)",
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ccText: { fontSize: 22, fontWeight: "900", color: GOLD, fontStyle: "italic" },
  ccSub: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#5B4A9E",
    alignItems: "center",
    justifyContent: "center",
  },
  ccSubT: { fontSize: 10, fontWeight: "800", color: "#F5E6A8" },
  brandSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 6, letterSpacing: 1 },
  screenTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: GOLD,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  profileRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: GOLD_DIM },
  avatarPh: { backgroundColor: BG_ELEV, alignItems: "center", justifyContent: "center" },
  profileText: { flex: 1 },
  welcomeLine: { fontSize: 18, fontWeight: "700", color: "#F5E6A8" },
  workshopLine: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  contextLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 8 },
  twoCards: { flexDirection: "row", gap: 10, marginBottom: 22 },
  goldCard: {
    flex: 1,
    backgroundColor: BG_ELEV,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.45)",
    padding: 12,
    minHeight: 100,
  },
  goldCardLabel: { fontSize: 10, fontWeight: "800", color: GOLD_DIM, letterSpacing: 0.5 },
  goldCardBig: { fontSize: 20, fontWeight: "900", color: GOLD, marginTop: 6 },
  goldCardPiece: { fontSize: 12, color: TEXT_MUTED, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: GOLD, marginBottom: 12 },
  valueRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  valueCardLeft: {
    flex: 1,
    backgroundColor: BG_ELEV,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.35)",
    padding: 12,
  },
  valueCardRight: {
    flex: 1,
    backgroundColor: BG_ELEV,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.35)",
    padding: 12,
  },
  valueCardLabel: { fontSize: 9, fontWeight: "800", color: GOLD_DIM, marginBottom: 8 },
  unitBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(232, 197, 71, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.25)",
  },
  rs: { fontSize: 16, fontWeight: "800", color: GOLD, marginRight: 4 },
  unitInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: GOLD,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  unitHint: { fontSize: 10, color: TEXT_MUTED, marginTop: 8 },
  totalHuge: { fontSize: 18, fontWeight: "900", color: GOLD, marginTop: 4 },
  totalSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 4 },
  breakLine: { fontSize: 10, color: TEXT_MUTED, marginTop: 6 },
  footnote: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: { fontSize: 12, fontWeight: "900", color: BG, textAlign: "center", flex: 1 },
  skipX: { alignItems: "center", marginTop: 20, padding: 8 },
  skipXText: { color: TEXT_MUTED, fontSize: 14 },
  shareHead: { fontSize: 20, fontWeight: "800", color: GOLD, textAlign: "center", marginBottom: 8 },
  shareSub: { fontSize: 13, color: TEXT_MUTED, textAlign: "center", marginBottom: 20 },
  linkBox: {
    backgroundColor: BG_ELEV,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.3)",
    padding: 14,
    marginBottom: 20,
  },
  linkUrl: { fontSize: 11, color: "#E5E0F0", lineHeight: 18 },
  copiedPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  copiedText: { color: "#34D399", fontWeight: "700", fontSize: 12 },
  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 16 },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
  },
  outlineBtnText: { color: GOLD, fontWeight: "800", fontSize: 14 },
  solidBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
  },
  solidBtnText: { color: BG, fontWeight: "800", fontSize: 14 },
  doneBtn: { alignItems: "center", padding: 16, borderWidth: 1, borderColor: "rgba(232,197,71,0.3)", borderRadius: 12 },
  doneBtnText: { color: TEXT_MUTED, fontWeight: "700", fontSize: 16 },
});
