import type { Coffee, Brew } from "../models/types";
import { formatBrewsTable, formatBrewDetail, daysOffRoast } from "../lib/brewFormat";
import { RECENT_BREWS_CAP, BEST_RECIPE_BREWS_CAP, SYSTEM_PROMPT } from "./promptConfig";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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
  const capped = recent.slice(0, RECENT_BREWS_CAP);
  const user = [
    `Coffee: ${coffeeHeader(coffee, now)}`,
    "",
    "My recent pour-over brews of this coffee (most recent first):",
    formatBrewsTable(capped),
    "",
    "The brew I just made and want to improve:",
    formatBrewDetail(selected),
    "",
    "How should I adjust my next brew of this coffee to make it taste better? " +
      "Give a short ordered list of specific changes (grind, ratio, water temperature, number of " +
      "pours, pour interval). One brief reason each.",
  ].join("\n");
  return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }];
}

export function buildBestRecipePrompt(
  coffee: Coffee, brews: Brew[], now: number = Date.now()
): ChatMessage[] {
  const capped = brews.slice(0, BEST_RECIPE_BREWS_CAP);
  const user = [
    `Coffee: ${coffeeHeader(coffee, now)}`,
    "",
    "My brews of this coffee (most recent first), with parameters, tasting notes (1-5) and overall rating:",
    formatBrewsTable(capped),
    "",
    "Based on these results, what is the best recipe for this coffee? Specify dose, ratio, grind, " +
      "water temperature, number of pours, pour interval and total time. Briefly justify it and " +
      "reference which brews above support your choice.",
  ].join("\n");
  return [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }];
}
