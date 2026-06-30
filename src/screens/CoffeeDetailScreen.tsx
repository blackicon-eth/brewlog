import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee } from "../db/coffees";
import { listBrewsForCoffee } from "../db/brews";
import type { Brew, Coffee } from "../models/types";
import { formatRatio, } from "../lib/ratio";
import { formatSeconds } from "../lib/brewFormat";
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeDetail">;
type Rt = RouteProp<RootStackParamList, "CoffeeDetail">;

export function CoffeeDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [brews, setBrews] = useState<Brew[]>([]);

  const load = useCallback(() => {
    (async () => {
      try {
        const db = await getDb();
        setCoffee(await getCoffee(db, params.coffeeId));
        setBrews(await listBrewsForCoffee(db, params.coffeeId));
      } catch (e: any) {
        Alert.alert("Couldn't load coffee", String(e?.message ?? e));
      }
    })();
  }, [params.coffeeId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasBrews = brews.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>{coffee ? `${coffee.roaster} — ${coffee.name}` : "…"}</Text>
        <Pressable onPress={() => coffee && nav.navigate("CoffeeForm", { coffeeId: coffee.id })}>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      </View>

      <TouchableOpacity
        style={[styles.recipe, !hasBrews && styles.disabled]}
        disabled={!hasBrews}
        onPress={() => nav.navigate("AdvisorResult", { kind: "bestRecipe", coffeeId: params.coffeeId, title: "Best recipe" })}
      >
        <Text style={styles.recipeText}>{hasBrews ? "✨ Best recipe (AI)" : "Log a brew to unlock AI"}</Text>
      </TouchableOpacity>

      <FlatList
        data={brews}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No brews logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId, brewId: item.id })}>
              <Text style={styles.brewTitle}>
                {item.doseG}g:{item.waterG}g ({formatRatio(item.ratio)})
                {item.totalTimeS != null ? ` · ${formatSeconds(item.totalTimeS)}` : ""}
                {item.rating != null ? ` · ${item.rating}/5` : ""}
              </Text>
              {item.grind ? <Text style={styles.brewSub}>grind {item.grind}{item.waterTempC != null ? ` · ${item.waterTempC}C` : ""}</Text> : null}
            </Pressable>
            <TouchableOpacity
              style={styles.diag}
              onPress={() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: item.id, title: "Diagnose brew" })}
            >
              <Text style={styles.diagText}>Diagnose →</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId })}>
        <Text style={styles.fabText}>+ Log brew</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { color: theme.text, fontSize: 18, fontWeight: "700", flex: 1 },
  edit: { color: theme.accent, fontWeight: "600" },
  recipe: { marginHorizontal: 16, backgroundColor: theme.surface, borderRadius: 12, padding: 14, alignItems: "center" },
  recipeText: { color: theme.text, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  list: { padding: 16, gap: 10 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 24 },
  card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brewTitle: { color: theme.text, fontWeight: "600" },
  brewSub: { color: theme.muted, marginTop: 2, fontSize: 12 },
  diag: { paddingHorizontal: 10, paddingVertical: 6 },
  diagText: { color: theme.accent, fontWeight: "600" },
  fab: { position: "absolute", right: 16, bottom: 24, backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28 },
  fabText: { color: "white", fontWeight: "600" },
});
