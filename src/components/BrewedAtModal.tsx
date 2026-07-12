import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText, ChipSelect, PillButton, TextField } from "./ui";
import {
  clampTimePart, composeBrewedAt, dayOptions, pad2, startOfDayTs, type DayOption,
} from "../lib/brewedAt";
import { colors, spacing } from "../design/tokens";

// The "Brewed" sheet: pick a day (this week, or the brew's own older day) and an exact
// hh:mm. Purely sheet-local state — nothing reaches the form until Set.
export function BrewedAtModal({ visible, value, onCancel, onSet }: {
  visible: boolean;
  value: number | null; // current brewedAt; null = an untouched new brew ("now")
  onCancel: () => void;
  onSet: (ts: number) => void;
}) {
  const [options, setOptions] = useState<DayOption[]>([]);
  const [dayStart, setDayStart] = useState("");
  const [hh, setHh] = useState("");
  const [mm, setMm] = useState("");
  const [future, setFuture] = useState(false);

  const seedFrom = (ts: number, now: number) => {
    setOptions(dayOptions(now, value));
    setDayStart(String(startOfDayTs(ts)));
    const d = new Date(ts);
    setHh(pad2(d.getHours()));
    setMm(pad2(d.getMinutes()));
    setFuture(false);
  };

  // (Re)seed sheet-local state each time it opens; Cancel simply discards it.
  useEffect(() => {
    if (!visible) return;
    const now = Date.now();
    seedFrom(value ?? now, now);
  }, [visible, value]);

  const digits = (t: string) => t.replace(/\D/g, "").slice(0, 2);
  const onHh = (t: string) => { setHh(digits(t)); setFuture(false); };
  const onMm = (t: string) => { setMm(digits(t)); setFuture(false); };
  const clampHh = () => { const v = clampTimePart(hh, 23); if (v != null) setHh(pad2(v)); };
  const clampMm = () => { const v = clampTimePart(mm, 59); if (v != null) setMm(pad2(v)); };

  const onJustNow = () => { const now = Date.now(); seedFrom(now, now); };

  const onConfirm = () => {
    const prev = new Date(value ?? Date.now());
    const h = clampTimePart(hh, 23) ?? prev.getHours();
    const m = clampTimePart(mm, 59) ?? prev.getMinutes();
    const ts = composeBrewedAt(parseInt(dayStart, 10), h, m);
    if (ts > Date.now()) { setFuture(true); return; }
    onSet(ts);
  };

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close brewed picker" onPress={onCancel} />
        <View style={styles.card}>
          <AppText variant="labelSm" style={styles.kicker}>Brew log</AppText>
          <AppText variant="headlineMd" style={styles.title}>Brewed</AppText>

          <ChipSelect
            label="Day"
            options={options.map((o) => ({ label: o.label, value: o.key }))}
            value={dayStart}
            onChange={(v) => { if (v) { setDayStart(v); setFuture(false); } }}
            clearable={false}
            columns={2}
            style={styles.days}
          />

          <View style={styles.timeRow}>
            <TextField label="Hour" value={hh} onChangeText={onHh} onBlur={clampHh}
              keyboardType="number-pad" placeholder="14" style={styles.timeCol} />
            <AppText variant="headlineMd" style={styles.colon}>:</AppText>
            <TextField label="Minute" value={mm} onChangeText={onMm} onBlur={clampMm}
              keyboardType="number-pad" placeholder="30" style={styles.timeCol} />
          </View>

          {future ? (
            <AppText variant="labelMd" style={styles.futureNote}>
              A brew can't be brewed in the future.
            </AppText>
          ) : null}

          <Pressable onPress={onJustNow} hitSlop={8} style={styles.justNow} accessibilityRole="button">
            <AppText variant="labelMd" style={styles.justNowText}>Just now</AppText>
          </Pressable>

          <View style={styles.actions}>
            <PillButton label="Set" onPress={onConfirm} />
            <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn} accessibilityRole="button">
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
  title: { marginTop: 4, marginBottom: 14, lineHeight: 34, includeFontPadding: false },
  days: { marginBottom: 4 },
  timeRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.gutter },
  timeCol: { flex: 1, marginBottom: 0 },
  colon: { paddingBottom: 10, color: colors.onSurfaceVariant },
  futureNote: { marginTop: 10, color: colors.tertiary },
  justNow: { alignSelf: "center", marginTop: 14, padding: 4 },
  justNowText: { color: colors.primary },
  actions: { marginTop: 14 },
  cancelBtn: { alignSelf: "center", marginTop: 12, padding: 4 },
  cancelText: { color: colors.onSurfaceVariant },
});
