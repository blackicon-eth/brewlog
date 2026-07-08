import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TabIconProps } from "./TabIcons";
import { colors, fonts, motion } from "../../design/tokens";

export type TabItem = {
  key: string;
  label: string;
  icon: React.ComponentType<TabIconProps>;
};

export type TabBarProps = {
  items: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
};

// Custom bottom bar for the "Artisanal Brew Ledger": a warm cream ledger foot with a fine
// top rule and a soft upward lift. The active tab inks action-blue and drops a small ledger
// dot beneath its label; the rest stay muted espresso. Labels ride in the grotesk "science"
// type — no serif down here.
//
// Selection animates: each tab keeps a 0→1 progress value that cross-fades an action-blue
// icon over the muted one and eases the label colour + dot, so switching tabs washes colour
// in rather than snapping. Colour can't ride the native driver, so this stays off it.
export function TabBar({ items, activeKey, onSelect }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(items.map((item) => new Animated.Value(item.key === activeKey ? 1 : 0))).current;

  useEffect(() => {
    Animated.parallel(
      items.map((item, i) =>
        Animated.timing(progress[i], {
          toValue: item.key === activeKey ? 1 : 0,
          duration: motion.quick,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [activeKey, items, progress]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item, i) => {
        const Icon = item.icon;
        const p = progress[i];
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.key === activeKey }}
            style={styles.tab}
          >
            <View style={styles.iconBox}>
              <Icon size={24} color={colors.outline} />
              <Animated.View style={[styles.iconOverlay, { opacity: p }]}>
                <Icon size={24} color={colors.primary} />
              </Animated.View>
            </View>
            <Animated.Text
              style={[
                styles.label,
                { color: p.interpolate({ inputRange: [0, 1], outputRange: [colors.secondary, colors.primary] }) },
              ]}
            >
              {item.label}
            </Animated.Text>
            <Animated.View style={[styles.dot, { opacity: p }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingTop: 10,
    // Soft lift so the bar reads as floating above the canvas.
    shadowColor: "#2c160e",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 2 },
  iconBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  iconOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.sansBold, fontSize: 9, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
});
