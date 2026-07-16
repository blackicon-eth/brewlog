import type { Coffee, Brew } from "../models/types";
import { formatBrewsTable, formatBrewDetail, daysOffRoast, formatDaysAgo } from "../lib/brewFormat";
import { methodSpec, type BrewMethodId } from "../lib/brewMethods";
import {
  RECENT_BREWS_CAP,
  BEST_RECIPE_BREWS_CAP,
  SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  CHAT_BREVITY_HINT,
  LEDGER_CONTEXT_COFFEES_CAP,
} from "./promptConfig";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// A single visible turn in the free-form assistant chat. The screen carries richer per-turn
// state (id, streamed thinking, pending flags); this is the slice the model needs.
export type ChatTurn = { role: "user" | "assistant"; content: string };

// Prepend the chat system prompt to the running transcript. The screen owns the turn list
// (session-only, never persisted) and rebuilds the full history on every send. The brevity
// hint rides on the newest user message only — restating "keep it short" on every turn is
// where the on-device model reads it most reliably, without bloating the older turns.
export function buildChatHistory(
  turns: ChatTurn[], systemPrompt: string = CHAT_SYSTEM_PROMPT
): ChatMessage[] {
  const msgs: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user") {
      msgs[i] = { ...msgs[i], content: msgs[i].content + CHAT_BREVITY_HINT };
      break;
    }
  }
  return [{ role: "system", content: systemPrompt }, ...msgs];
}

export function coffeeHeader(coffee: Coffee, now: number = Date.now()): string {
  const parts = [`${coffee.roaster} — ${coffee.name}`];
  if (coffee.origin) parts.push(`origin ${coffee.origin}`);
  if (coffee.process) parts.push(`process ${coffee.process}`);
  if (coffee.roastLevel) parts.push(`roast ${coffee.roastLevel}`);
  const dor = daysOffRoast(coffee.roastDate, now);
  if (dor != null) parts.push(`${dor} days off roast`);
  return parts.join(", ");
}

export function buildDiagnosePrompt(
  coffee: Coffee, selected: Brew, recent: Brew[], now: number = Date.now()
): ChatMessage[] {
  const spec = methodSpec(selected.method);
  const capped = recent.slice(0, RECENT_BREWS_CAP);
  const user = [
    `Coffee: ${coffeeHeader(coffee, now)}`,
    "",
    `My recent ${spec.noun} brews of this coffee (most recent first):`,
    formatBrewsTable(capped),
    "",
    "The brew I just made and want to improve:",
    formatBrewDetail(selected),
    "",
    `How should I adjust my next ${spec.noun} brew of this coffee to make it taste better? ` +
      `Give a short ordered list of specific changes (${spec.adjustables}). One brief reason each.`,
  ].join("\n");
  return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }];
}

export function buildBestRecipePrompt(
  coffee: Coffee, brews: Brew[], method: BrewMethodId = "filter", now: number = Date.now()
): ChatMessage[] {
  const spec = methodSpec(method);
  const capped = brews.slice(0, BEST_RECIPE_BREWS_CAP);
  const user = capped.length === 0
    ? [
        `Coffee: ${coffeeHeader(coffee, now)}`,
        "",
        `I haven't logged any ${spec.noun} brews of this coffee yet. Based on the coffee's ` +
          `characteristics, suggest a good starting ${spec.noun} recipe. Specify dose, ratio and ` +
          `${spec.adjustables}. Briefly justify it.`,
      ].join("\n")
    : [
        `Coffee: ${coffeeHeader(coffee, now)}`,
        "",
        `My ${spec.noun} brews of this coffee (most recent first), with parameters, tasting notes (1-5) and overall rating:`,
        formatBrewsTable(capped),
        "",
        `Based on these results, what is the best ${spec.noun} recipe for this coffee? Specify dose, ratio and ` +
          `${spec.adjustables}. Briefly justify it and reference which brews above support your choice.`,
      ].join("\n");
  return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }];
}

// The chat ledger context input — a coffee plus its aggregate stats. Declared structurally
// (not imported from src/db) so advisor.ts stays free of the data layer; CoffeeWithStats
// satisfies it.
export type LedgerCoffee = Coffee & { brewCount: number; avg: number | null; lastBrewedAt: number | null };

function ledgerLine(c: LedgerCoffee, now: number): string {
  const facets = [c.origin, c.process, c.roastLevel].filter(Boolean);
  const paren = facets.length ? ` (${facets.join(", ")})` : "";
  const tag = c.archived ? " (archived)" : "";
  const head = `- ${c.roaster} — ${c.name}${paren}${tag}`;
  if (c.brewCount === 0) return `${head} · no brews yet`;
  const avg = `avg ${c.avg == null ? "unrated" : c.avg.toFixed(1)}`;
  const last = c.lastBrewedAt == null ? "" : ` · last ${formatDaysAgo(c.lastBrewedAt, now)}`;
  return `${head} · ${c.brewCount} brews · ${avg}${last}`;
}

// A compact, whole-shelf roll-up of the user's coffees for the chat system prompt: one line
// each, most-recently-brewed first (brew-less coffees last), capped so the block stays inside
// the 4096-token ctx budget. Empty ledger → "" (chat then uses the bare system prompt).
export function buildLedgerContext(coffees: LedgerCoffee[], now: number = Date.now()): string {
  if (coffees.length === 0) return "";
  const sorted = [...coffees].sort((a, b) => {
    const al = a.lastBrewedAt, bl = b.lastBrewedAt;
    if (al == null && bl == null) return b.createdAt - a.createdAt;
    if (al == null) return 1;
    if (bl == null) return -1;
    return bl - al || b.createdAt - a.createdAt;
  });
  const shown = sorted.slice(0, LEDGER_CONTEXT_COFFEES_CAP);
  const lines = shown.map((c) => ledgerLine(c, now));
  const remainder = sorted.length - shown.length;
  const header =
    "The user's coffee ledger — refer to it when they ask about their coffees\n" +
    "(roaster — name (origin, process, roast) · brews · their average rating 1-5 · most recent brew):";
  const parts = [header, ...lines];
  if (remainder > 0) parts.push(`(+${remainder} more coffees not shown)`);
  return parts.join("\n");
}

// CHAT_SYSTEM_PROMPT with the ledger block appended (bare prompt when the ledger is empty).
export function buildChatSystemPrompt(coffees: LedgerCoffee[], now: number = Date.now()): string {
  const block = buildLedgerContext(coffees, now);
  return block ? `${CHAT_SYSTEM_PROMPT}\n\n${block}` : CHAT_SYSTEM_PROMPT;
}
