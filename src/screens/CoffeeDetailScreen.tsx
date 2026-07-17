import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee } from "../db/coffees";
import { listBrewsForCoffee } from "../db/brews";
import { listPhotosForCoffee } from "../db/coffeePhotos";
import type { Brew, Coffee, CoffeePhoto } from "../models/types";
import { formatRatio } from "../lib/ratio";
import { formatSeconds, formatBrewDate, formatBrewTime } from "../lib/brewFormat";
import { methodSpec, defaultPickerMethod } from "../lib/brewMethods";
import { AppText, BrewLogRow, Fab, Chevron, ClockIcon, ArchiveIcon, BookIcon, PhotoViewer, useAppModal } from "../components/ui";
import { colors, motion, radii, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeDetail">;
type Rt = RouteProp<RootStackParamList, "CoffeeDetail">;

// Keep the grinder note short so the recap line stays tidy.
const GRIND_MAX = 12;
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function brewMeta(b: Brew): string {
  return [
    methodSpec(b.method).shortLabel,
    b.grind ? truncate(b.grind, GRIND_MAX) : null,
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
  const [photos, setPhotos] = useState<CoffeePhoto[]>([]);
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(() => {
    (async () => {
      try {
        const db = await getDb();
        setCoffee(await getCoffee(db, params.coffeeId));
        setBrews(await listBrewsForCoffee(db, params.coffeeId));
        setPhotos(await listPhotosForCoffee(db, params.coffeeId));
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

  // --- sort-change animation (self-contained; safe to remove) ---
  // A quick fade + rise on the list each time the sort flips.
  const listAnim = useRef(new Animated.Value(1)).current;
  const firstSort = useRef(true);
  useEffect(() => {
    if (firstSort.current) { firstSort.current = false; return; }
    listAnim.setValue(0);
    Animated.timing(listAnim, { toValue: 1, duration: motion.standard, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [sort, listAnim]);
  // --- end sort-change animation ---

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

        <View style={styles.roasterRow}>
          {coffee ? <AppText variant="labelSm">{coffee.roaster}</AppText> : null}
          {coffee?.archived ? (
            <View style={styles.archivedBadge}>
              <ArchiveIcon size={12} color={colors.onSurfaceVariant} thickness={1.4} />
              <AppText variant="labelSm" style={styles.archivedText}>Archived</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.titleRow}>
          <AppText variant="headlineLg" style={styles.title}>{coffee ? coffee.name : "…"}</AppText>
          <Pressable
            onPress={() => nav.navigate("Recipe", { coffeeId: params.coffeeId, method: defaultPickerMethod(brews) })}
            style={styles.recipeBtn}
            accessibilityRole="button"
            accessibilityLabel="Recipes"
          >
            <BookIcon size={26} thickness={1.4} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
        {tags ? <AppText variant="labelMd" style={styles.tags}>{tags}</AppText> : null}

        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoStrip}
            contentContainerStyle={styles.photoStripContent}
          >
            {photos.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setViewerUri(p.uri)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View photo"
              >
                <Image source={{ uri: p.uri }} style={styles.photoThumb} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {hasBrews ? (
          <View style={styles.historyRow}>
            <AppText variant="labelMd">Brew history</AppText>
            <View style={styles.sortGroup}>
              <Pressable
                onPress={() => setSort("recent")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sort by most recent"
                accessibilityState={{ selected: sort === "recent" }}
                style={[styles.sortChip, sort === "recent" && styles.sortChipActive]}
              >
                <ClockIcon size={15} thickness={1.6} color={sort === "recent" ? colors.primary : colors.outline} />
              </Pressable>
              <Pressable
                onPress={() => setSort("rating")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sort by top rated"
                accessibilityState={{ selected: sort === "rating" }}
                style={[styles.sortChip, sort === "rating" && styles.sortChipActive]}
              >
                <Text style={[styles.sortStar, { color: sort === "rating" ? colors.primary : colors.outline }]}>★</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.listArea,
          { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}
      >
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
              date={`${formatBrewDate(item.brewedAt)} · ${formatBrewTime(item.brewedAt)}`}
              recipe={`${item.doseG}g : ${item.waterG}g`}
              ratio={formatRatio(item.ratio)}
              meta={brewMeta(item)}
              rating={item.rating ?? null}
              onPress={() => nav.navigate("BrewDetail", { coffeeId: params.coffeeId, brewId: item.id })}
            />
          )}
        />
      </Animated.View>
      {/* No new brews for a finished bag — its past brews still live in the ledger. */}
      {coffee && !coffee.archived ? (
        <Fab label="Log brew" onPress={() => nav.navigate("BrewForm", { coffeeId: params.coffeeId })} />
      ) : null}

      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
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
  roasterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  // Quiet grey "Archived" tag — matches the grayish archive language elsewhere.
  archivedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.surfaceContainer, borderRadius: 999,
    paddingLeft: 8, paddingRight: 11, paddingVertical: 3,
  },
  archivedText: { color: colors.onSurfaceVariant, letterSpacing: 0.4 },
  // Name on the left, the circular recipe-book button pinned to the right of the same line.
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 6 },
  // flexShrink so a long name wraps instead of shoving the button off-screen; extra line
  // height so EB Garamond's descenders (the "g" tail) aren't clipped on Android.
  title: { flexShrink: 1, lineHeight: 48 },
  // Quiet ringed disc in the Edit-pill's language (hairline ring, muted espresso ink) —
  // a tappable "recipe book" affordance, no elevation (Fabric flickers elevation on
  // restyle; the app uses borders instead).
  recipeBtn: {
    width: 44, height: 44, borderRadius: radii.full,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  tags: { marginTop: 10, color: colors.secondary },
  // Bleeds past the header's side padding so thumbnails can scroll edge-to-edge, while the
  // content padding keeps the first/last thumb aligned with the rest of the page's margins.
  photoStrip: { marginTop: 18, marginHorizontal: -spacing.container },
  photoStripContent: { paddingHorizontal: spacing.container, gap: spacing.gutter },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 2 },
  sortGroup: { flexDirection: "row", gap: 6 },
  sortChip: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sortChipActive: { backgroundColor: "rgba(0,74,198,0.10)" },
  sortStar: { fontSize: 15, lineHeight: 15, marginTop: -1 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  empty: { marginTop: 40, alignItems: "center", paddingHorizontal: 24 },
  // Roomy line box + no extra font padding so EB Garamond's "g" descender (in "logged")
  // doesn't clip on Android — the app's standard headline fix.
  emptyTitle: { textAlign: "center", lineHeight: 34, includeFontPadding: false },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
