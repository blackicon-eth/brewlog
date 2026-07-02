import React, { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { TabBar, HomeIcon, DropIcon, SparkGlyph, FlaskIcon, GearIcon, type TabItem } from "../components/ui";
import { colors } from "../design/tokens";
import { CoffeesScreen } from "./CoffeesScreen";
import { BrewsScreen } from "./BrewsScreen";
import { CoachScreen } from "./CoachScreen";
import { ToolsScreen } from "./ToolsScreen";
import { SettingsScreen } from "./SettingsScreen";

// The app's top-level shell: five tabs behind a hand-built bottom bar. Detail/form/advisor
// screens push over this from the root stack (covering the bar), so nested navigation still
// flows through the stack — `useNavigation()` inside a tab reaches the same navigator.
const TABS: (TabItem & { render: () => React.ReactNode })[] = [
  { key: "home", label: "Home", icon: HomeIcon, render: () => <CoffeesScreen /> },
  { key: "brews", label: "Brews", icon: DropIcon, render: () => <BrewsScreen /> },
  { key: "coach", label: "Coach", icon: SparkGlyph, render: () => <CoachScreen /> },
  { key: "tools", label: "Tools", icon: FlaskIcon, render: () => <ToolsScreen /> },
  { key: "settings", label: "Settings", icon: GearIcon, render: () => <SettingsScreen /> },
];

export function MainTabs() {
  const [activeKey, setActiveKey] = useState("home");
  const active = TABS.find((t) => t.key === activeKey) ?? TABS[0];

  // Directional slide + fade on tab change. `dir` is set in the tap handler (before the
  // re-render) so the interpolation below reads a fresh value; +1 slides in from the right
  // (moving to a later tab), -1 from the left. First paint skips the animation.
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
    Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeKey, anim]);

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 24, 0] }) }],
          },
        ]}
      >
        {active.render()}
      </Animated.View>
      <TabBar items={TABS} activeKey={activeKey} onSelect={select} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
