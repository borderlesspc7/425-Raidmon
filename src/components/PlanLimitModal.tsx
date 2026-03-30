import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { usePlanGuard } from "../hooks/usePlanGuard";

type PlanLimitModalProps = {
  visible: boolean;
  onClose: () => void;
  featureType: "workshop" | "batch";
  currentCount: number;
  limit: number;
  currentPlan: string | undefined;
};

export default function PlanLimitModal({
  visible,
  onClose,
  featureType,
  currentCount,
  limit,
  currentPlan,
}: PlanLimitModalProps) {
  const { navigateToPlans } = usePlanGuard();
  void currentPlan;

  const safeCount = Math.max(0, currentCount || 0);
  const safeLimit = Math.max(0, limit || 0);

  const progress =
    Number.isFinite(safeLimit) && safeLimit > 0
      ? Math.min(safeCount / safeLimit, 1)
      : 1;

  const subtitle =
    featureType === "workshop"
      ? `Você atingiu o limite de ${safeLimit} oficinas do plano Basic.`
      : `Você atingiu o limite de ${safeLimit} lotes por mês do plano Basic.`;

  const handleGoToPlans = () => {
    navigateToPlans();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.lockCircle}>
            <MaterialIcons name="lock" size={48} color="#EF4444" />
          </View>

          <Text style={styles.title}>Limite atingido</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <Text style={styles.description}>
            Faça upgrade do seu plano para continuar adicionando sem limites.
          </Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.progressText}>
            {safeCount} de {safeLimit} utilizados
          </Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Agora não</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleGoToPlans}>
              <Text style={styles.primaryButtonText}>Ver planos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  lockCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#FEE2E2",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  progressTrack: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 999,
  },
  progressText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
