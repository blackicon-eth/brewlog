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
// per-tool character lives on the tool's own dedicated page, not the card.
export type ToolMeta = {
  id: ToolId;
  title: string; // serif card title, e.g. "Brew Ratio"
  blurb: string; // one short line under the title (keep it to ~24 chars so it doesn't wrap past 2 lines)
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
