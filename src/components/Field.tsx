import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../theme";

export function Field(props: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "decimal-pad"; multiline?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.multiline]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.muted}
        keyboardType={props.keyboardType ?? "default"}
        multiline={props.multiline}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: 4, marginBottom: 12 },
  label: { color: theme.muted, fontSize: 12 },
  input: { backgroundColor: theme.surface2, color: theme.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
});
