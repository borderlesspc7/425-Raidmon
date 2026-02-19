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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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
import { Workshop } from "../../types/workshop";
import { Batch } from "../../types/batch";

export default function Payments() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all");

  // Statistics
  const [totalPending, setTotalPending] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  // Form state
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

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

      // Calcular estatísticas
      let pending = 0,
        paid = 0,
        overdue = 0,
        amount = 0;
      paymentsData.forEach((p) => {
        amount += p.amount;
        if (p.status === "pending") pending++;
        else if (p.status === "paid") paid++;
        else if (p.status === "overdue") overdue++;
      });
      setTotalPending(pending);
      setTotalPaid(paid);
      setTotalOverdue(overdue);
      setTotalAmount(amount);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao carregar pagamentos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription("");
    setAmountInput("");
    setDueDate("");
    setPaidDate("");
    setStatus("pending");
    setSelectedWorkshopId("");
    setSelectedBatchId("");
    setErrors({});
  };

  const openModal = (payment?: Payment) => {
    resetForm();
    if (payment) {
      setEditingPayment(payment);
      setDescription(payment.description);
      setAmountInput(formatAmountInput(payment.amount));
      setDueDate(formatDateForInput(payment.dueDate));
      setPaidDate(payment.paidDate ? formatDateForInput(payment.paidDate) : "");
      setStatus(payment.status);
      setSelectedWorkshopId(payment.workshopId || "");
      setSelectedBatchId(payment.batchId || "");
    } else {
      setEditingPayment(null);
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingPayment(null);
    resetForm();
  };

  const formatAmountInput = (value: number) => {
    return value.toFixed(2).replace(".", ",");
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

  const formatDateForInput = (date: Date) => {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
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

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!description.trim() || description.trim().length < 3) {
      newErrors.description = t("payments.descriptionRequired");
    }
    const parsedAmount = parseAmount(amountInput);
    if (!amountInput || parsedAmount <= 0) {
      newErrors.amount = t("payments.amountRequired");
    }
    if (!dueDate || dueDate.replace(/\D/g, "").length < 8) {
      newErrors.dueDate = t("payments.dueDateRequired");
    } else if (!parseDate(dueDate)) {
      newErrors.dueDate = t("payments.dueDateInvalid");
    }
    if (paidDate && paidDate.replace(/\D/g, "").length > 0) {
      if (paidDate.replace(/\D/g, "").length < 8 || !parseDate(paidDate)) {
        newErrors.paidDate = t("payments.paidDateInvalid");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      const parsedDueDate = parseDate(dueDate)!;
      const parsedPaidDate = paidDate ? parseDate(paidDate) || undefined : undefined;

      const selectedWorkshop = workshops.find((w) => w.id === selectedWorkshopId);
      const selectedBatch = batches.find((b) => b.id === selectedBatchId);

      const paymentData: CreatePaymentData = {
        description: description.trim(),
        amount: parseAmount(amountInput),
        dueDate: parsedDueDate,
        paidDate: parsedPaidDate,
        status,
        workshopId: selectedWorkshopId || undefined,
        workshopName: selectedWorkshop?.name || undefined,
        batchId: selectedBatchId || undefined,
        batchName: selectedBatch?.name || undefined,
      };

      if (editingPayment) {
        await updatePayment(editingPayment.id, paymentData);
        Alert.alert(t("common.success"), t("payments.updateSuccess"));
      } else {
        await createPayment(user.id, paymentData);
        Alert.alert(t("common.success"), t("payments.createSuccess"));
      }

      closeModal();
      loadData();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao salvar pagamento");
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

  const getStatusLabel = (s: PaymentStatus) =>
    t(`payments.status.${s}` as any);

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

  const filteredPayments =
    filterStatus === "all"
      ? payments
      : payments.filter((p) => p.status === filterStatus);

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
            <Text style={styles.title}>{t("payments.title")}</Text>
            <Text style={styles.subtitle}>
              {payments.length} {t("payments.registered")} •{" "}
              {formatCurrency(totalAmount)}
            </Text>
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
            <Text style={styles.statValue}>{totalPending}</Text>
            <Text style={styles.statLabel}>{t("payments.pending")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="check-circle" size={22} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{totalPaid}</Text>
            <Text style={styles.statLabel}>{t("payments.paid")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#FEE2E2" }]}>
              <MaterialIcons name="warning" size={22} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>{totalOverdue}</Text>
            <Text style={styles.statLabel}>{t("payments.overdue")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "#F0F4FF" }]}>
              <MaterialIcons name="account-balance-wallet" size={22} color="#6366F1" />
            </View>
            <Text style={[styles.statValue, { fontSize: 14 }]}>
              {formatCurrency(totalAmount)}
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
            filteredPayments.map((payment) => (
              <View
                key={payment.id}
                style={[
                  styles.paymentCard,
                  { borderLeftColor: getStatusBorderColor(payment.status) },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.statusIconContainer,
                        { backgroundColor: getStatusBg(payment.status) },
                      ]}
                    >
                      <MaterialIcons
                        name={getStatusIcon(payment.status) as any}
                        size={20}
                        color={getStatusColor(payment.status)}
                      />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.paymentDescription} numberOfLines={1}>
                        {payment.description}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusBg(payment.status) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: getStatusColor(payment.status) },
                          ]}
                        >
                          {getStatusLabel(payment.status)}
                        </Text>
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
                </View>

                {/* Card Actions */}
                <View style={styles.cardActions}>
                  {payment.status === "pending" && (
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
            ))
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
              >
                {/* Descrição */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("payments.description")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="description" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={description}
                      onChangeText={setDescription}
                      placeholder={t("payments.descriptionPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {errors.description && (
                    <Text style={styles.errorText}>{errors.description}</Text>
                  )}
                </View>

                {/* Valor */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("payments.amount")}</Text>
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
                  {errors.amount && (
                    <Text style={styles.errorText}>{errors.amount}</Text>
                  )}
                </View>

                {/* Data de Vencimento */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("payments.dueDate")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="event" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={dueDate}
                      onChangeText={(text) =>
                        setDueDate(formatDateInput(text))
                      }
                      placeholder={t("payments.dueDatePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>
                  {errors.dueDate && (
                    <Text style={styles.errorText}>{errors.dueDate}</Text>
                  )}
                </View>

                {/* Status */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("payments.statusLabel")}</Text>
                  <View style={styles.statusOptions}>
                    {(["pending", "paid", "overdue", "cancelled"] as PaymentStatus[]).map(
                      (s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.statusOption,
                            status === s && {
                              borderColor: getStatusColor(s),
                              backgroundColor: getStatusBg(s),
                            },
                          ]}
                          onPress={() => setStatus(s)}
                        >
                          <MaterialIcons
                            name={getStatusIcon(s) as any}
                            size={16}
                            color={
                              status === s ? getStatusColor(s) : "#6B7280"
                            }
                          />
                          <Text
                            style={[
                              styles.statusOptionText,
                              status === s && {
                                color: getStatusColor(s),
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {getStatusLabel(s)}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                {/* Data de Pagamento (opcional) */}
                {(status === "paid" || editingPayment?.paidDate) && (
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

                {/* Oficina (opcional) */}
                {workshops.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {t("payments.workshop")}{" "}
                      <Text style={styles.optionalLabel}>
                        ({t("payments.optional")})
                      </Text>
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.selectorContent}
                    >
                      <TouchableOpacity
                        style={[
                          styles.selectorOption,
                          selectedWorkshopId === "" && styles.selectorOptionActive,
                        ]}
                        onPress={() => setSelectedWorkshopId("")}
                      >
                        <Text
                          style={[
                            styles.selectorOptionText,
                            selectedWorkshopId === "" &&
                              styles.selectorOptionTextActive,
                          ]}
                        >
                          Nenhuma
                        </Text>
                      </TouchableOpacity>
                      {workshops.map((w) => (
                        <TouchableOpacity
                          key={w.id}
                          style={[
                            styles.selectorOption,
                            selectedWorkshopId === w.id &&
                              styles.selectorOptionActive,
                          ]}
                          onPress={() => setSelectedWorkshopId(w.id)}
                        >
                          <Text
                            style={[
                              styles.selectorOptionText,
                              selectedWorkshopId === w.id &&
                                styles.selectorOptionTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {w.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Lote (opcional) */}
                {batches.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      {t("payments.batch")}{" "}
                      <Text style={styles.optionalLabel}>
                        ({t("payments.optional")})
                      </Text>
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.selectorContent}
                    >
                      <TouchableOpacity
                        style={[
                          styles.selectorOption,
                          selectedBatchId === "" && styles.selectorOptionActive,
                        ]}
                        onPress={() => setSelectedBatchId("")}
                      >
                        <Text
                          style={[
                            styles.selectorOptionText,
                            selectedBatchId === "" &&
                              styles.selectorOptionTextActive,
                          ]}
                        >
                          Nenhum
                        </Text>
                      </TouchableOpacity>
                      {batches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[
                            styles.selectorOption,
                            selectedBatchId === b.id &&
                              styles.selectorOptionActive,
                          ]}
                          onPress={() => setSelectedBatchId(b.id)}
                        >
                          <Text
                            style={[
                              styles.selectorOptionText,
                              selectedBatchId === b.id &&
                                styles.selectorOptionTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer */}
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
                    <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
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
    color: "#1F2937",
  },
  modalScroll: {
    maxHeight: 480,
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
  statusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  statusOptionText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  selectorContent: {
    gap: 8,
    paddingVertical: 2,
  },
  selectorOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginRight: 8,
    maxWidth: 160,
  },
  selectorOptionActive: {
    borderColor: "#6366F1",
    backgroundColor: "#F0F4FF",
    borderWidth: 2,
  },
  selectorOptionText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  selectorOptionTextActive: {
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
