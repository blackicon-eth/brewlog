import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee } from "../db/coffees";
import { getBrew, listBrewsForCoffee } from "../db/brews";
import { buildDiagnosePrompt, buildBestRecipePrompt, type ChatMessage } from "../qvac/advisor";
import { useQvac } from "../qvac/QvacProvider";
import { theme } from "../theme";

type Rt = RouteProp<RootStackParamList, "AdvisorResult">;

export function AdvisorResultScreen() {
  const nav = useNavigation();
  const { params } = useRoute<Rt>();
  const { status, prepare, retry, runAdvice } = useQvac();

  const [phase, setPhase] = useState<"preparing" | "thinking" | "streaming" | "done" | "error">("preparing");
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cancelRef = useRef<null | (() => void)>(null);

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
        history = buildDiagnosePrompt(coffee, selected, brews);
      } else {
        history = buildBestRecipePrompt(coffee, brews);
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{params.title}</Text>

      {phase === "preparing" || (phase === "thinking" && !answer) ? (
        <View style={styles.row}><ActivityIndicator color={theme.accent} /><Text style={styles.muted}>
          {status === "ready" ? "Thinking…" : "Preparing advisor…"}
        </Text></View>
      ) : null}

      {thinking ? (
        <View style={styles.thinkBox}>
          <Pressable onPress={() => setShowThinking((s) => !s)}>
            <Text style={styles.thinkToggle}>{showThinking ? "▾ Hide reasoning" : "▸ Show reasoning"}</Text>
          </Pressable>
          {showThinking ? <Text style={styles.thinkText}>{thinking}</Text> : null}
        </View>
      ) : null}

      {answer ? <Text style={styles.answer}>{answer}</Text> : null}
      {errorMsg ? <Text style={styles.error}>❌ {errorMsg}</Text> : null}

      {phase === "streaming" || phase === "thinking" ? (
        <Pressable style={styles.stop} onPress={() => cancelRef.current?.()}>
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      ) : null}
      {phase === "done" || phase === "error" ? (
        <View style={styles.row}>
          {phase === "error" ? (
            <Pressable style={[styles.close, styles.retryBtn]} onPress={() => {
              setErrorMsg(null); setAnswer(""); setThinking(""); setPhase("preparing"); retry();
            }}>
              <Text style={styles.closeText}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.close} onPress={() => nav.goBack()}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 12 },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  muted: { color: theme.muted },
  answer: { color: theme.text, fontSize: 16, lineHeight: 24 },
  thinkBox: { backgroundColor: theme.surface, borderRadius: 10, padding: 10 },
  thinkToggle: { color: theme.muted, fontWeight: "600" },
  thinkText: { color: theme.muted, marginTop: 8, fontStyle: "italic", lineHeight: 20 },
  error: { color: theme.bad },
  stop: { borderColor: theme.bad, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  stopText: { color: theme.bad, fontWeight: "600" },
  close: { flex: 1, backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: "center" },
  closeText: { color: "white", fontWeight: "600" },
  retryBtn: { marginRight: 8 },
});
