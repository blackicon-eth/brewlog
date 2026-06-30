import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts } from "../../design/tokens";

// Typographic scale. Headlines use EB Garamond; body + labels use Hanken Grotesk. Labels
// are uppercase with wide tracking for the "log/form" feel. The family name carries the
// weight, so no fontWeight here. Pass `style` to override color etc.
const variants = StyleSheet.create({
  headlineLg: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.5, color: colors.onSurface },
  headlineMd: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, letterSpacing: -0.3, color: colors.onSurface },
  bodyLg: { fontFamily: fonts.sans, fontSize: 18, lineHeight: 28, color: colors.onSurface },
  bodyMd: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.onSurfaceVariant },
  labelMd: { fontFamily: fonts.sansBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", color: colors.onSurfaceVariant },
  labelSm: { fontFamily: fonts.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase", color: colors.secondary },
});

export type TextVariant = keyof typeof variants;

export function AppText({ variant = "bodyMd", style, ...props }: TextProps & { variant?: TextVariant }) {
  return <Text {...props} style={[variants[variant], style]} />;
}
