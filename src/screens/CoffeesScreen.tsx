import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listCoffees } from "../db/coffees";
import { listBrewsForCoffee, avgRating } from "../db/brews";
import { onLedgerReplaced } from "../lib/ledgerEvents";
import type { Coffee } from "../models/types";
import { AppText, AdvisorBadge, CoffeeCard, Fab, SegmentedTabs, type SegmentedTab, useAppModal } from "../components/ui";
import { colors, motion, spacing, screenTopGap } from "../design/tokens";
import { useQvac } from "../qvac/QvacProvider";
import * as Device from "expo-device";

type Nav = NativeStackNavigationProp<RootStackParamList, "Main">;
type Row = Coffee & { brewCount: number; avg: number | null };
type ShelfView = "active" | "archived";

// Whether a coffee has been archived (a finished bag). The `archived` flag and its
// persistence land in a later pass; until then this reads undefined for every coffee,
// so Active shows the whole shelf and Archived previews as empty.
const isArchived = (c: Coffee): boolean => (c as { archived?: boolean | null }).archived === true;

const SHELF_OPTIONS: SegmentedTab<ShelfView>[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export function CoffeesScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { prepare } = useQvac();
  const modal = useAppModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<ShelfView>("active");
  // Gate the empty state on the first load completing, so "Your ledger is empty" can't
  // flash while the initial DB read is still in flight.
  const [loaded, setLoaded] = useState(false);

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
      } finally {
        setLoaded(true);
      }
    })();
  }, [modal]);

  useFocusEffect(useCallback(() => { prepare(); load(); }, [prepare, load]));
  // An import swaps the ledger out from under this always-mounted tab — refetch on the spot.
  useEffect(() => onLedgerReplaced(load), [load]);

  const hasRows = rows.length > 0;
  const visibleRows = useMemo(
    () => rows.filter((c) => (view === "archived" ? isArchived(c) : !isArchived(c))),
    [rows, view],
  );

  // A quick fade + rise on the shelf each time the filter flips — the same gesture the
  // coffee page uses when its sort changes. Driven on the JS thread (not native): these
  // cards carry elevation shadows, and a native-driver opacity animation flickers them
  // on Android Fabric — so we use the JS driver, the app's standard fix for fades over
  // shadowed surfaces.
  const listAnim = useRef(new Animated.Value(1)).current;
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    listAnim.setValue(0);
    Animated.timing(listAnim, {
      toValue: 1,
      duration: motion.standard,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [view, listAnim]);

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
            <AdvisorBadge />
          </View>
        </View>
        {!Device.isDevice ? (
          <View style={styles.notice}>
            <AppText variant="bodyMd" style={styles.noticeText}>
              Emulator detected — QVAC needs a physical device, so the AI advisor won't run here.
            </AppText>
          </View>
        ) : null}
        {hasRows ? (
          <>
            <AppText variant="labelMd" style={styles.section}>Your coffee collection</AppText>
            <SegmentedTabs options={SHELF_OPTIONS} value={view} onChange={setView} style={styles.toggle} />
          </>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.listArea,
          { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}
      >
      <FlatList
        data={visibleRows}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          loaded ? (
            view === "archived" ? (
              <View style={styles.empty}>
                <AppText variant="headlineMd" style={styles.emptyTitle}>No archived coffees</AppText>
                <AppText variant="bodyMd" style={styles.emptyBody}>
                  Bags you archive will rest here — their brews stay in the ledger.
                </AppText>
              </View>
            ) : (
              <View style={styles.empty}>
                <AppText variant="headlineMd" style={styles.emptyTitle}>Your ledger is empty</AppText>
                <AppText variant="bodyMd" style={styles.emptyBody}>
                  Add your first bag to start logging brews and tasting notes.
                </AppText>
              </View>
            )
          ) : null
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
      </Animated.View>
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
  // A quiet caption above the shelf filter; the label owns the top spacing so the
  // filter sits snug beneath it.
  section: { marginTop: spacing.section, marginBottom: 10, color: colors.secondary },
  // The shelf filter (Active / Archived) — SegmentedTabs owns its own look; Home only
  // spaces it within the masthead.
  toggle: { marginBottom: spacing.base },
  notice: {
    marginTop: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: { color: colors.onSurface },
  empty: { marginTop: 48, alignItems: "center", paddingHorizontal: 24 },
  // Roomy line box so EB Garamond descenders (the "y"/"g" tails) don't clip on Android.
  emptyTitle: { textAlign: "center", lineHeight: 34, includeFontPadding: false },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
