import React from "react";
import { View } from "react-native";
import { colors } from "../../design/tokens";

export type ArchiveIconProps = {
  size?: number;
  color?: string;
  thickness?: number;
};

// Hand-drawn archive box (overhanging lid + body + pull slot) — a zero-dep glyph in the
// same View-based style as Trash/Clock. Defaults to a muted grey, since everything about
// archiving reads quiet and reversible rather than destructive.
export function ArchiveIcon({ size = 16, color = colors.onSurfaceVariant, thickness = 1.6 }: ArchiveIconProps) {
  const lidW = size * 0.9;
  const lidH = size * 0.24;
  const lidTop = size * 0.14;
  const bodyW = size * 0.76;
  const bodyTop = lidTop + lidH + size * 0.04;
  const bodyH = size * 0.5;
  const slotW = size * 0.28;
  const outlined = (w: number, h: number, top: number) => ({
    position: "absolute" as const,
    width: w,
    height: h,
    top,
    left: (size - w) / 2,
    borderWidth: thickness,
    borderColor: color,
    borderRadius: 2,
  });
  return (
    <View style={{ width: size, height: size }}>
      {/* lid — a touch wider than the body so it overhangs */}
      <View style={outlined(lidW, lidH, lidTop)} />
      {/* body */}
      <View style={outlined(bodyW, bodyH, bodyTop)} />
      {/* pull slot */}
      <View
        style={{
          position: "absolute",
          width: slotW,
          height: thickness,
          top: bodyTop + bodyH / 2 - thickness / 2,
          left: (size - slotW) / 2,
          backgroundColor: color,
          borderRadius: thickness,
        }}
      />
    </View>
  );
}
