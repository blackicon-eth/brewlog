import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listRecipes } from "../db/recipes";
import type { Recipe } from "../models/types";
import { formatRatioLocale } from "../lib/i18n/format";
import { methodSpec, type BrewMethodId } from "../lib/brewMethods";
import { methodLabel, methodWaterLabel, methodRatioNoun, methodOptions } from "../lib/i18n/labels";
import { useI18n } from "../i18n/LocaleProvider";
import { useQvac } from "../qvac/QvacProvider";
import { AppText, PillButton, ChipSelect, Chevron, useAppModal } from "../components/ui";
import { colors, fonts, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "Recipe">;
type Rt = RouteProp<RootStackParamList, "Recipe">;

// One read-only spec line: label on the left, value pushed right (same ruled look as BrewDetail).
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="bodyMd" style={styles.fieldLabel}>{label}</AppText>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function RecipeScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const { aiEnabled } = useQvac();
  const { dict, t, locale } = useI18n();

  const [method, setMethod] = useState<BrewMethodId>(params.method ?? "filter");
  // All of this coffee's pages, keyed by method — fetched once per focus so switching
  // methods is a synchronous map lookup (no per-tap DB round-trip, so no flicker).
  const [byMethod, setByMethod] = useState<Record<string, Recipe>>({});
  const [loaded, setLoaded] = useState(false);

  const spec = methodSpec(method);
  const methodOptionsList = useMemo(() => methodOptions(dict), [dict]);

  // Reload the whole set on focus, so edits made on the edit screen show on return. This is
  // a stack screen, so focus events fire. Method switching reads from state, not the DB.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const all = await listRecipes(await getDb(), params.coffeeId);
          if (!alive) return;
          setByMethod(Object.fromEntries(all.map((r) => [r.method, r])));
          setLoaded(true);
        } catch (e: any) {
          if (alive) modal.alert(t("recipes.loadErrorTitle"), String(e?.message ?? e));
        }
      })();
      return () => { alive = false; };
    }, [params.coffeeId, modal, t]),
  );

  const recipe = byMethod[method] ?? null;
  const exists = recipe !== null;
  const bothAmounts = recipe?.doseG != null && recipe?.waterG != null;

  // Below the dose:water hero, the remaining specs as ruled label/value rows. Dose or water
  // appear here only when there isn't a complete pair to headline.
  const rows: [string, string][] = recipe
    ? ([
        !bothAmounts && recipe.doseG != null ? [t("recipes.doseRowLabel"), `${recipe.doseG} g`] : null,
        // methodWaterLabel is "Water (g)"/"Yield (g)" (IT: "Acqua (g)"/"Resa (g)") — stripping
        // the trailing " (g)" works in both locales since the unit suffix format matches.
        !bothAmounts && recipe.waterG != null ? [methodWaterLabel(dict, spec.id).replace(" (g)", ""), `${recipe.waterG} g`] : null,
        recipe.grind ? [t("recipes.grindLabel"), recipe.grind] : null,
        spec.showTemp && recipe.waterTempC != null ? [t("recipes.waterTempRowLabel"), `${recipe.waterTempC} °C`] : null,
      ].filter(Boolean) as [string, string][])
    : [];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed header — back on the left, Edit/Add pill on the right (same layout as the coffee page). */}
      <View style={[styles.header, { paddingTop: insets.top + screenTopGap }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
          {loaded ? (
            <Pressable
              onPress={() => nav.navigate("RecipeEdit", { coffeeId: params.coffeeId, method })}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel={exists ? t("recipes.editA11y") : t("recipes.addA11y")}
            >
              <AppText variant="labelMd" style={styles.editText}>{exists ? t("common.edit") : t("common.add")}</AppText>
            </Pressable>
          ) : null}
        </View>
        <AppText variant="headlineLg" style={styles.title}>{t("recipes.title")}</AppText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <ChipSelect
          style={styles.methods}
          label={t("recipes.methodLabel")}
          options={methodOptionsList}
          value={method}
          onChange={(v) => setMethod(v as BrewMethodId)}
          clearable={false}
          columns={2}
        />

        {!loaded ? null : exists ? (
          <>
            {bothAmounts ? (
              <View style={styles.hero}>
                <AppText variant="headlineLg" style={styles.heroAmounts}>{`${recipe!.doseG}g : ${recipe!.waterG}g`}</AppText>
                <AppText variant="labelMd" style={styles.heroCaption}>{`${formatRatioLocale(recipe!.waterG! / recipe!.doseG!, locale)} · ${methodRatioNoun(dict, spec.id)}`}</AppText>
              </View>
            ) : null}

            {rows.length > 0 ? (
              <View style={styles.section}>
                {rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}
              </View>
            ) : null}

            {recipe!.notes ? (
              <View style={styles.section}>
                <AppText variant="labelMd" style={styles.sectionTitle}>{t("recipes.notesLabel")}</AppText>
                <AppText variant="bodyLg" style={styles.notes}>{recipe!.notes}</AppText>
              </View>
            ) : null}

            {/* A saved page with every field blank still has a "here" to stand on. */}
            {!bothAmounts && rows.length === 0 && !recipe!.notes ? (
              <AppText variant="bodyMd" style={styles.blank}>{t("recipes.blank")}</AppText>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <AppText variant="headlineMd" style={styles.emptyTitle}>
              {t("recipes.emptyTitle", { method: methodLabel(dict, spec.id).toLowerCase() })}
            </AppText>
            <AppText variant="bodyMd" style={styles.emptyBody}>
              {t("recipes.emptyBody")}
            </AppText>
          </View>
        )}

        {aiEnabled ? (
          <View style={styles.actions}>
            <PillButton
              label={"✦  " + t("recipes.suggestWithAi")}
              variant="neutral"
              onPress={() => nav.navigate("AdvisorResult", { kind: "bestRecipe", coffeeId: params.coffeeId, title: t("advisor.bestRecipeTitle"), method })}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.container, paddingBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { height: 34, justifyContent: "center" },
  editBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  editText: { color: colors.onSurfaceVariant },
  // Roomy line box + no extra font padding so EB Garamond's "p" descender doesn't clip on Android.
  title: { lineHeight: 48, includeFontPadding: false },
  content: { paddingHorizontal: spacing.container, paddingTop: 16 },
  methods: { marginBottom: 8 },
  hero: { marginTop: 12 },
  heroAmounts: { lineHeight: 44 },
  heroCaption: { color: colors.secondary, marginTop: 6 },
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
  notes: { marginTop: 6 },
  blank: { marginTop: 20, color: colors.secondary },
  empty: { marginTop: 32, alignItems: "center", paddingHorizontal: 16 },
  emptyTitle: { textAlign: "center", lineHeight: 34, includeFontPadding: false },
  emptyBody: { textAlign: "center", marginTop: 8, color: colors.onSurfaceVariant },
  actions: { marginTop: spacing.section },
});
