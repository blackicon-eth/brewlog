import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { AppText, Chevron } from "../../components/ui";
import { colors, spacing, screenTopGap } from "../../design/tokens";
import { useI18n } from "../../i18n/LocaleProvider";

export type ToolPageProps = {
  // Serif page title (EB Garamond). The masthead sets a safe lineHeight so descenders aren't clipped.
  title: string;
  // Optional supporting line under the title.
  subtitle?: string;
  // Wrap children in a keyboard-aware ScrollView (default). Pass false for a fixed-layout
  // page that manages its own scrolling (e.g. the live timer).
  scroll?: boolean;
  children: React.ReactNode;
};

// Shared chrome for every tool's dedicated page: a fixed masthead (back chevron + serif
// title) over a body. Matches the Brews/Chat/forms header language so all tool pages
// read as one set. Tool authors put their own UI inside — this only owns the frame.
export function ToolPage({ title, subtitle, scroll = true, children }: ToolPageProps) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("common.back")}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
          <AppText variant="headlineLg" style={styles.title} numberOfLines={1}>{title}</AppText>
        </View>
        {subtitle ? <AppText variant="bodyMd" style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>

      {scroll ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, styles.flexContent, { paddingBottom: insets.bottom + 24 }]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 8 },
  // Back chevron and title share one row; the chevron gets a touch of trailing room so the
  // serif title sits beside it without crowding.
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { height: 48, justifyContent: "center", paddingRight: 2 },
  // Extra line height so EB Garamond's descenders (g/y) aren't clipped on Android.
  title: { flex: 1, lineHeight: 48 },
  subtitle: { marginTop: 6 },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.container, paddingTop: 6 },
  flexContent: { paddingHorizontal: spacing.container, paddingTop: 6 },
});
