import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { METHODS, type MethodFilter } from "../../lib/brewMethods";
import { colors, fonts, radii, spacing } from "../../design/tokens";

export type MethodFilterBarProps = {
  value: MethodFilter;
  onChange: (value: MethodFilter) => void;
  style?: ViewStyle;
};

type Chip = { value: MethodFilter; label: string };

// Horizontal, scrollbar-less strip of method-filter chips for the Brew ledger masthead:
// an explicit "All" leading the four methods. Single-select — "All" is the escape hatch
// back to the unfiltered ledger. Same pill vocabulary as ChipSelect, but content-width and
// scrollable (an overflow past the phone width swipes) so it reads as a filter bar.
export function MethodFilterBar({ value, onChange, style }: MethodFilterBarProps) {
  const chips = useMemo<Chip[]>(
    () => [{ value: "all", label: "All" }, ...METHODS.map((m) => ({ value: m.id, label: m.shortLabel }))],
    [],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.track}
    >
      {chips.map((c) => {
        const active = value === c.value;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(c.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <AppText variant="labelMd" style={active ? styles.textActive : styles.text}>
              {c.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Symmetric horizontal inset so the first and last chip both clear the screen edge when
  // the strip bleeds edge-to-edge and scrolls.
  track: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.container },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.onSurfaceVariant, fontFamily: fonts.sansSemiBold },
  textActive: { color: colors.onPrimary, fontFamily: fonts.sansSemiBold },
});
