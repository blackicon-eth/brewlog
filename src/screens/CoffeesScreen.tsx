import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listCoffees } from "../db/coffees";
import { listBrewsForCoffee, avgRating } from "../db/brews";
import type { Coffee } from "../models/types";
import { StatusBadge } from "../components/StatusBadge";
import { useQvac } from "../qvac/QvacProvider";
import { theme } from "../theme";
import * as Device from "expo-device";

type Nav = NativeStackNavigationProp<RootStackParamList, "Coffees">;
type Row = Coffee & { brewCount: number; avg: number | null };

export function CoffeesScreen() {
  const nav = useNavigation<Nav>();
  const { prepare } = useQvac();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(() => {
    (async () => {
      try {
        const db = await getDb();
        const coffees = await listCoffees(db);
        const withStats = await Promise.all(coffees.map(async (c) => {
          const brews = await listBrewsForCoffee(db, c.id);
          return { ...c, brewCount: brews.length, avg: avgRating(brews) };
        }));
        setRows(withStats);
      } catch (e: any) {
        Alert.alert("Couldn't load coffees", String(e?.message ?? e));
      }
    })();
  }, []);

  useFocusEffect(useCallback(() => { prepare(); load(); }, [prepare, load]));

  return (
    <View style={styles.screen}>
      <View style={styles.header}><StatusBadge /></View>
      {!Device.isDevice ? (
        <Text style={styles.notice}>
          ⚠️ Running on an emulator. QVAC requires a physical device — the AI advisor will not work here.
        </Text>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={styles.empty}>No coffees yet. Add your first bag.</Text>}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => nav.navigate("CoffeeDetail", { coffeeId: item.id })}>
            <Text style={styles.title}>{item.roaster} — {item.name}</Text>
            <Text style={styles.sub}>
              {item.brewCount} brew{item.brewCount === 1 ? "" : "s"}
              {item.avg != null ? ` · avg ${item.avg.toFixed(1)}/5` : ""}
            </Text>
          </Pressable>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate("CoffeeForm", {})}>
        <Text style={styles.fabText}>+ Add coffee</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  list: { padding: 16, gap: 10 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: theme.surface, borderRadius: 12, padding: 14 },
  title: { color: theme.text, fontSize: 16, fontWeight: "600" },
  sub: { color: theme.muted, marginTop: 4 },
  fab: { position: "absolute", right: 16, bottom: 24, backgroundColor: theme.accent, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 28 },
  fabText: { color: "white", fontWeight: "600" },
  notice: { color: theme.bad, paddingHorizontal: 16, paddingBottom: 8, fontSize: 12 },
});
