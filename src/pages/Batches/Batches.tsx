import React, { useState, useEffect } from "react";
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
  createBatch,
  getBatchesByUser,
  updateBatch,
  deleteBatch,
  getBatchStatistics,
} from "../../services/batchService";
import { Batch, CreateBatchData, BatchStatus } from "../../types/batch";
import { getWorkshopsByUser } from "../../services/workshopService";
import { Workshop } from "../../types/workshop";

export default function Batches() {
  const { user } = useAuth();
  const { t } = useLanguage();

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

  useEffect(() => {
    if (user?.id) {
      loadBatches();
      loadWorkshops();
    }
  }, [user]);

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
    if (batch) {
      setEditingBatch(batch);
      setName(batch.name);
      setTotalPiecesInput(batch.totalPieces.toString());
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
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
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
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = t("batches.nameRequired");
    }

    const pieces = parseInt(totalPiecesInput);
    if (!totalPiecesInput || isNaN(pieces) || pieces <= 0) {
      newErrors.totalPieces = t("batches.piecesRequired");
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

      const batchData: CreateBatchData = {
        name: name.trim(),
        totalPieces: parseInt(totalPiecesInput),
        status,
        workshopId: selectedWorkshopId || undefined,
        workshopName: selectedWorkshop?.name || undefined,
        deliveryDate: deliveryDate
          ? (() => {
              const [day, month, year] = deliveryDate.split("/");
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            })()
          : undefined,
        observations: observations.trim() || undefined,
      };

      if (editingBatch) {
        await updateBatch(editingBatch.id, batchData);
        Alert.alert(t("common.success"), t("batches.updateSuccess"));
      } else {
        await createBatch(user.id, batchData);
        Alert.alert(t("common.success"), t("batches.createSuccess"));
      }

      await loadBatches();
      closeModal();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao salvar lote");
    } finally {
      setSubmitting(false);
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

  const getStatusColor = (status: BatchStatus) => {
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
    return t(`batches.status.${status}`);
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
            <Text style={styles.title}>{t("batches.title")}</Text>
            <Text style={styles.subtitle}>
              {totalBatches} {t("batches.registered")} • {totalPieces}{" "}
              {t("batches.totalPieces")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openModal()}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Statistics Cards */}
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

        {/* Batches List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
            batches.map((batch, index) => (
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
                      onPress={() => handleDelete(batch)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Status Badge */}
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(batch.status)}20` },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(batch.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(batch.status) },
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
            ))
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
              >
                {/* Nome */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("batches.name")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="inventory"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder={t("batches.namePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
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

                {/* Status */}
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
                            borderColor: getStatusColor(statusOption),
                            backgroundColor:
                              status === statusOption
                                ? `${getStatusColor(statusOption)}20`
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
                                  ? getStatusColor(statusOption)
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
                                  ? getStatusColor(statusOption)
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

                {/* Data de Entrega */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {t("batches.deliveryDate")} ({t("batches.optional")})
                  </Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="event" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={deliveryDate}
                      onChangeText={setDeliveryDate}
                      placeholder={t("batches.deliveryDatePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
