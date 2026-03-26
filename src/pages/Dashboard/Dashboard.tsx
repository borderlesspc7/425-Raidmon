import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Layout from '../../components/Layout/Layout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '../../routes/NavigationContext';
import { getCutStatistics } from '../../services/cutService';
import { getWorkshopsByUser } from '../../services/workshopService';
import { getPaymentStatistics } from '../../services/paymentService';
import { MaterialIcons } from '@expo/vector-icons';
import { getPaymentsSummary } from '../../services/paymentService';

type Stats = {
  totalCuts?: number;
  totalPieces?: number;
  workshops?: number;
  paymentsDue?: number;
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) return;

        const [cutsStats, workshops, paymentsStats] = await Promise.all([
          getCutStatistics(user.id),
          getWorkshopsByUser(user.id),
          getPaymentStatistics(user.id),
        ]);

        if (!mounted) return;

        setStats({
          totalCuts: cutsStats.totalCuts,
          totalPieces: cutsStats.totalPieces,
          workshops: workshops.length,
          paymentsDue: paymentsStats.pending || 0,
        });
      } catch (err) {
        // ignore — keep placeholders
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const { navigate } = useNavigation();

  const shortcuts = [
    { id: 'cuts', label: t('navigation.cuts'), icon: 'content-cut' },
    { id: 'workshops', label: t('navigation.workshops'), icon: 'business' },
    { id: 'payments', label: t('navigation.payments'), icon: 'payment' },
    { id: 'metrics', label: t('navigation.metrics'), icon: 'bar-chart' },
  ];

  return (
    <Layout>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('navigation.dashboard')}</Text>
            <Text style={styles.subtitle}>{t('dashboard.welcome', { name: user?.name || t('common.user') })}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity style={[styles.statCard, styles.purple]} onPress={() => navigate('Cuts')}>
            <MaterialIcons name="content-cut" size={22} color="#ffffff" />
            <Text style={styles.statValue}>{stats.totalCuts ?? '—'}</Text>
            <Text style={styles.statLabel}>{t('dashboard.totalCuts')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statCard, styles.green]} onPress={() => navigate('Batches')}>
            <MaterialIcons name="inventory" size={22} color="#ffffff" />
            <Text style={styles.statValue}>{stats.totalPieces ?? '—'}</Text>
            <Text style={styles.statLabel}>{t('dashboard.totalPieces')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statCard, styles.blue]} onPress={() => navigate('Workshops')}>
            <MaterialIcons name="business" size={22} color="#ffffff" />
            <Text style={styles.statValue}>{stats.workshops ?? '—'}</Text>
            <Text style={styles.statLabel}>{t('dashboard.workshops')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.statCard, styles.red]} onPress={() => navigate('Payments')}>
            <MaterialIcons name="payment" size={22} color="#ffffff" />
            <Text style={styles.statValue}>{stats.paymentsDue ?? '—'}</Text>
            <Text style={styles.statLabel}>{t('dashboard.paymentsDue')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.shortcuts')}</Text>
          <View style={styles.shortcutsRow}>
            {shortcuts.map((s) => (
              <TouchableOpacity key={s.id} style={styles.shortcut}>
                <MaterialIcons name={s.icon as any} size={20} color="#6366F1" />
                <Text style={styles.shortcutText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.insights')}</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('dashboard.insightsPlaceholder')}</Text>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
  purple: { backgroundColor: '#6366F1' },
  green: { backgroundColor: '#10B981' },
  blue: { backgroundColor: '#3B82F6' },
  red: { backgroundColor: '#EF4444' },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcut: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  shortcutText: {
    marginTop: 6,
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
});
