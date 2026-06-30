export function computeRatio(doseG: number, waterG: number): number {
  if (!doseG || doseG <= 0) return 0;
  return waterG / doseG;
}

export function formatRatio(ratio: number): string {
  return `1:${ratio.toFixed(1)}`;
}
