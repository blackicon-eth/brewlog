import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppText } from "./ui";
import type { Coffee } from "../models/types";
import { colors, fonts, spacing } from "../design/tokens";

// Which coffee is this brew for? Opened by the Brews-tab "+" when the shelf holds more
// than one coffee; tapping a row is the whole interaction — it selects and moves on to
// the log form (no separate confirm). Mirrors MethodPickerModal's card so the two
// "pick one thing" sheets read as siblings.
export function CoffeePickerModal({ visible, coffees, onCancel, onSelect }: {
  visible: boolean;
  coffees: Coffee[];
  onCancel: () => void;
  onSelect: (coffeeId: string) => void;
}) {
  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close coffee picker" onPress={onCancel} />
        <View style={styles.card}>
          <AppText variant="labelSm" style={styles.kicker}>Log brew</AppText>
          <AppText variant="headlineMd" style={styles.title}>Which coffee?</AppText>
          <AppText variant="bodyMd" style={styles.blurb}>
            Pick the coffee you brewed — its log opens ready to fill in.
          </AppText>

          {/* Scrolls once the shelf outgrows the card; a short list just sits still. */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {coffees.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => onSelect(c.id)}
                style={({ pressed }) => [styles.rowItem, pressed && styles.rowItemPressed]}
              >
                <Text style={styles.rowRoaster}>{c.roaster}</Text>
                <Text style={styles.rowName}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelBtn} accessibilityRole="button">
            <AppText variant="labelMd" style={styles.cancelText}>Cancel</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(44,22,14,0.45)",
    alignItems: "center", justifyContent: "center", padding: spacing.container,
  },
  card: {
    alignSelf: "stretch", backgroundColor: colors.background, borderRadius: 18,
    borderWidth: 1, borderColor: colors.outlineVariant, padding: 22,
  },
  kicker: { color: colors.secondary },
  // Roomy line box so EB Garamond descenders aren't clipped on Android.
  title: { marginTop: 4, lineHeight: 34, includeFontPadding: false },
  blurb: { marginTop: 6, marginBottom: 14, color: colors.onSurfaceVariant },
  list: { maxHeight: 288 },
  listContent: { paddingBottom: 2 },
  rowItem: {
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 8,
  },
  rowItemPressed: { borderColor: colors.primary, backgroundColor: "rgba(0,74,198,0.06)" },
  rowRoaster: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.outline },
  rowName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.onSurface, marginTop: 2 },
  cancelBtn: { alignSelf: "center", marginTop: 16, padding: 4 },
  cancelText: { color: colors.onSurfaceVariant },
});
