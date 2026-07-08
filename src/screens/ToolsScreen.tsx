import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AppText, ToolCard } from "../components/ui";
import { TOOLS } from "./tools/registry";
import { colors, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "Main">;

// The brewing bench: every deterministic tool as a tile in a 2-column grid. Tapping a tile
// opens that tool's dedicated page (a single "Tool" route resolves the id via the registry).
export function ToolsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Tools</AppText>
        <AppText variant="labelMd" style={styles.subtitle}>The brewing bench</AppText>
      </View>

      <ScrollView
        style={styles.listArea}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((t) => (
          <View key={t.meta.id} style={styles.cell}>
            <ToolCard
              title={t.meta.title}
              blurb={t.meta.blurb}
              icon={t.meta.icon}
              comingSoon={t.meta.comingSoon}
              onPress={() => nav.navigate("Tool", { toolId: t.meta.id })}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 12 },
  title: { marginTop: 6, lineHeight: 48 },
  subtitle: { marginTop: 8, color: colors.secondary },
  listArea: { flex: 1 },
  // Two columns via 50%-wide cells with a 6px inset, so the gutter between cards is 12px and
  // the outer margin lands on spacing.container.
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.container - 6, paddingTop: 4 },
  cell: { width: "50%", padding: 6 },
});
