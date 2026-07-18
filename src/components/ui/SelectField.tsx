import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { Chevron } from "./Chevron";
import { colors, fonts, motion, radii, spacing } from "../../design/tokens";

export type SelectOption<V extends string> = { value: V; label: string };

export type SelectFieldProps<V extends string> = {
  label: string;
  options: SelectOption<V>[];
  value: V;
  onChange: (v: V) => void;
  style?: ViewStyle;
};

// The box mirrors TextField's metrics exactly (padding 12 + 22 line height + hairline
// borders) so the anchored menu can sit a fixed distance below it.
const BOX_HEIGHT = 48;

// TextField's sibling for closed choices: the same hollow cream box under the same small
// uppercase caption, but tapping it drops a small paper menu right below — a real inline
// select, no modal. Picking an option (or tapping the box again) closes it. The menu is
// bordered, not elevated, per the kit's no-shadow rule for restyling surfaces.
export function SelectField<V extends string>({ label, options, value, onChange, style }: SelectFieldProps<V>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  // Quick settle-in for the menu; JS driver on purpose (small fade in a re-render-heavy
  // tree — the native driver flickers on Fabric restyles).
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: motion.fast, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [open, anim]);

  return (
    // zIndex lifts the open field above its later-rendered siblings so the menu overlays
    // the content below instead of slipping under it.
    <View style={[styles.wrap, open && styles.wrapOpen, style]}>
      <AppText variant="labelMd">{label}</AppText>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: current?.label }}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={[styles.box, open && styles.boxOpen]}
        >
          <AppText style={styles.value} numberOfLines={1}>{current?.label ?? "-"}</AppText>
          <Chevron direction={open ? "up" : "down"} size={9} thickness={2} color={colors.onSurfaceVariant} style={styles.chevron} />
        </Pressable>

        {open ? (
          <Animated.View
            style={[
              styles.menu,
              { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] },
            ]}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  style={({ pressed }) => [styles.option, i > 0 && styles.optionDivider, pressed && styles.optionPressed]}
                >
                  <AppText style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1}>
                    {o.label}
                  </AppText>
                  {selected ? <View style={styles.optionDot} /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: spacing.stack },
  wrapOpen: { zIndex: 20 },
  box: {
    height: BOX_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
  },
  boxOpen: { borderColor: colors.primary },
  value: { flex: 1, fontFamily: fonts.sans, fontSize: 16, lineHeight: 22, color: colors.onSurface },
  // Nudged down a hair so the glyph reads optically centered against the text line.
  chevron: { marginLeft: 8, marginTop: -2 },

  menu: {
    position: "absolute",
    top: BOX_HEIGHT + 6,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant },
  optionPressed: { backgroundColor: colors.surfaceContainer },
  optionText: { flex: 1, fontFamily: fonts.sans, fontSize: 16, lineHeight: 22, color: colors.onSurface },
  optionTextSelected: { fontFamily: fonts.sansSemiBold, color: colors.primary },
  optionDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.primary, marginLeft: 8 },
});
