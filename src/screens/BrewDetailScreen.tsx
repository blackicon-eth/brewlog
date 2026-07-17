import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getBrew } from "../db/brews";
import type { Brew } from "../models/types";
import { formatSeconds } from "../lib/brewFormat";
import { formatRatioLocale, formatBrewDateLocale, formatBrewTimeLocale } from "../lib/i18n/format";
import { methodSpec, type ProcessFieldId } from "../lib/brewMethods";
import { methodLabel, methodTimeDetailLabel, methodRatioNoun } from "../lib/i18n/labels";
import type { Dict } from "../lib/i18n/en";
import { useI18n } from "../i18n/LocaleProvider";
import { AppText, PillButton, RatingChip, TasteRadar, Chevron, useAppModal } from "../components/ui";
import { useAdvisorGate } from "../hooks/useAdvisorGate";
import { colors, fonts, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "BrewDetail">;
type Rt = RouteProp<RootStackParamList, "BrewDetail">;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Stored values are the (legacy, English) db vocabulary — map the known ones through the
// dictionary so the detail page shows them in the active locale; anything unrecognized
// (a stale/legacy value) falls back to a capitalized rendering of the raw word.
function filterWord(dict: Dict, filterType: string): string {
  if (filterType === "white") return dict.brewDetail.filterWhite;
  if (filterType === "unbleached") return dict.brewDetail.filterUnbleached;
  return cap(filterType);
}
function heatWord(dict: Dict, heat: string): string {
  if (heat === "low") return dict.brewDetail.heatLow;
  if (heat === "medium") return dict.brewDetail.heatMedium;
  if (heat === "high") return dict.brewDetail.heatHigh;
  return cap(heat);
}

// A titled group of label/value lines; hidden entirely when no field has a value.
function FieldSection({ title, rows }: { title: string; rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      <AppText variant="labelMd" style={styles.sectionTitle}>{title}</AppText>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.field}>
          <AppText variant="bodyMd" style={styles.fieldLabel}>{label}</AppText>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

// A 1–5 taste attribute as five filled/empty segments — the "science" made visual.
function TasteRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.field}>
      <AppText variant="bodyMd" style={styles.fieldLabel}>{label}</AppText>
      <View style={styles.segments}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={[styles.segment, n <= value && styles.segmentOn]} />
        ))}
      </View>
    </View>
  );
}

export function BrewDetailScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const gate = useAdvisorGate();
  const { dict, t, locale } = useI18n();
  const [brew, setBrew] = useState<Brew | null>(null);

  const load = useCallback(() => {
    (async () => {
      try {
        const b = await getBrew(await getDb(), params.brewId);
        if (!b) {
          modal.alert(t("brewDetail.openErrorTitle"), t("brewDetail.openErrorBody"));
          nav.goBack();
          return;
        }
        setBrew(b);
      } catch (e: any) {
        modal.alert(t("brewDetail.openErrorTitle"), String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [params.brewId, nav, modal, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const spec = methodSpec(brew?.method);
  const has = (f: ProcessFieldId) => spec.process.includes(f);

  const recipeRows: [string, string][] = brew
    ? ([
        [t("brewDetail.fieldMethod"), methodLabel(dict, spec.id)],
        [t("brewDetail.fieldGrind"), brew.grind ?? null],
        [t("brewDetail.fieldWaterTemp"), spec.showTemp && brew.waterTempC != null ? `${brew.waterTempC} °C` : null],
        [t("brewDetail.fieldFilter"), has("filterType") && brew.filterType ? filterWord(dict, brew.filterType) : null],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  const processRows: [string, string][] = brew
    ? ([
        [t("brewDetail.fieldPours"), has("pours") && brew.pours != null ? String(brew.pours) : null],
        [t("brewDetail.fieldPourInterval"), has("pours") && brew.pourIntervalS != null ? `${brew.pourIntervalS} s` : null],
        [t("brewDetail.fieldPreheat"), has("preheat") && brew.preheat != null ? (brew.preheat ? t("brewDetail.yes") : t("brewDetail.no")) : null],
        [t("brewDetail.fieldHeat"), has("heat") && brew.heat ? heatWord(dict, brew.heat) : null],
        [methodTimeDetailLabel(dict, spec.id), has("time") && brew.totalTimeS != null ? formatSeconds(brew.totalTimeS) : null],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  const tasteAxes: Array<[string, number | null]> = brew
    ? [
        [t("brewDetail.tasteAcidity"), brew.acidity ?? null],
        [t("brewDetail.tasteSweetness"), brew.sweetness ?? null],
        [t("brewDetail.tasteBitterness"), brew.bitterness ?? null],
        [t("brewDetail.tasteBody"), brew.body ?? null],
        [t("brewDetail.tasteClarity"), brew.clarity ?? null],
      ]
    : [];
  const taste = tasteAxes.filter(([, v]) => v != null) as [string, number][];
  // The tasting pentagon needs enough vertices to read as a shape; below three rated
  // attributes the plain rows say it better.
  const tasteValues = tasteAxes.map(([, v]) => v);
  const tasteLabels = tasteAxes.map(([label]) => label);
  const showRadar = taste.length >= 3;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed header — back on the left, Edit pill on the right (same layout as the coffee page). */}
      <View style={[styles.header, { paddingTop: insets.top + screenTopGap }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId, brewId: params.brewId })}
            style={styles.editBtn}
          >
            <AppText variant="labelMd" style={styles.editText}>{t("common.edit")}</AppText>
          </Pressable>
        </View>
      </View>

      {brew ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroInfo}>
              <AppText variant="labelSm">{`${formatBrewDateLocale(brew.brewedAt, locale)} · ${formatBrewTimeLocale(brew.brewedAt, locale)}`}</AppText>
              <AppText variant="headlineLg" style={styles.recipe}>{`${brew.doseG}g : ${brew.waterG}g`}</AppText>
              <AppText variant="labelMd" style={styles.ratioCaption}>{`${formatRatioLocale(brew.ratio, locale)} · ${methodRatioNoun(dict, spec.id)}`}</AppText>
            </View>
            {brew.rating != null ? <RatingChip value={brew.rating} size="lg" /> : null}
          </View>

          <FieldSection title={t("brewDetail.sectionRecipe")} rows={recipeRows} />
          <FieldSection title={t("brewDetail.sectionProcess")} rows={processRows} />

          {taste.length > 0 ? (
            <View style={styles.section}>
              <AppText variant="labelMd" style={styles.sectionTitle}>{t("brewDetail.sectionTaste")}</AppText>
              {showRadar ? (
                <TasteRadar values={tasteValues} labels={tasteLabels} />
              ) : (
                taste.map(([label, value]) => <TasteRow key={label} label={label} value={value} />)
              )}
            </View>
          ) : null}

          {brew.notes ? (
            <View style={styles.section}>
              <AppText variant="labelMd" style={styles.sectionTitle}>{t("brewDetail.sectionNotes")}</AppText>
              <AppText variant="bodyLg" style={styles.notes}>{brew.notes}</AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <PillButton
              label={"✦  " + t("brewDetail.diagnoseThisBrew")}
              variant="primary"
              onPress={() => void gate(() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: params.brewId, title: t("advisor.diagnoseTitle") }))}
            />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.container, paddingBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { height: 34, justifyContent: "center" },
  editBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  editText: { color: colors.onSurfaceVariant },
  content: { paddingHorizontal: spacing.container, paddingTop: 12 },
  // Hero: info column on the left, rating chip pushed to the right, vertically centered.
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  heroInfo: { flexShrink: 1 },
  // lineHeight clears EB Garamond's "g" descender on Android; the tall line box already
  // adds ~6px above the glyph, so the amounts need no extra top margin to match the gap below.
  recipe: { marginTop: 0, lineHeight: 44 },
  ratioCaption: { color: colors.secondary, marginTop: 6 },
  section: { marginTop: spacing.section },
  sectionTitle: { color: colors.secondary, marginBottom: 4 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  fieldLabel: { color: colors.onSurfaceVariant },
  fieldValue: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onSurface, textAlign: "right", flexShrink: 1 },
  segments: { flexDirection: "row", gap: 4 },
  segment: { width: 16, height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh },
  segmentOn: { backgroundColor: colors.tertiary },
  notes: { marginTop: 6 },
  actions: { marginTop: spacing.section },
});
