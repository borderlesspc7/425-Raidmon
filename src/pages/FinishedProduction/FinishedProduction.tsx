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
  getBatchesByUser,
} from "../../services/batchService";
import { Batch } from "../../types/batch";

export default function FinishedProduction() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // Statistics
  const [totalBatches, setTotalBatches] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [thisMonthBatches, setThisMonthBatches] = useState(0);
  const [thisMonthPieces, setThisMonthPieces] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadBatches();
    }
  }, [user]);

  const loadBatches = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getBatchesByUser(user.id);
      
      // Filtrar apenas lotes concluídos
      const completedBatches = data.filter((batch) => batch.status === "completed");
      
      setBatches(completedBatches);
      
      // Calcular estatísticas
      setTotalBatches(completedBatches.length);
      setTotalPieces(completedBatches.reduce((sum, batch) => sum + batch.totalPieces, 0));
      
      // Estatísticas do mês atual
      const now = new Date();
      const thisMonthBatchesData = completedBatches.filter((batch) => {
        const batchDate = batch.updatedAt || batch.createdAt;
        return (
          batchDate.getMonth() === now.getMonth() &&
          batchDate.getFullYear() === now.getFullYear()
        );
      });
      
      setThisMonthBatches(thisMonthBatchesData.length);
      setThisMonthPieces(thisMonthBatchesData.reduce((sum, batch) => sum + batch.totalPieces, 0));
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.message || "Erro ao carregar produção finalizada",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDateOnly = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const getFilteredBatches = () => {
    if (filterMonth === "all") {
      return batches;
    }
    
    const now = new Date();
    const filtered = batches.filter((batch) => {
      const batchDate = batch.updatedAt || batch.createdAt;
      
      if (filterMonth === "thisMonth") {
        return (
          batchDate.getMonth() === now.getMonth() &&
          batchDate.getFullYear() === now.getFullYear()
        );
      }
      
      if (filterMonth === "lastMonth") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        return (
          batchDate.getMonth() === lastMonth.getMonth() &&
          batchDate.getFullYear() === lastMonth.getFullYear()
        );
      }
      
      return true;
    });
    
    return filtered;
  };

  const filteredBatches = getFilteredBatches();

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
            <Text style={styles.title}>{t("finishedProduction.title")}</Text>
            <Text style={styles.subtitle}>
              {totalBatches} {t("finishedProduction.registered")} • {totalPieces}{" "}
              {t("finishedProduction.totalPieces")}
            </Text>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#D1FAE5" }]}>
              <MaterialIcons name="check-circle" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{totalBatches}</Text>
            <Text style={styles.statLabel}>{t("finishedProduction.total")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#F0F4FF" }]}>
              <MaterialIcons name="inventory" size={24} color="#6366F1" />
            </View>
            <Text style={styles.statValue}>{totalPieces}</Text>
            <Text style={styles.statLabel}>{t("finishedProduction.totalPieces")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#FEF3C7" }]}>
              <MaterialIcons name="calendar-today" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{thisMonthBatches}</Text>
            <Text style={styles.statLabel}>{t("finishedProduction.thisMonth")}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: "#E0E7FF" }]}>
              <MaterialIcons name="inventory-2" size={24} color="#6366F1" />
            </View>
            <Text style={styles.statValue}>{thisMonthPieces}</Text>
            <Text style={styles.statLabel}>{t("finishedProduction.thisMonthPieces")}</Text>
          </View>
        </View>

        {/* Filter */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterMonth === "all" && styles.filterButtonActive,
              ]}
              onPress={() => setFilterMonth("all")}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMonth === "all" && styles.filterButtonTextActive,
                ]}
              >
                {t("finishedProduction.all")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterMonth === "thisMonth" && styles.filterButtonActive,
              ]}
              onPress={() => setFilterMonth("thisMonth")}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMonth === "thisMonth" && styles.filterButtonTextActive,
                ]}
              >
                {t("finishedProduction.thisMonthLabel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterMonth === "lastMonth" && styles.filterButtonActive,
              ]}
              onPress={() => setFilterMonth("lastMonth")}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterMonth === "lastMonth" && styles.filterButtonTextActive,
                ]}
              >
                {t("finishedProduction.lastMonth")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Batches List */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredBatches.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="check-circle" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {filterMonth === "all"
                  ? t("finishedProduction.empty")
                  : t("finishedProduction.emptyFiltered")}
              </Text>
            </View>
          ) : (
            filteredBatches.map((batch, index) => (
              <View key={batch.id} style={styles.batchCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.batchNumber}>
                      <MaterialIcons name="check-circle" size={20} color="#10B981" />
                    </View>
                    <View style={styles.cardHeaderInfo}>
                      <Text style={styles.batchName} numberOfLines={1}>
                        {batch.name}
                      </Text>
                      <Text style={styles.batchDate}>
                        {t("finishedProduction.finishedOn")}: {formatDate(batch.updatedAt || batch.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="inventory" size={18} color="#6366F1" />
                    <Text style={styles.infoLabel}>{t("finishedProduction.quantity")}:</Text>
                    <Text style={styles.infoValue}>
                      {batch.totalPieces} {t("finishedProduction.pieces")}
                    </Text>
                  </View>
                  {batch.workshopName && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="business" size={18} color="#6366F1" />
                      <Text style={styles.infoLabel}>
                        {t("finishedProduction.workshop")}:
                      </Text>
                      <Text style={styles.infoValue}>{batch.workshopName}</Text>
                    </View>
                  )}
                  {batch.deliveryDate && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="event" size={18} color="#6366F1" />
                      <Text style={styles.infoLabel}>
                        {t("finishedProduction.deliveryDate")}:
                      </Text>
                      <Text style={styles.infoValue}>
                        {formatDateOnly(batch.deliveryDate)}
                      </Text>
                    </View>
                  )}
                  {batch.observations && (
                    <View style={styles.observationsContainer}>
                      <MaterialIcons name="notes" size={18} color="#6B7280" />
                      <Text style={styles.observationsLabel}>
                        {t("finishedProduction.observations")}:
                      </Text>
                      <Text style={styles.observationsText} numberOfLines={3}>
                        {batch.observations}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Footer */}
                <View style={styles.cardFooter}>
                  <View style={styles.completedBadge}>
                    <MaterialIcons name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.completedText}>
                      {t("finishedProduction.completed")}
                    </Text>
                  </View>
                  <Text style={styles.createdDate}>
                    {t("finishedProduction.createdOn")}: {formatDateOnly(batch.createdAt)}
                  </Text>
                </View>
              </View>
            ))
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
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
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
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
  },
  filterButtonActive: {
    borderColor: "#6366F1",
    backgroundColor: "#F0F4FF",
    borderWidth: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterButtonTextActive: {
    color: "#6366F1",
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
  batchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
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
  batchNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderInfo: {
    flex: 1,
  },
  batchName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  batchDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardInfo: {
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366F1",
    flex: 1,
    textAlign: "right",
  },
  observationsContainer: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
  },
  observationsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 26,
  },
  observationsText: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 26,
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
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
  },
  completedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  createdDate: {
    fontSize: 12,
    color: "#6B7280",
  },
});
