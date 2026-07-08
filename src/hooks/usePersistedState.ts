import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Storage from "expo-sqlite/kv-store";

// Drop-in useState replacement for small preferences and dial-in values, so screens reopen
// exactly as the user left them — across navigation and full app restarts. Hydrates
// synchronously from the SQLite-backed key-value store (no flash of defaults on first
// render) and writes back debounced, so hold-to-repeat steppers don't hit the disk ~28
// times a second. Namespace keys by owner: "tool:timer:bloomG", "settings:ai:enabled".
const WRITE_DEBOUNCE_MS = 300;

export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = key;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = Storage.getItemSync(storageKey);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      // Corrupt or unreadable entry — fall back to the default.
    }
    return initial;
  });

  const latest = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setValue((prev) => {
        const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
        latest.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          Storage.setItem(storageKey, JSON.stringify(latest.current)).catch(() => {
            // A failed write only costs persistence of this change; never break the tool.
          });
        }, WRITE_DEBOUNCE_MS);
        return next;
      });
    },
    [storageKey]
  );

  // Flush a pending write on unmount so leaving the page never loses the last change.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        try {
          Storage.setItemSync(storageKey, JSON.stringify(latest.current));
        } catch {
          // Same contract as above: losing one write is acceptable, crashing is not.
        }
      }
    },
    [storageKey]
  );

  return [value, set];
}
