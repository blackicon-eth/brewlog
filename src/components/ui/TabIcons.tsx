import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../design/tokens";

// Zero-dependency tab glyphs, hand-drawn from Views (same approach as Chevron/ClockIcon)
// so the bar carries no icon-library weight. Each is a filled silhouette that reads at
// ~24px; `color` drives the active/inactive state from the bar.
export type TabIconProps = { size?: number; color: string };

// Home — a little house: an overhanging roof over a square body.
export function HomeIcon({ size = 24, color }: TabIconProps) {
  const roofW = size * 0.84;
  const bodyW = size * 0.6;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: roofW / 2,
          borderRightWidth: roofW / 2,
          borderBottomWidth: size * 0.4,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
        }}
      />
      <View style={{ width: bodyW, height: size * 0.4, marginTop: -1, backgroundColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}

// Brews — a water droplet (one pour): a rounded square with a single sharp corner up top.
export function DropIcon({ size = 24, color }: TabIconProps) {
  const d = size * 0.62;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Nudge down a touch — the rotated square optically floats high otherwise. */}
      <View style={{ transform: [{ translateY: size * 0.08 }] }}>
        <View style={{ width: d, height: d, backgroundColor: color, borderRadius: d, borderTopLeftRadius: 2, transform: [{ rotate: "45deg" }] }} />
      </View>
    </View>
  );
}

// Assistant — the app's AI mark. Reuses the ✦ glyph used on every other AI surface.
export function SparkGlyph({ size = 24, color }: TabIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Raise a touch — the ✦ glyph sits low on its text box. */}
      <Text style={{ fontSize: size * 0.96, lineHeight: size, color, includeFontPadding: false, fontFamily: fonts.sansMedium, transform: [{ translateY: -size * 0.08 }] }}>✦</Text>
    </View>
  );
}

// Tools — an Erlenmeyer flask (the "science" of brewing): a neck over a wide body.
export function FlaskIcon({ size = 24, color }: TabIconProps) {
  const bodyW = size * 0.72;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: size * 0.2, height: size * 0.26, backgroundColor: color, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 }} />
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: bodyW / 2,
          borderRightWidth: bodyW / 2,
          borderBottomWidth: size * 0.5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
        }}
      />
    </View>
  );
}

// Settings — a solid cog: a disc ringed by eight teeth.
export function GearIcon({ size = 24, color }: TabIconProps) {
  const disc = size * 0.52;
  const toothW = size * 0.16;
  const toothH = size * 0.2;
  const reach = size * 0.32;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: toothW,
            height: toothH,
            borderRadius: 1.5,
            backgroundColor: color,
            transform: [{ rotate: `${i * 45}deg` }, { translateY: -reach }],
          }}
        />
      ))}
      <View style={{ width: disc, height: disc, borderRadius: disc / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
