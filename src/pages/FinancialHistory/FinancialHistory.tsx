import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getPaymentsByUser } from "../../services/paymentService";
import { Payment, PaymentStatus } from "../../types/payment";

type PeriodFilter = "all" | "last3months" | "last6months" | "thisYear" | "lastYear";

interface MonthGroup {
  key: string; // "2024-01"
  label: string; // "Janeiro 2024"
  payments: Payment[];
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  totalCancelled: number;
}

export default function FinancialHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Summary stats
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);

  useEffect(() => {
    if (user?.id) loadPayments();
  }, [user]);

  const loadPayments = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await getPaymentsByUser(user.id);
      setPayments(data);

      let paid = 0, pending = 0, overdue = 0;
      data.forEach((p) => {
        if (p.status === "paid") paid += p.amount;
        else if (p.status === "pending") pending += p.amount;
        else if (p.status === "overdue") overdue += p.amount;
      });
      setTotalPaid(paid);
      setTotalPending(pending);
      setTotalOverdue(overdue);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPayments = (): Payment[] => {
    if (period === "all") return payments;
    const now = new Date();
    return payments.filter((p) => {
      const ref = p.paidDate || p.dueDate;
      if (period === "last3months") {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        return ref >= cutoff;
      }
      if (period === "last6months") {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        return ref >= cutoff;
      }
      if (period === "thisYear") {
        return ref.getFullYear() === now.getFullYear();
      }
      if (period === "lastYear") {
        return ref.getFullYear() === now.getFullYear() - 1;
      }
      return true;
    });
  };

  const groupByMonth = (list: Payment[]): MonthGroup[] => {
    const map = new Map<string, Payment[]>();
    list.forEach((p) => {
      const ref = p.paidDate || p.dueDate;
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // mais recente primeiro
      .map(([key, items]) => {
        const [year, monthNum] = key.split("-");
        const label = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
        let totalPaid = 0, totalPending = 0, totalOverdue = 0, totalCancelled = 0;
        items.forEach((p) => {
          if (p.status === "paid") totalPaid += p.amount;
          else if (p.status === "pending") totalPending += p.amount;
          else if (p.status === "overdue") totalOverdue += p.amount;
          else if (p.status === "cancelled") totalCancelled += p.amount;
        });
        return { key, label, payments: items, totalPaid, totalPending, totalOverdue, totalCancelled };
      });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

  const getStatusColor = (s: PaymentStatus) => {
    switch (s) {
      case "paid": return "#10B981";
      case "pending": return "#F59E0B";
      case "overdue": return "#EF4444";
      case "cancelled": return "#9CA3AF";
    }
  };

  const getStatusBg = (s: PaymentStatus) => {
    switch (s) {
      case "paid": return "#D1FAE5";
      case "pending": return "#FEF3C7";
      case "overdue": return "#FEE2E2";
      case "cancelled": return "#F3F4F6";
    }
  };

  const getStatusIcon = (s: PaymentStatus): any => {
    switch (s) {
      case "paid": return "check-circle";
      case "pending": return "schedule";
      case "overdue": return "warning";
      case "cancelled": return "cancel";
    }
  };

  const filtered = getFilteredPayments();
  const monthGroups = groupByMonth(filtered);
  const filteredTotalPaid = filtered.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const filteredTotalPending = filtered.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const filteredTotalOverdue = filtered.filter((p) => p.status === "overdue").reduce((s, p) => s + p.amount, 0);
  const balance = filteredTotalPaid - filteredTotalPending - filteredTotalOverdue;

  const PERIODS: { key: PeriodFilter; label: string }[] = [
    { key: "all", label: t("financialHistory.allPeriods") },
    { key: "last3months", label: t("financialHistory.last3months") },
    { key: "last6months", label: t("financialHistory.last6months") },
    { key: "thisYear", label: t("financialHistory.thisYear") },
    { key: "lastYear", label: t("financialHistory.lastYear") },
  ];

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
            <Text style={styles.title}>{t("financialHistory.title")}</Text>
            <Text style={styles.subtitle}>
              {filtered.length} {t("financialHistory.payments")}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="account-balance" size={28} color="#6366F1" />
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#10B981" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="check-circle" size={20} color="#10B981" />
            </View>
            <Text style={[styles.summaryValue, { color: "#10B981" }]}>
              {formatCurrency(filteredTotalPaid)}
            </Text>
            <Text style={styles.summaryLabel}>{t("financialHistory.totalPaid")}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="schedule" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
              {formatCurrency(filteredTotalPending)}
            </Text>
            <Text style={styles.summaryLabel}>{t("financialHistory.totalPending")}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#EF4444" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#FEE2E2" }]}>
              <MaterialIcons name="warning" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.summaryValue, { color: "#EF4444" }]}>
              {formatCurrency(filteredTotalOverdue)}
            </Text>
            <Text style={styles.summaryLabel}>{t("financialHistory.totalOverdue")}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#6366F1" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#F0F4FF" }]}>
              <MaterialIcons name="account-balance-wallet" size={20} color="#6366F1" />
            </View>
            <Text
              style={[
                styles.summaryValue,
                { color: balance >= 0 ? "#6366F1" : "#EF4444" },
              ]}
            >
              {formatCurrency(filteredTotalPaid)}
            </Text>
            <Text style={styles.summaryLabel}>{t("financialHistory.balance")}</Text>
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

        {/* Monthly Groups */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {monthGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {period === "all"
                  ? t("financialHistory.empty")
                  : t("financialHistory.emptyPeriod")}
              </Text>
            </View>
          ) : (
            monthGroups.map((group) => {
              const isExpanded = expandedMonths.has(group.key);
              const monthTotal = group.totalPaid + group.totalPending + group.totalOverdue + group.totalCancelled;

              // Bar proportions
              const barMax = monthTotal || 1;
              const paidPct = (group.totalPaid / barMax) * 100;
              const pendingPct = (group.totalPending / barMax) * 100;
              const overduePct = (group.totalOverdue / barMax) * 100;

              return (
                <View key={group.key} style={styles.monthCard}>
                  {/* Month Header */}
                  <TouchableOpacity
                    style={styles.monthHeader}
                    onPress={() => toggleMonth(group.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.monthHeaderLeft}>
                      <View style={styles.monthIconWrap}>
                        <MaterialIcons name="calendar-today" size={18} color="#6366F1" />
                      </View>
                      <View>
                        <Text style={styles.monthLabel}>{group.label}</Text>
                        <Text style={styles.monthCount}>
                          {group.payments.length} {t("financialHistory.payments")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.monthHeaderRight}>
                      <Text style={styles.monthTotal}>
                        {formatCurrency(monthTotal)}
                      </Text>
                      <MaterialIcons
                        name={isExpanded ? "expand-less" : "expand-more"}
                        size={22}
                        color="#6B7280"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Mini Summary */}
                  <View style={styles.monthStats}>
                    {group.totalPaid > 0 && (
                      <View style={styles.monthStatItem}>
                        <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                        <Text style={styles.monthStatText}>
                          {formatCurrency(group.totalPaid)}
                        </Text>
                      </View>
                    )}
                    {group.totalPending > 0 && (
                      <View style={styles.monthStatItem}>
                        <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                        <Text style={styles.monthStatText}>
                          {formatCurrency(group.totalPending)}
                        </Text>
                      </View>
                    )}
                    {group.totalOverdue > 0 && (
                      <View style={styles.monthStatItem}>
                        <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                        <Text style={styles.monthStatText}>
                          {formatCurrency(group.totalOverdue)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                      {paidPct > 0 && (
                        <View
                          style={[
                            styles.progressSegment,
                            { width: `${paidPct}%` as any, backgroundColor: "#10B981" },
                          ]}
                        />
                      )}
                      {pendingPct > 0 && (
                        <View
                          style={[
                            styles.progressSegment,
                            { width: `${pendingPct}%` as any, backgroundColor: "#F59E0B" },
                          ]}
                        />
                      )}
                      {overduePct > 0 && (
                        <View
                          style={[
                            styles.progressSegment,
                            { width: `${overduePct}%` as any, backgroundColor: "#EF4444" },
                          ]}
                        />
                      )}
                    </View>
                  </View>

                  {/* Payment Items (expanded) */}
                  {isExpanded && (
                    <View style={styles.paymentList}>
                      {group.payments
                        .sort((a, b) => (b.paidDate || b.dueDate).getTime() - (a.paidDate || a.dueDate).getTime())
                        .map((payment) => (
                          <View key={payment.id} style={styles.paymentItem}>
                            <View style={styles.paymentItemLeft}>
                              <View
                                style={[
                                  styles.paymentStatusDot,
                                  { backgroundColor: getStatusBg(payment.status) },
                                ]}
                              >
                                <MaterialIcons
                                  name={getStatusIcon(payment.status)}
                                  size={14}
                                  color={getStatusColor(payment.status)}
                                />
                              </View>
                              <View style={styles.paymentItemInfo}>
                                <Text style={styles.paymentItemDesc} numberOfLines={1}>
                                  {payment.description}
                                </Text>
                                <View style={styles.paymentItemMeta}>
                                  {payment.workshopName && (
                                    <Text style={styles.paymentItemMetaText}>
                                      <MaterialIcons name="business" size={11} color="#9CA3AF" />{" "}
                                      {payment.workshopName}
                                    </Text>
                                  )}
                                  <Text style={styles.paymentItemMetaText}>
                                    {payment.paidDate
                                      ? `${t("financialHistory.paidOn")} ${formatDate(payment.paidDate)}`
                                      : `${t("financialHistory.dueOn")} ${formatDate(payment.dueDate)}`}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.paymentItemRight}>
                              <Text
                                style={[
                                  styles.paymentItemAmount,
                                  { color: getStatusColor(payment.status) },
                                ]}
                              >
                                {formatCurrency(payment.amount)}
                              </Text>
                              <View
                                style={[
                                  styles.paymentItemBadge,
                                  { backgroundColor: getStatusBg(payment.status) },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.paymentItemBadgeText,
                                    { color: getStatusColor(payment.status) },
                                  ]}
                                >
                                  {t(`financialHistory.status.${payment.status}` as any)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
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
  // Summary
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
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
  // Filter
  filterBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
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
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  // Month Card
  monthCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  monthHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  monthIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F0F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  monthCount: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  monthHeaderRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  monthTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  // Mini stats
  monthStats: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 14,
  },
  monthStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  monthStatText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  // Progress bar
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    overflow: "hidden",
  },
  progressSegment: {
    height: 6,
  },
  // Payment list
  paymentList: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  paymentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  paymentItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    marginRight: 12,
  },
  paymentStatusDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentItemInfo: {
    flex: 1,
  },
  paymentItemDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  paymentItemMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  paymentItemMetaText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  paymentItemRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  paymentItemAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  paymentItemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  paymentItemBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
