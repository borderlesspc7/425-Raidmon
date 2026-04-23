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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { paths } from "../../routes/paths";
import { getBatchesLinkedToWorkshop } from "../../services/batchService";
import { callWorkshopBatchAction } from "../../services/workshopBatchFunctions";
import type { Batch, ProductionFlowStatus } from "../../types/batch";

function formatDateOnly(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function statusLabel(
  t: (k: string) => string,
  flow: ProductionFlowStatus | undefined,
  isLate: boolean,
) {
  if (isLate) return t("workshopProduction.statusRed");
  if (flow === "ready_for_pickup") return t("workshopProduction.statusGreen");
  if (flow === "partial" || flow === "paused")
    return t("workshopProduction.statusOrange");
  return t("workshopProduction.statusYellow");
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isLate(batch: Batch): boolean {
  if (batch.status === "completed" || batch.status === "cancelled") return false;
  if (!batch.deliveryDate) return false;
  return startOfDay(batch.deliveryDate).getTime() < startOfDay(new Date()).getTime();
}

export default function WorkshopProduction() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { navigate } = useNavigation();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const [noteModal, setNoteModal] = useState<"partial" | "pause" | null>(null);
  const [noteBatchId, setNoteBatchId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [partialPieces, setPartialPieces] = useState("");

  const [deliveryModal, setDeliveryModal] = useState<string | null>(null);
  const [deliveryInput, setDeliveryInput] = useState("");

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

  const onReady = async (batch: Batch) => {
    setActing(batch.id);
    try {
      await callWorkshopBatchAction({ batchId: batch.id, action: "ready_for_pickup" });
      Alert.alert(t("common.success"), t("workshopProduction.readySuccess"));
      void load();
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setActing(null);
    }
  };

  const submitNote = async () => {
    if (!noteModal || !noteBatchId) return;
    const bId = noteBatchId;
    setActing(bId);
    try {
      const action = noteModal === "partial" ? "mark_partial" : "mark_pause";
      const payload: Parameters<typeof callWorkshopBatchAction>[0] = {
        batchId: bId,
        action,
        message: noteText,
      };
      if (action === "mark_partial" && partialPieces.trim()) {
        const n = parseInt(partialPieces, 10);
        if (!Number.isNaN(n) && n > 0) payload.partialPiecesDone = n;
      }
      await callWorkshopBatchAction(payload);
      setNoteModal(null);
      setNoteBatchId(null);
      setNoteText("");
      setPartialPieces("");
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
    setActing(deliveryModal);
    try {
      await callWorkshopBatchAction({
        batchId: deliveryModal,
        action: "set_delivery",
        deliveryDate: d.toISOString(),
      });
      setDeliveryModal(null);
      setDeliveryInput("");
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("workshopProduction.title")}</Text>
        <Text style={styles.sub}>{t("workshopProduction.subtitle")}</Text>

        {batches.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inventory" size={48} color="#D1D5DB" />
            <Text style={styles.muted}>{t("workshopProduction.empty")}</Text>
          </View>
        ) : (
          batches.map((batch) => {
            const late = isLate(batch);
            const flow = batch.productionFlowStatus;
            const busy = acting === batch.id;
            return (
              <View key={batch.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {batch.name}
                  </Text>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: late ? "#FEE2E2" : "#F0F4FF" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: late ? "#B91C1C" : "#6366F1" },
                      ]}
                    >
                      {statusLabel(t, flow, late)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.line}>
                  {t("batches.pieces")}: {batch.totalPieces}
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

                <TouchableOpacity
                  style={styles.deliveryRow}
                  onPress={() => {
                    setDeliveryModal(batch.id);
                    setDeliveryInput(
                      batch.deliveryDate
                        ? formatDateOnly(batch.deliveryDate)
                        : "",
                    );
                  }}
                >
                  <MaterialIcons name="event" size={18} color="#6366F1" />
                  <Text style={styles.deliveryLink}>
                    {t("workshopProduction.editDelivery")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, busy && styles.btnDis]}
                    disabled={busy}
                    onPress={() => onReady(batch)}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>
                        {t("workshopProduction.btnReady")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.btnRow2}>
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => openNoteModal("partial", batch.id)}
                  >
                    <Text style={styles.btnOutlineText}>
                      {t("workshopProduction.btnPartial")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={() => openNoteModal("pause", batch.id)}
                  >
                    <Text style={styles.btnOutlineText}>
                      {t("workshopProduction.btnPause")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!noteModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {noteModal === "partial"
                ? t("workshopProduction.partialTitle")
                : t("workshopProduction.pauseTitle")}
            </Text>
            {noteModal === "partial" ? (
              <TextInput
                style={styles.input}
                value={partialPieces}
                onChangeText={setPartialPieces}
                placeholder={t("workshopProduction.partialQtyPlaceholder")}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            ) : null}
            <TextInput
              style={[styles.input, styles.textArea]}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              placeholder={t("workshopProduction.notePlaceholder")}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => {
                  setNoteModal(null);
                  setNoteBatchId(null);
                }}
              >
                <Text style={styles.btnOutlineText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => void submitNote()}
              >
                <Text style={styles.btnPrimaryText}>{t("common.send")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deliveryModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t("workshopProduction.deliveryTitle")}</Text>
            <TextInput
              style={styles.input}
              value={deliveryInput}
              onChangeText={(x) => setDeliveryInput(formatDateInput(x))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => setDeliveryModal(null)}
              >
                <Text style={styles.btnOutlineText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={onSaveDelivery}>
                <Text style={styles.btnPrimaryText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  sub: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
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
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: "600" },
  line: { fontSize: 14, color: "#4B5563", marginTop: 6 },
  note: { fontSize: 13, color: "#92400E", marginTop: 8, backgroundColor: "#FFFBEB", padding: 8, borderRadius: 8 },
  deliveryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  deliveryLink: { fontSize: 14, color: "#6366F1", fontWeight: "600" },
  btnRow: { marginTop: 12 },
  btnRow2: { flexDirection: "row", gap: 10, marginTop: 10 },
  btnPrimary: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: { backgroundColor: "#FFF", borderRadius: 14, padding: 16, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
