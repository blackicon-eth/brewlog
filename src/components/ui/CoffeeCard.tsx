import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip, RATING_CHIP_HEIGHT } from "./RatingChip";
import { useI18n } from "../../i18n/LocaleProvider";
import { colors, radii, spacing } from "../../design/tokens";

export type CoffeeCardProps = {
  roaster: string;
  name: string;
  brewCount: number;
  avg: number | null;
  /** Position-0 photo for this coffee, if any. Null/absent renders a quiet placeholder tile
   *  (same footprint) so the shelf doesn't jump between photographed and un-photographed bags. */
  photoUri?: string | null;
  onPress: () => void;
};

// Fixed square footprint for the cover thumbnail/placeholder — small enough to sit beside
// a single line of kicker + name without inflating the card's height.
const COVER_SIZE = 48;

// Hand-drawn camera — a rounded body with a viewfinder bump and a lens circle, in the same
// zero-dependency, View-based style as the app's other glyphs (TrashIcon/ArchiveIcon).
function CameraGlyph({ color = colors.outline }: { color?: string }) {
  const stroke = 1.5;
  return (
    <View style={{ width: 26, height: 20 }}>
      <View style={{ position: "absolute", top: 0, left: 6, width: 9, height: 5, borderWidth: stroke, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
      <View style={{ position: "absolute", bottom: 0, width: 26, height: 16, borderWidth: stroke, borderColor: color, borderRadius: 4 }} />
      <View style={{ position: "absolute", bottom: 3, left: 8, width: 10, height: 10, borderRadius: 5, borderWidth: stroke, borderColor: color }} />
    </View>
  );
}

// The bag's cover photo (or a quiet placeholder) as a small rounded square. When there's no
// photo yet, a muted camera glyph stands in — same footprint, so the shelf doesn't jump
// between photographed and un-photographed bags.
function CoverThumb({ photoUri }: { photoUri?: string | null }) {
  return (
    <View style={styles.cover}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <CameraGlyph />
        </View>
      )}
    </View>
  );
}

// List item: a cover thumbnail beside roaster (quiet uppercase kicker) + coffee name (serif
// hero), then a hairline divider and the "science" row — brew count + a cherry rating chip.
//
// Bounded by a hairline border rather than an elevation shadow: the shelf list fades in
// when the Active/Archived filter flips, and animating opacity over Android elevation
// makes the shadow flicker (the Fabric gotcha). A ruled border restyles cleanly and reads
// right at home in the ledger aesthetic — the cover tile follows the same rule (border,
// no shadow), so it can't reintroduce the flicker either.
export function CoffeeCard({ roaster, name, brewCount, avg, photoUri, onPress }: CoffeeCardProps) {
  const { t, tn } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <CoverThumb photoUri={photoUri} />
        <View style={styles.textCol}>
          <AppText variant="labelSm">{roaster}</AppText>
          <AppText variant="headlineMd" style={styles.name} numberOfLines={2}>{name}</AppText>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.meta}>
        <AppText variant="labelMd">
          {tn("common.brewCount", brewCount)}
        </AppText>
        {avg != null ? (
          <RatingChip value={avg} />
        ) : (
          <AppText variant="labelMd" style={styles.unrated}>{t("common.unrated")}</AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.gutter },
  textCol: { flex: 1, minWidth: 0 },
  // Extra line height so EB Garamond's descenders (g/y tails) aren't clipped.
  name: { marginTop: 5, lineHeight: 34 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginVertical: 10 },
  // Reserve the rating chip's height even when the card shows plain "Unrated"/"0 brews"
  // text, so rated and unrated cards measure identically on the shelf.
  meta: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: RATING_CHIP_HEIGHT.md,
  },
  unrated: { color: colors.outline },

  // Cover tile — fixed square, hairline border, no elevation (Fabric flicker rule above).
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radii.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
    overflow: "hidden",
    backgroundColor: colors.surfaceLow,
  },
  coverImage: { width: "100%", height: "100%" },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
});
