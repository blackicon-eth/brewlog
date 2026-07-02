import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { colors, fonts, radii } from "../../design/tokens";

export type RatingChipProps = ViewProps & {
  /** Average (e.g. 4.2) or a single rating (e.g. 4). Integers render without a decimal. */
  value: number;
  /** Visual size — `md` is the default row/card chip; `lg` is a prominent hero chip. */
  size?: "md" | "lg";
};

// Coffee-cherry-red pill used for ratings across the app.
export function RatingChip({ value, size = "md", style, ...props }: RatingChipProps) {
  const label = value % 1 === 0 ? String(value) : value.toFixed(1);
  const s = SIZES[size];
  return (
    <View {...props} style={[styles.chip, s.chip, style]}>
      <Text style={[styles.star, s.star]}>★</Text>
      <Text style={[styles.text, s.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.full,
  },
  star: { color: colors.tertiary, marginTop: -1 },
  text: { color: colors.tertiary, fontFamily: fonts.sansBold },
});

const SIZES = {
  md: StyleSheet.create({
    chip: { gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
    star: { fontSize: 11 },
    text: { fontSize: 13 },
  }),
  lg: StyleSheet.create({
    chip: { gap: 5, paddingHorizontal: 13, paddingVertical: 6 },
    star: { fontSize: 14 },
    text: { fontSize: 16 },
  }),
} as const;
