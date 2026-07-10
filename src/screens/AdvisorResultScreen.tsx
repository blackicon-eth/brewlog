import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, BackHandler, PanResponder, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee } from "../db/coffees";
import { getBrew, listBrewsForCoffee } from "../db/brews";
import { buildDiagnosePrompt, buildBestRecipePrompt, type ChatMessage } from "../qvac/advisor";
import { useQvac } from "../qvac/QvacProvider";
import { AppText, PillButton, ReasoningDisclosure } from "../components/ui";
import { colors, fonts, motion, radii, spacing } from "../design/tokens";

type Rt = RouteProp<RootStackParamList, "AdvisorResult">;

const OFFSCREEN = 1000; // start fully below the fold until we measure the sheet

// A blinking ink caret that trails the streamed answer, the one bit of live motion.
function StreamingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: motion.pulse, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: motion.pulse, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[styles.caret, { opacity }]}>▍</Animated.Text>;
}

export function AdvisorResultScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const { status, prepare, retry, runAdvice } = useQvac();

  const [phase, setPhase] = useState<"preparing" | "thinking" | "streaming" | "done" | "error">("preparing");
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelRef = useRef<null | (() => void)>(null);

  // Sheet entrance / drag / exit, all on the built-in Animated driver (no extra deps).
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetH = useRef(OFFSCREEN);
  const opened = useRef(false);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: sheetH.current, duration: motion.standard, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: motion.standard, useNativeDriver: true }),
    ]).start(() => nav.goBack());
  }, [nav, translateY, backdrop]);

  const onSheetLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    sheetH.current = e.nativeEvent.layout.height;
    if (opened.current) return;
    opened.current = true;
    translateY.setValue(sheetH.current);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...motion.springPop }),
      Animated.timing(backdrop, { toValue: 1, duration: motion.standard, useNativeDriver: true }),
    ]).start();
  }, [translateY, backdrop]);

  // Drag-to-dismiss, attached to the sheet header only (so the body still scrolls).
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...motion.springSnap }).start();
      },
    }),
  ).current;

  // Android hardware back runs the same animated close.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => sub.remove();
  }, [close]);

  useEffect(() => {
    let active = true;
    prepare(); // ensure model is loading/loaded

    (async () => {
      // Build the prompt from current data.
      const db = await getDb();
      const coffee = await getCoffee(db, params.coffeeId);
      if (!coffee) { setErrorMsg("Coffee not found"); setPhase("error"); return; }
      const brews = await listBrewsForCoffee(db, params.coffeeId);
      let history: ChatMessage[];
      if (params.kind === "diagnose") {
        const selected = params.brewId ? await getBrew(db, params.brewId) : brews[0];
        if (!selected) { setErrorMsg("Brew not found"); setPhase("error"); return; }
        const recent = brews.filter((b) => b.method === selected.method);
        history = buildDiagnosePrompt(coffee, selected, recent);
      } else {
        const method = params.method ?? "filter";
        history = buildBestRecipePrompt(coffee, brews.filter((b) => b.method === method), method);
      }

      // Wait for the model to be ready. 'status' is in this effect's deps, so each status change re-runs the effect; this loop just keeps the run alive (and cancellable) until a re-run arrives with status==="ready".
      while (active && status !== "ready") {
        await new Promise((r) => setTimeout(r, 300));
        if (status === "error") { setErrorMsg("Advisor failed to load"); setPhase("error"); return; }
      }
      if (!active) return;

      setPhase("thinking");
      try {
        const run = runAdvice(history, {
          onContent: (t) => { if (!active) return; setPhase("streaming"); setAnswer((a) => a + t); },
          onThinking: (t) => { if (active) setThinking((x) => x + t); },
        });
        cancelRef.current = run.cancel;
        await run.done;
        if (active) setPhase("done");
      } catch (e: any) {
        if (active) { setErrorMsg(e?.message ?? String(e)); setPhase("error"); }
      }
    })();

    return () => { active = false; cancelRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.coffeeId, params.brewId, params.kind, status]);

  const generating = phase === "streaming" || phase === "thinking";
  const loading = phase === "preparing" || (phase === "thinking" && !answer);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY }] }]}
        onLayout={onSheetLayout}
      >
        <View {...pan.panHandlers} style={styles.grip}>
          <View style={styles.handle} />
          <View style={styles.kickerRow}>
            <Text style={styles.sparkle}>✦</Text>
            <AppText variant="labelSm" style={styles.kicker}>On-device · Private</AppText>
          </View>
          <AppText variant="headlineLg" style={styles.title}>{params.title}</AppText>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="headlineMd" style={styles.loadingTitle}>
                {status === "ready" ? "Thinking…" : "Preparing advisor…"}
              </AppText>
              <AppText variant="bodyMd" style={styles.loadingSub}>
                Reading your brew history on-device.
              </AppText>
            </View>
          ) : null}

          {thinking ? <ReasoningDisclosure text={thinking} /> : null}

          {answer ? (
            <AppText variant="bodyLg" style={styles.answer}>
              {answer}
              {generating ? <StreamingCaret /> : null}
            </AppText>
          ) : null}

          {errorMsg ? (
            <View style={styles.errorBox}>
              <AppText variant="bodyLg" style={styles.errorText}>✕ {errorMsg}</AppText>
              <AppText variant="bodyMd" style={styles.errorSub}>
                The advisor runs locally — try again in a moment.
              </AppText>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {generating ? (
            <PillButton label="Stop" variant="danger" onPress={() => cancelRef.current?.()} />
          ) : phase === "error" ? (
            <View style={styles.errorActions}>
              <PillButton
                label="Retry"
                variant="danger"
                style={styles.flex1}
                onPress={() => { setErrorMsg(null); setAnswer(""); setThinking(""); setPhase("preparing"); retry(); }}
              />
              <PillButton label="Close" style={styles.flex1} onPress={close} />
            </View>
          ) : phase === "done" ? (
            <PillButton label="Close" onPress={close} />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.container,
    paddingTop: 10,
    maxHeight: "90%",
    shadowColor: "#2c160e",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  grip: { paddingBottom: 4 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 999, backgroundColor: colors.outlineVariant, marginBottom: 18 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sparkle: { color: colors.primary, fontSize: 13, fontFamily: fonts.sansBold },
  kicker: { color: colors.primary },
  title: { marginTop: 6, marginBottom: spacing.stack },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: spacing.stack },
  loading: { alignItems: "center", paddingVertical: spacing.section, gap: 10 },
  // EB Garamond descenders clip on Android — give headlineMd explicit room.
  loadingTitle: { lineHeight: 34, includeFontPadding: false },
  loadingSub: { textAlign: "center" },
  answer: { color: colors.onSurface, lineHeight: 27 },
  caret: { color: colors.primary, fontFamily: fonts.sans },
  errorBox: { paddingVertical: spacing.stack, gap: 6 },
  errorText: { color: colors.tertiary },
  errorSub: {},
  actions: { paddingTop: spacing.stack },
  errorActions: { flexDirection: "row", gap: spacing.gutter },
  flex1: { flex: 1 },
});
