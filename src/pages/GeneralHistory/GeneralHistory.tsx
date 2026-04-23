import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebaseconfig";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Layout from "../../components/Layout/Layout";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getPaymentsByUser } from "../../services/paymentService";
import { getBatchesByUser, getBatchesLinkedToWorkshop } from "../../services/batchService";
import { getReceivePiecesByUser } from "../../services/receivePiecesService";
import { getInAppNotificationsForUser } from "../../services/notificationService";
import { Payment } from "../../types/payment";
import { Batch } from "../../types/batch";
import { ReceivePieces } from "../../types/receivePieces";
import type { InAppNotification } from "../../types/inAppNotification";

type HistoryEventType = "payment" | "batch" | "receive" | "notification";

type HistoryFilter = "all" | HistoryEventType;

type PeriodFilter = "all" | "last30" | "last90" | "thisYear";

interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  date: Date;
  title: string;
  description: string;
  meta?: string;
}

export default function GeneralHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [typeFilter, setTypeFilter] = useState<HistoryFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const loadHistory = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user?.id) return;
      try {
        if (!opts?.silent) setLoading(true);

        const [payments, batchesOwn, receives, notifications] = await Promise.all([
          getPaymentsByUser(user.id),
          getBatchesByUser(user.id),
          getReceivePiecesByUser(user.id),
          getInAppNotificationsForUser(user.id),
        ]);

        let batchesMerged = [...batchesOwn];
        if (user.userType === "workshop") {
          const linked = await getBatchesLinkedToWorkshop(user.id);
          const seen = new Set(batchesMerged.map((b) => b.id));
          for (const b of linked) {
            if (!seen.has(b.id)) {
              batchesMerged.push(b);
              seen.add(b.id);
            }
          }
        }

        const paymentEvents = mapPaymentsToEvents(payments, t);
        const batchEvents = mapBatchesToEvents(
          batchesMerged,
          t,
          user.userType === "workshop" ? user.id : undefined,
        );
        const receiveEvents = mapReceivesToEvents(receives, t);
        const notifEvents = mapNotificationsToEvents(notifications, t);

        const allEvents = [
          ...paymentEvents,
          ...batchEvents,
          ...receiveEvents,
          ...notifEvents,
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        setEvents(allEvents);
      } catch (error: any) {
        console.error("Erro ao carregar histórico geral:", error);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [user, t],
  );

  useEffect(() => {
    if (!user?.id) return;
    void loadHistory();
    const unsubs: (() => void)[] = [];
    const qOwn = query(collection(db, "batches"), where("userId", "==", user.id));
    unsubs.push(
      onSnapshot(qOwn, () => {
        void loadHistory({ silent: true });
      }),
    );
    if (user.userType === "workshop") {
      const qLinked = query(
        collection(db, "batches"),
        where("linkedWorkshopUserId", "==", user.id),
      );
      unsubs.push(
        onSnapshot(qLinked, () => {
          void loadHistory({ silent: true });
        }),
      );
    }
    const qNot = query(
      collection(db, "inAppNotifications"),
      where("userId", "==", user.id),
    );
    unsubs.push(
      onSnapshot(qNot, () => {
        void loadHistory({ silent: true });
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [user?.id, user?.userType, loadHistory]);

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    let list = [...events];

    if (typeFilter !== "all") {
      list = list.filter((e) => e.type === typeFilter);
    }

    list = list.filter((e) => {
      if (periodFilter === "all") return true;

      const diffMs = now.getTime() - e.date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (periodFilter === "last30") return diffDays <= 30;
      if (periodFilter === "last90") return diffDays <= 90;
      if (periodFilter === "thisYear") {
        return e.date.getFullYear() === now.getFullYear();
      }

      return true;
    });

    return list;
  }, [events, typeFilter, periodFilter]);

  const totalPayments = events.filter((e) => e.type === "payment").length;
  const totalBatches = events.filter((e) => e.type === "batch").length;
  const totalReceives = events.filter((e) => e.type === "receive").length;
  const totalNotifications = events.filter((e) => e.type === "notification").length;

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
            <Text style={styles.title}>{t("navigation.generalHistory")}</Text>
            <Text style={styles.subtitle}>
              {t("generalHistory.subtitle")} • {events.length}{" "}
              {t("generalHistory.events")}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="timeline" size={28} color="#6366F1" />
          </View>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#6366F1" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#EEF2FF" }]}>
              <MaterialIcons name="payment" size={20} color="#6366F1" />
            </View>
            <Text style={styles.summaryValue}>{totalPayments}</Text>
            <Text style={styles.summaryLabel}>{t("generalHistory.payments")}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#10B981" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="inventory" size={20} color="#10B981" />
            </View>
            <Text style={styles.summaryValue}>{totalBatches}</Text>
            <Text style={styles.summaryLabel}>{t("generalHistory.batches")}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="inbox" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.summaryValue}>{totalReceives}</Text>
            <Text style={styles.summaryLabel}>{t("generalHistory.receives")}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#8B5CF6" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#EDE9FE" }]}>
              <MaterialIcons name="notifications" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.summaryValue}>{totalNotifications}</Text>
            <Text style={styles.summaryLabel}>{t("generalHistory.notifications")}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#4B5563" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#E5E7EB" }]}>
              <MaterialIcons name="history" size={20} color="#4B5563" />
            </View>
            <Text style={styles.summaryValue}>{events.length}</Text>
            <Text style={styles.summaryLabel}>{t("generalHistory.totalEvents")}</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <FilterChip
              label={t("generalHistory.filterAll")}
              active={typeFilter === "all"}
              onPress={() => setTypeFilter("all")}
            />
            <FilterChip
              label={t("generalHistory.filterPayments")}
              active={typeFilter === "payment"}
              onPress={() => setTypeFilter("payment")}
            />
            <FilterChip
              label={t("generalHistory.filterBatches")}
              active={typeFilter === "batch"}
              onPress={() => setTypeFilter("batch")}
            />
            <FilterChip
              label={t("generalHistory.filterReceives")}
              active={typeFilter === "receive"}
              onPress={() => setTypeFilter("receive")}
            />
            <FilterChip
              label={t("generalHistory.filterNotifications")}
              active={typeFilter === "notification"}
              onPress={() => setTypeFilter("notification")}
            />
          </ScrollView>
        </View>

        {/* Period filters */}
        <View style={[styles.filterBar, styles.periodBar]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <FilterChip
              label={t("generalHistory.periodAll")}
              active={periodFilter === "all"}
              onPress={() => setPeriodFilter("all")}
            />
            <FilterChip
              label={t("generalHistory.periodLast30")}
              active={periodFilter === "last30"}
              onPress={() => setPeriodFilter("last30")}
            />
            <FilterChip
              label={t("generalHistory.periodLast90")}
              active={periodFilter === "last90"}
              onPress={() => setPeriodFilter("last90")}
            />
            <FilterChip
              label={t("generalHistory.periodThisYear")}
              active={periodFilter === "thisYear"}
              onPress={() => setPeriodFilter("thisYear")}
            />
          </ScrollView>
        </View>

        {/* Timeline */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="timeline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {events.length === 0
                  ? t("generalHistory.empty")
                  : t("generalHistory.emptyFiltered")}
              </Text>
            </View>
          ) : (
            filteredEvents.map((event) => (
              <View key={`${event.type}-${event.id}`} style={styles.eventRow}>
                <View style={styles.timelineColumn}>
                  <View style={styles.timelineDotWrapper}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: getEventColor(event.type) },
                      ]}
                    />
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <View style={styles.eventHeaderLeft}>
                      <View
                        style={[
                          styles.eventIcon,
                          { backgroundColor: getEventBgColor(event.type) },
                        ]}
                      >
                        <MaterialIcons
                          name={getEventIcon(event.type)}
                          size={18}
                          color={getEventColor(event.type)}
                        />
                      </View>
                      <View style={styles.eventHeaderText}>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={styles.eventType}>
                          {getEventTypeLabel(event.type, t)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.eventDate}>{formatDateTime(event.date)}</Text>
                  </View>
                  {event.description ? (
                    <Text style={styles.eventDescription} numberOfLines={3}>
                      {event.description}
                    </Text>
                  ) : null}
                  {event.meta ? (
                    <Text style={styles.eventMeta} numberOfLines={2}>
                      {event.meta}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Layout>
  );
}

const FilterChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

function mapPaymentsToEvents(payments: Payment[], t: (key: string) => string): HistoryEvent[] {
  return payments.map((p) => {
    const date = p.paidDate || p.dueDate || p.createdAt;
    return {
      id: p.id,
      type: "payment",
      date,
      title: p.description || t("payments.title"),
      description: p.workshopName || p.batchName || "",
      meta: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(p.amount),
    };
  });
}

function mapBatchesToEvents(
  batches: Batch[],
  t: (key: string) => string,
  workshopViewerId?: string,
): HistoryEvent[] {
  return batches.map((b) => {
    const date = b.updatedAt || b.createdAt;
    const fromOwnerInvite =
      workshopViewerId &&
      b.linkedWorkshopUserId === workshopViewerId &&
      b.userId !== workshopViewerId;
    return {
      id: b.id,
      type: "batch",
      date,
      title: b.name,
      description: fromOwnerInvite
        ? t("generalHistory.batchFromOwnerInvite")
        : b.workshopName || "",
      meta: `${b.totalPieces} ${t("batches.pieces")}`,
    };
  });
}

function mapReceivesToEvents(
  receives: ReceivePieces[],
  t: (key: string) => string
): HistoryEvent[] {
  return receives.map((r) => {
    const date = r.receiveDate || r.createdAt;
    return {
      id: r.id,
      type: "receive",
      date,
      title: r.batchName,
      description: r.workshopName || "",
      meta: `${r.piecesReceived} ${t("receivePieces.pieces")}`,
    };
  });
}

function mapNotificationsToEvents(
  items: InAppNotification[],
  t: (key: string) => string,
): HistoryEvent[] {
  return items.map((n) => ({
    id: n.id,
    type: "notification" as const,
    date: n.createdAt,
    title: n.title,
    description: n.body,
    meta: n.read ? "" : t("generalHistory.unreadHint"),
  }));
}

function getEventColor(type: HistoryEventType) {
  switch (type) {
    case "payment":
      return "#6366F1";
    case "batch":
      return "#10B981";
    case "receive":
      return "#F59E0B";
    case "notification":
      return "#8B5CF6";
  }
}

function getEventBgColor(type: HistoryEventType) {
  switch (type) {
    case "payment":
      return "#EEF2FF";
    case "batch":
      return "#D1FAE5";
    case "receive":
      return "#FEF3C7";
    case "notification":
      return "#EDE9FE";
  }
}

function getEventIcon(type: HistoryEventType): any {
  switch (type) {
    case "payment":
      return "payment";
    case "batch":
      return "inventory";
    case "receive":
      return "inbox";
    case "notification":
      return "notifications";
  }
}

function getEventTypeLabel(type: HistoryEventType, t: (key: string) => string) {
  switch (type) {
    case "payment":
      return t("generalHistory.typePayment");
    case "batch":
      return t("generalHistory.typeBatch");
    case "receive":
      return t("generalHistory.typeReceive");
    case "notification":
      return t("generalHistory.typeNotification");
  }
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
    color: "#111827",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  filterBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  periodBar: {
    marginTop: 0,
    borderTopWidth: 0,
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
    paddingBottom: 32,
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
  eventRow: {
    flexDirection: "row",
    marginBottom: 18,
  },
  timelineColumn: {
    width: 26,
    alignItems: "center",
  },
  timelineDotWrapper: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginTop: 4,
  },
  eventCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginLeft: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  eventHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  eventHeaderText: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  eventType: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  eventDate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  eventDescription: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 6,
  },
  eventMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
});

