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
import { formatRatio } from "../lib/ratio";
import { formatSeconds, formatBrewDate, formatBrewTime } from "../lib/brewFormat";
import { methodSpec, type ProcessFieldId } from "../lib/brewMethods";
import { AppText, PillButton, RatingChip, TasteRadar, Chevron, useAppModal } from "../components/ui";
import { useAdvisorGate } from "../hooks/useAdvisorGate";
import { colors, fonts, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "BrewDetail">;
type Rt = RouteProp<RootStackParamList, "BrewDetail">;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
  const [brew, setBrew] = useState<Brew | null>(null);

  const load = useCallback(() => {
    (async () => {
      try {
        const b = await getBrew(await getDb(), params.brewId);
        if (!b) {
          modal.alert("Couldn't open brew", "Brew not found.");
          nav.goBack();
          return;
        }
        setBrew(b);
      } catch (e: any) {
        modal.alert("Couldn't open brew", String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [params.brewId, nav, modal]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const spec = methodSpec(brew?.method);
  const has = (f: ProcessFieldId) => spec.process.includes(f);

  const recipeRows: [string, string][] = brew
    ? ([
        ["Method", spec.label],
        ["Grind", brew.grind ?? null],
        ["Water temp", spec.showTemp && brew.waterTempC != null ? `${brew.waterTempC} °C` : null],
        ["Filter", has("filterType") && brew.filterType ? cap(brew.filterType) : null],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  const processRows: [string, string][] = brew
    ? ([
        ["Pours", has("pours") && brew.pours != null ? String(brew.pours) : null],
        ["Pour interval", has("pours") && brew.pourIntervalS != null ? `${brew.pourIntervalS} s` : null],
        ["Preheat", has("preheat") && brew.preheat != null ? (brew.preheat ? "Yes" : "No") : null],
        ["Heat", has("heat") && brew.heat ? cap(brew.heat) : null],
        [spec.timeDetailLabel, has("time") && brew.totalTimeS != null ? formatSeconds(brew.totalTimeS) : null],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  const taste: [string, number][] = brew
    ? ([
        ["Acidity", brew.acidity],
        ["Sweetness", brew.sweetness],
        ["Bitterness", brew.bitterness],
        ["Body", brew.body],
        ["Clarity", brew.clarity],
      ].filter(([, v]) => v != null) as [string, number][])
    : [];
  // The tasting pentagon needs enough vertices to read as a shape; below three rated
  // attributes the plain rows say it better.
  const tasteValues: Array<number | null> = brew
    ? [brew.acidity ?? null, brew.sweetness ?? null, brew.bitterness ?? null, brew.body ?? null, brew.clarity ?? null]
    : [];
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
            <AppText variant="labelMd" style={styles.editText}>Edit</AppText>
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
              <AppText variant="labelSm">{`${formatBrewDate(brew.brewedAt)} · ${formatBrewTime(brew.brewedAt)}`}</AppText>
              <AppText variant="headlineLg" style={styles.recipe}>{`${brew.doseG}g : ${brew.waterG}g`}</AppText>
              <AppText variant="labelMd" style={styles.ratioCaption}>{`${formatRatio(brew.ratio)} · ${spec.ratioNoun}`}</AppText>
            </View>
            {brew.rating != null ? <RatingChip value={brew.rating} size="lg" /> : null}
          </View>

          <FieldSection title="Recipe" rows={recipeRows} />
          <FieldSection title="Process" rows={processRows} />

          {taste.length > 0 ? (
            <View style={styles.section}>
              <AppText variant="labelMd" style={styles.sectionTitle}>Taste</AppText>
              {showRadar ? (
                <TasteRadar values={tasteValues} />
              ) : (
                taste.map(([label, value]) => <TasteRow key={label} label={label} value={value} />)
              )}
            </View>
          ) : null}

          {brew.notes ? (
            <View style={styles.section}>
              <AppText variant="labelMd" style={styles.sectionTitle}>Notes</AppText>
              <AppText variant="bodyLg" style={styles.notes}>{brew.notes}</AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <PillButton
              label="✦  Diagnose this brew"
              variant="primary"
              onPress={() => void gate(() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: params.brewId, title: "Diagnose brew" }))}
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
