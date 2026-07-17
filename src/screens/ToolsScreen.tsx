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
import { useI18n } from "../i18n/LocaleProvider";
import { toolTitle, toolBlurb } from "../lib/i18n/labels";

type Nav = NativeStackNavigationProp<RootStackParamList, "Main">;

// The brewing bench: every deterministic tool as a tile in a 2-column grid. Tapping a tile
// opens that tool's dedicated page (a single "Tool" route resolves the id via the registry).
export function ToolsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t, dict } = useI18n();

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>{t("tools.shelfTitle")}</AppText>
        <AppText variant="labelMd" style={styles.subtitle}>{t("tools.shelfSubtitle")}</AppText>
      </View>

      <ScrollView
        style={styles.listArea}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((tool) => (
          <View key={tool.meta.id} style={styles.cell}>
            <ToolCard
              title={toolTitle(dict, tool.meta.id)}
              blurb={toolBlurb(dict, tool.meta.id)}
              icon={tool.meta.icon}
              comingSoon={tool.meta.comingSoon}
              onPress={() => nav.navigate("Tool", { toolId: tool.meta.id })}
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
