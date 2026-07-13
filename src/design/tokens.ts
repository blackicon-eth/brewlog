import { type ViewStyle } from "react-native";

// "Artisanal Brew Ledger" design system (see DESIGN.md). Warm cream canvas, espresso
// ink, action-blue primary, coffee-cherry-red accents. Editorial serif for a coffee's
// "soul" (name/roaster), utilitarian grotesk for the "science" (ratios, counts, labels).

export const colors = {
  // Surfaces — warm off-white "cream & bean"
  background: "#fff8f6",
  surfaceLow: "#fff1ed",
  surfaceContainer: "#ffe9e3",
  surfaceContainerHigh: "#ffe2da",
  surfaceLowest: "#ffffff",
  // Ink
  onSurface: "#2c160e", // espresso brown — primary text
  onSurfaceVariant: "#5b403c", // muted espresso — metadata
  secondary: "#745853", // softer brown — kickers
  outline: "#a18a83",
  outlineVariant: "#e3beb8",
  // Action blue
  primary: "#004ac6",
  onPrimary: "#ffffff",
  // Coffee-cherry red accents
  tertiary: "#ab0b18",
  error: "#ba1a1a",
} as const;

// Loaded in App.tsx via expo-font. EB Garamond is the editorial serif (a coffee's
// "soul"); Hanken Grotesk is the utilitarian grotesk (the "science"). Each family name
// already encodes its weight, so styles set fontFamily WITHOUT fontWeight (avoids
// Android faux-bold rendering on top of an already-weighted face).
export const fonts = {
  display: "EBGaramond_600SemiBold",
  displayMedium: "EBGaramond_500Medium",
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemiBold: "HankenGrotesk_600SemiBold",
  sansBold: "HankenGrotesk_700Bold",
} as const;

export const radii = { sm: 4, base: 8, md: 12, lg: 16, full: 9999 } as const;

export const spacing = { base: 8, container: 20, stack: 16, section: 32, gutter: 12 } as const;

// Uniform gap between the safe-area top inset and the first content on every
// top-anchored page (masthead, detail, forms) — keeps their top margins equal.
export const screenTopGap = 12;

// Motion — one shared speed ramp so every animation in the app agrees. Durations in ms
// (Animated.timing); springs are ready-made presets for Animated.spring.
export const motion = {
  fast: 120, // exits & dismissals — get out of the way
  quick: 160, // small state flips: color fades, active-tab tints
  standard: 200, // structural moves: screen crossfades, list entrances, sheet travel
  pulse: 420, // ambient loops: streaming carets (half-period of the blink)
  gentle: 450, // soft state fades: phase hand-offs, cue decays
  slow: 550, // decorative swells & ripples
  drift: 1100, // ambient loops: water surfaces & waves (one full travel period)
  springGlide: { friction: 16, tension: 220 }, // selector pills gliding between options (barely any overshoot)
  springPop: { bounciness: 3, speed: 18 }, // modals & sheets arriving
  springSnap: { bounciness: 0, speed: 22 }, // drag-release snap-back
} as const;

// Ambient shadows — soft brown lift for cards, prouder blue-tinted lift for the FAB.
export const shadows: Record<"card" | "fab", ViewStyle> = {
  card: {
    shadowColor: "#2c160e",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fab: {
    shadowColor: "#004ac6",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};
