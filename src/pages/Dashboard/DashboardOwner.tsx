import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Share,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../routes/NavigationContext';
import { deriveWorkshopCardState, type OperationalDisplay } from '../../utils/workshopOperationalStatus';
import { getBatchProductionPillColors, isBatchDeliveryLate } from '../../utils/batchProductionStatusStyle';
import type { Batch } from '../../types/batch';
import type { Workshop } from '../../types/workshop';
import type { MonthlyPiecesPoint } from '../../services/receivePiecesService';
import {
  getMonthlyPiecesReceived,
  getReceivePiecesByUser,
} from '../../services/receivePiecesService';
import { getWorkshopsByUser } from '../../services/workshopService';
import { getBatchesByUser } from '../../services/batchService';
import {
  canExportOwnerDataSheet,
  canViewEfficiencyRanking,
  getEffectiveUserPlan,
} from '../../utils/planEntitlements';

const CHART_HEIGHT = 120;
const BAR_MIN = 4;

function formatMonthLabel(
  language: string,
  year: number,
  monthIndex: number,
): string {
  const locale = language === 'es' ? 'es-ES' : 'pt-BR';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: '2-digit',
  }).format(new Date(year, monthIndex, 1));
}

function statusLabel(t: (k: string) => string, s: OperationalDisplay): string {
  switch (s) {
    case 'ready_pickup':
      return t('dashboard.owner.statusReadyPickup');
    case 'pendencies':
      return t('dashboard.owner.statusPendencies');
    case 'sewing':
      return t('dashboard.owner.statusSewing');
    case 'producing_ok':
      return t('dashboard.owner.statusProducingOk');
    case 'delayed':
      return t('dashboard.owner.statusDelayed');
    default:
      return '';
  }
}

function ownerBatchBadgeStyle(batch: Batch): { backgroundColor: string } {
  return { backgroundColor: getBatchProductionPillColors(batch).bg };
}

function ownerBatchStatusLabel(
  t: (k: string) => string,
  language: string,
  batch: Batch,
): string {
  const late = isBatchDeliveryLate(batch);
  const flow = batch.productionFlowStatus;
  if (late) {
    return t('dashboard.owner.statusDelayed');
  }
  if (batch.status === 'in_progress') {
    if (flow === 'ready_for_pickup') {
      return t('dashboard.owner.statusReadyPickup');
    }
    if (flow === 'in_production') {
      return t('dashboard.owner.statusProducingOk');
    }
    if (flow === 'partial' || flow === 'paused') {
      return t('dashboard.owner.statusPendencies');
    }
  }
  return formatBatchStatus(t, language, batch.status);
}

function formatBatchStatus(
  t: (k: string) => string,
  language: string,
  status: Batch['status'],
): string {
  const key = `batches.status.${status}`;
  const label = t(key);
  if (label === key) {
    if (status === 'in_progress') {
      return language === 'es' ? 'en producción' : 'em produção';
    }
    return status;
  }
  return label;
}

function formatDateShort(language: string, d: Date): string {
  const locale = language === 'es' ? 'es-ES' : 'pt-BR';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const BAR_STAGGER_MS = 130;

function PiecesBarColumn({
  point,
  maxPieces,
  language,
  staggerIndex,
}: {
  point: MonthlyPiecesPoint;
  maxPieces: number;
  language: string;
  staggerIndex: number;
}) {
  const heightAnim = useRef(new Animated.Value(0)).current;

  const targetHeight = useMemo(() => {
    if (point.pieces === 0) return 0;
    return Math.max(BAR_MIN, (point.pieces / maxPieces) * CHART_HEIGHT);
  }, [point.pieces, maxPieces]);

  useEffect(() => {
    heightAnim.setValue(0);
    const delay = staggerIndex * BAR_STAGGER_MS;
    const timer = setTimeout(() => {
      Animated.timing(heightAnim, {
        toValue: targetHeight,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [heightAnim, targetHeight, staggerIndex]);

  return (
    <View style={styles.chartCol}>
      <View style={styles.chartBarTrack}>
        <Animated.View
          style={[
            styles.chartBarFill,
            {
              height: heightAnim,
            },
          ]}
        />
      </View>
      <Text style={styles.chartValue}>{point.pieces}</Text>
      <Text style={styles.chartMonth} numberOfLines={1}>
        {formatMonthLabel(language, point.year, point.monthIndex)}
      </Text>
    </View>
  );
}

type EntRankRow = {
  name: string;
  piecesThisMonth: number;
  status: Workshop['status'];
  contact1: string;
};

export default function DashboardOwner({
  userId,
  userName,
  userPlan,
}: {
  userId: string;
  userName?: string;
  /** `users.plan` do Firestore; usado para ranking / export (plano Indústria). */
  userPlan?: string;
}) {
  const { t, language } = useLanguage();
  const { navigate } = useNavigation();
  const { width } = useWindowDimensions();
  const twoColumn = width >= 720;
  const entPlan = getEffectiveUserPlan(userPlan);
  const showRanking = canViewEfficiencyRanking(entPlan);
  const showExport = canExportOwnerDataSheet(entPlan);

  const [entLoading, setEntLoading] = useState(false);
  const [entRows, setEntRows] = useState<EntRankRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyPiecesPoint[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [monthlyData, wList, bList] = await Promise.all([
          getMonthlyPiecesReceived(userId, 5),
          getWorkshopsByUser(userId),
          getBatchesByUser(userId),
        ]);
        if (cancelled) return;
        setMonthly(monthlyData);
        setWorkshops(wList);
        setBatches(bList);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setMonthly([]);
          setWorkshops([]);
          setBatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!showRanking && !showExport) {
      setEntRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setEntLoading(true);
      try {
        const [wList, rList] = await Promise.all([
          getWorkshopsByUser(userId),
          getReceivePiecesByUser(userId),
        ]);
        if (cancelled) return;
        const now = new Date();
        const y = now.getFullYear();
        const m0 = now.getMonth();
        const piecesByW = new Map<string, number>();
        wList.forEach((w) => piecesByW.set(w.id, 0));
        for (const r of rList) {
          const d = r.receiveDate;
          if (d.getFullYear() === y && d.getMonth() === m0 && r.workshopId) {
            const prev = piecesByW.get(r.workshopId) || 0;
            piecesByW.set(r.workshopId, prev + r.piecesReceived);
          }
        }
        const statusWeight: Record<Workshop['status'], number> = {
          red: 0,
          orange: 1,
          yellow: 2,
          green: 3,
        };
        const rows: EntRankRow[] = wList.map((w) => ({
          name: w.name,
          contact1: w.contact1,
          piecesThisMonth: piecesByW.get(w.id) || 0,
          status: w.status,
        }));
        rows.sort((a, b) => {
          const sa = statusWeight[a.status];
          const sb = statusWeight[b.status];
          if (sa !== sb) return sa - sb;
          return a.piecesThisMonth - b.piecesThisMonth;
        });
        setEntRows(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) setEntRows([]);
      } finally {
        if (!cancelled) setEntLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, showRanking, showExport]);

  const handleExportOwnerCsv = useCallback(async () => {
    if (entRows.length === 0) {
      Alert.alert(t('common.info'), t('dashboard.owner.exportEmpty'));
      return;
    }
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = `${t('dashboard.owner.csvColWorkshop')};${t('dashboard.owner.csvColStatus')};${t('dashboard.owner.csvColPiecesMonth')};${t('dashboard.owner.csvColPhone')}`;
    const body = entRows
      .map((r) => {
        const st = t(`workshops.status.${r.status}` as any);
        return [esc(r.name), esc(st), String(r.piecesThisMonth), esc(r.contact1)].join(';');
      })
      .join('\n');
    const csv = `\uFEFF${header}\n${body}`;
    try {
      await Share.share({ message: csv, title: t('dashboard.owner.exportTitle') });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || String(e));
    }
  }, [entRows, t]);

  const sortedBatches = useMemo(
    () =>
      [...batches].sort(
        (a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    [batches],
  );

  const workshopCards = useMemo(() => {
    return workshops.map((w) => deriveWorkshopCardState(w, batches));
  }, [workshops, batches]);

  const maxPieces = useMemo(
    () => Math.max(...monthly.map((p) => p.pieces), 1),
    [monthly],
  );

  const piecesPanel = (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t('dashboard.owner.piecesTitle')}</Text>
      <Text style={styles.panelSubtitle}>{t('dashboard.owner.piecesSubtitle')}</Text>
      {loading ? (
        <View style={styles.panelLoading}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : monthly.every((p) => p.pieces === 0) ? (
        <Text style={styles.emptyText}>{t('dashboard.owner.piecesEmpty')}</Text>
      ) : (
        <View style={styles.chartRow}>
          {monthly.map((point, index) => (
            <PiecesBarColumn
              key={`${point.year}-${point.monthIndex}`}
              point={point}
              maxPieces={maxPieces}
              language={language}
              staggerIndex={index}
            />
          ))}
        </View>
      )}
    </View>
  );

  const workshopsPanel = (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t('navigation.workshops')}</Text>
      <Text style={styles.hintText}>{t('dashboard.owner.syncHint')}</Text>
      {loading ? (
        <View style={styles.panelLoading}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : workshopCards.length === 0 ? (
        <Text style={styles.emptyText}>{t('dashboard.owner.workshopsEmpty')}</Text>
      ) : (
        <ScrollView
          style={styles.workshopScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {workshopCards.map((card) => (
            <View
              key={card.workshopId}
              style={[styles.workshopCard, { borderLeftColor: card.color }]}
            >
              <View style={styles.workshopBody}>
                <View style={styles.workshopHeaderRow}>
                  <Text style={styles.workshopTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, { backgroundColor: card.color }]} />
                  </View>
                </View>
                {card.subtitle ? (
                  <Text style={styles.workshopSubtitle} numberOfLines={1}>
                    {card.subtitle}
                  </Text>
                ) : null}
                <Text style={styles.workshopProduct} numberOfLines={2}>
                  {card.productLine || '—'}
                  {card.moreActiveCount > 0
                    ? `  ${t('dashboard.owner.moreBatches').replace('{n}', String(card.moreActiveCount))}`
                    : ''}
                </Text>
                <Text style={styles.workshopStatusHint}>
                  {statusLabel(t, card.status)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const batchesPanel = (
    <View style={styles.panel}>
      <View style={styles.batchesHeaderRow}>
        <Text style={styles.panelTitle}>{t('dashboard.owner.batchesTitle')}</Text>
        <TouchableOpacity onPress={() => navigate('Batches')} hitSlop={8}>
          <Text style={styles.linkText}>{t('navigation.batches')} →</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.panelLoading}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : sortedBatches.length === 0 ? (
        <Text style={styles.emptyText}>{t('dashboard.owner.batchesEmpty')}</Text>
      ) : (
        <View style={styles.batchList}>
          {sortedBatches.map((batch) => (
            <TouchableOpacity
              key={batch.id}
              style={styles.batchCard}
              onPress={() => navigate('Batches')}
              activeOpacity={0.85}
            >
              <View style={styles.batchTop}>
                <Text style={styles.batchName} numberOfLines={1}>
                  {batch.name}
                </Text>
                <View style={styles.batchMeta}>
                  <MaterialIcons name="inventory-2" size={16} color="#6366F1" />
                  <Text style={styles.batchPieces}>
                    {batch.totalPieces} {t('batches.pieces')}
                  </Text>
                </View>
              </View>
              <View style={styles.batchRow}>
                <View style={[styles.batchStatusBadge, ownerBatchBadgeStyle(batch)]}>
                  <Text style={styles.batchStatusText}>
                    {ownerBatchStatusLabel(t, language, batch)}
                  </Text>
                </View>
                {batch.workshopName ? (
                  <Text style={styles.batchWorkshop} numberOfLines={1}>
                    {batch.workshopName}
                  </Text>
                ) : (
                  <Text style={styles.batchWorkshopMuted}>{t('batches.noWorkshop')}</Text>
                )}
              </View>
              {batch.deliveryDate ? (
                <Text style={styles.batchDue}>
                  {t('batches.deliveryDate')}:{' '}
                  {formatDateShort(language, batch.deliveryDate)}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.scrollContent}>
      <View style={styles.headerCard}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{t('navigation.dashboard')}</Text>
          <Text style={styles.subtitle}>{t('dashboard.subtitle')}</Text>
          <Text style={styles.welcome}>
            {`${t('dashboard.hello')}, ${userName ?? '…'} ✨`}
          </Text>
        </View>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="dashboard" size={28} color="#6366F1" />
        </View>
      </View>

      <View style={twoColumn ? styles.rowTop : styles.colTop}>
        <View style={twoColumn ? styles.half : styles.full}>{piecesPanel}</View>
        <View style={twoColumn ? styles.half : styles.full}>{workshopsPanel}</View>
      </View>

      {batchesPanel}

      {showRanking || showExport ? (
        <View style={styles.entPanel}>
          <View style={styles.entHeaderRow}>
            <Text style={styles.panelTitle}>{t('dashboard.owner.industryPanelTitle')}</Text>
            {showExport ? (
              <TouchableOpacity
                onPress={handleExportOwnerCsv}
                disabled={entLoading}
                style={entRows.length === 0 ? { opacity: 0.5 } : undefined}
              >
                <Text style={styles.linkText}>{t('dashboard.owner.exportSheet')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.entSub}>{t('dashboard.owner.industryPanelSubtitle')}</Text>
          {showRanking ? (
            entLoading ? (
              <View style={styles.entLoadingBox}>
                <ActivityIndicator color="#6366F1" />
              </View>
            ) : entRows.length === 0 ? (
              <Text style={styles.emptyText}>{t('dashboard.owner.rankingEmpty')}</Text>
            ) : (
              <View style={styles.rankingList}>
                {entRows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={styles.rankingRow}>
                    <View style={styles.rankingIndex}>
                      <Text style={styles.rankingIndexText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.rankingBody}>
                      <Text style={styles.rankingTitle} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.rankingMeta}>
                        {t('dashboard.owner.piecesThisMonth')}: {r.piecesThisMonth} ·{' '}
                        {t(`workshops.status.${r.status}` as any)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.rankingDot,
                        { backgroundColor: rankStatusColor(r.status) },
                      ]}
                    />
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function rankStatusColor(s: Workshop['status']): string {
  switch (s) {
    case 'green':
      return '#10B981';
    case 'yellow':
      return '#EAB308';
    case 'orange':
      return '#F97316';
    case 'red':
      return '#EF4444';
    default:
      return '#9CA3AF';
  }
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
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
  rowTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  colTop: {
    gap: 12,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  full: {
    width: '100%',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 200,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  panelSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  panelLoading: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  chartBarTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarFill: {
    width: '78%',
    maxWidth: 40,
    backgroundColor: '#6366F1',
    borderRadius: 6,
  },
  chartValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginTop: 6,
  },
  chartMonth: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  workshopList: {
    gap: 0,
  },
  workshopCard: {
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 10,
    overflow: 'hidden',
  },
  workshopBody: {
    flex: 1,
    padding: 12,
  },
  workshopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 28,
  },
  workshopTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusPill: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  workshopSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  workshopProduct: {
    fontSize: 13,
    color: '#374151',
    marginTop: 8,
    lineHeight: 18,
  },
  workshopStatusHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  batchesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  batchList: {
    gap: 10,
  },
  batchCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  batchTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  batchName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  batchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batchPieces: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  batchStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  batchStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  batchWorkshop: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    minWidth: 120,
  },
  batchWorkshopMuted: {
    flex: 1,
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  batchDue: {
    marginTop: 8,
    fontSize: 11,
    color: '#6B7280',
  },
  workshopScroll: {
    maxHeight: 240,
  },
  entPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  entHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  entSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 10,
  },
  entLoadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  rankingList: {
    gap: 8,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  rankingIndex: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F46E5',
  },
  rankingBody: {
    flex: 1,
    minWidth: 0,
  },
  rankingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rankingMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  rankingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
