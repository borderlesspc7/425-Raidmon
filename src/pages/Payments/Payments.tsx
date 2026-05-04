import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Keyboard,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  getPaymentsByUser,
  createPayment,
  updatePayment,
  deletePayment,
} from "../../services/paymentService";
import { getWorkshopsByUser } from "../../services/workshopService";
import { getBatchesByUser } from "../../services/batchService";
import { Payment, CreatePaymentData, PaymentStatus } from "../../types/payment";
import { createAsaasChargeForPayment } from "../../services/asaasPayments";
import { Workshop } from "../../types/workshop";
import { Batch } from "../../types/batch";
import {
  getEffectiveUserPlan,
  isPaymentHistoryWindowLimited,
  isPaymentInPlanHistoryWindow,
} from "../../utils/planEntitlements";
import {
  applyMarketplaceFeeToBase,
  MARKETPLACE_FEE_PERCENT,
} from "../../constants/marketplaceFee";
import { getPaymentListBucket } from "../../utils/paymentListBucket";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startOfLocalToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function batchSuggestedAmount(batch: Batch): number | null {
  const gt = batch.guaranteedTotal;
  if (typeof gt === "number" && Number.isFinite(gt) && gt > 0) {
    return Math.round(gt * 100) / 100;
  }
  const p = batch.pricePerPiece;
  const n = batch.totalPieces;
  const pOk = typeof p === "number" && Number.isFinite(p) && p > 0;
  const nOk = typeof n === "number" && Number.isFinite(n) && n > 0;
  if (pOk && nOk) {
    return Math.round(p * n * 100) / 100;
  }
  /* Firestore às vezes serializa números como string */
  const pNum = pOk ? p : Number(String(p ?? "").replace(",", "."));
  const nNum = nOk ? n : Number(String(n ?? "").replace(/\D/g, ""));
  if (Number.isFinite(pNum) && pNum > 0 && Number.isFinite(nNum) && nNum > 0) {
    return Math.round(pNum * nNum * 100) / 100;
  }
  return null;
}

/** Oficina vinculada ao lote: aceita pelo convite ou cadastro do dono (dropdown em Lotes). */
function acceptingWorkshopDisplayName(batch: Batch): string {
  const a =
    typeof batch.inviteAcceptedByName === "string"
      ? batch.inviteAcceptedByName.trim()
      : "";
  const w =
    typeof batch.workshopName === "string" ? batch.workshopName.trim() : "";
  return (a || w || "").trim();
}

export default function Payments() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const entPlan = getEffectiveUserPlan(user?.plan);
  const historyLimited = isPaymentHistoryWindowLimited(entPlan);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");


  // Form state
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [batchDescDropdownOpen, setBatchDescDropdownOpen] = useState(false);
  const batchDescBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixLoadingId, setPixLoadingId] = useState<string | null>(null);
  const [pixView, setPixView] = useState<{
    description: string;
    pixCopyPaste: string | null;
    pixEncodedImage: string | null;
    invoiceUrl: string | null;
    platformFeeAmount?: number;
    totalCharged?: number;
    feePercent?: number;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  const filteredBatchesForDescription = useMemo(() => {
    const trimmed = description.trim();
    const q = normalizeSearchText(trimmed);
    const mHash = trimmed.match(/^#(\d+)$/);
    const mNum = trimmed.match(/^(\d+)$/);
    const refNumExact =
      mHash != null
        ? parseInt(mHash[1], 10)
        : mNum != null
          ? parseInt(mNum[1], 10)
          : null;
    const qDigitsOnly = trimmed.replace(/^#/, "").replace(/\s/g, "");
    const refDigitsPrefix =
      qDigitsOnly.length > 0 && /^\d+$/.test(qDigitsOnly) ? qDigitsOnly : null;

    const sorted = [...batches].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    /* Só "#" (referência ao # do corte) não deve esvaziar a lista — ainda não há dígito p/ filtrar */
    const isBareHashOnly =
      trimmed === "#" ||
      /^#\s*$/.test(trimmed) ||
      (q === "#" && refDigitsPrefix == null && refNumExact == null);

    const hasAnyQuery =
      (q.length > 0 && !isBareHashOnly) || refNumExact != null;

    if (!hasAnyQuery || isBareHashOnly) {
      return sorted.slice(0, 80);
    }

    return sorted
      .map((b) => {
        const nameN = normalizeSearchText(b.name);
        const wsN = b.workshopName ? normalizeSearchText(b.workshopName) : "";
        const acceptN = b.inviteAcceptedByName
          ? normalizeSearchText(b.inviteAcceptedByName)
          : "";
        const idShort = normalizeSearchText(b.id.slice(0, 8));
        let score = 0;

        if (refNumExact != null && b.cutListNumber === refNumExact) {
          score += 150;
        } else if (
          refDigitsPrefix != null &&
          b.cutListNumber != null &&
          String(b.cutListNumber).startsWith(refDigitsPrefix)
        ) {
          score += 95;
        } else if (b.cutListNumber != null && q.length > 0) {
          const cn = String(b.cutListNumber);
          const hashNorm = normalizeSearchText(`#${cn}`);
          if (q === hashNorm || q === cn) score += 125;
          else if (q.includes(cn) && cn.length >= 1) score += 55;
        }

        if (nameN === q) score += 100;
        else if (nameN.startsWith(q)) score += 80;
        else if (q && nameN.includes(q)) score += 50;
        if (q && wsN.includes(q)) score += 40;
        if (q && acceptN.includes(q)) score += 38;
        if (q && (idShort.includes(q) || normalizeSearchText(b.id).includes(q))) {
          score += 35;
        }

        return { b, score };
      })
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.b.updatedAt.getTime() - a.b.updatedAt.getTime(),
      )
      .map((x) => x.b);
  }, [batches, description]);

  const selectedBatchForModal = useMemo(
    () => batches.find((x) => x.id === selectedBatchId),
    [batches, selectedBatchId],
  );
  const autoWorkshopFromBatch = useMemo(() => {
    const b = selectedBatchForModal;
    if (!b) return "";
    const fromNames = acceptingWorkshopDisplayName(b);
    if (fromNames) return fromNames;
    if (b.workshopId) {
      const w = workshops.find((x) => x.id === b.workshopId);
      if (w?.name?.trim()) return w.name.trim();
    }
    return "";
  }, [selectedBatchForModal, workshops]);

  const clearBatchDescBlurTimer = () => {
    if (batchDescBlurTimer.current) {
      clearTimeout(batchDescBlurTimer.current);
      batchDescBlurTimer.current = null;
    }
  };

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [paymentsData, workshopsData, batchesData] = await Promise.all([
        getPaymentsByUser(user.id),
        getWorkshopsByUser(user.id),
        getBatchesByUser(user.id),
      ]);

      setPayments(paymentsData);
      setWorkshops(workshopsData);
      setBatches(batchesData);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao carregar pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    clearBatchDescBlurTimer();
    setBatchDescDropdownOpen(false);
    setDescription("");
    setAmountInput("");
    setPaidDate("");
    setSelectedBatchId("");
    setErrors({});
  };

  const formatAmountInput = (value: number) => {
    return value.toFixed(2).replace(".", ",");
  };

  const formatDateForInput = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const handleDescriptionChange = (text: string) => {
    clearBatchDescBlurTimer();
    setDescription(text);
    if (selectedBatchId) {
      const b = batches.find((x) => x.id === selectedBatchId);
      if (!b || normalizeSearchText(b.name) !== normalizeSearchText(text.trim())) {
        setSelectedBatchId("");
      }
    }
    setBatchDescDropdownOpen(true);
  };

  const selectBatchForDescription = (batch: Batch) => {
    clearBatchDescBlurTimer();
    setDescription(batch.name);
    setSelectedBatchId(batch.id);
    const amt = batchSuggestedAmount(batch);
    if (amt != null) {
      setAmountInput(formatAmountInput(amt));
    } else {
      setAmountInput("");
    }
    setBatchDescDropdownOpen(false);
    Keyboard.dismiss();
  };

  const toggleBatchDescDropdown = () => {
    clearBatchDescBlurTimer();
    setBatchDescDropdownOpen((o) => !o);
  };

  const openModal = (payment?: Payment) => {
    resetForm();
    if (payment) {
      setEditingPayment(payment);
      setDescription(payment.description);
      setAmountInput(formatAmountInput(payment.amount));
      setPaidDate(payment.paidDate ? formatDateForInput(payment.paidDate) : "");
      setSelectedBatchId(payment.batchId || "");
    } else {
      setEditingPayment(null);
    }
    setBatchDescDropdownOpen(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingPayment(null);
    resetForm();
  };

  const parseAmount = (text: string): number => {
    const cleaned = text.replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const handleAmountChange = (text: string) => {
    // Permitir apenas números e vírgula
    const cleaned = text.replace(/[^0-9,]/g, "");
    setAmountInput(cleaned);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const formatDateInput = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const parseDate = (text: string): Date | null => {
    const parts = text.split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const newPaymentFeePreview = useMemo(() => {
    if (editingPayment) return null;
    const b = parseAmount(amountInput);
    if (b <= 0) return null;
    return { base: b, total: applyMarketplaceFeeToBase(b) };
  }, [amountInput, editingPayment]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!description.trim() || description.trim().length < 3) {
      newErrors.description = t("payments.loteRequired");
    }
    const parsedAmount = parseAmount(amountInput);
    if (!amountInput || parsedAmount <= 0) {
      newErrors.amount = t("payments.amountRequired");
    }
    if (!editingPayment) {
      const descOk = description.trim().length >= 3;
      if (descOk && !selectedBatchId) {
        newErrors.description = t("payments.batchPickRequired");
      } else if (descOk && selectedBatchId) {
        const b = batches.find((x) => x.id === selectedBatchId);
        const link =
          b?.linkedWorkshopUserId != null &&
          String(b.linkedWorkshopUserId).trim().length > 0;
        if (b && !link) {
          newErrors.description = t("payments.batchNoLinkedWorkshop");
        }
      }
    }
    if (paidDate && paidDate.replace(/\D/g, "").length > 0) {
      if (paidDate.replace(/\D/g, "").length < 8 || !parseDate(paidDate)) {
        newErrors.paidDate = t("payments.paidDateInvalid");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildCreatePaymentData = (amountGross: number): CreatePaymentData => {
    const dueForSave = editingPayment
      ? editingPayment.dueDate
      : startOfLocalToday();
    const parsedPaidDate = paidDate ? parseDate(paidDate) || undefined : undefined;
    const selectedBatch = selectedBatchId
      ? batches.find((b) => b.id === selectedBatchId)
      : null;
    const workshopFromList =
      selectedBatch?.workshopId != null
        ? workshops.find((w) => w.id === selectedBatch.workshopId)
        : null;
    const acceptingName = selectedBatch
      ? acceptingWorkshopDisplayName(selectedBatch)
      : "";
    const linkedUid =
      selectedBatch?.linkedWorkshopUserId != null &&
      String(selectedBatch.linkedWorkshopUserId).trim().length > 0
        ? String(selectedBatch.linkedWorkshopUserId).trim()
        : null;
    const marketplaceWorkshopUserId =
      linkedUid ||
      (editingPayment?.marketplaceWorkshopUserId
        ? String(editingPayment.marketplaceWorkshopUserId).trim()
        : null) ||
      null;
    const statusForSave: PaymentStatus = editingPayment
      ? editingPayment.status
      : "pending";
    return {
      description: description.trim(),
      amount: amountGross,
      dueDate: dueForSave,
      paidDate: parsedPaidDate,
      status: statusForSave,
      workshopId: selectedBatch?.workshopId || editingPayment?.workshopId,
      workshopName:
        workshopFromList?.name || acceptingName || editingPayment?.workshopName,
      marketplaceWorkshopUserId,
      batchId: selectedBatchId || editingPayment?.batchId || undefined,
      batchName: selectedBatch?.name || editingPayment?.batchName || undefined,
    };
  };

  const handleSaveEdit = async () => {
    if (!editingPayment || !validateForm() || !user?.id) return;
    try {
      setSubmitting(true);
      const amountGross = parseAmount(amountInput);
      const paymentData = buildCreatePaymentData(amountGross);
      await updatePayment(editingPayment.id, paymentData);
      Alert.alert(t("common.success"), t("payments.updateSuccess"));
      closeModal();
      loadData();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao salvar pagamento");
    } finally {
      setSubmitting(false);
    }
  };

  /** Novo: cria o pagamento com total (serviço + 2,5%), gera cobrança Asaas e abre QR + link. */
  const handleNewPaymentPay = async () => {
    if (editingPayment || !validateForm() || !user?.id) return;
    const base = parseAmount(amountInput);
    const gross = applyMarketplaceFeeToBase(base);
    if (gross <= 0) {
      Alert.alert(t("common.error"), t("payments.amountRequired"));
      return;
    }
    try {
      setSubmitting(true);
      const paymentData = buildCreatePaymentData(gross);
      const created = await createPayment(user.id, paymentData);
      const data = await createAsaasChargeForPayment(created.id);
      setPixView({
        description: created.description,
        pixCopyPaste: data.pixCopyPaste,
        pixEncodedImage: data.pixEncodedImage,
        invoiceUrl: data.invoiceUrl,
        platformFeeAmount: data.platformFeeAmount,
        totalCharged: data.grossAmount,
        feePercent: data.platformFeePercent,
      });
      closeModal();
      setPixModalVisible(true);
      loadData();
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.details ||
        (typeof error?.code === "string" ? error.code : "") ||
        t("payments.asaasError");
      Alert.alert(t("common.error"), String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (payment: Payment) => {
    Alert.alert(
      t("payments.deleteTitle"),
      t("payments.deleteConfirm").replace("{description}", payment.description),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("payments.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deletePayment(payment.id);
              Alert.alert(t("common.success"), t("payments.deleteSuccess"));
              loadData();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    if (payment.asaasPaymentId) {
      Alert.alert(t("common.info"), t("payments.asaasOnlyMarkPaid"));
      return;
    }
    try {
      await updatePayment(payment.id, {
        status: "paid",
        paidDate: new Date(),
      });
      Alert.alert(t("common.success"), t("payments.updateSuccess"));
      loadData();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const handleGeneratePix = async (payment: Payment) => {
    if (payment.asaasPaymentId) {
      setPixView({
        description: payment.description,
        pixCopyPaste: payment.pixCopyPaste ?? null,
        pixEncodedImage: payment.pixEncodedImage ?? null,
        invoiceUrl: payment.asaasInvoiceUrl ?? null,
        platformFeeAmount: payment.platformFeeAmount,
        totalCharged: payment.amount,
        feePercent: payment.platformFeePercent,
      });
      setPixModalVisible(true);
      return;
    }
    try {
      setPixLoadingId(payment.id);
      const data = await createAsaasChargeForPayment(payment.id);
      setPixView({
        description: payment.description,
        pixCopyPaste: data.pixCopyPaste,
        pixEncodedImage: data.pixEncodedImage,
        invoiceUrl: data.invoiceUrl,
        platformFeeAmount: data.platformFeeAmount,
        totalCharged: data.grossAmount,
        feePercent: data.platformFeePercent,
      });
      setPixModalVisible(true);
      await loadData();
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.details ||
        (typeof error?.code === "string" ? error.code : "") ||
        t("payments.asaasError");
      Alert.alert(t("common.error"), String(msg));
    } finally {
      setPixLoadingId(null);
    }
  };

  const copyPixCode = async (payload: string) => {
    await Clipboard.setStringAsync(payload);
    Alert.alert(t("common.success"), t("payments.pixCopied"));
  };

  const copyPaymentLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert(t("common.success"), t("payments.linkCopied"));
  };

  const getStatusColor = (s: PaymentStatus) => {
    switch (s) {
      case "paid":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "overdue":
        return "#EF4444";
      case "cancelled":
        return "#6B7280";
    }
  };

  const getStatusBg = (s: PaymentStatus) => {
    switch (s) {
      case "paid":
        return "#D1FAE5";
      case "pending":
        return "#FEF3C7";
      case "overdue":
        return "#FEE2E2";
      case "cancelled":
        return "#F3F4F6";
    }
  };

  const getStatusBorderColor = (s: PaymentStatus) => {
    switch (s) {
      case "paid":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "overdue":
        return "#EF4444";
      case "cancelled":
        return "#9CA3AF";
    }
  };

  const getStatusIcon = (s: PaymentStatus) => {
    switch (s) {
      case "paid":
        return "check-circle";
      case "pending":
        return "schedule";
      case "overdue":
        return "warning";
      case "cancelled":
        return "cancel";
    }
  };

  const paymentsInScope = useMemo(() => {
    if (!historyLimited) return payments;
    return payments.filter((p) => {
      const ref = p.paidDate || p.dueDate;
      return isPaymentInPlanHistoryWindow(entPlan, ref);
    });
  }, [payments, historyLimited, entPlan]);

  const batchById = useMemo(() => {
    const m = new Map<string, Batch>();
    batches.forEach((b) => m.set(b.id, b));
    return m;
  }, [batches]);

  /** Totais e filtros usam o “bucket” (atraso do lote/oficina além de status no doc). */
  const scopeStats = useMemo(() => {
    let pending = 0,
      paid = 0,
      overdue = 0,
      amount = 0;
    paymentsInScope.forEach((p) => {
      amount += p.amount;
      const bucket = getPaymentListBucket(
        p,
        p.batchId ? batchById.get(p.batchId) : undefined,
      );
      if (bucket === "cancelled") return;
      if (bucket === "pending") pending++;
      else if (bucket === "paid") paid++;
      else if (bucket === "overdue") overdue++;
    });
    return { pending, paid, overdue, amount };
  }, [paymentsInScope, batchById]);

  const filteredPayments = useMemo(() => {
    if (filterStatus === "all") return paymentsInScope;
    return paymentsInScope.filter((p) => {
      const bucket = getPaymentListBucket(
        p,
        p.batchId ? batchById.get(p.batchId) : undefined,
      );
      if (bucket === "cancelled") return false;
      return bucket === filterStatus;
    });
  }, [paymentsInScope, filterStatus, batchById]);

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
            <Text style={styles.title}>{t("payments.title")}</Text>
            <Text style={styles.subtitle}>
              {paymentsInScope.length} {t("payments.registered")} •{" "}
              {formatCurrency(scopeStats.amount)}
            </Text>
            {historyLimited ? (
              <View style={styles.planNoticeRow}>
                <MaterialIcons name="info-outline" size={16} color="#4F46E5" />
                <Text style={styles.planNoticeText} numberOfLines={3}>
                  {t("payments.basicHistoryHint")}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="schedule" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{scopeStats.pending}</Text>
            <Text style={styles.statLabel}>{t("payments.pending")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="check-circle" size={22} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{scopeStats.paid}</Text>
            <Text style={styles.statLabel}>{t("payments.paid")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FEE2E2" }]}>
              <MaterialIcons name="warning" size={22} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>{scopeStats.overdue}</Text>
            <Text style={styles.statLabel}>{t("payments.overdue")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#F0F4FF" }]}>
              <MaterialIcons name="account-balance-wallet" size={22} color="#6366F1" />
            </View>
            <Text style={[styles.statValue, { fontSize: 14 }]}>
              {formatCurrency(scopeStats.amount)}
            </Text>
            <Text style={styles.statLabel}>{t("payments.total")}</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {(["all", "pending", "paid", "overdue"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterButton,
                  filterStatus === f && styles.filterButtonActive,
                ]}
                onPress={() => setFilterStatus(f)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterStatus === f && styles.filterButtonTextActive,
                  ]}
                >
                  {f === "all"
                    ? t("payments.all")
                    : t(`payments.status.${f}` as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredPayments.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance-wallet" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {filterStatus === "all"
                  ? t("payments.empty")
                  : t("payments.emptyFiltered")}
              </Text>
              {filterStatus === "all" && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => openModal()}
                >
                  <Text style={styles.emptyButtonText}>
                    {t("payments.addFirst")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredPayments.map((payment) => {
              const listBucket = getPaymentListBucket(
                payment,
                payment.batchId ? batchById.get(payment.batchId) : undefined,
              );
              const displayStatus: PaymentStatus = listBucket;
              return (
              <View
                key={payment.id}
                style={[
                  styles.paymentCard,
                  { borderLeftColor: getStatusBorderColor(displayStatus) },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.statusIconContainer,
                        { backgroundColor: getStatusBg(displayStatus) },
                      ]}
                    >
                      <MaterialIcons
                        name={getStatusIcon(displayStatus) as any}
                        size={20}
                        color={getStatusColor(displayStatus)}
                      />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.paymentDescription} numberOfLines={1}>
                        {payment.description}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusBg(displayStatus) },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusBadgeDot,
                            { backgroundColor: getStatusColor(displayStatus) },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.amountText}>
                    {formatCurrency(payment.amount)}
                  </Text>
                </View>

                {/* Card Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="event" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {t("payments.dueOn")}: {formatDate(payment.dueDate)}
                    </Text>
                  </View>
                  {payment.paidDate && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="check-circle" size={16} color="#10B981" />
                      <Text style={[styles.infoText, { color: "#10B981" }]}>
                        {t("payments.paidOn")}: {formatDate(payment.paidDate)}
                      </Text>
                    </View>
                  )}
                  {payment.workshopName && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="business" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>{payment.workshopName}</Text>
                    </View>
                  )}
                  {payment.batchName && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="inventory" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>{payment.batchName}</Text>
                    </View>
                  )}
                  {payment.platformFeeAmount != null && payment.platformFeeAmount > 0 && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="percent" size={16} color="#6366F1" />
                      <Text style={[styles.infoText, { color: "#4F46E5" }]}>
                        {t("payments.platformFeeLabel")}: {formatCurrency(payment.platformFeeAmount)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  {payment.status === "pending" && (
                    <TouchableOpacity
                      style={styles.pixButton}
                      onPress={() => handleGeneratePix(payment)}
                      disabled={pixLoadingId === payment.id}
                    >
                      {pixLoadingId === payment.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="qr-code-2" size={16} color="#FFFFFF" />
                      )}
                      <Text style={styles.pixButtonText}>
                        {pixLoadingId === payment.id
                          ? t("payments.generatingPix")
                          : payment.asaasPaymentId
                            ? t("payments.pixModalTitle")
                            : t("payments.generatePix")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {payment.status === "pending" && !payment.asaasPaymentId && (
                    <TouchableOpacity
                      style={styles.markPaidButton}
                      onPress={() => handleMarkAsPaid(payment)}
                    >
                      <MaterialIcons name="check" size={16} color="#10B981" />
                      <Text style={styles.markPaidText}>
                        {t("payments.markAsPaid")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openModal(payment)}
                    >
                      <MaterialIcons name="edit" size={18} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(payment)}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
            })
          )}
        </ScrollView>

        {/* Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={closeModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingPayment ? t("payments.edit") : t("payments.add")}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                onScrollBeginDrag={() => {
                  clearBatchDescBlurTimer();
                  setBatchDescDropdownOpen(false);
                }}
              >
                {/* Lote (busca + # corte) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("payments.batch")}</Text>
                  <View style={styles.descFieldWrap}>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="inventory-2" size={20} color="#6B7280" />
                      <TextInput
                        style={styles.input}
                        value={description}
                        onChangeText={handleDescriptionChange}
                        placeholder={t("payments.loteSearchPlaceholder")}
                        placeholderTextColor="#9CA3AF"
                        onFocus={() => {
                          clearBatchDescBlurTimer();
                          if (batches.length > 0) setBatchDescDropdownOpen(true);
                        }}
                        onBlur={() => {
                          clearBatchDescBlurTimer();
                          /* Delay: no Android, o 1.º toque fechava o teclado e o timeout fechava a lista
                           * antes de o item receber o press (ver keyboardShouldPersistTaps no ScrollView). */
                          batchDescBlurTimer.current = setTimeout(() => {
                            setBatchDescDropdownOpen(false);
                          }, Platform.OS === "android" ? 400 : 220);
                        }}
                      />
                      {batches.length > 0 ? (
                        <TouchableOpacity
                          onPress={toggleBatchDescDropdown}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={t("payments.batchDropdownToggle")}
                        >
                          <MaterialIcons
                            name={batchDescDropdownOpen ? "expand-less" : "expand-more"}
                            size={22}
                            color="#6B7280"
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {batchDescDropdownOpen && batches.length > 0 ? (
                      <View style={styles.batchDescDropdown} collapsable={false}>
                        <ScrollView
                          style={styles.batchDescDropdownList}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="always"
                          showsVerticalScrollIndicator
                        >
                          {filteredBatchesForDescription.length === 0 ? (
                            <Text style={styles.batchDescDropdownEmpty}>
                              {t("payments.batchDropdownNoResults")}
                            </Text>
                          ) : (
                            filteredBatchesForDescription.map((b) => {
                              const metaWs =
                                acceptingWorkshopDisplayName(b) || b.workshopName || "";
                              return (
                                <TouchableOpacity
                                  key={b.id}
                                  style={styles.batchDescDropdownItem}
                                  activeOpacity={0.7}
                                  onPressIn={clearBatchDescBlurTimer}
                                  onPress={() => {
                                    clearBatchDescBlurTimer();
                                    selectBatchForDescription(b);
                                  }}
                                >
                                  <Text style={styles.batchDescDropdownTitle} numberOfLines={2}>
                                    {b.cutListNumber != null
                                      ? `#${b.cutListNumber} · ${b.name}`
                                      : b.name}
                                  </Text>
                                  <Text style={styles.batchDescDropdownMeta} numberOfLines={1}>
                                    {`${b.totalPieces} ${t("batches.pieces")}${
                                      metaWs ? ` · ${metaWs}` : ""
                                    }`}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </ScrollView>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.fieldHint}>{t("payments.loteSearchHint")}</Text>
                  {errors.description && (
                    <Text style={styles.errorText}>{errors.description}</Text>
                  )}
                </View>

                {/* Oficina que aceitou o lote — acima do valor (só novo pagamento) */}
                {!editingPayment ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("payments.workshopAutoFromBatch")}</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        autoWorkshopFromBatch ? styles.readOnlyField : styles.readOnlyFieldPending,
                      ]}
                    >
                      <MaterialIcons
                        name="business"
                        size={20}
                        color={autoWorkshopFromBatch ? "#059669" : "#9CA3AF"}
                      />
                      <Text
                        style={[
                          styles.readOnlyText,
                          !autoWorkshopFromBatch && styles.readOnlyPlaceholder,
                        ]}
                        numberOfLines={2}
                      >
                        {autoWorkshopFromBatch || t("payments.workshopFromBatchPlaceholder")}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Valor (novo = serviço + taxa 2,5% no total; edição = valor já lançado) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {editingPayment ? t("payments.amount") : t("payments.amountService")}
                  </Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="attach-money" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={amountInput}
                      onChangeText={handleAmountChange}
                      placeholder={t("payments.amountPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {!editingPayment && newPaymentFeePreview ? (
                    <View style={styles.feeNoticeBox}>
                      <Text style={styles.feeNoticeText}>
                        {t("payments.fee2_5Line")
                          .replace("{pct}", String(MARKETPLACE_FEE_PERCENT))
                          .replace("{total}", formatCurrency(newPaymentFeePreview.total))}
                      </Text>
                    </View>
                  ) : null}
                  {errors.amount && (
                    <Text style={styles.errorText}>{errors.amount}</Text>
                  )}
                </View>

                {/* Data de Pagamento (opcional) — ao editar, se já foi pago ou tiver data */}
                {editingPayment &&
                  (editingPayment.status === "paid" || editingPayment.paidDate) && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {t("payments.paidDate")}{" "}
                      <Text style={styles.optionalLabel}>
                        ({t("payments.optional")})
                      </Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#10B981"
                      />
                      <TextInput
                        style={styles.input}
                        value={paidDate}
                        onChangeText={(text) =>
                          setPaidDate(formatDateInput(text))
                        }
                        placeholder={t("payments.paidDatePlaceholder")}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                    </View>
                    {errors.paidDate && (
                      <Text style={styles.errorText}>{errors.paidDate}</Text>
                    )}
                  </View>
                )}

                {/* Oficina — edição (novo pagamento mostra o bloco acima do valor) */}
                {editingPayment && (autoWorkshopFromBatch || editingPayment?.workshopName) ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t("payments.workshopAutoFromBatch")}</Text>
                    <View style={[styles.inputContainer, styles.readOnlyField]}>
                      <MaterialIcons name="business" size={20} color="#059669" />
                      <Text style={styles.readOnlyText} numberOfLines={2}>
                        {autoWorkshopFromBatch || editingPayment?.workshopName || ""}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </ScrollView>

              {/* Modal Footer: novo = Pagar (PIX), edição = Salvar */}
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
                {editingPayment ? (
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveEdit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={handleNewPaymentPay}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="payment" size={20} color="#FFFFFF" />
                        <Text style={styles.payButtonText}>{t("payments.payCta")}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={pixModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setPixModalVisible(false);
            setPixView(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.pixModalBox]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("payments.pixModalTitle")}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPixModalVisible(false);
                    setPixView(null);
                  }}
                >
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {pixView ? (
                  <>
                    <Text style={styles.pixDesc}>{pixView.description}</Text>
                    {pixView.totalCharged != null && pixView.totalCharged > 0 ? (
                      <Text style={styles.pixTotalLine}>
                        {formatCurrency(pixView.totalCharged)}
                      </Text>
                    ) : null}
                    {pixView.totalCharged != null &&
                    pixView.totalCharged > 0 &&
                    (pixView.platformFeeAmount != null || pixView.feePercent != null) ? (
                      <Text style={styles.pixSubLine}>
                        {t("payments.fee2_5Title").replace(
                          "{pct}",
                          String(
                            pixView.feePercent != null
                              ? pixView.feePercent
                              : MARKETPLACE_FEE_PERCENT
                          )
                        )}
                        {pixView.platformFeeAmount != null && pixView.platformFeeAmount > 0
                          ? ` · ${t("payments.platformFeeLabel")}: ${formatCurrency(
                              pixView.platformFeeAmount
                            )}`
                          : null}
                      </Text>
                    ) : null}
                    {pixView.platformFeeAmount != null &&
                    pixView.platformFeeAmount > 0 &&
                    !(pixView.totalCharged != null && pixView.totalCharged > 0) ? (
                      <Text style={styles.pixFee}>
                        {t("payments.platformFeeLabel")}:{" "}
                        {formatCurrency(pixView.platformFeeAmount)}
                      </Text>
                    ) : null}
                    {pixView.pixEncodedImage ? (
                      <Image
                        source={{
                          uri: `data:image/png;base64,${pixView.pixEncodedImage}`,
                        }}
                        style={styles.pixQr}
                        resizeMode="contain"
                      />
                    ) : null}
                    {pixView.invoiceUrl ? (
                      <>
                        <TouchableOpacity
                          style={styles.pixCopyLinkBtn}
                          onPress={() => copyPaymentLink(pixView.invoiceUrl!)}
                        >
                          <MaterialIcons name="link" size={20} color="#FFFFFF" />
                          <Text style={styles.pixCopyLinkBtnText}>
                            {t("payments.copyPayLink")}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.pixHint}>{t("payments.payLinkForBank")}</Text>
                        <TouchableOpacity
                          style={styles.pixLinkBtn}
                          onPress={() => Linking.openURL(pixView.invoiceUrl!)}
                        >
                          <MaterialIcons name="open-in-new" size={18} color="#6366F1" />
                          <Text style={styles.pixLinkText}>{t("payments.pixOpenInvoice")}</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    {pixView.pixCopyPaste ? (
                      <TouchableOpacity
                        style={styles.pixCopyBtn}
                        onPress={() => copyPixCode(pixView.pixCopyPaste!)}
                      >
                        <MaterialIcons name="content-copy" size={18} color="#FFFFFF" />
                        <Text style={styles.pixCopyBtnText}>{t("payments.pixCopy")}</Text>
                      </TouchableOpacity>
                    ) : pixView.invoiceUrl ? (
                      <Text style={styles.pixHint}>{t("payments.pixUseInvoiceLink")}</Text>
                    ) : null}
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    maxWidth: "88%",
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
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterContent: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  filterButtonActive: {
    borderColor: "#6366F1",
    backgroundColor: "#F0F4FF",
    borderWidth: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#6366F1",
    fontWeight: "600",
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
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#6366F1",
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
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
    gap: 12,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  paymentDescription: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  statusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  statusBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  amountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginLeft: 8,
  },
  cardInfo: {
    gap: 8,
    marginBottom: 12,
    paddingTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#6B7280",
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  pixButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#6366F1",
  },
  pixButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  markPaidButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  markPaidText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  pixModalBox: {
    maxHeight: "88%",
    width: "92%",
    maxWidth: 420,
  },
  feeNoticeBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  feeNoticeText: {
    fontSize: 12,
    color: "#166534",
    lineHeight: 16,
  },
  pixDesc: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  pixTotalLine: {
    fontSize: 20,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 4,
  },
  pixSubLine: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 12,
  },
  pixFee: {
    fontSize: 13,
    color: "#4F46E5",
    marginBottom: 12,
  },
  pixQr: {
    width: 220,
    height: 220,
    alignSelf: "center",
    marginVertical: 12,
  },
  pixCopyLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0D9488",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  pixCopyLinkBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pixLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  pixLinkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6366F1",
  },
  pixCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  pixCopyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pixHint: {
    fontSize: 13,
    color: "#6B7280",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
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
    maxHeight: 480,
  },
  descFieldWrap: {
    position: "relative",
    zIndex: 20,
    elevation: 12,
  },
  batchDescDropdown: {
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
    elevation: 8,
  },
  batchDescDropdownList: {
    maxHeight: 200,
  },
  batchDescDropdownEmpty: {
    padding: 14,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  batchDescDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  batchDescDropdownTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  batchDescDropdownMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#9CA3AF",
    lineHeight: 15,
  },
  readOnlyField: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  readOnlyFieldPending: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  readOnlyText: {
    flex: 1,
    fontSize: 16,
    color: "#065F46",
    fontWeight: "600",
  },
  readOnlyPlaceholder: {
    color: "#9CA3AF",
    fontWeight: "400",
  },
  inputGroup: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  optionalLabel: {
    fontWeight: "400",
    color: "#9CA3AF",
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
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
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
  payButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
