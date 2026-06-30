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
  doseG: number;
  waterG: number;
  ratio: number;
  grind?: string | null;
  waterTempC?: number | null;
  dripper?: string | null;
  bloomWaterG?: number | null;
  bloomTimeS?: number | null;
  totalTimeS?: number | null;
  agitation?: string | null;
  filterType?: string | null;
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
  id: string; coffee_id: string; brewed_at: number;
  dose_g: number; water_g: number; ratio: number;
  grind: string | null; water_temp_c: number | null; dripper: string | null;
  bloom_water_g: number | null; bloom_time_s: number | null; total_time_s: number | null;
  agitation: string | null; filter_type: string | null; tds: number | null; ey: number | null;
  acidity: number | null; sweetness: number | null; bitterness: number | null;
  body: number | null; clarity: number | null; rating: number | null;
  notes: string | null; created_at: number;
};
