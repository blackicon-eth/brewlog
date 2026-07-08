import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText, TextField } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ToolModule } from "../types";
import { colors, fonts, radii, shadows, spacing } from "../../../design/tokens";
import { formatRatio } from "../../../lib/ratio";
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
import { ExtractionGlyph } from "./ExtractionGlyph";

// How the beverage weight is known: measured on a scale (exact) vs estimated from the water
// poured (approximate). The estimate path is the one place water weight is allowed in — and
// only to derive beverage weight, never straight into EY (that shortcut is refuted).
type BevSource = "measured" | "estimate";

const BEV_OPTIONS: { key: BevSource; label: string }[] = [
  { key: "measured", label: "Weighed cup" },
  { key: "estimate", label: "Estimate" },
];

// Per-band presentation: the hero number's color, the verdict chip's tone, and its copy.
// In-band reads calm action-blue; out-of-band reads coffee-cherry (the app's alert accent).
const BANDS: Record<EyBand, { tint: string; verdict: string; note: string }> = {
  under: { tint: colors.tertiary, verdict: "Under-extracted", note: "Sour · under-developed. Grind finer or extend contact." },
  ideal: { tint: colors.primary, verdict: "Balanced", note: "Sweet spot. Clarity and sweetness in balance." },
  over: { tint: colors.tertiary, verdict: "Over-extracted", note: "Bitter · drying. Grind coarser or shorten contact." },
};

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
  const face = BANDS[b];

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
    <ToolPage title="Extraction Yield" subtitle="Refractometer → extraction %">
      {/* Beverage-weight source */}
      <AppText variant="labelMd" style={styles.sectionLabel}>Cup weight</AppText>
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
            {estimated ? "Extraction · est." : "Extraction yield"}
          </AppText>
        </View>

        <View style={styles.heroValueRow}>
          <AppText style={[styles.heroValue, { color: ready ? face.tint : colors.outline }]}>
            {ready ? ey.toFixed(1) : "—"}
          </AppText>
          <AppText style={[styles.heroUnit, { color: ready ? face.tint : colors.outline }]}>%</AppText>
        </View>

        {/* Verdict chip */}
        <View style={[styles.verdictChip, { backgroundColor: ready ? face.tint : colors.surfaceContainer }]}>
          <AppText variant="labelSm" style={[styles.verdictText, { color: ready ? colors.onPrimary : colors.secondary }]}>
            {ready ? face.verdict : "Enter a reading"}
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
            <AppText variant="labelSm" style={styles.meterTick}>14</AppText>
            <AppText variant="labelSm" style={styles.meterTickIdeal}>18–22 ideal</AppText>
            <AppText variant="labelSm" style={styles.meterTick}>26</AppText>
          </View>
        </View>
      </View>

      {estimated ? (
        <View style={styles.estBanner}>
          <View style={styles.estDot} />
          <AppText variant="bodyMd" style={styles.estText}>
            Approximate — beverage weight estimated as water − dose × {DEFAULT_LRR.toFixed(1)} g/g absorbed
            {beverage > 0 ? ` ≈ ${beverage.toFixed(0)} g in the cup.` : "."} Weigh the cup for an exact yield.
          </AppText>
        </View>
      ) : null}

      {/* Inputs */}
      <AppText variant="labelMd" style={[styles.sectionLabel, styles.inputsLabel]}>Measurements</AppText>

      <TextField
        label="Dose (dry coffee)"
        value={doseText}
        onChangeText={setDoseText}
        placeholder="18"
        required
        keyboardType="decimal-pad"
      />

      <TextField
        label="TDS % (refractometer)"
        value={tdsText}
        onChangeText={setTdsText}
        placeholder="1.35"
        required
        keyboardType="decimal-pad"
      />

      {estimated ? (
        <TextField
          label="Water poured"
          value={waterText}
          onChangeText={setWaterText}
          placeholder="300"
          required
          keyboardType="decimal-pad"
        />
      ) : (
        <>
          <TextField
            label="Beverage weight (in the cup)"
            value={beverageText}
            onChangeText={setBeverageText}
            placeholder="264"
            required
            keyboardType="decimal-pad"
          />
          <TextField
            label="Water poured (optional — for ratio)"
            value={waterText}
            onChangeText={setWaterText}
            placeholder="300"
            keyboardType="decimal-pad"
          />
        </>
      )}

      {/* Derived metrics */}
      <AppText variant="labelMd" style={[styles.sectionLabel, styles.inputsLabel]}>Derived</AppText>
      <View style={styles.metricsCard}>
        <MetricRow label="Strength (TDS)" value={tds > 0 ? `${tds.toFixed(2)} %` : "—"} />
        <MetricRow label="Dissolved solids" value={solids > 0 ? `${solids.toFixed(2)} g` : "—"} />
        <MetricRow label="Brew ratio" value={ratio > 0 ? formatRatio(ratio) : "—"} />
        <MetricRow
          label={estimated ? "Beverage (est.)" : "Beverage weight"}
          value={beverage > 0 ? `${beverage.toFixed(0)} g` : "—"}
        />
        <MetricRow label="Water retained" value={retained > 0 ? `${retained.toFixed(0)} g` : "—"} last />
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
  meta: { id: "extraction", title: "Extraction Yield", blurb: "TDS → extraction yield", icon: ExtractionGlyph, comingSoon: true },
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
