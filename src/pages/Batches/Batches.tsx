import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
  Share,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigation } from "../../routes/NavigationContext";
import { buildBatchOfferShareUrl } from "../../utils/appDeepLink";
import * as Clipboard from "expo-clipboard";
import {
  createBatch,
  getBatchesByUser,
  updateBatch,
  deleteBatch,
  getBatchStatistics,
  generateBatchInviteToken,
} from "../../services/batchService";
import { Batch, CreateBatchData, BatchStatus } from "../../types/batch";
import { getWorkshopsByUser } from "../../services/workshopService";
import { Workshop } from "../../types/workshop";
import { getCutsByUser } from "../../services/cutService";
import type { Cut } from "../../types/cut";
import {
  canExportRomaneioPdf,
  getEffectiveUserPlan,
} from "../../utils/planEntitlements";
import { shareRomaneioForBatch } from "../../utils/romaneioPdf";
import { getBatchProductionPillColors } from "../../utils/batchProductionStatusStyle";
import OwnerBatchPreInviteModal from "../../components/OwnerBatchPreInviteModal/OwnerBatchPreInviteModal";

function formatMoneyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Mesma regra da lista em Cortes: #N com N = quantidade − índice (mais novo = maior #). */
function getCutListNumber(cuts: Cut[], cutId: string): number | null {
  const idx = cuts.findIndex((c) => c.id === cutId);
  if (idx < 0) return null;
  return cuts.length - idx;
}

function parseBrDateStrict(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return null;
  const [dayStr, monthStr, yearStr] = trimmed.split("/");
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDeliveryDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Cada corte só pode ter um lote (lotes cancelados liberam o corte). */
function findBatchUsingCut(
  batches: Batch[],
  cutId: string,
  excludeBatchId?: string | null,
): Batch | undefined {
  return batches.find(
    (b) =>
      b.cutId === cutId &&
      b.id !== excludeBatchId &&
      b.status !== "cancelled",
  );
}

export default function Batches() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { navigate } = useNavigation();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  // Statistics
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [pendingBatches, setPendingBatches] = useState(0);
  const [inProgressBatches, setInProgressBatches] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);

  // Form state
  const [name, setName] = useState("");
  const [totalPiecesInput, setTotalPiecesInput] = useState("");
  const [status, setStatus] = useState<BatchStatus>("pending");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [observations, setObservations] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutsLoading, setCutsLoading] = useState(false);
  const [cutsDropdownOpen, setCutsDropdownOpen] = useState(false);
  const blurCloseDropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedCutId, setSelectedCutId] = useState<string | null>(null);
  /** Valor total (qtd × preço/peça), exibido em tempo real no Novo Lote */
  const [guaranteedTotalDisplay, setGuaranteedTotalDisplay] = useState("");

  const [offerSummary, setOfferSummary] = useState<{
    visible: boolean;
    step: "agreement" | "share";
    batchId: string;
    workshopName: string;
    inviteUrl: string;
    batchRef: string;
    pieceName: string;
    quantity: number;
    pricePerPiece: number;
    guaranteedTotal: number;
    batchObservations: string;
    cutObservations: string;
  }>({
    visible: false,
    step: "agreement",
    batchId: "",
    workshopName: "",
    inviteUrl: "",
    batchRef: "",
    pieceName: "",
    quantity: 0,
    pricePerPiece: 0,
    guaranteedTotal: 0,
    batchObservations: "",
    cutObservations: "",
  });
  const [offerLinkJustCopied, setOfferLinkJustCopied] = useState(false);

  const [romaneioLoadingId, setRomaneioLoadingId] = useState<string | null>(null);

  const isOwner = user?.userType === "owner";

  useEffect(() => {
    if (user?.id) {
      loadBatches();
      loadWorkshops();
    }
  }, [user]);

  useEffect(() => {
    if (!modalVisible || !user?.id) return;
    let cancelled = false;
    setCutsLoading(true);
    getCutsByUser(user.id)
      .then((data) => {
        if (!cancelled) setCuts(data);
      })
      .catch(() => {
        if (!cancelled) setCuts([]);
      })
      .finally(() => {
        if (!cancelled) setCutsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modalVisible, user?.id]);

  useEffect(() => {
    if (!isOwner) return;
    if (!selectedCutId) {
      setGuaranteedTotalDisplay("");
      return;
    }
    const cut = cuts.find((c) => c.id === selectedCutId);
    if (
      !cut ||
      cut.pricePerPiece == null ||
      !Number.isFinite(cut.pricePerPiece) ||
      cut.pricePerPiece <= 0
    ) {
      setGuaranteedTotalDisplay("");
      return;
    }
    const qty = parseInt(totalPiecesInput, 10);
    if (!totalPiecesInput.trim() || isNaN(qty) || qty <= 0) {
      setGuaranteedTotalDisplay("");
      return;
    }
    const total = Math.round(qty * cut.pricePerPiece * 100) / 100;
    setGuaranteedTotalDisplay(formatMoneyBRL(total));
  }, [totalPiecesInput, selectedCutId, cuts, isOwner]);

  const loadWorkshops = async () => {
    if (!user?.id) return;

    try {
      const data = await getWorkshopsByUser(user.id);
      setWorkshops(data);
    } catch (error: any) {
      console.error("Erro ao carregar oficinas:", error);
    }
  };

  const loadBatches = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [batchesData, stats] = await Promise.all([
        getBatchesByUser(user.id),
        getBatchStatistics(user.id),
      ]);

      setBatches(batchesData);
      setTotalBatches(stats.totalBatches);
      setTotalPieces(stats.totalPieces);
      setPendingBatches(stats.pendingBatches);
      setInProgressBatches(stats.inProgressBatches);
      setCompletedBatches(stats.completedBatches);
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || "Erro ao carregar lotes",
      );
    } finally {
      setLoading(false);
    }
  };

  const openModal = (batch?: Batch) => {
    setCutsDropdownOpen(false);
    if (batch) {
      setEditingBatch(batch);
      setName(batch.name);
      setTotalPiecesInput(batch.totalPieces.toString());
      setSelectedCutId(batch.cutId || null);
      setStatus(batch.status);
      setSelectedWorkshopId(batch.workshopId || "");
      setDeliveryDate(
        batch.deliveryDate
          ? new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(batch.deliveryDate)
          : "",
      );
      setObservations(batch.observations || "");
      if (
        batch.guaranteedTotal != null &&
        Number.isFinite(batch.guaranteedTotal)
      ) {
        setGuaranteedTotalDisplay(formatMoneyBRL(batch.guaranteedTotal));
      } else {
        setGuaranteedTotalDisplay("");
      }
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setCutsDropdownOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingBatch(null);
    setName("");
    setTotalPiecesInput("");
    setStatus("pending");
    setSelectedWorkshopId("");
    setDeliveryDate("");
    setObservations("");
    setErrors({});
    setCutsDropdownOpen(false);
    setSelectedCutId(null);
    setGuaranteedTotalDisplay("");
  };

  const clearBlurCloseTimer = () => {
    if (blurCloseDropdownTimer.current) {
      clearTimeout(blurCloseDropdownTimer.current);
      blurCloseDropdownTimer.current = null;
    }
  };

  const selectCutForBatchName = (cut: Cut) => {
    clearBlurCloseTimer();
    setSelectedCutId(cut.id);
    setName(cut.type);
    const qtyStr = totalPiecesInput.trim();
    const parsed = parseInt(qtyStr, 10);
    if (!qtyStr || isNaN(parsed) || parsed <= 0) {
      setTotalPiecesInput(String(cut.totalPieces));
    }
    setCutsDropdownOpen(false);
    Keyboard.dismiss();
  };

  const handleBatchNameChange = (text: string) => {
    setName(text);
    clearBlurCloseTimer();
    setCutsDropdownOpen(true);
    if (!selectedCutId) return;
    const selectedCut = cuts.find((c) => c.id === selectedCutId);
    if (!selectedCut) {
      setSelectedCutId(null);
      return;
    }
    if (normalizeSearchText(selectedCut.type) !== normalizeSearchText(text)) {
      setSelectedCutId(null);
    }
  };

  const filteredCuts = useMemo(() => {
    const query = normalizeSearchText(name);
    if (!query) return cuts;

    const scored = cuts
      .map((cut) => {
        const typeNorm = normalizeSearchText(cut.type);
        const cutRef = normalizeSearchText(cut.uniqueRef || "");
        const shortId = normalizeSearchText(cut.id.slice(0, 8));
        const listNumber = getCutListNumber(cuts, cut.id);
        const listCode = listNumber != null ? String(listNumber) : "";
        const listHashCode = listCode ? `#${listCode}` : "";

        let score = 0;
        if (typeNorm === query) score += 120;
        else if (typeNorm.startsWith(query)) score += 95;
        else if (typeNorm.includes(query)) score += 75;

        if (listCode === query || listHashCode === query) score += 90;
        else if (listCode.includes(query) || listHashCode.includes(query)) score += 55;

        if (cutRef === query) score += 80;
        else if (cutRef.includes(query)) score += 50;

        if (shortId === query) score += 45;
        else if (shortId.includes(query)) score += 30;

        return { cut, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.cut);
  }, [cuts, name]);

  const toggleCutsDropdown = () => {
    clearBlurCloseTimer();
    setCutsDropdownOpen((open) => !open);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = t("batches.nameRequired");
    }

    const pieces = parseInt(totalPiecesInput, 10);
    if (!totalPiecesInput || isNaN(pieces) || pieces <= 0) {
      newErrors.totalPieces = t("batches.piecesRequired");
    }

    if (isOwner && !editingBatch) {
      if (!selectedCutId) {
        newErrors.cutId = t("batches.ownerCutRequired");
      } else {
        const chosen = cuts.find((c) => c.id === selectedCutId);
        if (
          !chosen ||
          chosen.pricePerPiece == null ||
          !Number.isFinite(chosen.pricePerPiece) ||
          chosen.pricePerPiece <= 0
        ) {
          newErrors.cutId = t("batches.ownerCutPriceMissing");
        } else if (findBatchUsingCut(batches, selectedCutId, null)) {
          newErrors.cutId = t("batches.cutAlreadyHasBatch");
        }
      }
    }

    if (!isOwner && deliveryDate.trim()) {
      if (!parseBrDateStrict(deliveryDate.trim())) {
        newErrors.deliveryDate = t("batches.deliveryDateInvalid");
      } else {
        const parsed = parseBrDateStrict(deliveryDate.trim());
        if (parsed && startOfLocalDay(parsed).getTime() < startOfLocalDay(new Date()).getTime()) {
          newErrors.deliveryDate = t("batches.deliveryDateMinToday");
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      const selectedWorkshop = workshops.find(
        (w) => w.id === selectedWorkshopId,
      );

      const pieces = parseInt(totalPiecesInput, 10);
      let cutIdField: string | undefined;
      let pricePerPieceField: number | undefined;
      let guaranteedTotalField: number | undefined;
      let inviteTokenField: string | undefined;
      let cutListNumberField: number | undefined;

      if (isOwner && !editingBatch) {
        const chosen = cuts.find((c) => c.id === selectedCutId);
        const p = chosen?.pricePerPiece;
        if (!chosen || p == null || !Number.isFinite(p) || p <= 0) {
          throw new Error(t("batches.ownerCutPriceMissing"));
        }
        if (findBatchUsingCut(batches, chosen.id, null)) {
          throw new Error(t("batches.cutAlreadyHasBatch"));
        }
        const unit = Math.round(p * 100) / 100;
        cutIdField = chosen.id;
        pricePerPieceField = unit;
        guaranteedTotalField = Math.round(pieces * unit * 100) / 100;
        inviteTokenField = generateBatchInviteToken();
        const n = getCutListNumber(cuts, chosen.id);
        if (n != null) cutListNumberField = n;
      }

      const batchData: CreateBatchData = {
        name: name.trim(),
        totalPieces: pieces,
        status: isOwner && !editingBatch ? "pending" : status,
        workshopId: selectedWorkshopId || undefined,
        workshopName: selectedWorkshop?.name || undefined,
        deliveryDate:
          !isOwner && deliveryDate.trim()
            ? parseBrDateStrict(deliveryDate.trim()) || undefined
            : undefined,
        observations: observations.trim() || undefined,
        cutId: cutIdField,
        pricePerPiece: pricePerPieceField,
        guaranteedTotal: guaranteedTotalField,
        inviteToken: inviteTokenField,
        cutListNumber: cutListNumberField,
      };

      if (editingBatch) {
        const updatePayload: Parameters<typeof updateBatch>[1] = {
          name: batchData.name,
          totalPieces: batchData.totalPieces,
          status: isOwner ? editingBatch.status : status,
          workshopId: batchData.workshopId,
          workshopName: batchData.workshopName,
          deliveryDate: batchData.deliveryDate,
          observations: batchData.observations,
        };
        if (cutIdField || editingBatch.cutId) {
          updatePayload.cutId = cutIdField ?? editingBatch.cutId;
        }
        if (pricePerPieceField !== undefined && guaranteedTotalField !== undefined) {
          updatePayload.pricePerPiece = pricePerPieceField;
          updatePayload.guaranteedTotal = guaranteedTotalField;
        }
        await updateBatch(editingBatch.id, updatePayload);
        Alert.alert(t("common.success"), t("batches.updateSuccess"));
        await loadBatches();
        closeModal();
      } else {
        const created = await createBatch(user.id, batchData);
        await loadBatches();
        closeModal();
        if (isOwner && inviteTokenField && created.inviteToken) {
          const inviteUrl = buildBatchOfferShareUrl(created.id, created.inviteToken);
          const refNum =
            created.cutListNumber ?? cutListNumberField ?? null;
          const cutForObs =
            selectedCutId != null ? cuts.find((c) => c.id === selectedCutId) : undefined;
          const cutObsText =
            cutForObs?.observations && String(cutForObs.observations).trim()
              ? String(cutForObs.observations).trim()
              : "";
          setOfferSummary({
            visible: true,
            step: "agreement",
            batchId: created.id,
            workshopName: (created.workshopName || batchData.workshopName || "").trim(),
            inviteUrl,
            batchRef:
              refNum != null
                ? `#${refNum}`
                : created.id.slice(0, 8).toUpperCase(),
            pieceName: created.name,
            quantity: created.totalPieces,
            pricePerPiece: created.pricePerPiece ?? pricePerPieceField ?? 0,
            guaranteedTotal:
              created.guaranteedTotal ?? guaranteedTotalField ?? 0,
            batchObservations: observations.trim(),
            cutObservations: cutObsText,
          });
        } else {
          Alert.alert(t("common.success"), t("batches.createSuccess"));
        }
      }
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao salvar lote");
    } finally {
      setSubmitting(false);
    }
  };

  const copyOfferLinkOnly = async () => {
    const url = offerSummary.inviteUrl;
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      setOfferLinkJustCopied(true);
      setTimeout(() => setOfferLinkJustCopied(false), 2200);
    } catch {
      Alert.alert(t("common.error"), t("batches.offerLinkCopyError"));
    }
  };

  const shareOfferLinkNative = async () => {
    const url = offerSummary.inviteUrl;
    if (!url) return;
    try {
      await Share.share({
        message: url,
        title: t("batches.offerShareTitle"),
      });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "";
      if (msg.includes("User did not share") || msg.includes("cancel")) return;
      Alert.alert(t("common.error"), t("batches.offerShareError"));
    }
  };

  const closeOfferSummary = () => {
    setOfferLinkJustCopied(false);
    setOfferSummary((s) => ({ ...s, visible: false, step: "agreement" }));
  };

  const handlePreInviteConfirm = async (price: number, total: number) => {
    if (!offerSummary.batchId) return;
    const prevP = offerSummary.pricePerPiece;
    const prevG = offerSummary.guaranteedTotal;
    const changed =
      Math.abs(price - prevP) > 0.009 || Math.abs(total - prevG) > 0.009;
    try {
      if (changed) {
        await updateBatch(offerSummary.batchId, {
          pricePerPiece: price,
          guaranteedTotal: total,
        });
      }
      setOfferSummary((s) => ({
        ...s,
        pricePerPiece: price,
        guaranteedTotal: total,
        step: "share",
      }));
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    }
  };

  const handleDelete = (batch: Batch) => {
    Alert.alert(
      t("batches.deleteTitle"),
      t("batches.deleteConfirm").replace("{name}", batch.name),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("batches.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBatch(batch.id);
              Alert.alert(t("common.success"), t("batches.deleteSuccess"));
              await loadBatches();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ],
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDateOnly = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  /** Cores do formulário (status “genérico” do lote, não o fluxo de produção). */
  const getFormStatusColor = (status: BatchStatus) => {
    switch (status) {
      case "pending":
        return "#6B7280";
      case "in_progress":
        return "#6366F1";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: BatchStatus) => {
    const key = `batches.status.${status}`;
    const label = t(key);
    if (label === key) {
      if (status === "in_progress") {
        return language === "es" ? "en producción" : "em produção";
      }
      return status;
    }
    return label;
  };

  const handleRomaneioPress = async (batch: Batch) => {
    const plan = getEffectiveUserPlan(user?.plan);
    if (!canExportRomaneioPdf(plan)) {
      Alert.alert(
        t("batches.romaneioLockedTitle"),
        t("batches.romaneioLockedMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("batches.seePlans"), onPress: () => navigate("Plans") },
        ]
      );
      return;
    }
    try {
      setRomaneioLoadingId(batch.id);
      await shareRomaneioForBatch(batch, {
        title: t("batches.romaneioPdfTitle"),
        quantity: t("batches.quantity"),
        workshop: t("batches.workshop"),
        delivery: t("batches.deliveryDate"),
        statusColumn: t("batches.statusLabel"),
        statusValue: getStatusLabel(batch.status),
        obs: t("batches.observations"),
      });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || String(e));
    } finally {
      setRomaneioLoadingId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>{t("batches.title")}</Text>
            <Text style={styles.subtitle}>
              {totalBatches} {t("batches.registered")} • {totalPieces}{" "}
              {t("batches.totalPieces")}
            </Text>
            {!canExportRomaneioPdf(getEffectiveUserPlan(user?.plan)) ? (
              <View style={styles.planNoticeRow}>
                <MaterialIcons name="info-outline" size={16} color="#4F46E5" />
                <Text style={styles.planNoticeText} numberOfLines={3}>
                  {t("batches.romaneioScreenOnlyBanner")}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openModal()}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Batches List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Statistics Cards (moved inside scrollable area so they scroll with content) */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="inventory" size={24} color="#6366F1" />
              </View>
              <Text style={styles.statValue}>{totalBatches}</Text>
              <Text style={styles.statLabel}>{t("batches.totalBatches")}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="check-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{completedBatches}</Text>
              <Text style={styles.statLabel}>{t("batches.completed")}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="schedule" size={24} color="#6366F1" />
              </View>
              <Text style={styles.statValue}>{inProgressBatches}</Text>
              <Text style={styles.statLabel}>{t("batches.inProgress")}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialIcons name="pending" size={24} color="#6B7280" />
              </View>
              <Text style={styles.statValue}>{pendingBatches}</Text>
              <Text style={styles.statLabel}>{t("batches.pending")}</Text>
            </View>
          </View>
          {batches.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t("batches.empty")}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => openModal()}
              >
                <Text style={styles.emptyButtonText}>
                  {t("batches.addFirst")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            batches.map((batch, index) => {
              const productionPill = getBatchProductionPillColors(batch);
              return (
              <View key={batch.id} style={styles.batchCard}>
                {/* Header do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.batchNumber}>
                      <Text style={styles.batchNumberText}>
                        #{batches.length - index}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.batchName} numberOfLines={1}>
                        {batch.name}
                      </Text>
                      <Text style={styles.batchDate}>
                        {formatDate(batch.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => openModal(batch)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="edit" size={20} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRomaneioPress(batch)}
                      style={styles.iconButton}
                      disabled={romaneioLoadingId === batch.id}
                    >
                      {romaneioLoadingId === batch.id ? (
                        <ActivityIndicator size="small" color="#059669" />
                      ) : (
                        <MaterialIcons
                          name="picture-as-pdf"
                          size={20}
                          color={canExportRomaneioPdf(getEffectiveUserPlan(user?.plan)) ? "#059669" : "#9CA3AF"}
                        />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(batch)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Status: mesmas cores de produção dono + oficina (atraso / verde / laranja / amarelo) */}
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: productionPill.bg },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: productionPill.fg },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: productionPill.fg },
                      ]}
                    >
                      {getStatusLabel(batch.status)}
                    </Text>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={styles.infoLabel}>{t("batches.quantity")}:</Text>
                    <Text style={styles.infoValue}>
                      {batch.totalPieces} {t("batches.pieces")}
                    </Text>
                  </View>
                  {batch.workshopName && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="business" size={18} color="#6366F1" />
                      <Text style={styles.infoLabel}>
                        {t("batches.workshop")}:
                      </Text>
                      <Text style={styles.infoValue}>{batch.workshopName}</Text>
                    </View>
                  )}
                  {batch.deliveryDate && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="event" size={18} color="#6366F1" />
                      <Text style={styles.infoLabel}>
                        {t("batches.deliveryDate")}:
                      </Text>
                      <Text style={styles.infoValue}>
                        {formatDateOnly(batch.deliveryDate)}
                      </Text>
                    </View>
                  )}
                  {batch.observations && (
                    <View style={styles.observationsContainer}>
                      <MaterialIcons name="notes" size={18} color="#6B7280" />
                      <Text style={styles.observationsLabel}>
                        {t("batches.observations")}:
                      </Text>
                      <Text style={styles.observationsText} numberOfLines={3}>
                        {batch.observations}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
            })
          )}
        </ScrollView>

        {/* Modal de Cadastro/Edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingBatch ? t("batches.edit") : t("batches.add")}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                {/* Nome */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("batches.name")}</Text>
                  <View style={styles.nameFieldWrap}>
                    <View style={styles.inputContainer}>
                      <MaterialIcons
                        name="content-cut"
                        size={20}
                        color="#6B7280"
                      />
                      <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={handleBatchNameChange}
                        placeholder={t("batches.namePlaceholder")}
                        placeholderTextColor="#9CA3AF"
                        onFocus={() => {
                          clearBlurCloseTimer();
                          setCutsDropdownOpen(true);
                        }}
                      />
                      <TouchableOpacity
                        onPress={toggleCutsDropdown}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("batches.cutsDropdownToggle")}
                      >
                        <MaterialIcons
                          name={cutsDropdownOpen ? "expand-less" : "expand-more"}
                          size={22}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                    </View>
                    {cutsDropdownOpen ? (
                      <View style={styles.cutsDropdown}>
                        {cutsLoading ? (
                          <View style={styles.cutsDropdownLoading}>
                            <ActivityIndicator color="#6366F1" />
                          </View>
                        ) : cuts.length === 0 ? (
                          <Text style={styles.cutsDropdownEmpty}>
                            {t("batches.cutsDropdownEmpty")}
                          </Text>
                        ) : filteredCuts.length === 0 ? (
                          <Text style={styles.cutsDropdownEmpty}>
                            {t("batches.cutsDropdownNoResults")}
                          </Text>
                        ) : (
                          <ScrollView
                            style={styles.cutsDropdownList}
                            keyboardShouldPersistTaps="always"
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                          >
                            {filteredCuts.map((cut) => {
                              const cutTaken =
                                isOwner &&
                                !editingBatch &&
                                !!findBatchUsingCut(batches, cut.id, null);
                              return (
                                <Pressable
                                  key={cut.id}
                                  style={({ pressed }) => [
                                    styles.cutsDropdownItem,
                                    cutTaken && styles.cutsDropdownItemDisabled,
                                    pressed && !cutTaken && { opacity: 0.75 },
                                  ]}
                                  disabled={cutTaken}
                                  onPress={() => {
                                    if (cutTaken) return;
                                    selectCutForBatchName(cut);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.cutsDropdownItemTitle,
                                      cutTaken && styles.cutsDropdownItemTitleDisabled,
                                    ]}
                                    numberOfLines={2}
                                  >
                                    {cut.type}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.cutsDropdownItemMeta,
                                      cutTaken && styles.cutsDropdownItemMetaDisabled,
                                    ]}
                                  >
                                    {`#${getCutListNumber(cuts, cut.id) ?? "—"} · ${cut.totalPieces} ${t("batches.pieces")}${
                                      cut.pricePerPiece != null &&
                                      Number.isFinite(cut.pricePerPiece)
                                        ? ` · ${formatMoneyBRL(cut.pricePerPiece)} ${t("batches.perPieceAbbr")}`
                                        : ""
                                    }${cutTaken ? ` · ${t("batches.cutAlreadyHasBatchTag")}` : ""}`}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cutsHint}>{t("batches.cutsFromCutsHint")}</Text>
                  {errors.cutId && (
                    <Text style={styles.errorText}>{errors.cutId}</Text>
                  )}
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>

                {/* Quantidade de Peças */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("batches.quantity")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="inventory" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={totalPiecesInput}
                      onChangeText={setTotalPiecesInput}
                      placeholder={t("batches.quantityPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                    />
                  </View>
                  {errors.totalPieces && (
                    <Text style={styles.errorText}>{errors.totalPieces}</Text>
                  )}
                </View>

                {isOwner && selectedCutId ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t("batches.unitPriceLabel")}</Text>
                      <View style={styles.inputContainer}>
                        <MaterialIcons name="attach-money" size={20} color="#6B7280" />
                        <Text style={[styles.input, { paddingVertical: 12 }]}>
                          {(() => {
                            const c = cuts.find((x) => x.id === selectedCutId);
                            return c?.pricePerPiece != null &&
                              Number.isFinite(c.pricePerPiece)
                              ? formatMoneyBRL(c.pricePerPiece)
                              : "—";
                          })()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t("batches.calculatedTotal")}</Text>
                      <View style={styles.inputContainer}>
                        <MaterialIcons name="calculate" size={20} color="#6B7280" />
                        <TextInput
                          style={styles.input}
                          value={guaranteedTotalDisplay}
                          editable={false}
                          placeholder="—"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>
                  </>
                ) : null}

                {/* Status (não exibido para dono — fluxo WhatsApp / oficina) */}
                {!isOwner ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("batches.statusLabel")}</Text>
                    <View style={styles.statusButtonsContainer}>
                      {(
                        ["pending", "in_progress", "completed", "cancelled"] as BatchStatus[]
                      ).map((statusOption) => (
                        <TouchableOpacity
                          key={statusOption}
                          style={[
                            styles.statusButton,
                            status === statusOption && styles.statusButtonActive,
                            {
                              borderColor: getFormStatusColor(statusOption),
                              backgroundColor:
                                status === statusOption
                                  ? `${getFormStatusColor(statusOption)}20`
                                  : "#FFFFFF",
                            },
                          ]}
                          onPress={() => setStatus(statusOption)}
                        >
                          <View
                            style={[
                              styles.statusButtonDot,
                              {
                                backgroundColor:
                                  status === statusOption
                                    ? getFormStatusColor(statusOption)
                                    : "#E5E7EB",
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusButtonText,
                              {
                                color:
                                  status === statusOption
                                    ? getFormStatusColor(statusOption)
                                    : "#6B7280",
                              },
                            ]}
                          >
                            {t(`batches.status.${statusOption}`)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Oficina */}
                {workshops.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("batches.workshop")}</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="business" size={20} color="#6B7280" />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.workshopSelector}
                      >
                        <TouchableOpacity
                          style={[
                            styles.workshopOption,
                            !selectedWorkshopId && styles.workshopOptionActive,
                          ]}
                          onPress={() => setSelectedWorkshopId("")}
                        >
                          <Text
                            style={[
                              styles.workshopOptionText,
                              !selectedWorkshopId && styles.workshopOptionTextActive,
                            ]}
                          >
                            {t("batches.noWorkshop")}
                          </Text>
                        </TouchableOpacity>
                        {workshops.map((workshop) => (
                          <TouchableOpacity
                            key={workshop.id}
                            style={[
                              styles.workshopOption,
                              selectedWorkshopId === workshop.id &&
                                styles.workshopOptionActive,
                            ]}
                            onPress={() => setSelectedWorkshopId(workshop.id)}
                          >
                            <Text
                              style={[
                                styles.workshopOptionText,
                                selectedWorkshopId === workshop.id &&
                                  styles.workshopOptionTextActive,
                              ]}
                            >
                              {workshop.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                {/* Data de Entrega (somente perfil não-owner) */}
                {!isOwner ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {t("batches.deliveryDate")}
                    </Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="event" size={20} color="#6B7280" />
                      <TextInput
                        style={styles.input}
                        value={deliveryDate}
                        onChangeText={(text) => setDeliveryDate(formatDeliveryDateInput(text))}
                        placeholder={t("batches.deliveryDatePlaceholder")}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                    </View>
                    {errors.deliveryDate && (
                      <Text style={styles.errorText}>{errors.deliveryDate}</Text>
                    )}
                  </View>
                ) : null}

                {/* Observações */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("batches.observations")}</Text>
                  <View
                    style={[styles.inputContainer, styles.textAreaContainer]}
                  >
                    <MaterialIcons
                      name="notes"
                      size={20}
                      color="#6B7280"
                      style={styles.textAreaIcon}
                    />
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={observations}
                      onChangeText={setObservations}
                      placeholder={t("batches.observationsPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Botões */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeModal}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {t("common.save")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <OwnerBatchPreInviteModal
          visible={offerSummary.visible}
          data={
            offerSummary.visible
              ? {
                  step: offerSummary.step,
                  batchId: offerSummary.batchId,
                  inviteUrl: offerSummary.inviteUrl,
                  batchRef: offerSummary.batchRef,
                  pieceName: offerSummary.pieceName,
                  quantity: offerSummary.quantity,
                  pricePerPiece: offerSummary.pricePerPiece,
                  guaranteedTotal: offerSummary.guaranteedTotal,
                  batchObservations: offerSummary.batchObservations,
                  cutObservations: offerSummary.cutObservations,
                  workshopName: offerSummary.workshopName,
                  photoURL: user?.photoURL,
                  userFirstName:
                    (user?.name && user.name.split(" ")[0]) || user?.name || "—",
                  companyName: user?.companyName,
                }
              : null
          }
          onClose={closeOfferSummary}
          onConfirmAgreement={handlePreInviteConfirm}
          offerLinkJustCopied={offerLinkJustCopied}
          onCopyLink={copyOfferLinkOnly}
          onShareLink={shareOfferLinkNative}
        />
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  planNoticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    maxWidth: "85%",
  },
  planNoticeText: {
    fontSize: 12,
    color: "#4B5563",
    flex: 1,
    lineHeight: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#6366F1",
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  batchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  batchNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  batchNumberText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6366F1",
  },
  cardHeaderInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  batchDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardInfo: {
    gap: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366F1",
    flex: 1,
    textAlign: "right",
  },
  observationsContainer: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
  },
  observationsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 26,
  },
  observationsText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 26,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  modalScroll: {
    maxHeight: 400,
  },
  inputGroup: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nameFieldWrap: {
    position: "relative",
    zIndex: 20,
    elevation: 20,
  },
  cutsDropdown: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginTop: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  cutsDropdownLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cutsDropdownEmpty: {
    padding: 14,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  cutsDropdownList: {
    maxHeight: 200,
  },
  cutsDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cutsDropdownItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  cutsDropdownItemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  cutsDropdownItemDisabled: {
    opacity: 0.55,
    backgroundColor: "#F9FAFB",
  },
  cutsDropdownItemTitleDisabled: {
    color: "#9CA3AF",
  },
  cutsDropdownItemMetaDisabled: {
    color: "#9CA3AF",
  },
  cutsHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#9CA3AF",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  textAreaContainer: {
    alignItems: "flex-start",
  },
  textAreaIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
  statusButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    minWidth: "45%",
  },
  statusButtonActive: {
    borderWidth: 2,
  },
  statusButtonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  workshopSelector: {
    flexDirection: "row",
  },
  workshopOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  workshopOptionActive: {
    borderColor: "#6366F1",
    backgroundColor: "#F0F4FF",
  },
  workshopOptionText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  workshopOptionTextActive: {
    color: "#6366F1",
    fontWeight: "600",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#6366F1",
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
