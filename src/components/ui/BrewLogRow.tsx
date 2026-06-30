import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { RatingChip } from "./RatingChip";
import { colors, fonts } from "../../design/tokens";

export type BrewLogRowProps = {
  recipe: string; // "15g : 250g"
  ratio: string; // "1:16.7"
  meta: string; // "medium-fine · 94°C · 2:45"
  rating: number | null;
  onPress: () => void; // open/edit the brew
  onDiagnose: () => void;
};

// A "visual log" entry — hairline-separated (divider supplied by the list), generous
// vertical padding, recipe + ratio on the left, rating chip + Diagnose link on the right.
export function BrewLogRow({ recipe, ratio, meta, rating, onPress, onDiagnose }: BrewLogRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.left}>
        <View style={styles.recipeLine}>
          <Text style={styles.recipe}>{recipe}</Text>
          <Text style={styles.ratio}>{ratio}</Text>
        </View>
        {meta ? <AppText variant="bodyMd" style={styles.meta}>{meta}</AppText> : null}
      </View>
      <View style={styles.right}>
        {rating != null ? <RatingChip value={rating} /> : null}
        <Pressable onPress={onDiagnose} hitSlop={8}>
          <Text style={styles.diagnose}>Diagnose →</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 16 },
  pressed: { opacity: 0.6 },
  left: { flex: 1 },
  recipeLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  recipe: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onSurface },
  ratio: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.onSurfaceVariant },
  meta: { marginTop: 3 },
  right: { alignItems: "flex-end", gap: 7 },
  diagnose: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
});
