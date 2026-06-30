import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { colors, fonts, radii } from "../../design/tokens";

export type RatingChipProps = ViewProps & {
  /** Average (e.g. 4.2) or a single rating (e.g. 4). Integers render without a decimal. */
  value: number;
};

// Coffee-cherry-red pill used for ratings across the app.
export function RatingChip({ value, style, ...props }: RatingChipProps) {
  const label = value % 1 === 0 ? String(value) : value.toFixed(1);
  return (
    <View {...props} style={[styles.chip, style]}>
      <Text style={styles.star}>★</Text>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  star: { color: colors.tertiary, fontSize: 11, marginTop: -1 },
  text: { color: colors.tertiary, fontSize: 13, fontFamily: fonts.sansBold },
});
