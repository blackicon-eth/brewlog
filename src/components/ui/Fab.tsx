import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii, shadows, spacing } from "../../design/tokens";

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
      <View style={styles.plusWrap}>
        <Text style={styles.plus}>+</Text>
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
  plusWrap: { width: 20, alignItems: "center", justifyContent: "center" },
  plus: { color: colors.onPrimary, fontSize: 24, lineHeight: 26, fontFamily: fonts.sansMedium },
  label: { color: colors.onPrimary },
});
