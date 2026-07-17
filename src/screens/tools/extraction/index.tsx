import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, TextField } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ToolModule } from "../types";
import { colors, fonts, radii, shadows, spacing } from "../../../design/tokens";
import { formatRatioLocale, formatNumberLocale } from "../../../lib/i18n/format";
import {
  extractionYield,
  estimateBeverageG,
  band,
  dissolvedSolidsG,
  waterRetainedG,
  DEFAULT_LRR,
  EY_IDEAL_MIN,
  EY_IDEAL_MAX,
  type EyBand,
} from "../../../lib/extraction";
import { useI18n } from "../../../i18n/LocaleProvider";
import { t } from "../../../lib/i18n/t";
import { toolTitle, extractionBandText } from "../../../lib/i18n/labels";
import type { Dict } from "../../../lib/i18n/en";
import { ExtractionGlyph } from "./ExtractionGlyph";

// How the beverage weight is known: measured on a scale (exact) vs estimated from the water
// poured (approximate). The estimate path is the one place water weight is allowed in — and
// only to derive beverage weight, never straight into EY (that shortcut is refuted).
type BevSource = "measured" | "estimate";

function bevOptions(dict: Dict): { key: BevSource; label: string }[] {
  return [
    { key: "measured", label: t(dict, "tools.extraction.page.weighedCup") },
    { key: "estimate", label: t(dict, "tools.extraction.page.estimateOption") },
  ];
}

// Per-band presentation: the hero number's color (in-band reads calm action-blue,
// out-of-band reads coffee-cherry), plus the verdict/note copy resolved from the dictionary.
const BAND_TINTS: Record<EyBand, string> = { under: colors.tertiary, ideal: colors.primary, over: colors.tertiary };

function bandFace(dict: Dict, b: EyBand): { tint: string; verdict: string; note: string } {
  return { tint: BAND_TINTS[b], ...extractionBandText(dict, b) };
}

// Parses a decimal-pad string to a finite positive number, else 0 — guards the NaN a stray
// "." or empty field would otherwise leak into every readout while typing.
function toNumber(text: string): number {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Extraction Yield (TDS → EY) — the refractometer bench tool. The brewer enters dose, a TDS
// reading, and the cup weight (or estimates it from water), and the page turns that into an
// extraction-yield %: the hero number, color-banded and captioned with a taste verdict, over
// a strip of the derived numbers (strength, ratio, dissolved solids, water retained).
function ExtractionScreen() {
  const { dict, locale } = useI18n();
  const BEV_OPTIONS = bevOptions(dict);
  const [bevSource, setBevSource] = usePersistedState<BevSource>("tool:extraction:bevSource", "measured");
  const [doseText, setDoseText] = usePersistedState("tool:extraction:dose", "18");
  const [tdsText, setTdsText] = usePersistedState("tool:extraction:tds", "1.35");
  const [beverageText, setBeverageText] = usePersistedState("tool:extraction:beverage", "264");
  const [waterText, setWaterText] = usePersistedState("tool:extraction:water", "300");

  const dose = toNumber(doseText);
  const tds = toNumber(tdsText);
  const beverageIn = toNumber(beverageText);
  const water = toNumber(waterText);

  const estimated = bevSource === "estimate";

  // Beverage weight drives EY. Measured mode uses the weighed cup directly; estimate mode
  // derives it from water minus what the grounds hold back (dose × LRR) and flags it approx.
  const beverage = estimated ? estimateBeverageG(water, dose, DEFAULT_LRR) : beverageIn;

  const ey = useMemo(
    () => extractionYield({ doseG: dose, beverageG: beverage, tdsPct: tds }),
    [dose, beverage, tds],
  );

  const ready = ey > 0;
  const b = ready ? band(ey) : "ideal";
  const face = bandFace(dict, b);

  // Derived readouts for the metrics strip. Ratio only makes sense when water is known
  // (both modes can have it), retained water only when both water and beverage are present.
  const solids = dissolvedSolidsG(beverage, tds);
  const ratio = dose > 0 && water > 0 ? water / dose : 0;
  const retained = waterRetainedG(water, beverage);

  // Meter fill: where this EY sits across a plausible 14–26% axis, so the marker lands
  // sensibly for under/ideal/over without ever overrunning the track.
  const METER_MIN = 14;
  const METER_MAX = 26;
  const meterPct = ready
    ? Math.min(1, Math.max(0, (ey - METER_MIN) / (METER_MAX - METER_MIN)))
    : 0;

  return (
    <ToolPage title={toolTitle(dict, "extraction")} subtitle={t(dict, "tools.extraction.page.subtitle")}>
      {/* Beverage-weight source */}
      <AppText variant="labelMd" style={styles.sectionLabel}>{t(dict, "tools.extraction.page.cupWeightLabel")}</AppText>
      <View style={styles.segment}>
        {BEV_OPTIONS.map((opt) => {
          const active = bevSource === opt.key;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setBevSource(opt.key)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <AppText variant="labelMd" style={active ? styles.segmentTextActive : styles.segmentText}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Hero — the EY %, banded */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroGlyph}>
            <ExtractionGlyph size={26} color={face.tint} />
          </View>
          <AppText variant="labelSm" style={styles.heroLabel}>
            {estimated ? t(dict, "tools.extraction.page.extractionEst") : t(dict, "tools.extraction.page.extractionYieldLabel")}
          </AppText>
        </View>

        <View style={styles.heroValueRow}>
          <AppText style={[styles.heroValue, { color: ready ? face.tint : colors.outline }]}>
            {ready ? formatNumberLocale(ey, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"}
          </AppText>
          <AppText style={[styles.heroUnit, { color: ready ? face.tint : colors.outline }]}>%</AppText>
        </View>

        {/* Verdict chip */}
        <View style={[styles.verdictChip, { backgroundColor: ready ? face.tint : colors.surfaceContainer }]}>
          <AppText variant="labelSm" style={[styles.verdictText, { color: ready ? colors.onPrimary : colors.secondary }]}>
            {ready ? face.verdict : t(dict, "tools.extraction.page.enterReading")}
          </AppText>
        </View>

        {ready ? <AppText variant="bodyMd" style={styles.verdictNote}>{face.note}</AppText> : null}

        {/* Band meter — the 18–22% sweet spot marked on a 14–26% axis */}
        <View style={styles.meter}>
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterIdeal,
                {
                  left: `${((EY_IDEAL_MIN - METER_MIN) / (METER_MAX - METER_MIN)) * 100}%`,
                  width: `${((EY_IDEAL_MAX - EY_IDEAL_MIN) / (METER_MAX - METER_MIN)) * 100}%`,
                },
              ]}
            />
            {ready ? (
              <View style={[styles.meterMarker, { left: `${meterPct * 100}%`, backgroundColor: face.tint }]} />
            ) : null}
          </View>
          <View style={styles.meterScale}>
            <AppText variant="labelSm" style={styles.meterTick}>{METER_MIN}</AppText>
            <AppText variant="labelSm" style={styles.meterTickIdeal}>
              {t(dict, "tools.extraction.page.meterIdealLabel", { min: EY_IDEAL_MIN, max: EY_IDEAL_MAX })}
            </AppText>
            <AppText variant="labelSm" style={styles.meterTick}>{METER_MAX}</AppText>
          </View>
        </View>
      </View>

      {estimated ? (
        <View style={styles.estBanner}>
          <View style={styles.estDot} />
          <AppText variant="bodyMd" style={styles.estText}>
            {beverage > 0
              ? t(dict, "tools.extraction.page.approxBannerWithCup", {
                  lrr: formatNumberLocale(DEFAULT_LRR, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                  g: beverage.toFixed(0),
                })
              : t(dict, "tools.extraction.page.approxBannerNoCup", {
                  lrr: formatNumberLocale(DEFAULT_LRR, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                })}
          </AppText>
        </View>
      ) : null}

      {/* Inputs */}
      <AppText variant="labelMd" style={[styles.sectionLabel, styles.inputsLabel]}>{t(dict, "tools.extraction.page.measurementsLabel")}</AppText>

      <TextField
        label={t(dict, "tools.extraction.page.doseFieldLabel")}
        value={doseText}
        onChangeText={setDoseText}
        placeholder="18"
        required
        keyboardType="decimal-pad"
      />

      <TextField
        label={t(dict, "tools.extraction.page.tdsFieldLabel")}
        value={tdsText}
        onChangeText={setTdsText}
        placeholder="1.35"
        required
        keyboardType="decimal-pad"
      />

      {estimated ? (
        <TextField
          label={t(dict, "tools.extraction.page.waterPouredLabel")}
          value={waterText}
          onChangeText={setWaterText}
          placeholder="300"
          required
          keyboardType="decimal-pad"
        />
      ) : (
        <>
          <TextField
            label={t(dict, "tools.extraction.page.beverageWeightFieldLabel")}
            value={beverageText}
            onChangeText={setBeverageText}
            placeholder="264"
            required
            keyboardType="decimal-pad"
          />
          <TextField
            label={t(dict, "tools.extraction.page.waterPouredOptionalLabel")}
            value={waterText}
            onChangeText={setWaterText}
            placeholder="300"
            keyboardType="decimal-pad"
          />
        </>
      )}

      {/* Derived metrics */}
      <AppText variant="labelMd" style={[styles.sectionLabel, styles.inputsLabel]}>{t(dict, "tools.extraction.page.derivedLabel")}</AppText>
      <View style={styles.metricsCard}>
        <MetricRow
          label={t(dict, "tools.extraction.page.strengthTdsLabel")}
          value={tds > 0 ? `${formatNumberLocale(tds, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : "-"}
        />
        <MetricRow
          label={t(dict, "tools.extraction.page.dissolvedSolidsLabel")}
          value={solids > 0 ? `${formatNumberLocale(solids, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} g` : "-"}
        />
        <MetricRow label={t(dict, "tools.extraction.page.brewRatioLabel")} value={ratio > 0 ? formatRatioLocale(ratio, locale) : "-"} />
        <MetricRow
          label={estimated ? t(dict, "tools.extraction.page.beverageEstLabel") : t(dict, "tools.extraction.page.beverageWeightRowLabel")}
          value={beverage > 0 ? `${beverage.toFixed(0)} g` : "-"}
        />
        <MetricRow label={t(dict, "tools.extraction.page.waterRetainedLabel")} value={retained > 0 ? `${retained.toFixed(0)} g` : "-"} last />
      </View>
    </ToolPage>
  );
}

// One label : value line in the derived-metrics card. `last` drops the hairline divider so
// the card doesn't end on a stray rule.
function MetricRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metricRow, !last && styles.metricRowDivider]}>
      <AppText variant="bodyMd" style={styles.metricLabel}>{label}</AppText>
      <AppText variant="bodyLg" style={styles.metricValue}>{value}</AppText>
    </View>
  );
}

export const extractionTool: ToolModule = {
  meta: { id: "extraction", icon: ExtractionGlyph, comingSoon: true },
  Screen: ExtractionScreen,
};

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: 10 },
  inputsLabel: { marginTop: 4 },

  // Segmented cup-weight source control (mirrors the ratio tool's "solve for" segment)
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.full,
    padding: 4,
    marginBottom: spacing.section,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  segmentItemActive: { backgroundColor: colors.surfaceLowest, ...shadows.card },
  segmentText: { color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.primary },

  // Hero
  hero: {
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: spacing.stack,
    ...shadows.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  heroGlyph: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: { color: colors.secondary },
  heroValueRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
  heroValue: {
    fontFamily: fonts.display,
    fontSize: 76,
    lineHeight: 82,
    letterSpacing: -2,
    includeFontPadding: false,
  },
  heroUnit: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    marginLeft: 4,
    marginTop: 10,
    includeFontPadding: false,
  },

  verdictChip: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  verdictText: {},
  verdictNote: {
    marginTop: 12,
    textAlign: "center",
    color: colors.onSurfaceVariant,
    paddingHorizontal: 8,
  },

  // Band meter
  meter: { width: "100%", marginTop: 20 },
  meterTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: "center",
  },
  meterIdeal: {
    position: "absolute",
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.outlineVariant,
  },
  meterMarker: {
    position: "absolute",
    width: 4,
    height: 18,
    borderRadius: 2,
    marginLeft: -2,
    top: -5,
  },
  meterScale: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  meterTick: { color: colors.outline },
  meterTickIdeal: { color: colors.secondary },

  // Estimate banner
  estBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.base,
    padding: 14,
    marginBottom: spacing.stack,
  },
  estDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.tertiary,
    marginTop: 6,
  },
  estText: { flex: 1, color: colors.onSurfaceVariant },

  // Derived metrics card
  metricsCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.base,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  metricRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  metricLabel: { color: colors.onSurfaceVariant },
  metricValue: { color: colors.onSurface },
});
