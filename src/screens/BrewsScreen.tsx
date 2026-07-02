import React, { useCallback, useMemo, useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { listAllBrews, type BrewWithCoffee } from "../db/brews";
import { formatRatio } from "../lib/ratio";
import { formatSeconds, formatBrewTime, groupBrewsByDay } from "../lib/brewFormat";
import { AppText, BrewListRow, useAppModal } from "../components/ui";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "Main">;

// Keep the grinder note short so the process line stays tidy.
const GRIND_MAX = 12;
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function brewMeta(b: BrewWithCoffee): string {
  return [
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
  // Gate the empty state on the first load completing, so "No brews logged yet" can't
  // flash while the initial DB read is still in flight.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    (async () => {
      try {
        setBrews(await listAllBrews(await getDb()));
      } catch (e: any) {
        modal.alert("Couldn't load brews", String(e?.message ?? e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [modal]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(() => groupBrewsByDay(brews), [brews]);
  const hasBrews = brews.length > 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed masthead — only the ledger below scrolls. */}
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Brew ledger</AppText>
        {hasBrews ? (
          <AppText variant="labelMd" style={styles.subtitle}>
            {brews.length} brew{brews.length === 1 ? "" : "s"}
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
        renderItem={({ item }) => (
          <BrewListRow
            roaster={item.roaster}
            coffeeName={item.coffeeName}
            time={formatBrewTime(item.brewedAt)}
            recipe={`${item.doseG}g : ${item.waterG}g`}
            ratio={formatRatio(item.ratio)}
            meta={brewMeta(item)}
            rating={item.rating ?? null}
            onPress={() => nav.navigate("BrewDetail", { coffeeId: item.coffeeId, brewId: item.id })}
          />
        )}
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
  list: { paddingHorizontal: spacing.container, paddingBottom: 128 },
  // Sticky per-day break. Solid cream so the day's thread scrolls cleanly underneath. A
  // full-bleed top rule + extra top gap cut each new day apart — the only horizontal rule
  // in the list, so it never reads like the (rule-less, spine-linked) gap between same-day
  // brews. The first day needs no rule above it.
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    paddingBottom: 10,
  },
  dayHeaderFirst: { paddingTop: 6 },
  dayHeaderRest: {
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  dayTitle: { color: colors.onSurface },
  dayCount: { color: colors.outline },
  empty: { marginTop: 48, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
