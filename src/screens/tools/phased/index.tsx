import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, ChipSelect, TextField } from "../../../components/ui";
import { colors, fonts, radii, spacing } from "../../../design/tokens";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../usePersistedState";
import type { ToolModule } from "../types";
import { formatSeconds } from "../../../lib/brewFormat";
import { formatRatio } from "../../../lib/ratio";
import {
  buildFortySix,
  DEFAULT_DOSE_G,
  DEFAULT_PHASE60_POURS,
  DEFAULT_RATIO,
  MAX_PHASE60_POURS,
  MIN_PHASE60_POURS,
  type FirstPourBias,
  type PhasedPour,
} from "../../../lib/fortySix";
import { PhasedGlyph } from "./PhasedGlyph";

const BIAS_OPTIONS: { label: string; value: FirstPourBias }[] = [
  { label: "Sweeter", value: "sweeter" },
  { label: "Balanced", value: "balanced" },
  { label: "Brighter", value: "brighter" },
];

const PHASE_LABEL: Record<PhasedPour["phase"], string> = { taste: "Taste — 40%", strength: "Strength — 60%" };

function PhasedScreen() {
  const [doseText, setDoseText] = usePersistedState("phased:dose", String(DEFAULT_DOSE_G));
  const [ratioText, setRatioText] = usePersistedState("phased:ratio", String(DEFAULT_RATIO));
  const [phase60Pours, setPhase60Pours] = usePersistedState("phased:phase60Pours", DEFAULT_PHASE60_POURS);
  const [bias, setBias] = usePersistedState<FirstPourBias>("phased:bias", "balanced");

  const doseG = parseFloat(doseText.replace(",", "."));
  const ratio = parseFloat(ratioText.replace(",", "."));

  const recipe = useMemo(
    () => buildFortySix({ doseG, ratio, phase60Pours, firstPourBias: bias }),
    [doseG, ratio, phase60Pours, bias]
  );

  const valid = recipe.pours.length > 0;
  const canDecrease = phase60Pours > MIN_PHASE60_POURS;
  const canIncrease = phase60Pours < MAX_PHASE60_POURS;

  return (
    <ToolPage title="4:6 Method" subtitle="Tetsu Kasuya's phased recipe — taste first, strength last">
      {/* Inputs -------------------------------------------------------------------- */}
      <View style={styles.inputsRow}>
        <TextField
          label="Dose"
          value={doseText}
          onChangeText={setDoseText}
          placeholder="20"
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
        <TextField
          label="Ratio (1:x)"
          value={ratioText}
          onChangeText={setRatioText}
          placeholder="15"
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
      </View>

      <View style={styles.stepperWrap}>
        <AppText variant="labelMd">Strength phase pours</AppText>
        <View style={styles.stepperRow}>
          <StepperButton label="–" disabled={!canDecrease} onPress={() => setPhase60Pours((n) => Math.max(MIN_PHASE60_POURS, n - 1))} />
          <View style={styles.stepperValueBox}>
            <AppText variant="headlineMd" style={styles.stepperValue}>{phase60Pours}</AppText>
          </View>
          <StepperButton label="+" disabled={!canIncrease} onPress={() => setPhase60Pours((n) => Math.min(MAX_PHASE60_POURS, n + 1))} />
          <AppText variant="bodyMd" style={styles.stepperHint}>
            {phase60Pours <= 2 ? "Fewer pours — stronger, bolder" : phase60Pours >= 4 ? "More pours — lighter, gentler" : "Balanced body"}
          </AppText>
        </View>
      </View>

      <ChipSelect label="First pour" options={BIAS_OPTIONS} value={bias} onChange={(v) => setBias((v || "balanced") as FirstPourBias)} clearable={false} />

      {!valid ? (
        <Card style={styles.errorCard}>
          <AppText variant="bodyMd">Enter a dose and ratio above 0 to build the recipe.</AppText>
        </Card>
      ) : (
        <>
          {/* Totals ------------------------------------------------------------------ */}
          <View style={styles.totalsRow}>
            <TotalStat label="Total water" value={`${recipe.totalWaterG}g`} />
            <TotalStat label="Ratio" value={formatRatio(recipe.ratio)} />
            <TotalStat label="Brew time" value={`~${formatSeconds(recipe.totalSeconds)}`} />
          </View>

          {/* Phase summary ------------------------------------------------------------ */}
          <View style={styles.phaseSummaryRow}>
            <PhaseSummary label="Taste — 40%" grams={recipe.phase40G} pours={2} muted />
            <PhaseSummary label="Strength — 60%" grams={recipe.phase60G} pours={recipe.phase60Pours} />
          </View>

          {/* Pour list — the centerpiece ------------------------------------------------ */}
          <AppText variant="labelSm" style={styles.pourListKicker}>Pour Sequence</AppText>
          <View style={styles.timeline}>
            {recipe.pours.map((pour, i) => {
              const isPhaseStart = i === 0 || recipe.pours[i - 1].phase !== pour.phase;
              const isLast = i === recipe.pours.length - 1;
              return (
                <View key={pour.index}>
                  {isPhaseStart ? (
                    <AppText variant="labelMd" style={[styles.phaseDivider, pour.phase === "strength" && styles.phaseDividerStrength]}>
                      {PHASE_LABEL[pour.phase]}
                    </AppText>
                  ) : null}
                  <PourRow pour={pour} isLast={isLast} />
                </View>
              );
            })}
          </View>
        </>
      )}
    </ToolPage>
  );
}

function TotalStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalStat}>
      <AppText variant="labelSm">{label}</AppText>
      <AppText variant="headlineMd" style={styles.totalStatValue}>{value}</AppText>
    </View>
  );
}

function PhaseSummary({ label, grams, pours, muted }: { label: string; grams: number; pours: number; muted?: boolean }) {
  return (
    <Card style={[styles.phaseSummaryCard, muted && styles.phaseSummaryCardMuted]}>
      <AppText variant="labelSm">{label}</AppText>
      <AppText variant="headlineMd" style={styles.phaseSummaryGrams}>{grams}g</AppText>
      <AppText variant="bodyMd">{pours} pour{pours === 1 ? "" : "s"}</AppText>
    </Card>
  );
}

function PourRow({ pour, isLast }: { pour: PhasedPour; isLast: boolean }) {
  const isStrength = pour.phase === "strength";
  return (
    <View style={styles.pourRow}>
      <View style={styles.pourRail}>
        <View style={[styles.pourDot, isStrength && styles.pourDotStrength]} />
        {!isLast ? <View style={styles.pourLine} /> : null}
      </View>
      <View style={styles.pourBody}>
        <View style={styles.pourTopLine}>
          <AppText variant="bodyMd" style={styles.pourTimestamp}>{formatSeconds(pour.atSeconds)}</AppText>
          <AppText variant="labelSm">Pour {pour.index}</AppText>
        </View>
        <View style={styles.pourAmountRow}>
          <AppText variant="headlineMd" style={styles.pourAmount}>+{pour.pourG}g</AppText>
          <AppText variant="bodyMd" style={styles.pourCumulative}>→ {pour.cumulativeG}g total</AppText>
        </View>
      </View>
    </View>
  );
}

function StepperButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Increase strength-phase pours" : "Decrease strength-phase pours"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.stepperBtn, disabled && styles.stepperBtnDisabled, pressed && !disabled && styles.stepperBtnPressed]}
    >
      <AppText variant="headlineMd" style={[styles.stepperBtnText, disabled && styles.stepperBtnTextDisabled]}>{label}</AppText>
    </Pressable>
  );
}

export const phasedTool: ToolModule = {
  meta: { id: "phased", title: "4:6 Method", blurb: "Tetsu Kasuya 4:6", icon: PhasedGlyph, comingSoon: true },
  Screen: PhasedScreen,
};

const styles = StyleSheet.create({
  inputsRow: { flexDirection: "row", gap: spacing.gutter },
  inputHalf: { flex: 1 },

  stepperWrap: { gap: 8, marginBottom: 16 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.base,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperBtnPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  stepperBtnText: { color: colors.primary, lineHeight: 26, includeFontPadding: false },
  stepperBtnTextDisabled: { color: colors.outline },
  stepperValueBox: { width: 40, alignItems: "center" },
  stepperValue: { lineHeight: 34, includeFontPadding: false },
  stepperHint: { flex: 1, fontSize: 13, lineHeight: 18 },

  errorCard: { marginTop: 8 },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: spacing.stack,
  },
  totalStat: { alignItems: "flex-start", gap: 4 },
  totalStatValue: { lineHeight: 28, includeFontPadding: false },

  phaseSummaryRow: { flexDirection: "row", gap: spacing.gutter, marginBottom: spacing.section },
  phaseSummaryCard: { flex: 1, gap: 4, borderWidth: 1.5, borderColor: colors.tertiary },
  phaseSummaryCardMuted: { borderColor: colors.outlineVariant },
  phaseSummaryGrams: { lineHeight: 28, includeFontPadding: false, marginTop: 2 },

  pourListKicker: { marginBottom: 12 },

  timeline: { paddingBottom: 8 },
  pourRow: { flexDirection: "row", gap: 14 },
  pourRail: { width: 14, alignItems: "center" },
  pourDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.outlineVariant,
    borderWidth: 2,
    borderColor: colors.background,
  },
  pourDotStrength: { backgroundColor: colors.tertiary },
  pourLine: { flex: 1, width: 2, backgroundColor: colors.outlineVariant, marginVertical: 2 },
  pourBody: { flex: 1, paddingBottom: 22 },
  pourTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  pourTimestamp: { fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  pourAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  pourAmount: { lineHeight: 28, includeFontPadding: false },
  pourCumulative: {},

  phaseDivider: { color: colors.outline, marginBottom: 10, marginTop: 2 },
  phaseDividerStrength: { color: colors.tertiary },
});
