import React from "react";
import { View } from "react-native";
import { colors } from "../../design/tokens";

export type ClockIconProps = {
  size?: number;
  color?: string;
  thickness?: number;
};

// Hand-drawn clock (a bordered circle + two hands) — a zero-dep "recent/by-time" glyph,
// same View-based approach as Chevron. Hands are positioned from the face's centre.
export function ClockIcon({ size = 15, color = colors.onSurface, thickness = 1.6 }: ClockIconProps) {
  const inner = size - thickness * 2; // content box inside the border
  const center = inner / 2;
  const minuteH = inner * 0.44; // hand pointing up
  const hourW = inner * 0.32; // hand pointing right
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: color }}>
      <View
        style={{
          position: "absolute",
          backgroundColor: color,
          borderRadius: thickness,
          width: thickness,
          height: minuteH,
          top: center - minuteH,
          left: center - thickness / 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          backgroundColor: color,
          borderRadius: thickness,
          height: thickness,
          width: hourW,
          top: center - thickness / 2,
          left: center,
        }}
      />
    </View>
  );
}
