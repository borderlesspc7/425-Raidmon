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
  createCut,
  getCutsByUser,
  updateCut,
  deleteCut,
  getCutStatistics,
} from "../../services/cutService";
import { Cut, CreateCutData } from "../../types/cut";

export default function Cuts() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [cuts, setCuts] = useState<Cut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCut, setEditingCut] = useState<Cut | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Statistics
  const [totalCuts, setTotalCuts] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);

  // Form state
  const [type, setType] = useState("");
  const [totalPiecesInput, setTotalPiecesInput] = useState("");
  const [observations, setObservations] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadCuts();
  }, [user]);

  const loadCuts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [cutsData, stats] = await Promise.all([
        getCutsByUser(user.id),
        getCutStatistics(user.id),
      ]);

      setCuts(cutsData);
      setTotalCuts(stats.totalCuts);
      setTotalPieces(stats.totalPieces);
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || "Erro ao carregar cortes",
      );
    } finally {
      setLoading(false);
    }
  };

  const openModal = (cut?: Cut) => {
    if (cut) {
      setEditingCut(cut);
      setType(cut.type);
      setTotalPiecesInput(cut.totalPieces.toString());
      setObservations(cut.observations || "");
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
    setEditingCut(null);
    setType("");
    setTotalPiecesInput("");
    setObservations("");
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!type.trim() || type.trim().length < 3) {
      newErrors.type = t("cuts.typeRequired");
    }

    const pieces = parseInt(totalPiecesInput);
    if (!totalPiecesInput || isNaN(pieces) || pieces <= 0) {
      newErrors.totalPieces = t("cuts.piecesRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      const cutData: CreateCutData = {
        type: type.trim(),
        totalPieces: parseInt(totalPiecesInput),
        observations: observations.trim() || undefined,
      };

      if (editingCut) {
        await updateCut(editingCut.id, cutData);
        Alert.alert(t("common.success"), t("cuts.updateSuccess"));
      } else {
        await createCut(user.id, cutData);
        Alert.alert(t("common.success"), t("cuts.createSuccess"));
      }

      await loadCuts();
      closeModal();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao salvar corte");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (cut: Cut) => {
    Alert.alert(
      t("cuts.deleteTitle"),
      t("cuts.deleteConfirm").replace("{type}", cut.type),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("cuts.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCut(cut.id);
              Alert.alert(t("common.success"), t("cuts.deleteSuccess"));
              await loadCuts();
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
            <Text style={styles.title}>{t("cuts.title")}</Text>
            <Text style={styles.subtitle}>
              {totalCuts} {t("cuts.registered")} • {totalPieces}{" "}
              {t("cuts.totalPieces")}
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
              <MaterialIcons name="content-cut" size={24} color="#6366F1" />
            </View>
            <Text style={styles.statValue}>{totalCuts}</Text>
            <Text style={styles.statLabel}>{t("cuts.totalCuts")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialIcons name="inventory" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{totalPieces}</Text>
            <Text style={styles.statLabel}>{t("cuts.pieces")}</Text>
          </View>
        </View>

        {/* Cuts List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {cuts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="content-cut" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>{t("cuts.empty")}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => openModal()}
              >
                <Text style={styles.emptyButtonText}>{t("cuts.addFirst")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cuts.map((cut, index) => (
              <View key={cut.id} style={styles.cutCard}>
                {/* Header do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.cutNumber}>
                      <Text style={styles.cutNumberText}>
                        #{cuts.length - index}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.cutType} numberOfLines={1}>
                        {cut.type}
                      </Text>
                      <Text style={styles.cutDate}>
                        {formatDate(cut.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => openModal(cut)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="edit" size={20} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(cut)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={styles.infoLabel}>{t("cuts.quantity")}:</Text>
                    <Text style={styles.infoValue}>
                      {cut.totalPieces} {t("cuts.pieces")}
                    </Text>
                  </View>
                  {cut.observations && (
                    <View style={styles.observationsContainer}>
                      <MaterialIcons name="notes" size={18} color="#6B7280" />
                      <Text style={styles.observationsLabel}>
                        {t("cuts.observations")}:
                      </Text>
                      <Text style={styles.observationsText} numberOfLines={3}>
                        {cut.observations}
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
                  {editingCut ? t("cuts.edit") : t("cuts.add")}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <MaterialIcons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Tipo/Modelo */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("cuts.type")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="content-cut"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      style={styles.input}
                      value={type}
                      onChangeText={setType}
                      placeholder={t("cuts.typePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {errors.type && (
                    <Text style={styles.errorText}>{errors.type}</Text>
                  )}
                </View>

                {/* Quantidade de Peças */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("cuts.quantity")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="inventory" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={totalPiecesInput}
                      onChangeText={setTotalPiecesInput}
                      placeholder={t("cuts.quantityPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                    />
                  </View>
                  {errors.totalPieces && (
                    <Text style={styles.errorText}>{errors.totalPieces}</Text>
                  )}
                </View>

                {/* Observações */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("cuts.observations")}</Text>
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
                      placeholder={t("cuts.observationsPlaceholder")}
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
  },
  statCard: {
    flex: 1,
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
  cutCard: {
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
  cutNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cutNumberText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6366F1",
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cutType: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  cutDate: {
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
