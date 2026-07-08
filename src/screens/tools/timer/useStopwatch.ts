import { useCallback, useEffect, useRef, useState } from "react";

export type StopwatchStatus = "idle" | "running" | "paused";

export type Stopwatch = {
  status: StopwatchStatus;
  // Whole elapsed seconds (floored) — what the schedule crosses and what we display.
  elapsedS: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
};

// A drift-free stopwatch. Elapsed time is derived from a captured wall-clock anchor
// (`Date.now()` at start, plus any time banked across pauses), NOT by counting ticks —
// so it stays accurate even if the JS timer is throttled while the app is backgrounded, and
// resyncs to real time the moment we get a tick again. The interval only decides *how often*
// we re-read the clock (10×/s for a punctual seconds flip); it never *is* the clock.
export function useStopwatch(): Stopwatch {
  const [status, setStatus] = useState<StopwatchStatus>("idle");
  const [elapsedS, setElapsedS] = useState(0);

  // Wall-clock ms at which the current run segment began.
  const anchorRef = useRef<number | null>(null);
  // Elapsed ms banked from previous run segments (before the last pause).
  const bankedMsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const readClock = useCallback(() => {
    const runningMs = anchorRef.current != null ? Date.now() - anchorRef.current : 0;
    setElapsedS(Math.floor((bankedMsRef.current + runningMs) / 1000));
  }, []);

  const startTicking = useCallback(() => {
    clearTick();
    readClock();
    // 100 ms polling caps how late a second flip can appear (ticks queue behind JS-thread
    // work like the phase-change fades). setElapsedS bails out unless the floored second
    // actually changed, so the extra ticks cost no re-renders.
    intervalRef.current = setInterval(readClock, 100);
  }, [clearTick, readClock]);

  const start = useCallback(() => {
    bankedMsRef.current = 0;
    anchorRef.current = Date.now();
    setElapsedS(0);
    setStatus("running");
    startTicking();
  }, [startTicking]);

  const pause = useCallback(() => {
    if (anchorRef.current != null) {
      bankedMsRef.current += Date.now() - anchorRef.current;
      anchorRef.current = null;
    }
    clearTick();
    readClock();
    setStatus("paused");
  }, [clearTick, readClock]);

  const resume = useCallback(() => {
    anchorRef.current = Date.now();
    setStatus("running");
    startTicking();
  }, [startTicking]);

  const reset = useCallback(() => {
    clearTick();
    anchorRef.current = null;
    bankedMsRef.current = 0;
    setElapsedS(0);
    setStatus("idle");
  }, [clearTick]);

  // Never leak an interval across unmount.
  useEffect(() => clearTick, [clearTick]);

  return { status, elapsedS, start, pause, resume, reset };
}
