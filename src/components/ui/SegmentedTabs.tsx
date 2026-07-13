import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, motion, radii, shadows } from "../../design/tokens";

export type SegmentedTab<T extends string> = { value: T; label: string };

export type SegmentedTabsProps<T extends string> = {
  options: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

// A segmented selector whose active pill GLIDES between options instead of two pills
// swapping: one Animated index, eased with the shared springGlide, drives a native-driver
// translateX so only the transform animates (no per-frame restyle to flicker). One measured
// track width sets the pill geometry; labels tint to primary as the pill arrives underneath.
// Generic over the option union so callers keep their string-literal types end to end.
export function SegmentedTabs<T extends string>({ options, value, onChange, style }: SegmentedTabsProps<T>) {
  const [trackW, setTrackW] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  useEffect(() => {
    Animated.spring(anim, { toValue: index, ...motion.springGlide, useNativeDriver: true }).start();
  }, [index, anim]);

  const PAD = 4;
  const pillW = trackW > 0 ? (trackW - PAD * 2) / options.length : 0;

  return (
    <View style={[styles.track, style]} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      {pillW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: pillW, transform: [{ translateX: Animated.multiply(anim, pillW) }] }]}
        />
      ) : null}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={styles.item}
          >
            <AppText variant="labelMd" style={on ? styles.textOn : styles.text}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.surfaceContainer, borderRadius: radii.full, padding: 4 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: radii.full },
  // The one pill that glides beneath whichever label is active.
  pill: { position: "absolute", left: 4, top: 4, bottom: 4, borderRadius: radii.full, backgroundColor: colors.surfaceLowest, ...shadows.card },
  text: { color: colors.onSurfaceVariant },
  textOn: { color: colors.primary },
});
