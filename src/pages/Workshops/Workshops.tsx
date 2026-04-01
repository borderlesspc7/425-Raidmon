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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Layout from '../../components/Layout/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  createWorkshop,
  getWorkshopsByUser,
  updateWorkshop,
  deleteWorkshop,
  updateWorkshopStatus,
} from '../../services/workshopService';
import { Workshop, WorkshopStatus, CreateWorkshopData } from '../../types/workshop';

export default function Workshops() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contact1, setContact1] = useState('');
  const [contact2, setContact2] = useState('');
  const [status, setStatus] = useState<WorkshopStatus>('yellow');

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
      setAddress(workshop.address);
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
    setAddress('');
    setContact1('');
    setContact2('');
    setStatus('yellow');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = t('workshops.nameRequired');
    }

    if (!address.trim() || address.trim().length < 5) {
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
      const workshopData: CreateWorkshopData = {
        name: name.trim(),
        address: address.trim(),
        contact1: contact1.trim(),
        contact2: contact2.trim() || undefined,
        status,
      };

      if (editingWorkshop) {
        await updateWorkshop(editingWorkshop.id, workshopData);
        Alert.alert(t('common.success'), t('workshops.updateSuccess'));
      } else {
        await createWorkshop(user.id, workshopData);
        Alert.alert(t('common.success'), t('workshops.createSuccess'));
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
      case 'green':
        return '#10B981';
      case 'yellow':
        return '#F59E0B';
      case 'orange':
        return '#F97316';
      case 'red':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: WorkshopStatus) => {
    return t(`workshops.status.${status}`);
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('workshops.title')}</Text>
            <Text style={styles.subtitle}>
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
              <Text style={styles.emptyText}>{t('workshops.empty')}</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => openModal()}
              >
                <Text style={styles.emptyButtonText}>{t('workshops.addFirst')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workshops.map((workshop) => (
              <View key={workshop.id} style={styles.workshopCard}>
                {/* Header do Card */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(workshop.status) },
                      ]}
                    />
                    <Text style={styles.workshopName} numberOfLines={1}>
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
                    <MaterialIcons name="location-on" size={16} color="#6B7280" />
                    <Text style={styles.infoText} numberOfLines={2}>
                      {workshop.address}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="phone" size={16} color="#6B7280" />
                    <Text style={styles.infoText}>{formatPhone(workshop.contact1)}</Text>
                  </View>
                  {workshop.contact2 && (
                    <View style={styles.infoRow}>
                      <MaterialIcons name="phone" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>{formatPhone(workshop.contact2)}</Text>
                    </View>
                  )}
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.piecesInfo}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={styles.piecesText}>
                      {workshop.totalPieces} {t('workshops.pieces')}
                    </Text>
                  </View>
                  <View style={styles.statusButtons}>
                    {(['green', 'yellow', 'orange', 'red'] as WorkshopStatus[]).map(
                      (statusOption) => (
                        <TouchableOpacity
                          key={statusOption}
                          style={[
                            styles.statusButton,
                            {
                              backgroundColor: getStatusColor(statusOption),
                              opacity: workshop.status === statusOption ? 1 : 0.3,
                            },
                          ]}
                          onPress={() => handleStatusChange(workshop, statusOption)}
                        >
                          <View />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
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
                  {editingWorkshop ? t('workshops.edit') : t('workshops.add')}
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
                  <Text style={styles.label}>{t('workshops.name')}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="business" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder={t('workshops.namePlaceholder')}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>

                {/* Endereço */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('workshops.address')}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="location-on" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={address}
                      onChangeText={setAddress}
                      placeholder={t('workshops.addressPlaceholder')}
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  </View>
                  {errors.address && (
                    <Text style={styles.errorText}>{errors.address}</Text>
                  )}
                </View>

                {/* Contato 1 (WhatsApp) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('workshops.contact1')}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={contact1}
                      onChangeText={setContact1}
                      placeholder={t('workshops.contact1Placeholder')}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                  {errors.contact1 && (
                    <Text style={styles.errorText}>{errors.contact1}</Text>
                  )}
                </View>

                {/* Contato 2 */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('workshops.contact2')}</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={20} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      value={contact2}
                      onChangeText={setContact2}
                      placeholder={t('workshops.contact2Placeholder')}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Status */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('workshops.statusLabel')}</Text>
                  <View style={styles.statusSelector}>
                    {(['green', 'yellow', 'orange', 'red'] as WorkshopStatus[]).map(
                      (statusOption) => (
                        <TouchableOpacity
                          key={statusOption}
                          style={[
                            styles.statusOption,
                            status === statusOption && styles.statusOptionActive,
                          ]}
                          onPress={() => setStatus(statusOption)}
                        >
                          <View
                            style={[
                              styles.statusOptionDot,
                              { backgroundColor: getStatusColor(statusOption) },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusOptionText,
                              status === statusOption && styles.statusOptionTextActive,
                            ]}
                          >
                            {getStatusLabel(statusOption)}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
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
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
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
    color: '#6366F1',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  inputGroup: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  statusSelector: {
    gap: 10,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  statusOptionActive: {
    borderColor: '#6366F1',
    backgroundColor: '#F0F4FF',
  },
  statusOptionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  statusOptionText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
