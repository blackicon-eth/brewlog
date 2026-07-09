import { emitLedgerReplaced, onLedgerReplaced } from "../ledgerEvents";

describe("ledgerEvents", () => {
  it("notifies every subscriber on emit", () => {
    const a = jest.fn();
    const b = jest.fn();
    const offA = onLedgerReplaced(a);
    const offB = onLedgerReplaced(b);

    emitLedgerReplaced();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    offB();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = jest.fn();
    const off = onLedgerReplaced(listener);

    emitLedgerReplaced();
    off();
    emitLedgerReplaced();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing twice is harmless and doesn't affect others", () => {
    const stays = jest.fn();
    const leaves = jest.fn();
    const offStays = onLedgerReplaced(stays);
    const offLeaves = onLedgerReplaced(leaves);

    offLeaves();
    offLeaves();
    emitLedgerReplaced();

    expect(stays).toHaveBeenCalledTimes(1);
    expect(leaves).not.toHaveBeenCalled();

    offStays();
  });
});
