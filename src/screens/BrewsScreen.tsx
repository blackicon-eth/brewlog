import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SectionList, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listAllBrews, countAllBrews, type BrewWithCoffee } from "../db/brews";
import { listCoffees } from "../db/coffees";
import type { Coffee } from "../models/types";
import { onLedgerReplaced } from "../lib/ledgerEvents";
import { formatRatio } from "../lib/ratio";
import { formatSeconds, formatBrewTime, groupBrewsByDay } from "../lib/brewFormat";
import { methodSpec } from "../lib/brewMethods";
import { AppText, BrewListRow, Fab, useAppModal } from "../components/ui";
import { CoffeePickerModal } from "../components/CoffeePickerModal";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "Main">;

// How many brews to pull per page. Reads are local SQLite, so this is generous — big enough
// to fill a screen and rarely page, small enough that the first paint is instant.
const PAGE_SIZE = 20;

// Keep the grinder note short so the process line stays tidy.
const GRIND_MAX = 12;
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function brewMeta(b: BrewWithCoffee): string {
  return [
    methodSpec(b.method).shortLabel,
    b.grind ? truncate(b.grind, GRIND_MAX) : null,
    b.waterTempC != null ? `${b.waterTempC}°C` : null,
    b.totalTimeS != null ? formatSeconds(b.totalTimeS) : null,
  ].filter(Boolean).join(" · ");
}

export function BrewsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const modal = useAppModal();
  const [brews, setBrews] = useState<BrewWithCoffee[]>([]);
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [total, setTotal] = useState(0);
  // Gate the empty state on the first load completing, so "No brews logged yet" can't
  // flash while the initial DB read is still in flight.
  const [loaded, setLoaded] = useState(false);
  const [end, setEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Mirrors of state read inside async callbacks (which capture stale state): how many rows
  // are loaded, whether we've hit the end, and a guard against overlapping page fetches.
  const loadedCountRef = useRef(0);
  const endRef = useRef(false);
  const fetchingRef = useRef(false);
  useEffect(() => { loadedCountRef.current = brews.length; }, [brews.length]);
  useEffect(() => { endRef.current = end; }, [end]);

  // Refresh the top `count` brews in one query (used on focus and initial mount). Re-reading
  // the whole loaded window keeps your place after returning from a brew while still picking
  // up new/edited/deleted rows at the top.
  const refresh = useCallback((count: number) => {
    (async () => {
      try {
        const db = await getDb();
        const [page, totalCount, coffeeList] = await Promise.all([
          listAllBrews(db, { limit: count }),
          countAllBrews(db),
          listCoffees(db),
        ]);
        setBrews(page);
        setCoffees(coffeeList);
        setTotal(totalCount);
        setEnd(page.length >= totalCount);
      } catch (e: any) {
        modal.alert("Couldn't load brews", String(e?.message ?? e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [modal]);

  useFocusEffect(useCallback(() => {
    refresh(Math.max(PAGE_SIZE, loadedCountRef.current));
  }, [refresh]));

  // An import swaps the ledger out from under this always-mounted tab — refetch on the
  // spot, back to the first page (the old scroll depth belongs to data that's gone).
  useEffect(() => onLedgerReplaced(() => refresh(PAGE_SIZE)), [refresh]);

  // Append the next page when the list nears its end. Guarded so the many onEndReached
  // events a scroll fires collapse into one fetch, and skipped before the first load lands.
  const loadMore = useCallback(() => {
    if (fetchingRef.current || endRef.current || loadedCountRef.current === 0) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    (async () => {
      try {
        const next = await listAllBrews(await getDb(), { limit: PAGE_SIZE, offset: loadedCountRef.current });
        if (next.length) setBrews((prev) => [...prev, ...next]);
        if (next.length < PAGE_SIZE) setEnd(true);
      } catch (e: any) {
        modal.alert("Couldn't load more brews", String(e?.message ?? e));
      } finally {
        fetchingRef.current = false;
        setLoadingMore(false);
      }
    })();
  }, [modal]);

  // The "+" logs a brew for a coffee. One coffee on the shelf → skip the question and
  // open its form straight away; otherwise ask which coffee first.
  const onLogBrew = useCallback(() => {
    if (coffees.length === 1) { nav.navigate("BrewForm", { coffeeId: coffees[0].id }); return; }
    setPickerOpen(true);
  }, [coffees, nav]);

  const sections = useMemo(() => groupBrewsByDay(brews), [brews]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed masthead — only the ledger below scrolls. */}
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Brew ledger</AppText>
        {total > 0 ? (
          <AppText variant="labelMd" style={styles.subtitle}>
            {total} brew{total === 1 ? "" : "s"}
          </AppText>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(b) => b.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        // Fast-fling smoothing: Android's default subview clipping blanks the list mid-scroll
        // (then snaps back when it settles), so disable it; render a wider window and a bigger
        // batch so the recycler keeps up instead of showing empty space.
        removeClippedSubviews={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => {
          const isFirst = section.key === sections[0]?.key;
          return (
            <View style={[styles.dayHeader, isFirst ? styles.dayHeaderFirst : styles.dayHeaderRest]}>
              <AppText variant="labelMd" style={styles.dayTitle}>{section.title}</AppText>
              <AppText variant="labelSm" style={styles.dayCount}>
                {section.data.length} brew{section.data.length === 1 ? "" : "s"}
              </AppText>
            </View>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <AppText variant="headlineMd" style={styles.emptyTitle}>No brews logged yet</AppText>
              <AppText variant="bodyMd" style={styles.emptyBody}>
                Open a coffee and log a pour — every brew you record lands here, newest first.
              </AppText>
            </View>
          ) : null
        }
        renderItem={({ item, index, section }) => (
          <BrewListRow
            roaster={item.roaster}
            coffeeName={item.coffeeName}
            time={formatBrewTime(item.brewedAt)}
            recipe={`${item.doseG}g : ${item.waterG}g`}
            ratio={formatRatio(item.ratio)}
            meta={brewMeta(item)}
            rating={item.rating ?? null}
            first={index === 0}
            last={index === section.data.length - 1}
            onPress={() => nav.navigate("BrewDetail", { coffeeId: item.coffeeId, brewId: item.id })}
          />
        )}
      />

      {/* Only offer the "+" once there's a coffee to log against — a brand-new, empty
          ledger leans on its own empty-state guidance instead. */}
      {coffees.length > 0 ? <Fab round label="Log brew" onPress={onLogBrew} /> : null}

      <CoffeePickerModal
        visible={pickerOpen}
        coffees={coffees}
        onCancel={() => setPickerOpen(false)}
        onSelect={(coffeeId) => { setPickerOpen(false); nav.navigate("BrewForm", { coffeeId }); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 8 },
  title: { marginTop: 6, lineHeight: 48 },
  subtitle: { marginTop: 8, color: colors.secondary },
  listArea: { flex: 1 },
  // Bottom pad clears the circular "+" (58 tall, 28 from the bottom) so the last brew
  // never hides behind it.
  list: { paddingHorizontal: spacing.container, paddingBottom: 100 },
  // Sticky per-day break. Solid cream so the day's thread scrolls cleanly underneath. A
  // full-bleed top rule + extra top gap cut each new day apart — the only horizontal rule
  // in the list, so it never reads like the (rule-less, spine-linked) gap between same-day
  // brews. The first day needs no rule above it.
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    // Mirrors BrewListRow's content pad (12.5): header→first-brew totals 25, the same
    // gap as brew→brew and last-brew→rule.
    paddingBottom: 12.5,
  },
  dayHeaderFirst: { paddingTop: 6 },
  dayHeaderRest: {
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  dayTitle: { color: colors.onSurface },
  dayCount: { color: colors.outline },
  footer: { paddingVertical: 20 },
  empty: { marginTop: 48, alignItems: "center", paddingHorizontal: 24 },
  // Roomy line box so EB Garamond descenders (the "gg" tails) don't clip on Android.
  emptyTitle: { textAlign: "center", lineHeight: 34, includeFontPadding: false },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
