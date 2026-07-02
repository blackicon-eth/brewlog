import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee } from "../db/coffees";
import { listBrewsForCoffee } from "../db/brews";
import type { Brew, Coffee } from "../models/types";
import { formatRatio } from "../lib/ratio";
import { formatSeconds, formatBrewDate } from "../lib/brewFormat";
import { AppText, AiActionCard, BrewLogRow, Fab, Chevron, useAppModal } from "../components/ui";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeDetail">;
type Rt = RouteProp<RootStackParamList, "CoffeeDetail">;

function brewMeta(b: Brew): string {
  return [
    b.grind,
    b.waterTempC != null ? `${b.waterTempC}°C` : null,
    b.totalTimeS != null ? formatSeconds(b.totalTimeS) : null,
  ].filter(Boolean).join(" · ");
}

export function CoffeeDetailScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [sort, setSort] = useState<"recent" | "rating">("recent");

  const load = useCallback(() => {
    (async () => {
      try {
        const db = await getDb();
        setCoffee(await getCoffee(db, params.coffeeId));
        setBrews(await listBrewsForCoffee(db, params.coffeeId));
      } catch (e: any) {
        modal.alert("Couldn't load coffee", String(e?.message ?? e));
      }
    })();
  }, [params.coffeeId, modal]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasBrews = brews.length > 0;
  const tags = coffee
    ? [coffee.process, coffee.roastLevel ? `${coffee.roastLevel} roast` : null, coffee.origin].filter(Boolean).join(" · ")
    : "";

  // "Recent" = most-recently brewed first (the DB's default order); "Top rated" = highest
  // overall rating first, unrated last, ties broken by recency.
  const sortedBrews = useMemo(() => {
    const arr = [...brews];
    if (sort === "rating") {
      arr.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.brewedAt - a.brewedAt);
    } else {
      arr.sort((a, b) => b.brewedAt - a.brewedAt);
    }
    return arr;
  }, [brews, sort]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* Fixed header — only the brew history below scrolls. */}
      <View style={[styles.header, { paddingTop: insets.top + screenTopGap }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
          <Pressable
            onPress={() => coffee && nav.navigate("CoffeeForm", { coffeeId: coffee.id })}
            style={styles.editBtn}
          >
            <AppText variant="labelMd" style={styles.editText}>Edit</AppText>
          </Pressable>
        </View>

        {coffee ? <AppText variant="labelSm">{coffee.roaster}</AppText> : null}
        <AppText variant="headlineLg" style={styles.title}>{coffee ? coffee.name : "…"}</AppText>
        {tags ? <AppText variant="labelMd" style={styles.tags}>{tags}</AppText> : null}

        <View style={styles.aiWrap}>
          <AiActionCard
            image={require("../../assets/coffee-hero.png")}
            title="Best recipe"
            subtitle={hasBrews ? "AI-dialed from your brews" : "Log a brew to unlock AI insights"}
            enabled={hasBrews}
            onPress={() => nav.navigate("AdvisorResult", { kind: "bestRecipe", coffeeId: params.coffeeId, title: "Best recipe" })}
          />
        </View>

        {hasBrews ? (
          <View style={styles.historyRow}>
            <AppText variant="labelMd">Brew history</AppText>
            <View style={styles.sortGroup}>
              <Pressable
                onPress={() => setSort("recent")}
                hitSlop={6}
                style={[styles.sortChip, sort === "recent" && styles.sortChipActive]}
              >
                <AppText variant="labelSm" style={[styles.sortChipText, sort === "recent" && styles.sortChipTextActive]}>Recent</AppText>
              </Pressable>
              <Pressable
                onPress={() => setSort("rating")}
                hitSlop={6}
                style={[styles.sortChip, sort === "rating" && styles.sortChipActive]}
              >
                <AppText variant="labelSm" style={[styles.sortChipText, sort === "rating" && styles.sortChipTextActive]}>Top rated</AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        data={sortedBrews}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.hairline} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="headlineMd" style={styles.emptyTitle}>No brews logged yet</AppText>
            <AppText variant="bodyMd" style={styles.emptyBody}>
              Log your first pour to start dialing this coffee in.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <BrewLogRow
            date={formatBrewDate(item.brewedAt)}
            recipe={`${item.doseG}g : ${item.waterG}g`}
            ratio={formatRatio(item.ratio)}
            meta={brewMeta(item)}
            rating={item.rating ?? null}
            onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId, brewId: item.id })}
            onDiagnose={() => nav.navigate("AdvisorResult", { kind: "diagnose", coffeeId: params.coffeeId, brewId: item.id, title: "Diagnose brew" })}
          />
        )}
      />
      <Fab label="Log brew" onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId })} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listArea: { flex: 1 },
  list: { paddingHorizontal: spacing.container, paddingBottom: 104 },
  header: { paddingHorizontal: spacing.container, paddingBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  backBtn: { height: 34, justifyContent: "center" },
  editBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  editText: { color: colors.onSurfaceVariant },
  title: { marginTop: 6 },
  tags: { marginTop: 10, color: colors.secondary },
  aiWrap: { marginTop: 24 },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 2 },
  sortGroup: { flexDirection: "row", gap: 6 },
  sortChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  sortChipActive: { backgroundColor: "rgba(0,74,198,0.10)" },
  sortChipText: { color: colors.outline, letterSpacing: 0.4 },
  sortChipTextActive: { color: colors.primary },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  empty: { marginTop: 40, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
