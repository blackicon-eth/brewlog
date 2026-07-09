import type { Db } from "./types";
import type { LedgerPayload } from "../lib/ledgerFile";
import { createCoffee } from "./coffees";
import { createBrew } from "./brews";

// Replaces the entire ledger with the payload inside one transaction: a failure at
// any point rolls back to the pre-import state, so a poisoned file can't leave the
// user with half a ledger.
export async function replaceLedger(db: Db, payload: LedgerPayload): Promise<void> {
  await db.execAsync("BEGIN");
  try {
    await db.execAsync("DELETE FROM brews; DELETE FROM coffees;");
    for (const c of payload.coffees) await createCoffee(db, c);
    for (const b of payload.brews) await createBrew(db, b);
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
