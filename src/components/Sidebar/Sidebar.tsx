import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../routes/NavigationContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute?: string;
}

interface MenuItem {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  labelKey: string;
  route: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', icon: 'dashboard', labelKey: 'navigation.dashboard', route: 'Dashboard' },
  { id: 'profile', icon: 'person', labelKey: 'navigation.profile', route: 'Profile' },
  { id: 'workshops', icon: 'business', labelKey: 'navigation.workshops', route: 'Workshops' },
  { id: 'cuts', icon: 'content-cut', labelKey: 'navigation.cuts', route: 'Cuts' },
  { id: 'batches', icon: 'inventory', labelKey: 'navigation.batches', route: 'Batches' },
  { id: 'workshopStatus', icon: 'assessment', labelKey: 'navigation.workshopStatus', route: 'WorkshopStatus' },
  { id: 'finishedProduction', icon: 'check-circle', labelKey: 'navigation.finishedProduction', route: 'FinishedProduction' },
  { id: 'receivePieces', icon: 'inbox', labelKey: 'navigation.receivePieces', route: 'ReceivePieces' },
  { id: 'payments', icon: 'payment', labelKey: 'navigation.payments', route: 'Payments' },
  { id: 'financialHistory', icon: 'history', labelKey: 'navigation.financialHistory', route: 'FinancialHistory' },
  { id: 'generalHistory', icon: 'timeline', labelKey: 'navigation.generalHistory', route: 'GeneralHistory' },
  { id: 'metrics', icon: 'bar-chart', labelKey: 'navigation.metrics', route: 'Metrics' },
  { id: 'plans', icon: 'card-membership', labelKey: 'navigation.plans', route: 'Plans' },
];

export default function Sidebar({ isOpen, onClose, currentRoute }: SidebarProps) {
  const { t } = useLanguage();
  const { navigate } = useNavigation();

  const handleNavigate = (route: string) => {
    navigate(route as any);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      
      {/* Sidebar */}
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('navigation.menu')}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialIcons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {menuItems.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  isActive && styles.menuItemActive,
                ]}
                onPress={() => handleNavigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.iconContainer,
                  isActive && styles.iconContainerActive,
                ]}>
                  <MaterialIcons
                    name={item.icon}
                    size={22}
                    color={isActive ? '#6366F1' : '#6B7280'}
                  />
                </View>
                <Text style={[
                  styles.menuText,
                  isActive && styles.menuTextActive,
                ]}>
                  {t(item.labelKey)}
                </Text>
                {isActive && (
                  <View style={styles.activeIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8F9FA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: '#F0F4FF',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerActive: {
    backgroundColor: '#E0E7FF',
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  menuTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#6366F1',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
