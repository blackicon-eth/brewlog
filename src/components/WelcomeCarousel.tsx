import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { AppText, Chevron, PillButton } from "./ui";
import { useQvac } from "../qvac/QvacProvider";
import { defaultModelId, resolveModel } from "../lib/aiModels";
import { useI18n } from "../i18n/LocaleProvider";
import { colors, fonts, motion, radii, spacing } from "../design/tokens";

// The ledger's frontispiece: a full-page, once-only welcome that reads like the opening
// pages of a printed journal. A cover, five tipped-in "plates" (one per tab, a framed
// screenshot with a letterpress caption), and a closing page that asks the one question
// the app has — whether to bring the assistant along. Replaces the old centered modal.
//
// Rendered as an overlay above the navigator (not a route): the app mounts beneath it,
// so finishing is a single fade with no navigation hand-off.

// The five plates, in navbar order. Screenshots live in assets/welcome/<locale> (captured
// from a real device in both languages, status bar and gesture pill cropped off); the tab
// caption resolves from the tabs.* dictionary so it always matches the navbar wording.
const PLATE_IMAGES: Record<"en" | "it", Record<string, number>> = {
  en: {
    home: require("../../assets/welcome/en/home.png"),
    brews: require("../../assets/welcome/en/brews.png"),
    chat: require("../../assets/welcome/en/chat.png"),
    tools: require("../../assets/welcome/en/tools.png"),
    settings: require("../../assets/welcome/en/settings.png"),
  },
  it: {
    home: require("../../assets/welcome/it/home.png"),
    brews: require("../../assets/welcome/it/brews.png"),
    chat: require("../../assets/welcome/it/chat.png"),
    tools: require("../../assets/welcome/it/tools.png"),
    settings: require("../../assets/welcome/it/settings.png"),
  },
};

const PLATE_KEYS = ["home", "brews", "chat", "tools", "settings"] as const;

const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
const PAGE_COUNT = PLATE_KEYS.length + 2; // cover + plates + closing
const LAST = PAGE_COUNT - 1;

// Plate aspect after the capture crop (540×1080) — every plate is framed to this so
// mixed-density screenshots can never stretch.
const PLATE_ASPECT = 540 / 1080;

// Dot rail geometry (fixed so the sliding indicator can be driven natively).
const DOT = 6;
const DOT_GAP = 10;
const DOT_PITCH = DOT + DOT_GAP;

export function WelcomeCarousel() {
  const { onboarded, aiEnabled, completeOnboarding, setAiEnabled, setModel, prepare } = useQvac();
  const { t, locale } = useI18n();
  const plateImages = PLATE_IMAGES[locale === "it" ? "it" : "en"];
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Dev preview switch: set true to force the carousel on every launch (e.g. to review it
  // on an already-onboarded device). Must stay false in normal builds.
  const FORCE_PREVIEW = false;

  // Decided synchronously, same contract as the old modal, so the overlay is an opaque
  // veil from the very first frame — the home page never flashes underneath while the
  // app mounts behind it.
  const [open, setOpen] = useState(() => FORCE_PREVIEW || (!onboarded && !aiEnabled));
  const [shown, setShown] = useState(open);

  // Users who already switched the assistant on before this existed are grandfathered in:
  // marked onboarded, never welcomed twice.
  useEffect(() => {
    if (!FORCE_PREVIEW && !onboarded && aiEnabled) completeOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The device suggests its own model (featherweight under the RAM floor, the sweet spot
  // otherwise) — resolved once; this component mounts once, at app start.
  const suggested = useRef(resolveModel(defaultModelId(Device.totalMemory))).current;

  // Entrance: the veil holds a quiet beat (motion.drift) while the app settles behind it,
  // then the cover rises in one stagger. Exit: a quick fade of the whole overlay revealing
  // the already-mounted app. `shown` keeps the tree alive through the exit animation.
  const enterAnim = useRef(new Animated.Value(0)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (open) {
      Animated.timing(enterAnim, { toValue: 1, duration: motion.slow, delay: motion.drift, useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(exitAnim, { toValue: 0, duration: motion.standard, useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (e: { nativeEvent: { contentOffset: { x: number } } }) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / W);
          setPage((prev) => (prev === p ? prev : p));
        },
      }),
    [scrollX, W],
  );

  if (!shown) return null;

  const goTo = (index: number) => {
    listRef.current?.scrollTo({ x: index * W, animated: true });
  };

  // Both closing choices finish onboarding; the difference is whether the assistant's
  // download starts (it carries on in the background — the Chat tab shows its progress).
  const beginWithAssistant = () => {
    completeOnboarding();
    setModel(suggested.id); // no-op when it's already the stored default
    setAiEnabled(true);
    prepare();
    setOpen(false);
  };
  const beginWithout = () => {
    completeOnboarding();
    setOpen(false);
  };

  // Plate sizing: as tall as the space between chrome allows, capped so a caption never
  // gets crowded on short screens.
  const plateH = Math.min(H * 0.46, 440);
  const plateW = plateH * PLATE_ASPECT;

  // Only the exit animates the overlay itself — on entrance it must be a solid veil.
  const overlayStyle = { opacity: exitAnim };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlayStyle]} accessibilityViewIsModal>
      <StatusBar style="dark" />

      <Animated.ScrollView
        ref={listRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: insets.top }}
      >
        <CoverPage
          width={W}
          anim={enterAnim}
          kicker={t("welcome.cover.kicker")}
          body={t("welcome.cover.body")}
          swipe={t("welcome.cover.swipe")}
        />
        {PLATE_KEYS.map((key, i) => (
          <PlatePage
            key={key}
            index={i}
            width={W}
            plateW={plateW}
            plateH={plateH}
            image={plateImages[key]}
            scrollX={scrollX}
            tabLabel={t(`tabs.${key}` as "tabs.home")}
            numeral={NUMERALS[i]}
            title={t(`welcome.${key}.title` as "welcome.home.title")}
            body={t(`welcome.${key}.body` as "welcome.home.body")}
          />
        ))}
        <ClosingPage
          width={W}
          title={t("welcome.closing.title")}
          body={t("welcome.closing.body")}
          suggestedLabel={t("welcome.closing.suggestedLabel")}
          modelLine={t("welcome.closing.suggestedValue", { name: suggested.name, size: suggested.size })}
          optionalNote={t("welcome.closing.optionalNote")}
          enableLabel={t("welcome.closing.enable")}
          withoutLabel={t("welcome.closing.without")}
          onEnable={beginWithAssistant}
          onSkip={beginWithout}
        />
      </Animated.ScrollView>

      {/* Fixed chrome: the dot rail with its sliding ink marker, a compact Next on the
          right (the empty left side keeps the rail centered). The closing page carries
          its own actions, so Next bows out there and the rail stands alone. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.footerSide} />

        <View style={styles.dotRail} pointerEvents="none">
          {Array.from({ length: PAGE_COUNT }, (_, i) => (
            <View key={i} style={styles.dot} />
          ))}
          <Animated.View
            style={[
              styles.dotMarker,
              {
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [0, (PAGE_COUNT - 1) * W],
                      outputRange: [0, (PAGE_COUNT - 1) * DOT_PITCH],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View style={[styles.footerSide, styles.footerRight]}>
          {page < LAST ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("welcome.next")}
              onPress={() => goTo(page + 1)}
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextPressed]}
            >
              <AppText variant="labelSm" style={styles.nextText}>{t("welcome.next")}</AppText>
              <Chevron direction="right" size={8} thickness={2} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Cover — the title page ─────────────────────────────────────────────────────────────
// Bean mark, double rule, the app's name set large in the serif, one promise, and a
// quiet swipe cue. The entrance anim staggers each element into place.
function CoverPage({ width, anim, kicker, body, swipe }: {
  width: number;
  anim: Animated.Value;
  kicker: string;
  body: string;
  swipe: string;
}) {
  const rise = (from: number, to: number) => ({
    opacity: anim.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: "clamp" }),
    transform: [{ translateY: anim.interpolate({ inputRange: [from, to], outputRange: [10, 0], extrapolate: "clamp" }) }],
  });

  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.coverInner}>
        <Animated.Image source={require("../../assets/logo-bean.png")} style={[styles.coverMark, rise(0, 0.5)]} />
        <Animated.View style={[styles.coverRules, rise(0.15, 0.65)]}>
          <View style={styles.coverRule} />
          <View style={[styles.coverRule, styles.coverRuleThin]} />
        </Animated.View>
        <Animated.Text style={[styles.coverKicker, rise(0.3, 0.8)]}>{kicker}</Animated.Text>
        <Animated.Text style={[styles.coverTitle, rise(0.4, 0.9)]}>Brewlog</Animated.Text>
        <Animated.View style={rise(0.55, 1)}>
          <AppText variant="bodyMd" style={styles.coverBody}>{body}</AppText>
        </Animated.View>
        <Animated.View style={[styles.swipeCue, rise(0.7, 1)]}>
          <AppText variant="labelSm" style={styles.swipeText}>{swipe}</AppText>
          <Chevron direction="right" size={8} thickness={2} color={colors.secondary} />
        </Animated.View>
      </View>
    </View>
  );
}

// ── Plate — one tab, as a tipped-in photograph ─────────────────────────────────────────
// The screenshot sits in a cream mat inside a hairline ink frame, tilted a degree or so
// like a photo mounted by hand; alternating tilt keeps the spread lively. The plate
// drifts slower than the page (a gentle parallax), the caption arrives with the page.
function PlatePage(p: {
  index: number;
  width: number;
  plateW: number;
  plateH: number;
  image: number;
  scrollX: Animated.Value;
  tabLabel: string;
  numeral: string;
  title: string;
  body: string;
}) {
  const pageIndex = p.index + 1; // page 0 is the cover
  const inputRange = [(pageIndex - 1) * p.width, pageIndex * p.width, (pageIndex + 1) * p.width];
  const tilt = p.index % 2 === 0 ? "-1.7deg" : "1.5deg";

  return (
    <View style={[styles.page, styles.platePage, { width: p.width }]}>
      <Animated.View
        style={[
          styles.plateFrame,
          {
            width: p.plateW + 24,
            transform: [
              { translateX: p.scrollX.interpolate({ inputRange, outputRange: [p.width * 0.16, 0, -p.width * 0.16] }) },
              { rotate: tilt },
            ],
          },
        ]}
      >
        <Image source={p.image} style={{ width: p.plateW, height: p.plateH, borderRadius: radii.base }} />
      </Animated.View>

      <Animated.View
        style={[
          styles.caption,
          {
            opacity: p.scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" }),
            transform: [
              { translateX: p.scrollX.interpolate({ inputRange, outputRange: [p.width * 0.06, 0, -p.width * 0.06] }) },
            ],
          },
        ]}
      >
        <View style={styles.captionKickerRow}>
          <AppText variant="labelSm" style={styles.captionNumeral}>{p.numeral}</AppText>
          <View style={styles.captionTick} />
          <AppText variant="labelSm" style={styles.captionTab}>{p.tabLabel}</AppText>
        </View>
        <AppText variant="headlineMd" style={styles.captionTitle}>{p.title}</AppText>
        <AppText variant="bodyMd" style={styles.captionBody}>{p.body}</AppText>
      </Animated.View>
    </View>
  );
}

// ── Closing — the colophon ─────────────────────────────────────────────────────────────
// The one question the app has: bring the assistant along, or begin without it. Saying
// yes starts the download and lets the carousel go; the Chat tab shows the progress.
function ClosingPage(p: {
  width: number;
  title: string;
  body: string;
  suggestedLabel: string;
  modelLine: string;
  optionalNote: string;
  enableLabel: string;
  withoutLabel: string;
  onEnable: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={[styles.page, { width: p.width }]}>
      <View style={styles.closingInner}>
        <Image source={require("../../assets/logo-bean.png")} style={styles.closingMark} />
        <AppText variant="headlineMd" style={styles.closingTitle}>{p.title}</AppText>
        <AppText variant="bodyMd" style={styles.closingBody}>{p.body}</AppText>

        <View style={styles.modelNote}>
          <AppText variant="labelSm" style={styles.modelNoteLabel}>{p.suggestedLabel}</AppText>
          <AppText variant="bodyMd" style={styles.modelNoteValue}>{p.modelLine}</AppText>
        </View>
        <AppText variant="bodyMd" style={styles.optionalNote}>{p.optionalNote}</AppText>

        <PillButton label={p.enableLabel} variant="primary" onPress={p.onEnable} />
        <Pressable
          accessibilityRole="button"
          onPress={p.onSkip}
          style={({ pressed }) => [styles.withoutBtn, pressed && styles.pressed]}
        >
          <AppText variant="labelMd" style={styles.withoutText}>{p.withoutLabel}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, zIndex: 10, elevation: 10 },
  page: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  // Plate pages sit higher than true center: the footer chrome eats the bottom of the
  // screen, so extra bottom padding rebalances the eye and trims the gap above the plate.
  platePage: { paddingBottom: 72 },

  // Cover
  coverInner: { alignItems: "center", maxWidth: 340 },
  coverMark: { width: 44, height: 44, marginBottom: 22 },
  coverRules: { alignSelf: "stretch", gap: 3, marginBottom: 18 },
  coverRule: { height: 2, backgroundColor: colors.onSurface },
  coverRuleThin: { height: StyleSheet.hairlineWidth },
  coverKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.secondary,
  },
  coverTitle: {
    fontFamily: fonts.display,
    fontSize: 54,
    // EB Garamond descenders clip on Android — the "g" needs ~1.45× line height.
    lineHeight: 78,
    includeFontPadding: false,
    color: colors.onSurface,
    marginTop: 4,
  },
  coverBody: { textAlign: "center", color: colors.onSurfaceVariant, lineHeight: 22, marginTop: 10 },
  swipeCue: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 34 },
  swipeText: { color: colors.secondary },

  // Plates
  plateFrame: {
    padding: 11,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: "#2c160e",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    alignItems: "center",
  },
  caption: { alignItems: "center", marginTop: 26, maxWidth: 330 },
  captionKickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  captionNumeral: { color: colors.tertiary },
  captionTick: { width: 14, height: StyleSheet.hairlineWidth, backgroundColor: colors.outline },
  captionTab: { color: colors.secondary },
  // EB Garamond descenders clip on Android — explicit room for headlineMd. Both texts
  // stretch to the caption's width: intrinsically-sized centered text measures narrower
  // than the serif renders on Android, which silently clips the last word.
  captionTitle: { alignSelf: "stretch", marginTop: 8, lineHeight: 34, includeFontPadding: false, textAlign: "center" },
  captionBody: { alignSelf: "stretch", marginTop: 6, textAlign: "center", color: colors.onSurfaceVariant, lineHeight: 21 },

  // Closing
  closingInner: { alignItems: "stretch", width: "100%", maxWidth: 360 },
  closingMark: { width: 36, height: 36, alignSelf: "center", marginBottom: 16 },
  closingTitle: { lineHeight: 34, includeFontPadding: false, textAlign: "center" },
  closingBody: { marginTop: 8, textAlign: "center", color: colors.onSurfaceVariant, lineHeight: 22 },
  modelNote: {
    marginTop: 20,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceLowest,
  },
  modelNoteLabel: { color: colors.secondary },
  modelNoteValue: { marginTop: 3, fontFamily: fonts.sansSemiBold, color: colors.onSurface },
  optionalNote: { marginTop: 12, marginBottom: 18, lineHeight: 20, color: colors.secondary, textAlign: "center" },
  withoutBtn: { alignSelf: "center", marginTop: 8, paddingVertical: 13, paddingHorizontal: 20 },
  withoutText: { color: colors.secondary },

  // Footer chrome
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.container,
  },
  // Fixed height so the rail doesn't drop when Next bows out on the last page.
  footerSide: { flex: 1, height: 36, justifyContent: "center" },
  footerRight: { alignItems: "flex-end" },
  pressed: { opacity: 0.7 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  nextPressed: { opacity: 0.85 },
  nextText: { color: colors.onPrimary },

  dotRail: { flexDirection: "row", gap: DOT_GAP, alignItems: "center" },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  dotMarker: {
    position: "absolute",
    left: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.tertiary,
  },
});
