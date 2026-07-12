import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppText } from "./AppText";
import { chunkPlainText } from "../../lib/markdownLite";
import { colors, fonts, radii, spacing } from "../../design/tokens";

export type ReasoningDisclosureProps = {
  text: string;
};

// One frozen slice of the trace. Settled chunks are byte-identical between stream
// flushes, so memo skips both their re-render and their native text re-measure —
// only the tail chunk ever grows. `simple` line-breaking keeps that tail cheap too
// (Android's default highQuality strategy re-breaks the whole node per change).
const TraceChunk = React.memo(function TraceChunk({ text }: { text: string }) {
  return <Text textBreakStrategy="simple" style={styles.text}>{text}</Text>;
});

// Collapsible "show the model's reasoning" trace. Closed by default — the answer is the
// star; the thinking is a quiet inset note with a left rule, in muted italic.
export const ReasoningDisclosure = React.memo(function ReasoningDisclosure({ text }: ReasoningDisclosureProps) {
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
          {chunkPlainText(text).map((chunk, i) => (
            <TraceChunk key={i} text={chunk} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // A full stack-gap below: the answer that follows is a separate thought and needs air.
  wrap: { marginBottom: spacing.stack },
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
    gap: 6,
  },
  text: {
    fontFamily: fonts.sans,
    fontStyle: "italic",
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
  },
});
