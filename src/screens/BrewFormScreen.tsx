import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getBrew, createBrew, updateBrew, deleteBrew } from "../db/brews";
import { computeRatio, formatRatio } from "../lib/ratio";
import { makeId } from "../lib/ids";
import { AppText, TextField, ChipSelect, ScaleSelect, PillButton, NaturalLanguageIntake, Chevron, useAppModal, type ChipOption } from "../components/ui";
import { buildBrewIntakePrompt, parseBrewIntake, type BrewIntake } from "../qvac/intake";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "BrewForm">;
type Rt = RouteProp<RootStackParamList, "BrewForm">;

const num = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
const int = (s: string): number | null => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };

const DRIPPERS: ChipOption[] = [{ label: "V60", value: "V60" }];
const FILTERS: ChipOption[] = [
  { label: "White", value: "white" },
  { label: "Unbleached", value: "unbleached" },
];
const TASTES = [
  { label: "Acidity", key: "acidity" },
  { label: "Sweetness", key: "sweetness" },
  { label: "Bitterness", key: "bitterness" },
  { label: "Body", key: "body" },
  { label: "Clarity", key: "clarity" },
  { label: "Overall", key: "rating" },
] as const;

function SectionHeader({ children }: { children: string }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="labelMd" style={styles.sectionText}>{children}</AppText>
    </View>
  );
}

export function BrewFormScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const editingId = params.brewId;
  const [revealed, setRevealed] = useState(!!editingId);

  const [dose, setDose] = useState(""); const [water, setWater] = useState("");
  const [grind, setGrind] = useState(""); const [temp, setTemp] = useState("");
  const [dripper, setDripper] = useState("V60");
  const [pours, setPours] = useState(""); const [pourInterval, setPourInterval] = useState("");
  const [totalTime, setTotalTime] = useState(""); const [filterType, setFilterType] = useState("");
  const [taste, setTaste] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [brewedAt, setBrewedAt] = useState<number | null>(null);

  const setTasteKey = (key: string) => (v: string) => setTaste((t) => ({ ...t, [key]: v }));

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const b = await getBrew(await getDb(), editingId);
        if (!b) {
          modal.alert("Couldn't open brew", "Brew not found.");
          nav.goBack();
          return;
        }
        setDose(String(b.doseG)); setWater(String(b.waterG));
        setGrind(b.grind ?? ""); setTemp(b.waterTempC != null ? String(b.waterTempC) : "");
        setDripper(b.dripper ?? "V60");
        setPours(b.pours != null ? String(b.pours) : "");
        setPourInterval(b.pourIntervalS != null ? String(b.pourIntervalS) : "");
        setTotalTime(b.totalTimeS != null ? String(b.totalTimeS) : "");
        setFilterType(b.filterType ?? "");
        setTaste({
          acidity: b.acidity != null ? String(b.acidity) : "",
          sweetness: b.sweetness != null ? String(b.sweetness) : "",
          bitterness: b.bitterness != null ? String(b.bitterness) : "",
          body: b.body != null ? String(b.body) : "",
          clarity: b.clarity != null ? String(b.clarity) : "",
          rating: b.rating != null ? String(b.rating) : "",
        });
        setNotes(b.notes ?? ""); setCreatedAt(b.createdAt); setBrewedAt(b.brewedAt);
      } catch (e: any) {
        modal.alert("Couldn't open brew", String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  function applyParsed(p: BrewIntake) {
    if (p.doseG != null) setDose(String(p.doseG));
    if (p.waterG != null) setWater(String(p.waterG));
    if (p.grind) setGrind(p.grind);
    if (p.waterTempC != null) setTemp(String(p.waterTempC));
    if (p.dripper) setDripper(p.dripper);
    if (p.pours != null) setPours(String(p.pours));
    if (p.pourIntervalS != null) setPourInterval(String(p.pourIntervalS));
    if (p.totalTimeS != null) setTotalTime(String(p.totalTimeS));
    if (p.filterType) setFilterType(p.filterType);
    if (p.notes) setNotes(p.notes);
    setRevealed(true);
  }

  async function onSave() {
    const doseG = num(dose); const waterG = num(water);
    if (doseG == null || waterG == null || doseG <= 0 || waterG <= 0) {
      modal.alert("Missing details", "Dose and water are required and must be greater than 0."); return;
    }
    try {
      const db = await getDb();
      const brew = {
        id: editingId ?? makeId(), coffeeId: params.coffeeId,
        brewedAt: brewedAt ?? Date.now(), doseG, waterG, ratio: computeRatio(doseG, waterG),
        grind: grind.trim() || null, waterTempC: num(temp), dripper: dripper.trim() || null,
        pours: int(pours), pourIntervalS: int(pourInterval), totalTimeS: int(totalTime),
        filterType: filterType.trim() || null, tds: null, ey: null,
        acidity: int(taste.acidity ?? ""), sweetness: int(taste.sweetness ?? ""),
        bitterness: int(taste.bitterness ?? ""), body: int(taste.body ?? ""),
        clarity: int(taste.clarity ?? ""), rating: int(taste.rating ?? ""),
        notes: notes.trim() || null, createdAt: createdAt ?? Date.now(),
      };
      if (editingId) await updateBrew(db, brew); else await createBrew(db, brew);
      nav.goBack();
    } catch (e: any) {
      modal.alert("Couldn't save brew", String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    const ok = await modal.confirm({
      title: "Delete brew?",
      message: "This removes this brew log.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBrew(await getDb(), editingId);
      nav.goBack();
    } catch (e: any) {
      modal.alert("Couldn't delete brew", String(e?.message ?? e));
    }
  }

  const d = num(dose), w = num(water);
  const ratioPreview = d && w && d > 0 ? formatRatio(computeRatio(d, w)) : "—";

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

        {!revealed ? (
          <NaturalLanguageIntake
            kicker="Describe your brew"
            placeholder="15g in, 250g out, V60, 94°C, 3 pours about 30s apart, ~2:45 total. Bright and juicy."
            buildPrompt={buildBrewIntakePrompt}
            parse={parseBrewIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            <View style={styles.hero}>
              <AppText variant="labelSm">{editingId ? "Edit brew" : "Log brew"}</AppText>
              <AppText variant="headlineLg" style={styles.ratio}>{ratioPreview}</AppText>
              <AppText variant="labelMd" style={styles.ratioCaption}>Ratio · dose to water</AppText>
            </View>

            <SectionHeader>Recipe</SectionHeader>
            <View style={styles.row}>
              <TextField label="Dose (g)" value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="15" required style={styles.col} />
              <TextField label="Water (g)" value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder="250" required style={styles.col} />
            </View>
            <TextField label="Grind" value={grind} onChangeText={setGrind} placeholder="medium-fine / 18 clicks" autoCapitalize="none" />
            <TextField label="Water temp (°C)" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="94" />
            <ChipSelect label="Dripper" options={DRIPPERS} value={dripper} onChange={setDripper} clearable={false} />

            <SectionHeader>Process</SectionHeader>
            <View style={styles.row}>
              <TextField label="# Pours" value={pours} onChangeText={setPours} keyboardType="numeric" placeholder="3" style={styles.col} />
              <TextField label="Interval (s)" value={pourInterval} onChangeText={setPourInterval} keyboardType="numeric" placeholder="30" style={styles.col} />
              <TextField label="Total (s)" value={totalTime} onChangeText={setTotalTime} keyboardType="numeric" placeholder="165" style={styles.col} />
            </View>
            <ChipSelect label="Filter" options={FILTERS} value={filterType} onChange={setFilterType} />

            <SectionHeader>Taste</SectionHeader>
            <View style={styles.taste}>
              {TASTES.map((t) => (
                <ScaleSelect key={t.key} label={t.label} value={taste[t.key] ?? ""} onChange={setTasteKey(t.key)} />
              ))}
            </View>

            <SectionHeader>Notes</SectionHeader>
            <TextField label="Tasting notes" value={notes} onChangeText={setNotes} multiline placeholder="bitter finish, muted acidity" />

            <View style={styles.actions}>
              <PillButton label={editingId ? "Save changes" : "Save brew"} onPress={onSave} />
              {editingId ? <PillButton label="Delete brew" variant="danger" onPress={onDelete} style={styles.delete} /> : null}
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
  topBar: { flexDirection: "row", marginBottom: 8 },
  backBtn: { height: 34, justifyContent: "center" },
  hero: { alignItems: "center" },
  ratio: { fontSize: 44, lineHeight: 50, marginTop: 4 },
  ratioCaption: { color: colors.secondary, marginTop: 2 },
  sectionHeader: {
    marginTop: spacing.section,
    marginBottom: spacing.stack,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  sectionText: { color: colors.secondary },
  row: { flexDirection: "row", gap: spacing.gutter },
  col: { flex: 1 },
  taste: { gap: spacing.stack },
  actions: { marginTop: spacing.section },
  delete: { marginTop: spacing.gutter },
});
