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
import { Workshop, WorkshopStatus as WorkshopStatusType } from "../../types/workshop";

export default function WorkshopStatus() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<WorkshopStatusType | "all">("all");

  // Statistics
  const [totalWorkshops, setTotalWorkshops] = useState(0);
  const [greenWorkshops, setGreenWorkshops] = useState(0);
  const [yellowWorkshops, setYellowWorkshops] = useState(0);
  const [orangeWorkshops, setOrangeWorkshops] = useState(0);
  const [redWorkshops, setRedWorkshops] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadWorkshops();
    }
  }, [user]);

  const loadWorkshops = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getWorkshopsByUser(user.id);
      
      setWorkshops(data);
      
      // Calcular estatísticas
      setTotalWorkshops(data.length);
      setGreenWorkshops(data.filter((w) => w.status === "green").length);
      setYellowWorkshops(data.filter((w) => w.status === "yellow").length);
      setOrangeWorkshops(data.filter((w) => w.status === "orange").length);
      setRedWorkshops(data.filter((w) => w.status === "red").length);
      setTotalPieces(data.reduce((sum, w) => sum + w.totalPieces, 0));
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
      case "green":
        return "#10B981";
      case "yellow":
        return "#F59E0B";
      case "orange":
        return "#F97316";
      case "red":
        return "#EF4444";
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
    { status: "green", workshops: workshops.filter((w) => w.status === "green") },
    { status: "yellow", workshops: workshops.filter((w) => w.status === "yellow") },
    { status: "orange", workshops: workshops.filter((w) => w.status === "orange") },
    { status: "red", workshops: workshops.filter((w) => w.status === "red") },
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
            <View style={[styles.statIconContainer, { backgroundColor: "#D1FAE5" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#10B981" }]} />
            </View>
            <Text style={styles.statValue}>{greenWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshopStatus.green")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FEF3C7" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#F59E0B" }]} />
            </View>
            <Text style={styles.statValue}>{yellowWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshopStatus.yellow")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FED7AA" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#F97316" }]} />
            </View>
            <Text style={styles.statValue}>{orangeWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshopStatus.orange")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FEE2E2" }]}>
              <View style={[styles.statusDotSmall, { backgroundColor: "#EF4444" }]} />
            </View>
            <Text style={styles.statValue}>{redWorkshops}</Text>
            <Text style={styles.statLabel}>{t("workshopStatus.red")}</Text>
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
            {(["green", "yellow", "orange", "red"] as WorkshopStatusType[]).map((status) => (
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
          {(["green", "yellow", "orange", "red"] as WorkshopStatusType[]).map(
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
});
