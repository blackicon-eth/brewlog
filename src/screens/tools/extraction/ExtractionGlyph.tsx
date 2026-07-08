import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// Extraction Yield glyph — a refractometer sample well: a small graduated vial with a
// liquid line partway up (the dissolved-solids reading) and a light beam angling off the
// top (the prism refracting light through the drop). Reads as "measuring what dissolved,"
// specific to a TDS→EY tool and distinct from the grid's generic FlaskIcon and the balance
// scale used by the ratio tool.
export function ExtractionGlyph({ size = 24, color }: TabIconProps) {
  const vialW = size * 0.42;
  const vialH = size * 0.66;
  const stroke = Math.max(1.5, size * 0.075);
  const fillH = vialH * 0.42; // liquid sits a little under half — the "reading"

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Refracted beam — a short bar angling up-right off the vial mouth */}
      <View
        style={{
          position: "absolute",
          top: size * 0.14,
          right: size * 0.12,
          width: size * 0.34,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          transform: [{ rotate: "-32deg" }],
        }}
      />
      {/* Graduated vial — open-topped rounded cup */}
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
          marginTop: size * 0.1,
        }}
      >
        {/* Liquid fill — the dissolved-solids level */}
        <View style={{ height: fillH, backgroundColor: color, opacity: 0.9 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
