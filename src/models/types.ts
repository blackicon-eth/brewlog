import type { BrewMethodId, MokaHeat } from "../lib/brewMethods";

// Camel-case domain models used throughout the app.
export type Coffee = {
  id: string;
  roaster: string;
  name: string;
  origin?: string | null;
  process?: string | null;
  roastLevel?: string | null;
  roastDate?: string | null; // ISO date "YYYY-MM-DD"
  notes?: string | null;
  createdAt: number;
};

export type Brew = {
  id: string;
  coffeeId: string;
  brewedAt: number;
  method: BrewMethodId;
  doseG: number;
  waterG: number;
  ratio: number;
  grind?: string | null;
  waterTempC?: number | null;
  dripper?: string | null;
  pours?: number | null;
  pourIntervalS?: number | null;
  totalTimeS?: number | null;
  filterType?: string | null;
  preheat?: boolean | null;
  heat?: MokaHeat | null;
  tds?: number | null;
  ey?: number | null;
  acidity?: number | null;
  sweetness?: number | null;
  bitterness?: number | null;
  body?: number | null;
  clarity?: number | null;
  rating?: number | null;
  notes?: string | null;
  createdAt: number;
};

export type NewCoffee = Omit<Coffee, "id" | "createdAt">;
export type NewBrew = Omit<Brew, "id" | "ratio" | "createdAt">;

// Snake-case shapes as returned from SQLite.
export type CoffeeRow = {
  id: string; roaster: string; name: string;
  origin: string | null; process: string | null; roast_level: string | null;
  roast_date: string | null; notes: string | null; created_at: number;
};
export type BrewRow = {
  id: string; coffee_id: string; brewed_at: number; method: string;
  dose_g: number; water_g: number; ratio: number;
  grind: string | null; water_temp_c: number | null; dripper: string | null;
  pours: number | null; pour_interval_s: number | null; total_time_s: number | null;
  filter_type: string | null; preheat: number | null; heat: string | null;
  tds: number | null; ey: number | null;
  acidity: number | null; sweetness: number | null; bitterness: number | null;
  body: number | null; clarity: number | null; rating: number | null;
  notes: string | null; created_at: number;
};
