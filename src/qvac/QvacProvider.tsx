import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ensureModel, releaseModel, streamAdvice, onAppBackground, onAppForeground, shutdown,
  type LoadStatus, type StreamHandlers,
} from "./service";
import { usePersistedState } from "../hooks/usePersistedState";
import { DEFAULT_MODEL_ID, resolveModel } from "../lib/aiModels";
import type { ChatMessage } from "./advisor";

type QvacContextValue = {
  status: LoadStatus;
  progress: number;
  error: string | null;
  aiEnabled: boolean;
  modelId: string;
  onboarded: boolean;
  setAiEnabled: (v: boolean) => void;
  setModel: (id: string) => void;
  completeOnboarding: () => void;
  prepare: () => void;
  retry: () => void;
  runAdvice: (h: ChatMessage[], handlers: StreamHandlers) => { done: Promise<{ stopReason?: string }>; cancel: () => void };
};

const QvacContext = createContext<QvacContextValue | null>(null);

export function QvacProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // The AI settings live here — the single owner. Settings/Chat/gates all read and write
  // through this context. Enabled defaults to FALSE: the coach is opt-in (onboarding
  // sheet or the Settings switch).
  const [aiEnabled, setAiEnabledState] = usePersistedState("settings:ai:enabled", false);
  const [modelIdRaw, setModelIdState] = usePersistedState("settings:ai:model", DEFAULT_MODEL_ID);
  const [onboarded, setOnboarded] = usePersistedState("settings:ai:onboarded", false);
  const modelId = resolveModel(modelIdRaw).id;

  // Mirrors written synchronously in the setters (NOT via useEffect): callers flip a
  // setting and call prepare() in the same tick, so prepare must see the new value
  // before React re-renders. This also keeps prepare referentially stable — screens
  // hang mount effects off it.
  const aiEnabledRef = useRef(aiEnabled);
  const modelIdRef = useRef(modelId);

  const prepare = useCallback(() => {
    if (!aiEnabledRef.current) return;      // AI off: never download or load anything
    if (started.current) return;            // already loading or loaded
    started.current = true;
    setError(null);
    ensureModel(modelIdRef.current, (pct, s) => { setProgress(pct); setStatus(s); }).catch((e) => {
      setError(e?.message ?? String(e));
      setStatus("error");
      // Intentionally leave started.current = true: do NOT auto-retry on
      // status-driven re-renders. Retry is user-initiated via retry().
    });
  }, []);

  const retry = useCallback(() => {
    started.current = false;
    prepare();
  }, [prepare]);

  const resetToIdle = useCallback(() => {
    started.current = false;
    setStatus("idle");
    setProgress(0);
    setError(null);
  }, []);

  const setAiEnabled = useCallback((v: boolean) => {
    aiEnabledRef.current = v;
    setAiEnabledState(v);
    if (!v) {
      resetToIdle();
      // Free the RAM but keep the download — flipping the coach back on costs nothing.
      void releaseModel({ deleteFile: false });
    }
  }, [setAiEnabledState, resetToIdle]);

  const setModel = useCallback((id: string) => {
    if (id === modelIdRef.current) return;
    modelIdRef.current = id;
    setModelIdState(id);
    resetToIdle();
    // The switched-away model goes entirely — file included (best effort; see service).
    // The new one downloads lazily when the coach next starts.
    void releaseModel({ deleteFile: true });
  }, [setModelIdState, resetToIdle]);

  const completeOnboarding = useCallback(() => setOnboarded(true), [setOnboarded]);

  const runAdvice = useCallback((h: ChatMessage[], handlers: StreamHandlers) => {
    return streamAdvice(h, handlers);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") void onAppBackground();
      else if (next === "active") void onAppForeground();
    });
    return () => { sub.remove(); void shutdown(); };
  }, []);

  return (
    <QvacContext.Provider
      value={{
        status, progress, error,
        aiEnabled, modelId, onboarded,
        setAiEnabled, setModel, completeOnboarding,
        prepare, retry, runAdvice,
      }}
    >
      {children}
    </QvacContext.Provider>
  );
}

export function useQvac(): QvacContextValue {
  const ctx = useContext(QvacContext);
  if (!ctx) throw new Error("useQvac must be used within QvacProvider");
  return ctx;
}
