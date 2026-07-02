import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { colors, fonts } from "../../design/tokens";

export type BrewListRowProps = {
  roaster: string; // "Sey Coffee" — quiet kicker
  coffeeName: string; // "Kieni" — the serif identity of the pour
  time: string; // "14:30"
  recipe: string; // "15g : 250g"
  ratio: string; // "1:16.7"
  meta: string; // "medium-fine · 94°C · 2:45"
  rating: number | null;
  onPress: () => void;
};

// A row in the global brew ledger. Unlike a coffee's own history (BrewLogRow), each entry
// leads with *which* coffee it was — roaster kicker + serif name — since pours from every
// coffee are interleaved here. The recipe/process reads as the "science" line beneath, and
// the right rail carries the brew time over its rating. Tapping opens the same BrewDetail.
//
// A left timeline spine strings each day's pours onto one continuous thread: the rail runs
// the full height of every row, so consecutive same-day rows join seamlessly, and a bead
// node marks each pour. The thread is broken only by a day header — so same-day brews read
// as one connected session, with no horizontal rule needed between them.
export function BrewListRow({ roaster, coffeeName, time, recipe, ratio, meta, rating, onPress }: BrewListRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.spine}>
        <View style={styles.spineLine} />
        <View style={styles.node} />
      </View>
      <View style={styles.left}>
        <AppText variant="labelSm" style={styles.roaster}>{roaster}</AppText>
        <AppText variant="headlineMd" style={styles.name} numberOfLines={1}>{coffeeName}</AppText>
        <View style={styles.recipeLine}>
          <Text style={styles.recipe}>{recipe}</Text>
          <Text style={styles.ratio}>{ratio}</Text>
        </View>
        {meta ? <AppText variant="bodyMd" style={styles.meta}>{meta}</AppText> : null}
      </View>
      <View style={styles.right}>
        <AppText variant="labelSm" style={styles.time}>{time}</AppText>
        {rating != null ? <RatingChip value={rating} /> : null}
      </View>
    </Pressable>
  );
}

const NODE = 9;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 16 },
  pressed: { opacity: 0.6 },
  // Timeline gutter. `spineLine` fills the row's full height (absolute top/bottom) so it
  // butts against the neighbouring rows' rails into one unbroken thread; `node` is a cream
  // bead that masks the line where the pour sits, aligned to the roaster kicker.
  spine: { width: 16, alignSelf: "stretch", alignItems: "center", marginRight: 14 },
  spineLine: { position: "absolute", top: 0, bottom: 0, width: 1.5, borderRadius: 1, backgroundColor: colors.outlineVariant },
  node: { marginTop: 3, width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.outline },
  left: { flex: 1 },
  roaster: { color: colors.secondary },
  // Extra line height so EB Garamond's descenders (the "g/y" tails) aren't clipped on Android.
  name: { marginTop: 3, fontSize: 21, lineHeight: 27 },
  recipeLine: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  recipe: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.onSurface },
  ratio: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.onSurfaceVariant },
  meta: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  right: { alignItems: "flex-end", gap: 8, paddingTop: 2, marginLeft: 12 },
  time: { color: colors.secondary },
});
