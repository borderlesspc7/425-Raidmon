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
import {
  getWorkshopsByUser,
  updateWorkshopStatus,
} from "../../services/workshopService";
import { getBatchesByUser } from "../../services/batchService";
import type { Batch } from "../../types/batch";
import { Workshop, WorkshopStatus as WorkshopStatusType } from "../../types/workshop";

export default function WorkshopStatus() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<WorkshopStatusType | "all">("all");

  // Statistics
  const [totalWorkshops, setTotalWorkshops] = useState(0);
  const [freeWorkshops, setFreeWorkshops] = useState(0);
  const [busyWorkshops, setBusyWorkshops] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [startedInviteBatches, setStartedInviteBatches] = useState<Batch[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadWorkshops();
    }
  }, [user]);

  const loadWorkshops = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [data, ownerBatches] = await Promise.all([
        getWorkshopsByUser(user.id),
        getBatchesByUser(user.id),
      ]);
      
      setWorkshops(data);
      
      // Calcular estatísticas
      setTotalWorkshops(data.length);
      setFreeWorkshops(data.filter((w) => w.status === "free").length);
      setBusyWorkshops(data.filter((w) => w.status === "busy").length);
      setTotalPieces(data.reduce((sum, w) => sum + w.totalPieces, 0));
      setStartedInviteBatches(
        ownerBatches.filter(
          (b) =>
            b.acceptedFromOwnerInvite &&
            b.status === "in_progress" &&
            !!b.linkedWorkshopUserId,
        ),
      );
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || "Erro ao carregar oficinas",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (workshop: Workshop, newStatus: WorkshopStatusType) => {
    try {
      await updateWorkshopStatus(workshop.id, newStatus);
      await loadWorkshops();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message || "Erro ao atualizar status");
    }
  };

  const getStatusColor = (status: WorkshopStatusType) => {
    switch (status) {
      case "free":
        return "#22C55E";
      case "busy":
        return "#F97316";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: WorkshopStatusType) => {
    return t(`workshops.status.${status}`);
  };

  const formatPhone = (phone: string) => {
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const filteredWorkshops =
    selectedStatus === "all"
      ? workshops
      : workshops.filter((w) => w.status === selectedStatus);

  const statusGroups: { status: WorkshopStatusType; workshops: Workshop[] }[] = [
    { status: "free", workshops: workshops.filter((w) => w.status === "free") },
    { status: "busy", workshops: workshops.filter((w) => w.status === "busy") },
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
            <Text style={styles.title}>{t("workshopStatus.title")}</Text>
            <Text style={styles.subtitle}>
              {totalWorkshops} {t("workshopStatus.registered")} • {totalPieces}{" "}
              {t("workshopStatus.totalPieces")}
            </Text>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#F0F4FF" }]}>
              <MaterialIcons name="business" size={24} color="#6366F1" />
            </View>
            <Text style={styles.statValue}>{totalWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshopStatus.total")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#DCFCE7" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#22C55E" }]} />
            </View>
            <Text style={styles.statValue}>{freeWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshops.status.free")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FFEDD5" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#F97316" }]} />
            </View>
            <Text style={styles.statValue}>{busyWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshops.status.busy")}</Text>
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedStatus === "all" && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus("all")}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStatus === "all" && styles.filterButtonTextActive,
                ]}
              >
                {t("workshopStatus.all")}
              </Text>
            </TouchableOpacity>
            {(["free", "busy"] as WorkshopStatusType[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  selectedStatus === status && styles.filterButtonActive,
                  {
                    borderColor: getStatusColor(status),
                    backgroundColor:
                      selectedStatus === status
                        ? `${getStatusColor(status)}20`
                        : "#FFFFFF",
                  },
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <View
                  style={[
                    styles.filterDot,
                    { backgroundColor: getStatusColor(status) },
                  ]}
                />
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedStatus === status && styles.filterButtonTextActive,
                    selectedStatus === status && {
                      color: getStatusColor(status),
                    },
                  ]}
                >
                  {getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Workshops List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {startedInviteBatches.length > 0 ? (
            <View style={styles.startedSection}>
              <Text style={styles.startedSectionTitle}>
                {t("workshopStatus.startedByInviteTitle")}
              </Text>
              {startedInviteBatches.map((batch) => (
                <View key={`started-${batch.id}`} style={styles.startedCard}>
                  <View style={styles.startedCardHeader}>
                    <View style={styles.startedGreenDot} />
                    <Text style={styles.startedCardTitle}>
                      {batch.workshopName || t("workshopStatus.unknownWorkshop")}
                    </Text>
                  </View>
                  <Text style={styles.startedCardText}>
                    {t("workshopStatus.startedBatchLabel")} {batch.name}
                  </Text>
                  <Text style={styles.startedCardText}>
                    {t("workshopStatus.startedStatusLabel")} {t("workshopStatus.startedGreenStatus")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {filteredWorkshops.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="business" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {selectedStatus === "all"
                  ? t("workshopStatus.empty")
                  : t("workshopStatus.emptyFiltered")}
              </Text>
            </View>
          ) : (
            <>
              {/* Grouped by Status */}
              {selectedStatus === "all" ? (
                statusGroups
                  .filter((group) => group.workshops.length > 0)
                  .map((group) => (
                    <View key={group.status} style={styles.statusGroup}>
                      <View style={styles.statusGroupHeader}>
                        <View
                          style={[
                            styles.statusGroupDot,
                            { backgroundColor: getStatusColor(group.status) },
                          ]}
                        />
                        <Text style={styles.statusGroupTitle}>
                          {getStatusLabel(group.status)} ({group.workshops.length})
                        </Text>
                      </View>
                      {group.workshops.map((workshop) => (
                        <WorkshopCard
                          key={workshop.id}
                          workshop={workshop}
                          onStatusChange={handleStatusChange}
                          getStatusColor={getStatusColor}
                          getStatusLabel={getStatusLabel}
                          formatPhone={formatPhone}
                          t={t}
                        />
                      ))}
                    </View>
                  ))
              ) : (
                filteredWorkshops.map((workshop) => (
                  <WorkshopCard
                    key={workshop.id}
                    workshop={workshop}
                    onStatusChange={handleStatusChange}
                    getStatusColor={getStatusColor}
                    getStatusLabel={getStatusLabel}
                    formatPhone={formatPhone}
                    t={t}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Layout>
  );
}

interface WorkshopCardProps {
  workshop: Workshop;
  onStatusChange: (workshop: Workshop, status: WorkshopStatusType) => void;
  getStatusColor: (status: WorkshopStatusType) => string;
  getStatusLabel: (status: WorkshopStatusType) => string;
  formatPhone: (phone: string) => string;
  t: (key: string) => string;
}

function WorkshopCard({
  workshop,
  onStatusChange,
  getStatusColor,
  getStatusLabel,
  formatPhone,
  t,
}: WorkshopCardProps) {
  return (
    <View style={styles.workshopCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(workshop.status) },
            ]}
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.workshopName} numberOfLines={1}>
              {workshop.name}
            </Text>
            <Text style={styles.workshopStatus}>
              {getStatusLabel(workshop.status)}
            </Text>
          </View>
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
            {workshop.totalPieces} {t("workshops.pieces")}
          </Text>
        </View>
        <View style={styles.statusButtons}>
          {(["free", "busy"] as WorkshopStatusType[]).map(
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
                onPress={() => onStatusChange(workshop, statusOption)}
              >
                <View />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </View>
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
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: "18%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDotSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterContent: {
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    gap: 6,
    marginRight: 8,
  },
  filterButtonActive: {
    borderWidth: 2,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
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
  statusGroup: {
    marginBottom: 24,
  },
  statusGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  statusGroupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusGroupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  workshopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  workshopName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  workshopStatus: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  cardInfo: {
    gap: 8,
    marginBottom: 12,
    paddingLeft: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  piecesInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  piecesText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
  },
  statusButtons: {
    flexDirection: "row",
    gap: 6,
  },
  statusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  startedSection: {
    marginBottom: 16,
    gap: 10,
  },
  startedSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  startedCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  startedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  startedGreenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
  },
  startedCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#065F46",
  },
  startedCardText: {
    fontSize: 13,
    color: "#064E3B",
  },
});
