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
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../contexts/LanguageContext";
import { Alert, Platform } from "react-native";

const BG = "#120A24";
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
      <LinearGradient
        colors={["#3B1C68", "#130A27", "#0B0717"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.root}
      >
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          {data.step === "agreement" ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.brandRow}>
                <View style={styles.logoWrap}>
                  <Image source={require("../../../assets/logo1.jpeg")} style={styles.logo} resizeMode="cover" />
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
                <LinearGradient
                  colors={["#F6D773", "#E8C547"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.goldCard}
                >
                  <Text style={styles.goldCardLabel}>{t("batches.preInviteLot")}</Text>
                  <Text style={styles.goldCardBig}>{data.batchRef}</Text>
                  <Text style={styles.goldCardPiece} numberOfLines={2}>
                    {data.pieceName}
                  </Text>
                </LinearGradient>
                <LinearGradient
                  colors={["#F6D773", "#E8C547"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.goldCard}
                >
                  <Text style={styles.goldCardLabel}>
                    {t("batches.preInviteQuantityShort")}
                  </Text>
                  <Text style={styles.goldCardBig}>
                    {data.quantity} {t("batches.preInviteUnits")}
                  </Text>
                </LinearGradient>
              </View>

              <Text style={styles.sectionTitle}>{t("batches.preInviteValueSection")}</Text>
              <View style={styles.valueRow}>
                <View style={styles.valueCardLeft}>
                  <Text style={styles.valueCardLabel}>{t("batches.preInviteUnitLabel")}</Text>
                  <View style={styles.unitInputWrap}>
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
                  </View>
                  <Text style={styles.unitHint}>{t("batches.preInviteUnitHint")}</Text>
                </View>
                <View style={styles.valueCardRight}>
                  <View style={styles.calcHead}>
                    <Text style={styles.calcHeadText}>{t("batches.preInviteCalcLabel")}</Text>
                  </View>
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
                    <Text style={styles.ctaText}>[{t("batches.preInviteCta")}]</Text>
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
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  scrollShare: { padding: 20, paddingBottom: 40 },
  brandRow: { alignItems: "center", marginTop: 10, marginBottom: 10 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(232,197,71,0.55)",
  },
  logo: { width: "100%", height: "100%" },
  brandSub: { fontSize: 10, color: TEXT_MUTED, marginTop: 6, letterSpacing: 1 },
  screenTitle: {
    fontSize: 18,
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
  contextLabel: { fontSize: 13, color: TEXT_MUTED, marginBottom: 8, textAlign: "center" },
  twoCards: { flexDirection: "row", gap: 10, marginBottom: 22 },
  goldCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  goldCardLabel: { fontSize: 11, fontWeight: "800", color: BG, letterSpacing: 0.5, textAlign: "center" },
  goldCardBig: { fontSize: 20, fontWeight: "900", color: BG, marginTop: 6, textAlign: "center" },
  goldCardPiece: { fontSize: 13, color: BG, marginTop: 6, textAlign: "center", fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: GOLD, marginBottom: 12, textAlign: "center" },
  valueRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  valueCardLeft: {
    flex: 1,
    backgroundColor: BG_ELEV,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.35)",
    padding: 12,
    alignItems: "center",
  },
  valueCardRight: {
    flex: 1,
    backgroundColor: BG_ELEV,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(232, 197, 71, 0.35)",
    padding: 0,
    overflow: "hidden",
    alignItems: "center",
  },
  valueCardLabel: { fontSize: 10, fontWeight: "800", color: GOLD, marginBottom: 8, textAlign: "center" },
  unitInputWrap: { width: "100%", paddingHorizontal: 4 },
  unitBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BG_ELEV,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: GOLD,
  },
  rs: { fontSize: 16, fontWeight: "800", color: GOLD, marginRight: 4 },
  unitInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: GOLD,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
  },
  unitHint: { fontSize: 10, color: TEXT_MUTED, marginTop: 8, textAlign: "center" },
  calcHead: {
    width: "100%",
    backgroundColor: "#6B7280",
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  calcHeadText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.4 },
  totalHuge: { fontSize: 20, fontWeight: "900", color: GOLD, marginTop: 12, textAlign: "center", paddingHorizontal: 6 },
  totalSub: { fontSize: 11, color: GOLD, marginTop: 4, textAlign: "center", fontWeight: "700" },
  breakLine: { fontSize: 10, color: GOLD, marginTop: 6, textAlign: "center", marginBottom: 10 },
  footnote: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontStyle: "italic",
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "700",
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
  ctaText: { fontSize: 12, fontWeight: "900", color: BG, textAlign: "center", flex: 1, paddingRight: 10 },
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
