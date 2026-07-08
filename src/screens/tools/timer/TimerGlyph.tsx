import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// Brew Timer glyph — a stopwatch: a ringed dial with a top stem/crown and a single hand
// swept to the upper-right (the "counting" pose). Hand-drawn from Views (same zero-dep
// approach as ClockIcon/RatioGlyph) so the tool carries no icon-library weight. Distinct
// from the plain wall-clock ClockIcon by the crown + the diagonal, running-looking hand.
export function TimerGlyph({ size = 24, color }: TabIconProps) {
  const thickness = Math.max(1.5, size * 0.08);
  const dial = size * 0.74; // diameter of the face
  const inner = dial - thickness * 2;
  const center = inner / 2;
  const hand = inner * 0.4;
  const crownW = size * 0.14;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Crown/stem on top of the dial */}
      <View style={{ width: crownW, height: size * 0.13, backgroundColor: color, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5, marginBottom: -thickness / 2 }} />
      {/* Dial */}
      <View style={{ width: dial, height: dial, borderRadius: dial / 2, borderWidth: thickness, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: inner, height: inner }}>
          {/* Hub */}
          <View style={{ position: "absolute", width: thickness * 1.4, height: thickness * 1.4, borderRadius: thickness, backgroundColor: color, top: center - thickness * 0.7, left: center - thickness * 0.7 }} />
          {/* Hand — a bar pinned at the hub then rotated toward the upper-right. Rotating a
              centred, upward hand by 42° sweeps its far tip out; matches the existing glyphs'
              plain rotate idiom (no transformOrigin, which older RN style-typing balks at). */}
          <View
            style={{
              position: "absolute",
              width: thickness,
              height: hand,
              borderRadius: thickness,
              backgroundColor: color,
              top: center - hand + hand / 2,
              left: center - thickness / 2,
              transform: [{ translateY: -hand / 2 }, { rotate: "42deg" }, { translateY: hand / 2 }],
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
