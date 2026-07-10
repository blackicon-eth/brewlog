import React from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii } from "../../design/tokens";

export type ChipOption = { label: string; value: string };

export type ChipSelectProps = {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  // Chips per row. Unset = all on one track; e.g. 2 folds four options into a 2×2 grid.
  columns?: number;
  style?: ViewStyle;
};

// Segmented single-choice control in the Artisanal Brew Ledger style: equal-width pills
// on a cream track, the active one filled action-blue. Empty string ("") means "no
// selection"; when `clearable`, tapping the active pill clears it.
export function ChipSelect({ label, options, value, onChange, clearable = true, columns, style }: ChipSelectProps) {
  const perRow = columns && columns > 0 ? columns : options.length;
  const rows: ChipOption[][] = [];
  for (let i = 0; i < options.length; i += perRow) rows.push(options.slice(i, i + perRow));

  return (
    <View style={[styles.wrap, style]}>
      <AppText variant="labelMd" style={styles.label}>{label}</AppText>
      {rows.map((row, r) => (
        <View key={r} style={styles.track}>
          {row.map((o) => {
            const active = value === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChange(active && clearable ? "" : o.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <AppText variant="labelMd" style={active ? styles.chipTextActive : styles.chipText}>
                  {o.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  label: {},
  track: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { color: colors.onSurfaceVariant, fontFamily: fonts.sansSemiBold, textAlign: "center" },
  chipTextActive: { color: colors.onPrimary, fontFamily: fonts.sansSemiBold, textAlign: "center" },
});
