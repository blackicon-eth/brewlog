import React, { useState } from "react";
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type ViewStyle } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii, spacing } from "../../design/tokens";

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onBlur?: () => void;
  style?: ViewStyle;
};

// "Hollow" cream input from the Artisanal Brew Ledger: a calm paper field with a hairline
// taupe border that lifts to action-blue on focus. The label is a small uppercase grotesk
// caption; required fields carry a coffee-cherry dot.
export function TextField({
  label, value, onChangeText, placeholder, required, multiline, keyboardType, autoCapitalize, onBlur, style,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.labelRow}>
        <AppText variant="labelMd">{label}</AppText>
        {required ? <View style={styles.dot} /> : null}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.multiline, focused && styles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.outline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: spacing.stack },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.tertiary },
  input: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.base,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFocused: { borderColor: colors.primary },
  multiline: { minHeight: 104, paddingTop: 12, textAlignVertical: "top" },
});
