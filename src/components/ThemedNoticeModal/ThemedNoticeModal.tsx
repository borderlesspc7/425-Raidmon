import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  variant?: "success" | "info";
  /** Rótulo do botão principal (padrão: OK) */
  actionLabel?: string;
  /** Texto auxiliar abaixo da mensagem */
  hint?: string;
  /** Segundo botão (ex.: “Ver planos”) */
  secondaryActionLabel?: string;
  onSecondaryPress?: () => void;
};

export default function ThemedNoticeModal({
  visible,
  title,
  message,
  onDismiss,
  variant = "success",
  actionLabel = "OK",
  hint,
  secondaryActionLabel,
  onSecondaryPress,
}: Props) {
  const { theme } = useTheme();
  const iconName = variant === "success" ? "check-circle" : "info";
  const iconTint = variant === "success" ? "#22C55E" : theme.colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconRing,
              { backgroundColor: theme.colors.iconSoft },
            ]}
          >
            <MaterialIcons name={iconName} size={36} color={iconTint} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.message,
              { color: theme.colors.textMuted, marginBottom: hint ? 8 : 22 },
            ]}
          >
            {message}
          </Text>
          {hint ? (
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
              {hint}
            </Text>
          ) : null}
          <View
            style={[
              styles.actionsRow,
              secondaryActionLabel && onSecondaryPress ? styles.actionsRowSplit : null,
            ]}
          >
            {secondaryActionLabel && onSecondaryPress ? (
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSoft },
                ]}
                onPress={onSecondaryPress}
                activeOpacity={0.85}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                  {secondaryActionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.ok,
                { backgroundColor: theme.colors.primary },
                secondaryActionLabel && onSecondaryPress ? styles.okFlex : null,
              ]}
              onPress={onDismiss}
              activeOpacity={0.85}
            >
              <Text style={styles.okText}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 22,
  },
  actionsRow: {
    alignSelf: "stretch",
    gap: 10,
  },
  actionsRowSplit: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  ok: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  okFlex: {
    flex: 1,
  },
  okText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
