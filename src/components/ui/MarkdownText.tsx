import React from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { parseMarkdownLite, type Span } from "../../lib/markdownLite";
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
// **bold**/*italic*/`code` land as real typography instead of asterisk noise. Built on
// markdownLite — anything it doesn't recognize renders as a plain paragraph, so a
// half-streamed reply is always readable.
export function MarkdownText({ text, color = colors.onSurface, trailing }: MarkdownTextProps) {
  const blocks = parseMarkdownLite(text);
  if (blocks.length === 0) return trailing ? <Text style={[styles.body, { color }]}>{trailing}</Text> : null;
  const last = blocks.length - 1;

  return (
    <View>
      {blocks.map((b, i) => {
        const tail = i === last ? trailing : null;
        if (b.type === "heading") {
          return (
            <Text key={i} style={[styles.heading, i === 0 && styles.first, { color }]}>
              {renderSpans(b.spans, color)}{tail}
            </Text>
          );
        }
        if (b.type === "bullet" || b.type === "ordered") {
          return (
            <View key={i} style={[styles.itemRow, i === 0 && styles.first]}>
              <Text style={[styles.marker, b.type === "bullet" && styles.markerDash]}>
                {b.type === "bullet" ? "–" : `${b.marker}.`}
              </Text>
              <Text style={[styles.body, styles.itemBody, { color }]}>
                {renderSpans(b.spans, color)}{tail}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.body, i === 0 && styles.first, { color }]}>
            {renderSpans(b.spans, color)}{tail}
          </Text>
        );
      })}
    </View>
  );
}

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
