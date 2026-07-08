import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// 4:6 tool glyph — two stacked pour bands of different weight (a thin band over a thick
// band), read as "two phases, two proportions": the slim top band is the 40% Taste phase,
// the deep bottom band is the 60% Strength phase. Distinct from the grid's generic
// FlaskIcon and specific to what this tool actually does (a two-phase staged pour).
export function PhasedGlyph({ size = 24, color }: TabIconProps) {
  const w = size * 0.76;
  const topH = size * 0.22;
  const bottomH = size * 0.34;
  const gap = size * 0.08;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ width: w, height: topH, backgroundColor: color, opacity: 0.55, borderRadius: 2 }} />
      <View style={{ height: gap }} />
      <View style={{ width: w, height: bottomH, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
