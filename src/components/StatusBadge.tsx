import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQvac } from "../qvac/QvacProvider";
import { theme } from "../theme";

export function StatusBadge() {
  const { status, progress, retry } = useQvac();
  const label =
    status === "ready" ? "Advisor ready" :
    status === "downloading" ? `Downloading ${progress}%` :
    status === "loading" ? `Loading ${progress}%` :
    status === "error" ? "Advisor error" : "Advisor idle";
  const color =
    status === "ready" ? theme.good :
    status === "error" ? theme.bad : theme.muted;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>{label}</Text>
      {status === "error" ? (
        <Pressable onPress={retry}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: theme.muted, fontSize: 12 },
  retry: { color: theme.accent, fontSize: 12, fontWeight: "600" },
});
