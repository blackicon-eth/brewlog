import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getDb } from "../db/database";
import { getCoffee, createCoffee, updateCoffee, deleteCoffee, setCoffeeArchived } from "../db/coffees";
import { listPhotosForCoffee, createCoffeePhoto, deleteCoffeePhoto, updateCoffeePhotoPosition } from "../db/coffeePhotos";
import * as photoStore from "../media/photoStore";
import { makeId } from "../lib/ids";
import { AppText, TextField, PillButton, NaturalLanguageIntake, Chevron, TrashIcon, ArchiveIcon, useAppModal } from "../components/ui";
import { buildCoffeeIntakePrompt, parseCoffeeIntake, type CoffeeIntake } from "../qvac/intake";
import { useQvac } from "../qvac/QvacProvider";
import { useI18n } from "../i18n/LocaleProvider";
import { colors, radii, spacing, screenTopGap } from "../design/tokens";

type Nav = NativeStackNavigationProp<RootStackParamList, "CoffeeForm">;
type Rt = RouteProp<RootStackParamList, "CoffeeForm">;

export function CoffeeFormScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Rt>();
  const modal = useAppModal();
  const { aiEnabled } = useQvac();
  const { t } = useI18n();
  const editingId = params?.coffeeId;
  // The freeform intake box only exists when the assistant is on — with it off, a new
  // log must open straight on the manual form (the intake renders null and would leave
  // the page empty forever).
  const [revealed, setRevealed] = useState(!!editingId || !aiEnabled);

  const [roaster, setRoaster] = useState("");
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [process, setProcess] = useState("");
  const [roastLevel, setRoastLevel] = useState("");
  const [roastDate, setRoastDate] = useState("");
  const [notes, setNotes] = useState("");
  const [archived, setArchived] = useState(false);
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  // Stable coffee id, generated once — so gallery photos file under a known id even
  // before a brand-new coffee is first saved.
  const coffeeIdRef = useRef(editingId ?? makeId());
  const [photos, setPhotos] = useState<{ id: string; uri: string; persisted: boolean }[]>([]);
  const removedRef = useRef<{ id: string; uri: string }[]>([]);
  const savedRef = useRef(false);
  const photosRef = useRef(photos);
  const pickingRef = useRef(false);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const db = await getDb();
        const c = await getCoffee(db, editingId);
        if (!c) {
          modal.alert(t("coffeeForm.openErrorTitle"), t("coffeeForm.openErrorBody"));
          nav.goBack();
          return;
        }
        setRoaster(c.roaster); setName(c.name); setOrigin(c.origin ?? "");
        setProcess(c.process ?? ""); setRoastLevel(c.roastLevel ?? "");
        setRoastDate(c.roastDate ?? ""); setNotes(c.notes ?? "");
        setArchived(!!c.archived); setCreatedAt(c.createdAt);
        setPhotos((await listPhotosForCoffee(db, editingId)).map((p) => ({ id: p.id, uri: p.uri, persisted: true })));
      } catch (e: any) {
        modal.alert(t("coffeeForm.openErrorTitle"), String(e?.message ?? e));
        nav.goBack();
      }
    })();
  }, [editingId]);

  // Keep a ref mirror of photos so the unmount-only cleanup below can read the latest
  // value without re-running (and re-deleting in-use files) on every photos change.
  useEffect(() => { photosRef.current = photos; }, [photos]);

  // Cleanup for photos that were picked but never saved (form abandoned): the file was
  // written to disk on pick, so it must be reclaimed if the coffee row never lands.
  // Deps: [] — this must only fire at true unmount, not on every photos change, or a
  // just-picked (not-yet-persisted) photo gets deleted the moment a second one is added.
  useEffect(() => () => {
    if (savedRef.current) return;
    for (const p of photosRef.current) if (!p.persisted) photoStore.deletePhotoFile(p.uri);
  }, []);

  async function onAddPhoto() {
    if (photos.length >= photoStore.MAX_PHOTOS) return;
    if (pickingRef.current) return;
    const choice = await modal.choose({
      title: t("coffeeForm.addPhotoModalTitle"),
      options: [
        { key: "camera", label: t("coffeeForm.takePhoto") },
        { key: "gallery", label: t("coffeeForm.chooseFromGallery") },
      ],
    });
    if (!choice) return;
    pickingRef.current = true;
    try {
      if (choice === "camera") {
        const r = await photoStore.takePhoto();
        if (r === "denied") {
          await modal.alert(t("coffeeForm.cameraDeniedTitle"), t("coffeeForm.cameraDeniedBody"));
          return;
        }
        if (r) setPhotos((prev) => [...prev, { id: r.id, uri: r.uri, persisted: false }]);
      } else {
        const remaining = photoStore.MAX_PHOTOS - photos.length;
        const picked = await photoStore.pickFromGallery(remaining);
        if (picked.length) {
          setPhotos((prev) => [...prev, ...picked.map((p) => ({ id: p.id, uri: p.uri, persisted: false }))]);
        }
      }
    } finally {
      pickingRef.current = false;
    }
  }

  function onRemovePhoto(photoId: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (!target) return prev;
      if (target.persisted) removedRef.current.push({ id: target.id, uri: target.uri });
      else photoStore.deletePhotoFile(target.uri);
      return prev.filter((p) => p.id !== photoId);
    });
  }

  function applyParsed(p: CoffeeIntake) {
    if (p.roaster) setRoaster(p.roaster);
    if (p.name) setName(p.name);
    if (p.origin) setOrigin(p.origin);
    if (p.process) setProcess(p.process);
    if (p.roastLevel) setRoastLevel(p.roastLevel);
    if (p.roastDate) setRoastDate(p.roastDate);
    if (p.notes) setNotes(p.notes);
    setRevealed(true);
  }

  async function onSave() {
    if (!roaster.trim() || !name.trim()) { modal.alert(t("coffeeForm.missingTitle"), t("coffeeForm.missingBody")); return; }
    try {
      const db = await getDb();
      const coffee = {
        id: coffeeIdRef.current,
        roaster: roaster.trim(), name: name.trim(),
        origin: origin.trim() || null, process: process.trim() || null,
        roastLevel: roastLevel.trim() || null, roastDate: roastDate.trim() || null,
        notes: notes.trim() || null, archived, createdAt: createdAt ?? Date.now(),
      };
      await db.execAsync("BEGIN");
      try {
        if (editingId) await updateCoffee(db, coffee); else await createCoffee(db, coffee);

        for (const r of removedRef.current) await deleteCoffeePhoto(db, r.id);
        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          if (!p.persisted) {
            await createCoffeePhoto(db, { id: p.id, coffeeId: coffeeIdRef.current, uri: p.uri, position: i, createdAt: Date.now() });
          } else {
            await updateCoffeePhotoPosition(db, p.id, i);
          }
        }
        await db.execAsync("COMMIT");
      } catch (e) {
        await db.execAsync("ROLLBACK");
        throw e;
      }

      // Files are only reclaimed after the transaction commits — deleting them earlier
      // (or leaving savedRef true before commit) would leave orphaned files or a
      // disabled unmount cleanup if the writes above rolled back.
      savedRef.current = true;
      for (const r of removedRef.current) photoStore.deletePhotoFile(r.uri);

      nav.goBack();
    } catch (e: any) {
      modal.alert(t("coffeeForm.saveErrorTitle"), String(e?.message ?? e));
    }
  }

  async function onDelete() {
    if (!editingId) return;
    const ok = await modal.confirm({
      title: t("coffeeForm.deleteConfirmTitle"),
      message: t("coffeeForm.deleteConfirmMessage"),
      confirmLabel: t("common.delete"),
      destructive: true,
    });
    if (!ok) return;
    try {
      const db = await getDb();
      const existing = await listPhotosForCoffee(db, editingId);
      await deleteCoffee(db, editingId);
      for (const p of existing) photoStore.deletePhotoFile(p.uri);
      nav.navigate("Main");
    } catch (e: any) {
      modal.alert(t("coffeeForm.deleteErrorTitle"), String(e?.message ?? e));
    }
  }

  // Archive asks first (it changes where the coffee lives); restoring is immediate — it's
  // harmless and reversible. Either way the flag flips in place, no full save needed.
  async function onToggleArchive() {
    if (!editingId) return;
    if (archived) {
      try {
        await setCoffeeArchived(await getDb(), editingId, false);
        setArchived(false);
      } catch (e: any) {
        modal.alert(t("coffeeForm.restoreErrorTitle"), String(e?.message ?? e));
      }
      return;
    }
    const ok = await modal.confirm({
      title: t("coffeeForm.archiveConfirmTitle"),
      message: t("coffeeForm.archiveConfirmMessage"),
      confirmLabel: t("coffeeForm.archive"),
    });
    if (!ok) return;
    try {
      await setCoffeeArchived(await getDb(), editingId, true);
      setArchived(true);
    } catch (e: any) {
      modal.alert(t("coffeeForm.archiveErrorTitle"), String(e?.message ?? e));
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + screenTopGap, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.backBtn}>
            <Chevron direction="left" size={12} thickness={2.5} color={colors.onSurface} />
          </Pressable>
          {editingId ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={onToggleArchive}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={archived ? t("coffeeForm.a11y.unarchiveCoffee") : t("coffeeForm.a11y.archiveCoffee")}
                style={({ pressed }) => [styles.archiveBtn, pressed && styles.archivePressed]}
              >
                <ArchiveIcon size={15} color={colors.onSurfaceVariant} thickness={1.6} />
                <AppText variant="labelMd" style={styles.archiveText}>
                  {archived ? t("coffeeForm.unarchive") : t("coffeeForm.archive")}
                </AppText>
              </Pressable>
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("coffeeForm.a11y.deleteCoffee")}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
              >
                <TrashIcon size={16} color={colors.tertiary} thickness={1.6} />
                <AppText variant="labelMd" style={styles.deleteText}>{t("common.delete")}</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
        <AppText variant="labelSm">{editingId ? t("coffeeForm.editKicker") : t("coffeeForm.newKicker")}</AppText>
        <AppText variant="headlineLg" style={styles.title}>
          {editingId ? t("coffeeForm.editTitle") : t("coffeeForm.newTitle")}
        </AppText>

        {!revealed ? (
          <NaturalLanguageIntake
            kicker={t("coffeeForm.intakeKicker")}
            placeholder={t("coffeeForm.intakePlaceholder")}
            buildPrompt={buildCoffeeIntakePrompt}
            parse={parseCoffeeIntake}
            onParsed={applyParsed}
            onManual={() => setRevealed(true)}
          />
        ) : (
          <>
            <AppText variant="labelSm" style={styles.firstSection}>{t("coffeeForm.photosSection")}</AppText>
            <View style={styles.photoRow}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoTile}>
                  <Image source={{ uri: p.uri }} style={styles.photoImage} />
                  <Pressable
                    onPress={() => onRemovePhoto(p.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("coffeeForm.removePhoto")}
                    style={({ pressed }) => [styles.removeBadge, pressed && styles.removeBadgePressed]}
                  >
                    <RemoveGlyph />
                  </Pressable>
                </View>
              ))}
              {photos.length < photoStore.MAX_PHOTOS ? (
                <Pressable
                  onPress={onAddPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={t("coffeeForm.addPhoto")}
                  style={({ pressed }) => [styles.addTile, pressed && styles.addTilePressed]}
                >
                  <PlusGlyph />
                  <AppText variant="labelSm" style={styles.addTileLabel}>{t("coffeeForm.addPhoto")}</AppText>
                </Pressable>
              ) : null}
            </View>

            <AppText variant="labelSm" style={styles.section}>{t("coffeeForm.beanSection")}</AppText>
            <TextField label={t("coffeeForm.roasterLabel")} value={roaster} onChangeText={setRoaster} placeholder={t("coffeeForm.roasterPlaceholder")} required autoCapitalize="words" />
            <TextField label={t("coffeeForm.nameLabel")} value={name} onChangeText={setName} placeholder={t("coffeeForm.namePlaceholder")} required autoCapitalize="words" />

            <AppText variant="labelSm" style={styles.section}>{t("coffeeForm.detailsSection")}</AppText>
            <View style={styles.row}>
              <TextField label={t("coffeeForm.originLabel")} value={origin} onChangeText={setOrigin} placeholder={t("coffeeForm.originPlaceholder")} autoCapitalize="words" style={styles.col} />
              <TextField label={t("coffeeForm.processLabel")} value={process} onChangeText={setProcess} placeholder={t("coffeeForm.processPlaceholder")} style={styles.col} />
            </View>
            <View style={styles.row}>
              <TextField label={t("coffeeForm.roastLevelLabel")} value={roastLevel} onChangeText={setRoastLevel} placeholder={t("coffeeForm.roastLevelPlaceholder")} style={styles.col} />
              <TextField label={t("coffeeForm.roastDateLabel")} value={roastDate} onChangeText={setRoastDate} placeholder={t("coffeeForm.roastDatePlaceholder")} autoCapitalize="none" style={styles.col} />
            </View>

            <AppText variant="labelSm" style={styles.section}>{t("coffeeForm.notesSection")}</AppText>
            <TextField value={notes} onChangeText={setNotes} multiline placeholder={t("coffeeForm.notesPlaceholder")} />

            <View style={styles.actions}>
              <PillButton label={editingId ? t("coffeeForm.saveEdit") : t("coffeeForm.saveNew")} onPress={onSave} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Hand-drawn "+" — same zero-dep View-based approach as TrashIcon/ArchiveIcon, so the
// add-photo affordance reads as part of the same glyph family rather than a stray import.
function PlusGlyph({ size = 20, color = colors.primary, thickness = 2 }: { size?: number; color?: string; thickness?: number }) {
  const bar = { position: "absolute" as const, backgroundColor: color, borderRadius: thickness };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { width: size, height: thickness, top: (size - thickness) / 2, left: 0 }]} />
      <View style={[bar, { width: thickness, height: size, left: (size - thickness) / 2, top: 0 }]} />
    </View>
  );
}

// Hand-drawn "×" for the remove badge — two crossed bars, same family as PlusGlyph.
function RemoveGlyph({ size = 12, color = colors.onPrimary, thickness = 1.6 }: { size?: number; color?: string; thickness?: number }) {
  const bar = {
    position: "absolute" as const,
    width: size,
    height: thickness,
    backgroundColor: color,
    borderRadius: thickness,
    top: (size - thickness) / 2,
    left: 0,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[bar, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[bar, { transform: [{ rotate: "-45deg" }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.container },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { height: 34, justifyContent: "center" },
  // Archive (grey) + Delete (cherry) pills, top-right of the form (edit mode only).
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  archiveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant,
    paddingLeft: 12, paddingRight: 14, paddingVertical: 7,
  },
  archivePressed: { opacity: 0.55, backgroundColor: "rgba(60,50,45,0.06)" },
  archiveText: { color: colors.onSurfaceVariant },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.outlineVariant,
    paddingLeft: 12, paddingRight: 14, paddingVertical: 7,
  },
  deletePressed: { opacity: 0.55, backgroundColor: "rgba(171,11,24,0.08)" },
  deleteText: { color: colors.tertiary },
  title: { marginTop: 6, marginBottom: spacing.base },
  section: { marginTop: spacing.section, marginBottom: spacing.gutter },
  // The leading section (Photos) sits snug under the title — where the hero image used to be.
  firstSection: { marginTop: spacing.base, marginBottom: spacing.gutter },
  row: { flexDirection: "row", gap: spacing.gutter },
  col: { flex: 1 },
  // Photo tiles: a fixed small square (~a third of the row) via flexBasis/maxWidth, not
  // flex:1 — flex:1 stretches a lone tile (the add tile alone, on every new coffee) to
  // fill the whole row. flexGrow:0 keeps it that size regardless of sibling count; the
  // row's justifyContent keeps 1–4 tiles left-aligned rather than spread out. Hairline
  // borders, not elevation — these restyle on every add/remove and Fabric flickers
  // elevation shadows on frequent restyles (see AGENTS.md).
  photoRow: { flexDirection: "row", gap: spacing.gutter, justifyContent: "flex-start" },
  photoTile: {
    flexBasis: "31%", flexGrow: 0, maxWidth: "31%", aspectRatio: 1, borderRadius: radii.md, overflow: "hidden",
    borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceLowest,
  },
  photoImage: { width: "100%", height: "100%" },
  removeBadge: {
    position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: radii.full,
    backgroundColor: "rgba(44,22,14,0.55)", alignItems: "center", justifyContent: "center",
  },
  removeBadgePressed: { opacity: 0.6 },
  // Dashed frame borrows the "target zone" idiom from the Coffee Compass tool — a cut-out
  // waiting to be filled, in the same action-blue as every other affirmative affordance.
  addTile: {
    flexBasis: "31%", flexGrow: 0, maxWidth: "31%", aspectRatio: 1, borderRadius: radii.md, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: colors.primary, backgroundColor: "rgba(0,74,198,0.05)",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  addTilePressed: { backgroundColor: "rgba(0,74,198,0.12)" },
  // textAlign so a label wider than the tile (e.g. Italian "Aggiungi foto") stays
  // centered under the + instead of left-aligning once it spans the full width.
  addTileLabel: { color: colors.primary, textAlign: "center", paddingHorizontal: 4 },
  actions: { marginTop: spacing.section },
});
