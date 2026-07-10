import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee, createCoffee, updateCoffee, deleteCoffee } from "../db/coffees";
import { makeId } from "../lib/ids";
import { AppText, TextField, PillButton, NaturalLanguageIntake, Chevron, useAppModal } from "../components/ui";
import { buildCoffeeIntakePrompt, parseCoffeeIntake, type CoffeeIntake } from "../qvac/intake";
import { useQvac } from "../qvac/QvacProvider";
import { colors, radii, shadows, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeForm">;
type Rt = RouteProp<RootStackParamList, "CoffeeForm">;

export function CoffeeFormScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const { aiEnabled } = useQvac();
  const editingId = params?.coffeeId;
  // The freeform intake box only exists when the assistant is on — with it off, a new
  // log must open straight on the manual form (the intake renders null and would leave
  // the page empty forever).
  const [revealed, setRevealed] = useState(!!editingId || !aiEnabled);

  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [process, setProcess] = useState("");
  const [roastLevel, setRoastLevel] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const c = await getCoffee(await getDb(), editingId);
        if (!c) {
          modal.alert("Couldn't open coffee", "Coffee not found.");
          nav.goBack();
          return;
        }
        setRoaster(c.roaster); setName(c.name); setOrigin(c.origin ?? "");
        setProcess(c.process ?? ""); setRoastLevel(c.roastLevel ?? "");
        setRoastDate(c.roastDate ?? ""); setNotes(c.notes ?? ""); setCreatedAt(c.createdAt);
      } catch (e: any) {
        modal.alert("Couldn't open coffee", String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  function applyParsed(p: CoffeeIntake) {
    if (p.roaster) setRoaster(p.roaster);
    if (p.name) setName(p.name);
    if (p.origin) setOrigin(p.origin);
    if (p.process) setProcess(p.process);
    if (p.roastLevel) setRoastLevel(p.roastLevel);
    if (p.roastDate) setRoastDate(p.roastDate);
    if (p.notes) setNotes(p.notes);
    setRevealed(true);
  }

  async function onSave() {
    if (!roaster.trim() || !name.trim()) { modal.alert("Missing details", "Roaster and name are required."); return; }
    try {
      const db = await getDb();
      const coffee = {
        id: editingId ?? makeId(),
        roaster: roaster.trim(), name: name.trim(),
        origin: origin.trim() || null, process: process.trim() || null,
        roastLevel: roastLevel.trim() || null, roastDate: roastDate.trim() || null,
        notes: notes.trim() || null, createdAt: createdAt ?? Date.now(),
      };
      if (editingId) await updateCoffee(db, coffee); else await createCoffee(db, coffee);
      nav.goBack();
    } catch (e: any) {
      modal.alert("Couldn't save coffee", String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    const ok = await modal.confirm({
      title: "Delete coffee?",
      message: "This removes the coffee and all its brews.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCoffee(await getDb(), editingId);
      nav.navigate("Main");
    } catch (e: any) {
      modal.alert("Couldn't delete coffee", String(e?.message ?? e));
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + screenTopGap, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
        </View>
        <AppText variant="labelSm">{editingId ? "Edit · Ledger" : "New · Ledger"}</AppText>
        <AppText variant="headlineLg" style={styles.title}>
          {editingId ? "Edit coffee" : "New coffee"}
        </AppText>

        {!revealed ? (
          <NaturalLanguageIntake
            kicker="Describe this coffee"
            placeholder="Sey Coffee, Kenya Nyeri AA, washed, light roast, roasted 2026-06-10. Blackcurrant and floral."
            buildPrompt={buildCoffeeIntakePrompt}
            parse={parseCoffeeIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            <View style={styles.heroWrap}>
              <Image
                source={editingId
                  ? require("../../assets/coffee-hero-edit.png")
                  : require("../../assets/coffee-hero-new.png")}
                style={styles.hero}
                resizeMode="cover"
              />
            </View>

            <AppText variant="labelSm" style={styles.section}>The bean</AppText>
            <TextField label="Roaster" value={roaster} onChangeText={setRoaster} placeholder="Sey Coffee" required autoCapitalize="words" />
            <TextField label="Name / variety" value={name} onChangeText={setName} placeholder="Kenya Nyeri AA" required autoCapitalize="words" />

            <AppText variant="labelSm" style={styles.section}>Details</AppText>
            <View style={styles.row}>
              <TextField label="Origin" value={origin} onChangeText={setOrigin} placeholder="Kenya" autoCapitalize="words" style={styles.col} />
              <TextField label="Process" value={process} onChangeText={setProcess} placeholder="washed" style={styles.col} />
            </View>
            <View style={styles.row}>
              <TextField label="Roast level" value={roastLevel} onChangeText={setRoastLevel} placeholder="light" style={styles.col} />
              <TextField label="Roast date" value={roastDate} onChangeText={setRoastDate} placeholder="2026-06-10" autoCapitalize="none" style={styles.col} />
            </View>

            <AppText variant="labelSm" style={styles.section}>Notes</AppText>
            <TextField label="Tasting notes" value={notes} onChangeText={setNotes} multiline placeholder="blackcurrant, floral, juicy" />

            <View style={styles.actions}>
              <PillButton label={editingId ? "Save changes" : "Save coffee"} onPress={onSave} />
              {editingId ? <PillButton label="Delete coffee" variant="danger" onPress={onDelete} style={styles.delete} /> : null}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.container },
  topBar: { flexDirection: "row", marginBottom: 14 },
  backBtn: { height: 34, justifyContent: "center" },
  title: { marginTop: 6, marginBottom: spacing.base },
  heroWrap: { marginTop: spacing.base, borderRadius: radii.lg, backgroundColor: colors.surfaceLowest, ...shadows.card },
  hero: { width: "100%", height: 160, borderRadius: radii.lg },
  section: { marginTop: spacing.section, marginBottom: spacing.gutter },
  row: { flexDirection: "row", gap: spacing.gutter },
  col: { flex: 1 },
  actions: { marginTop: spacing.section },
  delete: { marginTop: spacing.gutter },
});
