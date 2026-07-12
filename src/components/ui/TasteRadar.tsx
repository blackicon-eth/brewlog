import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { polygonEdges, radarPoints, ringPoints, scanlineFill } from "../../lib/radar";
import { colors, fonts, motion } from "../../design/tokens";

export type TasteRadarProps = {
  // Axis order is fixed: Acidity, Sweetness, Bitterness, Body, Clarity (1–5, null = unrated).
  values: Array<number | null>;
  size?: number;
};

const AXES = ["Acidity", "Sweetness", "Bitterness", "Body", "Clarity"] as const;
// The shape's wash: coffee-cherry ink at watercolor strength (tertiary #ab0b18).
const FILL_INK = "rgba(171,11,24,0.10)";
const MAX = 5;
const RINGS = [0.2, 0.4, 0.6, 0.8, 1]; // one ruled pentagon per point of the 1–5 scale
const LABEL_W = 76;
const LABEL_H = 30;

// A line between two vertices, drawn as a rotated hairline View — the whole chart is
// plotted this way (no SVG, zero native risk). Ambient shadows are avoided on purpose:
// the ruled-paper look wants ink, not lift.
function Line({ cx, cy, length, angleDeg, thickness, color }: {
  cx: number; cy: number; length: number; angleDeg: number; thickness: number; color: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: cx - length / 2,
        top: cy - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness,
        backgroundColor: color,
        transform: [{ rotate: `${angleDeg}deg` }],
      }}
    />
  );
}

// The tasting pentagon: five concentric ruled rings (the 1–5 scale on graph paper),
// quiet spokes, and the brew's own shape inked in coffee-cherry on top — the color the
// ledger reserves for flavor. Unrated axes collapse to the center and dim their label.
// One gentle settle-in on mount; nothing loops.
export function TasteRadar({ values, size = 280 }: TasteRadarProps) {
  // The plot is a `size` square, but the component claims the full row width so the
  // side labels have air beyond the square instead of being clamped onto the rings.
  const [w, setW] = useState(size);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || size);
  const cx = w / 2;
  const cy = size / 2;
  // Leave air for the labels that ring the plot.
  const radius = size / 2 - 42;

  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(settle, {
      toValue: 1, duration: motion.gentle, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [settle]);

  const points = radarPoints(values, MAX, radius, cx, cy);
  const shape = polygonEdges(points);
  const fill = scanlineFill(points, 3);
  const labelAnchors = ringPoints(AXES.length, 1, radius + 32, cx, cy);

  return (
    <View style={{ width: "100%", height: size }} onLayout={onLayout}>
      {/* Graph paper: five ruled pentagons + a spoke to each vertex. */}
      {RINGS.map((f, r) =>
        polygonEdges(ringPoints(AXES.length, f, radius, cx, cy)).map((e, i) => (
          <Line
            key={`ring${r}-${i}`}
            {...e}
            thickness={StyleSheet.hairlineWidth}
            color={r === RINGS.length - 1 ? colors.outlineVariant : "rgba(195,198,215,0.55)"}
          />
        )),
      )}
      {ringPoints(AXES.length, 1, radius, cx, cy).map((p, i) => (
        <Line
          key={`spoke${i}`}
          cx={(cx + p.x) / 2}
          cy={(cy + p.y) / 2}
          length={radius}
          angleDeg={(Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI}
          thickness={StyleSheet.hairlineWidth}
          color="rgba(195,198,215,0.55)"
        />
      ))}

      {/* The brew's shape, settling in once: cherry ink strokes + a bead per vertex. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          opacity: settle,
          transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        }]}
      >
        {fill.map((f, i) => (
          <View
            key={`fill${i}`}
            pointerEvents="none"
            style={{
              position: "absolute", left: f.x, top: f.y, width: f.width, height: f.height,
              backgroundColor: FILL_INK,
            }}
          />
        ))}
        {shape.map((e, i) => (
          <Line key={`edge${i}`} {...e} thickness={2} color={colors.tertiary} />
        ))}
        {points.map((p, i) => (
          <View
            key={`dot${i}`}
            style={[
              styles.dot,
              { left: p.x - 4, top: p.y - 4 },
              values[i] == null && styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {/* Labels ring the plot; each carries its figure like a ledger annotation.
          Clamped into the canvas — Android clips children, so an overflowing side
          label would be sliced off. */}
      {labelAnchors.map((p, i) => (
        <View
          key={`label${i}`}
          pointerEvents="none"
          style={[styles.label, {
            left: Math.min(Math.max(p.x - LABEL_W / 2, 0), w - LABEL_W),
            top: Math.min(Math.max(p.y - LABEL_H / 2, 0), size - LABEL_H),
          }]}
        >
          <Text style={[styles.labelText, values[i] == null && styles.labelMuted]}>{AXES[i]}</Text>
          <Text style={[styles.labelValue, values[i] == null && styles.labelMuted]}>
            {values[i] == null ? "—" : values[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tertiary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  dotEmpty: { backgroundColor: colors.background, borderColor: colors.outlineVariant },
  label: { position: "absolute", width: LABEL_W, height: LABEL_H, alignItems: "center", justifyContent: "center" },
  labelText: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 0.4, color: colors.onSurfaceVariant },
  labelValue: { fontFamily: fonts.display, fontSize: 13, color: colors.onSurface, marginTop: 1 },
  labelMuted: { color: colors.outlineVariant },
});
