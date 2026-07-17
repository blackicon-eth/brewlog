import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, Card, ChipSelect, TextField } from "../../../components/ui";
import { colors, fonts, radii, spacing } from "../../../design/tokens";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ToolModule } from "../types";
import { formatSeconds } from "../../../lib/brewFormat";
import { formatRatioLocale } from "../../../lib/i18n/format";
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
import { useI18n } from "../../../i18n/LocaleProvider";
import { t, tn } from "../../../lib/i18n/t";
import { toolTitle } from "../../../lib/i18n/labels";
import type { Dict } from "../../../lib/i18n/en";
import { PhasedGlyph } from "./PhasedGlyph";

// Localized bias-option / phase labels — resolved from the dictionary rather than hardcoded
// so the ChipSelect and the pour-list dividers read in the active locale.
function biasOptions(dict: Dict): { label: string; value: FirstPourBias }[] {
  return [
    { label: t(dict, "tools.phased.page.biasSweeter"), value: "sweeter" },
    { label: t(dict, "tools.phased.page.biasBalanced"), value: "balanced" },
    { label: t(dict, "tools.phased.page.biasBrighter"), value: "brighter" },
  ];
}

function phaseLabel(dict: Dict, phase: PhasedPour["phase"]): string {
  return phase === "taste" ? t(dict, "tools.phased.page.phaseTasteLabel") : t(dict, "tools.phased.page.phaseStrengthLabel");
}

function PhasedScreen() {
  const { dict, locale } = useI18n();
  const BIAS_OPTIONS = biasOptions(dict);
  const [doseText, setDoseText] = usePersistedState("tool:phased:dose", String(DEFAULT_DOSE_G));
  const [ratioText, setRatioText] = usePersistedState("tool:phased:ratio", String(DEFAULT_RATIO));
  const [phase60Pours, setPhase60Pours] = usePersistedState("tool:phased:phase60Pours", DEFAULT_PHASE60_POURS);
  const [bias, setBias] = usePersistedState<FirstPourBias>("tool:phased:bias", "balanced");

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
    <ToolPage title={toolTitle(dict, "phased")} subtitle={t(dict, "tools.phased.page.subtitle")}>
      {/* Inputs -------------------------------------------------------------------- */}
      <View style={styles.inputsRow}>
        <TextField
          label={t(dict, "tools.phased.page.doseLabel")}
          value={doseText}
          onChangeText={setDoseText}
          placeholder="20"
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
        <TextField
          label={t(dict, "tools.phased.page.ratioLabel")}
          value={ratioText}
          onChangeText={setRatioText}
          placeholder="15"
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
      </View>

      <View style={styles.stepperWrap}>
        <AppText variant="labelMd">{t(dict, "tools.phased.page.strengthPhasePoursLabel")}</AppText>
        <View style={styles.stepperRow}>
          <StepperButton
            label="–"
            a11yLabel={t(dict, "tools.phased.page.decreasePoursA11y")}
            disabled={!canDecrease}
            onPress={() => setPhase60Pours((n) => Math.max(MIN_PHASE60_POURS, n - 1))}
          />
          <View style={styles.stepperValueBox}>
            <AppText variant="headlineMd" style={styles.stepperValue}>{phase60Pours}</AppText>
          </View>
          <StepperButton
            label="+"
            a11yLabel={t(dict, "tools.phased.page.increasePoursA11y")}
            disabled={!canIncrease}
            onPress={() => setPhase60Pours((n) => Math.min(MAX_PHASE60_POURS, n + 1))}
          />
          <AppText variant="bodyMd" style={styles.stepperHint}>
            {phase60Pours <= 2
              ? t(dict, "tools.phased.page.hintFewer")
              : phase60Pours >= 4
                ? t(dict, "tools.phased.page.hintMore")
                : t(dict, "tools.phased.page.hintBalanced")}
          </AppText>
        </View>
      </View>

      <ChipSelect
        label={t(dict, "tools.phased.page.firstPourLabel")}
        options={BIAS_OPTIONS}
        value={bias}
        onChange={(v) => setBias((v || "balanced") as FirstPourBias)}
        clearable={false}
      />

      {!valid ? (
        <Card style={styles.errorCard}>
          <AppText variant="bodyMd">{t(dict, "tools.phased.page.enterRecipeError")}</AppText>
        </Card>
      ) : (
        <>
          {/* Totals ------------------------------------------------------------------ */}
          <View style={styles.totalsRow}>
            <TotalStat label={t(dict, "tools.phased.page.totalWaterStatLabel")} value={`${recipe.totalWaterG}g`} />
            <TotalStat label={t(dict, "tools.phased.page.ratioStatLabel")} value={formatRatioLocale(recipe.ratio, locale)} />
            <TotalStat label={t(dict, "tools.phased.page.brewTimeStatLabel")} value={`~${formatSeconds(recipe.totalSeconds)}`} />
          </View>

          {/* Phase summary ------------------------------------------------------------ */}
          <View style={styles.phaseSummaryRow}>
            <PhaseSummary dict={dict} label={phaseLabel(dict, "taste")} grams={recipe.phase40G} pours={2} muted />
            <PhaseSummary dict={dict} label={phaseLabel(dict, "strength")} grams={recipe.phase60G} pours={recipe.phase60Pours} />
          </View>

          {/* Pour list — the centerpiece ------------------------------------------------ */}
          <AppText variant="labelSm" style={styles.pourListKicker}>{t(dict, "tools.phased.page.pourSequenceKicker")}</AppText>
          <View style={styles.timeline}>
            {recipe.pours.map((pour, i) => {
              const isPhaseStart = i === 0 || recipe.pours[i - 1].phase !== pour.phase;
              const isLast = i === recipe.pours.length - 1;
              return (
                <View key={pour.index}>
                  {isPhaseStart ? (
                    <AppText variant="labelMd" style={[styles.phaseDivider, pour.phase === "strength" && styles.phaseDividerStrength]}>
                      {phaseLabel(dict, pour.phase)}
                    </AppText>
                  ) : null}
                  <PourRow dict={dict} pour={pour} isLast={isLast} />
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

function PhaseSummary({
  dict,
  label,
  grams,
  pours,
  muted,
}: {
  dict: Dict;
  label: string;
  grams: number;
  pours: number;
  muted?: boolean;
}) {
  return (
    <Card style={[styles.phaseSummaryCard, muted && styles.phaseSummaryCardMuted]}>
      <AppText variant="labelSm">{label}</AppText>
      <AppText variant="headlineMd" style={styles.phaseSummaryGrams}>{grams}g</AppText>
      <AppText variant="bodyMd">{tn(dict, "tools.phased.page.poursCount", pours)}</AppText>
    </Card>
  );
}

function PourRow({ dict, pour, isLast }: { dict: Dict; pour: PhasedPour; isLast: boolean }) {
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
          <AppText variant="labelSm">{t(dict, "tools.phased.page.pourLabel", { n: pour.index })}</AppText>
        </View>
        <View style={styles.pourAmountRow}>
          <AppText variant="headlineMd" style={styles.pourAmount}>+{pour.pourG}g</AppText>
          <AppText variant="bodyMd" style={styles.pourCumulative}>
            {t(dict, "tools.phased.page.pourCumulative", { g: pour.cumulativeG })}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function StepperButton({
  label,
  a11yLabel,
  onPress,
  disabled,
}: {
  label: string;
  a11yLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
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
  meta: { id: "phased", icon: PhasedGlyph },
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
