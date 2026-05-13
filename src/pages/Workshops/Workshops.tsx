import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Layout from '../../components/Layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../hooks/useTheme';
import AddressFields, { composeAddressString, type AddressValue } from '../../components/AddressFields/AddressFields';
import ThemedNoticeModal from '../../components/ThemedNoticeModal/ThemedNoticeModal';
import { useNavigation } from '../../routes/NavigationContext';
import { paths } from '../../routes/paths';
import {
  createWorkshop,
  getWorkshopsByUser,
  updateWorkshop,
  deleteWorkshop,
  updateWorkshopStatus,
} from '../../services/workshopService';
import { Workshop, WorkshopStatus, CreateWorkshopData } from '../../types/workshop';
import { canCreateAnotherWorkshop, getEffectiveUserPlan } from '../../utils/planEntitlements';

export default function Workshops() {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [contact1, setContact1] = useState('');
  const [contact2, setContact2] = useState('');
  const [status, setStatus] = useState<WorkshopStatus>('free');
  const [addressValue, setAddressValue] = useState<AddressValue>({
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    uf: '',
  });

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successNotice, setSuccessNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [limitNoticeOpen, setLimitNoticeOpen] = useState(false);

  useEffect(() => {
    loadWorkshops();
  }, [user]);

  const loadWorkshops = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getWorkshopsByUser(user.id);
      setWorkshops(data);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Erro ao carregar oficinas');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (workshop?: Workshop) => {
    if (workshop) {
      setEditingWorkshop(workshop);
      setName(workshop.name);
      // Best-effort: keep existing string in "Rua" if we don't have structured data yet
      setAddressValue({
        cep: '',
        street: workshop.address || '',
        number: '',
        neighborhood: '',
        city: '',
        uf: '',
      });
      setContact1(workshop.contact1);
      setContact2(workshop.contact2 || '');
      setStatus(workshop.status);
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
    setEditingWorkshop(null);
    setName('');
    setContact1('');
    setContact2('');
    setStatus('free');
    setAddressValue({
      cep: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      uf: '',
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = t('workshops.nameRequired');
    }

    const composedAddress = composeAddressString(addressValue);
    if (!composedAddress.trim() || composedAddress.trim().length < 5) {
      newErrors.address = t('workshops.addressRequired');
    }

    if (!contact1.trim() || contact1.trim().length < 10) {
      newErrors.contact1 = t('workshops.contact1Required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user?.id) return;

    try {
      setSubmitting(true);
      const composedAddress = composeAddressString(addressValue);
      const workshopData: CreateWorkshopData = {
        name: name.trim(),
        address: composedAddress.trim(),
        addressFields: {
          cep: addressValue.cep ? addressValue.cep.replace(/\D/g, '') : undefined,
          street: addressValue.street.trim(),
          number: addressValue.number.trim() || undefined,
          neighborhood: addressValue.neighborhood.trim() || undefined,
          city: addressValue.city.trim() || undefined,
          uf: addressValue.uf.trim() || undefined,
        },
        contact1: contact1.trim(),
        contact2: contact2.trim() || undefined,
        status,
      };

      if (editingWorkshop) {
        await updateWorkshop(editingWorkshop.id, workshopData);
        setSuccessNotice({
          title: t('common.success'),
          message: t('workshops.updateSuccess'),
        });
      } else {
        const ent = getEffectiveUserPlan(user?.plan);
        if (!canCreateAnotherWorkshop(ent, workshops.length)) {
          setLimitNoticeOpen(true);
          return;
        }
        await createWorkshop(user.id, workshopData);
        setSuccessNotice({
          title: t('common.success'),
          message: t('workshops.createSuccess'),
        });
      }

      await loadWorkshops();
      closeModal();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Erro ao salvar oficina');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (workshop: Workshop) => {
    Alert.alert(
      t('workshops.deleteTitle'),
      t('workshops.deleteConfirm').replace('{name}', workshop.name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workshops.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkshop(workshop.id);
              Alert.alert(t('common.success'), t('workshops.deleteSuccess'));
              await loadWorkshops();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  const handleStatusChange = async (workshop: Workshop, newStatus: WorkshopStatus) => {
    try {
      await updateWorkshopStatus(workshop.id, newStatus);
      await loadWorkshops();
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const getStatusColor = (status: WorkshopStatus) => {
    switch (status) {
      case 'free':
        return '#2563EB';
      case 'busy':
        return '#9CA3AF';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status: WorkshopStatus) => {
    return t(`workshops.status.${status}`);
  };

  const getStatusIcon = (status: WorkshopStatus) =>
    status === 'free' ? 'check-circle' : 'work';

  const formatPhoneInput = (text: string) => {
    const numbers = text.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const formatPhone = (phone: string) => {
    // Remove tudo que não é número
    const numbers = phone.replace(/\D/g, '');
    
    // Formata conforme o tamanho
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t('workshops.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {workshops.length} {t('workshops.registered')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openModal()}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Workshop List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {workshops.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="business" size={64} color="#D1D5DB" />
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('workshops.empty')}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => openModal()}
              >
                <Text style={styles.emptyButtonText}>{t('workshops.addFirst')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workshops.map((workshop) => (
              <View key={workshop.id} style={[styles.workshopCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
                {/* Header do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(workshop.status) },
                      ]}
                    />
                    <Text style={[styles.workshopName, { color: theme.colors.text }]} numberOfLines={1}>
                      {workshop.name}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => openModal(workshop)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="edit" size={20} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(workshop)}
                      style={styles.iconButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="location-on" size={16} color={theme.colors.textMuted} />
                    <Text style={[styles.infoText, { color: theme.colors.textMuted }]} numberOfLines={2}>
                      {workshop.address}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="phone" size={16} color={theme.colors.textMuted} />
                    <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>{formatPhone(workshop.contact1)}</Text>
                  </View>
                  {workshop.contact2 && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="phone" size={16} color={theme.colors.textMuted} />
                      <Text style={[styles.infoText, { color: theme.colors.textMuted }]}>{formatPhone(workshop.contact2)}</Text>
                    </View>
                  )}
                </View>

                {/* Footer */}
                <View style={[styles.cardFooter, { borderTopColor: theme.colors.border }]}>
                  <View style={styles.piecesInfo}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={[styles.piecesText, { color: theme.colors.primary }]}>
                      {workshop.totalPieces} {t('workshops.pieces')}
                    </Text>
                  </View>
                  <View style={styles.statusButtons}>
                    {(['free', 'busy'] as WorkshopStatus[]).map((statusOption) => (
                      <TouchableOpacity
                        key={statusOption}
                        style={[
                          styles.statusButton,
                          statusOption === workshop.status && {
                            backgroundColor: getStatusColor(statusOption),
                            borderColor: getStatusColor(statusOption),
                          },
                        ]}
                        onPress={() => handleStatusChange(workshop, statusOption)}
                      >
                        <MaterialIcons
                          name={getStatusIcon(statusOption)}
                          size={16}
                          color={statusOption === workshop.status ? '#FFFFFF' : getStatusColor(statusOption)}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <ThemedNoticeModal
          visible={successNotice != null}
          title={successNotice?.title ?? ''}
          message={successNotice?.message ?? ''}
          onDismiss={() => setSuccessNotice(null)}
        />

        <ThemedNoticeModal
          visible={limitNoticeOpen}
          variant="info"
          title={t('workshops.limitTitle')}
          message={t('workshops.limitMessage')}
          actionLabel={t('common.ok')}
          secondaryActionLabel={t('workshops.viewPlans')}
          onDismiss={() => setLimitNoticeOpen(false)}
          onSecondaryPress={() => {
            setLimitNoticeOpen(false);
            navigate(paths.plans);
          }}
        />

        {/* Modal de Cadastro/Edição */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
          >
          <View style={[styles.modalOverlayInner, { backgroundColor: theme.colors.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingWorkshop ? t('workshops.edit') : t('workshops.add')}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <MaterialIcons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Nome */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('workshops.name')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surfaceSoft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialIcons name="business" size={20} color={theme.colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      value={name}
                      onChangeText={setName}
                      placeholder={t('workshops.namePlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </View>
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>

                {/* Endereço */}
                <View style={styles.inputGroup}>
                  <AddressFields
                    title={t('workshops.address')}
                    value={addressValue}
                    onChange={setAddressValue}
                  />
                  {errors.address && (
                    <Text style={styles.errorText}>{errors.address}</Text>
                  )}
                </View>

                {/* Contato 1 (WhatsApp) */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('workshops.contact1')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surfaceSoft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialIcons name="phone" size={20} color={theme.colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      value={contact1}
                      onChangeText={(text) => setContact1(formatPhoneInput(text))}
                      placeholder={t('workshops.contact1Placeholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                  {errors.contact1 && (
                    <Text style={styles.errorText}>{errors.contact1}</Text>
                  )}
                </View>

                {/* Contato 2 */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('workshops.contact2')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      {
                        backgroundColor: theme.colors.surfaceSoft,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialIcons name="phone" size={20} color={theme.colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: theme.colors.text }]}
                      value={contact2}
                      onChangeText={(text) => setContact2(formatPhoneInput(text))}
                      placeholder={t('workshops.contact2Placeholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Status */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>{t('workshops.statusLabel')}</Text>
                  <View style={styles.statusSelector}>
                    {(['free', 'busy'] as WorkshopStatus[]).map(
                      (statusOption) => (
                        <TouchableOpacity
                          key={statusOption}
                          style={[
                            styles.statusOption,
                            {
                              borderColor: theme.colors.border,
                              backgroundColor: theme.colors.surfaceSoft,
                            },
                            status === statusOption && {
                              borderColor: theme.colors.primary,
                              backgroundColor: theme.colors.iconSoft,
                            },
                          ]}
                          onPress={() => setStatus(statusOption)}
                        >
                          <MaterialIcons
                            name={getStatusIcon(statusOption)}
                            size={18}
                            color={getStatusColor(statusOption)}
                          />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              </ScrollView>

              {/* Botões */}
              <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft },
                  ]}
                  onPress={closeModal}
                  disabled={submitting}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.textMuted }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workshopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  workshopName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
  cardInfo: {
    gap: 8,
    marginBottom: 12,
    paddingLeft: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  piecesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  piecesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
  },
  modalOverlayInner: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '94%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 28,
  },
  inputGroup: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
