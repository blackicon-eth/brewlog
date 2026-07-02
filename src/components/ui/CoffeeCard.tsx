import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "./Card";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { colors } from "../../design/tokens";

export type CoffeeCardProps = {
  roaster: string;
  name: string;
  brewCount: number;
  avg: number | null;
  onPress: () => void;
};

// List item: roaster as a quiet uppercase kicker, the coffee name as the serif hero,
// then a hairline divider and the "science" row — brew count + a cherry rating chip.
export function CoffeeCard({ roaster, name, brewCount, avg, onPress }: CoffeeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null)}
    >
      <Card>
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
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Extra line height so EB Garamond's descenders (g/y tails) aren't clipped.
  name: { marginTop: 5, lineHeight: 34 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant, marginVertical: 14 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unrated: { color: colors.outline },
});
