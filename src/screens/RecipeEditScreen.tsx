import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getRecipe, upsertRecipe, deleteRecipe } from "../db/recipes";
import { methodSpec } from "../lib/brewMethods";
import { methodLabel, methodWaterLabel, methodDosePlaceholder, methodWaterPlaceholder } from "../lib/i18n/labels";
import { useI18n } from "../i18n/LocaleProvider";
import { formatRatioLocale } from "../lib/i18n/format";
import { parseRecipeNumber, normalizeRecipeText } from "../lib/recipe";
import { AppText, TextField, PillButton, Chevron, useAppModal } from "../components/ui";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "RecipeEdit">;
type Rt = RouteProp<RootStackParamList, "RecipeEdit">;

export function RecipeEditScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const { dict, t, locale } = useI18n();

  const method = params.method;
  const spec = methodSpec(method);
  const label = methodLabel(dict, spec.id);

  const [exists, setExists] = useState(false);
  const [dose, setDose] = useState("");
  const [water, setWater] = useState("");
  const [grind, setGrind] = useState("");
  const [temp, setTemp] = useState("");
  const [notes, setNotes] = useState("");

  // Load this method's saved page once, into the editable fields.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getRecipe(await getDb(), params.coffeeId, method);
        if (!alive) return;
        setExists(r !== null);
        setDose(r?.doseG != null ? String(r.doseG) : "");
        setWater(r?.waterG != null ? String(r.waterG) : "");
        setGrind(r?.grind ?? "");
        setTemp(r?.waterTempC != null ? String(r.waterTempC) : "");
        setNotes(r?.notes ?? "");
      } catch (e: any) {
        if (alive) modal.alert(t("recipes.loadErrorTitle"), String(e?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, [params.coffeeId, method, modal, t]);

  const doseN = parseRecipeNumber(dose);
  const waterN = parseRecipeNumber(water);
  const ratioText = doseN != null && waterN != null && doseN > 0 && waterN > 0 ? formatRatioLocale(waterN / doseN, locale) : "-";

  const onSave = useCallback(async () => {
    try {
      await upsertRecipe(await getDb(), {
        coffeeId: params.coffeeId,
        method,
        doseG: parseRecipeNumber(dose),
        waterG: parseRecipeNumber(water),
        grind: normalizeRecipeText(grind),
        waterTempC: parseRecipeNumber(temp),
        notes: normalizeRecipeText(notes),
        updatedAt: Date.now(),
      });
      nav.goBack();
    } catch (e: any) {
      modal.alert(t("recipes.saveErrorTitle"), String(e?.message ?? e));
    }
  }, [params.coffeeId, method, dose, water, grind, temp, notes, nav, modal, t]);

  const onDelete = useCallback(async () => {
    const yes = await modal.confirm({
      title: t("recipes.deleteConfirmTitle"),
      message: t("recipes.deleteConfirmMessage", { method: label }),
      confirmLabel: t("common.delete"),
      destructive: true,
    });
    if (!yes) return;
    try {
      await deleteRecipe(await getDb(), params.coffeeId, method);
      nav.goBack();
    } catch (e: any) {
      modal.alert(t("recipes.deleteErrorTitle"), String(e?.message ?? e));
    }
  }, [params.coffeeId, method, label, nav, modal, t]);

  return (
    // Whole screen inside the KAV (behavior "height" on Android, matching CoffeeForm/BrewForm)
    // with the header inside the ScrollView, so the window resize lifts the lower fields
    // above the keyboard instead of leaving them covered.
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + screenTopGap, paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
          <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
        </Pressable>
        <AppText variant="headlineLg" style={styles.title}>{t("recipes.editorTitle", { method: label })}</AppText>

        <View style={styles.row}>
          <TextField label={t("recipes.doseFieldLabel")} value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder={methodDosePlaceholder(spec.id)} style={styles.col} />
          <TextField label={methodWaterLabel(dict, spec.id)} value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder={methodWaterPlaceholder(spec.id)} style={styles.col} />
        </View>
        <AppText variant="labelMd" style={styles.ratio}>{t("recipes.ratioLabel", { ratio: ratioText })}</AppText>

        <TextField label={t("recipes.grindLabel")} value={grind} onChangeText={setGrind} placeholder={t("recipes.grindPlaceholder")} autoCapitalize="none" />
        {spec.showTemp ? (
          <TextField label={t("recipes.waterTempFieldLabel")} value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="94" />
        ) : null}
        <TextField label={t("recipes.notesLabel")} value={notes} onChangeText={setNotes} placeholder={t("recipes.notesPlaceholder")} multiline />

        <View style={styles.actions}>
          <PillButton label={t("recipes.saveRecipe")} onPress={onSave} />
          {exists ? (
            <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
              <AppText variant="labelMd" style={styles.deleteText}>{t("recipes.deleteRecipe")}</AppText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  backBtn: { height: 34, justifyContent: "center", marginBottom: 8 },
  // Roomy line box + no extra font padding so EB Garamond descenders don't clip on Android.
  title: { lineHeight: 48, includeFontPadding: false, marginBottom: spacing.base },
  body: { paddingHorizontal: spacing.container },
  row: { flexDirection: "row", gap: spacing.gutter },
  col: { flex: 1 },
  ratio: { marginTop: -6, marginBottom: 16, color: colors.secondary },
  actions: { marginTop: 24, gap: 12 },
  deleteBtn: { alignSelf: "center", padding: 6 },
  deleteText: { color: colors.tertiary },
});
