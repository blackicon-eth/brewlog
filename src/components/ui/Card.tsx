import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radii, shadows } from "../../design/tokens";

// White surface lifted off the cream canvas by a soft ambient brown shadow.
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.base,
    padding: 16,
    ...shadows.card,
  },
});
