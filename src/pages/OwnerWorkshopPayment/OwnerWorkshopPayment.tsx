import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  TextInput,
  Switch,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import {
  getOwnerBatchCheckoutPreview,
  getOwnerPaymentInvitePreview,
  submitOwnerBatchCheckoutAndCreatePayment,
  type OwnerBatchCheckoutPreview,
  type OwnerPaymentInvitePreview,
} from "../../services/ownerWorkshopPayFunctions";
import { createAsaasChargeForPayment } from "../../services/asaasPayments";
import { MARKETPLACE_FEE_PERCENT } from "../../constants/marketplaceFee";

function formatMoney(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
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

export default function OwnerWorkshopPayment() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const payNav = navigationParams.ownerWorkshopPay;
  const batchNav = navigationParams.ownerBatchCheckout;

  const [phase, setPhase] = useState<"report" | "pix">(
    payNav?.paymentId ? "pix" : "report",
  );
  const [payId, setPayId] = useState<string | null>(payNav?.paymentId ?? null);
  const [payTok, setPayTok] = useState<string | null>(payNav?.token ?? null);

  const [loadingCheckout, setLoadingCheckout] = useState(!!batchNav);
  const [checkoutPreview, setCheckoutPreview] = useState<OwnerBatchCheckoutPreview | null>(
    null,
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [piecesArrived, setPiecesArrived] = useState("");
  const [defectsYes, setDefectsYes] = useState(false);
  const [defectCount, setDefectCount] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [loadingPix, setLoadingPix] = useState(true);
  const [charging, setCharging] = useState(false);
  const [pixPreview, setPixPreview] = useState<OwnerPaymentInvitePreview | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);

  const loadCheckout = useCallback(async () => {
    if (!batchNav?.batchId || !batchNav?.token) {
      setLoadingCheckout(false);
      return;
    }
    setLoadingCheckout(true);
    setCheckoutError(null);
    try {
      const data = await getOwnerBatchCheckoutPreview(batchNav.batchId, batchNav.token);
      setCheckoutPreview(data);
      const ex = data.existingPayment;
      const cap = data.conferenceMaxPieces ?? data.totalPieces;
      if (
        ex?.paymentId &&
        ex.inviteToken &&
        (ex.status === "pending" || ex.status === "overdue")
      ) {
        setPayId(ex.paymentId);
        setPayTok(ex.inviteToken);
        setPhase("pix");
      } else {
        setPiecesArrived(String(cap));
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = String(err?.code || "").replace(/^functions\//, "");
      if (code === "permission-denied") {
        setCheckoutError(t("ownerWorkshopPay.invalidLink"));
      } else {
        setCheckoutError(err?.message || t("ownerWorkshopPay.loadError"));
      }
      setCheckoutPreview(null);
    } finally {
      setLoadingCheckout(false);
    }
  }, [batchNav, t]);

  useEffect(() => {
    if (!user || !batchNav) return;
    void loadCheckout();
  }, [user, batchNav, loadCheckout]);

  useEffect(() => {
    if (!user) return;
    if (payNav?.paymentId && payNav?.token) {
      setPayId(payNav.paymentId);
      setPayTok(payNav.token);
      setPhase("pix");
    }
  }, [user, payNav?.paymentId, payNav?.token]);

  const loadPix = useCallback(async () => {
    const pid = payId;
    const ptok = payTok;
    if (!pid || !ptok) {
      setLoadingPix(false);
      return;
    }
    setLoadingPix(true);
    setPixError(null);
    try {
      let data = await getOwnerPaymentInvitePreview(pid, ptok);
      setPixPreview(data);
      if (!data.hasCharge && data.status === "pending") {
        setCharging(true);
        try {
          try {
            await createAsaasChargeForPayment(pid);
          } catch (e: unknown) {
            const err = e as { code?: string };
            const code = String(err?.code || "").replace(/^functions\//, "");
            if (code !== "already-exists") throw e;
          }
          data = await getOwnerPaymentInvitePreview(pid, ptok);
          setPixPreview(data);
        } catch (e: unknown) {
          const err = e as { message?: string };
          Alert.alert(t("common.error"), err?.message || t("ownerWorkshopPay.chargeError"));
        } finally {
          setCharging(false);
        }
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = String(err?.code || "").replace(/^functions\//, "");
      if (code === "permission-denied") {
        setPixError(t("ownerWorkshopPay.invalidLink"));
      } else {
        setPixError(err?.message || t("ownerWorkshopPay.loadError"));
      }
      setPixPreview(null);
    } finally {
      setLoadingPix(false);
    }
  }, [payId, payTok, t]);

  useEffect(() => {
    if (!user || phase !== "pix" || !payId || !payTok) return;
    void loadPix();
  }, [user, phase, payId, payTok, loadPix]);

  const estimatedBase = useMemo(() => {
    if (!checkoutPreview) return null;
    const pr = parseInt(piecesArrived.replace(/\D/g, ""), 10);
    const dc = defectsYes ? parseInt(defectCount.replace(/\D/g, "") || "0", 10) : 0;
    if (!Number.isFinite(pr) || pr < 0) return null;
    if (!Number.isFinite(dc) || dc < 0) return null;
    if (dc > pr) return null;
    const bill = pr - dc;
    if (bill < 1) return null;
    const cap = checkoutPreview.conferenceMaxPieces ?? checkoutPreview.totalPieces;
    const waveBase = checkoutPreview.checkoutWaveGuaranteedBase;
    if (
      waveBase != null &&
      waveBase > 0 &&
      cap > 0
    ) {
      return Math.round((bill / cap) * waveBase * 100) / 100;
    }
    const { totalPieces, pricePerPiece, guaranteedTotal } = checkoutPreview;
    if (pricePerPiece != null && pricePerPiece > 0) {
      return Math.round(bill * pricePerPiece * 100) / 100;
    }
    if (guaranteedTotal != null && guaranteedTotal > 0 && totalPieces > 0) {
      return Math.round((bill / totalPieces) * guaranteedTotal * 100) / 100;
    }
    return null;
  }, [checkoutPreview, piecesArrived, defectsYes, defectCount]);

  const onSubmitReport = async () => {
    if (!batchNav || !checkoutPreview) return;
    const pr = parseInt(piecesArrived.replace(/\D/g, ""), 10);
    const dc = defectsYes ? parseInt(defectCount.replace(/\D/g, "") || "0", 10) : 0;
    if (!Number.isFinite(pr) || pr < 0) {
      Alert.alert(t("common.error"), t("ownerWorkshopPay.invalidPiecesReceived"));
      return;
    }
    const cap = checkoutPreview.conferenceMaxPieces ?? checkoutPreview.totalPieces;
    if (pr > cap) {
      Alert.alert(t("common.error"), t("ownerWorkshopPay.piecesOverTotal"));
      return;
    }
    if (dc < 0 || dc > pr) {
      Alert.alert(t("common.error"), t("ownerWorkshopPay.invalidDefects"));
      return;
    }
    if (pr - dc < 1) {
      Alert.alert(t("common.error"), t("ownerWorkshopPay.billableZero"));
      return;
    }
    setSubmittingReport(true);
    try {
      const res = await submitOwnerBatchCheckoutAndCreatePayment(
        batchNav.batchId,
        batchNav.token,
        pr,
        dc,
      );
      setPayId(res.paymentId);
      setPayTok(res.token);
      setPhase("pix");
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert(t("common.error"), err?.message || t("ownerWorkshopPay.submitReportError"));
    } finally {
      setSubmittingReport(false);
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

  if (phase === "report" && batchNav) {
    if (loadingCheckout) {
      return (
        <Layout>
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        </Layout>
      );
    }
    if (checkoutError || !checkoutPreview) {
      return (
        <Layout>
          <View style={styles.centerPadded}>
            <MaterialIcons name="error-outline" size={48} color="#DC2626" />
            <Text style={styles.err}>{checkoutError || t("ownerWorkshopPay.loadError")}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigate(paths.dashboard)}>
              <Text style={styles.secondaryBtnText}>{t("batchOffer.backHome")}</Text>
            </TouchableOpacity>
          </View>
        </Layout>
      );
    }

    return (
      <Layout>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t("ownerWorkshopPay.reportTitle")}</Text>
          <Text style={styles.sub}>{t("ownerWorkshopPay.reportSubtitle")}</Text>

          <View style={styles.card}>
            {checkoutPreview.batchName ? (
              <Row label={t("ownerWorkshopPay.batch")} value={checkoutPreview.batchName} />
            ) : null}
            <Row
              label={t("ownerWorkshopPay.batchTotalPieces")}
              value={String(checkoutPreview.totalPieces)}
            />
            {(checkoutPreview.conferenceMaxPieces ??
              checkoutPreview.totalPieces) < checkoutPreview.totalPieces ? (
              <Row
                label={t("ownerWorkshopPay.deliveryCapLabel")}
                value={String(
                  checkoutPreview.conferenceMaxPieces ?? checkoutPreview.totalPieces,
                )}
              />
            ) : null}
            {checkoutPreview.workshopName ? (
              <Row label={t("ownerWorkshopPay.workshop")} value={checkoutPreview.workshopName} />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t("ownerWorkshopPay.piecesArrivedLabel")}</Text>
            <TextInput
              style={styles.input}
              value={piecesArrived}
              onChangeText={setPiecesArrived}
              keyboardType="number-pad"
              placeholder={t("ownerWorkshopPay.piecesArrivedPlaceholder")}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>{t("ownerWorkshopPay.defectsQuestion")}</Text>
              <Switch value={defectsYes} onValueChange={setDefectsYes} />
            </View>
            {defectsYes ? (
              <>
                <Text style={styles.fieldLabel}>{t("ownerWorkshopPay.defectsCountLabel")}</Text>
                <TextInput
                  style={styles.input}
                  value={defectCount}
                  onChangeText={setDefectCount}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </>
            ) : null}
            {estimatedBase != null ? (
              <Text style={styles.estimate}>
                {t("ownerWorkshopPay.estimatedService")}
                {formatMoney(estimatedBase)}
                {" · "}
                {t("ownerWorkshopPay.estimatedWithFee").replace(
                  "{pct}",
                  String(MARKETPLACE_FEE_PERCENT),
                )}
                {formatMoney(
                  Math.round(estimatedBase * (1 + MARKETPLACE_FEE_PERCENT / 100) * 100) / 100,
                )}
              </Text>
            ) : null}
            <Text style={styles.feeHintSmall}>
              {t("ownerWorkshopPay.feeHint").replace(
                "{pct}",
                String(checkoutPreview.platformFeePercent),
              )}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.copyBtn, submittingReport && { opacity: 0.6 }]}
            disabled={submittingReport}
            onPress={() => void onSubmitReport()}
          >
            {submittingReport ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.copyBtnText}>{t("ownerWorkshopPay.payBatch")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.outline} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.outlineText}>{t("common.back")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Layout>
    );
  }

  if (!payId || !payTok) {
    return (
      <Layout>
        <View style={styles.centerPadded}>
          <Text style={styles.err}>{t("ownerWorkshopPay.missingParams")}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.secondaryBtnText}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  if (loadingPix && !pixPreview) {
    return (
      <Layout>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Layout>
    );
  }

  if (pixError && !pixPreview) {
    return (
      <Layout>
        <View style={styles.centerPadded}>
          <MaterialIcons name="error-outline" size={48} color="#DC2626" />
          <Text style={styles.err}>{pixError}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigate(paths.dashboard)}>
            <Text style={styles.secondaryBtnText}>{t("batchOffer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </Layout>
    );
  }

  if (!pixPreview) return null;

  const preview = pixPreview;
  const pix = preview.pixCopyPaste;
  const qrUri = preview.pixEncodedImage
    ? preview.pixEncodedImage.startsWith("data:")
      ? preview.pixEncodedImage
      : `data:image/png;base64,${preview.pixEncodedImage}`
    : null;

  return (
    <Layout>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("ownerWorkshopPay.title")}</Text>
        <Text style={styles.sub}>{t("ownerWorkshopPay.subtitle")}</Text>

        <View style={styles.card}>
          {preview.batchName ? (
            <Row label={t("ownerWorkshopPay.batch")} value={preview.batchName} />
          ) : null}
          {preview.totalPieces != null ? (
            <Row label={t("ownerWorkshopPay.pieces")} value={String(preview.totalPieces)} />
          ) : null}
          {preview.workshopName ? (
            <Row label={t("ownerWorkshopPay.workshop")} value={preview.workshopName} />
          ) : null}
          <Row label={t("ownerWorkshopPay.amount")} value={formatMoney(preview.amount)} emphasize />
          <Text style={styles.feeHint}>
            {t("ownerWorkshopPay.feeHint").replace(
              "{pct}",
              String(preview.platformFeePercent),
            )}
          </Text>
        </View>

        {charging || (preview.status === "pending" && !preview.hasCharge) ? (
          <View style={styles.pixWait}>
            <ActivityIndicator color="#6366F1" />
            <Text style={styles.muted}>{t("ownerWorkshopPay.generatingPix")}</Text>
          </View>
        ) : preview.status === "paid" ? (
          <Text style={styles.ok}>{t("ownerWorkshopPay.alreadyPaid")}</Text>
        ) : pix ? (
          <>
            {qrUri ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" />
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(pix);
                Alert.alert(t("common.success"), t("ownerWorkshopPay.copied"));
              }}
            >
              <MaterialIcons name="content-copy" size={20} color="#FFF" />
              <Text style={styles.copyBtnText}>{t("ownerWorkshopPay.copyPix")}</Text>
            </TouchableOpacity>
            {preview.asaasInvoiceUrl ? (
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => Linking.openURL(preview.asaasInvoiceUrl!)}
              >
                <Text style={styles.linkBtnText}>{t("ownerWorkshopPay.openInvoice")}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <Text style={styles.warn}>{t("ownerWorkshopPay.pixUnavailable")}</Text>
        )}

        <TouchableOpacity style={styles.outline} onPress={() => navigate(paths.payments)}>
          <Text style={styles.outlineText}>{t("ownerWorkshopPay.seePayments")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerPadded: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 14, color: "#6B7280" },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  row: { gap: 4 },
  rowLabel: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  rowValue: { fontSize: 16, color: "#111827" },
  rowValueEm: { fontWeight: "800", color: "#6366F1", fontSize: 18 },
  fieldLabel: { fontSize: 14, fontWeight: "700", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#FAFAFA",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  estimate: { fontSize: 14, color: "#111827", marginTop: 8, fontWeight: "600" },
  feeHintSmall: { fontSize: 12, color: "#6B7280", marginTop: 6 },
  feeHint: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  pixWait: { alignItems: "center", gap: 8, paddingVertical: 16 },
  muted: { color: "#6B7280", fontSize: 14 },
  qrWrap: { alignItems: "center", backgroundColor: "#FFF", padding: 12, borderRadius: 12 },
  qr: { width: 220, height: 220 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 10,
  },
  copyBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  linkBtn: { alignItems: "center", paddingVertical: 12 },
  linkBtnText: { color: "#6366F1", fontWeight: "700", fontSize: 15 },
  outline: { marginTop: 8, padding: 12, alignItems: "center" },
  outlineText: { color: "#6366F1", fontWeight: "600" },
  err: { marginTop: 12, fontSize: 15, color: "#991B1B", textAlign: "center" },
  secondaryBtn: { marginTop: 16, paddingVertical: 12 },
  secondaryBtnText: { color: "#6366F1", fontWeight: "600" },
  ok: { fontSize: 15, color: "#166534", fontWeight: "600" },
  warn: { fontSize: 14, color: "#B45309" },
});
