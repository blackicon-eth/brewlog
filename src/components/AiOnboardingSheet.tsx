import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { AppText, PillButton, SparkGlyph } from "./ui";
import { useQvac } from "../qvac/QvacProvider";
import { defaultModelId, resolveModel } from "../lib/aiModels";
import { colors, fonts, motion, radii, spacing } from "../design/tokens";

// The welcome mat: shown exactly once, on the very first launch, asking whether to turn
// on the on-device coach. Saying yes starts the download right here — a progress bar in
// the sheet, dismissable, the work carries on behind it. Saying "maybe later" leaves the
// coach off; every gated entry point can still turn it on afterwards.
export function AiOnboardingSheet() {
  const insets = useSafeAreaInsets();
  const {
    onboarded, aiEnabled, completeOnboarding,
    setAiEnabled, setModel, prepare, retry,
    status, progress, error,
  } = useQvac();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ask" | "busy">("ask");

  // The device picks its own default: featherweight below the RAM floor, the sweet
  // spot otherwise. Resolved once — the sheet mounts once, at app start.
  const suggested = useRef(resolveModel(defaultModelId(Device.totalMemory))).current;

  // Decide once at mount. Users who already turned the coach on (in Settings, before
  // this sheet existed) are grandfathered in — marked onboarded, never welcomed twice.
  useEffect(() => {
    if (onboarded) return;
    if (aiEnabled) { completeOnboarding(); return; }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      Animated.timing(anim, { toValue: 1, duration: motion.standard, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: motion.fast, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!shown) return null;

  const turnOn = () => {
    completeOnboarding();
    setModel(suggested.id);   // no-op when it's already the stored default
    setAiEnabled(true);
    prepare();
    setMode("busy");
  };

  const later = () => {
    completeOnboarding();
    setOpen(false);
  };

  const statusLine =
    status === "ready" ? "All set — the coach is ready." :
    status === "loading" ? `Loading ${progress}%` :
    status === "error" ? (error ?? "The download failed — check your connection.") :
    `Downloading ${progress}%`;

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={later}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]} />
      <View style={styles.host} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 20 },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [440, 0] }) }] },
          ]}
        >
          <View style={styles.halo}>
            <SparkGlyph size={24} color={colors.primary} />
          </View>

          {mode === "ask" ? (
            <>
              <AppText variant="labelSm" style={styles.kicker}>On-device coach</AppText>
              <AppText variant="headlineMd" style={styles.title}>Meet your brewing coach</AppText>
              <AppText variant="bodyMd" style={styles.body}>
                Brewlog can diagnose brews, suggest recipes and chat about technique — with a
                model that runs entirely on your phone. Nothing you brew ever leaves it.
              </AppText>
              <View style={styles.modelNote}>
                <AppText variant="labelSm" style={styles.modelNoteLabel}>Suggested for this device</AppText>
                <AppText variant="bodyMd" style={styles.modelNoteValue}>
                  {suggested.name} · {suggested.size} one-time download
                </AppText>
              </View>
              <PillButton label="Turn it on" variant="primary" onPress={turnOn} />
              <Pressable accessibilityRole="button" onPress={later} style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}>
                <AppText variant="labelMd" style={styles.laterText}>Maybe later</AppText>
              </Pressable>
            </>
          ) : (
            <>
              <AppText variant="labelSm" style={styles.kicker}>On-device coach</AppText>
              <AppText variant="headlineMd" style={styles.title}>
                {status === "ready" ? "The coach is in" : "Brewing up the coach"}
              </AppText>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${status === "ready" ? 100 : progress}%` }]} />
              </View>
              <AppText variant="bodyMd" style={[styles.statusLine, status === "error" && styles.statusError]}>
                {statusLine}
              </AppText>
              {status === "error" ? (
                <PillButton label="Try again" variant="primary" onPress={retry} />
              ) : (
                <PillButton
                  label={status === "ready" ? "Done" : "Keep brewing — it'll finish itself"}
                  variant={status === "ready" ? "primary" : "neutral"}
                  onPress={() => setOpen(false)}
                />
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  host: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.container,
    paddingTop: 24,
  },
  halo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: { color: colors.secondary },
  // EB Garamond descenders clip on Android — give headlineMd explicit room.
  title: { marginTop: 4, lineHeight: 34, includeFontPadding: false },
  body: { marginTop: 8, lineHeight: 22, color: colors.onSurfaceVariant },
  modelNote: {
    marginTop: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceLowest,
  },
  modelNoteLabel: { color: colors.secondary },
  modelNoteValue: { marginTop: 3, fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  laterBtn: { alignSelf: "center", paddingVertical: 14, paddingHorizontal: 20 },
  laterText: { color: colors.secondary },
  pressed: { opacity: 0.7 },
  progressTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
    marginTop: 18,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radii.full, backgroundColor: colors.primary },
  statusLine: { marginTop: 10, marginBottom: 18, color: colors.onSurfaceVariant },
  statusError: { color: colors.tertiary },
});
