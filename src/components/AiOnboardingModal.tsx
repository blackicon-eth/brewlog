import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, StyleSheet, View } from "react-native";
import * as Device from "expo-device";
import { AppText, PillButton } from "./ui";
import { useQvac } from "../qvac/QvacProvider";
import { defaultModelId, resolveModel } from "../lib/aiModels";
import { useI18n } from "../i18n/LocaleProvider";
import { colors, fonts, motion, radii, spacing } from "../design/tokens";

// The welcome mat: a centered two-step card shown exactly once, on the very first launch.
// Step one says hello and sketches what the ledger can do; step two offers the on-device
// assistant — clearly optional, with the device-suggested model and its download size.
// Saying yes starts the download right here (progress in the card, dismissable, the work
// carries on behind it); saying "maybe later" leaves the assistant off, and Settings or
// any gated entry point can turn it on afterwards.
export function AiOnboardingModal() {
  const {
    onboarded, aiEnabled, completeOnboarding,
    setAiEnabled, setModel, prepare, retry,
    status, progress, error,
  } = useQvac();
  const { t } = useI18n();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"welcome" | "assistant" | "busy">("welcome");

  // The device picks its own suggestion: featherweight below the RAM floor, the sweet
  // spot otherwise. Resolved once — the modal mounts once, at app start.
  const suggested = useRef(resolveModel(defaultModelId(Device.totalMemory))).current;

  // Decide once at mount. Users who already turned the assistant on (in Settings, before
  // this modal existed) are grandfathered in — marked onboarded, never welcomed twice.
  useEffect(() => {
    if (onboarded) return;
    if (aiEnabled) { completeOnboarding(); return; }
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Card entrance/exit in the AppModal dialect: spring-pop in, quick fade out. `shown`
  // keeps the Modal mounted through the exit animation.
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

  const skip = () => {
    completeOnboarding();
    setOpen(false);
  };

  const turnOn = () => {
    completeOnboarding();
    setModel(suggested.id);   // no-op when it's already the stored default
    setAiEnabled(true);
    prepare();
    setStep("busy");
  };

  const statusLine =
    status === "ready" ? t("onboarding.busy.statusReady") :
      status === "loading" ? t("onboarding.busy.statusLoading", { progress }) :
        status === "error" ? (error ?? t("onboarding.busy.statusDownloadFailed")) :
          t("onboarding.busy.statusDownloading", { progress });

  const cardStyle = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
    ],
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={skip}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]} />

        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          {step === "welcome" ? (
            <>
              <CardHeader kicker={t("onboarding.welcome.kicker")} />
              <AppText variant="headlineMd" style={styles.title}>{t("onboarding.welcome.title")}</AppText>
              <AppText variant="bodyMd" style={styles.body}>
                {t("onboarding.welcome.body")}
              </AppText>
              <View style={styles.featureList}>
                <FeatureRow text={t("onboarding.welcome.featureLog")} />
                <FeatureRow text={t("onboarding.welcome.featureRecipes")} />
                <FeatureRow text={t("onboarding.welcome.featureAssistant")} />
              </View>
              <PillButton label={t("onboarding.welcome.continue")} variant="primary" onPress={() => setStep("assistant")} />
            </>
          ) : step === "assistant" ? (
            <>
              <CardHeader kicker={t("onboarding.assistant.kicker")} />
              <AppText variant="headlineMd" style={styles.title}>{t("onboarding.assistant.title")}</AppText>
              <AppText variant="bodyMd" style={styles.body}>
                {t("onboarding.assistant.body")}
              </AppText>
              <View style={styles.modelNote}>
                <AppText variant="labelSm" style={styles.modelNoteLabel}>{t("onboarding.assistant.suggestedLabel")}</AppText>
                <AppText variant="bodyMd" style={styles.modelNoteValue}>
                  {t("onboarding.assistant.suggestedValue", { name: suggested.name, size: suggested.size })}
                </AppText>
              </View>
              <AppText variant="bodyMd" style={styles.optionalNote}>
                {t("onboarding.assistant.optionalNote")}
              </AppText>
              <PillButton label={t("onboarding.assistant.download")} variant="primary" onPress={turnOn} />
              <Pressable accessibilityRole="button" onPress={skip} style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}>
                <AppText variant="labelMd" style={styles.laterText}>{t("onboarding.assistant.later")}</AppText>
              </Pressable>
            </>
          ) : (
            <>
              <CardHeader kicker={t("onboarding.assistant.kicker")} />
              <AppText variant="headlineMd" style={styles.title}>
                {status === "ready" ? t("onboarding.busy.titleReady") : t("onboarding.busy.titleLoading")}
              </AppText>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${status === "ready" ? 100 : progress}%` }]} />
              </View>
              <AppText variant="bodyMd" style={[styles.statusLine, status === "error" && styles.statusError]}>
                {statusLine}
              </AppText>
              {status === "error" ? (
                <>
                  <PillButton label={t("onboarding.busy.tryAgain")} variant="primary" onPress={retry} />
                  <Pressable accessibilityRole="button" onPress={skip} style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}>
                    <AppText variant="labelMd" style={styles.laterText}>{t("onboarding.busy.later")}</AppText>
                  </Pressable>
                </>
              ) : (
                <PillButton
                  label={status === "ready" ? t("onboarding.busy.done") : t("onboarding.busy.keepBrewing")}
                  variant={status === "ready" ? "primary" : "neutral"}
                  onPress={() => setOpen(false)}
                />
              )}
            </>
          )}

          {/* Step dots — quiet wayfinding under the card content. */}
          <View style={styles.dots}>
            <View style={[styles.dot, step === "welcome" && styles.dotActive]} />
            <View style={[styles.dot, step !== "welcome" && styles.dotActive]} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Ruled ledger heading: the Brewlog bean mark, the letterpress kicker, then a hairline
// rule running to the card's edge — a printed section rule instead of a tall icon block.
function CardHeader({ kicker }: { kicker: string }) {
  return (
    <View style={styles.headerRow}>
      <Image source={require("../../assets/logo-bean.png")} style={styles.headerMark} />
      <AppText variant="labelSm" style={styles.headerKicker}>{kicker}</AppText>
      <View style={styles.headerRule} />
    </View>
  );
}

// One line of the welcome overview: a spark marker and a short promise.
function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <AppText style={styles.featureMark}>✦</AppText>
      <AppText variant="bodyMd" style={styles.featureText}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.container },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  // Same paper card as AppModal's dialog — the app's one centered-modal language.
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: "#2c160e",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerMark: { width: 18, height: 18 },
  // Optically centers the cap-height kicker against the spark and the rule.
  headerKicker: { marginTop: 1 },
  headerRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  // EB Garamond descenders clip on Android — give headlineMd explicit room.
  title: { marginTop: 10, lineHeight: 34, includeFontPadding: false },
  body: { marginTop: 8, lineHeight: 22, color: colors.onSurfaceVariant },

  featureList: { marginTop: 12, marginBottom: 20, gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureMark: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    color: colors.primary,
  },
  featureText: { flex: 1, lineHeight: 20, color: colors.onSurface },

  modelNote: {
    marginTop: 14,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceLowest,
  },
  modelNoteLabel: { color: colors.secondary },
  modelNoteValue: { marginTop: 3, fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  optionalNote: { marginTop: 12, marginBottom: 16, lineHeight: 20, color: colors.secondary },

  laterBtn: { alignSelf: "center", paddingVertical: 13, paddingHorizontal: 20 },
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

  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outlineVariant },
  dotActive: { backgroundColor: colors.primary },
});
