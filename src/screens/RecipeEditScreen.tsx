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
import { formatRatio } from "../lib/ratio";
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

  const method = params.method;
  const spec = methodSpec(method);

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
        if (alive) modal.alert("Couldn't load the recipe", String(e?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, [params.coffeeId, method, modal]);

  const doseN = parseRecipeNumber(dose);
  const waterN = parseRecipeNumber(water);
  const ratioText = doseN != null && waterN != null && doseN > 0 && waterN > 0 ? formatRatio(waterN / doseN) : "—";

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
      modal.alert("Couldn't save the recipe", String(e?.message ?? e));
    }
  }, [params.coffeeId, method, dose, water, grind, temp, notes, nav, modal]);

  const onDelete = useCallback(async () => {
    const yes = await modal.confirm({
      title: "Delete this recipe?",
      message: `Your ${spec.label} recipe for this coffee will be removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!yes) return;
    try {
      await deleteRecipe(await getDb(), params.coffeeId, method);
      nav.goBack();
    } catch (e: any) {
      modal.alert("Couldn't delete the recipe", String(e?.message ?? e));
    }
  }, [params.coffeeId, method, spec.label, nav, modal]);

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
        <AppText variant="headlineLg" style={styles.title}>{spec.label} recipe</AppText>

        <View style={styles.row}>
          <TextField label="Dose (g)" value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder={spec.dosePlaceholder} style={styles.col} />
          <TextField label={spec.waterLabel} value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder={spec.waterPlaceholder} style={styles.col} />
        </View>
        <AppText variant="labelMd" style={styles.ratio}>Ratio · {ratioText}</AppText>

        <TextField label="Grind" value={grind} onChangeText={setGrind} placeholder="medium-fine / 18 clicks" autoCapitalize="none" />
        {spec.showTemp ? (
          <TextField label="Water temp (°C)" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="94" />
        ) : null}
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Pour cadence, taste, tweaks to try next time…" multiline />

        <View style={styles.actions}>
          <PillButton label="Save recipe" onPress={onSave} />
          {exists ? (
            <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
              <AppText variant="labelMd" style={styles.deleteText}>Delete recipe</AppText>
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
