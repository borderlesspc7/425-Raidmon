import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Layout from '../../components/Layout/Layout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '../../routes/NavigationContext';
import DashboardOwner from './DashboardOwner';
import { getCutStatistics } from '../../services/cutService';
import { getBatchStatistics } from '../../services/batchService';
import { getWorkshopsByUser } from '../../services/workshopService';
import { getPaymentStatistics } from '../../services/paymentService';
import { getReceivePiecesStatistics } from '../../services/receivePiecesService';
import { MaterialIcons } from '@expo/vector-icons';
import { paths, type ScreenName } from '../../routes/paths';
import { useCountUp } from '../../hooks/useCountUp';

type Stats = {
  totalCuts: number;
  totalCutPieces: number;
  totalBatches: number;
  completedBatches: number;
  inProgressBatches: number;
  totalWorkshops: number;
  workshopsBusy: number;
  workshopsCritical: number;
  pendingPayments: number;
  overduePayments: number;
  pendingAmount: number;
  overdueAmount: number;
  totalReceives: number;
  piecesReceived: number;
  receivesThisMonth: number;
};

type HighlightCard = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  route: ScreenName;
};

type Shortcut = {
  id: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: ScreenName;
};

const INITIAL_STATS: Stats = {
  totalCuts: 0,
  totalCutPieces: 0,
  totalBatches: 0,
  completedBatches: 0,
  inProgressBatches: 0,
  totalWorkshops: 0,
  workshopsBusy: 0,
  workshopsCritical: 0,
  pendingPayments: 0,
  overduePayments: 0,
  pendingAmount: 0,
  overdueAmount: 0,
  totalReceives: 0,
  piecesReceived: 0,
  receivesThisMonth: 0,
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const isWorkshopUser = user?.userType === 'workshop';

  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const animatedTotalCuts = useCountUp(stats.totalCuts);
  const animatedTotalCutPieces = useCountUp(stats.totalCutPieces);
  const animatedCompletedBatches = useCountUp(stats.completedBatches);
  const animatedInProgressBatches = useCountUp(stats.inProgressBatches);
  const animatedTotalWorkshops = useCountUp(stats.totalWorkshops);
  const animatedWorkshopsBusy = useCountUp(stats.workshopsBusy);
  const animatedWorkshopsCritical = useCountUp(stats.workshopsCritical);
  const animatedPendingPayments = useCountUp(stats.pendingPayments);
  const animatedOverduePayments = useCountUp(stats.overduePayments);
  const animatedPendingAmount = useCountUp(stats.pendingAmount, { durationMs: 1700 });
  const animatedOverdueAmount = useCountUp(stats.overdueAmount, { durationMs: 1700 });
  const animatedTotalBatches = useCountUp(stats.totalBatches);
  const animatedPiecesReceived = useCountUp(stats.piecesReceived);
  const animatedReceivesThisMonth = useCountUp(stats.receivesThisMonth);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!user?.id) {
          if (mounted) {
            setStats(INITIAL_STATS);
            setLoading(false);
          }
          return;
        }

        if (user.userType !== 'workshop') {
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        setLoading(true);

        const [cutsStats, batchesStats, workshops, paymentsStats, receiveStats] = await Promise.all([
          getCutStatistics(user.id),
          getBatchStatistics(user.id),
          getWorkshopsByUser(user.id),
          getPaymentStatistics(user.id),
          getReceivePiecesStatistics(user.id),
        ]);

        if (!mounted) return;

        const workshopsBusy = workshops.filter(
          (workshop) => workshop.status === 'yellow' || workshop.status === 'orange'
        ).length;

        const workshopsCritical = workshops.filter(
          (workshop) => workshop.status === 'red'
        ).length;

        setStats({
          totalCuts: cutsStats.totalCuts,
          totalCutPieces: cutsStats.totalPieces,
          totalBatches: batchesStats.totalBatches,
          completedBatches: batchesStats.completedBatches,
          inProgressBatches: batchesStats.inProgressBatches,
          totalWorkshops: workshops.length,
          workshopsBusy,
          workshopsCritical,
          pendingPayments: paymentsStats.pending,
          overduePayments: paymentsStats.overdue,
          pendingAmount: paymentsStats.pendingAmount,
          overdueAmount: paymentsStats.overdueAmount,
          totalReceives: receiveStats.totalReceives,
          piecesReceived: receiveStats.totalPiecesReceived,
          receivesThisMonth: receiveStats.thisMonthReceives,
        });
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.userType]);

  const highlights = useMemo<HighlightCard[]>(
    () => [
      {
        id: 'cuts',
        title: t('dashboard.totalCuts'),
        value: String(Math.round(animatedTotalCuts)),
        subtitle: `${Math.round(animatedTotalCutPieces)} ${t('dashboard.pieces')}`,
        icon: 'content-cut',
        color: '#6366F1',
        route: 'Cuts',
      },
      {
        id: 'batches',
        title: t('dashboard.inProgressBatches'),
        value: String(Math.round(animatedInProgressBatches)),
        subtitle: `${Math.round(animatedCompletedBatches)} ${t('dashboard.completedBatches')}`,
        icon: 'inventory',
        color: '#3B82F6',
        route: 'Batches',
      },
      {
        id: 'workshops',
        title: t('dashboard.busyWorkshops'),
        value: String(Math.round(animatedWorkshopsBusy)),
        subtitle: `${Math.round(animatedWorkshopsCritical)} ${t('dashboard.critical')}`,
        icon: 'business',
        color: '#F97316',
        route: 'WorkshopStatus',
      },
      {
        id: 'finance',
        title: t('dashboard.pendingAmount'),
        value: formatCurrency(Math.round(animatedPendingAmount)),
        subtitle: `${Math.round(animatedOverduePayments)} ${t('dashboard.overduePayments')}`,
        icon: 'payments',
        color: '#EF4444',
        route: 'FinancialHistory',
      },
    ],
    [
      animatedTotalCuts,
      animatedTotalCutPieces,
      animatedInProgressBatches,
      animatedCompletedBatches,
      animatedWorkshopsBusy,
      animatedWorkshopsCritical,
      animatedPendingAmount,
      animatedOverduePayments,
      t,
    ]
  );

  const shortcuts = useMemo<Shortcut[]>(
    () => {
      if (isWorkshopUser) {
        return [
          { id: 'wprod', label: t('navigation.workshopProduction'), icon: 'precision-manufacturing', route: paths.workshopProduction },
          { id: 'gh', label: t('navigation.generalHistory'), icon: 'timeline', route: paths.generalHistory },
          { id: 'prof', label: t('navigation.profile'), icon: 'person', route: paths.profile },
          { id: 'plans', label: t('navigation.plans'), icon: 'card-membership', route: paths.plans },
        ];
      }
      return [
        { id: 'cuts', label: t('navigation.cuts'), icon: 'content-cut', route: 'Cuts' },
        { id: 'batches', label: t('navigation.batches'), icon: 'inventory', route: 'Batches' },
        { id: 'workshops', label: t('navigation.workshops'), icon: 'business', route: 'Workshops' },
        { id: 'payments', label: t('navigation.payments'), icon: 'payment', route: 'Payments' },
        { id: 'receives', label: t('navigation.receivePieces'), icon: 'inbox', route: 'ReceivePieces' },
        { id: 'metrics', label: t('navigation.metrics'), icon: 'bar-chart', route: 'Metrics' },
      ];
    },
    [t, isWorkshopUser]
  );

  if (user?.id && !isWorkshopUser) {
    return (
      <Layout>
        <DashboardOwner userId={user.id} userName={user.name} userPlan={user.plan} />
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>{t('navigation.dashboard')}</Text>
            <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
            <Text style={styles.welcome}>{`${t('dashboard.hello')}, ${user?.name ?? '...'} ✨`}</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="dashboard" size={28} color="#6366F1" />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.mainKpis')}</Text>
              <View style={styles.grid}>
                {highlights.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.highlightCard}
                    onPress={() => navigate(item.route)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.highlightIcon, { backgroundColor: `${item.color}20` }]}>
                      <MaterialIcons name={item.icon} size={20} color={item.color} />
                    </View>

                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightValue}>{item.value}</Text>
                    <Text style={styles.highlightSubtitle}>{item.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.operations')}</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{t('navigation.batches')}</Text>
                  <Text style={styles.infoValue}>{Math.round(animatedTotalBatches)}</Text>
                  <Text style={styles.infoCaption}>{t('dashboard.totalBatches')}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{t('navigation.receivePieces')}</Text>
                  <Text style={styles.infoValue}>{Math.round(animatedReceivesThisMonth)}</Text>
                  <Text style={styles.infoCaption}>{t('dashboard.receivesThisMonth')}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{t('dashboard.piecesReceived')}</Text>
                  <Text style={styles.infoValue}>{Math.round(animatedPiecesReceived)}</Text>
                  <Text style={styles.infoCaption}>{t('dashboard.pieces')}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{t('navigation.workshops')}</Text>
                  <Text style={styles.infoValue}>{Math.round(animatedTotalWorkshops)}</Text>
                  <Text style={styles.infoCaption}>{t('dashboard.activeWorkshops')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.finance')}</Text>

              <TouchableOpacity
                style={styles.financeCard}
                onPress={() => navigate('Payments')}
                activeOpacity={0.8}
              >
                <View style={styles.financeHeader}>
                  <Text style={styles.financeTitle}>{t('navigation.payments')}</Text>
                  <MaterialIcons name="trending-down" size={20} color="#EF4444" />
                </View>
                <View style={styles.financeNumbers}>
                  <View>
                    <Text style={styles.financeNumber}>{Math.round(animatedPendingPayments)}</Text>
                    <Text style={styles.financeLabel}>{t('payments.pending')}</Text>
                  </View>
                  <View>
                    <Text style={[styles.financeNumber, { color: '#EF4444' }]}>
                      {Math.round(animatedOverduePayments)}
                    </Text>
                    <Text style={styles.financeLabel}>{t('payments.overdue')}</Text>
                  </View>
                  <View>
                    <Text style={styles.financeAmount}>{formatCurrency(Math.round(animatedOverdueAmount))}</Text>
                    <Text style={styles.financeLabel}>{t('dashboard.overdueAmount')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('dashboard.shortcuts')}</Text>
              <View style={styles.shortcutsGrid}>
                {shortcuts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.shortcutCard}
                    onPress={() => navigate(item.route)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name={item.icon} size={18} color="#6366F1" />
                    <Text style={styles.shortcutText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 20,
    gap: 12,
  },
  headerCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  welcome: {
    marginTop: 6,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  section: {
    marginTop: 2,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  highlightCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  highlightTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  highlightValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  highlightSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
  },
  infoCaption: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  financeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  financeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  financeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  financeNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  financeNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  financeAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  financeLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  shortcutText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
});
