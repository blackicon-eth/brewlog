import React from "react";
import { View } from "react-native";
import { colors } from "../../design/tokens";

export type TrashIconProps = {
  size?: number;
  color?: string;
  thickness?: number;
};

// Hand-drawn trash bin (lid + handle + ribbed can) — a zero-dep destructive glyph, same
// View-based approach as Chevron/ClockIcon. Everything is positioned from the size box so
// it scales cleanly. The can is an outlined rounded rect; two ribs sell the "bin" read.
export function TrashIcon({ size = 18, color = colors.tertiary, thickness = 1.6 }: TrashIconProps) {
  const lidW = size * 0.74;
  const handleW = size * 0.32;
  const bodyW = size * 0.6;
  const bodyH = size * 0.56;
  const bodyTop = size * 0.32;
  const ribH = bodyH * 0.52;
  const bar = { position: "absolute" as const, backgroundColor: color, borderRadius: thickness };
  const rib = {
    position: "absolute" as const,
    width: thickness,
    height: ribH,
    backgroundColor: color,
    borderRadius: thickness,
    top: bodyTop + (bodyH - ribH) / 2,
  };
  return (
    <View style={{ width: size, height: size }}>
      {/* handle */}
      <View style={[bar, { width: handleW, height: thickness, top: size * 0.13, left: (size - handleW) / 2 }]} />
      {/* lid */}
      <View style={[bar, { width: lidW, height: thickness, top: size * 0.26, left: (size - lidW) / 2 }]} />
      {/* can body — outlined */}
      <View
        style={{
          position: "absolute",
          top: bodyTop,
          left: (size - bodyW) / 2,
          width: bodyW,
          height: bodyH,
          borderWidth: thickness,
          borderColor: color,
          borderRadius: 2.5,
        }}
      />
      {/* two ribs */}
      <View style={[rib, { left: size / 2 - thickness * 2 }]} />
      <View style={[rib, { left: size / 2 + thickness }]} />
    </View>
  );
}
