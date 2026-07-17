import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, TextField } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ToolModule } from "../types";
import { colors, fonts, radii } from "../../../design/tokens";
import {
  classify,
  plotPos,
  targetRect,
  DEFAULT_RANGES,
  DEFAULT_POINT,
  TARGET,
} from "../../../lib/coffeeCompass";
import { useI18n } from "../../../i18n/LocaleProvider";
import { t } from "../../../lib/i18n/t";
import { toolTitle, compassCellText } from "../../../lib/i18n/labels";
import { CompassRoseIcon } from "./CompassRoseIcon";

const RANGES = DEFAULT_RANGES;

// EY tick marks (x axis) and TDS tick marks (y axis) spanning the plot range.
const EY_TICKS = [12, 16, 20, 24, 28];
const TDS_TICKS = [1.6, 1.4, 1.2, 1.0]; // top → bottom (strength decreases downward)

// Parse a user-typed number, tolerating a trailing "." mid-typing and stray "%".
function parseNum(raw: string): number | null {
  const cleaned = raw.replace(/%/g, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function CompassScreen() {
  const { dict } = useI18n();
  const [eyText, setEyText] = usePersistedState("tool:compass:ey", String(DEFAULT_POINT.ey));
  const [tdsText, setTdsText] = usePersistedState("tool:compass:tds", String(DEFAULT_POINT.tds));
  // Measured inner-plot size, so the dot maps precisely on any device (S23 included).
  const [plot, setPlot] = useState(0);

  const ey = parseNum(eyText);
  const tds = parseNum(tdsText);
  const hasBoth = ey != null && tds != null;

  const verdict = hasBoth ? classify(ey, tds) : null;
  const verdictText = verdict ? compassCellText(dict, verdict.exAxis, verdict.strAxis) : null;
  // Off-target readings are accented cherry; a dialed-in reading glows action-blue.
  const accent = verdict?.ideal ? colors.primary : verdict ? colors.tertiary : colors.outline;

  const dot = useMemo(
    () => (hasBoth ? plotPos(ey, tds, RANGES) : null),
    [hasBoth, ey, tds],
  );
  const box = useMemo(() => targetRect(RANGES), []);

  return (
    <ToolPage title={toolTitle(dict, "compass")} subtitle={t(dict, "tools.compass.page.subtitle")}>
      {/* ── The chart: the crafted centrepiece ─────────────────────────────── */}
      <View style={styles.chartBlock}>
        {/* Y-axis caption, rotated up the left edge. */}
        <View style={styles.yAxisLabel} pointerEvents="none">
          <AppText variant="labelSm" style={styles.axisCaption}>
            {t(dict, "tools.compass.page.strengthAxisCaption")}
          </AppText>
        </View>

        <View style={styles.chartRight}>
          {/* Plot square. onLayout feeds the measured size to the dot math. */}
          <View
            style={styles.plot}
            onLayout={(e) => setPlot(e.nativeEvent.layout.width)}
          >
            {/* Grid ticks — hairline guides at each tick fraction. */}
            {EY_TICKS.map((tick) => {
              const f = (tick - RANGES.ey.min) / (RANGES.ey.max - RANGES.ey.min);
              return <View key={`vx${tick}`} style={[styles.gridV, { left: `${f * 100}%` }]} />;
            })}
            {TDS_TICKS.map((tick) => {
              const f = 1 - (tick - RANGES.tds.min) / (RANGES.tds.max - RANGES.tds.min);
              return <View key={`hz${tick}`} style={[styles.gridH, { top: `${f * 100}%` }]} />;
            })}

            {/* Target box — the calm-blue "zone of deliciousness". */}
            <View
              pointerEvents="none"
              style={[
                styles.target,
                {
                  left: `${box.left * 100}%`,
                  right: `${(1 - box.right) * 100}%`,
                  top: `${box.top * 100}%`,
                  bottom: `${(1 - box.bottom) * 100}%`,
                },
              ]}
            >
              <AppText variant="labelSm" style={styles.targetTag}>
                {t(dict, "tools.compass.page.idealTag")}
              </AppText>
            </View>

            {/* Plotted reading — a ringed compass marker, positioned from the measured plot. */}
            {dot && plot > 0 && (
              <View
                pointerEvents="none"
                style={[
                  styles.dotWrap,
                  {
                    left: dot.x * plot - DOT / 2,
                    top: dot.y * plot - DOT / 2,
                  },
                ]}
              >
                <View style={[styles.dotRing, { borderColor: accent }]} />
                <View style={[styles.dotCore, { backgroundColor: accent }]} />
              </View>
            )}
          </View>

          {/* X-axis ticks + caption. */}
          <View style={styles.xTicks}>
            {EY_TICKS.map((tick) => (
              <AppText key={`xt${tick}`} variant="labelSm" style={styles.tickText}>
                {tick}
              </AppText>
            ))}
          </View>
          <AppText variant="labelSm" style={[styles.axisCaption, styles.xCaption]}>
            {t(dict, "tools.compass.page.extractionAxisCaption")}
          </AppText>
        </View>
      </View>

      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <View style={styles.inputs}>
        <View style={styles.inputCol}>
          <TextField
            label={t(dict, "tools.compass.page.extractionFieldLabel")}
            value={eyText}
            onChangeText={setEyText}
            keyboardType="decimal-pad"
            placeholder="20"
          />
        </View>
        <View style={styles.inputCol}>
          <TextField
            label={t(dict, "tools.compass.page.strengthFieldLabel")}
            value={tdsText}
            onChangeText={setTdsText}
            keyboardType="decimal-pad"
            placeholder="1.25"
          />
        </View>
      </View>

      {/* ── Verdict ─────────────────────────────────────────────────────────── */}
      {verdict && verdictText ? (
        <View style={[styles.verdict, { borderColor: accent }]}>
          <View style={[styles.verdictBar, { backgroundColor: accent }]} />
          <View style={styles.verdictBody}>
            <AppText variant="labelSm" style={{ color: accent }}>
              {t(dict, verdict.ideal ? "tools.compass.page.onTarget" : "tools.compass.page.offTarget")}
            </AppText>
            <AppText variant="headlineMd" style={styles.verdictTitle}>
              {verdictText.title}
            </AppText>
            <AppText variant="bodyMd" style={styles.verdictAdvice}>
              {verdictText.advice}
            </AppText>
          </View>
        </View>
      ) : (
        <View style={styles.emptyHint}>
          <AppText variant="bodyMd">
            {t(dict, "tools.compass.page.emptyHint")}
          </AppText>
        </View>
      )}

      {/* ── Legend / model note ─────────────────────────────────────────────── */}
      <View style={styles.legend}>
        <AppText variant="labelSm" style={styles.legendKicker}>
          {t(dict, "tools.compass.page.legendKicker")}
        </AppText>
        <AppText variant="bodyMd" style={styles.legendLine}>
          {t(dict, "tools.compass.page.legendPart1")}
          <AppText variant="bodyMd" style={styles.em}>{t(dict, "tools.compass.page.legendExtractionWord")}</AppText>
          {t(dict, "tools.compass.page.legendPart2")}
          <AppText variant="bodyMd" style={styles.em}>{t(dict, "tools.compass.page.legendStrengthWord")}</AppText>
          {t(dict, "tools.compass.page.legendPart3", {
            eyMin: TARGET.ey.min,
            eyMax: TARGET.ey.max,
            tdsMin: TARGET.tds.min,
            tdsMax: TARGET.tds.max,
          })}
        </AppText>
      </View>
    </ToolPage>
  );
}

const DOT = 26; // plotted marker diameter

export const compassTool: ToolModule = {
  meta: { id: "compass", icon: CompassRoseIcon, comingSoon: true },
  Screen: CompassScreen,
};

// Left gutter reserved for the rotated Y caption so the plot stays a clean square.
const Y_GUTTER = 22;

const styles = StyleSheet.create({
  chartBlock: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 4,
  },
  yAxisLabel: {
    width: Y_GUTTER,
    alignItems: "center",
    justifyContent: "center",
  },
  axisCaption: {
    color: colors.secondary,
  },
  chartRight: { flex: 1 },

  // The plot: a bordered near-square instrument panel on the warm surfaceLow canvas.
  plot: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1.5,
    borderColor: colors.onSurface,
    borderRadius: radii.sm,
    overflow: "hidden",
  },

  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },

  // "Zone of deliciousness" — a calm action-blue tint with a dashed frame.
  target: {
    position: "absolute",
    backgroundColor: "rgba(0, 74, 198, 0.10)",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: 2,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  targetTag: {
    color: colors.primary,
    fontSize: 9,
    letterSpacing: 1,
    margin: 4,
  },

  // Plotted reading — an accented core inside a translucent ring, like a compass needle head.
  dotWrap: {
    position: "absolute",
    width: DOT,
    height: DOT,
    alignItems: "center",
    justifyContent: "center",
  },
  dotRing: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    opacity: 0.35,
  },
  dotCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surfaceLowest,
  },

  xTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    // Ticks label their gridlines; nudge so the first/last sit under their lines.
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  tickText: { color: colors.secondary, fontSize: 10 },
  xCaption: { textAlign: "center", marginTop: 4 },

  inputs: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  inputCol: { flex: 1 },

  verdict: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderRadius: radii.base,
    overflow: "hidden",
    marginTop: 4,
  },
  verdictBar: { width: 5 },
  verdictBody: { flex: 1, padding: 16 },
  verdictTitle: {
    marginTop: 4,
    // EB Garamond descenders clip on Android — give headlineMd explicit room.
    lineHeight: 34,
    includeFontPadding: false,
  },
  verdictAdvice: { marginTop: 8, color: colors.onSurfaceVariant },

  emptyHint: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
    marginTop: 4,
  },

  legend: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  legendKicker: { color: colors.secondary, marginBottom: 8 },
  legendLine: { color: colors.onSurfaceVariant },
  em: { fontFamily: fonts.sansSemiBold, color: colors.onSurface },
});
