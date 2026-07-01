import React from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, radii } from "../../design/tokens";

export type PillButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "dangerSolid" | "neutral";
  style?: ViewStyle;
};

// Full-width pill action. `primary` is the one place the action-blue fills the canvas;
// `danger` is a quiet coffee-cherry ghost for destructive edits; `dangerSolid` is the
// loud cherry fill used to confirm a destructive action; `neutral` is a quiet outline
// (e.g. a Cancel in a dialog).
export function PillButton({ label, onPress, variant = "primary", style }: PillButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles_.base,
        FILL[variant],
        pressed && styles_.pressed,
        style,
      ]}
    >
      <AppText variant="labelMd" style={TEXT[variant]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles_ = StyleSheet.create({
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
  dangerSolid: {
    backgroundColor: colors.tertiary,
    shadowColor: colors.tertiary,
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  neutral: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  primaryText: { color: colors.onPrimary },
  dangerText: { color: colors.tertiary },
  dangerSolidText: { color: colors.onPrimary },
  neutralText: { color: colors.onSurfaceVariant },
});

const FILL = {
  primary: styles_.primary,
  danger: styles_.danger,
  dangerSolid: styles_.dangerSolid,
  neutral: styles_.neutral,
} as const;
const TEXT = {
  primary: styles_.primaryText,
  danger: styles_.dangerText,
  dangerSolid: styles_.dangerSolidText,
  neutral: styles_.neutralText,
} as const;
