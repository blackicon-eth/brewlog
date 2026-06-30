import React from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radii } from "../../design/tokens";

export type PillButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger";
  style?: ViewStyle;
};

// Full-width pill action. `primary` is the one place the action-blue fills the canvas;
// `danger` is a quiet coffee-cherry ghost for destructive edits.
export function PillButton({ label, onPress, variant = "primary", style }: PillButtonProps) {
  const danger = variant === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        danger ? styles.danger : styles.primary,
        pressed && styles.pressed,
        style,
      ]}
    >
      <AppText variant="labelMd" style={danger ? styles.dangerText : styles.primaryText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: radii.full,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  primaryText: { color: colors.onPrimary },
  dangerText: { color: colors.tertiary },
});
