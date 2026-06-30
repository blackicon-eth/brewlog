import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, radii } from "../../design/tokens";

export type ReasoningDisclosureProps = {
  text: string;
};

// Collapsible "show the model's reasoning" trace. Closed by default — the answer is the
// star; the thinking is a quiet inset note with a left rule, in muted italic.
export function ReasoningDisclosure({ text }: ReasoningDisclosureProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={styles.toggle}>
        <AppText variant="labelMd" style={styles.caret}>{open ? "▾" : "▸"}</AppText>
        <AppText variant="labelMd" style={styles.toggleText}>
          {open ? "Hide reasoning" : "Show reasoning"}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.box}>
          <AppText style={styles.text}>{text}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  caret: { color: colors.secondary },
  toggleText: { color: colors.secondary },
  box: {
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.surfaceLow,
    borderLeftWidth: 2,
    borderLeftColor: colors.outlineVariant,
    borderRadius: radii.base,
  },
  text: {
    fontFamily: fonts.sans,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
  },
});
