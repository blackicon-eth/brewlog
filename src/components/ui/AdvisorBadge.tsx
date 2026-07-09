import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { PillButton } from "./PillButton";
import { useQvac } from "../../qvac/QvacProvider";
import { colors, fonts, motion, radii, spacing } from "../../design/tokens";

// The advisor's badge — a little cupping bowl on the masthead. The assistant's state is
// read as liquid in the vessel: empty while resting, filling with action-blue as the
// model downloads (a live wavy surface), deepening while it loads into memory, brim-full
// solid blue when ready. Off gets a cherry cross seal; trouble inks the bowl cherry.
// Tapping the bowl opens a ledger card that renders every state as a live mini-badge.

type BadgeState = "off" | "idle" | "downloading" | "loading" | "ready" | "error";

// Liquid tints: downloading pours warm milky coffee — the model arriving from outside —
// and loading pours action-blue: charge building. SOLID pastels (the tokens pre-blended
// onto the white bowl: secondary @45%, primary @36%) rather than alpha tints, so the
// wave's crest circles can overlap the fill without alpha-stacking into darker bands.
const POUR_COFFEE = "#c1b4b1";
const POUR_BLUE = "#a3beea";

export function AdvisorBadge() {
  const { status, progress, aiEnabled, retry } = useQvac();
  const [open, setOpen] = useState(false);

  const state: BadgeState = !aiEnabled ? "off" : status;
  const a11y =
    state === "off" ? "Assistant off" :
      state === "downloading" ? `Assistant downloading, ${progress} percent` :
        state === "loading" ? `Assistant loading, ${progress} percent` :
          state === "ready" ? "Assistant ready" :
            state === "error" ? "Assistant unavailable" : "Assistant resting";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${a11y}. Opens the badge legend.`}
        hitSlop={10}
        onPress={() => setOpen(true)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <BadgeFace state={state} progress={progress} size={36} />
      </Pressable>
      <StatesModal open={open} onClose={() => setOpen(false)} current={state} onRetry={retry} />
    </>
  );
}

// ── The bowl itself ─────────────────────────────────────────────────────────────

function BadgeFace({ state, progress, size }: { state: BadgeState; progress: number; size: number }) {
  const brewing = state === "downloading" || state === "loading";
  const pct = Math.max(0, Math.min(100, progress));
  const tint = state === "loading" ? POUR_BLUE : POUR_COFFEE;

  const spark =
    state === "ready" ? colors.onPrimary :
      state === "error" ? colors.tertiary :
        state === "off" ? colors.outline :
          state === "idle" ? colors.secondary : colors.onSurface;
  const border =
    state === "ready" ? colors.primary :
      state === "error" ? colors.tertiary : colors.outlineVariant;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.bowl,
          { width: size, height: size, borderRadius: size / 2, borderColor: border },
          state === "ready" && styles.bowlReady,
        ]}
      >
        {brewing ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* The liquid is the rotating swell itself; only this anchor moves with
                progress, so the memoized rotor never restarts. */}
            <View
              style={[
                styles.pourAnchor,
                { top: size * (1 - pct / 100) + size * SINK, left: -size / 2 },
              ]}
            >
              <PourSwell tint={tint} size={size} />
            </View>
          </View>
        ) : null}
        {/* Own spark text with a roomy line box: SparkGlyph's tight lineHeight clips
            the ✦'s ink at bowl sizes. Generous lineHeight + no font padding centers
            the mark without transform nudges. */}
        <Text
          style={[
            styles.sparkText,
            // The ✦ sits low on its em box — a small optical lift recenters the ink.
            // Safe now that the line box is roomy: transforms never clip.
            { fontSize: size * 0.42, lineHeight: size * 0.62, color: spark, transform: [{ translateY: -size * 0.03 }, { translateX: size * 0.005 }] },
            state === "off" && styles.offDim,
          ]}
        >
          ✦
        </Text>
      </View>
      {state === "off" ? <CrossSeal /> : null}
    </View>
  );
}

// The water surface, drawn by rotation instead of a path: the liquid is one big square
// (2× the bowl) with heavily rounded corners, its center pinned just below the
// waterline, spinning slowly. The boundary's distance from center varies smoothly
// between the edge midpoints (1.00×size) and the rounded corners (~1.10×size), so the
// visible surface rises and falls ~±2px with continuous curvature — no cusps, a real
// slosh. One swell passes per quarter turn, so a full spin = 4×drift. JS driver: this
// tree re-renders on every progress tick, and natively-driven views flash back to
// their JS styles on re-render.
const SINK = 0.05; // how far the swell's mean surface sits below the anchor top (×size)
const PourSwell = memo(function PourSwell({ tint, size }: { tint: string; size: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: motion.drift * 4, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const S = size * 2;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{ width: S, height: S, borderRadius: S * 0.38, backgroundColor: tint, transform: [{ rotate }] }}
    />
  );
});

// The cancellation mark: a small wax-seal puck with a hand-drawn cherry cross, sitting
// on the bowl's rim when the assistant is off.
function CrossSeal() {
  return (
    <View style={styles.seal}>
      <View style={[styles.sealBar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[styles.sealBar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

// ── The legend card ─────────────────────────────────────────────────────────────

const LEGEND: { key: BadgeState; label: string; line: string; progress: number }[] = [
  { key: "off", label: "Off", line: "Turned off — flip it on in Settings, or wherever it's offered.", progress: 0 },
  { key: "idle", label: "Resting", line: "On, but not warmed up yet. It wakes when first needed.", progress: 0 },
  { key: "downloading", label: "Downloading", line: "Fetching the model — the bowl fills as it arrives.", progress: 55 },
  { key: "loading", label: "Warming up", line: "Pouring the model into memory. Moments away.", progress: 82 },
  { key: "ready", label: "Ready", line: "Brim-full and listening. Ask away.", progress: 100 },
  { key: "error", label: "Trouble", line: "The model couldn't load — check the connection and retry.", progress: 0 },
];

function StatesModal({ open, onClose, current, onRetry }: {
  open: boolean;
  onClose: () => void;
  current: BadgeState;
  onRetry: () => void;
}) {
  // Card entrance/exit in the AppModal dialect; `shown` keeps the Modal mounted
  // through the exit animation.
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, ...motion.springPop }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!shown) return null;

  const cardStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
    ],
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close badge legend" onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <Image source={require("../../../assets/logo-bean.png")} style={styles.headerMark} />
            <AppText variant="labelSm" style={styles.headerKicker}>On-device assistant</AppText>
            <View style={styles.headerRule} />
          </View>
          <AppText variant="headlineMd" style={styles.title}>Reading the badge</AppText>

          {/* The legend can outgrow small screens — it scrolls inside the card. */}
          <ScrollView style={styles.rowsScroll} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
            {LEGEND.map((row) => {
              const now = row.key === current;
              // Legend bowls are fixed illustrations — only the "Now" highlight tracks
              // the advisor's real state.
              return (
                <View key={row.key} style={[styles.row, now && styles.rowNow]}>
                  <BadgeFace state={row.key} progress={row.progress} size={30} />
                  <View style={styles.rowText}>
                    <View style={styles.rowTitleLine}>
                      <AppText variant="labelMd" style={styles.rowLabel}>{row.label}</AppText>
                      {now ? <AppText variant="labelSm" style={styles.nowTag}>Now</AppText> : null}
                    </View>
                    <AppText variant="bodyMd" style={styles.rowLine}>{row.line}</AppText>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {current === "error" ? (
            <PillButton label="Try again" variant="primary" onPress={() => { onRetry(); onClose(); }} />
          ) : (
            <PillButton label="Got it" variant="neutral" onPress={onClose} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  // Bowl — hairline border, never elevation (this surface restyles constantly).
  bowl: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bowlReady: { backgroundColor: colors.primary },
  sparkText: { fontFamily: fonts.sansMedium, includeFontPadding: false, textAlign: "center" },
  offDim: { opacity: 0.5 },

  pourAnchor: { position: "absolute" },

  seal: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  sealBar: { position: "absolute", width: 8, height: 1.8, borderRadius: 1, backgroundColor: colors.tertiary },

  // Legend card — the app's one centered-modal language (AppModal dialect).
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.container },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    shadowColor: "#2c160e",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerMark: { width: 18, height: 18 },
  headerKicker: { marginTop: 1 },
  headerRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  // EB Garamond descenders clip on Android — give headlineMd explicit room.
  title: { marginTop: 10, lineHeight: 34, includeFontPadding: false },

  rowsScroll: { flexGrow: 0, flexShrink: 1, marginTop: 14, marginBottom: 18 },
  rows: { gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowNow: { backgroundColor: colors.surfaceLowest, borderColor: colors.primary },
  rowText: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { color: colors.onSurface },
  nowTag: { color: colors.primary },
  rowLine: { marginTop: 1, fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },
});
