import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getPaymentsByUser } from "../../services/paymentService";
import { getBatchesByUser } from "../../services/batchService";
import { getReceivePiecesByUser } from "../../services/receivePiecesService";
import { getWorkshopsByUser } from "../../services/workshopService";
import { Payment, PaymentStatus } from "../../types/payment";
import { Batch, BatchStatus } from "../../types/batch";
import { ReceivePieces } from "../../types/receivePieces";
import { Workshop } from "../../types/workshop";

type PeriodFilter = "all" | "last30" | "last90" | "thisYear";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 80; // padding + margins

interface MonthData {
  month: string;
  label: string;
  paid: number;
  pending: number;
  overdue: number;
}

interface StatusData {
  status: string;
  count: number;
  color: string;
}

export default function Metrics() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("all");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [receives, setReceives] = useState<ReceivePieces[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [paymentsData, batchesData, receivesData, workshopsData] =
        await Promise.all([
          getPaymentsByUser(user.id),
          getBatchesByUser(user.id),
          getReceivePiecesByUser(user.id),
          getWorkshopsByUser(user.id),
        ]);

      setPayments(paymentsData);
      setBatches(batchesData);
      setReceives(receivesData);
      setWorkshops(workshopsData);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    const now = new Date();
    let cutoffDate: Date | null = null;

    if (period === "last30") {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "last90") {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === "thisYear") {
      cutoffDate = new Date(now.getFullYear(), 0, 1);
    }

    const filteredPayments = cutoffDate
      ? payments.filter((p) => (p.paidDate || p.dueDate) >= cutoffDate)
      : payments;

    const filteredBatches = cutoffDate
      ? batches.filter((b) => b.createdAt >= cutoffDate)
      : batches;

    const filteredReceives = cutoffDate
      ? receives.filter((r) => r.receiveDate >= cutoffDate)
      : receives;

    return { filteredPayments, filteredBatches, filteredReceives };
  };

  const { filteredPayments, filteredBatches, filteredReceives } =
    useMemo(() => getFilteredData(), [payments, batches, receives, period]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalPaid = filteredPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalPending = filteredPayments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalOverdue = filteredPayments
      .filter((p) => p.status === "overdue")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalBatches = filteredBatches.length;
    const completedBatches = filteredBatches.filter(
      (b) => b.status === "completed"
    ).length;
    const totalPieces = filteredBatches.reduce(
      (sum, b) => sum + b.totalPieces,
      0
    );

    const totalReceives = filteredReceives.length;
    const totalPiecesReceived = filteredReceives.reduce(
      (sum, r) => sum + r.piecesReceived,
      0
    );

    const totalWorkshops = workshops.length;
    const workshopsByStatus = {
      green: workshops.filter((w) => w.status === "green").length,
      yellow: workshops.filter((w) => w.status === "yellow").length,
      orange: workshops.filter((w) => w.status === "orange").length,
      red: workshops.filter((w) => w.status === "red").length,
    };

    return {
      totalPaid,
      totalPending,
      totalOverdue,
      totalBatches,
      completedBatches,
      totalPieces,
      totalReceives,
      totalPiecesReceived,
      totalWorkshops,
      workshopsByStatus,
    };
  }, [filteredPayments, filteredBatches, filteredReceives, workshops]);

  // Dados mensais para gráfico de pagamentos
  const monthlyPaymentData = useMemo((): MonthData[] => {
    const map = new Map<string, Payment[]>();
    filteredPayments.forEach((p) => {
      const ref = p.paidDate || p.dueDate;
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });

    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6) // Últimos 6 meses
      .map(([key, items]) => {
        const [year, monthNum] = key.split("-");
        const label = `${monthNames[parseInt(monthNum) - 1]}/${year.slice(2)}`;
        let paid = 0,
          pending = 0,
          overdue = 0;
        items.forEach((p) => {
          if (p.status === "paid") paid += p.amount;
          else if (p.status === "pending") pending += p.amount;
          else if (p.status === "overdue") overdue += p.amount;
        });
        return { month: key, label, paid, pending, overdue };
      });
  }, [filteredPayments]);

  // Dados de status de pagamentos
  const paymentStatusData = useMemo((): StatusData[] => {
    const statusCounts = {
      paid: filteredPayments.filter((p) => p.status === "paid").length,
      pending: filteredPayments.filter((p) => p.status === "pending").length,
      overdue: filteredPayments.filter((p) => p.status === "overdue").length,
      cancelled: filteredPayments.filter((p) => p.status === "cancelled")
        .length,
    };

    return [
      {
        status: "paid",
        count: statusCounts.paid,
        color: "#10B981",
      },
      {
        status: "pending",
        count: statusCounts.pending,
        color: "#F59E0B",
      },
      {
        status: "overdue",
        count: statusCounts.overdue,
        color: "#EF4444",
      },
      {
        status: "cancelled",
        count: statusCounts.cancelled,
        color: "#9CA3AF",
      },
    ].filter((item) => item.count > 0);
  }, [filteredPayments]);

  // Dados de status de lotes
  const batchStatusData = useMemo((): StatusData[] => {
    const statusCounts = {
      pending: filteredBatches.filter((b) => b.status === "pending").length,
      in_progress: filteredBatches.filter((b) => b.status === "in_progress")
        .length,
      completed: filteredBatches.filter((b) => b.status === "completed")
        .length,
      cancelled: filteredBatches.filter((b) => b.status === "cancelled")
        .length,
    };

    return [
      {
        status: "pending",
        count: statusCounts.pending,
        color: "#F59E0B",
      },
      {
        status: "in_progress",
        count: statusCounts.in_progress,
        color: "#6366F1",
      },
      {
        status: "completed",
        count: statusCounts.completed,
        color: "#10B981",
      },
      {
        status: "cancelled",
        count: statusCounts.cancelled,
        color: "#9CA3AF",
      },
    ].filter((item) => item.count > 0);
  }, [filteredBatches]);

  // Dados mensais de recebimentos
  const monthlyReceiveData = useMemo(() => {
    const map = new Map<string, number>();
    filteredReceives.forEach((r) => {
      const key = `${r.receiveDate.getFullYear()}-${String(
        r.receiveDate.getMonth() + 1
      ).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + r.piecesReceived);
    });

    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([key, pieces]) => {
        const [year, monthNum] = key.split("-");
        const label = `${monthNames[parseInt(monthNum) - 1]}/${year.slice(2)}`;
        return { month: key, label, pieces };
      });
  }, [filteredReceives]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR").format(value);

  // Componente de gráfico de barras
  const BarChart = ({
    data,
    maxValue,
    height = 150,
  }: {
    data: { label: string; value: number; color: string }[];
    maxValue: number;
    height?: number;
  }) => {
    if (data.length === 0) {
      return (
        <View style={[styles.chartContainer, { height }]}>
          <Text style={styles.emptyChartText}>
            {t("metrics.noData")}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.chartContainer, { height }]}>
        <View style={styles.barChart}>
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * (height - 40) : 0;
            return (
              <View key={index} style={styles.barItem}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.barValue}>{formatNumber(item.value)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Componente de gráfico de pizza/donut
  const DonutChart = ({
    data,
    total,
  }: {
    data: StatusData[];
    total: number;
  }) => {
    if (data.length === 0 || total === 0) {
      return (
        <View style={styles.donutChartContainer}>
          <Text style={styles.emptyChartText}>
            {t("metrics.noData")}
          </Text>
        </View>
      );
    }

    let currentAngle = -90; // Começa no topo
    const radius = 60;
    const center = 70;

    return (
      <View style={styles.donutChartContainer}>
        <View style={styles.donutChart}>
          <View style={styles.donutInner}>
            <Text style={styles.donutTotal}>{total}</Text>
            <Text style={styles.donutLabel}>{t("metrics.total")}</Text>
          </View>
          {data.map((item, index) => {
            const percentage = (item.count / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            // Calcular coordenadas do arco (simplificado)
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            return (
              <View
                key={index}
                style={[
                  styles.donutSegment,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    borderWidth: 20,
                    borderColor: item.color,
                    opacity: percentage > 5 ? 1 : 0.3,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.donutLegend}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendText}>
                {t(`metrics.status.${item.status}` as any)}: {item.count}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Componente de gráfico de linha simples
  const LineChart = ({
    data,
    maxValue,
    height = 150,
  }: {
    data: { label: string; value: number }[];
    maxValue: number;
    height?: number;
  }) => {
    if (data.length === 0) {
      return (
        <View style={[styles.chartContainer, { height }]}>
          <Text style={styles.emptyChartText}>
            {t("metrics.noData")}
          </Text>
        </View>
      );
    }

    const chartHeight = height - 40;
    const chartWidth = CHART_WIDTH - 40;

    return (
      <View style={[styles.chartContainer, { height }]}>
        <View style={styles.lineChart}>
          <View style={styles.lineChartArea}>
            {data.map((item, index) => {
              const y = maxValue > 0 ? chartHeight - (item.value / maxValue) * chartHeight : chartHeight;
              const x = (index / (data.length - 1 || 1)) * chartWidth;
              return (
                <View
                  key={index}
                  style={[
                    styles.linePoint,
                    {
                      left: x - 4,
                      bottom: y - 4,
                    },
                  ]}
                >
                  <View style={styles.linePointInner} />
                </View>
              );
            })}
          </View>
          <View style={styles.lineChartLabels}>
            {data.map((item, index) => (
              <Text key={index} style={styles.lineLabel} numberOfLines={1}>
                {item.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
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

  const maxPaymentValue = Math.max(
    ...monthlyPaymentData.flatMap((m) => [m.paid, m.pending, m.overdue]),
    1
  );
  const maxReceiveValue = Math.max(
    ...monthlyReceiveData.map((m) => m.pieces),
    1
  );

  const PERIODS: { key: PeriodFilter; label: string }[] = [
    { key: "all", label: t("metrics.periodAll") },
    { key: "last30", label: t("metrics.periodLast30") },
    { key: "last90", label: t("metrics.periodLast90") },
    { key: "thisYear", label: t("metrics.periodThisYear") },
  ];

  return (
    <Layout>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("metrics.title")}</Text>
            <Text style={styles.subtitle}>{t("metrics.subtitle")}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="bar-chart" size={28} color="#6366F1" />
          </View>
        </View>

        {/* Period Filter */}
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.filterChip,
                  period === p.key && styles.filterChipActive,
                ]}
                onPress={() => setPeriod(p.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    period === p.key && styles.filterChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, { borderLeftColor: "#10B981" }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#D1FAE5" }]}>
                <MaterialIcons name="check-circle" size={20} color="#10B981" />
              </View>
              <Text style={[styles.summaryValue, { color: "#10B981" }]}>
                {formatCurrency(stats.totalPaid)}
              </Text>
              <Text style={styles.summaryLabel}>
                {t("metrics.totalPaid")}
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderLeftColor: "#6366F1" }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#F0F4FF" }]}>
                <MaterialIcons name="inventory" size={20} color="#6366F1" />
              </View>
              <Text style={[styles.summaryValue, { color: "#6366F1" }]}>
                {stats.totalBatches}
              </Text>
              <Text style={styles.summaryLabel}>
                {t("metrics.totalBatches")}
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#FEF3C7" }]}>
                <MaterialIcons name="inbox" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
                {formatNumber(stats.totalPiecesReceived)}
              </Text>
              <Text style={styles.summaryLabel}>
                {t("metrics.totalPiecesReceived")}
              </Text>
            </View>

            <View style={[styles.summaryCard, { borderLeftColor: "#8B5CF6" }]}>
              <View style={[styles.summaryIconWrap, { backgroundColor: "#EDE9FE" }]}>
                <MaterialIcons name="business" size={20} color="#8B5CF6" />
              </View>
              <Text style={[styles.summaryValue, { color: "#8B5CF6" }]}>
                {stats.totalWorkshops}
              </Text>
              <Text style={styles.summaryLabel}>
                {t("metrics.totalWorkshops")}
              </Text>
            </View>
          </View>

          {/* Payment Status Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <MaterialIcons name="pie-chart" size={20} color="#6366F1" />
              <Text style={styles.chartTitle}>
                {t("metrics.paymentStatus")}
              </Text>
            </View>
            <DonutChart
              data={paymentStatusData}
              total={filteredPayments.length}
            />
          </View>

          {/* Monthly Payments Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <MaterialIcons name="show-chart" size={20} color="#6366F1" />
              <Text style={styles.chartTitle}>
                {t("metrics.monthlyPayments")}
              </Text>
            </View>
            <BarChart
              data={monthlyPaymentData.map((m) => ({
                label: m.label,
                value: m.paid + m.pending + m.overdue,
                color: "#6366F1",
              }))}
              maxValue={maxPaymentValue}
            />
          </View>

          {/* Batch Status Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <MaterialIcons name="pie-chart" size={20} color="#6366F1" />
              <Text style={styles.chartTitle}>
                {t("metrics.batchStatus")}
              </Text>
            </View>
            <DonutChart
              data={batchStatusData}
              total={filteredBatches.length}
            />
          </View>

          {/* Monthly Receives Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <MaterialIcons name="trending-up" size={20} color="#6366F1" />
              <Text style={styles.chartTitle}>
                {t("metrics.monthlyReceives")}
              </Text>
            </View>
            <LineChart
              data={monthlyReceiveData.map((m) => ({
                label: m.label,
                value: m.pieces,
              }))}
              maxValue={maxReceiveValue}
            />
          </View>

          {/* Workshop Status */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <MaterialIcons name="assessment" size={20} color="#6366F1" />
              <Text style={styles.chartTitle}>
                {t("metrics.workshopStatus")}
              </Text>
            </View>
            <View style={styles.workshopStatusGrid}>
              <View style={styles.workshopStatusItem}>
                <View style={[styles.workshopStatusDot, { backgroundColor: "#10B981" }]} />
                <Text style={styles.workshopStatusLabel}>
                  {t("metrics.green")}
                </Text>
                <Text style={styles.workshopStatusValue}>
                  {stats.workshopsByStatus.green}
                </Text>
              </View>
              <View style={styles.workshopStatusItem}>
                <View style={[styles.workshopStatusDot, { backgroundColor: "#F59E0B" }]} />
                <Text style={styles.workshopStatusLabel}>
                  {t("metrics.yellow")}
                </Text>
                <Text style={styles.workshopStatusValue}>
                  {stats.workshopsByStatus.yellow}
                </Text>
              </View>
              <View style={styles.workshopStatusItem}>
                <View style={[styles.workshopStatusDot, { backgroundColor: "#F97316" }]} />
                <Text style={styles.workshopStatusLabel}>
                  {t("metrics.orange")}
                </Text>
                <Text style={styles.workshopStatusValue}>
                  {stats.workshopsByStatus.orange}
                </Text>
              </View>
              <View style={styles.workshopStatusItem}>
                <View style={[styles.workshopStatusDot, { backgroundColor: "#EF4444" }]} />
                <Text style={styles.workshopStatusLabel}>
                  {t("metrics.red")}
                </Text>
                <Text style={styles.workshopStatusValue}>
                  {stats.workshopsByStatus.red}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
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
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  filterChipActive: {
    borderColor: "#6366F1",
    backgroundColor: "#F0F4FF",
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterChipTextActive: {
    color: "#6366F1",
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  chartContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyChartText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    width: "100%",
    height: "100%",
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  barWrapper: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "80%",
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
  },
  barValue: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1F2937",
  },
  donutChartContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  donutChart: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  donutInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutTotal: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  donutLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  donutSegment: {
    position: "absolute",
  },
  donutLegend: {
    marginTop: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: "#374151",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
    flexWrap: "wrap",
  },
  lineChart: {
    width: "100%",
  },
  lineChartArea: {
    width: "100%",
    height: 120,
    position: "relative",
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  linePointInner: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#6366F1",
  },
  lineChartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  lineLabel: {
    fontSize: 10,
    color: "#6B7280",
    flex: 1,
    textAlign: "center",
  },
  workshopStatusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 8,
  },
  workshopStatusItem: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
  },
  workshopStatusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  workshopStatusLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  workshopStatusValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
});
