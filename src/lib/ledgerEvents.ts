// Fired after an import replaces the whole ledger. The five tabs stay mounted behind
// the hand-rolled tab bar (MainTabs), so react-navigation focus never fires on a tab
// switch — long-lived list screens subscribe here to refetch the moment the data under
// them is swapped out.
type Listener = () => void;

const listeners = new Set<Listener>();

// Returns the unsubscribe function — call it on unmount.
export function onLedgerReplaced(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLedgerReplaced(): void {
  for (const listener of [...listeners]) listener();
}
