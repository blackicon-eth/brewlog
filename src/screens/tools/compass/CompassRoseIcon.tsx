import React from "react";
import { StyleSheet, View } from "react-native";
import type { TabIconProps } from "../../../components/ui";

// Hand-drawn compass rose — the Coffee Compass mark. A four-point star (two crossed
// diamonds, N/S taller than E/W) around a small hub, echoing a cartographer's rose.
// Zero-dependency, built from Views like the app's other glyphs; `color` drives state.
export function CompassRoseIcon({ size = 24, color }: TabIconProps) {
  const long = size * 0.5; // N–S needle length (each arm)
  const short = size * 0.34; // E–W needle length (each arm)
  const w = size * 0.18; // needle width at the hub
  const hub = size * 0.2;

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {/* Vertical needle (N–S): two tall triangles meeting at centre. */}
      <View style={styles.center}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: w / 2,
            borderRightWidth: w / 2,
            borderBottomWidth: long,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: color,
          }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: w / 2,
            borderRightWidth: w / 2,
            borderTopWidth: long,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: color,
          }}
        />
      </View>

      {/* Horizontal needle (E–W): the same star rotated a quarter turn, shorter arms. */}
      <View style={[styles.center, { transform: [{ rotate: "90deg" }] }]}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: w / 2,
            borderRightWidth: w / 2,
            borderBottomWidth: short,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: color,
          }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: w / 2,
            borderRightWidth: w / 2,
            borderTopWidth: short,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: color,
          }}
        />
      </View>

      {/* Hub — a small ringed dot at the pivot, punched with the box colour. */}
      <View style={[styles.center, styles.hubWrap]}>
        <View style={{ width: hub, height: hub, borderRadius: hub / 2, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  hubWrap: {},
});
