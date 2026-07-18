import React, { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { TabBar, HomeIcon, DropIcon, SparkGlyph, FlaskIcon, GearIcon, type TabItem } from "../components/ui";
import { colors, motion } from "../design/tokens";
import { CoffeesScreen } from "./CoffeesScreen";
import { BrewsScreen } from "./BrewsScreen";
import { ChatScreen } from "./ChatScreen";
import { ToolsScreen } from "./ToolsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { useI18n } from "../i18n/LocaleProvider";

// The app's top-level shell: five tabs behind a hand-built bottom bar. Detail/form/advisor
// screens push over this from the root stack (covering the bar), so nested navigation still
// flows through the stack — `useNavigation()` inside a tab reaches the same navigator.
// Labels resolve per render (tabs.*) so the bar follows a live locale switch.
const TABS: (Omit<TabItem, "label"> & { render: () => React.ReactNode })[] = [
  { key: "home", icon: HomeIcon, render: () => <CoffeesScreen /> },
  { key: "brews", icon: DropIcon, render: () => <BrewsScreen /> },
  { key: "chat", icon: SparkGlyph, render: () => <ChatScreen /> },
  { key: "tools", icon: FlaskIcon, render: () => <ToolsScreen /> },
  { key: "settings", icon: GearIcon, render: () => <SettingsScreen /> },
];

export function MainTabs() {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState("home");
  const items: TabItem[] = TABS.map(({ key, icon }) => ({
    key,
    icon,
    label: t(`tabs.${key}` as "tabs.home"),
  }));

  // Directional slide on tab change. `dir` is set in the tap handler (before the re-render)
  // so the interpolation below reads a fresh value; +1 slides in from the right (moving to a
  // later tab), -1 from the left. First paint skips the animation. Deliberately NOT an
  // opacity fade: on Android, `elevation` shadows ignore view opacity, so fading a page of
  // shadowed cards makes their shadows appear ahead of the content — a slide avoids that.
  const anim = useRef(new Animated.Value(1)).current;
  const dir = useRef(0);
  const first = useRef(true);

  const select = (key: string) => {
    if (key === activeKey) return;
    const from = TABS.findIndex((t) => t.key === activeKey);
    const to = TABS.findIndex((t) => t.key === key);
    dir.current = to > from ? 1 : -1;
    setActiveKey(key);
  };

  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: motion.standard, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeKey, anim]);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        {/* Every tab stays mounted so a switch never remounts a screen — its loaded data and
            scroll position survive, so there's no empty-list reflow flicker. Inactive tabs
            are display:none (not opacity:0) so their Android elevation shadows don't bleed
            through onto the visible tab. Only the active tab is laid out and slides in. */}
        {TABS.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <Animated.View
              key={t.key}
              style={[
                StyleSheet.absoluteFill,
                isActive
                  ? { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 24, 0] }) }] }
                  : styles.hidden,
              ]}
            >
              {t.render()}
            </Animated.View>
          );
        })}
      </View>
      <TabBar items={items} activeKey={activeKey} onSelect={select} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  // Fully removed from layout — the only reliable way to keep an inactive tab's Android
  // elevation shadows from bleeding onto the active tab (opacity does not clip them).
  hidden: { display: "none" },
});
