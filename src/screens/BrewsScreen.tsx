import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, SectionList, StyleSheet, View } from "react-native";
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
import type { MethodFilter } from "../lib/brewMethods";
import { AppText, BrewListRow, Fab, MethodFilterBar, useAppModal } from "../components/ui";
import { CoffeePickerModal } from "../components/CoffeePickerModal";
import { colors, motion, spacing, screenTopGap } from "../design/tokens";

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
  const [method, setMethod] = useState<MethodFilter>("all");
  // Gate the empty state on the first load completing, so "No brews logged yet" can't
  // flash while the initial DB read is still in flight.
  const [loaded, setLoaded] = useState(false);
  // True while a full refresh is in flight. A filter change clears the list before its
  // refetch lands, so without this the empty state would flash between the two — gate the
  // empty state on it so the message shows only once a fetch has actually finished empty.
  const [refreshing, setRefreshing] = useState(false);
  const [end, setEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Mirrors of state read inside async callbacks (which capture stale state): how many rows
  // are loaded, whether we've hit the end, and a guard against overlapping page fetches.
  const loadedCountRef = useRef(0);
  const endRef = useRef(false);
  const fetchingRef = useRef(false);
  // Bumped on every full refresh (focus, import, filter change). An in-flight page fetch
  // captures the generation it started under and discards its result if a newer refresh has
  // superseded it — so switching the method filter mid-fling can't append the old filter's
  // rows onto the new list, and two racing refreshes resolve latest-wins.
  const reqGenRef = useRef(0);
  useEffect(() => { loadedCountRef.current = brews.length; }, [brews.length]);
  useEffect(() => { endRef.current = end; }, [end]);
  // A ref copy of the active filter so `refresh`/`loadMore` can read it without being rebound
  // on every filter change — a method-keyed `refresh` would also change identity, retriggering
  // the focus effect and firing a second, redundant page fetch on each tap.
  const methodRef = useRef<MethodFilter>(method);
  useEffect(() => { methodRef.current = method; }, [method]);
  // Whether the ledger is currently hidden mid filter-transition, waiting for its rows.
  const hiddenRef = useRef(false);

  // Filter-change transition. `listAnim` fades + rises the ledger in when a filter's rows
  // land (the same gesture the coffee shelf uses); `spinnerAnim` fades a centred loader in
  // only if the fetch outlasts a short delay, so an instant fetch never blips a spinner.
  // Both drive on the JS thread — the app's fix for opacity fades that would otherwise flicker
  // on Android Fabric. (Brew rows carry no elevation, so the fade itself is already safe.)
  const listAnim = useRef(new Animated.Value(1)).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;

  // Refresh the top `count` brews in one query (used on focus and initial mount). Re-reading
  // the whole loaded window keeps your place after returning from a brew while still picking
  // up new/edited/deleted rows at the top.
  const refresh = useCallback((count: number) => {
    const gen = ++reqGenRef.current;
    setRefreshing(true);
    return (async () => {
      try {
        const db = await getDb();
        const [page, totalCount, coffeeList] = await Promise.all([
          listAllBrews(db, { limit: count, method: methodRef.current }),
          countAllBrews(db, methodRef.current),
          listCoffees(db),
        ]);
        if (gen !== reqGenRef.current) return; // a newer refresh started — drop this stale result
        setBrews(page);
        setCoffees(coffeeList);
        setTotal(totalCount);
        setEnd(page.length >= totalCount);
      } catch (e: any) {
        modal.alert("Couldn't load brews", String(e?.message ?? e));
      } finally {
        // Only the latest refresh clears the flags; a superseded one leaves them for the
        // newer fetch still in flight.
        if (gen === reqGenRef.current) { setLoaded(true); setRefreshing(false); }
      }
    })();
  }, [modal]);

  useFocusEffect(useCallback(() => {
    refresh(Math.max(PAGE_SIZE, loadedCountRef.current));
  }, [refresh]));

  // An import swaps the ledger out from under this always-mounted tab — refetch on the
  // spot, back to the first page (the old scroll depth belongs to data that's gone).
  useEffect(() => onLedgerReplaced(() => refresh(PAGE_SIZE)), [refresh]);

  // Changing the method filter resets the ledger to its first page under the new filter.
  // Skipped on first mount — the focus effect already loads then — so this fires only on
  // a real filter change.
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; return; }
    // Hide the ledger and refetch page 1 under the new filter. The reveal is owned by the
    // effect below (keyed on `refreshing`), so whichever refresh settles last — this one, or an
    // import that lands mid-transition — un-hides the list with the correct rows, never a blank
    // flash. A spinner is armed with a short delay so it only surfaces if the fetch is genuinely
    // slow (e.g. the on-device model is saturating the CPU).
    hiddenRef.current = true;
    listAnim.setValue(0);
    spinnerAnim.setValue(0);
    const spinner = Animated.timing(spinnerAnim, {
      toValue: 1, delay: 180, duration: motion.quick, easing: Easing.out(Easing.quad), useNativeDriver: false,
    });
    spinner.start();
    loadedCountRef.current = 0;
    setEnd(false);
    setBrews([]);
    refresh(PAGE_SIZE);
    return () => spinner.stop();
  }, [method, refresh, listAnim, spinnerAnim]);

  // Reveal the ledger once a refresh settles while it's hidden mid-transition: fade the spinner
  // out and fade + rise the rows in. Driven by `refreshing` (not a specific promise) so the last
  // fetch to finish owns the reveal; a no-op when nothing is hidden, so focus/import refreshes
  // leave the already-visible list alone.
  useEffect(() => {
    if (refreshing || !hiddenRef.current) return;
    hiddenRef.current = false;
    spinnerAnim.stopAnimation();
    Animated.timing(spinnerAnim, { toValue: 0, duration: motion.fast, useNativeDriver: false }).start();
    Animated.timing(listAnim, {
      toValue: 1, duration: motion.standard, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [refreshing, listAnim, spinnerAnim]);

  // Append the next page when the list nears its end. Guarded so the many onEndReached
  // events a scroll fires collapse into one fetch, and skipped before the first load lands.
  const loadMore = useCallback(() => {
    if (fetchingRef.current || endRef.current || loadedCountRef.current === 0) return;
    const gen = reqGenRef.current;
    fetchingRef.current = true;
    setLoadingMore(true);
    (async () => {
      try {
        const next = await listAllBrews(await getDb(), { limit: PAGE_SIZE, offset: loadedCountRef.current, method: methodRef.current });
        if (gen !== reqGenRef.current) return; // filter/refresh changed mid-fetch — don't append stale rows
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

  // You log new brews only against coffees still on the active shelf — a finished
  // (archived) bag drops out of the picker even though its past brews stay in the ledger.
  const activeCoffees = useMemo(() => coffees.filter((c) => !c.archived), [coffees]);

  // The "+" logs a brew for a coffee. One coffee on the shelf → skip the question and
  // open its form straight away; otherwise ask which coffee first.
  const onLogBrew = useCallback(() => {
    if (activeCoffees.length === 1) { nav.navigate("BrewForm", { coffeeId: activeCoffees[0].id }); return; }
    setPickerOpen(true);
  }, [activeCoffees, nav]);

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
        {loaded && (total > 0 || method !== "all") ? (
          <MethodFilterBar value={method} onChange={setMethod} style={styles.filterBar} />
        ) : null}
      </View>

      <View style={styles.listArea}>
      <Animated.View
        style={[
          styles.fill,
          { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}
      >
      <SectionList
        sections={sections}
        keyExtractor={(b) => b.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        style={styles.fill}
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
          loaded && !refreshing ? (
            method !== "all" ? (
              <View style={styles.empty}>
                <AppText variant="headlineMd" style={styles.emptyTitle}>
                  No {methodSpec(method).label.toLowerCase()} brews yet
                </AppText>
                <AppText variant="bodyMd" style={styles.emptyBody}>
                  Switch the filter above, or log one from a coffee's page.
                </AppText>
              </View>
            ) : (
              <View style={styles.empty}>
                <AppText variant="headlineMd" style={styles.emptyTitle}>No brews logged yet</AppText>
                <AppText variant="bodyMd" style={styles.emptyBody}>
                  Open a coffee and log a pour — every brew you record lands here, newest first.
                </AppText>
              </View>
            )
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
      </Animated.View>
      {/* Sits above the (hidden) list during a filter refetch, so a slow fetch shows motion
          instead of blank paper. pointerEvents none so it never intercepts a scroll/tap. */}
      <Animated.View pointerEvents="none" style={[styles.loadingOverlay, { opacity: spinnerAnim }]}>
        <ActivityIndicator color={colors.primary} />
      </Animated.View>
      </View>

      {/* Only offer the "+" once there's a coffee to log against — a brand-new, empty
          ledger leans on its own empty-state guidance instead. */}
      {activeCoffees.length > 0 ? <Fab round label="Log brew" onPress={onLogBrew} /> : null}

      <CoffeePickerModal
        visible={pickerOpen}
        coffees={activeCoffees}
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
  // Sits under the count; a touch of top space, and it bleeds past the masthead inset to the
  // screen edges so chips scroll edge-to-edge. The strip owns its own left/right content
  // padding, so both the first and last chip clear the screen edge.
  filterBar: { marginTop: 14, marginHorizontal: -spacing.container },
  listArea: { flex: 1 },
  fill: { flex: 1 },
  // Centred loader, held a little below the masthead so it reads as "the ledger is arriving"
  // rather than floating mid-screen. Absolute so it overlays the hidden list without taking
  // layout space; pointerEvents none is set on the element.
  loadingOverlay: { position: "absolute", top: 40, left: 0, right: 0, alignItems: "center" },
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
