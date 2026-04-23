import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  createReceivePieces,
  getReceivePiecesByUser,
  updateReceivePieces,
  deleteReceivePieces,
  getReceivePiecesStatistics,
  sumPiecesReceivedInCalendarMonth,
} from "../../services/receivePiecesService";
import { getEffectiveUserPlan, getMonthlyPiecesLimit } from "../../utils/planEntitlements";
import { ReceivePieces as ReceivePiecesType, CreateReceivePiecesData } from "../../types/receivePieces";
import { getBatchesByUser } from "../../services/batchService";
import { Batch } from "../../types/batch";
import { getBatchById } from "../../services/batchService";
import { getWorkshopById } from "../../services/workshopService";
import { prepareReceiveForWorkshopApproval } from "../../services/receiveCheckoutFunctions";
import * as Linking from "expo-linking";

type QualityType = 'excellent' | 'good' | 'regular' | 'poor';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function moneyBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
}

export default function ReceivePieces() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [receives, setReceives] = useState<ReceivePiecesType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReceive, setEditingReceive] = useState<ReceivePiecesType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Statistics
  const [totalReceives, setTotalReceives] = useState(0);
  const [totalPiecesReceived, setTotalPiecesReceived] = useState(0);
  const [excellentCount, setExcellentCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [regularCount, setRegularCount] = useState(0);
  const [poorCount, setPoorCount] = useState(0);

  // Form state
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [piecesReceivedInput, setPiecesReceivedInput] = useState("");
  const [receiveDate, setReceiveDate] = useState("");
  const [quality, setQuality] = useState<QualityType>("good");
  const [observations, setObservations] = useState("");
  const [defectiveInput, setDefectiveInput] = useState("0");
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const selectedBatchForForm = batches.find((b) => b.id === selectedBatchId);
  const computedChecklistTotal = useMemo(() => {
    const pieces = parseInt(piecesReceivedInput, 10) || 0;
    const def = parseInt(defectiveInput, 10) || 0;
    const good = Math.max(0, pieces - def);
    const p = selectedBatchForForm?.pricePerPiece;
    if (p == null || !Number.isFinite(p)) return null;
    return round2(good * p);
  }, [piecesReceivedInput, defectiveInput, selectedBatchForForm?.pricePerPiece]);

  useEffect(() => {
    if (user?.id) {
      loadReceives();
      loadBatches();
    }
  }, [user]);

  const loadBatches = async () => {
    if (!user?.id) return;

    try {
      const data = await getBatchesByUser(user.id);
      // Filtrar apenas lotes em produção ou concluídos
      const availableBatches = data.filter(
        (batch) => batch.status === "in_progress" || batch.status === "completed"
      );
      setBatches(availableBatches);
    } catch (error: any) {
      console.error("Erro ao carregar lotes:", error);
    }
  };

  const loadReceives = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [receivesData, stats] = await Promise.all([
        getReceivePiecesByUser(user.id),
        getReceivePiecesStatistics(user.id),
      ]);

      setReceives(receivesData);
      setTotalReceives(stats.totalReceives);
      setTotalPiecesReceived(stats.totalPiecesReceived);
      setExcellentCount(stats.excellentCount);
      setGoodCount(stats.goodCount);
      setRegularCount(stats.regularCount);
      setPoorCount(stats.poorCount);
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || "Erro ao carregar recebimentos",
      );
    } finally {
      setLoading(false);
    }
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

  const formatDateInput = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4)
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const formatTodayInput = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const handleOpenModal = (receive?: ReceivePiecesType) => {
    if (receive) {
      setEditingReceive(receive);
      setSelectedBatchId(receive.batchId);
      setPiecesReceivedInput(receive.piecesReceived.toString());
      setDefectiveInput(
        receive.defectivePieces != null ? String(receive.defectivePieces) : "0",
      );
      setReceiveDate(formatDateOnly(receive.receiveDate));
      setQuality(receive.quality);
      setObservations(receive.observations || "");
    } else {
      resetForm();
      setReceiveDate(formatTodayInput());
    }
    setErrors({});
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingReceive(null);
    resetForm();
  };

  const resetForm = () => {
    setSelectedBatchId("");
    setPiecesReceivedInput("");
    setDefectiveInput("0");
    setReceiveDate("");
    setQuality("good");
    setObservations("");
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!selectedBatchId) {
      newErrors.batchId = t("receivePieces.batchRequired");
    }

    const pieces = parseInt(piecesReceivedInput, 10);
    if (!piecesReceivedInput || isNaN(pieces) || pieces <= 0) {
      newErrors.piecesReceived = t("receivePieces.piecesRequired");
    }
    if (defectiveInput) {
      const d = parseInt(defectiveInput, 10);
      if (isNaN(d) || d < 0) {
        newErrors.defective = t("receivePieces.defectiveInvalid");
      } else if (!isNaN(pieces) && d > pieces) {
        newErrors.defective = t("receivePieces.defectiveTooMany");
      }
    }

    if (!receiveDate) {
      newErrors.receiveDate = t("receivePieces.dateRequired");
    } else {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const match = receiveDate.match(dateRegex);
      if (!match) {
        newErrors.receiveDate = t("receivePieces.dateInvalid");
      } else {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        if (
          day < 1 ||
          day > 31 ||
          month < 1 ||
          month > 12 ||
          year < 2000 ||
          year > 2100
        ) {
          newErrors.receiveDate = t("receivePieces.dateInvalid");
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

      const selectedBatch = batches.find((b) => b.id === selectedBatchId);
      if (!selectedBatch) {
        throw new Error("Lote não encontrado");
      }

      // Converter data string para Date
      const [day, month, year] = receiveDate.split("/").map(Number);
      const receiveDateObj = new Date(year, month - 1, day);

      const piecesCount = parseInt(piecesReceivedInput, 10);
      const ent = getEffectiveUserPlan(user?.plan);
      const monthlyLimit = getMonthlyPiecesLimit(ent);
      if (monthlyLimit != null) {
        const inMonth = sumPiecesReceivedInCalendarMonth(
          receives,
          receiveDateObj,
          editingReceive?.id
        );
        if (inMonth + piecesCount > monthlyLimit) {
          Alert.alert(
            t("receivePieces.monthlyLimitTitle"),
            t("receivePieces.monthlyLimitMessage")
              .replace("{current}", String(inMonth))
              .replace("{add}", String(piecesCount))
              .replace("{limit}", String(monthlyLimit))
          );
          return;
        }
      }

      const defN = Math.max(0, parseInt(defectiveInput || "0", 10) || 0);
      const goodPieces = Math.max(0, piecesCount - defN);
      const up = selectedBatch.pricePerPiece;
      const amountDue =
        up != null && Number.isFinite(up) ? round2(goodPieces * up) : undefined;
      const unit = up != null && Number.isFinite(up) ? up : undefined;

      const receiveData: CreateReceivePiecesData = {
        batchId: selectedBatchId,
        batchName: selectedBatch.name,
        workshopId: selectedBatch.workshopId,
        workshopName: selectedBatch.workshopName,
        piecesReceived: piecesCount,
        defectivePieces: defN,
        receiveDate: receiveDateObj,
        quality,
        observations: observations.trim() || undefined,
        unitPriceAtReceive: unit,
        amountDue,
        workshopApprovalStatus: "none",
      };

      if (editingReceive) {
        await updateReceivePieces(editingReceive.id, receiveData);
        Alert.alert(t("common.success"), t("receivePieces.updateSuccess"));
      } else {
        await createReceivePieces(user.id, receiveData);
        Alert.alert(t("common.success"), t("receivePieces.createSuccess"));
      }

      handleCloseModal();
      loadReceives();
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || t("receivePieces.createError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (receive: ReceivePiecesType) => {
    Alert.alert(
      t("receivePieces.deleteTitle"),
      t("receivePieces.deleteConfirm").replace("{batch}", receive.batchName),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("receivePieces.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReceivePieces(receive.id);
              Alert.alert(
                t("common.success"),
                t("receivePieces.deleteSuccess")
              );
              loadReceives();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ]
    );
  };

  const isOwnerUser = user?.userType !== "workshop";

  const handleRequestWorkshopApproval = async (receive: ReceivePiecesType) => {
    setApprovalBusyId(receive.id);
    try {
      await prepareReceiveForWorkshopApproval(receive.id);
      await loadReceives();
      Alert.alert(t("common.success"), t("receivePieces.approvalSent"));
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setApprovalBusyId(null);
    }
  };

  const handleShareWhatsapp = async (receive: ReceivePiecesType) => {
    setApprovalBusyId(receive.id);
    try {
      let token = receive.checkoutToken;
      const needPrepare =
        !token ||
        !receive.workshopApprovalStatus ||
        receive.workshopApprovalStatus === "none";
      if (needPrepare) {
        const res = await prepareReceiveForWorkshopApproval(receive.id);
        token = res.token;
        await loadReceives();
      }
      if (!token) {
        Alert.alert(t("common.error"), t("receivePieces.prepareApprovalFirst"));
        return;
      }
      const b = await getBatchById(receive.batchId);
      if (!b?.workshopId) {
        Alert.alert(t("common.error"), t("receivePieces.shareWhatsappNeedPhone"));
        return;
      }
      const w = await getWorkshopById(b.workshopId);
      const raw = w?.contact1 || "";
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10) {
        Alert.alert(t("common.info"), t("receivePieces.shareWhatsappNeedPhone"));
        return;
      }
      const appUrl = `costuraconectada://receiveCheckout?receiveId=${encodeURIComponent(
        receive.id,
      )}&token=${encodeURIComponent(token)}`;
      const text = `${t("receivePieces.whatsappMessage")}\n${appUrl}`;
      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
      await Linking.openURL(waUrl);
    } catch (e: unknown) {
      Alert.alert(t("common.error"), String((e as Error)?.message));
    } finally {
      setApprovalBusyId(null);
    }
  };

  const approvalLabel = (receive: ReceivePiecesType) => {
    const s = receive.workshopApprovalStatus;
    if (s === "pending") return t("receivePieces.approvalPending");
    if (s === "approved") return t("receivePieces.approvalApproved");
    if (s === "rejected") return t("receivePieces.approvalRejected");
    return t("receivePieces.approvalNone");
  };

  const getQualityColor = (qualityValue: QualityType) => {
    switch (qualityValue) {
      case "excellent":
        return "#10B981";
      case "good":
        return "#3B82F6";
      case "regular":
        return "#F59E0B";
      case "poor":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getQualityIcon = (qualityValue: QualityType) => {
    switch (qualityValue) {
      case "excellent":
        return "stars";
      case "good":
        return "thumb-up";
      case "regular":
        return "remove-circle";
      case "poor":
        return "thumb-down";
      default:
        return "help";
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
          <View>
            <Text style={styles.title}>{t("receivePieces.title")}</Text>
            <Text style={styles.subtitle}>
              {totalReceives} {t("receivePieces.registered")} • {totalPiecesReceived}{" "}
              {t("receivePieces.totalPieces")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleOpenModal()}
          >
            <MaterialIcons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="stars" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{excellentCount}</Text>
            <Text style={styles.statLabel}>{t("receivePieces.excellent")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#DBEAFE" }]}>
              <MaterialIcons name="thumb-up" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{goodCount}</Text>
            <Text style={styles.statLabel}>{t("receivePieces.good")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="remove-circle" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{regularCount}</Text>
            <Text style={styles.statLabel}>{t("receivePieces.regular")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FEE2E2" }]}>
              <MaterialIcons name="thumb-down" size={24} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>{poorCount}</Text>
            <Text style={styles.statLabel}>{t("receivePieces.poor")}</Text>
          </View>
        </View>

        {/* Receives List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {receives.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t("receivePieces.empty")}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => handleOpenModal()}
              >
                <Text style={styles.emptyButtonText}>
                  {t("receivePieces.addFirst")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            receives.map((receive) => (
              <View key={receive.id} style={styles.receiveCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.qualityIndicator,
                        { backgroundColor: getQualityColor(receive.quality) },
                      ]}
                    >
                      <MaterialIcons
                        name={getQualityIcon(receive.quality) as any}
                        size={20}
                        color="#FFF"
                      />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.batchName} numberOfLines={1}>
                        {receive.batchName}
                      </Text>
                      <Text style={styles.receiveDate}>
                        {formatDateOnly(receive.receiveDate)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleOpenModal(receive)}
                    >
                      <MaterialIcons name="edit" size={20} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(receive)}
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={styles.infoLabel}>
                      {t("receivePieces.quantity")}:
                    </Text>
                    <Text style={styles.infoValue}>
                      {receive.piecesReceived} {t("receivePieces.pieces")}
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <MaterialIcons
                      name={getQualityIcon(receive.quality) as any}
                      size={18}
                      color={getQualityColor(receive.quality)}
                    />
                    <Text style={styles.infoLabel}>
                      {t("receivePieces.quality")}:
                    </Text>
                    <Text
                      style={[
                        styles.infoValue,
                        { color: getQualityColor(receive.quality) },
                      ]}
                    >
                      {t(`receivePieces.${receive.quality}`)}
                    </Text>
                  </View>
                  {receive.workshopName && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="business" size={18} color="#6366F1" />
                      <Text style={styles.infoLabel}>
                        {t("receivePieces.workshop")}:
                      </Text>
                      <Text style={styles.infoValue}>{receive.workshopName}</Text>
                    </View>
                  )}
                  {receive.defectivePieces != null && receive.defectivePieces > 0 ? (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="report-problem" size={18} color="#F59E0B" />
                      <Text style={styles.infoLabel}>
                        {t("receivePieces.defectivePieces")}:
                      </Text>
                      <Text style={styles.infoValue}>{receive.defectivePieces}</Text>
                    </View>
                  ) : null}
                  {receive.amountDue != null ? (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="payments" size={18} color="#10B981" />
                      <Text style={styles.infoLabel}>
                        {t("receivePieces.amountAuto")}:
                      </Text>
                      <Text style={[styles.infoValue, { color: "#10B981" }]}>
                        {moneyBRL(receive.amountDue)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.infoItem}>
                    <MaterialIcons name="verified" size={18} color="#6366F1" />
                    <Text style={styles.infoLabel}>{approvalLabel(receive)}</Text>
                  </View>
                  {receive.observations && (
                    <View style={styles.observationsContainer}>
                      <MaterialIcons name="notes" size={18} color="#6B7280" />
                      <Text style={styles.observationsLabel}>
                        {t("receivePieces.observations")}:
                      </Text>
                      <Text style={styles.observationsText} numberOfLines={3}>
                        {receive.observations}
                      </Text>
                    </View>
                  )}
                  {isOwnerUser ? (
                    <View style={styles.ownerActions}>
                      <TouchableOpacity
                        style={styles.ownerActionBtn}
                        onPress={() => void handleRequestWorkshopApproval(receive)}
                        disabled={approvalBusyId === receive.id}
                      >
                        {approvalBusyId === receive.id ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.ownerActionText}>
                            {t("receivePieces.requestApproval")}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ownerActionBtn, styles.ownerActionWhatsapp]}
                        onPress={() => void handleShareWhatsapp(receive)}
                        disabled={approvalBusyId === receive.id}
                      >
                        <MaterialIcons name="chat" size={18} color="#FFF" />
                        <Text style={styles.ownerActionText}>
                          {t("receivePieces.shareWhatsapp")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingReceive
                    ? t("receivePieces.edit")
                    : t("receivePieces.add")}
                </Text>
                <TouchableOpacity onPress={handleCloseModal}>
                  <MaterialIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Batch Selection */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.batch")} *
                  </Text>
                  <View style={styles.pickerContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.batchList}
                    >
                      {batches.map((batch) => (
                        <TouchableOpacity
                          key={batch.id}
                          style={[
                            styles.batchOption,
                            selectedBatchId === batch.id &&
                              styles.batchOptionSelected,
                          ]}
                          onPress={() => setSelectedBatchId(batch.id)}
                        >
                          <Text
                            style={[
                              styles.batchOptionText,
                              selectedBatchId === batch.id &&
                                styles.batchOptionTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {batch.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {errors.batchId && (
                    <Text style={styles.errorText}>{errors.batchId}</Text>
                  )}
                </View>

                {/* Pieces Received */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.piecesReceived")} *
                  </Text>
                  <TextInput
                    style={[styles.input, errors.piecesReceived && styles.inputError]}
                    value={piecesReceivedInput}
                    onChangeText={setPiecesReceivedInput}
                    placeholder={t("receivePieces.piecesPlaceholder")}
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  {errors.piecesReceived && (
                    <Text style={styles.errorText}>{errors.piecesReceived}</Text>
                  )}
                </View>

                {/* Defeitos */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.defectivePieces")}{" "}
                    <Text style={styles.optional}>({t("receivePieces.optional")})</Text>
                  </Text>
                  <Text style={styles.fieldHint}>{t("receivePieces.defectiveHint")}</Text>
                  <TextInput
                    style={[styles.input, errors.defective && styles.inputError]}
                    value={defectiveInput}
                    onChangeText={setDefectiveInput}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  {errors.defective && (
                    <Text style={styles.errorText}>{errors.defective}</Text>
                  )}
                </View>

                {computedChecklistTotal != null ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t("receivePieces.amountAuto")}</Text>
                    <Text style={styles.amountPreview}>
                      {moneyBRL(computedChecklistTotal)}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.fieldHint}>{t("receivePieces.requestApprovalHelp")}</Text>

                {/* Receive Date */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.receiveDate")} *
                  </Text>
                  <TextInput
                    style={[styles.input, errors.receiveDate && styles.inputError]}
                    value={receiveDate}
                    onChangeText={(text) => setReceiveDate(formatDateInput(text))}
                    placeholder={t("receivePieces.datePlaceholder")}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholderTextColor="#9CA3AF"
                  />
                  {errors.receiveDate && (
                    <Text style={styles.errorText}>{errors.receiveDate}</Text>
                  )}
                </View>

                {/* Quality */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.quality")} *
                  </Text>
                  <View style={styles.qualityContainer}>
                    {(["excellent", "good", "regular", "poor"] as QualityType[]).map(
                      (q) => (
                        <TouchableOpacity
                          key={q}
                          style={[
                            styles.qualityOption,
                            quality === q && styles.qualityOptionSelected,
                            {
                              borderColor:
                                quality === q ? getQualityColor(q) : "#E5E7EB",
                            },
                          ]}
                          onPress={() => setQuality(q)}
                        >
                          <MaterialIcons
                            name={getQualityIcon(q) as any}
                            size={24}
                            color={quality === q ? getQualityColor(q) : "#6B7280"}
                          />
                          <Text
                            style={[
                              styles.qualityOptionText,
                              quality === q && {
                                color: getQualityColor(q),
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {t(`receivePieces.${q}`)}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                {/* Observations */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {t("receivePieces.observations")}{" "}
                    <Text style={styles.optional}>
                      ({t("receivePieces.optional")})
                    </Text>
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={observations}
                    onChangeText={setObservations}
                    placeholder={t("receivePieces.observationsPlaceholder")}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.cancelButtonText}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("common.save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  addButton: {
    backgroundColor: "#6366F1",
    width: 48,
    height: 48,
    borderRadius: 24,
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
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  receiveCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
  },
  qualityIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  receiveDate: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  cardInfo: {
    gap: 8,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  observationsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  observationsLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  observationsText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
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
    color: "#111827",
  },
  modalScroll: {
    maxHeight: 500,
  },
  formGroup: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    fontWeight: "normal",
    color: "#9CA3AF",
  },
  fieldHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  amountPreview: {
    fontSize: 20,
    fontWeight: "800",
    color: "#10B981",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFF",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  pickerContainer: {
    marginBottom: 4,
  },
  batchList: {
    flexDirection: "row",
  },
  batchOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#FFF",
  },
  batchOptionSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  batchOptionText: {
    fontSize: 14,
    color: "#6B7280",
  },
  batchOptionTextSelected: {
    color: "#6366F1",
    fontWeight: "600",
  },
  qualityContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  qualityOption: {
    flex: 1,
    minWidth: "45%",
    flexDirection: "column",
    alignItems: "center",
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  qualityOptionSelected: {
    backgroundColor: "#F9FAFB",
  },
  qualityOptionText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
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
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#6366F1",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  ownerActions: {
    marginTop: 12,
    gap: 8,
  },
  ownerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 10,
    borderRadius: 8,
  },
  ownerActionWhatsapp: {
    backgroundColor: "#25D366",
  },
  ownerActionText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
