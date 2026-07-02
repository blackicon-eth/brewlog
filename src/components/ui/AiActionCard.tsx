import React from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { AppText } from "./AppText";
import { Chevron } from "./Chevron";
import { colors, fonts, radii, shadows } from "../../design/tokens";

export type AiActionCardProps = {
  title: string;
  subtitle: string;
  enabled: boolean;
  onPress: () => void;
  image?: ImageSourcePropType; // optional bean thumbnail — anchors a compact hero row
};

// Featured-but-secondary AI entry point: a white card with a blue left accent + sparkle.
// Distinct from the solid-blue FAB (the one true primary action). Dims when disabled.
// With `image`, the sparkle badge is swapped for a bean thumbnail (the ✦ moves onto its
// corner) so the coffee photo and this CTA read as one compact block.
export function AiActionCard({ title, subtitle, enabled, onPress, image }: AiActionCardProps) {
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

      {image ? (
        <View style={styles.thumbWrap}>
          <Image source={image} style={[styles.thumb, !enabled && styles.thumbDim]} resizeMode="cover" />
          <View style={[styles.thumbBadge, { backgroundColor: tint }]}>
            <Text style={styles.thumbSpark}>✦</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: enabled ? "rgba(0,74,198,0.10)" : colors.surfaceContainer }]}>
          <Text style={[styles.spark, { color: tint }]}>✦</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.title, { color: enabled ? colors.onSurface : colors.onSurfaceVariant }]}>{title}</Text>
        <AppText variant="bodyMd" style={styles.subtitle}>{subtitle}</AppText>
      </View>
      {enabled ? <Chevron direction="right" size={9} thickness={2.5} color={colors.primary} style={styles.chevron} /> : null}
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
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    overflow: "hidden",
    ...shadows.card,
  },
  pressed: { opacity: 0.92 },
  disabled: { ...({ shadowOpacity: 0, elevation: 0 } as const), backgroundColor: colors.surfaceLow },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  badge: { width: 38, height: 38, borderRadius: radii.full, alignItems: "center", justifyContent: "center" },
  spark: { fontSize: 17 },
  thumbWrap: { width: 60, height: 60 },
  thumb: { width: 60, height: 60, borderRadius: radii.base },
  thumbDim: { opacity: 0.5 },
  thumbBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.surfaceLowest,
  },
  thumbSpark: {
    color: colors.onPrimary,
    fontSize: 10,
    fontFamily: fonts.sansBold,
    lineHeight: 10,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    // The ✦ glyph has asymmetric bearings — nudge it right/up to optically center.
    transform: [{ translateX: 0.2 }, { translateY: -0.5 }],
  },
  body: { flex: 1 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16 },
  subtitle: { marginTop: 2 },
  chevron: { marginRight: 2 },
});
