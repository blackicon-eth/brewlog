import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppText, PillButton } from "./ui";
import { METHODS, type BrewMethodId } from "../lib/brewMethods";
import type { Brew } from "../models/types";
import { colors, fonts, spacing } from "../design/tokens";

// Which method should "Best recipe" dial in? Defaults to the most-brewed method for
// this coffee (ties → shelf order; nothing logged → V60).
export function defaultPickerMethod(brews: Brew[]): BrewMethodId {
  let best: BrewMethodId = "v60";
  let bestCount = -1;
  for (const m of METHODS) {
    const count = brews.filter((b) => b.method === m.id).length;
    if (count > bestCount) { best = m.id; bestCount = count; }
  }
  return best;
}

export function MethodPickerModal({ visible, brews, onCancel, onConfirm }: {
  visible: boolean;
  brews: Brew[];
  onCancel: () => void;
  onConfirm: (method: BrewMethodId) => void;
}) {
  const [selected, setSelected] = useState<BrewMethodId>("v60");
  useEffect(() => {
    if (visible) setSelected(defaultPickerMethod(brews));
  }, [visible, brews]);

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close method picker" onPress={onCancel} />
        <View style={styles.card}>
          <AppText variant="labelSm" style={styles.kicker}>Best recipe</AppText>
          <AppText variant="headlineMd" style={styles.title}>Which method?</AppText>
          <AppText variant="bodyMd" style={styles.blurb}>
            The assistant dials in one method at a time, from the brews you've logged with it.
          </AppText>

          {METHODS.map((m) => {
            const count = brews.filter((b) => b.method === m.id).length;
            const active = selected === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(m.id)}
                style={[styles.rowItem, active && styles.rowItemActive]}
              >
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{m.label}</Text>
                <Text style={styles.rowCount}>
                  {count === 0 ? "No brews yet" : count === 1 ? "1 brew" : `${count} brews`}
                </Text>
              </Pressable>
            );
          })}

          <View style={styles.actions}>
            <PillButton label="Continue" onPress={() => onConfirm(selected)} />
            <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn}>
              <AppText variant="labelMd" style={styles.cancelText}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(44,22,14,0.45)",
    alignItems: "center", justifyContent: "center", padding: spacing.container,
  },
  card: {
    alignSelf: "stretch", backgroundColor: colors.background, borderRadius: 18,
    borderWidth: 1, borderColor: colors.outlineVariant, padding: 22,
  },
  kicker: { color: colors.secondary },
  // Roomy line box so EB Garamond descenders aren't clipped on Android.
  title: { marginTop: 4, lineHeight: 34, includeFontPadding: false },
  blurb: { marginTop: 6, marginBottom: 14, color: colors.onSurfaceVariant },
  rowItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
  },
  rowItemActive: { borderColor: colors.primary, backgroundColor: "rgba(0,74,198,0.06)" },
  rowLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onSurface },
  rowLabelActive: { color: colors.primary },
  rowCount: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.outline },
  actions: { marginTop: 18 },
  cancelBtn: { alignSelf: "center", marginTop: 12, padding: 4 },
  cancelText: { color: colors.onSurfaceVariant },
});
