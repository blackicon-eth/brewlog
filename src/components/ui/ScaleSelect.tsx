import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii } from "../../design/tokens";

export type ScaleSelectProps = {
  label: string;
  value: string; // "" = unrated, else "1".."5"
  onChange: (value: string) => void;
};

const STEPS = ["1", "2", "3", "4", "5"];

// One tasting attribute as a compact log row: the attribute name on the left, a 1–5 row of
// pills on the right. The chosen step fills action-blue; tapping it again clears the rating.
export function ScaleSelect({ label, value, onChange }: ScaleSelectProps) {
  return (
    <View style={styles.row}>
      <AppText variant="bodyLg" style={styles.label}>{label}</AppText>
      <View style={styles.steps}>
        {STEPS.map((n) => {
          const active = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${n}`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(active ? "" : n)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <AppText variant="labelMd" style={active ? styles.pillTextActive : styles.pillText}>
                {n}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { width: 92, color: colors.onSurface },
  steps: { flex: 1, flexDirection: "row", gap: 6 },
  pill: {
    flex: 1,
    aspectRatio: 1.3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.base,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.onSurfaceVariant, fontFamily: fonts.sansSemiBold, letterSpacing: 0 },
  pillTextActive: { color: colors.onPrimary, fontFamily: fonts.sansSemiBold, letterSpacing: 0 },
});
