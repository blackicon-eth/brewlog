import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "../../design/tokens";

export type ChevronProps = {
  direction?: "left" | "right" | "up" | "down";
  size?: number; // arm length in px
  thickness?: number; // stroke width in px
  color?: string;
  style?: ViewStyle;
};

// Hand-drawn chevron — two rounded strokes meeting at a softened tip. Replaces the
// pointy/stretched unicode arrows (←, →, ›) with one soft, consistent glyph, and gives
// a fixed layout box that aligns cleanly against neighbours (no font-baseline drift).
const ROTATION: Record<NonNullable<ChevronProps["direction"]>, string> = {
  right: "45deg",
  down: "135deg",
  left: "225deg",
  up: "315deg",
};

export function Chevron({
  direction = "right",
  size = 10,
  thickness = 2,
  color = colors.onSurface,
  style,
}: ChevronProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderTopWidth: thickness,
          borderRightWidth: thickness,
          borderColor: color,
          borderTopRightRadius: thickness, // soften the tip
          transform: [{ rotate: ROTATION[direction] }],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: "transparent" },
});
