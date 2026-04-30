import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import { useTheme } from "../../hooks/useTheme";
import { getBatchesLinkedToWorkshop } from "../../services/batchService";
import { callWorkshopBatchAction } from "../../services/workshopBatchFunctions";
import { completeBatchAndInviteOwnerCheckout } from "../../services/ownerWorkshopPayFunctions";
import { buildOwnerBatchCheckoutShareUrl } from "../../utils/appDeepLink";
import type { Batch } from "../../types/batch";
import { authService } from "../../services/authService";
import {
  BATCH_PRODUCTION_COLORS,
  getBatchProductionPillColors,
  isBatchDeliveryLate,
} from "../../utils/batchProductionStatusStyle";

function formatDateOnly(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
}

function batchRemainingContractPieces(batch: Batch): number {
  const T = batch.totalPieces;
  const cum = batch.piecesDeliveredCumulative ?? 0;
  return Math.max(0, T - cum);
}

/** Valor base desta entrega (parcial) ou do lote inteiro. */
function batchBaseAmount(batch: Batch): number | null {
  const rem = batchRemainingContractPieces(batch);
  if (rem <= 0) return null;
  if (
    batch.productionFlowStatus === "partial" &&
    typeof batch.partialPiecesDone === "number" &&
    Number.isFinite(batch.partialPiecesDone) &&
    batch.partialPiecesDone > 0
  ) {
    const n = batch.partialPiecesDone;
    const gt = batch.guaranteedTotal;
    if (typeof gt === "number" && Number.isFinite(gt) && gt > 0) {
      return Math.round((n / rem) * gt * 100) / 100;
    }
    const p = batch.pricePerPiece;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) {
      return Math.round(p * n * 100) / 100;
    }
    return null;
  }
  const gt = batch.guaranteedTotal;
  if (typeof gt === "number" && Number.isFinite(gt) && gt > 0) {
    return Math.round(gt * 100) / 100;
  }
  const p = batch.pricePerPiece;
  const n = batch.totalPieces;
  if (
    typeof p === "number" &&
    Number.isFinite(p) &&
    p > 0 &&
    typeof n === "number" &&
    Number.isFinite(n) &&
    n > 0
  ) {
    return Math.round(p * n * 100) / 100;
  }
  return null;
}

const SHARE_LINK_FONT =
  Platform.OS === "ios" ? "Menlo" : "monospace";

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export default function WorkshopProduction() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate, navigationParams } = useNavigation();
  const { theme } = useTheme();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const [noteModal, setNoteModal] = useState<"partial" | "pause" | null>(null);
  const [noteBatchId, setNoteBatchId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [partialPieces, setPartialPieces] = useState("");

  const [deliveryModal, setDeliveryModal] = useState<string | null>(null);
  const [deliveryInput, setDeliveryInput] = useState("");

  const [detailBatch, setDetailBatch] = useState<Batch | null>(null);
  const [shareInfo, setShareInfo] = useState<{
    url: string;
    batch: Batch;
  } | null>(null);
  const [shareLinkJustCopied, setShareLinkJustCopied] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [photoPreviewUri, setPhotoPreviewUri] = useState<string | null>(null);
  const [detailOwnerPhoto, setDetailOwnerPhoto] = useState<string | null>(null);
  const [detailWorkshopPhoto, setDetailWorkshopPhoto] = useState<string | null>(null);

  const acceptedInviteBatches = batches.filter(
    (b) => b.acceptedFromOwnerInvite && b.linkedWorkshopUserId === user?.id,
  );
  const acceptedInviteInfoOnly = acceptedInviteBatches.filter(
    (ab) => !batches.some((b) => b.id === ab.id),
  );

  const focusBatchId = navigationParams.workshopFocusBatchId;

  useEffect(() => {
    if (!focusBatchId || batches.length === 0) return;
    const b = batches.find((x) => x.id === focusBatchId);
    if (b) {
      setDetailBatch(b);
    }
    navigate(paths.workshopProduction, {});
  }, [focusBatchId, batches, navigate]);

  const load = useCallback(async () => {
    if (!user?.id || user.userType !== "workshop") {
      setBatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getBatchesLinkedToWorkshop(user.id);
      setBatches(
        data.filter(
          (b) => b.status === "in_progress" || b.status === "pending",
        ),
      );
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!detailBatch) {
      setDetailOwnerPhoto(null);
      setDetailWorkshopPhoto(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const [owner, workshop] = await Promise.all([
          detailBatch.userId ? authService.getUserById(detailBatch.userId) : Promise.resolve(null),
          detailBatch.linkedWorkshopUserId
            ? authService.getUserById(detailBatch.linkedWorkshopUserId)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setDetailOwnerPhoto(owner?.photoURL || null);
        setDetailWorkshopPhoto(workshop?.photoURL || null);
      } catch {
        if (cancelled) return;
        setDetailOwnerPhoto(null);
        setDetailWorkshopPhoto(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [detailBatch]);

  const submitNote = async () => {
    if (!noteModal || !noteBatchId) return;
    const bId = noteBatchId;
    const batchRef = batches.find((x) => x.id === bId);
    const action = noteModal === "partial" ? "mark_partial" : "mark_pause";
    if (action === "mark_partial") {
      const rem = batchRef ? batchRemainingContractPieces(batchRef) : 0;
      const n = parseInt(partialPieces.replace(/\D/g, ""), 10);
      if (!Number.isFinite(n) || n < 1 || n > rem || rem < 1) {
        Alert.alert(
          t("common.error"),
          t("workshopProduction.partialQtyInvalid").replace("{max}", String(Math.max(0, rem))),
        );
        return;
      }
    }
    setActing(bId);
    try {
      const payload: Parameters<typeof callWorkshopBatchAction>[0] = {
        batchId: bId,
        action,
        message: noteText,
      };
      if (action === "mark_partial") {
        payload.partialPiecesDone = parseInt(partialPieces.replace(/\D/g, ""), 10);
      }
      await callWorkshopBatchAction(payload);
      setNoteModal(null);
      setNoteBatchId(null);
      setNoteText("");
      setPartialPieces("");
      setDetailBatch((d) => (d?.id === bId ? null : d));
      Alert.alert(t("common.success"), t("workshopProduction.noteSuccess"));
      void load();
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setActing(null);
    }
  };

  const openNoteModal = (type: "partial" | "pause", batchId: string) => {
    setNoteBatchId(batchId);
    setNoteText("");
    setPartialPieces("");
    setNoteModal(type);
  };

  const onSaveDelivery = async () => {
    if (!deliveryModal) return;
    const parts = deliveryInput.split("/");
    if (parts.length !== 3) {
      Alert.alert(t("common.error"), t("workshopProduction.dateInvalid"));
      return;
    }
    const [dd, mm, yy] = parts.map((x) => parseInt(x, 10));
    const d = new Date(yy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) {
      Alert.alert(t("common.error"), t("workshopProduction.dateInvalid"));
      return;
    }
    const today = new Date();
    const startDelivery = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (startDelivery < startToday) {
      Alert.alert(t("common.error"), t("batches.deliveryDateMinToday"));
      return;
    }
    const bId = deliveryModal;
    setActing(bId);
    try {
      await callWorkshopBatchAction({
        batchId: bId,
        action: "set_delivery",
        deliveryDate: d.toISOString(),
      });
      setDeliveryModal(null);
      setDeliveryInput("");
      setDetailBatch((cur) =>
        cur?.id === bId
          ? { ...cur, deliveryDate: d }
          : cur,
      );
      Alert.alert(t("common.success"), t("workshopProduction.deliverySaved"));
      void load();
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setActing(null);
    }
  };

  const formatDateInput = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4)
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const promptCompleteProduction = (batch: Batch) => {
    const partialFlow = batch.productionFlowStatus === "partial";
    Alert.alert(
      t("workshopProduction.completeConfirmTitle"),
      partialFlow
        ? t("workshopProduction.completeConfirmBodyPartial")
        : t("workshopProduction.completeConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("workshopProduction.completeConfirmOk"),
          style: "default",
          onPress: () => void runCompleteProduction(batch),
        },
      ],
    );
  };

  const runCompleteProduction = async (batch: Batch) => {
    setActing(batch.id);
    try {
      const res = await completeBatchAndInviteOwnerCheckout(batch.id);
      if (!res.token) {
        throw new Error(t("workshopProduction.completeMissingToken"));
      }
      const url = buildOwnerBatchCheckoutShareUrl(res.batchId, res.token);
      setShareInfo({
        url,
        batch,
      });
      setDetailBatch(null);
      Alert.alert(t("common.success"), t("workshopProduction.completeSuccess"));
      void load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      Alert.alert(t("common.error"), err?.message || String(e));
    } finally {
      setActing(null);
    }
  };

  const copySharePaymentLink = async () => {
    if (!shareInfo) return;
    try {
      await Clipboard.setStringAsync(shareInfo.url);
      setShareLinkJustCopied(true);
      setTimeout(() => setShareLinkJustCopied(false), 2200);
    } catch {
      Alert.alert(t("common.error"), t("batches.offerLinkCopyError"));
    }
  };

  const openSharePaymentSheet = async () => {
    if (!shareInfo) return;
    try {
      await Share.share({
        message: shareInfo.url,
        title: t("workshopProduction.sharePaymentTitle"),
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      if (msg.includes("User did not share") || msg.includes("cancel")) return;
      Alert.alert(t("common.error"), t("workshopProduction.shareError"));
    }
  };

  const closeShareModal = () => {
    setShareLinkJustCopied(false);
    setShareInfo(null);
  };

  if (!user || user.userType !== "workshop") {
    return (
      <Layout>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("workshopProduction.workshopOnly")}</Text>
          <TouchableOpacity
            style={styles.outline}
            onPress={() => navigate(paths.dashboard)}
          >
            <Text style={styles.outlineText}>{t("batchOffer.backHome")}</Text>
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

  return (
    <Layout>
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t("workshopProduction.title")}</Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>{t("workshopProduction.subtitle")}</Text>

        <View style={[styles.legendBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
          <TouchableOpacity style={styles.legendHeader} onPress={() => setLegendExpanded((v) => !v)}>
            <Text style={[styles.legendTitle, { color: theme.colors.text }]}>{t("workshopProduction.legendTitle")}</Text>
            <MaterialIcons
              name={legendExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={22}
              color={theme.colors.text}
            />
          </TouchableOpacity>
          {legendExpanded ? (
            <>
              <LegendRow
                color={BATCH_PRODUCTION_COLORS.late.fg}
                label={t("workshopProduction.legendRed")}
              />
              <LegendRow
                color={BATCH_PRODUCTION_COLORS.green.fg}
                label={t("workshopProduction.legendGreen")}
              />
              <LegendRow
                color={BATCH_PRODUCTION_COLORS.yellow.fg}
                label={t("workshopProduction.legendYellow")}
              />
              <LegendRow
                color={BATCH_PRODUCTION_COLORS.orange.fg}
                label={t("workshopProduction.legendOrange")}
              />
            </>
          ) : null}
        </View>

        {acceptedInviteInfoOnly.length > 0 ? (
          <View style={styles.acceptedSection}>
            <Text style={styles.acceptedSectionTitle}>
              {t("workshopProduction.acceptedInvitesTitle")}
            </Text>
            {acceptedInviteInfoOnly.map((batch) => (
              <View key={`accepted-${batch.id}`} style={[styles.acceptedCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.acceptedHeader}>
                  <MaterialIcons name="chat" size={16} color="#4F46E5" />
                  <Text style={styles.acceptedHeaderText}>
                    {t("workshopProduction.acceptedFromWhatsapp")}
                  </Text>
                </View>
                <Text style={styles.acceptedBatchName}>{batch.name}</Text>
                <Text style={styles.acceptedMeta}>
                  {t("workshopProduction.acceptedOwnerLabel")}{" "}
                  {batch.ownerName || "—"}
                </Text>
                <Text style={styles.acceptedMeta}>
                  {t("workshopProduction.acceptedPiecesLabel")} {batch.totalPieces}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {batches.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inventory" size={48} color="#D1D5DB" />
            <Text style={styles.muted}>{t("workshopProduction.empty")}</Text>
          </View>
        ) : (
          batches.map((batch) => {
            const flow = batch.productionFlowStatus;
            const late = isBatchDeliveryLate(batch);
            const busy = acting === batch.id;
            const pill = getBatchProductionPillColors(batch);
            const cardBorder = {
              borderLeftWidth: 4,
              borderLeftColor: pill.fg,
            };
            return (
              <View key={batch.id} style={[styles.card, cardBorder, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() =>
                    navigate(paths.workshopBatchHub, {
                      workshopBatchHub: { batchId: batch.id },
                    })
                  }
                  disabled={busy}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {batch.name}
                    </Text>
                    <View
                      style={[styles.statusDot, { backgroundColor: pill.fg }]}
                      accessibilityLabel={t("workshopProduction.statusDotA11y")}
                    />
                  </View>
                  <Text style={[styles.line, { color: theme.colors.textMuted }]}>
                    {t("batches.pieces")}: {batch.totalPieces}
                    {(batch.piecesDeliveredCumulative ?? 0) > 0 ? (
                      <Text style={styles.lineMuted}>
                        {" "}
                        ({t("workshopProduction.piecesAlreadyDelivered")}:{" "}
                        {batch.piecesDeliveredCumulative})
                      </Text>
                    ) : null}
                  </Text>
                  {batch.deliveryDate ? (
                    <Text style={styles.line}>
                      {t("batches.deliveryDate")}: {formatDateOnly(batch.deliveryDate)}
                    </Text>
                  ) : null}
                  {flow === "partial" || flow === "paused" ? (
                    <Text style={styles.note} numberOfLines={4}>
                      {batch.productionNote}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => setDetailBatch(batch)}
                  disabled={busy}
                >
                  <Text style={styles.detailsBtnText}>{t("workshopProduction.details")}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!detailBatch} transparent animationType="fade">
          <View style={[styles.modalBg, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalBox, styles.detailModalBox, { backgroundColor: theme.colors.surface }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {detailBatch ? (
                <>
                  <View style={styles.detailTop}>
                    <Text style={styles.modalTitlePadded}>{detailBatch.name}</Text>
                    <View style={styles.avatarStack}>
                      <View style={[styles.overlapAvatar, styles.avatarBack]}>
                        {detailOwnerPhoto ? (
                          <Image source={{ uri: detailOwnerPhoto }} style={styles.overlapAvatarImg} />
                        ) : (
                          <MaterialIcons name="person" size={16} color="#6B7280" />
                        )}
                      </View>
                      <View style={[styles.overlapAvatar, styles.avatarFront]}>
                        {detailWorkshopPhoto ? (
                          <Image source={{ uri: detailWorkshopPhoto }} style={styles.overlapAvatarImg} />
                        ) : (
                          <MaterialIcons name="business" size={16} color="#6B7280" />
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.detailMeta}>
                    {t("batches.pieces")}: {detailBatch.totalPieces}
                  </Text>
                  {batchBaseAmount(detailBatch) != null ? (
                    <Text style={styles.detailMeta}>
                      {t("workshopProduction.detailBaseValue")}:{" "}
                      {formatMoney(batchBaseAmount(detailBatch)!)}
                    </Text>
                  ) : null}
                  <Text style={styles.detailFeeNote}>
                    {t("workshopProduction.detailFeeNote")}
                  </Text>
                  {detailBatch.deliveryDate ? (
                    <Text style={styles.detailMeta}>
                      {t("batches.deliveryDate")}:{" "}
                      {formatDateOnly(detailBatch.deliveryDate)}
                    </Text>
                  ) : null}
                  {detailBatch.observations ? (
                    <View style={styles.detailObs}>
                      <Text style={styles.detailObsLabel}>
                        {t("workshopProduction.detailBatchObs")}
                      </Text>
                      <Text style={styles.detailObsText}>{detailBatch.observations}</Text>
                    </View>
                  ) : null}
                  {(detailBatch.productionFlowStatus === "partial" ||
                    detailBatch.productionFlowStatus === "paused") &&
                  detailBatch.productionNote ? (
                    <Text style={styles.note}>{detailBatch.productionNote}</Text>
                  ) : null}
                  {detailBatch.defectPhotoUrlsLatest && detailBatch.defectPhotoUrlsLatest.length > 0 ? (
                    <View style={styles.detailObs}>
                      <Text style={styles.detailObsLabel}>Fotos de defeitos enviadas pelo dono</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.defectPhotoRow}>
                        {detailBatch.defectPhotoUrlsLatest.map((u) => (
                          <TouchableOpacity key={u} onPress={() => setPhotoPreviewUri(u)}>
                            <Image source={{ uri: u }} style={styles.defectPhotoThumb} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.modalLinkRow}
                    onPress={() => {
                      const deliveryEditLocked =
                        !!detailBatch.deliveryDate &&
                        (detailBatch.workshopDeliveryDateEditCount ?? 0) >= 1;
                      if (deliveryEditLocked) {
                        Alert.alert(
                          t("common.info"),
                          "A data de entrega ja foi alterada uma vez e nao pode ser editada novamente.",
                        );
                        return;
                      }
                      setDeliveryModal(detailBatch.id);
                      setDeliveryInput(
                        detailBatch.deliveryDate
                          ? formatDateOnly(detailBatch.deliveryDate)
                          : "",
                      );
                    }}
                    disabled={
                      !!detailBatch.deliveryDate &&
                      (detailBatch.workshopDeliveryDateEditCount ?? 0) >= 1
                    }
                  >
                    <MaterialIcons
                      name="event"
                      size={18}
                      color={
                        !!detailBatch.deliveryDate &&
                        (detailBatch.workshopDeliveryDateEditCount ?? 0) >= 1
                          ? "#9CA3AF"
                          : "#6366F1"
                      }
                    />
                    <Text style={styles.deliveryLink}>
                      {t("workshopProduction.editDelivery")}
                    </Text>
                  </TouchableOpacity>
                  {!!detailBatch.deliveryDate &&
                  (detailBatch.workshopDeliveryDateEditCount ?? 0) >= 1 ? (
                    <Text style={styles.deliveryLockText}>
                      Voce ja usou a unica edicao permitida da data de entrega.
                    </Text>
                  ) : null}

                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={styles.btnOutline}
                      onPress={() => {
                        const id = detailBatch.id;
                        setDetailBatch(null);
                        openNoteModal("partial", id);
                      }}
                    >
                      <Text style={styles.btnOutlineText}>
                        {t("workshopProduction.btnPartial")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnOutline}
                      onPress={() => {
                        const id = detailBatch.id;
                        setDetailBatch(null);
                        openNoteModal("pause", id);
                      }}
                    >
                      <Text style={styles.btnOutlineText}>
                        {t("workshopProduction.btnPause")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.btnPrimary,
                      acting === detailBatch.id && styles.btnDis,
                    ]}
                    disabled={acting === detailBatch.id}
                    onPress={() => promptCompleteProduction(detailBatch)}
                  >
                    {acting === detailBatch.id ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>
                        {t("workshopProduction.btnCompleteProduction")}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setDetailBatch(null)}
                  >
                    <Text style={styles.modalCloseText}>{t("common.back")}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!noteModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, styles.formModalBox]}>
            <View style={styles.formModalHeader}>
              <View style={styles.formModalIcon}>
                <MaterialIcons
                  name={noteModal === "partial" ? "inventory-2" : "pause-circle-outline"}
                  size={20}
                  color="#4F46E5"
                />
              </View>
              <Text style={styles.modalTitle}>
                {noteModal === "partial"
                  ? t("workshopProduction.partialTitle")
                  : t("workshopProduction.pauseTitle")}
              </Text>
            </View>
            <Text style={styles.modalSubText}>
              {noteModal === "partial"
                ? "Informe a quantidade e uma observacao para o dono."
                : "Descreva o motivo da pausa e a previsao de retorno."}
            </Text>
            {noteModal === "partial" ? (
              <View style={styles.formFieldBlock}>
                <Text style={styles.formFieldLabel}>Quantidade da entrega parcial</Text>
                <TextInput
                  style={styles.input}
                  value={partialPieces}
                  onChangeText={setPartialPieces}
                  placeholder={t("workshopProduction.partialQtyPlaceholder")}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            ) : null}
            <View style={styles.formFieldBlock}>
              <Text style={styles.formFieldLabel}>Mensagem para o dono</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                placeholder={t("workshopProduction.notePlaceholder")}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.formBtnOutline}
                onPress={() => {
                  setNoteModal(null);
                  setNoteBatchId(null);
                }}
              >
                <Text style={styles.formBtnOutlineText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formBtnPrimary}
                onPress={() => void submitNote()}
              >
                <Text style={styles.formBtnPrimaryText}>{t("common.send")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deliveryModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, styles.formModalBox]}>
            <View style={styles.formModalHeader}>
              <View style={styles.formModalIcon}>
                <MaterialIcons name="event" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.modalTitle}>{t("workshopProduction.deliveryTitle")}</Text>
            </View>
            <Text style={styles.modalSubText}>
              Informe uma data igual ou posterior a hoje.
            </Text>
            <View style={styles.formFieldBlock}>
              <Text style={styles.formFieldLabel}>Data de entrega</Text>
              <TextInput
                style={styles.input}
                value={deliveryInput}
                onChangeText={(x) => setDeliveryInput(formatDateInput(x))}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.formBtnOutline}
                onPress={() => setDeliveryModal(null)}
              >
                <Text style={styles.formBtnOutlineText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formBtnPrimary} onPress={onSaveDelivery}>
                <Text style={styles.formBtnPrimaryText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!shareInfo}
        transparent
        animationType="fade"
        onRequestClose={closeShareModal}
      >
        <TouchableOpacity
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={closeShareModal}
        >
          <TouchableOpacity
            style={styles.shareModalCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            {shareInfo ? (() => {
              const payBase = batchBaseAmount(shareInfo.batch);
              return (
              <>
                <View style={styles.shareModalHeader}>
                  <View style={styles.shareModalIconWrap}>
                    <MaterialIcons name="payments" size={24} color="#4F46E5" />
                  </View>
                  <View style={styles.shareModalHeaderText}>
                    <Text style={styles.shareModalTitleText} numberOfLines={2}>
                      {t("workshopProduction.shareModalTitle")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeShareModal}
                    style={styles.shareModalCloseBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                  >
                    <MaterialIcons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View style={styles.shareModalMeta}>
                  <Text style={styles.shareModalMetaLine} numberOfLines={2}>
                    <Text style={styles.shareModalMetaLabel}>{t("ownerWorkshopPay.batch")}: </Text>
                    {shareInfo.batch.name}
                  </Text>
                  <Text style={styles.shareModalMetaSub}>
                    {t("batches.pieces")}: {shareInfo.batch.totalPieces}
                    {payBase != null
                      ? ` · ${t("workshopProduction.detailBaseValue")}: ${formatMoney(payBase)}`
                      : ""}
                  </Text>
                </View>
                <Text style={styles.shareHint}>{t("workshopProduction.shareAfterReportHint")}</Text>
                <View style={styles.shareLinkBox}>
                  <View style={styles.shareLinkBoxHeader}>
                    <MaterialIcons name="insert-link" size={18} color="#4338CA" />
                    <Text style={styles.shareLinkBoxTitle}>
                      {t("workshopProduction.sharePaymentLinkLabel")}
                    </Text>
                  </View>
                  <Text style={styles.shareLinkUrl} selectable numberOfLines={6}>
                    {shareInfo.url}
                  </Text>
                  {shareLinkJustCopied ? (
                    <View style={styles.shareCopiedPill}>
                      <MaterialIcons name="check-circle" size={16} color="#059669" />
                      <Text style={styles.shareCopiedPillText}>{t("common.linkCopied")}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.shareActionsRow}>
                  <TouchableOpacity style={styles.shareBtnOutline} onPress={copySharePaymentLink}>
                    <MaterialIcons name="content-copy" size={18} color="#4F46E5" />
                    <Text style={styles.shareBtnOutlineText}>
                      {t("batches.offerCopyLink")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareBtnPrimary} onPress={openSharePaymentSheet}>
                    <MaterialIcons name="share" size={20} color="#FFF" />
                    <Text style={styles.shareBtnPrimaryText}>{t("common.share")}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.shareModalBack} onPress={closeShareModal}>
                  <Text style={styles.modalCloseText}>{t("common.back")}</Text>
                </TouchableOpacity>
              </>
              );
            })() : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!photoPreviewUri} transparent animationType="fade" onRequestClose={() => setPhotoPreviewUri(null)}>
        <View style={styles.shareModalOverlay}>
          <TouchableOpacity style={styles.photoPreviewClose} onPress={() => setPhotoPreviewUri(null)}>
            <MaterialIcons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          {photoPreviewUri ? (
            <Image source={{ uri: photoPreviewUri }} style={styles.photoPreviewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 14, color: "#6B7280", marginBottom: 4 },
  legendBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
    marginBottom: 4,
  },
  legendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendTitle: { fontSize: 13, fontWeight: "800", color: "#111827" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 13, color: "#4B5563" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  muted: { color: "#6B7280", textAlign: "center" },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 4,
  },
  acceptedSection: {
    marginBottom: 10,
    gap: 10,
  },
  acceptedSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  acceptedCard: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  acceptedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  acceptedHeaderText: {
    fontSize: 12,
    color: "#4338CA",
    fontWeight: "700",
  },
  acceptedBatchName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  acceptedMeta: {
    fontSize: 13,
    color: "#4B5563",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  line: { fontSize: 14, color: "#4B5563", marginTop: 6 },
  lineMuted: { fontSize: 13, color: "#6B7280" },
  note: { fontSize: 13, color: "#92400E", marginTop: 8, backgroundColor: "#FFFBEB", padding: 8, borderRadius: 8 },
  detailsBtn: {
    marginTop: 14,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  detailsBtnText: { fontSize: 15, color: "#6366F1", fontWeight: "700" },
  btnRow: { marginTop: 12 },
  btnRow2: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnPrimary: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  btnDis: { opacity: 0.5 },
  btnPrimaryText: { color: "#FFF", fontWeight: "700" },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnOutlineText: { color: "#6366F1", fontWeight: "700" },
  outline: { marginTop: 12, padding: 12 },
  outlineText: { color: "#6366F1", fontWeight: "600" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  formModalBox: { gap: 12 },
  formModalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  formModalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubText: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
  detailModalBox: { maxHeight: "85%" },
  detailTop: { position: "relative", minHeight: 42, justifyContent: "center" },
  modalTitlePadded: { fontSize: 17, fontWeight: "800", color: "#111827", paddingRight: 86 },
  avatarStack: { position: "absolute", right: 0, top: 0, width: 68, height: 40 },
  overlapAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "absolute",
  },
  avatarBack: { left: 0, top: 4, zIndex: 1 },
  avatarFront: { right: 0, top: 0, zIndex: 2 },
  overlapAvatarImg: { width: "100%", height: "100%" },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  detailMeta: { fontSize: 14, color: "#4B5563" },
  detailFeeNote: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  detailObs: { marginTop: 10, gap: 4 },
  detailObsLabel: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  detailObsText: { fontSize: 14, color: "#374151", lineHeight: 20 },
  defectPhotoRow: { gap: 8, paddingVertical: 4 },
  defectPhotoThumb: { width: 78, height: 78, borderRadius: 8, backgroundColor: "#E5E7EB" },
  modalLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  deliveryLink: { fontSize: 14, color: "#6366F1", fontWeight: "600" },
  deliveryLockText: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  detailActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalClose: { alignItems: "center", paddingVertical: 8, marginTop: 4 },
  modalCloseText: { color: "#6B7280", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
  },
  formFieldBlock: { gap: 6 },
  formFieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  formBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  formBtnOutlineText: { color: "#475569", fontWeight: "700", fontSize: 14 },
  formBtnPrimary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
  },
  formBtnPrimaryText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  shareModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  shareModalCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    gap: 10,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
    maxHeight: "90%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  shareModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  shareModalHeaderText: { flex: 1, minWidth: 0 },
  shareModalTitleText: { fontSize: 17, fontWeight: "800", color: "#111827" },
  shareModalCloseBtn: { padding: 4 },
  shareModalMeta: { gap: 4 },
  shareModalMetaLine: { fontSize: 15, color: "#111827", lineHeight: 22 },
  shareModalMetaLabel: { fontWeight: "700", color: "#4B5563" },
  shareModalMetaSub: { fontSize: 13, color: "#6B7280" },
  shareHint: { fontSize: 13, color: "#4B5563", lineHeight: 18 },
  shareLinkBox: {
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#F5F7FF",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  shareLinkBoxHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareLinkBoxTitle: { fontSize: 13, fontWeight: "700", color: "#3730A3" },
  shareLinkUrl: {
    fontSize: 12,
    lineHeight: 18,
    color: "#1E1B4B",
    fontFamily: SHARE_LINK_FONT,
  },
  shareCopiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  shareCopiedPillText: { fontSize: 12, fontWeight: "700", color: "#047857" },
  shareActionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  shareBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#6366F1",
    backgroundColor: "#FFFFFF",
  },
  shareBtnOutlineText: { color: "#4F46E5", fontWeight: "700", fontSize: 15 },
  shareBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  shareModalBack: { alignItems: "center", paddingVertical: 8, marginTop: 2 },
  photoPreviewClose: { position: "absolute", top: 42, right: 20, zIndex: 3 },
  photoPreviewImage: { width: "92%", height: "82%", alignSelf: "center" },
});
