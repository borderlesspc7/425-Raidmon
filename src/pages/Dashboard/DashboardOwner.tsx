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
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigation } from '../../routes/NavigationContext';
import { useTheme } from '../../hooks/useTheme';
import {
  deriveWorkshopCardState,
  getPrimaryDashboardBatch,
  workshopHasOwnerDashboardProduction,
  type OperationalDisplay,
  type WorkshopCardModel,
} from '../../utils/workshopOperationalStatus';
import { getBatchProductionPillColors } from '../../utils/batchProductionStatusStyle';
import type { Batch, ProductionFlowStatus } from '../../types/batch';
import type { Workshop } from '../../types/workshop';
import type { MonthlyPiecesPoint } from '../../services/receivePiecesService';
import { getReceivePiecesByUser } from '../../services/receivePiecesService';
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

function formatDateShort(language: string, d: Date): string {
  const locale = language === 'es' ? 'es-ES' : 'pt-BR';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Dados ilustrativos só para o gráfico do painel do dono (pré-visualização do layout). */
function buildDemoMonthlyPiecesReceived(months: number): MonthlyPiecesPoint[] {
  const DEMO_SEQUENCE = [320, 180, 440, 290, 510];
  const now = new Date();
  const points: MonthlyPiecesPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const seqIdx = months - 1 - i;
    points.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      pieces: DEMO_SEQUENCE[seqIdx % DEMO_SEQUENCE.length],
    });
  }
  return points;
}

function operationalSituationLabel(t: (key: string) => string, status: OperationalDisplay): string {
  const map: Record<OperationalDisplay, string> = {
    ready_pickup: 'dashboard.owner.statusReadyPickup',
    pendencies: 'dashboard.owner.statusPendencies',
    sewing: 'dashboard.owner.statusSewing',
    producing_ok: 'dashboard.owner.statusProducingOk',
    delayed: 'dashboard.owner.statusDelayed',
  };
  return t(map[status]);
}

function productionFlowLabel(
  t: (key: string) => string,
  flow: ProductionFlowStatus | undefined,
): string {
  if (!flow) return t('dashboard.owner.flowNotReported');
  const keys: Record<ProductionFlowStatus, string> = {
    in_production: 'dashboard.owner.flowInProduction',
    ready_for_pickup: 'dashboard.owner.flowReadyPickup',
    partial: 'dashboard.owner.flowPartial',
    paused: 'dashboard.owner.flowPaused',
  };
  return t(keys[flow]);
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
  const { theme } = useTheme();
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
              backgroundColor: theme.colors.primary,
              height: heightAnim,
            },
          ]}
        />
      </View>
      <Text style={[styles.chartValue, { color: theme.colors.text }]}>{point.pieces}</Text>
      <Text style={[styles.chartMonth, { color: theme.colors.textMuted }]} numberOfLines={1}>
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
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const twoColumn = width >= 720;
  const entPlan = getEffectiveUserPlan(userPlan);
  const showRanking = canViewEfficiencyRanking(entPlan);
  const showExport = canExportOwnerDataSheet(entPlan);

  const [entLoading, setEntLoading] = useState(false);
  const [entRows, setEntRows] = useState<EntRankRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [workshopDetail, setWorkshopDetail] = useState<{
    workshop: Workshop;
    card: WorkshopCardModel;
    batch: Batch | null;
  } | null>(null);

  const monthlyDemo = useMemo(() => buildDemoMonthlyPiecesReceived(5), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [wList, bList] = await Promise.all([
          getWorkshopsByUser(userId),
          getBatchesByUser(userId),
        ]);
        if (cancelled) return;
        setWorkshops(wList);
        setBatches(bList);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
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
          busy: 0,
          free: 1,
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
    return workshops
      .filter((w) => workshopHasOwnerDashboardProduction(w, batches))
      .map((w) => deriveWorkshopCardState(w, batches));
  }, [workshops, batches]);

  const maxPieces = useMemo(
    () => Math.max(...monthlyDemo.map((p) => p.pieces), 1),
    [monthlyDemo],
  );

  const piecesPanel = (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
      <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{t('dashboard.owner.piecesTitle')}</Text>
      <Text style={[styles.panelSubtitle, { color: theme.colors.textMuted }]}>{t('dashboard.owner.piecesSubtitle')}</Text>
      <View style={styles.chartRow}>
        {monthlyDemo.map((point, index) => (
          <PiecesBarColumn
            key={`${point.year}-${point.monthIndex}`}
            point={point}
            maxPieces={maxPieces}
            language={language}
            staggerIndex={index}
          />
        ))}
      </View>
    </View>
  );

  const workshopsPanel = (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
      <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{t('navigation.workshops')}</Text>
      <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>{t('dashboard.owner.syncHint')}</Text>
      {loading ? (
        <View style={styles.panelLoading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : workshopCards.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('dashboard.owner.workshopsEmptyProduction')}</Text>
      ) : (
        <ScrollView
          style={styles.workshopScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {workshopCards.map((card) => (
            <TouchableOpacity
              key={card.workshopId}
              activeOpacity={0.88}
              onPress={() => {
                const w = workshops.find((x) => x.id === card.workshopId);
                if (!w) return;
                setWorkshopDetail({
                  workshop: w,
                  card,
                  batch: getPrimaryDashboardBatch(w, batches),
                });
              }}
            >
              <View
                style={[styles.workshopCard, { borderLeftColor: card.color, backgroundColor: theme.colors.surfaceSoft }]}
              >
                <View style={styles.workshopBody}>
                  <View style={styles.workshopHeaderRow}>
                    <Text style={[styles.workshopTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {card.title}
                    </Text>
                    <View style={styles.statusPill}>
                      <View style={[styles.statusDot, { backgroundColor: card.color }]} />
                    </View>
                  </View>
                  {card.subtitle ? (
                    <Text style={[styles.workshopSubtitle, { color: theme.colors.textMuted }]} numberOfLines={1}>
                      {card.subtitle}
                    </Text>
                  ) : null}
                  <Text style={[styles.workshopProduct, { color: theme.colors.text }]} numberOfLines={2}>
                    {card.productLine || '—'}
                    {card.moreActiveCount > 0
                      ? `  ${t('dashboard.owner.moreBatches').replace('{n}', String(card.moreActiveCount))}`
                      : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const batchesPanel = (
    <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
      <View style={styles.batchesHeaderRow}>
        <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{t('dashboard.owner.batchesTitle')}</Text>
        <TouchableOpacity onPress={() => navigate('Batches')} hitSlop={8}>
          <Text style={styles.linkText}>{t('navigation.batches')} →</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.panelLoading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : sortedBatches.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('dashboard.owner.batchesEmpty')}</Text>
      ) : (
        <View style={styles.batchList}>
          {sortedBatches.map((batch) => (
            <TouchableOpacity
              key={batch.id}
              style={[styles.batchCard, { backgroundColor: theme.colors.surfaceSoft, borderColor: theme.colors.border }]}
              onPress={() => navigate('Batches')}
              activeOpacity={0.85}
            >
              <View style={styles.batchTop}>
                <Text style={[styles.batchName, { color: theme.colors.text }]} numberOfLines={1}>
                  {batch.name}
                </Text>
                <View style={styles.batchMeta}>
                  <MaterialIcons name="inventory-2" size={16} color={theme.colors.primary} />
                  <Text style={[styles.batchPieces, { color: theme.colors.textMuted }]}>
                    {batch.totalPieces} {t('batches.pieces')}
                  </Text>
                </View>
              </View>
              <View style={styles.batchRow}>
                <View style={[styles.batchStatusDot, { backgroundColor: getBatchProductionPillColors(batch).fg }]} />
                {batch.workshopName ? (
                  <Text style={[styles.batchWorkshop, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {batch.workshopName}
                  </Text>
                ) : (
                  <Text style={[styles.batchWorkshopMuted, { color: theme.colors.textMuted }]}>{t('batches.noWorkshop')}</Text>
                )}
              </View>
              {batch.deliveryDate ? (
                <Text style={[styles.batchDue, { color: theme.colors.textMuted }]}>
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
    <>
      <View style={[styles.scrollContent, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('navigation.dashboard')}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{t('dashboard.subtitle')}</Text>
          <Text style={[styles.welcome, { color: theme.colors.text }]}>
            {`${t('dashboard.hello')}, ${userName ?? '…'} ✨`}
          </Text>
        </View>
        <View style={[styles.headerIconWrap, { backgroundColor: theme.colors.iconSoft }]}>
          <MaterialIcons name="dashboard" size={28} color={theme.colors.primary} />
        </View>
      </View>

      <View style={twoColumn ? styles.rowTop : styles.colTop}>
        <View style={twoColumn ? styles.half : styles.full}>{piecesPanel}</View>
        <View style={twoColumn ? styles.half : styles.full}>{workshopsPanel}</View>
      </View>

      {batchesPanel}

      {showRanking || showExport ? (
        <View style={[styles.entPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}>
          <View style={styles.entHeaderRow}>
            <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{t('dashboard.owner.industryPanelTitle')}</Text>
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
          <Text style={[styles.entSub, { color: theme.colors.textMuted }]}>{t('dashboard.owner.industryPanelSubtitle')}</Text>
          {showRanking ? (
            entLoading ? (
              <View style={styles.entLoadingBox}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : entRows.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t('dashboard.owner.rankingEmpty')}</Text>
            ) : (
              <View style={styles.rankingList}>
                {entRows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={[styles.rankingRow, { backgroundColor: theme.colors.surfaceSoft }]}>
                    <View style={[styles.rankingIndex, { backgroundColor: theme.colors.iconSoft }]}>
                      <Text style={[styles.rankingIndexText, { color: theme.colors.primary }]}>#{i + 1}</Text>
                    </View>
                    <View style={styles.rankingBody}>
                      <Text style={[styles.rankingTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={[styles.rankingMeta, { color: theme.colors.textMuted }]}>
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

      <Modal
        visible={workshopDetail != null}
        animationType="slide"
        transparent
        onRequestClose={() => setWorkshopDetail(null)}
      >
        <View style={[styles.detailOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.detailSheet,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            {workshopDetail ? (
              <>
                <View style={[styles.detailHeader, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.detailTitle, { color: theme.colors.text }]} numberOfLines={2}>
                    {workshopDetail.workshop.name}
                  </Text>
                  <TouchableOpacity onPress={() => setWorkshopDetail(null)} hitSlop={12}>
                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.detailScroll}
                  contentContainerStyle={styles.detailScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={[styles.detailSection, { color: theme.colors.text }]}>
                    {t('dashboard.owner.detailOperational')}
                  </Text>
                  <View style={styles.detailPillRow}>
                    <View style={[styles.detailColorDot, { backgroundColor: workshopDetail.card.color }]} />
                    <Text style={[styles.detailBody, { color: theme.colors.text }]}>
                      {operationalSituationLabel(t, workshopDetail.card.status)}
                    </Text>
                  </View>

                  <Text style={[styles.detailSection, { color: theme.colors.text, marginTop: 18 }]}>
                    {t('dashboard.owner.detailWorkshopSection')}
                  </Text>
                  <Text style={[styles.detailMeta, { color: theme.colors.textMuted }]}>
                    {t('dashboard.owner.detailAddress')}
                  </Text>
                  <Text style={[styles.detailBody, { color: theme.colors.text }]}>{workshopDetail.workshop.address}</Text>
                  <Text style={[styles.detailMeta, { color: theme.colors.textMuted, marginTop: 10 }]}>
                    {t('dashboard.owner.detailWhatsApp')}
                  </Text>
                  <Text style={[styles.detailBody, { color: theme.colors.text }]}>{workshopDetail.workshop.contact1}</Text>

                  <Text style={[styles.detailSection, { color: theme.colors.text, marginTop: 18 }]}>
                    {t('dashboard.owner.detailBatchSection')}
                  </Text>
                  {workshopDetail.batch ? (
                    <View style={styles.detailBatchBlock}>
                      <Text style={[styles.detailBatchName, { color: theme.colors.text }]}>
                        {workshopDetail.batch.name}
                      </Text>
                      <Text style={[styles.detailBody, { color: theme.colors.textMuted }]}>
                        {workshopDetail.batch.totalPieces} {t('batches.pieces')}
                      </Text>
                      <Text style={[styles.detailBody, { color: theme.colors.textMuted }]}>
                        {t('dashboard.owner.detailBatchStatus')}:{' '}
                        {t(`batches.status.${workshopDetail.batch.status}` as any)}
                      </Text>
                      <Text style={[styles.detailBody, { color: theme.colors.textMuted }]}>
                        {t('dashboard.owner.detailProductionStage')}:{' '}
                        {productionFlowLabel(t, workshopDetail.batch.productionFlowStatus)}
                      </Text>
                      {workshopDetail.batch.deliveryDate ? (
                        <Text style={[styles.detailBody, { color: theme.colors.textMuted }]}>
                          {t('batches.deliveryDate')}: {formatDateShort(language, workshopDetail.batch.deliveryDate)}
                        </Text>
                      ) : null}
                      {workshopDetail.batch.productionNote ? (
                        <Text style={[styles.detailNote, { color: theme.colors.textMuted }]}>
                          {workshopDetail.batch.productionNote}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.detailBody, { color: theme.colors.textMuted }]}>
                      {t('dashboard.owner.detailNoBatch')}
                    </Text>
                  )}
                </ScrollView>
                <View style={[styles.detailFooter, { borderTopColor: theme.colors.border }]}>
                  <TouchableOpacity
                    style={[styles.detailCloseBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => setWorkshopDetail(null)}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.detailCloseBtnText}>{t('dashboard.owner.detailClose')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function rankStatusColor(s: Workshop['status']): string {
  switch (s) {
    case 'free':
      return '#10B981';
    case 'busy':
      return '#F97316';
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
  batchStatusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingIndexText: {
    fontSize: 13,
    fontWeight: '800',
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
  detailOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  detailSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  detailTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  detailScroll: {
    maxHeight: 420,
  },
  detailScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  detailSection: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  detailMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  detailBatchBlock: {
    gap: 6,
  },
  detailBatchName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  detailNote: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontStyle: 'italic',
  },
  detailFooter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  detailCloseBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
