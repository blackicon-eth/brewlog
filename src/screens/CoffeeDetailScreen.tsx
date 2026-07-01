import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, View } from "react-native";
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
import { formatSeconds } from "../lib/brewFormat";
import { AppText, AiActionCard, BrewLogRow, Fab, Chevron, useAppModal } from "../components/ui";
import { colors, radii, shadows, spacing, screenTopGap } from "../design/tokens";

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

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <FlatList
        data={brews}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.hairline} />}
        ListHeaderComponent={
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
                title="Best recipe"
                subtitle={hasBrews ? `AI-dialed from your ${brews.length} brew${brews.length === 1 ? "" : "s"}` : "Log a brew to unlock AI insights"}
                enabled={hasBrews}
                onPress={() => nav.navigate("AdvisorResult", { kind: "bestRecipe", coffeeId: params.coffeeId, title: "Best recipe" })}
              />
            </View>

            <View style={styles.heroWrap}>
              <Image
                source={require("../../assets/coffee-hero.png")}
                style={styles.hero}
                resizeMode="cover"
              />
            </View>

            {hasBrews ? <AppText variant="labelMd" style={styles.section}>Brew history</AppText> : null}
          </View>
        }
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
  list: { paddingHorizontal: spacing.container, paddingBottom: 128 },
  header: { paddingBottom: 4 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  backBtn: { height: 34, justifyContent: "center" },
  editBtn: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  editText: { color: colors.onSurfaceVariant },
  title: { marginTop: 6 },
  tags: { marginTop: 10, color: colors.secondary },
  aiWrap: { marginTop: spacing.section },
  heroWrap: { marginTop: spacing.section, borderRadius: radii.lg, backgroundColor: colors.surfaceLowest, ...shadows.card },
  hero: { width: "100%", height: 180, borderRadius: radii.lg },
  section: { marginTop: spacing.section, marginBottom: 2 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  empty: { marginTop: 40, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center", marginTop: 8 },
});
