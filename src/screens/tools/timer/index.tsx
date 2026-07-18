import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View, Vibration } from "react-native";
import { AppText } from "../../../components/ui";
import { ToolPage } from "../ToolPage";
import type { ToolModule } from "../types";
import { colors, fonts, motion, radii } from "../../../design/tokens";
import { formatSeconds } from "../../../lib/brewFormat";
import {
  buildPourSchedule,
  estimateFinishSeconds,
  type PourSchedule,
  type PourStep,
} from "../../../lib/pourSchedule";
import { TimerGlyph } from "./TimerGlyph";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { Stepper } from "./Stepper";
import { useStopwatch } from "./useStopwatch";
import { useI18n } from "../../../i18n/LocaleProvider";
import { t } from "../../../lib/i18n/t";
import { toolTitle, toolBlurb } from "../../../lib/i18n/labels";
import type { Dict } from "../../../lib/i18n/en";

// ---- Setup bounds / defaults (from the tool spec) -------------------------------------
const BLOOM_G = { min: 20, max: 150, step: 1, default: 30 };
const BLOOM_T = { min: 15, max: 120, step: 1, default: 45 };
const TOTAL = { min: 150, max: 1000, step: 1, default: 250 };
const POURS = { min: 1, max: 5, step: 1, default: 2 };
const INTERVAL = { min: 10, max: 60, step: 1, default: 45 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Localizes a schedule step to its instruction label. The lib only carries the step's kind
// + 1-based pour number (locale-free); a lone main pour reads as plain "Pour", while two or
// more read as "Pour {n}" — mainPoursCount tells us which phrasing applies.
function stepLabel(dict: Dict, step: PourStep, mainPoursCount: number): string {
  if (step.kind === "bloom") return t(dict, "tools.timer.page.stepBloom");
  if (mainPoursCount === 1) return t(dict, "tools.timer.page.stepPourSingle");
  return t(dict, "tools.timer.page.stepPourN", { n: step.pourNumber ?? 0 });
}

// A short double-buzz cue at each pour boundary. `Vibration` is React Native core (no new
// dep); it silently no-ops on platforms/simulators without a motor, and we guard the call so
// a missing API never throws. Kept brief so it nudges rather than alarms.
function pulse() {
  try {
    if (Platform.OS === "web") return;
    Vibration.vibrate(Platform.OS === "android" ? [0, 55, 90, 55] : 55);
  } catch {
    // no vibration hardware / unsupported platform — the visual flash still fires.
  }
}

function TimerScreen() {
  const { dict } = useI18n();
  // Setup state (numeric, bounded). Bloom is set directly in grams; total water is explicit.
  const [bloomG, setBloomG] = usePersistedState("tool:timer:bloomG", BLOOM_G.default);
  const [bloomTimeS, setBloomTimeS] = usePersistedState("tool:timer:bloomTimeS", BLOOM_T.default);
  const [totalG, setTotalG] = usePersistedState("tool:timer:totalG", TOTAL.default);
  const [mainPours, setMainPours] = usePersistedState("tool:timer:mainPours", POURS.default);
  const [pourIntervalS, setPourIntervalS] = usePersistedState("tool:timer:pourIntervalS", INTERVAL.default);

  // Built once per input change; the steppers keep bloom < total, so this never throws in
  // practice. doseG×bloomMultiplier is the lib's bloom target, so dose=bloomG with a 1×
  // multiplier sets the bloom weight directly.
  const schedule = useMemo<PourSchedule>(
    () =>
      buildPourSchedule({
        doseG: bloomG,
        bloomMultiplier: 1,
        bloomTimeS,
        totalWaterG: totalG,
        mainPours,
        pourIntervalS,
      }),
    [bloomG, bloomTimeS, totalG, mainPours, pourIntervalS]
  );

  const sw = useStopwatch();
  const running = sw.status === "running";
  const paused = sw.status === "paused";
  const live = running || paused; // timer view is showing (armed or stopped mid-run)

  // Snapshot of what the live view shows, refreshed every render while live. After a reset
  // the stopwatch is instantly idle, but the live view is still on screen for the fade-out —
  // rendering it from this frozen snapshot stops the clock flashing 0:00 / "Paused".
  const liveSnap = useRef({ elapsedS: 0, activeIndex: 0, running: false });

  // Setup ↔ live transition: fade the outgoing view down, swap, fade the incoming view up.
  // `shownLive` is what's actually rendered; it trails `live` by the fade-out. `viewFading`
  // gates the animated styles: attaching them only while the fade runs keeps the wrapper a
  // plain View the rest of the time, so the stopwatch's constant re-renders can't make the
  // animated layer flicker.
  const [shownLive, setShownLive] = useState(false);
  const [viewFading, setViewFading] = useState(false);
  const viewAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (live === shownLive) return;
    setViewFading(true);
    // JS driver: the stopwatch re-renders this subtree mid-fade, and on Fabric a re-render
    // snaps natively-driven views back to their JS-side style (visible flicker).
    Animated.timing(viewAnim, {
      toValue: 0,
      duration: motion.fast,
      easing: Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      setShownLive(live);
      Animated.timing(viewAnim, {
        toValue: 1,
        duration: motion.standard,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => setViewFading(false));
    });
  }, [live, shownLive, viewAnim]);

  // Index of the current active step: the last step whose start time we've crossed.
  const activeIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < schedule.steps.length; i++) {
      if (sw.elapsedS >= schedule.steps[i].atSeconds) idx = i;
    }
    return idx;
  }, [schedule.steps, sw.elapsedS]);

  // Fire the boundary cue exactly once each time the active step advances while running.
  const prevActiveRef = useRef(activeIndex);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (running && activeIndex !== prevActiveRef.current) {
      pulse();
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 520);
      prevActiveRef.current = activeIndex;
      return () => clearTimeout(t);
    }
    prevActiveRef.current = activeIndex;
  }, [activeIndex, running]);

  const finishS = estimateFinishSeconds(schedule, pourIntervalS);

  if (live) liveSnap.current = { elapsedS: sw.elapsedS, activeIndex, running };

  function handleReset() {
    sw.reset();
    prevActiveRef.current = 0;
    setFlash(false);
  }

  return (
    <ToolPage title={toolTitle(dict, "timer")} subtitle={toolBlurb(dict, "timer")} scroll={false}>
      <Animated.View
        style={
          viewFading
            ? {
              flex: 1,
              opacity: viewAnim,
              transform: [{ translateY: viewAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            }
            : { flex: 1 }
        }
      >
        {shownLive ? (
          <LiveView
            dict={dict}
            schedule={schedule}
            elapsedS={liveSnap.current.elapsedS}
            activeIndex={liveSnap.current.activeIndex}
            running={liveSnap.current.running}
            flash={flash}
            onPause={sw.pause}
            onResume={sw.resume}
            onReset={handleReset}
          />
        ) : (
          <SetupView
            dict={dict}
            bloomG={bloomG}
            setBloomG={setBloomG}
            bloomTimeS={bloomTimeS}
            setBloomTimeS={setBloomTimeS}
            totalG={totalG}
            setTotalG={setTotalG}
            mainPours={mainPours}
            setMainPours={setMainPours}
            schedule={schedule}
            finishS={finishS}
            pourIntervalS={pourIntervalS}
            setPourIntervalS={setPourIntervalS}
            onStart={sw.start}
          />
        )}
      </Animated.View>
    </ToolPage>
  );
}

// ---- Setup view -----------------------------------------------------------------------

type SetupProps = {
  dict: Dict;
  bloomG: number;
  setBloomG: (v: number) => void;
  bloomTimeS: number;
  setBloomTimeS: (v: number) => void;
  totalG: number;
  setTotalG: (v: number) => void;
  mainPours: number;
  setMainPours: (v: number) => void;
  pourIntervalS: number;
  setPourIntervalS: (v: number) => void;
  schedule: PourSchedule;
  finishS: number;
  onStart: () => void;
};

// The summary card and steppers scroll; the start button stays pinned to the bottom so
// it's always one thumb-reach away regardless of how tall the pour plan grows.
function SetupView(p: SetupProps) {
  const { dict } = p;
  return (
    <View style={styles.setupWrap}>
      <ScrollView style={styles.setupScroll} contentContainerStyle={styles.setupScrollContent} showsVerticalScrollIndicator={false}>
        {/* Steppers — bloom amount and main pours share one row; the increment/decrement
          bounds also keep the bloom a strict prefix of the total (lib requirement). */}
        <View style={styles.stepperRow}>
          <View style={styles.stepperHalf}>
            <Stepper
              label={t(dict, "tools.timer.page.bloomAmountLabel")}
              display={`${p.bloomG} g`}
              canDecrement={p.bloomG > BLOOM_G.min}
              canIncrement={p.bloomG < BLOOM_G.max && p.bloomG + BLOOM_G.step < p.totalG}
              onDecrement={() => p.setBloomG(clamp(p.bloomG - BLOOM_G.step, BLOOM_G.min, BLOOM_G.max))}
              onIncrement={() => p.setBloomG(clamp(p.bloomG + BLOOM_G.step, BLOOM_G.min, BLOOM_G.max))}
            />
          </View>
          <View style={styles.stepperHalf}>
            <Stepper
              label={t(dict, "tools.timer.page.bloomTimeLabel")}
              display={`${p.bloomTimeS} s`}
              canDecrement={p.bloomTimeS > BLOOM_T.min}
              canIncrement={p.bloomTimeS < BLOOM_T.max}
              onDecrement={() => p.setBloomTimeS(clamp(p.bloomTimeS - BLOOM_T.step, BLOOM_T.min, BLOOM_T.max))}
              onIncrement={() => p.setBloomTimeS(clamp(p.bloomTimeS + BLOOM_T.step, BLOOM_T.min, BLOOM_T.max))}
            />
          </View>
        </View>
        <View style={styles.stepperRow}>
          <View style={styles.stepperHalf}>
            <Stepper
              label={t(dict, "tools.timer.page.mainPoursLabel")}
              hint={t(dict, "tools.timer.page.mainPoursHint", { g: p.schedule.perPour ? Math.round(p.schedule.mainWater / p.mainPours) : 0 })}
              display={`${p.mainPours}`}
              canDecrement={p.mainPours > POURS.min}
              canIncrement={p.mainPours < POURS.max}
              onDecrement={() => p.setMainPours(clamp(p.mainPours - POURS.step, POURS.min, POURS.max))}
              onIncrement={() => p.setMainPours(clamp(p.mainPours + POURS.step, POURS.min, POURS.max))}
            />
          </View>
          <View style={styles.stepperHalf}>
            <Stepper
              label={t(dict, "tools.timer.page.pourIntervalLabel")}
              display={`${p.pourIntervalS} s`}
              canDecrement={p.pourIntervalS > INTERVAL.min}
              canIncrement={p.pourIntervalS < INTERVAL.max}
              onDecrement={() => p.setPourIntervalS(clamp(p.pourIntervalS - INTERVAL.step, INTERVAL.min, INTERVAL.max))}
              onIncrement={() => p.setPourIntervalS(clamp(p.pourIntervalS + INTERVAL.step, INTERVAL.min, INTERVAL.max))}
            />
          </View>
        </View>
        <Stepper
          label={t(dict, "tools.timer.page.totalWaterLabel")}
          display={`${p.totalG} g`}
          canDecrement={p.totalG > TOTAL.min && p.totalG - TOTAL.step > p.bloomG}
          canIncrement={p.totalG < TOTAL.max}
          onDecrement={() => p.setTotalG(clamp(p.totalG - TOTAL.step, TOTAL.min, TOTAL.max))}
          onIncrement={() => p.setTotalG(clamp(p.totalG + TOTAL.step, TOTAL.min, TOTAL.max))}
        />

        {/* Recipe summary card — the schedule the steppers above drive. */}
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <View style={styles.summaryGlyph}>
              <TimerGlyph size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="labelSm" style={styles.summaryKicker}>{t(dict, "tools.timer.page.pourPlanKicker")}</AppText>
              <AppText variant="headlineMd" style={styles.summaryTitle}>
                {t(dict, "tools.timer.page.totalGrams", { g: p.schedule.totalWater })}
              </AppText>
            </View>
            <View style={styles.summaryRatio}>
              <AppText variant="labelSm" style={styles.summaryRatioLabel}>{t(dict, "tools.timer.page.stepBloom")}</AppText>
              <AppText variant="bodyLg" style={styles.summaryRatioValue}>{p.schedule.bloomWater} g</AppText>
            </View>
          </View>

          <View style={styles.stepList}>
            {p.schedule.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepTime}>
                  <AppText variant="labelMd" style={styles.stepTimeText}>{formatSeconds(step.atSeconds)}</AppText>
                </View>
                <AppText variant="bodyLg" style={styles.stepLabel}>{stepLabel(dict, step, p.mainPours)}</AppText>
                <View style={styles.stepTargetWrap}>
                  <AppText style={styles.stepTarget}>{step.cumulativeTargetG}</AppText>
                  <AppText variant="labelSm" style={styles.stepTargetUnit}>g</AppText>
                </View>
              </View>
            ))}
            <View style={styles.finishRow}>
              <AppText variant="labelSm" style={styles.finishText}>
                {t(dict, "tools.timer.page.finishHint", { time: formatSeconds(finishRounded(p.finishS)) })}
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Big arm-the-timer control — pinned below the scroll area */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(dict, "tools.timer.page.startTimerA11y")}
        onPress={p.onStart}
        style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
      >
        <View style={styles.startGlyph}>
          <View style={styles.playTriangle} />
        </View>
        <AppText variant="labelMd" style={styles.startText}>{t(dict, "tools.timer.page.startBrewing")}</AppText>
      </Pressable>
    </View>
  );
}

// finishS is an estimate; round to the nearest 5 s for a tidy "~m:ss" hint.
const finishRounded = (s: number) => Math.round(s / 5) * 5;

// ---- Live run view --------------------------------------------------------------------

type LiveProps = {
  dict: Dict;
  schedule: PourSchedule;
  elapsedS: number;
  activeIndex: number;
  running: boolean;
  flash: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
};

// Opacity of a phase row whose time hasn't come (or has passed).
const PHASE_DIMMED = 0.35;

// One pour phase: its name and cumulative target. Fades between dimmed and full opacity
// as the timer crosses into/out of its window. Memoized so the stopwatch's every-tick
// re-render of LiveView doesn't repaint the animated rows (re-rendering a natively
// animated view can momentarily desync its opacity — visible as flicker).
const PhaseRow = React.memo(function PhaseRow({
  dict,
  step,
  active,
  mainPoursCount,
}: {
  dict: Dict;
  step: PourStep;
  active: boolean;
  mainPoursCount: number;
}) {
  const anim = useRef(new Animated.Value(active ? 1 : PHASE_DIMMED)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : PHASE_DIMMED,
      duration: motion.gentle,
      easing: Easing.inOut(Easing.quad),
      // JS driver on purpose: on Fabric, natively-driven views can flash back to their
      // JS-side style when React re-renders them (and the flash cue re-renders this tree
      // at every step boundary). The JS driver keeps style and animation as one value.
      useNativeDriver: false,
    }).start();
  }, [active, anim]);

  return (
    <Animated.View style={[styles.phaseRow, { opacity: anim }]}>
      <AppText variant="labelMd" style={styles.phaseLabel}>{stepLabel(dict, step, mainPoursCount)}</AppText>
      <View style={styles.phaseTargetWrap}>
        <AppText variant="bodyLg" style={styles.phaseWord}>{t(dict, "tools.timer.page.pourTo")}</AppText>
        <AppText style={styles.phaseTarget}>{step.cumulativeTargetG}</AppText>
        <AppText variant="labelSm" style={styles.phaseUnit}>g</AppText>
      </View>
    </Animated.View>
  );
});

function LiveView(p: LiveProps) {
  const { schedule, dict } = p;
  const mainPoursCount = schedule.steps.length - 1;

  // Step-boundary cue: instead of a hard style toggle, the hero's border and surface rise
  // to the cherry tint quickly, then decay back smoothly. Triggered on `flash` rising edge.
  const flashAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!p.flash) return;
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: motion.quick, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: motion.gentle, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [p.flash, flashAnim]);

  const flashBorder = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.outlineVariant, colors.tertiary] });
  const flashSurface = flashAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceLowest, colors.surfaceContainer] });

  return (
    <View style={styles.liveWrap}>
      {/* Hero clock */}
      <Animated.View style={[styles.hero, { borderColor: flashBorder, backgroundColor: flashSurface }]}>
        <AppText variant="labelSm" style={styles.heroKicker}>
          {t(dict, "tools.timer.page.stepOf", {
            state: t(dict, p.running ? "tools.timer.page.brewing" : "tools.timer.page.paused"),
            n: p.activeIndex + 1,
            total: schedule.steps.length,
          })}
        </AppText>
        <AppText style={styles.clock}>{formatSeconds(p.elapsedS)}</AppText>
      </Animated.View>

      {/* One row per pour phase; only the current one reads at full strength. The list
          scrolls on its own so the controls below never move. */}
      <ScrollView style={styles.phaseScroll} contentContainerStyle={styles.phaseList} showsVerticalScrollIndicator={false}>
        {schedule.steps.map((step, i) => (
          <PhaseRow key={i} dict={dict} step={step} active={i === p.activeIndex} mainPoursCount={mainPoursCount} />
        ))}
      </ScrollView>

      {/* Controls pinned to the bottom */}
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(dict, "tools.timer.page.resetTimerA11y")}
          onPress={p.onReset}
          style={({ pressed }) => [styles.ctrlBtn, styles.ctrlReset, pressed && styles.ctrlPressed]}
        >
          <AppText variant="labelMd" style={styles.ctrlResetText}>{t(dict, "tools.timer.page.reset")}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(dict, p.running ? "tools.timer.page.pauseTimerA11y" : "tools.timer.page.resumeTimerA11y")}
          onPress={p.running ? p.onPause : p.onResume}
          style={({ pressed }) => [styles.ctrlBtn, styles.ctrlPrimary, pressed && styles.ctrlPressed]}
        >
          <AppText variant="labelMd" style={styles.ctrlPrimaryText}>{t(dict, p.running ? "tools.timer.page.pause" : "tools.timer.page.resume")}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export const timerTool: ToolModule = {
  meta: { id: "timer", icon: TimerGlyph },
  Screen: TimerScreen,
};

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: 12, marginTop: 4 },

  // --- Setup: scrollable content over a pinned start button ---
  setupWrap: { flex: 1 },
  setupScroll: { flex: 1 },
  setupScrollContent: { paddingBottom: 8 },

  // Bloom + main pours side by side, half the width each.
  stepperRow: { flexDirection: "row", gap: 12 },
  stepperHalf: { flex: 1 },

  // --- Setup: summary card ---
  // Bordered, not elevated: the steppers restyle this card's numbers on every tick (and the
  // setup/live fade animates it), and Android elevation shadows flicker on restyle.
  summary: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    padding: 18,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  summaryGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryKicker: { color: colors.secondary },
  summaryTitle: { marginTop: 3, lineHeight: 34 },
  summaryRatio: { alignItems: "flex-end" },
  summaryRatioLabel: { color: colors.secondary },
  summaryRatioValue: { marginTop: 2, color: colors.onSurface, fontFamily: fonts.sansSemiBold },

  stepList: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLow,
  },
  stepTime: {
    minWidth: 46,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
  },
  stepTimeText: { color: colors.onSurfaceVariant, fontVariant: ["tabular-nums"] },
  stepLabel: { flex: 1, color: colors.onSurface },
  stepTargetWrap: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  stepTarget: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.primary,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  stepTargetUnit: { color: colors.onSurfaceVariant },
  finishRow: { paddingTop: 12, alignItems: "center" },
  finishText: { color: colors.secondary },

  // --- Setup: start button ---
  // Flat like the live controls — its elevation glow flickered through the setup/live fade.
  startBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: 18,
  },
  startBtnPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  startGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: colors.onPrimary,
  },
  startText: { color: colors.onPrimary, letterSpacing: 1.4 },

  // --- Live view ---
  liveWrap: { flex: 1, paddingTop: 4 },
  // Bordered, not elevated: the flash cue restyles this card at every step boundary, and
  // an Android elevation shadow redraws visibly (flickers) on restyle.
  hero: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  heroKicker: { color: colors.secondary },
  clock: {
    fontFamily: fonts.sansBold,
    fontSize: 84,
    lineHeight: 92,
    letterSpacing: -2,
    color: colors.onSurface,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
    marginTop: 6,
  },

  // --- Live view: phase rows ---
  phaseScroll: { flex: 1, marginTop: 16 },
  phaseList: { gap: 10, paddingBottom: 24 },
  // Hairline border instead of a shadow: Android elevation doesn't fade with animated
  // opacity, so an elevated row's shadow flickers through the phase-change fade.
  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  phaseLabel: { color: colors.tertiary },
  phaseTargetWrap: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  phaseWord: { color: colors.onSurfaceVariant },
  phaseTarget: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 22,
    lineHeight: 26,
    color: colors.onSurface,
    includeFontPadding: false,
    fontVariant: ["tabular-nums"],
  },
  phaseUnit: { color: colors.onSurfaceVariant },

  controls: { flexDirection: "row", gap: 12 },
  ctrlBtn: {
    flex: 1,
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  ctrlReset: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.outlineVariant },
  ctrlResetText: { color: colors.onSurfaceVariant },
  // Flat: this button re-renders on every stopwatch tick, and an Android elevation shadow
  // flickers on restyle (same fix as the hero and phase rows).
  ctrlPrimary: { backgroundColor: colors.primary },
  ctrlPrimaryText: { color: colors.onPrimary },
});
