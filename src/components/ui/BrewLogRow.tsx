import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { colors, fonts } from "../../design/tokens";

export type BrewLogRowProps = {
  date: string; // "28 Jun" — ledger date stamp
  recipe: string; // "15g : 250g"
  ratio: string; // "1:16.7"
  meta: string; // "medium-fine · 94°C · 2:45"
  rating: number | null;
  onPress: () => void; // open/edit the brew
};

// A "visual log" entry — hairline-separated (divider supplied by the list). Left column
// reads like a dated ledger line (date stamp → recipe + ratio → process meta); the right
// column holds the rating chip. Diagnose lives inside the brew itself, not here.
export function BrewLogRow({ date, recipe, ratio, meta, rating, onPress }: BrewLogRowProps) {
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
      {rating != null ? (
        <View style={styles.right}>
          <RatingChip value={rating} />
        </View>
      ) : null}
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
  // Center the rating chip against the left column's dated line.
  right: { alignSelf: "stretch", alignItems: "flex-end", justifyContent: "center" },
});
