import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, shadows, spacing } from "../../design/tokens";

export type FabProps = {
  label: string;
  onPress: () => void;
  // Icon-only circular variant (a bare "+"). The pill keeps its label; `round` drops
  // the text to a single blue disc — the label still names the button for screen readers.
  round?: boolean;
};

// Primary action, anchored bottom-right within thumb reach. The "+" is the one place the
// action blue takes over the warm canvas — as a labeled pill, or a bare circular disc.
export function Fab({ label, onPress, round = false }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [round ? styles.fabRound : styles.fab, pressed && styles.pressed]}
    >
      {/* Hand-drawn "+" from two bars — pixel-centred regardless of font metrics. */}
      <View style={round ? styles.plusWrapRound : styles.plusWrap}>
        <View style={[styles.plusH, round && styles.plusHRound]} />
        <View style={[styles.plusV, round && styles.plusVRound]} />
      </View>
      {round ? null : <AppText variant="labelMd" style={styles.label}>{label}</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.container,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingLeft: 16,
    paddingRight: 22,
    paddingVertical: 15,
    ...shadows.fab,
  },
  fabRound: {
    position: "absolute",
    right: spacing.container,
    bottom: 28,
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    ...shadows.fab,
  },
  pressed: { opacity: 0.94, transform: [{ translateY: 1 }] },
  plusWrap: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  plusWrapRound: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  plusH: { position: "absolute", width: 14, height: 2, borderRadius: 1, backgroundColor: colors.onPrimary },
  plusV: { position: "absolute", width: 2, height: 14, borderRadius: 1, backgroundColor: colors.onPrimary },
  // Thicker, longer bars so the "+" holds its own inside the larger disc.
  plusHRound: { width: 20, height: 2.5, borderRadius: 1.5 },
  plusVRound: { width: 2.5, height: 20, borderRadius: 1.5 },
  label: { color: colors.onPrimary },
});
