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
import { authService } from "../../services/authService";
import { User } from "../../types/auth";

export default function Profile() {
  const { user, login } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setCompanyName(user.companyName || "");
      setPhone(user.phone || "");
      setCpf(user.cpf || "");
      setRg(user.rg || "");
    }
  }, [user]);

  const openModal = () => {
    if (user) {
      setName(user.name || "");
      setCompanyName(user.companyName || "");
      setPhone(user.phone || "");
      setCpf(user.cpf || "");
      setRg(user.rg || "");
    }
    setErrors({});
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    if (user) {
      setName(user.name || "");
      setCompanyName(user.companyName || "");
      setPhone(user.phone || "");
      setCpf(user.cpf || "");
      setRg(user.rg || "");
    }
    setErrors({});
  };

  const formatPhone = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const formatCPF = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 6) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    } else if (numbers.length <= 9) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    } else {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    }
  };

  const formatRG = (text: string) => {
    const numbers = text.replace(/\D/g, "");
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 5) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    } else if (numbers.length <= 8) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}-${numbers.slice(8, 9)}`;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = t("profile.nameRequired");
    }

    if (!phone.trim()) {
      newErrors.phone = t("profile.phoneRequired");
    } else {
      const phoneNumbers = phone.replace(/\D/g, "");
      if (phoneNumbers.length < 10) {
        newErrors.phone = t("profile.phoneInvalid");
      }
    }

    if (!cpf.trim()) {
      newErrors.cpf = t("profile.cpfRequired");
    } else {
      const cpfNumbers = cpf.replace(/\D/g, "");
      if (cpfNumbers.length !== 11) {
        newErrors.cpf = t("profile.cpfInvalid");
      }
    }

    if (!rg.trim()) {
      newErrors.rg = t("profile.rgRequired");
    } else {
      const rgNumbers = rg.replace(/\D/g, "");
      if (rgNumbers.length < 7) {
        newErrors.rg = t("profile.rgInvalid");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      const updateData: Partial<User> = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        phone: phone.trim(),
        cpf: cpf.replace(/\D/g, ""),
        rg: rg.replace(/\D/g, ""),
      };

      await authService.updateProfile(user.id, updateData);
      
      // O observeAuthState do AuthContext atualizará automaticamente os dados do usuário
      Alert.alert(t("common.success"), t("profile.updateSuccess"));
      closeModal();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || t("profile.updateError"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  if (!user) {
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
            <Text style={styles.title}>{t("profile.title")}</Text>
            <Text style={styles.subtitle}>{t("profile.subtitle")}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={openModal}
          >
            <MaterialIcons name="edit" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                {user.photoURL ? (
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={48} color="#6366F1" />
                  </View>
                ) : (
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={48} color="#6366F1" />
                  </View>
                )}
              </View>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
              {/* Company Name */}
              {user.companyName && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <MaterialIcons name="business" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t("profile.companyName")}</Text>
                    <Text style={styles.infoValue}>{user.companyName}</Text>
                  </View>
                </View>
              )}

              {/* Phone */}
              {user.phone && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <MaterialIcons name="phone" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t("profile.phone")}</Text>
                    <Text style={styles.infoValue}>{user.phone}</Text>
                  </View>
                </View>
              )}

              {/* CPF */}
              {user.cpf && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <MaterialIcons name="badge" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t("profile.cpf")}</Text>
                    <Text style={styles.infoValue}>
                      {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                    </Text>
                  </View>
                </View>
              )}

              {/* RG */}
              {user.rg && (
                <View style={styles.infoItem}>
                  <View style={styles.infoIconContainer}>
                    <MaterialIcons name="credit-card" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t("profile.rg")}</Text>
                    <Text style={styles.infoValue}>
                      {user.rg.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, "$1.$2.$3-$4")}
                    </Text>
                  </View>
                </View>
              )}

              {/* Account Info */}
              <View style={styles.divider} />
              <View style={styles.infoItem}>
                <View style={styles.infoIconContainer}>
                  <MaterialIcons name="calendar-today" size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t("profile.memberSince")}</Text>
                  <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Modal de Edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t("profile.edit")}</Text>
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
                  <Text style={styles.label}>{t("profile.name")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="person"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder={t("profile.namePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>

                {/* Nome da Empresa */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("profile.companyName")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="business"
                      size={20}
                      color="#6B7280"
                    />
                    <TextInput
                      style={styles.input}
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder={t("profile.companyNamePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Telefone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("profile.phone")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={phone}
                      onChangeText={(text) => setPhone(formatPhone(text))}
                      placeholder={t("profile.phonePlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                  {errors.phone && (
                    <Text style={styles.errorText}>{errors.phone}</Text>
                  )}
                </View>

                {/* CPF */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("profile.cpf")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="badge" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={cpf}
                      onChangeText={(text) => setCpf(formatCPF(text))}
                      placeholder={t("profile.cpfPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={14}
                    />
                  </View>
                  {errors.cpf && (
                    <Text style={styles.errorText}>{errors.cpf}</Text>
                  )}
                </View>

                {/* RG */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t("profile.rg")}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="credit-card" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={rg}
                      onChangeText={(text) => setRg(formatRG(text))}
                      placeholder={t("profile.rgPlaceholder")}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={12}
                    />
                  </View>
                  {errors.rg && (
                    <Text style={styles.errorText}>{errors.rg}</Text>
                  )}
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
  editButton: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  infoSection: {
    gap: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
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
});
