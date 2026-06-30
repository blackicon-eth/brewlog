import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getBrew, createBrew, updateBrew, deleteBrew } from "../db/brews";
import { computeRatio, formatRatio } from "../lib/ratio";
import { makeId } from "../lib/ids";
import { Field } from "../components/Field";
import { theme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "BrewForm">;
type Rt = RouteProp<RootStackParamList, "BrewForm">;

const num = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
const int = (s: string): number | null => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };

export function BrewFormScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const editingId = params.brewId;

  const [dose, setDose] = useState(""); const [water, setWater] = useState("");
  const [grind, setGrind] = useState(""); const [temp, setTemp] = useState("");
  const [dripper, setDripper] = useState(""); const [bloomWater, setBloomWater] = useState("");
  const [bloomTime, setBloomTime] = useState(""); const [totalTime, setTotalTime] = useState("");
  const [agitation, setAgitation] = useState(""); const [filterType, setFilterType] = useState("");
  const [acidity, setAcidity] = useState(""); const [sweetness, setSweetness] = useState("");
  const [bitterness, setBitterness] = useState(""); const [body, setBody] = useState("");
  const [clarity, setClarity] = useState(""); const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [brewedAt, setBrewedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const b = await getBrew(await getDb(), editingId);
        if (!b) {
          Alert.alert("Couldn't open brew", "Brew not found.");
          nav.goBack();
          return;
        }
        setDose(String(b.doseG)); setWater(String(b.waterG));
        setGrind(b.grind ?? ""); setTemp(b.waterTempC != null ? String(b.waterTempC) : "");
        setDripper(b.dripper ?? ""); setBloomWater(b.bloomWaterG != null ? String(b.bloomWaterG) : "");
        setBloomTime(b.bloomTimeS != null ? String(b.bloomTimeS) : "");
        setTotalTime(b.totalTimeS != null ? String(b.totalTimeS) : "");
        setAgitation(b.agitation ?? ""); setFilterType(b.filterType ?? "");
        setAcidity(b.acidity != null ? String(b.acidity) : ""); setSweetness(b.sweetness != null ? String(b.sweetness) : "");
        setBitterness(b.bitterness != null ? String(b.bitterness) : ""); setBody(b.body != null ? String(b.body) : "");
        setClarity(b.clarity != null ? String(b.clarity) : ""); setRating(b.rating != null ? String(b.rating) : "");
        setNotes(b.notes ?? ""); setCreatedAt(b.createdAt); setBrewedAt(b.brewedAt);
      } catch (e: any) {
        Alert.alert("Couldn't open brew", String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  async function onSave() {
    const doseG = num(dose); const waterG = num(water);
    if (doseG == null || waterG == null || doseG <= 0 || waterG <= 0) {
      Alert.alert("Dose and water are required and must be > 0."); return;
    }
    try {
      const db = await getDb();
      const brew = {
        id: editingId ?? makeId(), coffeeId: params.coffeeId,
        brewedAt: brewedAt ?? Date.now(), doseG, waterG, ratio: computeRatio(doseG, waterG),
        grind: grind.trim() || null, waterTempC: num(temp), dripper: dripper.trim() || null,
        bloomWaterG: num(bloomWater), bloomTimeS: int(bloomTime), totalTimeS: int(totalTime),
        agitation: agitation.trim() || null, filterType: filterType.trim() || null, tds: null, ey: null,
        acidity: int(acidity), sweetness: int(sweetness), bitterness: int(bitterness),
        body: int(body), clarity: int(clarity), rating: int(rating),
        notes: notes.trim() || null, createdAt: createdAt ?? Date.now(),
      };
      if (editingId) await updateBrew(db, brew); else await createBrew(db, brew);
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Couldn't save brew", String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    try {
      await deleteBrew(await getDb(), editingId);
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Couldn't delete brew", String(e?.message ?? e));
    }
  }

  const ratioPreview = (() => {
    const d = num(dose), w = num(water);
    return d && w && d > 0 ? formatRatio(computeRatio(d, w)) : "—";
  })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.ratio}>Ratio {ratioPreview}</Text>
      <Field label="Dose (g) *" value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="15" />
      <Field label="Water (g) *" value={water} onChangeText={setWater} keyboardType="decimal-pad" placeholder="250" />
      <Field label="Grind" value={grind} onChangeText={setGrind} placeholder="medium-fine / 18 clicks" />
      <Field label="Water temp (C)" value={temp} onChangeText={setTemp} keyboardType="decimal-pad" placeholder="94" />
      <Field label="Dripper" value={dripper} onChangeText={setDripper} placeholder="V60 / Kalita / Origami / Chemex" />
      <Field label="Bloom water (g)" value={bloomWater} onChangeText={setBloomWater} keyboardType="decimal-pad" placeholder="45" />
      <Field label="Bloom time (s)" value={bloomTime} onChangeText={setBloomTime} keyboardType="numeric" placeholder="30" />
      <Field label="Total time (s)" value={totalTime} onChangeText={setTotalTime} keyboardType="numeric" placeholder="165" />
      <Field label="Agitation" value={agitation} onChangeText={setAgitation} placeholder="swirl / stir / none" />
      <Field label="Filter type" value={filterType} onChangeText={setFilterType} placeholder="tabbed / bleached" />
      <Text style={styles.section}>Taste (1–5)</Text>
      <Field label="Acidity" value={acidity} onChangeText={setAcidity} keyboardType="numeric" placeholder="1-5" />
      <Field label="Sweetness" value={sweetness} onChangeText={setSweetness} keyboardType="numeric" placeholder="1-5" />
      <Field label="Bitterness" value={bitterness} onChangeText={setBitterness} keyboardType="numeric" placeholder="1-5" />
      <Field label="Body" value={body} onChangeText={setBody} keyboardType="numeric" placeholder="1-5" />
      <Field label="Clarity" value={clarity} onChangeText={setClarity} keyboardType="numeric" placeholder="1-5" />
      <Field label="Overall rating (1–5)" value={rating} onChangeText={setRating} keyboardType="numeric" placeholder="1-5" />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="bitter finish, muted acidity" />
      <TouchableOpacity style={styles.save} onPress={onSave}><Text style={styles.saveText}>Save brew</Text></TouchableOpacity>
      {editingId ? (
        <TouchableOpacity style={styles.delete} onPress={onDelete}><Text style={styles.deleteText}>Delete brew</Text></TouchableOpacity>
      ) : null}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16 },
  ratio: { color: theme.good, fontWeight: "700", fontSize: 16, marginBottom: 12 },
  section: { color: theme.muted, marginTop: 8, marginBottom: 8, fontWeight: "600" },
  save: { backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  saveText: { color: "white", fontWeight: "600" },
  delete: { borderColor: theme.bad, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  deleteText: { color: theme.bad, fontWeight: "600" },
});
