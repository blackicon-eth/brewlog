import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, radii, shadows, spacing } from "../../design/tokens";

export type FabProps = {
  label: string;
  onPress: () => void;
};

// Pill-shaped primary action, anchored bottom-right within thumb reach. The "+" is the
// one place the action blue takes over the warm canvas.
export function Fab({ label, onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      {/* Hand-drawn "+" from two bars — pixel-centred against the label regardless of font metrics. */}
      <View style={styles.plusWrap}>
        <View style={styles.plusH} />
        <View style={styles.plusV} />
      </View>
      <AppText variant="labelMd" style={styles.label}>{label}</AppText>
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
  pressed: { opacity: 0.94, transform: [{ translateY: 1 }] },
  plusWrap: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  plusH: { position: "absolute", width: 14, height: 2, borderRadius: 1, backgroundColor: colors.onPrimary },
  plusV: { position: "absolute", width: 2, height: 14, borderRadius: 1, backgroundColor: colors.onPrimary },
  label: { color: colors.onPrimary },
});
