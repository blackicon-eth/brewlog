import React from "react";
import { ComingSoon, SparkGlyph } from "../components/ui";

// Placeholder for the on-device AI coach (general coffee Q&A, not tied to one coffee).
export function CoachScreen() {
  return (
    <ComingSoon
      section="Coach"
      title="Ask your brewing coach"
      blurb="On-device answers to any coffee question — dialing in, water, grind, and technique."
      icon={SparkGlyph}
    />
  );
}
