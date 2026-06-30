export type RootStackParamList = {
  Coffees: undefined;
  CoffeeForm: { coffeeId?: string };
  CoffeeDetail: { coffeeId: string };
  BrewForm: { coffeeId: string; brewId?: string };
  AdvisorResult: {
    title: string;
    kind: "diagnose" | "bestRecipe";
    coffeeId: string;
    brewId?: string;
  };
};
