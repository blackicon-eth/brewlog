import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listCoffees } from "../db/coffees";
import { listBrewsForCoffee, avgRating } from "../db/brews";
import { seedSampleData, clearAllData } from "../db/seed";
import type { Coffee } from "../models/types";
import { AppText, CoffeeCard, Fab, StatusPill, useAppModal } from "../components/ui";
import { colors, spacing, screenTopGap } from "../design/tokens";
import { useQvac } from "../qvac/QvacProvider";
import * as Device from "expo-device";

type Nav = NativeStackNavigationProp<RootStackParamList, "Coffees">;
type Row = Coffee & { brewCount: number; avg: number | null };

export function CoffeesScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { prepare } = useQvac();
  const modal = useAppModal();
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
        modal.alert("Couldn't load coffees", String(e?.message ?? e));
      }
    })();
  }, [modal]);

  useFocusEffect(useCallback(() => { prepare(); load(); }, [prepare, load]));

  // Dev-only test-data controls (compiled out of production builds via __DEV__).
  async function devSeed() {
    try { await seedSampleData(await getDb()); load(); }
    catch (e: any) { modal.alert("Seed failed", String(e?.message ?? e)); }
  }
  async function devClear() {
    try { await clearAllData(await getDb()); load(); }
    catch (e: any) { modal.alert("Clear failed", String(e?.message ?? e)); }
  }

  const hasRows = rows.length > 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed masthead — stays put while only the collection below scrolls. */}
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Image source={require("../../assets/logo-bean.png")} style={styles.logo} />
            <AppText variant="headlineLg" style={styles.brandTitle}>Brewlog</AppText>
          </View>
          <View style={styles.pillWrap}>
            <StatusPill />
          </View>
        </View>
        {!Device.isDevice ? (
          <View style={styles.notice}>
            <AppText variant="bodyMd" style={styles.noticeText}>
              Emulator detected — QVAC needs a physical device, so the AI advisor won't run here.
            </AppText>
          </View>
        ) : null}
        {__DEV__ ? (
          <View style={styles.devRow}>
            <Pressable onPress={devSeed} style={styles.devBtn}>
              <AppText variant="labelSm" style={styles.devBtnText}>+ Seed</AppText>
            </Pressable>
            <Pressable onPress={devClear} style={styles.devBtn}>
              <AppText variant="labelSm" style={styles.devBtnText}>Clear</AppText>
            </Pressable>
          </View>
        ) : null}
        {hasRows ? <AppText variant="labelMd" style={styles.section}>Your collection</AppText> : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="headlineMd" style={styles.emptyTitle}>Your ledger is empty</AppText>
            <AppText variant="bodyMd" style={styles.emptyBody}>
              Add your first bag to start logging brews and tasting notes.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <CoffeeCard
            roaster={item.roaster}
            name={item.name}
            brewCount={item.brewCount}
            avg={item.avg}
            onPress={() => nav.navigate("CoffeeDetail", { coffeeId: item.id })}
          />
        )}
      />
      <Fab label="Add coffee" onPress={() => nav.navigate("CoffeeForm", {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 4 },
  listArea: { flex: 1 },
  list: { paddingHorizontal: spacing.container, paddingTop: 6, paddingBottom: 128 },
  gap: { height: spacing.stack },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandTitle: { lineHeight: 48 },
  pillWrap: { marginTop: 8 },
  logo: { width: 34, height: 34 },
  section: { marginTop: spacing.section, marginBottom: spacing.stack },
  notice: {
    marginTop: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: { color: colors.onSurface },
  devRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  devBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  devBtnText: { color: colors.primary },
  empty: { marginTop: 48, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
