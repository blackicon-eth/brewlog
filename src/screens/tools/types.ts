import type { ComponentType } from "react";
import type { TabIconProps } from "../../components/ui";

// The brewing tools shipped in the Tools tab (see TOOLS.md).
export type ToolId =
  | "ratio"
  | "timer"
  | "extraction"
  | "phased"
  | "compass";

// Card face for the Tools grid. Every card renders identically (uniform 2-column grid);
// per-tool character lives on the tool's own dedicated page, not the card. Display copy
// (title/blurb) is NOT carried here — it's resolved per locale via toolTitle(dict, id) /
// toolBlurb(dict, id) in src/lib/i18n/labels.ts, keyed by `id`.
export type ToolMeta = {
  id: ToolId;
  icon: ComponentType<TabIconProps>; // hand-drawn View/Text glyph (no icon libraries)
  comingSoon?: boolean; // dims and disables the grid card; the tool page stays unreachable
};

// One self-contained tool module. Each tool owns a folder under src/screens/tools/<id>/
// exporting a `ToolModule`; the registry stitches them together. `Screen` is the dedicated
// full page opened when the card is tapped — it owns its own header/back/scroll (use ToolPage).
export type ToolModule = {
  meta: ToolMeta;
  Screen: ComponentType;
};
