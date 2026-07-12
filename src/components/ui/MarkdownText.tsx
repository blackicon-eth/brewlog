import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { parseBlock, type Span } from "../../lib/markdownLite";
import { colors, fonts } from "../../design/tokens";

export type MarkdownTextProps = {
  text: string;
  // Ink for body text — the chat bubble and the advisor sheet pass their own.
  color?: string;
  // Rendered after the very last character (the streaming caret rides here so it
  // trails the text instead of dropping to its own line).
  trailing?: React.ReactNode;
};

// The assistant's answers in the ledger's own hand: headings become quiet grotesk
// labels, bullets hang from an en-dash gutter, numbered steps keep their figures, and
// **bold**/*italic*/`code` land as real typography instead of asterisk noise.
//
// Rendering is LINE-boxed for streaming performance: each source line is its own
// memoized component, so while the model writes, only the final (growing) line
// re-parses and — critically — only its native Text node re-measures. Android re-runs
// line-breaking over an entire Text on every change; frozen lines skip that entirely.
// `textBreakStrategy="simple"` keeps even the growing line's re-break cheap.
function MarkdownTextInner({ text, color = colors.onSurface, trailing }: MarkdownTextProps) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return trailing ? <Text style={[styles.body, styles.first, { color }]}>{trailing}</Text> : null;
  }
  const last = lines.length - 1;
  return (
    <View>
      {lines.map((line, i) => (
        <MarkdownLine key={i} line={line} color={color} first={i === 0} trailing={i === last ? trailing : null} />
      ))}
    </View>
  );
}

export const MarkdownText = React.memo(
  MarkdownTextInner,
  (prev, next) => prev.text === next.text && prev.color === next.color && !!prev.trailing === !!next.trailing,
);

function MarkdownLineInner({ line, color, first, trailing }: {
  line: string; color: string; first: boolean; trailing?: React.ReactNode;
}) {
  const b = parseBlock(line);
  if (!b) return null;
  if (b.type === "heading") {
    return (
      <Text textBreakStrategy="simple" style={[styles.heading, first && styles.first, { color }]}>
        {renderSpans(b.spans, color)}{trailing}
      </Text>
    );
  }
  if (b.type === "bullet" || b.type === "ordered") {
    return (
      <View style={[styles.itemRow, first && styles.first]}>
        <Text style={[styles.marker, b.type === "bullet" && styles.markerDash]}>
          {b.type === "bullet" ? "–" : `${b.marker}.`}
        </Text>
        <Text textBreakStrategy="simple" style={[styles.body, styles.itemBody, { color }]}>
          {renderSpans(b.spans, color)}{trailing}
        </Text>
      </View>
    );
  }
  return (
    <Text textBreakStrategy="simple" style={[styles.body, first && styles.first, { color }]}>
      {renderSpans(b.spans, color)}{trailing}
    </Text>
  );
}

// Settled lines are byte-identical between stream flushes — memo compares the line
// string (plus caret presence, whose element identity churns) and skips them wholesale.
const MarkdownLine = React.memo(
  MarkdownLineInner,
  (prev, next) =>
    prev.line === next.line && prev.color === next.color &&
    prev.first === next.first && !!prev.trailing === !!next.trailing,
);

function renderSpans(spans: Span[], color: string) {
  return spans.map((s, i) => {
    if (s.code) return <Text key={i} style={styles.code}>{s.text}</Text>;
    if (s.bold) return <Text key={i} style={[styles.bold, { color }]}>{s.text}</Text>;
    if (s.italic) return <Text key={i} style={[styles.italic, { color }]}>{s.text}</Text>;
    return <Text key={i}>{s.text}</Text>;
  });
}

const styles = StyleSheet.create({
  first: { marginTop: 0 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 25, marginTop: 8 },
  heading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 16,
  },
  itemRow: { flexDirection: "row", marginTop: 8 },
  // The figure/dash gutter: numbers keep their grotesk weight, dashes sit lighter.
  marker: { fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 25, width: 22, color: colors.secondary },
  markerDash: { fontFamily: fonts.sans },
  itemBody: { flex: 1, marginTop: 0 },
  bold: { fontFamily: fonts.sansSemiBold },
  italic: { fontFamily: fonts.sans, fontStyle: "italic" },
  code: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainer,
  },
});
