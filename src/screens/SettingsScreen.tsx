import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Chevron, SparkGlyph, useAppModal } from "../components/ui";
import { usePersistedState } from "../hooks/usePersistedState";
import { colors, fonts, motion, radii, spacing, screenTopGap } from "../design/tokens";

// The chat models the advisor can run, smallest first — the mobile-class picks from the
// QVAC SDK's model registry (ids are the SDK's own constants; sizes are the registry's
// expectedSize). Selection is persisted; the QVAC service reads it when the advisor next
// starts (download wiring lands with that work).
type ModelChoice = { id: string; name: string; size: string; note: string };

const MODELS: ModelChoice[] = [
  { id: "QWEN3_600M_INST_Q4", name: "Qwen3 0.6B", size: "0.4 GB", note: "Featherweight — instant, simple advice" },
  { id: "LLAMA_3_2_1B_INST_Q4_0", name: "Llama 3.2 1B", size: "0.8 GB", note: "Meta's pocket model — quick and chatty" },
  { id: "QWEN3_1_7B_INST_Q4", name: "Qwen3 1.7B", size: "1.1 GB", note: "Balanced — the everyday sweet spot" },
  { id: "QWEN3_4B_INST_Q4_K_M", name: "Qwen3 4B", size: "2.5 GB", note: "Deepest reasoning — too heavy for most phones" },
];

const DEFAULT_MODEL_ID = "QWEN3_1_7B_INST_Q4";

// Settings — the colophon of the ledger: the quiet back page where the machinery is
// disclosed. Two paper cards: the on-device advisor (switch + model choice) and the data
// vault (export / import). Same masthead language as Brews/Tools.
export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const modal = useAppModal();

  const [aiEnabled, setAiEnabled] = usePersistedState("settings:ai:enabled", true);
  const [modelId, setModelId] = usePersistedState("settings:ai:model", DEFAULT_MODEL_ID);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A stored id that no longer exists in the registry list falls back to the default.
  const selected = MODELS.find((m) => m.id === modelId) ?? MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>Settings</AppText>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- The advisor ---- */}
        <AppText variant="labelMd" style={styles.sectionLabel}>The advisor</AppText>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.halo}>
              <SparkGlyph size={22} color={colors.primary} />
            </View>
            <View style={styles.cardHeadText}>
              <AppText variant="bodyLg" style={styles.cardTitle}>On-device AI</AppText>
              <AppText variant="bodyMd" style={styles.cardBlurb}>Private and local</AppText>
            </View>
            <LedgerSwitch value={aiEnabled} onToggle={() => setAiEnabled((v) => !v)} />
          </View>

          <View style={styles.divider} />

          <View style={aiEnabled ? null : styles.dimmed} pointerEvents={aiEnabled ? "auto" : "none"}>
            <AppText variant="labelSm" style={styles.groupLabel}>Model</AppText>
            <View style={styles.selectedRow}>
              <View style={styles.modelText}>
                <AppText variant="bodyLg" style={styles.modelName}>{selected.name}</AppText>
                <AppText variant="bodyMd" style={styles.modelNote}>{selected.size} · {selected.note}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change model"
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [styles.changeBtn, pressed && styles.rowPressed]}
              >
                <AppText variant="labelMd" style={styles.changeText}>Change</AppText>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ---- Your data ---- */}
        <AppText variant="labelMd" style={[styles.sectionLabel, styles.sectionGap]}>Your data</AppText>
        <View style={styles.card}>
          <AppText variant="bodyMd" style={styles.dataBlurb}>
            The whole ledger can be saved and restored from a file.
          </AppText>

          <DataAction
            title="Export ledger"
            caption="Save everything to a file"
            direction="up"
            accent
            onPress={() => modal.alert("Export is on the bench", "The button is ready — wiring it to a real file comes next.")}
          />
          <DataAction
            title="Import ledger"
            caption="Restore from a file"
            direction="down"
            onPress={() => modal.alert("Import is on the bench", "The button is ready — wiring it to a real file comes next.")}
          />
        </View>
      </ScrollView>

      <ModelPicker
        visible={pickerOpen}
        selectedId={selected.id}
        onSelect={(id) => {
          setModelId(id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

// Bottom-sheet model picker in the ledger's language: cream paper sliding up over a dark
// espresso wash. One row per model; tapping a row selects it and puts the sheet away.
function ModelPicker({ visible, selectedId, onSelect, onClose }: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // Stays mounted through the exit animation, then unmounts.
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShown(true);
      Animated.timing(anim, { toValue: 1, duration: motion.standard, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: motion.fast, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!shown) return null;

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.pickerBackdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close model picker" onPress={onClose} />
      </Animated.View>
      <View style={styles.pickerHost} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.pickerSheet,
            { paddingBottom: insets.bottom + 16 },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [440, 0] }) }] },
          ]}
        >
          <View style={styles.grabber} />
          <AppText variant="labelSm" style={styles.pickerKicker}>On-device library</AppText>
          <AppText variant="headlineMd" style={styles.pickerTitle}>Choose a model</AppText>

          {MODELS.map((m, i) => (
            <ModelRow
              key={m.id}
              model={m}
              active={selectedId === m.id}
              last={i === MODELS.length - 1}
              onSelect={() => onSelect(m.id)}
            />
          ))}

          <AppText variant="bodyMd" style={styles.groupFootnote}>
            The chosen model is downloaded when the advisor next starts.
          </AppText>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Hand-built switch in the ledger's language: a bordered track that inks itself blue while
// the cream thumb glides across. JS driver — colors can't ride the native one.
function LedgerSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: motion.quick,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const track = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceContainerHigh, colors.primary] });
  const shift = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });

  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onToggle} hitSlop={10}>
      <Animated.View style={[styles.switchTrack, { backgroundColor: track }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX: shift }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// One selectable model: hand-drawn radio, grotesk name (machinery, not soul), size chip
// that flips to an "Active" pill on the chosen row.
function ModelRow({ model, active, last, onSelect }: { model: ModelChoice; active: boolean; last: boolean; onSelect: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onSelect}
      style={({ pressed }) => [styles.modelRow, !last && styles.modelRowDivider, pressed && styles.rowPressed]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.modelText}>
        <AppText variant="bodyLg" style={[styles.modelName, active && styles.modelNameActive]}>{model.name}</AppText>
        <AppText variant="bodyMd" style={styles.modelNote}>{model.note}</AppText>
      </View>
      <View style={[styles.sizeChip, active && styles.sizeChipActive]}>
        <AppText variant="labelSm" style={active ? styles.sizeTextActive : styles.sizeText}>
          {model.size}
        </AppText>
      </View>
    </Pressable>
  );
}

// Export/import action row: a tray glyph with the arrow pointing the way the data flows.
function DataAction({ title, caption, direction, accent, onPress }: {
  title: string;
  caption: string;
  direction: "up" | "down";
  accent?: boolean;
  onPress: () => void;
}) {
  const ink = accent ? colors.onPrimary : colors.onSurface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.dataBtn, accent ? styles.dataBtnAccent : styles.dataBtnQuiet, pressed && styles.rowPressed]}
    >
      <View style={styles.trayGlyph}>
        <Chevron direction={direction} size={9} thickness={2.5} color={ink} style={direction === "down" ? styles.trayArrowDown : styles.trayArrowUp} />
        <View style={[styles.tray, { borderColor: ink }]} />
      </View>
      <View style={styles.dataBtnText}>
        <AppText variant="labelMd" style={{ color: ink }}>{title}</AppText>
        <AppText variant="bodyMd" style={[styles.dataCaption, accent && styles.dataCaptionAccent]}>{caption}</AppText>
      </View>
      <Chevron direction="right" size={10} thickness={2} color={accent ? colors.onPrimary : colors.outline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  masthead: { paddingHorizontal: spacing.container, paddingBottom: 12 },
  title: { marginTop: 6, lineHeight: 48 },
  body: { flex: 1 },
  content: { paddingHorizontal: spacing.container, paddingTop: 4 },

  sectionLabel: { marginBottom: 10 },
  sectionGap: { marginTop: spacing.section },

  // Paper card — hairline border, never elevation (Fabric restyle-flicker doctrine).
  card: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    padding: 18,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  halo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeadText: { flex: 1 },
  cardTitle: { fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  cardBlurb: { marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: 16, opacity: 0.6 },
  dimmed: { opacity: 0.35 },
  groupLabel: { marginBottom: 4 },
  groupFootnote: { marginTop: 12, color: colors.secondary },

  // Switch
  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: radii.full,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceLowest,
  },

  // Selected model row + change affordance
  selectedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6 },
  changeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  changeText: { color: colors.primary },

  // Model picker sheet
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,22,14,0.45)" },
  pickerHost: { flex: 1, justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 8,
    borderTopRightRadius: radii.lg + 8,
    paddingHorizontal: spacing.container,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.outlineVariant,
    marginBottom: 14,
  },
  pickerKicker: { color: colors.secondary },
  pickerTitle: { marginTop: 4, marginBottom: 6, lineHeight: 34 },

  // Model rows
  modelRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  modelRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceLow },
  rowPressed: { opacity: 0.85 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  modelText: { flex: 1 },
  modelName: { fontFamily: fonts.sansSemiBold, fontSize: 16, lineHeight: 22, color: colors.onSurface },
  modelNameActive: { color: colors.primary },
  modelNote: { marginTop: 1 },
  sizeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
  },
  sizeChipActive: { backgroundColor: colors.primary },
  sizeText: { color: colors.onSurfaceVariant },
  sizeTextActive: { color: colors.onPrimary },

  // Data actions
  dataBlurb: { marginBottom: 14 },
  dataBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dataBtnAccent: { backgroundColor: colors.primary, marginBottom: 10 },
  dataBtnQuiet: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.outlineVariant },
  dataBtnText: { flex: 1 },
  dataCaption: { marginTop: 1, color: colors.onSurfaceVariant },
  dataCaptionAccent: { color: "rgba(255,255,255,0.75)" },

  // Tray glyph: arrow above a shallow open tray, drawn from borders (no icon library).
  trayGlyph: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  trayArrowDown: { marginBottom: 3 },
  trayArrowUp: { marginBottom: 5 },
  tray: {
    width: 18,
    height: 7,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
