import type { Db } from "./types";
import type { Brew, Coffee } from "../models/types";
import { createCoffee } from "./coffees";
import { createBrew } from "./brews";
import { makeId } from "../lib/ids";
import { computeRatio } from "../lib/ratio";

// Dev-only sample data — believable coffees + brews for exercising the lists/scrolling.
// Not shipped: only invoked behind __DEV__ from the Coffees screen dev controls.

const ROASTERS = [
  "Sey Coffee", "Tim Wendelboe", "Onyx Coffee Lab", "La Cabra", "Coffee Collective",
  "Heart Roasters", "Passenger", "Manhattan Coffee", "Dak Coffee", "Prolog", "April", "Friedhats",
];

const SPECS = [
  { origin: "Kenya", name: "Nyeri AA", process: "washed", notes: "blackcurrant, tomato, grapefruit" },
  { origin: "Ethiopia", name: "Guji Uraga", process: "natural", notes: "blueberry, jasmine, cocoa" },
  { origin: "Colombia", name: "Huila El Paraíso", process: "washed", notes: "red apple, caramel, orange" },
  { origin: "Ethiopia", name: "Yirgacheffe Konga", process: "washed", notes: "peach, bergamot, floral" },
  { origin: "Guatemala", name: "Huehuetenango", process: "washed", notes: "milk chocolate, plum, almond" },
  { origin: "Costa Rica", name: "Tarrazú Las Lajas", process: "honey", notes: "brown sugar, cherry, hazelnut" },
  { origin: "Rwanda", name: "Nyamasheke", process: "washed", notes: "black tea, red grape, lime" },
  { origin: "Panama", name: "Geisha Esmeralda", process: "washed", notes: "jasmine, mango, bergamot" },
  { origin: "Brazil", name: "Cerrado Yellow Bourbon", process: "natural", notes: "peanut, chocolate, dried fig" },
  { origin: "Burundi", name: "Kayanza Gaharo", process: "washed", notes: "grapefruit, honey, floral" },
  { origin: "El Salvador", name: "Santa Ana Pacamara", process: "natural", notes: "strawberry, cane sugar, cocoa" },
  { origin: "Kenya", name: "Kirinyaga PB", process: "washed", notes: "blackberry, cranberry, cane sugar" },
];

const ROASTS = ["light", "light-medium", "medium"];
const GRINDS = ["medium-fine", "18 clicks (Comandante)", "medium", "6.5 (Ode Gen 2)", "medium-coarse", "22 clicks (1Zpresso)"];
const BREW_NOTES = [
  "bright and juicy", "syrupy body, muted acidity", "clean, floral finish", "well balanced, sweet",
  "a touch under-extracted", "big fruit, tea-like", "chocolatey and round", "crisp acidity, light body", "",
];

const DAY = 86_400_000;
const HOUR = 3_600_000;
const rint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export async function seedSampleData(db: Db, coffeeCount = 12): Promise<void> {
  const now = Date.now();

  for (let i = 0; i < coffeeCount; i++) {
    const spec = SPECS[i % SPECS.length];
    const brewCount = rint(2, 8);
    // Added far enough back that its brews still land in the past.
    const createdAt = now - rint(brewCount + 6, 150) * DAY;
    const roastDate = new Date(createdAt - rint(3, 18) * DAY).toISOString().slice(0, 10);

    const coffee: Coffee = {
      id: makeId(),
      roaster: pick(ROASTERS),
      name: spec.name,
      origin: spec.origin,
      process: spec.process,
      roastLevel: pick(ROASTS),
      roastDate,
      notes: spec.notes,
      createdAt,
    };
    await createCoffee(db, coffee);

    for (let j = 0; j < brewCount; j++) {
      const doseG = pick([14, 15, 15, 16, 18, 20, 22]);
      const ratioTarget = pick([15, 15.5, 16, 16.7, 17]);
      const waterG = Math.round(doseG * ratioTarget);
      const brewedAt = createdAt + j * rint(1, 4) * DAY + rint(0, 10) * HOUR;

      const brew: Brew = {
        id: makeId(),
        coffeeId: coffee.id,
        brewedAt,
        doseG,
        waterG,
        ratio: computeRatio(doseG, waterG),
        grind: pick(GRINDS),
        waterTempC: pick([90, 92, 93, 94, 95, 96]),
        dripper: "V60",
        pours: rint(1, 5),
        pourIntervalS: pick([30, 35, 40, 45]),
        totalTimeS: rint(140, 210),
        filterType: pick(["white", "unbleached"]),
        tds: null,
        ey: null,
        acidity: rint(2, 5),
        sweetness: rint(2, 5),
        bitterness: rint(1, 4),
        body: rint(2, 5),
        clarity: rint(2, 5),
        rating: rint(2, 5),
        notes: pick(BREW_NOTES) || null,
        createdAt: brewedAt,
      };
      await createBrew(db, brew);
    }
  }
}

export async function clearAllData(db: Db): Promise<void> {
  await db.runAsync("DELETE FROM brews");
  await db.runAsync("DELETE FROM coffees");
}
