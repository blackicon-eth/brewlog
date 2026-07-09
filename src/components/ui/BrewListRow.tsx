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
  first: boolean; // first brew of its day — no thread above the bead
  last: boolean; // last brew of its day — no thread below the bead
  onPress: () => void;
};

// A row in the global brew ledger. Unlike a coffee's own history (BrewLogRow), each entry
// leads with *which* coffee it was — roaster kicker + serif name — since pours from every
// coffee are interleaved here. The recipe/process reads as the "science" line beneath, and
// the right rail carries the brew time over its rating. Tapping opens the same BrewDetail.
//
// A left timeline spine strings each day's pours onto one continuous thread: the rail runs
// the full height of every row, so consecutive same-day rows join seamlessly, and a bead
// node marks each pour. The thread starts at the day's first bead and runs to the bottom
// of the last brew's content — so same-day brews read as one connected session, with no
// horizontal rule needed between them.
export function BrewListRow({ roaster, coffeeName, time, recipe, ratio, meta, rating, first, last, onPress }: BrewListRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}>
      <View style={styles.spine}>
        {!first ? <View style={styles.spineAbove} /> : null}
        <View style={[styles.spineBelow, last && styles.spineBelowLast]} />
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
// Row breathing room lives on the text columns, NOT the row: padding on the row would
// inset the spine gutter and cut the thread at every row boundary.
// Two rows' pads meet between same-day brews, so the brew→brew gap is 2×ROW_PAD (25).
// The day header's paddingBottom (BrewsScreen) and `rowLast` below both mirror ROW_PAD
// so header→first-brew and last-brew→rule land on the same 25px gap.
const ROW_PAD = 12.5;
const NODE_TOP = ROW_PAD + 3; // bead sits level with the roaster kicker
const NODE_CENTER = NODE_TOP + NODE / 2;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  // Extra breather after the day's last pour, before the next day's rule (totals 25 with
  // the content pad, matching the brew→brew gap). Padding on the row is safe *here*
  // because nothing connects below — elsewhere it would cut the thread.
  rowLast: { paddingBottom: 12.5 },
  pressed: { opacity: 0.6 },
  // Timeline gutter. The rail is two absolute segments meeting under the bead: `spineAbove`
  // runs from the row's very top edge to the bead (hidden on the day's first pour, so the
  // thread starts there), `spineBelow` from the bead to the very bottom edge so consecutive
  // rows' rails butt into one unbroken thread. On the day's last pour it stops at the
  // content's bottom instead — the thread still runs alongside the whole last brew, but
  // ends short of the next day's rule.
  spine: { width: 16, alignSelf: "stretch", alignItems: "center", marginRight: 14 },
  spineAbove: { position: "absolute", top: 0, height: NODE_CENTER, width: 1.5, borderRadius: 1, backgroundColor: colors.outlineVariant },
  spineBelow: { position: "absolute", top: NODE_CENTER, bottom: 0, width: 1.5, borderRadius: 1, backgroundColor: colors.outlineVariant },
  spineBelowLast: { bottom: ROW_PAD },
  node: { marginTop: NODE_TOP, width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.outline },
  left: { flex: 1, paddingVertical: ROW_PAD },
  roaster: { color: colors.secondary },
  // Extra line height so EB Garamond's descenders (the "g/y" tails) aren't clipped on Android.
  name: { marginTop: 3, fontSize: 21, lineHeight: 27 },
  recipeLine: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  recipe: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.onSurface },
  ratio: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.onSurfaceVariant },
  meta: { marginTop: 3, fontSize: 14, lineHeight: 20 },
  right: { alignItems: "flex-end", gap: 8, paddingTop: ROW_PAD + 2, paddingBottom: ROW_PAD, marginLeft: 12 },
  time: { color: colors.secondary },
});
