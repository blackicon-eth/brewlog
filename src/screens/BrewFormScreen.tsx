import React, { useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Brew } from "../models/types";
import { getDb } from "../db/database";
import { getBrew, createBrew, updateBrew, deleteBrew } from "../db/brews";
import { computeRatio } from "../lib/ratio";
import { formatRatioLocale } from "../lib/i18n/format";
import { makeId } from "../lib/ids";
import { AppText, TextField, ChipSelect, ScaleSelect, PillButton, NaturalLanguageIntake, Chevron, TrashIcon, useAppModal, type ChipOption } from "../components/ui";
import { BrewedAtModal } from "../components/BrewedAtModal";
import { formatBrewedAtValue } from "../lib/brewedAt";
import { buildBrewIntakePrompt, parseBrewIntake, type BrewIntake } from "../qvac/intake";
import { useQvac } from "../qvac/QvacProvider";
import { methodSpec, isBrewMethodId, type BrewMethodId, type ProcessFieldId } from "../lib/brewMethods";
import {
  methodOptions, methodWaterLabel, methodDosePlaceholder, methodWaterPlaceholder,
  methodTimeLabel, methodTimePlaceholder, methodRatioNoun, brewedAtDayLabels,
} from "../lib/i18n/labels";
import type { Dict } from "../lib/i18n/en";
import { useI18n } from "../i18n/LocaleProvider";
import { colors, radii, shadows, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "BrewForm">;
type Rt = RouteProp<RootStackParamList, "BrewForm">;

const num = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
const int = (s: string): number | null => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };

function filterOptions(dict: Dict): ChipOption[] {
  return [
    { label: dict.brewForm.filterWhite, value: "white" },
    { label: dict.brewForm.filterUnbleached, value: "unbleached" },
  ];
}
function preheatOptions(dict: Dict): ChipOption[] {
  return [
    { label: dict.brewForm.preheatYes, value: "yes" },
    { label: dict.brewForm.preheatNo, value: "no" },
  ];
}
function heatOptions(dict: Dict): ChipOption[] {
  return [
    { label: dict.brewForm.heatLow, value: "low" },
    { label: dict.brewForm.heatMedium, value: "medium" },
    { label: dict.brewForm.heatHigh, value: "high" },
  ];
}
function tasteOptions(dict: Dict): { label: string; key: string }[] {
  return [
    { label: dict.brewForm.tasteAcidity, key: "acidity" },
    { label: dict.brewForm.tasteSweetness, key: "sweetness" },
    { label: dict.brewForm.tasteBitterness, key: "bitterness" },
    { label: dict.brewForm.tasteBody, key: "body" },
    { label: dict.brewForm.tasteClarity, key: "clarity" },
    { label: dict.brewForm.tasteOverall, key: "rating" },
  ];
}

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
  const { aiEnabled } = useQvac();
  const { dict, locale, t } = useI18n();
  const editingId = params.brewId;
  const methodChips = useMemo(() => methodOptions(dict), [dict]);
  const filterChips = useMemo(() => filterOptions(dict), [dict]);
  const preheatChips = useMemo(() => preheatOptions(dict), [dict]);
  const heatChips = useMemo(() => heatOptions(dict), [dict]);
  const tasteRows = useMemo(() => tasteOptions(dict), [dict]);
  const dayLabels = useMemo(() => brewedAtDayLabels(dict, locale), [dict, locale]);
  // The freeform intake box only exists when the assistant is on — with it off, a new
  // log must open straight on the manual form (the intake renders null and would leave
  // the page empty forever).
  const [revealed, setRevealed] = useState(!!editingId || !aiEnabled);

  const [dose, setDose] = useState(""); const [water, setWater] = useState("");
  const [grind, setGrind] = useState(""); const [temp, setTemp] = useState("");
  const [pours, setPours] = useState(""); const [pourInterval, setPourInterval] = useState("");
  const [totalTime, setTotalTime] = useState(""); const [filterType, setFilterType] = useState("");
  const [method, setMethod] = useState<BrewMethodId>("filter");
  const [preheat, setPreheat] = useState(""); // "" | "yes" | "no"
  const [heat, setHeat] = useState("");       // "" | "low" | "medium" | "high"
  const [taste, setTaste] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [brewedAt, setBrewedAt] = useState<number | null>(null);
  const [brewedAtOpen, setBrewedAtOpen] = useState(false);

  const spec = methodSpec(method);
  const setTasteKey = (key: string) => (v: string) => setTaste((prev) => ({ ...prev, [key]: v }));

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const b = await getBrew(await getDb(), editingId);
        if (!b) {
          modal.alert(t("brewForm.openErrorTitle"), t("brewForm.openErrorBody"));
          nav.goBack();
          return;
        }
        setDose(String(b.doseG)); setWater(String(b.waterG));
        setGrind(b.grind ?? ""); setTemp(b.waterTempC != null ? String(b.waterTempC) : "");
        setPours(b.pours != null ? String(b.pours) : "");
        setPourInterval(b.pourIntervalS != null ? String(b.pourIntervalS) : "");
        setTotalTime(b.totalTimeS != null ? String(b.totalTimeS) : "");
        setFilterType(b.filterType ?? "");
        setMethod(b.method);
        setPreheat(b.preheat == null ? "" : b.preheat ? "yes" : "no");
        setHeat(b.heat ?? "");
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
        modal.alert(t("brewForm.openErrorTitle"), String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  function applyParsed(p: BrewIntake) {
    if (p.method) setMethod(p.method);
    if (p.doseG != null) setDose(String(p.doseG));
    if (p.waterG != null) setWater(String(p.waterG));
    if (p.grind) setGrind(p.grind);
    if (p.waterTempC != null) setTemp(String(p.waterTempC));
    if (p.pours != null) setPours(String(p.pours));
    if (p.pourIntervalS != null) setPourInterval(String(p.pourIntervalS));
    if (p.totalTimeS != null) setTotalTime(String(p.totalTimeS));
    if (p.filterType) setFilterType(p.filterType);
    if (p.notes) setNotes(p.notes);
    if (p.preheat != null) setPreheat(p.preheat ? "yes" : "no");
    if (p.heat) setHeat(p.heat);
    setRevealed(true);
  }

  async function onSave() {
    const doseG = num(dose); const waterG = num(water);
    if (doseG == null || waterG == null || doseG <= 0 || waterG <= 0) {
      const word = method === "espresso" ? t("brewForm.yieldWord") : t("brewForm.waterWord");
      modal.alert(t("brewForm.missingTitle"), t("brewForm.missingBody", { word })); return;
    }
    try {
      const db = await getDb();
      const has = (f: ProcessFieldId) => spec.process.includes(f);
      const brew: Brew = {
        id: editingId ?? makeId(), coffeeId: params.coffeeId,
        brewedAt: brewedAt ?? Date.now(), method,
        doseG, waterG, ratio: computeRatio(doseG, waterG),
        grind: grind.trim() || null,
        waterTempC: spec.showTemp ? num(temp) : null,
        dripper: null, // retired input — legacy rows lose it on their next edit-save
        pours: has("pours") ? int(pours) : null,
        pourIntervalS: has("pours") ? int(pourInterval) : null,
        totalTimeS: has("time") ? int(totalTime) : null,
        filterType: has("filterType") ? filterType.trim() || null : null,
        preheat: has("preheat") ? (preheat === "yes" ? true : preheat === "no" ? false : null) : null,
        heat: has("heat") && (heat === "low" || heat === "medium" || heat === "high") ? heat : null,
        acidity: int(taste.acidity ?? ""), sweetness: int(taste.sweetness ?? ""),
        bitterness: int(taste.bitterness ?? ""), body: int(taste.body ?? ""),
        clarity: int(taste.clarity ?? ""), rating: int(taste.rating ?? ""),
        notes: notes.trim() || null, createdAt: createdAt ?? Date.now(),
      };
      if (editingId) await updateBrew(db, brew); else await createBrew(db, brew);
      nav.goBack();
    } catch (e: any) {
      modal.alert(t("brewForm.saveErrorTitle"), String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    const ok = await modal.confirm({
      title: t("brewForm.deleteConfirmTitle"),
      message: t("brewForm.deleteConfirmMessage"),
      confirmLabel: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBrew(await getDb(), editingId);
      nav.goBack();
    } catch (e: any) {
      modal.alert(t("brewForm.deleteErrorTitle"), String(e?.message ?? e));
    }
  }

  const d = num(dose), w = num(water);
  const ratioPreview = d && w && d > 0 ? formatRatioLocale(computeRatio(d, w), locale) : "-";

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
          {editingId ? (
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("brewForm.deleteA11y")}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
            >
              <TrashIcon size={16} color={colors.tertiary} thickness={1.6} />
              <AppText variant="labelMd" style={styles.deleteText}>{t("common.delete")}</AppText>
            </Pressable>
          ) : null}
        </View>

        {!revealed ? (
          <NaturalLanguageIntake
            kicker={t("brewForm.intakeKicker")}
            placeholder={t("brewForm.intakePlaceholder")}
            buildPrompt={buildBrewIntakePrompt}
            parse={parseBrewIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            {/* Same editorial hero card as the coffee form, with the brew form's own
                still: a Chemex mid-pour (Unsplash, license-free). */}
            <View style={styles.heroImageWrap}>
              <Image source={require("../../assets/brew-hero.png")} style={styles.heroImage} resizeMode="cover" />
            </View>

            <View style={styles.hero}>
              <AppText variant="labelSm">{editingId ? t("brewForm.editKicker") : t("brewForm.newKicker")}</AppText>
              <AppText variant="headlineLg" style={styles.ratio}>{ratioPreview}</AppText>
              <AppText variant="labelMd" style={styles.ratioCaption}>
                {t("brewForm.ratioCaption", { noun: methodRatioNoun(dict, spec.id) })}
              </AppText>
            </View>

            <SectionHeader>{t("brewForm.sectionRecipe")}</SectionHeader>
            <ChipSelect label={t("brewForm.methodLabel")} options={methodChips} value={method} columns={2}
              onChange={(v) => { if (isBrewMethodId(v)) setMethod(v); }} clearable={false} />
            <View style={styles.row}>
              <TextField label={t("brewForm.doseLabel")} value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder={methodDosePlaceholder(spec.id)} required style={styles.col} />
              <TextField label={methodWaterLabel(dict, spec.id)} value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder={methodWaterPlaceholder(spec.id)} required style={styles.col} />
            </View>
            <TextField label={t("brewForm.grindLabel")} value={grind} onChangeText={setGrind} placeholder={t("brewForm.grindPlaceholder")} autoCapitalize="none" />
            {spec.showTemp ? (
              <TextField label={t("brewForm.waterTempLabel")} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="94" />
            ) : null}

            <SectionHeader>{t("brewForm.sectionProcess")}</SectionHeader>
            {spec.process.map((f) => {
              if (f === "filterType") return <ChipSelect key={f} label={t("brewForm.filterLabel")} options={filterChips} value={filterType} onChange={setFilterType} />;
              if (f === "pours") return (
                <View key={f} style={styles.row}>
                  <TextField label={t("brewForm.poursCountLabel")} value={pours} onChangeText={setPours} keyboardType="numeric" placeholder="3" style={styles.col} />
                  <TextField label={t("brewForm.intervalLabel")} value={pourInterval} onChangeText={setPourInterval} keyboardType="numeric" placeholder="30" style={styles.col} />
                </View>
              );
              if (f === "preheat") return <ChipSelect key={f} label={t("brewForm.preheatLabel")} options={preheatChips} value={preheat} onChange={setPreheat} />;
              if (f === "heat") return <ChipSelect key={f} label={t("brewForm.heatLabel")} options={heatChips} value={heat} onChange={setHeat} />;
              return <TextField key={f} label={methodTimeLabel(dict, spec.id)} value={totalTime} onChangeText={setTotalTime} keyboardType="numeric" placeholder={methodTimePlaceholder(spec.id)} />;
            })}

            <SectionHeader>{t("brewForm.sectionTaste")}</SectionHeader>
            <View style={styles.taste}>
              {tasteRows.map((row) => (
                <ScaleSelect key={row.key} label={row.label} value={taste[row.key] ?? ""} onChange={setTasteKey(row.key)} />
              ))}
            </View>

            <SectionHeader>{t("brewForm.sectionBrewedOn")}</SectionHeader>
            {/* One quiet row; the details live in the Brewed sheet. "Now" = untouched
                new brew, which keeps the stamp-at-save behavior below. */}
            <Pressable
              onPress={() => setBrewedAtOpen(true)}
              accessibilityRole="button"
              style={styles.brewedBox}
            >
              <AppText variant="bodyMd" style={styles.brewedValue}>
                {brewedAt == null ? t("brewForm.brewedNow") : formatBrewedAtValue(brewedAt, dayLabels)}
              </AppText>
              <Chevron direction="right" size={11} thickness={2.5} color={colors.outline} />
            </Pressable>

            <SectionHeader>{t("brewForm.sectionNotes")}</SectionHeader>
            <TextField value={notes} onChangeText={setNotes} multiline placeholder={t("brewForm.notesPlaceholder")} />

            <View style={styles.actions}>
              <PillButton label={editingId ? t("brewForm.saveEdit") : t("brewForm.saveNew")} onPress={onSave} />
            </View>
          </>
        )}
      </ScrollView>
      <BrewedAtModal
        visible={brewedAtOpen}
        value={brewedAt}
        onCancel={() => setBrewedAtOpen(false)}
        onSet={(ts) => { setBrewedAt(ts); setBrewedAtOpen(false); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.container },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { height: 34, justifyContent: "center" },
  // Ghost trash + "Delete" pill, top-right of the form (edit mode only).
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant,
    paddingLeft: 12, paddingRight: 14, paddingVertical: 7,
  },
  deletePressed: { opacity: 0.55, backgroundColor: "rgba(171,11,24,0.08)" },
  deleteText: { color: colors.tertiary },
  heroImageWrap: { marginBottom: spacing.stack, borderRadius: radii.lg, backgroundColor: colors.surfaceLowest, ...shadows.card },
  heroImage: { width: "100%", height: 140, borderRadius: radii.lg },
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
  brewedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  brewedValue: { color: colors.onSurface },
  taste: { gap: spacing.stack },
  actions: { marginTop: spacing.section },
});
