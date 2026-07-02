import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { Chevron } from "./Chevron";
import { colors, fonts } from "../../design/tokens";

export type BrewLogRowProps = {
  date: string; // "28 Jun" — ledger date stamp
  recipe: string; // "15g : 250g"
  ratio: string; // "1:16.7"
  meta: string; // "medium-fine · 94°C · 2:45"
  rating: number | null;
  onPress: () => void; // open/edit the brew
  onDiagnose: () => void;
};

// A "visual log" entry — hairline-separated (divider supplied by the list). Left column
// reads like a dated ledger line (date stamp → recipe + ratio → process meta); the right
// column pairs the rating chip with a Diagnose link, top-aligned with the date.
export function BrewLogRow({ date, recipe, ratio, meta, rating, onPress, onDiagnose }: BrewLogRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.left}>
        <AppText variant="labelSm" style={styles.date}>{date}</AppText>
        <View style={styles.recipeLine}>
          <Text style={styles.recipe}>{recipe}</Text>
          <Text style={styles.ratio}>{ratio}</Text>
        </View>
        {meta ? <AppText variant="bodyMd" style={styles.meta}>{meta}</AppText> : null}
      </View>
      <View style={styles.right}>
        <View style={styles.ratingWrap}>
          {rating != null ? <RatingChip value={rating} /> : null}
        </View>
        <Pressable onPress={onDiagnose} hitSlop={8} style={styles.diagnoseBtn}>
          <Text style={styles.diagnose}>Diagnose</Text>
          <Chevron direction="right" size={7} thickness={2} color={colors.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 16 },
  pressed: { opacity: 0.6 },
  left: { flex: 1 },
  date: { color: colors.secondary, marginBottom: 6 },
  recipeLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  recipe: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onSurface },
  ratio: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.onSurfaceVariant },
  meta: { marginTop: 3 },
  // Stretch to the row's full height so the rating can center and Diagnose sits at the bottom.
  right: { alignSelf: "stretch", alignItems: "flex-end" },
  ratingWrap: { flex: 1, justifyContent: "center" },
  diagnoseBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  diagnose: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
});
