import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import type { TabIconProps } from "./TabIcons";
import { colors, radii, shadows } from "../../design/tokens";
import { useI18n } from "../../i18n/LocaleProvider";

export type ToolCardProps = {
  title: string;
  blurb: string;
  icon: React.ComponentType<TabIconProps>;
  onPress: () => void;
  // Renders the card dimmed and untappable with a "Coming soon" tag — for tools that are
  // on the bench but not ready yet.
  comingSoon?: boolean;
};

// One tile in the Tools grid. Uniform by design: a haloed glyph, a serif title, and a quiet
// one-line blurb on a white card lifted off the cream canvas. The parent grid sizes the
// cell (two per row); the card fills it and holds a fixed minimum height so rows align even
// when titles wrap to two lines.
export function ToolCard({ title, blurb, icon: Icon, onPress, comingSoon }: ToolCardProps) {
  const { t } = useI18n();
  const comingSoonLabel = t("tools.comingSoon");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${title}, ${comingSoonLabel}` : title}
      accessibilityState={{ disabled: !!comingSoon }}
      disabled={comingSoon}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && !comingSoon && styles.pressed]}
    >
      {/* Content dims; the tag stays at full strength so it reads clearly. */}
      <View style={[styles.contentWrap, comingSoon && styles.dimmed]}>
        <View style={styles.halo}>
          <Icon size={24} color={colors.onSurface} />
        </View>
        <View style={styles.textWrap}>
          <AppText variant="headlineMd" style={styles.title}>{title}</AppText>
          <AppText variant="bodyMd" style={styles.blurb}>{blurb}</AppText>
        </View>
      </View>
      {comingSoon ? (
        <View style={styles.soonOverlay} pointerEvents="none">
          <View style={styles.soonTag}>
            <AppText variant="labelSm" style={styles.soonText}>{comingSoonLabel}</AppText>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    padding: 16,
    minHeight: 168,
    justifyContent: "space-between",
    ...shadows.card,
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.98 }] },
  halo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { marginTop: 16 },
  // lineHeight bumped for EB Garamond descenders (Android clip guard).
  title: { lineHeight: 28 },
  blurb: { marginTop: 4 },

  // Inner wrapper carries the halo/text layout so the coming-soon tag can overlay the card.
  contentWrap: { flex: 1, justifyContent: "space-between" },

  // Coming-soon treatment
  dimmed: { opacity: 0.18 },
  // Tag pinned dead-center over the dimmed card content.
  soonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  soonTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
  },
  soonText: { color: colors.secondary, textAlign: "center" },
});
