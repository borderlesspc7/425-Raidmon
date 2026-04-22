import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchAdminDashboardStats } from "../../services/adminStatsService";
import type { AdminDashboardStats } from "../../types/adminStats";
import { useCountUp } from "../../hooks/useCountUp";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function ProportionalBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const rest = Math.max(0, max - value);
  return (
    <View style={styles.propBarTrack}>
      <View style={[styles.propBarFill, { flex: value || 0, backgroundColor: color }]} />
      <View style={{ flex: rest || 1, backgroundColor: "#E5E7EB" }} />
    </View>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAdminDashboardStats();
      setStats(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const u = stats?.users;
  const maxUserSlice = u
    ? Math.max(u.owners, u.workshops, u.admins, 1)
    : 1;
  const b = stats?.batchesByStatus;
  const maxBatchStatus = b
    ? Math.max(b.pending, b.in_progress, b.completed, b.cancelled, 1)
    : 1;
  const reg = stats?.registrationsLast6Months ?? [];
  const maxReg = Math.max(...reg.map((r) => r.count), 1);
  const animatedUsersTotal = useCountUp(u?.total ?? 0);
  const animatedUsersActive30 = useCountUp(u?.activeLast30Days ?? 0);
  const animatedUsersOwners = useCountUp(u?.owners ?? 0);
  const animatedUsersWorkshops = useCountUp(u?.workshops ?? 0);
  const animatedUsersAdmins = useCountUp(u?.admins ?? 0);
  const animatedTotalWorkshops = useCountUp(stats?.totalWorkshops ?? 0);
  const animatedTotalBatches = useCountUp(stats?.totalBatches ?? 0);
  const animatedTotalCuts = useCountUp(stats?.totalCuts ?? 0);
  const animatedTotalReceiveEvents = useCountUp(stats?.totalReceiveEvents ?? 0);
  const animatedTotalPiecesInCuts = useCountUp(stats?.totalPiecesInCuts ?? 0);
  const animatedTotalPiecesInBatches = useCountUp(stats?.totalPiecesInBatches ?? 0);
  const animatedPiecesInOpenBatches = useCountUp(stats?.piecesInOpenBatches ?? 0);
  const animatedBatchPending = useCountUp(b?.pending ?? 0);
  const animatedBatchInProgress = useCountUp(b?.in_progress ?? 0);
  const animatedBatchCompleted = useCountUp(b?.completed ?? 0);
  const animatedBatchCancelled = useCountUp(b?.cancelled ?? 0);
  const animatedPendingPaymentsCount = useCountUp(stats?.payments.pending.count ?? 0);
  const animatedPaidPaymentsCount = useCountUp(stats?.payments.paid.count ?? 0);
  const animatedOverduePaymentsCount = useCountUp(stats?.payments.overdue.count ?? 0);
  const animatedPendingAmount = useCountUp(stats?.payments.pending.totalAmount ?? 0, { durationMs: 1800 });
  const animatedPaidAmount = useCountUp(stats?.payments.paid.totalAmount ?? 0, { durationMs: 1800 });
  const animatedOverdueAmount = useCountUp(stats?.payments.overdue.totalAmount ?? 0, { durationMs: 1800 });

  return (
    <Layout>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("adminDashboard.title")}</Text>
            <Text style={styles.subtitle}>{t("adminDashboard.subtitle")}</Text>
            <Text style={styles.welcome}>
              {t("dashboard.hello")}, {user?.name || "Admin"}.
            </Text>
            {stats && (
              <Text style={styles.meta}>
                {t("adminDashboard.updatedAt")}:{" "}
                {stats.fetchedAt.toLocaleString()}
              </Text>
            )}
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="admin-panel-settings" size={30} color="#4F46E5" />
          </View>
        </View>

        {loading && !stats && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>{t("adminDashboard.loading")}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={28} color="#DC2626" />
            <Text style={styles.errorTitle}>{t("adminDashboard.error")}</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>{t("adminDashboard.hintRules")}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
              <Text style={styles.retryText}>{t("adminDashboard.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {stats && u && b && (
          <>
            <Text style={styles.sectionTitle}>{t("adminDashboard.sectionUsers")}</Text>
            <View style={styles.kpiGrid}>
              <KpiCard
                icon="people"
                color="#6366F1"
                label={t("adminDashboard.totalUsers")}
                value={String(Math.round(animatedUsersTotal))}
              />
              <KpiCard
                icon="bolt"
                color="#10B981"
                label={t("adminDashboard.active30")}
                value={String(Math.round(animatedUsersActive30))}
                hint={t("adminDashboard.active30Hint")}
              />
              <KpiCard
                icon="badge"
                color="#2563EB"
                label={t("adminDashboard.owners")}
                value={`${Math.round(animatedUsersOwners)} (${pct(u.owners, u.total)}%)`}
              />
              <KpiCard
                icon="build"
                color="#0EA5E9"
                label={t("adminDashboard.workshops")}
                value={`${Math.round(animatedUsersWorkshops)} (${pct(u.workshops, u.total)}%)`}
              />
              <KpiCard
                icon="admin-panel-settings"
                color="#DC2626"
                label={t("adminDashboard.admins")}
                value={`${Math.round(animatedUsersAdmins)}`}
              />
            </View>

            <View style={styles.card}>
              <BarLabeled
                label={t("adminDashboard.owners")}
                value={Math.round(animatedUsersOwners)}
                max={maxUserSlice}
                color="#2563EB"
              />
              <BarLabeled
                label={t("adminDashboard.workshops")}
                value={Math.round(animatedUsersWorkshops)}
                max={maxUserSlice}
                color="#0EA5E9"
              />
              <BarLabeled
                label={t("adminDashboard.admins")}
                value={Math.round(animatedUsersAdmins)}
                max={maxUserSlice}
                color="#DC2626"
              />
            </View>

            <Text style={styles.sectionTitle}>{t("adminDashboard.sectionMovement")}</Text>
            <View style={styles.kpiGrid}>
              <KpiCard
                icon="business"
                color="#6366F1"
                label={t("adminDashboard.totalWorkshops")}
                value={String(Math.round(animatedTotalWorkshops))}
              />
              <KpiCard
                icon="inventory"
                color="#D97706"
                label={t("adminDashboard.totalBatches")}
                value={String(Math.round(animatedTotalBatches))}
              />
              <KpiCard
                icon="content-cut"
                color="#8B5CF6"
                label={t("adminDashboard.totalCuts")}
                value={String(Math.round(animatedTotalCuts))}
              />
              <KpiCard
                icon="inbox"
                color="#059669"
                label={t("adminDashboard.totalReceives")}
                value={String(Math.round(animatedTotalReceiveEvents))}
              />
              <KpiCard
                icon="straighten"
                color="#7C3AED"
                label={t("adminDashboard.piecesInCuts")}
                value={String(Math.round(animatedTotalPiecesInCuts))}
              />
              <KpiCard
                icon="layers"
                color="#EA580C"
                label={t("adminDashboard.piecesInBatches")}
                value={String(Math.round(animatedTotalPiecesInBatches))}
              />
              <KpiCard
                icon="hourglass-empty"
                color="#CA8A04"
                label={t("adminDashboard.piecesInOpenBatches")}
                value={String(Math.round(animatedPiecesInOpenBatches))}
              />
            </View>

            <Text style={styles.sectionTitle}>{t("adminDashboard.sectionBatches")}</Text>
            <View style={styles.card}>
              <BarLabeled
                label={t("adminDashboard.statusPending")}
                value={Math.round(animatedBatchPending)}
                max={maxBatchStatus}
                color="#94A3B8"
              />
              <BarLabeled
                label={t("adminDashboard.statusInProgress")}
                value={Math.round(animatedBatchInProgress)}
                max={maxBatchStatus}
                color="#F59E0B"
              />
              <BarLabeled
                label={t("adminDashboard.statusCompleted")}
                value={Math.round(animatedBatchCompleted)}
                max={maxBatchStatus}
                color="#22C55E"
              />
              <BarLabeled
                label={t("adminDashboard.statusCancelled")}
                value={Math.round(animatedBatchCancelled)}
                max={maxBatchStatus}
                color="#64748B"
              />
            </View>

            <Text style={styles.sectionTitle}>
              {t("adminDashboard.sectionRegistrations")}
            </Text>
            <View style={styles.card}>
              {reg.map((point) => (
                <View key={point.label} style={{ marginBottom: 12 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.chartLabel}>{point.label}</Text>
                    <Text style={styles.chartValue}>{point.count}</Text>
                  </View>
                  <ProportionalBar value={point.count} max={maxReg} color="#6366F1" />
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>{t("adminDashboard.sectionFinance")}</Text>
            <View style={styles.card}>
              <View style={styles.financeRow}>
                <MaterialIcons name="schedule" size={22} color="#CA8A04" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.financeLabel}>{t("adminDashboard.pending")}</Text>
                  <Text style={styles.financeSub}>
                    {t("adminDashboard.count")}: {Math.round(animatedPendingPaymentsCount)} ·{" "}
                    {t("adminDashboard.amount")}: {formatBRL(Math.round(animatedPendingAmount))}
                  </Text>
                </View>
              </View>
              <View style={styles.financeRow}>
                <MaterialIcons name="check-circle" size={22} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.financeLabel}>{t("adminDashboard.paid")}</Text>
                  <Text style={styles.financeSub}>
                    {t("adminDashboard.count")}: {Math.round(animatedPaidPaymentsCount)} ·{" "}
                    {t("adminDashboard.amount")}: {formatBRL(Math.round(animatedPaidAmount))}
                  </Text>
                </View>
              </View>
              <View style={styles.financeRow}>
                <MaterialIcons name="warning" size={22} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.financeLabel}>{t("adminDashboard.overdue")}</Text>
                  <Text style={styles.financeSub}>
                    {t("adminDashboard.count")}: {Math.round(animatedOverduePaymentsCount)} ·{" "}
                    {t("adminDashboard.amount")}: {formatBRL(Math.round(animatedOverdueAmount))}
                  </Text>
                </View>
              </View>
              <View style={styles.futureBox}>
                <MaterialIcons name="info-outline" size={18} color="#64748B" />
                <Text style={styles.futureText}>{t("adminDashboard.financeFuture")}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Layout>
  );
}

function KpiCard({
  icon,
  color,
  label,
  value,
  hint,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: `${color}1F` }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiTitle}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

function BarLabeled({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.chartLabel}>{label}</Text>
        <Text style={styles.chartValue}>{value}</Text>
      </View>
      <ProportionalBar value={value} max={max} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 6,
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  welcome: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  meta: {
    marginTop: 6,
    fontSize: 11,
    color: "#9CA3AF",
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 11,
    color: "#6B7280",
  },
  kpiValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  kpiHint: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  chartValue: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
  },
  propBarTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  propBarFill: {
    flex: 1,
    borderRadius: 5,
  },
  centerBox: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991B1B",
  },
  errorBody: {
    fontSize: 13,
    color: "#7F1D1D",
  },
  errorHint: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#DC2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  financeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  financeLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  financeSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  futureBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  futureText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
});
