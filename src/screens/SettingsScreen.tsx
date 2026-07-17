import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { Directory, File } from "expo-file-system";
import Storage from "expo-sqlite/kv-store";
import { AppText, Chevron, SegmentedTabs, SparkGlyph, useAppModal } from "../components/ui";
import { useQvac } from "../qvac/QvacProvider";
import { useI18n } from "../i18n/LocaleProvider";
import { type Locale } from "../lib/i18n/t";
import { AI_MODELS, modelFits, resolveModel, type AiModel } from "../lib/aiModels";
import { aiModelNote } from "../lib/i18n/labels";
import { colors, fonts, motion, radii, spacing, screenTopGap } from "../design/tokens";
import { getDb } from "../db/database";
import { listCoffees } from "../db/coffees";
import { countAllBrews, listAllBrews } from "../db/brews";
import { listAllPhotos } from "../db/coffeePhotos";
import { listAllRecipes } from "../db/recipes";
import { ledgerFilename, parseLedgerFile, serializeLedger } from "../lib/ledgerFile";
import { emitLedgerReplaced } from "../lib/ledgerEvents";
import { replaceLedger } from "../db/importLedger";
import * as photoStore from "../media/photoStore";

// Export destination — picked once, then remembered. Android bars apps from writing to
// the Downloads root itself ("to protect your privacy…"), so the user creates or picks a
// subfolder (e.g. Downloads/Brewlog) on the first export; the SAF grant persists across
// restarts, so every later export writes there without asking.
const EXPORT_DIR_KEY = "settings:data:exportDir";
// Hint that opens the system folder picker already inside Downloads.
const DOWNLOADS_URI = "content://com.android.externalstorage.documents/document/primary%3ADownload";

type ExportDir = { dir: InstanceType<typeof Directory>; fresh: boolean };

// Returns the remembered export folder if it still exists and is readable, otherwise
// asks the user to pick one (null = picker dismissed).
async function acquireExportDir(): Promise<ExportDir | null> {
  const saved = Storage.getItemSync(EXPORT_DIR_KEY);
  if (saved) {
    try {
      const dir = new Directory(saved);
      if (dir.exists) return { dir, fresh: false };
    } catch {
      // The folder is gone or the grant was revoked — fall through to the picker.
    }
  }
  try {
    // The picker's declared return type resolves to the base native class; the runtime
    // object is the full Directory (same quirk as File.pickFileAsync below).
    const dir = (await Directory.pickDirectoryAsync(DOWNLOADS_URI)) as InstanceType<typeof Directory>;
    Storage.setItemSync(EXPORT_DIR_KEY, dir.uri);
    return { dir, fresh: true };
  } catch {
    return null; // picker dismissed — the quiet outcome
  }
}

// Settings — the colophon of the ledger: the quiet back page where the machinery is
// disclosed. Two paper cards: the on-device advisor (switch + model choice) and the data
// vault (export / import). Same masthead language as Brews/Tools.
export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const modal = useAppModal();

  const { aiEnabled, setAiEnabled, modelId, setModel } = useQvac();
  const { locale, setLocale, t, tn, dict } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  // One data operation at a time — a double-tap must not stack two pickers.
  const busyRef = useRef(false);

  const counts = (nCoffees: number, nBrews: number) =>
    t("settings.countsJoin", {
      coffees: tn("common.coffeeCount", nCoffees),
      brews: tn("common.brewCount", nBrews),
    });

  const exportLedger = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      try {
        const dest = await acquireExportDir();
        if (!dest) return; // picker dismissed — the quiet outcome
        const db = await getDb();
        const coffees = await listCoffees(db);
        const brews = await listAllBrews(db);
        const allPhotos = await listAllPhotos(db);
        const recipes = await listAllRecipes(db);
        const ledgerPhotos = [];
        for (const p of allPhotos) {
          let dataBase64: string;
          try {
            dataBase64 = await photoStore.readPhotoBase64(p.uri);
          } catch {
            // A row whose file is gone (shouldn't happen given the lifecycle) — skip it
            // rather than abort the whole backup over one orphaned photo.
            continue;
          }
          ledgerPhotos.push({
            id: p.id,
            coffeeId: p.coffeeId,
            position: p.position,
            dataBase64,
            createdAt: p.createdAt,
          });
        }
        const name = ledgerFilename(new Date());
        let file: InstanceType<typeof File>;
        try {
          file = dest.dir.createFile(name, "application/json") as InstanceType<typeof File>;
          file.write(serializeLedger(coffees, brews, new Date().toISOString(), ledgerPhotos, recipes));
        } catch (e) {
          // A remembered folder can go stale in ways `exists` misses — forget it so the
          // next attempt asks for a folder again.
          Storage.removeItemSync(EXPORT_DIR_KEY);
          await modal.alert(
            t("settings.couldntSaveTitle"),
            e instanceof Error
              ? `${e.message} ${t("settings.tryExportAgainSuffix")}`
              : `${t("settings.writingWentWrong")} ${t("settings.tryExportAgainSuffix")}`
          );
          return;
        }
        // Android SAF may auto-rename on collision — report the file it actually made.
        const savedName = file.name;
        await modal.alert(
          t("settings.savedTitle"),
          t("settings.savedBody", { name: savedName, counts: counts(coffees.length, brews.length) }) +
          (dest.fresh ? ` ${t("settings.freshFolderNote")}` : "")
        );
      } catch {
        await modal.alert(t("settings.somethingWentWrongTitle"), t("settings.somethingWentWrongBody"));
      }
    } finally {
      busyRef.current = false;
    }
  };

  const importLedger = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      try {
        let picked: Awaited<ReturnType<typeof File.pickFileAsync>>;
        try {
          picked = await File.pickFileAsync(undefined, "application/json");
        } catch {
          return; // picker dismissed
        }
        const file = Array.isArray(picked) ? picked[0] : picked;
        if (!file) return;

        let text: string;
        try {
          text = await file.text();
        } catch {
          await modal.alert(t("settings.couldntReadTitle"), t("settings.couldntReadBody"));
          return;
        }

        const parsed = parseLedgerFile(text);
        if (!parsed.ok) {
          await modal.alert(t("settings.cantImportTitle"), parsed.reason);
          return;
        }

        const db = await getDb();
        const curCoffees = (await listCoffees(db)).length;
        const curBrews = await countAllBrews(db);
        // An empty ledger has nothing to lose — only warn when the import overwrites data.
        if (curCoffees > 0 || curBrews > 0) {
          const proceed = await modal.confirm({
            title: t("settings.replaceTitle"),
            message: t("settings.replaceMessage", {
              fileCounts: counts(parsed.payload.coffees.length, parsed.payload.brews.length),
              curCounts: counts(curCoffees, curBrews),
            }),
            confirmLabel: t("settings.replaceConfirm"),
            destructive: true,
          });
          if (!proceed) return;
        }

        try {
          const oldPhotos = await listAllPhotos(db); // capture BEFORE writing anything
          const written: { id: string; coffeeId: string; uri: string; position: number; createdAt: number }[] = [];
          try {
            for (const lp of parsed.payload.photos) {
              const uri = await photoStore.writePhotoFromBase64(lp.id, lp.dataBase64);
              written.push({ id: lp.id, coffeeId: lp.coffeeId, uri, position: lp.position, createdAt: lp.createdAt });
            }
            await replaceLedger(db, {
              coffees: parsed.payload.coffees,
              brews: parsed.payload.brews,
              photos: written,
              recipes: parsed.payload.recipes,
            });
          } catch (e) {
            // Roll back only the files we just wrote (skip any that overwrote an existing
            // path); the DB rolled back too, so the old ledger + its files stay intact.
            const oldUris = new Set(oldPhotos.map((p) => p.uri));
            for (const w of written) if (!oldUris.has(w.uri)) photoStore.deletePhotoFile(w.uri);
            throw e;
          }
          // Success: drop old photo files the imported ledger no longer references.
          const newUris = new Set(written.map((w) => w.uri));
          for (const p of oldPhotos) if (!newUris.has(p.uri)) photoStore.deletePhotoFile(p.uri);
        } catch {
          await modal.alert(t("settings.importFailedTitle"), t("settings.importFailedBody"));
          return;
        }
        // The mounted Home/Brews tabs refetch behind this modal — tab switches never
        // fire navigation focus, so they'd otherwise show the old ledger.
        emitLedgerReplaced();
        await modal.alert(
          t("settings.restoredTitle"),
          t("settings.restoredBody", { counts: counts(parsed.payload.coffees.length, parsed.payload.brews.length) })
        );
      } catch {
        await modal.alert(t("settings.somethingWentWrongTitle"), t("settings.somethingWentWrongBody"));
      }
    } finally {
      busyRef.current = false;
    }
  };

  const selected = resolveModel(modelId);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.masthead, { paddingTop: insets.top + screenTopGap }]}>
        <AppText variant="headlineLg" style={styles.title}>{t("settings.title")}</AppText>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- The advisor ---- */}
        <AppText variant="labelMd" style={styles.sectionLabel}>{t("settings.advisorLabel")}</AppText>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.halo}>
              <SparkGlyph size={22} color={colors.primary} />
            </View>
            <View style={styles.cardHeadText}>
              <AppText variant="bodyLg" style={styles.cardTitle}>{t("settings.onDeviceAi")}</AppText>
              <AppText variant="bodyMd" style={styles.cardBlurb}>{t("settings.privateAndLocal")}</AppText>
            </View>
            <LedgerSwitch value={aiEnabled} onToggle={() => setAiEnabled(!aiEnabled)} />
          </View>

          <Collapsible open={aiEnabled}>
            <View style={styles.divider} />
            <AppText variant="labelSm" style={styles.groupLabel}>{t("settings.modelLabel")}</AppText>
            <View style={styles.selectedRow}>
              <View style={styles.modelText}>
                <AppText variant="bodyLg" style={styles.modelName}>{selected.name}</AppText>
                <AppText variant="bodyMd" style={styles.modelNote}>{selected.size} · {aiModelNote(dict, selected.id)}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("settings.changeModelA11y")}
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [styles.changeBtn, pressed && styles.rowPressed]}
              >
                <AppText variant="labelMd" style={styles.changeText}>{t("settings.change")}</AppText>
              </Pressable>
            </View>
          </Collapsible>
        </View>

        {/* ---- Your data ---- */}
        <AppText variant="labelMd" style={[styles.sectionLabel, styles.sectionGap]}>{t("settings.dataLabel")}</AppText>
        <View style={styles.card}>
          <AppText variant="bodyMd" style={styles.dataBlurb}>
            {t("settings.dataBlurb")}
          </AppText>

          <DataAction
            title={t("settings.exportTitle")}
            caption={t("settings.exportCaption")}
            direction="up"
            accent
            onPress={() => void exportLedger()}
          />
          <DataAction
            title={t("settings.importTitle")}
            caption={t("settings.importCaption")}
            direction="down"
            onPress={() => void importLedger()}
          />
        </View>

        {/* ---- Language ---- */}
        <AppText variant="labelMd" style={[styles.sectionLabel, styles.sectionGap]}>{t("settings.language.label")}</AppText>
        <View style={styles.card}>
          <SegmentedTabs
            options={[
              { value: "en", label: t("settings.language.english") },
              { value: "it", label: t("settings.language.italian") },
            ]}
            value={locale}
            onChange={(v) => setLocale(v as Locale)}
          />
        </View>
      </ScrollView>

      <ModelPicker
        visible={pickerOpen}
        selectedId={selected.id}
        onSelect={(id) => {
          setModel(id);
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
  const { t } = useI18n();
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
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={t("aiModels.picker.closeA11y")} onPress={onClose} />
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
          <AppText variant="labelSm" style={styles.pickerKicker}>{t("aiModels.picker.kicker")}</AppText>
          <AppText variant="headlineMd" style={styles.pickerTitle}>{t("aiModels.picker.title")}</AppText>

          {AI_MODELS.map((m, i) => (
            <ModelRow
              key={m.id}
              model={m}
              active={selectedId === m.id}
              fits={modelFits(m, Device.totalMemory)}
              last={i === AI_MODELS.length - 1}
              onSelect={() => onSelect(m.id)}
            />
          ))}

          <AppText variant="bodyMd" style={styles.groupFootnote}>
            {t("aiModels.picker.footnote")}
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
// that flips to an "Active" pill on the chosen row. Models the device can't hold are
// dimmed and untappable, with the note swapped for the reason.
function ModelRow({ model, active, fits, last, onSelect }: {
  model: AiModel; active: boolean; fits: boolean; last: boolean; onSelect: () => void;
}) {
  const { t, dict } = useI18n();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled: !fits }}
      disabled={!fits}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.modelRow,
        !last && styles.modelRowDivider,
        !fits && styles.modelRowDisabled,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.modelText}>
        <AppText variant="bodyLg" style={[styles.modelName, active && styles.modelNameActive]}>{model.name}</AppText>
        <AppText variant="bodyMd" style={styles.modelNote}>
          {fits ? aiModelNote(dict, model.id) : t("aiModels.needsMoreMemory")}
        </AppText>
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

// Accordion: reveals/hides its children by animating a clipped container between 0 and the
// children's measured height (plus a matching opacity fade). Height can't ride the native
// driver, so this is JS-driven — fine here, and it sidesteps the Fabric native-opacity flicker.
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [contentH, setContentH] = useState(0);
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: motion.standard,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [open, anim]);

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, contentH] });

  return (
    <Animated.View
      // Before the first measure, size naturally when open / stay flat when closed; once
      // measured, follow the animated height so the reveal tracks the real content height.
      style={[styles.collapsible, contentH === 0 ? { height: open ? undefined : 0 } : { height }, { opacity: anim }]}
      pointerEvents={open ? "auto" : "none"}
    >
      {/* Inner wrapper keeps its natural height (it isn't height-constrained), so onLayout
          reports the true content height even while the outer container is clipped to 0. */}
      <View
        onLayout={(e) => {
          const next = e.nativeEvent.layout.height;
          if (next > 0 && next !== contentH) setContentH(next);
        }}
      >
        {children}
      </View>
    </Animated.View>
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
  // Clips its children while the accordion height animates.
  collapsible: { overflow: "hidden" },
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
  modelRowDisabled: { opacity: 0.4 },
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
  trayArrowUp: { marginBottom: 2 },
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
