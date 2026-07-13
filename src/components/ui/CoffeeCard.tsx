import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { colors, radii } from "../../design/tokens";

export type CoffeeCardProps = {
  roaster: string;
  name: string;
  brewCount: number;
  avg: number | null;
  onPress: () => void;
};

// List item: roaster as a quiet uppercase kicker, the coffee name as the serif hero,
// then a hairline divider and the "science" row — brew count + a cherry rating chip.
//
// Bounded by a hairline border rather than an elevation shadow: the shelf list fades in
// when the Active/Archived filter flips, and animating opacity over Android elevation
// makes the shadow flicker (the Fabric gotcha). A ruled border restyles cleanly and reads
// right at home in the ledger aesthetic.
export function CoffeeCard({ roaster, name, brewCount, avg, onPress }: CoffeeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <AppText variant="labelSm">{roaster}</AppText>
      <AppText variant="headlineMd" style={styles.name}>{name}</AppText>
      <View style={styles.divider} />
      <View style={styles.meta}>
        <AppText variant="labelMd">
          {brewCount} brew{brewCount === 1 ? "" : "s"}
        </AppText>
        {avg != null ? (
          <RatingChip value={avg} />
        ) : (
          <AppText variant="labelMd" style={styles.unrated}>Unrated</AppText>
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
  // Extra line height so EB Garamond's descenders (g/y tails) aren't clipped.
  name: { marginTop: 5, lineHeight: 34 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginVertical: 14 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unrated: { color: colors.outline },
});
