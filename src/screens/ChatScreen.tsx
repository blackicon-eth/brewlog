import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildChatHistory } from "../qvac/advisor";
import { useQvac } from "../qvac/QvacProvider";
import { AppText, ChatBubble, PillButton } from "../components/ui";
import { colors, fonts, radii, spacing, screenTopGap } from "../design/tokens";

// One visible turn. `pending` marks the coach bubble that's currently being generated (or
// waited on); `error` flips it to a cherry failure note. The whole list lives in component
// state only — it's the single app session's chat, never written to the database.
type Turn = { id: string; role: "user" | "assistant"; content: string; pending?: boolean; error?: boolean };

// Conversation openers shown on the empty canvas — tap to send.
const SUGGESTIONS = [
  "Why does my pour-over taste sour?",
  "What ratio should I start with for a light roast?",
  "How do I dial in a bitter, muddy cup?",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Scrub anything request-scoped out of a raw SDK error before it reaches a bubble: the
// completion request id (a UUID) is an internal detail and must never be shown to the user.
function cleanErrorMessage(raw: string): string {
  const cleaned = raw
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    .replace(/\brequest[\s_-]?id\b:?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || "Something went wrong. Please try again.";
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { status, prepare, retry, runAdvice, aiEnabled, setAiEnabled } = useQvac();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  // Mirrors read inside the async send loop (which captures stale state).
  const turnsRef = useRef<Turn[]>([]);
  const statusRef = useRef(status);
  const aiEnabledRef = useRef(aiEnabled);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);

  // The one in-flight generation: its SDK cancel + a flag the wait-loop watches.
  const genRef = useRef<{ cancel: () => void; cancelled: boolean } | null>(null);
  const idRef = useRef(0);

  // Auto-scroll only when the user is already near the bottom, so scrolling up to re-read an
  // earlier answer isn't yanked back down by the next streamed token.
  const scrollRef = useRef<ScrollView>(null);
  const stick = useRef(true);

  // Warm the model on first view so the first reply streams sooner (Home warms it too; this
  // is idempotent). Cancel any in-flight run if the screen unmounts.
  useEffect(() => {
    prepare();
    return () => genRef.current?.cancel();
  }, [prepare]);

  const patch = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const send = useCallback((raw: string) => {
    const content = raw.trim();
    if (!content || genRef.current) return;

    const userTurn: Turn = { id: `u${idRef.current++}`, role: "user", content };
    const botId = `a${idRef.current++}`;

    // History is the whole transcript so far plus this new question — successful turns only
    // (drop pending placeholders and prior failures).
    const history = buildChatHistory(
      [...turnsRef.current, userTurn]
        .filter((t) => t.content && !t.error && !t.pending)
        .map((t) => ({ role: t.role, content: t.content })),
    );

    setTurns((prev) => [
      ...prev,
      userTurn,
      { id: botId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    stick.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const gen = { cancel: () => { }, cancelled: false };
    genRef.current = gen;
    setGenerating(true);

    (async () => {
      try {
        prepare();
        // Hold until the model is loaded; the user may send before the download finishes.
        while (statusRef.current !== "ready") {
          if (gen.cancelled) return;
          // The coach was turned off mid-wait: status pins at "idle", so bail out.
          if (!aiEnabledRef.current) { gen.cancelled = true; return; }
          if (statusRef.current === "error") {
            throw new Error("The coach couldn't load — check your connection and try again.");
          }
          await sleep(250);
        }
        if (gen.cancelled) return;

        const run = runAdvice(history, {
          onContent: (t) => patch(botId, (b) => ({ ...b, content: b.content + t })),
        });
        gen.cancel = run.cancel;
        await run.done;
      } catch (e: any) {
        if (gen.cancelled) {
          // The user pressed Stop — keep whatever streamed; only if nothing did, leave a red
          // note. Never surface the SDK's cancellation error (it carries the request id).
          patch(botId, (b) => (b.content ? b : { ...b, error: true, content: "Inference cancelled by the user." }));
        } else {
          const msg = cleanErrorMessage(String(e?.message ?? e));
          patch(botId, (b) => ({ ...b, error: true, content: b.content || msg }));
        }
      } finally {
        // If it was stopped before a single token landed, drop the empty coach bubble.
        setTurns((prev) =>
          prev.flatMap((t) => {
            if (t.id !== botId) return [t];
            if (!t.content && !t.error) return [];
            return [{ ...t, pending: false }];
          }),
        );
        genRef.current = null;
        setGenerating(false);
      }
    })();
  }, [patch, prepare, runAdvice]);

  const stop = useCallback(() => {
    const gen = genRef.current;
    if (!gen) return;
    gen.cancelled = true;
    gen.cancel();
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    stick.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  }, []);

  const canSend = input.trim().length > 0 && !generating;
  const isEmpty = turns.length === 0;

  // The coach is off: the tab stays reachable (hiding it would reflow the whole bar and
  // bury the feature), but the canvas explains itself and offers the switch right here.
  if (!aiEnabled) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
          <AppText variant="headlineLg" style={styles.title}>Chat</AppText>
          <AppText variant="labelMd" style={styles.subtitle}>On-device brewing coach</AppText>
        </View>
        <View style={styles.offWrap}>
          <AppText style={styles.spark}>✦</AppText>
          <AppText variant="headlineMd" style={styles.emptyTitle}>The coach is off</AppText>
          <AppText variant="bodyMd" style={styles.emptyBody}>
            Turn on the on-device AI to chat about grind, ratio, water and technique.
            Everything runs privately on your phone — nothing you brew ever leaves it.
          </AppText>
          <PillButton
            label="Turn on the coach"
            variant="primary"
            style={styles.offBtn}
            onPress={() => { setAiEnabled(true); prepare(); }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed masthead — matches the Brews ledger header. */}
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Chat</AppText>
        <AppText variant="labelMd" style={styles.subtitle}>On-device brewing coach</AppText>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.spark}>✦</AppText>
            <AppText variant="headlineMd" style={styles.emptyTitle}>Ask your brewing coach</AppText>
            <AppText variant="bodyMd" style={styles.emptyBody}>
              On-device answers on grind, ratio, water and technique. Nothing leaves your phone,
              and this chat clears when you close the app.
            </AppText>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                >
                  <AppText variant="bodyMd" style={styles.suggestionText}>{s}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={64}
            onContentSizeChange={() => { if (stick.current) scrollRef.current?.scrollToEnd({ animated: true }); }}
            keyboardDismissMode="interactive"
          >
            {turns.map((t) => {
              // Coach bubble with nothing streamed yet: show a loader + status line instead.
              if (t.pending && !t.content) {
                return (
                  <View key={t.id} style={styles.typingRow}>
                    <View style={styles.typingBubble}>
                      <ActivityIndicator size="small" color={colors.secondary} />
                      <AppText variant="bodyMd" style={styles.typingText}>
                        {status === "ready" ? "Thinking…" : "Waking the coach…"}
                      </AppText>
                    </View>
                  </View>
                );
              }
              return (
                <ChatBubble
                  key={t.id}
                  role={t.role}
                  text={t.content}
                  streaming={t.pending && !t.error}
                  error={t.error}
                />
              );
            })}
          </ScrollView>
        )}

        {status === "error" ? (
          <View style={styles.banner}>
            <AppText variant="bodyMd" style={styles.bannerText}>Coach unavailable offline.</AppText>
            <Pressable onPress={retry} hitSlop={8}>
              <AppText variant="labelMd" style={styles.bannerRetry}>Retry</AppText>
            </Pressable>
          </View>
        ) : null}

        {/* Composer — pinned above the tab bar; rides the keyboard via adjustResize. */}
        <View style={styles.composer}>
          <TextInput
            style={styles.field}
            value={input}
            onChangeText={setInput}
            placeholder="Ask something…"
            placeholderTextColor={colors.outline}
            // Multiline so the field grows with wrapped text up to maxHeight, then scrolls —
            // but the return key SENDS (submitBehavior="submit" keeps the keyboard open and
            // suppresses the newline) so Enter mirrors tapping the send button.
            multiline
            textAlignVertical="top"
            submitBehavior="submit"
            onSubmitEditing={() => send(input)}
            cursorColor={colors.primary}
            selectionColor={colors.outlineVariant}
          />
          <Pressable
            onPress={generating ? stop : () => send(input)}
            disabled={!generating && !canSend}
            accessibilityRole="button"
            accessibilityLabel={generating ? "Stop" : "Send"}
            style={({ pressed }) => [
              styles.sendBtn,
              generating ? styles.sendStop : canSend ? styles.sendReady : styles.sendIdle,
              pressed && styles.sendPressed,
            ]}
          >
            {generating ? (
              <View style={styles.stopSquare} />
            ) : (
              <View style={styles.arrow}>
                <View style={styles.arrowHead} />
                <View style={styles.arrowStem} />
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 8 },
  title: { marginTop: 6, lineHeight: 48 },
  subtitle: { marginTop: 8, color: colors.secondary },

  // Thread
  thread: { paddingHorizontal: spacing.container, paddingTop: 6, paddingBottom: spacing.stack },
  typingRow: { width: "100%", alignItems: "flex-start", marginTop: spacing.gutter },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  typingText: { color: colors.secondary },

  // Empty canvas
  emptyWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.container, paddingBottom: 40 },
  spark: { fontFamily: fonts.sansMedium, fontSize: 30, lineHeight: 40, includeFontPadding: false, color: colors.primary, marginBottom: 6 },
  emptyTitle: {},
  emptyBody: { marginTop: 8, lineHeight: 22 },
  suggestions: { marginTop: spacing.section, gap: 10 },
  offWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.container, paddingBottom: 80 },
  offBtn: { marginTop: spacing.section },
  suggestion: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestionPressed: { backgroundColor: colors.surfaceLow },
  suggestionText: { color: colors.onSurface },

  // Offline banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.container,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.base,
  },
  bannerText: { color: colors.onSurface },
  bannerRetry: { color: colors.primary },

  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: spacing.container,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  field: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    paddingBottom: Platform.OS === "ios" ? 12 : 10,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onSurface,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendReady: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendIdle: { backgroundColor: colors.surfaceContainerHigh },
  sendStop: { backgroundColor: colors.tertiary },
  sendPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  // Hand-drawn north arrow (triangle head over a short stem) — no icon dependency.
  arrow: { alignItems: "center", justifyContent: "center" },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.onPrimary,
  },
  arrowStem: { width: 3, height: 8, marginTop: -1, borderRadius: 1.5, backgroundColor: colors.onPrimary },
  stopSquare: { width: 13, height: 13, borderRadius: 3, backgroundColor: colors.onPrimary },
});
