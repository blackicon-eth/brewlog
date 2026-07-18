import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../navigation/types";
import { AppText, PillButton, TextField } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { COMPASS_EY_KEY, COMPASS_TDS_KEY } from "../compass";
import type { ToolModule } from "../types";
import { colors, fonts, radii, shadows, spacing } from "../../../design/tokens";
import { formatRatioLocale, formatNumberLocale } from "../../../lib/i18n/format";
import {
  extractionYield,
  band,
  dissolvedSolidsG,
  waterRetainedG,
  EY_IDEAL_MIN,
  EY_IDEAL_MAX,
  type EyBand,
} from "../../../lib/extraction";
import { useI18n } from "../../../i18n/LocaleProvider";
import { t } from "../../../lib/i18n/t";
import { toolTitle, extractionBandText } from "../../../lib/i18n/labels";
import type { Dict } from "../../../lib/i18n/en";
import { ExtractionGlyph } from "./ExtractionGlyph";

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
// reading, and the weighed cup, and the page turns that into an extraction-yield %: the hero
// number, color-banded and captioned with a taste verdict, over a strip of the derived
// numbers (strength, ratio, dissolved solids, water retained). Anyone with a refractometer
// has a scale, so the cup is always weighed — no estimate-from-water path.
function ExtractionScreen() {
  const { dict, locale } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, "Tool">>();
  const [doseText, setDoseText] = usePersistedState("tool:extraction:dose", "18");
  const [tdsText, setTdsText] = usePersistedState("tool:extraction:tds", "1.35");
  const [beverageText, setBeverageText] = usePersistedState("tool:extraction:beverage", "264");
  const [waterText, setWaterText] = usePersistedState("tool:extraction:water", "300");

  const dose = toNumber(doseText);
  const tds = toNumber(tdsText);
  const beverage = toNumber(beverageText);
  const water = toNumber(waterText);

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
      {/* Hero — the EY %, banded */}
      <View style={styles.hero}>
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

      {/* Inputs */}
      <View style={styles.inputsRow}>
        <TextField
          label={t(dict, "tools.extraction.page.doseFieldLabel")}
          value={doseText}
          onChangeText={setDoseText}
          placeholder="18"
          required
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
        <TextField
          label={t(dict, "tools.extraction.page.tdsFieldLabel")}
          value={tdsText}
          onChangeText={setTdsText}
          placeholder="1.35"
          required
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
      </View>
      <View style={styles.inputsRow}>
        <TextField
          label={t(dict, "tools.extraction.page.beverageWeightFieldLabel")}
          value={beverageText}
          onChangeText={setBeverageText}
          placeholder="264"
          required
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
        <TextField
          label={t(dict, "tools.extraction.page.waterPouredOptionalLabel")}
          value={waterText}
          onChangeText={setWaterText}
          placeholder="300"
          keyboardType="decimal-pad"
          style={styles.inputHalf}
        />
      </View>

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
          label={t(dict, "tools.extraction.page.beverageWeightRowLabel")}
          value={beverage > 0 ? `${beverage.toFixed(0)} g` : "-"}
        />
        <MetricRow label={t(dict, "tools.extraction.page.waterRetainedLabel")} value={retained > 0 ? `${retained.toFixed(0)} g` : "-"} last />
      </View>

      {/* Hand the reading to the Coffee Compass. Writes the compass's persisted inputs
          synchronously (dot decimals, the format its parser reads), then pushes the
          compass page so back returns here. */}
      {ready ? (
        <PillButton
          label={t(dict, "tools.extraction.page.openCompass")}
          style={styles.compassButton}
          onPress={() => {
            try {
              Storage.setItemSync(COMPASS_EY_KEY, JSON.stringify((Math.round(ey * 10) / 10).toString()));
              Storage.setItemSync(COMPASS_TDS_KEY, JSON.stringify(tds.toString()));
            } catch {
              // A failed write only means the compass keeps its previous inputs.
            }
            nav.push("Tool", { toolId: "compass" });
          }}
        />
      ) : null}
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
  meta: { id: "extraction", icon: ExtractionGlyph },
  Screen: ExtractionScreen,
};

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: 10 },
  inputsLabel: { marginTop: 4 },
  compassButton: { marginTop: spacing.stack },
  inputsRow: { flexDirection: "row", gap: spacing.gutter },
  inputHalf: { flex: 1 },

  // Hero
  hero: {
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    marginBottom: spacing.stack,
    ...shadows.card,
  },
  heroValueRow: { flexDirection: "row", alignItems: "flex-start" },
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
