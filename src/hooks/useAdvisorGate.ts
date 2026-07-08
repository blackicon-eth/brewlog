import { useCallback } from "react";
import { useQvac } from "../qvac/QvacProvider";
import { useAppModal } from "../components/ui";

// Wraps an AI-powered action (diagnose, best recipe): runs it straight away when the
// coach is on; otherwise asks first, flips the setting, warms the model and then runs
// it — the destination screen already renders download progress, so the tap lands
// somewhere alive either way.
export function useAdvisorGate() {
  const { aiEnabled, setAiEnabled, prepare } = useQvac();
  const modal = useAppModal();

  return useCallback(
    async (go: () => void) => {
      if (aiEnabled) {
        go();
        return;
      }
      const yes = await modal.confirm({
        title: "Turn on the coach?",
        message: "This needs the on-device AI. It runs privately on your phone; the model downloads once.",
        confirmLabel: "Turn it on",
      });
      if (!yes) return;
      setAiEnabled(true);
      prepare();
      go();
    },
    [aiEnabled, setAiEnabled, prepare, modal],
  );
}
