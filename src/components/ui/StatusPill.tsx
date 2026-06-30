import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQvac } from "../../qvac/QvacProvider";
import { colors, fonts, radii } from "../../design/tokens";

// Advisor status as a small hollow pill with a state dot. Blue = ready, cherry = error,
// quiet outline while idle/loading. Mirrors the old StatusBadge logic, new design.
export function StatusPill() {
  const { status, progress, retry } = useQvac();

  const label =
    status === "ready" ? "Advisor ready" :
    status === "downloading" ? `Downloading ${progress}%` :
    status === "loading" ? `Loading ${progress}%` :
    status === "error" ? "Advisor unavailable" : "Advisor idle";
  const dot =
    status === "ready" ? colors.primary :
    status === "error" ? colors.tertiary : colors.outline;

  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.text}>{label}</Text>
      {status === "error" ? (
        <Pressable onPress={retry} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.onSurfaceVariant },
  retry: { fontSize: 12, fontFamily: fonts.sansBold, color: colors.primary, marginLeft: 2 },
});
