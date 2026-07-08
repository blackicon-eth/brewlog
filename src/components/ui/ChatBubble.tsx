import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AppText } from "./AppText";
import { colors, fonts, motion, radii, spacing } from "../../design/tokens";

export type ChatBubbleProps = {
  role: "user" | "assistant";
  text: string;
  // While the model streams this (assistant) turn, trail a blinking caret.
  streaming?: boolean;
  // The turn failed — render the text as a quiet cherry error note instead of an answer.
  error?: boolean;
};

// A blinking ink caret that trails the streamed reply — the one bit of live motion, matching
// the advisor sheet's tell.
function StreamingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: motion.pulse, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: motion.pulse, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[styles.caret, { opacity }]}>▍</Animated.Text>;
}

// One chat balloon. Mine (user) is a right-aligned espresso fill with cream ink; the coach's
// (assistant) is a left-aligned cream card with a fine outline and espresso ink. Each carries
// a single squared "tail" corner (bottom-right for me, bottom-left for the coach) so the
// balloons read as coming from opposite sides — the WhatsApp/Telegram convention.
export function ChatBubble({ role, text, streaming, error }: ChatBubbleProps) {
  const isUser = role === "user";
  // Models routinely open with a blank line and trail blank lines; rendered verbatim those
  // read as dead space padding the bubble. Strip leading whitespace live, and once the turn
  // settles trim both ends. (Only trimStart while streaming so the caret doesn't jitter as a
  // trailing space is emitted and then followed by the next token.)
  const display = streaming ? text.replace(/^\s+/, "") : text.trim();
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowCoach]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
        {display || streaming ? (
          <AppText
            variant="bodyLg"
            style={[styles.text, isUser ? styles.textUser : error ? styles.textError : styles.textCoach]}
          >
            {display}
            {streaming ? <StreamingCaret /> : null}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const TAIL = 5; // the squared-off "spout" corner
const styles = StyleSheet.create({
  row: { width: "100%", marginTop: spacing.gutter },
  rowUser: { alignItems: "flex-end" },
  rowCoach: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "84%",
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: radii.lg,
  },
  bubbleUser: {
    backgroundColor: colors.onSurface,
    borderBottomRightRadius: TAIL,
  },
  bubbleCoach: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderBottomLeftRadius: TAIL,
  },
  text: { fontSize: 16, lineHeight: 24 },
  textUser: { color: colors.background },
  textCoach: { color: colors.onSurface },
  textError: { color: colors.tertiary },
  caret: { color: colors.primary, fontFamily: fonts.sans },
});
