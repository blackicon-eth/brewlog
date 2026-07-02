import React from "react";
import { ComingSoon, GearIcon } from "../components/ui";

// Placeholder for app settings (preferences, data export, about). Built out later.
export function SettingsScreen() {
  return (
    <ComingSoon
      section="Settings"
      title="Make it yours"
      blurb="Preferences, units, data export, and the model behind your advisor — all coming here."
      icon={GearIcon}
    />
  );
}
