import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// Extraction Yield glyph — a graduated test tube: liquid partway up (the dissolved-solids
// reading) with two graduation ticks on the glass above it. Everything stays inside the
// tube's silhouette — nothing protrudes. Reads as "measuring what dissolved," specific to
// a TDS→EY tool and distinct from the grid's generic FlaskIcon and the ratio tool's scale.
export function ExtractionGlyph({ size = 24, color }: TabIconProps) {
  const vialW = size * 0.5;
  const vialH = size * 0.78;
  const stroke = Math.max(1.5, size * 0.075);
  const fillH = vialH * 0.42; // liquid sits a little under half — the "reading"
  const tickW = vialW * 0.3;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Graduated test tube — open-topped, round-bottomed */}
      <View
        style={{
          width: vialW,
          height: vialH,
          borderWidth: stroke,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: vialW * 0.5,
          borderBottomRightRadius: vialW * 0.5,
          justifyContent: "flex-end",
          overflow: "hidden",
        }}
      >
        {/* Graduation ticks on the glass, right wall inward */}
        {[0.16, 0.36].map((f) => (
          <View
            key={f}
            style={{
              position: "absolute",
              top: vialH * f,
              right: 0,
              width: tickW,
              height: stroke * 0.9,
              borderRadius: stroke,
              backgroundColor: color,
            }}
          />
        ))}
        {/* Liquid fill — the dissolved-solids level */}
        <View style={{ height: fillH, backgroundColor: color, opacity: 0.9 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
