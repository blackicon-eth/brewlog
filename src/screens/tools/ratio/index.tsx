import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ToolModule } from "../types";
import { colors, fonts, motion, radii, shadows, spacing } from "../../../design/tokens";
import { computeRatio, solveDose, solveWater } from "../../../lib/ratio";
import { formatRatioLocale, formatNumberLocale } from "../../../lib/i18n/format";
import { useI18n } from "../../../i18n/LocaleProvider";
import { t } from "../../../lib/i18n/t";
import { toolTitle } from "../../../lib/i18n/labels";
import type { Dict } from "../../../lib/i18n/en";
import { RatioGlyph } from "./RatioGlyph";

type SolveFor = "water" | "dose" | "ratio";

// Localized label for each solved variable — shared by the segment control and the hero
// readout so both read from one source instead of duplicating the ternary.
function solveLabel(dict: Dict, key: SolveFor): string {
  if (key === "water") return t(dict, "tools.ratio.page.solveWater");
  if (key === "dose") return t(dict, "tools.ratio.page.solveDose");
  return t(dict, "tools.ratio.page.solveRatio");
}

const SOLVE_KEYS: SolveFor[] = ["water", "dose", "ratio"];

const DEFAULT_DOSE = "18";
const DEFAULT_WATER = "300";
const DEFAULT_RATIO = "16.67";

// Parses a decimal-pad string to a finite positive number, else 0. Guards the NaN/Infinity
// that would otherwise leak from an empty field or a stray "." while the user is typing.
function toNumber(text: string): number {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Brew Ratio / Water Calculator — the "science bench" tool. The brewer locks whichever two
// of {dose, water, ratio} they already know and this solves the third live, with the solved
// value as the page's hero (large serif readout) and the full recipe underneath.
function RatioScreen() {
  const { dict, locale } = useI18n();
  const [solveFor, setSolveFor] = usePersistedState<SolveFor>("tool:ratio:solveFor", "water");
  const [doseText, setDoseText] = usePersistedState("tool:ratio:dose", DEFAULT_DOSE);
  const [waterText, setWaterText] = usePersistedState("tool:ratio:water", DEFAULT_WATER);
  const [ratioText, setRatioText] = usePersistedState("tool:ratio:ratio", DEFAULT_RATIO);

  // Sliding pill under the segment labels: one Animated index eased with a soft spring, so
  // switching modes reads as the same pill gliding rather than two pills swapping.
  const [segmentW, setSegmentW] = useState(0);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const solveIndex = SOLVE_KEYS.indexOf(solveFor);
  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: solveIndex,
      ...motion.springGlide,
      useNativeDriver: true,
    }).start();
  }, [solveIndex, pillAnim]);
  const pillW = segmentW > 0 ? (segmentW - 8) / SOLVE_KEYS.length : 0;

  const doseIn = toNumber(doseText);
  const waterIn = toNumber(waterText);
  const ratioIn = toNumber(ratioText);

  // The solved value + the full trio used for the recipe strip, recomputed from whichever
  // two fields are live inputs for the current mode.
  const { dose, water, ratio } = useMemo(() => {
    if (solveFor === "water") {
      const w = solveWater(doseIn, ratioIn);
      return { dose: doseIn, water: w, ratio: ratioIn };
    }
    if (solveFor === "dose") {
      const d = solveDose(waterIn, ratioIn);
      return { dose: d, water: waterIn, ratio: ratioIn };
    }
    const r = computeRatio(doseIn, waterIn);
    return { dose: doseIn, water: waterIn, ratio: r };
  }, [solveFor, doseIn, waterIn, ratioIn]);

  const heroValue = solveFor === "water" ? water : solveFor === "dose" ? dose : ratio;
  const heroUnit = solveFor === "ratio" ? "" : "g";
  const heroLabel = solveLabel(dict, solveFor);
  const heroText = solveFor === "ratio"
    ? formatRatioLocale(heroValue, locale)
    : heroValue > 0
      ? formatNumberLocale(heroValue, locale, {
          minimumFractionDigits: solveFor === "dose" ? 1 : 0,
          maximumFractionDigits: solveFor === "dose" ? 1 : 0,
        })
      : "-";

  const recipeReady = dose > 0 && water > 0 && ratio > 0;

  // Switching which variable is solved must not change the numbers on screen: the value the
  // outgoing solved field is showing gets written back into its editable text, so the trio
  // carries over and the math continues from exactly what the user sees.
  function changeSolveFor(next: SolveFor) {
    if (next === solveFor) return;
    if (solveFor === "water" && water > 0) setWaterText(water.toFixed(0));
    else if (solveFor === "dose" && dose > 0) setDoseText(dose.toFixed(1));
    else if (solveFor === "ratio" && ratio > 0) setRatioText(ratio.toFixed(2).replace(/\.?0+$/, ""));
    setSolveFor(next);
  }

  return (
    <ToolPage title={toolTitle(dict, "ratio")} subtitle={t(dict, "tools.ratio.page.subtitle")}>
      {/* Solve-for selector */}
      <AppText variant="labelMd" style={styles.sectionLabel}>{t(dict, "tools.ratio.page.solveForLabel")}</AppText>
      <View style={styles.segment} onLayout={(e) => setSegmentW(e.nativeEvent.layout.width)}>
        {pillW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentPill,
              { width: pillW, transform: [{ translateX: Animated.multiply(pillAnim, pillW) }] },
            ]}
          />
        ) : null}
        {SOLVE_KEYS.map((key) => {
          const active = solveFor === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => changeSolveFor(key)}
              style={styles.segmentItem}
            >
              <AppText variant="labelMd" style={active ? styles.segmentTextActive : styles.segmentText}>
                {solveLabel(dict, key)}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Hero readout — the solved value, large serif */}
      <View style={styles.hero}>
        <AppText variant="labelSm" style={styles.heroLabel}>{t(dict, "tools.ratio.page.heroSolved", { label: heroLabel })}</AppText>
        <View style={styles.heroValueRow}>
          <AppText style={styles.heroValue}>{heroText}</AppText>
          {heroUnit ? <AppText style={styles.heroUnit}>{heroUnit}</AppText> : null}
        </View>
        <View style={styles.recipeStrip}>
          <AppText variant="bodyMd" style={styles.recipeText}>
            {recipeReady
              ? `${formatNumberLocale(dose, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g : ${formatNumberLocale(water, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`
              : t(dict, "tools.ratio.page.enterValues")}
          </AppText>
          <View style={styles.recipeDot} />
          <AppText variant="bodyMd" style={styles.recipeText}>
            {recipeReady ? formatRatioLocale(ratio, locale) : "-"}
          </AppText>
        </View>
      </View>

      {/* Inputs — whichever two are not being solved. Dose and water share one row. */}
      <AppText variant="labelMd" style={styles.sectionLabel}>{t(dict, "tools.ratio.page.knownValuesLabel")}</AppText>
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <RatioField
            label={t(dict, "tools.ratio.page.doseFieldLabel")}
            solved={solveFor === "dose"}
            text={doseText}
            onChangeText={setDoseText}
            solvedValue={dose > 0 ? formatNumberLocale(dose, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"}
            placeholder="18"
          />
        </View>

        <View style={styles.fieldHalf}>
          <RatioField
            label={t(dict, "tools.ratio.page.waterFieldLabel")}
            solved={solveFor === "water"}
            text={waterText}
            onChangeText={setWaterText}
            solvedValue={water > 0 ? formatNumberLocale(water, locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-"}
            placeholder="300"
          />
        </View>
      </View>

      <RatioField
        label={t(dict, "tools.ratio.page.ratioFieldLabel")}
        solved={solveFor === "ratio"}
        text={ratioText}
        onChangeText={setRatioText}
        solvedValue={ratio > 0 ? formatNumberLocale(ratio, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
        placeholder="16.67"
      />
    </ToolPage>
  );
}

type RatioFieldProps = {
  label: string;
  solved: boolean;       // true when this variable is the one being solved (read-only)
  text: string;          // the user's editable text
  onChangeText: (t: string) => void;
  solvedValue: string;   // formatted output shown while solved, e.g. "300 g" / "1:16.7"
  placeholder: string;
};

// One field for both states of a ratio variable. Instead of swapping TextField for a locked
// row, the same box stays mounted and its surface fades between "paper input" (cream +
// hairline) and "solved slate" (container tone, borderless), with the Solved tag fading in.
// Same metrics as the shared TextField (16/22 text, 12px vertical padding, 1px border = 48px).
function RatioField({ label, solved, text, onChangeText, solvedValue, placeholder }: RatioFieldProps) {
  const { dict } = useI18n();
  const anim = useRef(new Animated.Value(solved ? 1 : 0)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: solved ? 1 : 0,
      duration: motion.quick,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // animating colors
    }).start();
  }, [solved, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceLowest, colors.surfaceContainer],
  });
  // The border melts into the solved surface rather than popping off.
  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outlineVariant, colors.surfaceContainer],
  });

  return (
    <View style={styles.fieldWrap}>
      <AppText variant="labelMd">{label}</AppText>
      <Animated.View
        style={[
          styles.fieldBox,
          { backgroundColor, borderColor: focused && !solved ? colors.primary : borderColor },
        ]}
      >
        <TextInput
          style={styles.fieldInput}
          value={solved ? solvedValue : text}
          onChangeText={onChangeText}
          editable={!solved}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Animated.View style={[styles.fieldTagWrap, { opacity: anim }]} pointerEvents="none">
          <AppText variant="labelSm" style={styles.fieldTag}>{t(dict, "tools.ratio.page.solvedTag")}</AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export const ratioTool: ToolModule = {
  meta: { id: "ratio", icon: RatioGlyph },
  Screen: RatioScreen,
};

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: 10 },

  // Segmented "solve for" control
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
  // The one pill that glides beneath whichever label is active.
  segmentPill: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceLowest,
    ...shadows.card,
  },
  segmentText: { color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.primary },

  // Hero
  hero: {
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: spacing.section,
    ...shadows.card,
  },
  heroLabel: { color: colors.secondary },
  heroValueRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  heroValue: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 72,
    letterSpacing: -1,
    color: colors.onSurface,
    includeFontPadding: false,
  },
  heroUnit: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.onSurfaceVariant,
    marginLeft: 6,
    marginBottom: 6,
  },
  recipeStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    width: "100%",
    justifyContent: "center",
    gap: 10,
  },
  recipeText: { color: colors.onSurface },
  recipeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.outline },

  // Dose + water side by side; each half owns its own field spacing.
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldHalf: { flex: 1 },

  // Ratio field — same metrics as the shared TextField in both states (48px box). The
  // input owns the entire box (padding included) so every tap inside the border focuses it;
  // the Solved tag floats on top and never steals space or touches.
  fieldWrap: { gap: 8, marginBottom: spacing.stack },
  fieldBox: {
    borderWidth: 1,
    borderRadius: radii.base,
  },
  fieldInput: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onSurface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fieldTagWrap: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  fieldTag: { color: colors.primary },
});
