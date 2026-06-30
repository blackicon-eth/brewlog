---
name: Artisanal Brew Ledger
colors:
  surface: '#fff8f6'
  surface-dim: '#fbd1c4'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1ed'
  surface-container: '#ffe9e3'
  surface-container-high: '#ffe2da'
  surface-container-highest: '#ffdbd0'
  on-surface: '#2c160e'
  on-surface-variant: '#434655'
  inverse-surface: '#442a22'
  inverse-on-surface: '#ffede8'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#745853'
  on-secondary: '#ffffff'
  secondary-container: '#fed7d0'
  on-secondary-container: '#795c57'
  tertiary: '#ab0b18'
  on-tertiary: '#ffffff'
  tertiary-container: '#cf2c2d'
  on-tertiary-container: '#ffecea'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffdad4'
  secondary-fixed-dim: '#e3beb8'
  on-secondary-fixed: '#2b1613'
  on-secondary-fixed-variant: '#5b403c'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ac'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#fff8f6'
  on-background: '#2c160e'
  surface-variant: '#ffdbd0'
typography:
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: EB Garamond
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  stack-gap: 16px
  section-gap: 32px
  gutter: 12px
---

## Brand & Style

This design system is built for the intentional coffee enthusiast. The aesthetic marries the intellectual rigor of a scientific log with the warm, sensory experience of a specialty cafe. 

The style is **Modern Minimalism** with a focus on high-end editorial clarity. It utilizes heavy whitespace to allow high-quality photography and detailed brewing data to breathe. The emotional response is one of calm focus, precision, and tactile quality. Visual hierarchy is established through extreme typographic contrast—pairing high-character serifs with utilitarian sans-serifs—to distinguish between the "soul" of the coffee and the "science" of the brew.

## Colors

The palette is grounded in the organic lifecycle of coffee. 

*   **Primary (Action Blue):** A functional, high-visibility blue used exclusively for the Floating Action Button (FAB) and critical interactive states. It provides a modern, digital utility feel against the organic tones.
*   **Secondary (Espresso Brown):** A deep, rich brown used for primary text, headers, and iconography to maintain high legibility without the harshness of pure black.
*   **Tertiary (Coffee Cherry Red):** A vibrant accent used for status indicators, "flavor notes," and high-priority alerts.
*   **Neutral (Cream & Bean):** A warm, off-white cream (`#FDFCF8`) serves as the canvas, reducing eye strain and feeling more "analog" than pure white. Lighter brown tints are used for secondary metadata and borders.

## Typography

This design system uses a sophisticated duo-font pairing. 

**EB Garamond** is reserved for the "Product Name" (e.g., the Roaster or the Variety). It should be set with tight tracking and used in large sizes to evoke a premium editorial feel.

**Hanken Grotesk** handles all functional UI elements, metadata, and instructional text. Its clean, geometric shapes ensure that technical brewing variables (ratios, temperatures, times) are instantly readable at a glance. Label styles should use uppercase styling with increased letter spacing to provide a clear "form" or "log" structure.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first interaction. 

*   **Margins:** A generous 20px side margin ensures content does not feel cramped on narrow displays.
*   **Vertical Rhythm:** Built on an 8px baseline. Use 32px gaps between major sections (e.g., "Brew Settings" vs "Tasting Notes") and 16px gaps between related cards.
*   **Safe Areas:** Ensure interactive elements are placed within easy reach of the thumb, particularly the Blue FAB which is anchored to the bottom right.

## Elevation & Depth

This design system uses **Ambient Shadows** to create a sense of organized layers without overwhelming the minimalist aesthetic.

*   **Cards:** Use a very soft, diffused shadow (15% opacity of the Secondary Brown) with a large blur radius (12px) and 4px vertical offset. This makes the cards appear slightly lifted off the cream background.
*   **Floating Action Button (FAB):** Higher elevation than cards. Increase the shadow opacity to 25% and use a slight blue tint in the shadow to make the primary action feel more prominent.
*   **Inputs:** Use a subtle 1px inset border in a light taupe rather than shadows to indicate "hollow" fields for data entry.

## Shapes

The shape language is **Rounded**, striking a balance between organic softness and professional structure. 

*   **Cards and Container Elements:** Use a 0.5rem (8px) corner radius.
*   **Input Fields:** Match the 0.5rem radius to maintain consistency.
*   **Floating Action Button:** Uses a "Pill" shape (fully rounded) to maximize its visual distinction as the primary trigger for a new brew log.
*   **Tasting Note Chips:** Fully rounded (pill) to suggest a more casual, modular piece of information.

## Components

*   **Primary FAB:** A pill-shaped button using the Primary Action Blue. It should contain a "+" icon and optionally the label "New Brew" in white.
*   **Brew Cards:** A white container with 8px rounded corners and an ambient shadow. The Coffee Roaster/Name is the hero (EB Garamond), while variables like "1:16 Ratio" and "3:00m" are displayed in Hanken Grotesk labels.
*   **Input Fields:** Clean fields with 1px light borders. When focused, the border transitions to the Action Blue.
*   **Status Indicators:** Small, circular dots or high-contrast labels using the Coffee-Cherry Red for things like "Dialing In" or "Favorite."
*   **Steppers/Sliders:** Used for variable entry (Gramage, Clicks, Temperature). These should be tactile with large touch targets.
*   **Visual Logs:** Horizontal list items for brew history, utilizing thin dividers (1px) and generous vertical padding (16px) to maintain the clean, modern aesthetic.