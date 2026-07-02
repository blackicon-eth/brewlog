import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import type { TabIconProps } from "./TabIcons";
import { colors, spacing, screenTopGap } from "../../design/tokens";

export type ComingSoonProps = {
  section: string; // uppercase kicker, e.g. "BREWS"
  title: string; // serif headline
  blurb: string; // one supporting line
  icon: React.ComponentType<TabIconProps>;
};

// Shared empty state for tabs whose pages aren't built yet. Keeps the ledger tone: a small
// section kicker up top, then a haloed glyph, serif headline, and a quiet promise below.
export function ComingSoon({ section, title, blurb, icon: Icon }: ComingSoonProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.top, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="labelSm">{section}</AppText>
      </View>
      <View style={styles.center}>
        <View style={styles.halo}><Icon size={34} color={colors.outline} /></View>
        <AppText variant="headlineMd" style={styles.title}>{title}</AppText>
        <AppText variant="bodyMd" style={styles.blurb}>{blurb}</AppText>
        <View style={styles.pill}>
          <AppText variant="labelSm" style={styles.pillText}>In the works</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: spacing.container, paddingBottom: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingBottom: 48, gap: 14 },
  halo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  // Extra line height so EB Garamond's descenders aren't clipped on Android.
  title: { marginTop: 4, lineHeight: 34, textAlign: "center" },
  blurb: { textAlign: "center" },
  pill: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: { color: colors.secondary },
});
