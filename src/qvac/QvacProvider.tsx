import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  ensureModel, streamAdvice, onAppBackground, onAppForeground, shutdown,
  type LoadStatus, type StreamHandlers,
} from "./service";
import type { ChatMessage } from "./advisor";

type QvacContextValue = {
  status: LoadStatus;
  progress: number;
  error: string | null;
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

  const prepare = useCallback(() => {
    if (started.current) return;            // already loading or loaded
    started.current = true;
    setError(null);
    ensureModel((pct, s) => { setProgress(pct); setStatus(s); }).catch((e) => {
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
    <QvacContext.Provider value={{ status, progress, error, prepare, retry, runAdvice }}>
      {children}
    </QvacContext.Provider>
  );
}

export function useQvac(): QvacContextValue {
  const ctx = useContext(QvacContext);
  if (!ctx) throw new Error("useQvac must be used within QvacProvider");
  return ctx;
}
