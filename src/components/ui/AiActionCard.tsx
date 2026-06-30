import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii, shadows } from "../../design/tokens";

export type AiActionCardProps = {
  title: string;
  subtitle: string;
  enabled: boolean;
  onPress: () => void;
};

// Featured-but-secondary AI entry point: a white card with a blue left accent + sparkle.
// Distinct from the solid-blue FAB (the one true primary action). Dims when disabled.
export function AiActionCard({ title, subtitle, enabled, onPress }: AiActionCardProps) {
  const tint = enabled ? colors.primary : colors.outline;
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: enabled ? "rgba(0,74,198,0.22)" : colors.outlineVariant },
        !enabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: tint }]} />
      <View style={[styles.badge, { backgroundColor: enabled ? "rgba(0,74,198,0.10)" : colors.surfaceContainer }]}>
        <Text style={[styles.spark, { color: tint }]}>✦</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: enabled ? colors.onSurface : colors.onSurfaceVariant }]}>{title}</Text>
        <AppText variant="bodyMd" style={styles.subtitle}>{subtitle}</AppText>
      </View>
      {enabled ? <Text style={styles.chevron}>→</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.base,
    borderWidth: 1,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 16,
    overflow: "hidden",
    ...shadows.card,
  },
  pressed: { opacity: 0.92 },
  disabled: { ...({ shadowOpacity: 0, elevation: 0 } as const), backgroundColor: colors.surfaceLow },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  badge: { width: 38, height: 38, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  spark: { fontSize: 17 },
  body: { flex: 1 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16 },
  subtitle: { marginTop: 2 },
  chevron: { color: colors.primary, fontSize: 18, fontFamily: fonts.sansSemiBold },
});
