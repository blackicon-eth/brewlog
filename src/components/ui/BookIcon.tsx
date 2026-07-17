import React from "react";
import { View } from "react-native";
import { colors } from "../../design/tokens";

export type BookIconProps = {
  size?: number;
  color?: string;
  thickness?: number;
};

// Hand-drawn closed journal (outlined cover with a solid-filled binding side + one title
// line) — a zero-dep "recipe book" glyph in the same View-based style as Clock/Archive.
// Portrait, centred in a square box so it drops cleanly into a circular button.
export function BookIcon({ size = 18, color = colors.onSurface, thickness = 1.6 }: BookIconProps) {
  const w = size * 0.72; // cover width (a touch narrower than tall)
  const h = size * 0.88; // cover height
  const left = (size - w) / 2;
  const top = (size - h) / 2;
  const spineLeft = left + w * 0.26; // binding line, inset from the left edge
  const titleTop = top + h * 0.28;
  const titleLeft = spineLeft + thickness + size * 0.1;
  const titleW = w * 0.42;
  return (
    <View style={{ width: size, height: size }}>
      {/* cover */}
      <View
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          borderWidth: thickness,
          borderColor: color,
          borderRadius: 2.5,
        }}
      />
      {/* binding — the book's side, filled solid up to the spine line */}
      <View
        style={{
          position: "absolute",
          left,
          top,
          width: spineLeft - left + thickness,
          height: h,
          backgroundColor: color,
          borderTopLeftRadius: 2.5,
          borderBottomLeftRadius: 2.5,
        }}
      />
      {/* title line on the cover */}
      <View
        style={{
          position: "absolute",
          left: titleLeft,
          top: titleTop,
          width: titleW,
          height: thickness,
          backgroundColor: color,
          borderRadius: thickness,
        }}
      />
    </View>
  );
}
