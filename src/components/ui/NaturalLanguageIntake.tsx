import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "./AppText";
import { PillButton } from "./PillButton";
import { Chevron } from "./Chevron";
import { useQvac } from "../../qvac/QvacProvider";
import type { ChatMessage } from "../../qvac/advisor";
import { colors, fonts, radii, spacing } from "../../design/tokens";

export type NaturalLanguageIntakeProps<T> = {
  kicker: string;
  placeholder: string;
  buildPrompt: (text: string) => ChatMessage[];
  parse: (raw: string) => T;
  onParsed: (parsed: T) => void;
  onManual: () => void;
};

// One natural-language box that runs the on-device model once and hands the parsed
// fields back to the screen. The screen reveals its structured fields on `onParsed`.
export function NaturalLanguageIntake<T>({
  kicker, placeholder, buildPrompt, parse, onParsed, onManual,
}: NaturalLanguageIntakeProps<T>) {
  const { status, prepare, runAdvice, aiEnabled } = useQvac();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "preparing" | "running" | "error">("idle");
  const [notice, setNotice] = useState("");
  const wantRun = useRef(false);
  const running = useRef(false);
  const canceled = useRef(false);
  const cancelRun = useRef<null | (() => void)>(null);
  const buf = useRef("");

  function beginRun() {
    if (running.current) return;
    running.current = true;
    canceled.current = false;
    buf.current = "";
    setNotice("");
    setPhase("running");
    const run = runAdvice(buildPrompt(text), {
      onContent: (t) => { buf.current += t; },
      onThinking: () => {},
    });
    cancelRun.current = run.cancel;
    run.done
      .then(() => {
        if (canceled.current) return;
        const parsed = parse(buf.current);
        if (parsed && typeof parsed === "object" && Object.keys(parsed as Record<string, unknown>).length === 0) {
          setNotice("Couldn't read that — try again, or enter manually.");
          setPhase("error");
        } else {
          onParsed(parsed);
        }
      })
      .catch(() => { if (!canceled.current) { setNotice("Couldn't reach the advisor. Tap \"Enter manually\" below."); setPhase("error"); } })
      .finally(() => { running.current = false; });
  }

  // When the model becomes ready after an Autofill tap, start the run. If it can't
  // load at all, fall back to manual entry (never a dead end).
  useEffect(() => {
    if (!wantRun.current) return;
    if (status === "ready") { wantRun.current = false; beginRun(); }
    else if (status === "error") { wantRun.current = false; onManual(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => () => {
    canceled.current = true;
    cancelRun.current?.();
  }, []);

  function onAutofill() {
    if (!text.trim() || phase === "running" || phase === "preparing") return;
    prepare();
    if (status === "ready") beginRun();
    else if (status === "error") { onManual(); return; }
    else { wantRun.current = true; setPhase("preparing"); }
  }

  function onStop() {
    canceled.current = true;
    cancelRun.current?.();
    wantRun.current = false;
    running.current = false;
    setPhase("idle");
  }

  const busy = phase === "preparing" || phase === "running";

  // Assistant off: the box simply isn't there — the form works manually, and a prompt
  // mid-form-filling would be an interruption, not an invitation.
  if (!aiEnabled) return null;

  return (
    <View style={styles.wrap}>
      <AppText variant="labelSm" style={styles.kicker}>✦ {kicker}</AppText>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        multiline
        editable={!busy}
      />

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="bodyMd" style={styles.busyText}>
            {phase === "preparing" ? "Preparing advisor…" : "Reading your description…"}
          </AppText>
        </View>
      ) : null}

      {phase === "error" && notice ? (
        <AppText variant="bodyMd" style={styles.error}>✕ {notice}</AppText>
      ) : null}

      <View style={styles.actions}>
        {busy ? (
          <PillButton label="Stop" variant="danger" onPress={onStop} />
        ) : (
          <PillButton label="Autofill with AI" onPress={onAutofill} />
        )}
      </View>

      {!busy ? (
        <Pressable onPress={onManual} hitSlop={8} style={styles.manualBtn}>
          <AppText variant="labelMd" style={styles.manual}>Enter manually</AppText>
          <Chevron direction="right" size={7} thickness={2} color={colors.onSurfaceVariant} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.section, gap: spacing.gutter },
  kicker: { color: colors.primary },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 120,
    textAlignVertical: "top",
  },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  busyText: { color: colors.onSurfaceVariant },
  error: { color: colors.tertiary },
  actions: { marginTop: spacing.base },
  manualBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: spacing.base },
  manual: { color: colors.onSurfaceVariant },
});
