import { useCallback } from "react";
import { useQvac } from "../qvac/QvacProvider";
import { resolveModel } from "../lib/aiModels";
import { useAppModal } from "../components/ui";

// Wraps an AI-powered action (diagnose, best recipe): runs it straight away when the
// assistant is on; otherwise asks first — naming the model and its download size so the
// user knows what saying yes costs — flips the setting, warms the model and then runs
// it. The destination screen already renders download progress, so the tap lands
// somewhere alive either way.
export function useAdvisorGate() {
  const { aiEnabled, setAiEnabled, prepare, modelId } = useQvac();
  const modal = useAppModal();

  return useCallback(
    async (go: () => void) => {
      if (aiEnabled) {
        go();
        return;
      }
      const model = resolveModel(modelId);
      const yes = await modal.confirm({
        title: "Turn on the assistant?",
        message: `This needs the on-device AI. ${model.name} (${model.size}) downloads once and runs privately on your phone.`,
        confirmLabel: "Turn it on",
      });
      if (!yes) return;
      setAiEnabled(true);
      prepare();
      go();
    },
    [aiEnabled, setAiEnabled, prepare, modelId, modal],
  );
}
