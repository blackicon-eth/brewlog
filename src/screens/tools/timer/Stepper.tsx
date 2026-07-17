import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../../components/ui";
import { colors, fonts, radii } from "../../../design/tokens";
import { useI18n } from "../../../i18n/LocaleProvider";

export type StepperProps = {
  label: string;
  // Rendered value string (already formatted, e.g. "2.0" or "45 s").
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;
  // Optional supporting caption under the value (e.g. "→ 60 g bloom").
  hint?: string;
};

// A bounded −/+ stepper for the setup form. Big round tap targets read well while a brewer's
// hands are busy; the value sits centred between them in the tabular sans so it doesn't jump
// as digits change. Disabled ends fade rather than vanish so the control keeps its footprint.
export function Stepper({ label, display, onDecrement, onIncrement, canDecrement, canIncrement, hint }: StepperProps) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText variant="labelMd">{label}</AppText>
        {hint ? <AppText variant="labelSm" style={styles.hint}>{hint}</AppText> : null}
      </View>
      <View style={styles.row}>
        <StepButton symbol="−" onPress={onDecrement} disabled={!canDecrement} accessibilityLabel={t("tools.timer.page.decreaseA11y", { label })} />
        <View style={styles.valueBox}>
          <AppText style={styles.value}>{display}</AppText>
        </View>
        <StepButton symbol="+" onPress={onIncrement} disabled={!canIncrement} accessibilityLabel={t("tools.timer.page.increaseA11y", { label })} />
      </View>
    </View>
  );
}

// Hold-to-repeat timings: first repeat after an intent-confirming pause, then each tick
// comes a little sooner (×0.82) down to a floor — so a held button ramps from deliberate
// single steps to a rapid sweep.
const HOLD_DELAY_MS = 380;
const HOLD_START_INTERVAL_MS = 130;
const HOLD_MIN_INTERVAL_MS = 35;

function StepButton({ symbol, onPress, disabled, accessibilityLabel }: { symbol: string; onPress: () => void; disabled: boolean; accessibilityLabel: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The parent recreates onPress/disabled every step; refs keep the running repeat loop on
  // the latest ones without restarting it.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // True only between press-in and press-out. Every scheduled tick re-checks it, so even a
  // timer orphaned by a rapid double-tap (press-in racing press-out) dies on its next tick
  // instead of repeating forever.
  const held = useRef(false);

  const stop = useCallback(() => {
    held.current = false;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Step immediately on touch-down, then accelerate while held. Using onPressIn (not
  // onPress) means a plain tap and the first hold-step are the same single step.
  const start = useCallback(() => {
    stop(); // never let two loops overlap
    held.current = true;
    onPressRef.current();
    let interval = HOLD_START_INTERVAL_MS;
    const tick = () => {
      if (!held.current || disabledRef.current) {
        stop();
        return;
      }
      onPressRef.current();
      interval = Math.max(HOLD_MIN_INTERVAL_MS, interval * 0.82);
      timer.current = setTimeout(tick, interval);
    };
    timer.current = setTimeout(tick, HOLD_DELAY_MS);
  }, [stop]);

  // Clear the loop on unmount and the moment the button bottoms out at a bound.
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={start}
      onPressOut={stop}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, disabled && styles.btnDisabled, pressed && !disabled && styles.btnPressed]}
    >
      <AppText style={styles.btnText}>{symbol}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 14 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  hint: { color: colors.secondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.full,
    padding: 4,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { backgroundColor: colors.surfaceContainerHigh, transform: [{ scale: 0.94 }] },
  btnText: { fontFamily: fonts.sansSemiBold, fontSize: 20, lineHeight: 22, color: colors.primary, includeFontPadding: false },
  valueBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  value: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.onSurface,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
});
