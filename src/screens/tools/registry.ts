import type { ToolId, ToolModule } from "./types";
import { ratioTool } from "./ratio";
import { timerTool } from "./timer";
import { extractionTool } from "./extraction";
import { phasedTool } from "./phased";
import { compassTool } from "./compass";

// Ordered most-useful → least (TOOLS.md ranking). The grid renders in this order; the host
// screen resolves a tapped card to its module by id. Each module is authored independently
// under its own folder, so this file is the single place they're assembled.
export const TOOLS: ToolModule[] = [
  ratioTool,
  timerTool,
  extractionTool,
  phasedTool,
  compassTool,
];

export const TOOLS_BY_ID = Object.fromEntries(
  TOOLS.map((t) => [t.meta.id, t]),
) as Record<ToolId, ToolModule>;
