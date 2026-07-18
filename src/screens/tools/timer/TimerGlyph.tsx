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
  const hand = inner * 0.4 - 1; // minute hand, a px shy of the dial
  const hourHand = inner * 0.26; // shorter hour hand, swept up-left
  const handW = Math.max(1, thickness * 0.65); // hands draw finer than the dial's ring
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
          {/* Hand — a bar standing on the hub, swept 42° toward the upper-right. The
              translate/rotate/translate sandwich moves the pivot from the bar's middle to
              its bottom end, so the hand rotates around the hub with no tail poking out
              the far side (no transformOrigin, which older RN style-typing balks at). */}
          <View
            style={{
              position: "absolute",
              width: handW,
              height: hand,
              borderRadius: handW,
              backgroundColor: color,
              top: center - hand,
              left: center - handW / 2,
              transform: [{ translateY: hand / 2 }, { rotate: "42deg" }, { translateY: -hand / 2 }],
            }}
          />
          {/* Hour hand — shorter, swept up-left, same bottom-end pivot on the hub */}
          <View
            style={{
              position: "absolute",
              width: handW,
              height: hourHand,
              borderRadius: handW,
              backgroundColor: color,
              top: center - hourHand,
              left: center - handW / 2,
              transform: [{ translateY: hourHand / 2 }, { rotate: "-48deg" }, { translateY: -hourHand / 2 }],
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
