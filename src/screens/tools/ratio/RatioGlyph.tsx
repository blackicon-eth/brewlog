import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// Ratio tool glyph — a balance scale: a beam pivoting on a central stand, two pans hung
// from the ends. Reads as "weighing two quantities against each other," distinct from the
// grid's generic FlaskIcon and specific to what this tool actually does (solve dose : water).
export function RatioGlyph({ size = 24, color }: TabIconProps) {
  const beamW = size * 0.74;
  const beamH = size * 0.09;
  const panD = size * 0.28;
  const armH = size * 0.22;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Pans + hanging arms, positioned above the beam */}
      <View style={[styles.panRow, { width: beamW, marginBottom: -beamH / 2 }]}>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 1.5, height: armH, backgroundColor: color }} />
          <View style={{ width: panD, height: panD * 0.6, borderBottomLeftRadius: panD, borderBottomRightRadius: panD, borderWidth: 1.5, borderTopWidth: 0, borderColor: color }} />
        </View>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 1.5, height: armH, backgroundColor: color }} />
          <View style={{ width: panD, height: panD * 0.6, borderBottomLeftRadius: panD, borderBottomRightRadius: panD, borderWidth: 1.5, borderTopWidth: 0, borderColor: color }} />
        </View>
      </View>
      {/* Beam */}
      <View style={{ width: beamW, height: beamH, backgroundColor: color, borderRadius: beamH / 2 }} />
      {/* Central stand */}
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: size * 0.14,
          borderRightWidth: size * 0.14,
          borderBottomWidth: size * 0.22,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          transform: [{ rotate: "180deg" }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  panRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
});
