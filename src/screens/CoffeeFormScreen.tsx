import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee, createCoffee, updateCoffee, deleteCoffee } from "../db/coffees";
import { makeId } from "../lib/ids";
import { Field } from "../components/Field";
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeForm">;
type Rt = RouteProp<RootStackParamList, "CoffeeForm">;

export function CoffeeFormScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const editingId = params?.coffeeId;

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
          Alert.alert("Couldn't open coffee", "Coffee not found.");
          nav.goBack();
          return;
        }
        setRoaster(c.roaster); setName(c.name); setOrigin(c.origin ?? "");
        setProcess(c.process ?? ""); setRoastLevel(c.roastLevel ?? "");
        setRoastDate(c.roastDate ?? ""); setNotes(c.notes ?? ""); setCreatedAt(c.createdAt);
      } catch (e: any) {
        Alert.alert("Couldn't open coffee", String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  async function onSave() {
    if (!roaster.trim() || !name.trim()) { Alert.alert("Roaster and name are required."); return; }
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
      Alert.alert("Couldn't save coffee", String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    Alert.alert("Delete coffee?", "This removes the coffee and all its brews.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteCoffee(await getDb(), editingId);
            nav.navigate("Coffees");
          } catch (e: any) {
            Alert.alert("Couldn't delete coffee", String(e?.message ?? e));
          }
        } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Field label="Roaster *" value={roaster} onChangeText={setRoaster} placeholder="Sey Coffee" />
      <Field label="Name *" value={name} onChangeText={setName} placeholder="Kenya Nyeri AA" />
      <Field label="Origin" value={origin} onChangeText={setOrigin} placeholder="Kenya" />
      <Field label="Process" value={process} onChangeText={setProcess} placeholder="washed / natural / honey" />
      <Field label="Roast level" value={roastLevel} onChangeText={setRoastLevel} placeholder="light / medium" />
      <Field label="Roast date (YYYY-MM-DD)" value={roastDate} onChangeText={setRoastDate} placeholder="2026-06-10" />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="blackcurrant, floral" />
      <TouchableOpacity style={styles.save} onPress={onSave}><Text style={styles.saveText}>Save coffee</Text></TouchableOpacity>
      {editingId ? (
        <TouchableOpacity style={styles.delete} onPress={onDelete}><Text style={styles.deleteText}>Delete coffee</Text></TouchableOpacity>
      ) : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  save: { backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  saveText: { color: "white", fontWeight: "600" },
  delete: { borderColor: theme.bad, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  deleteText: { color: theme.bad, fontWeight: "600" },
});
