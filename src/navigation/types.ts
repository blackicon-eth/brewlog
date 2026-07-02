export type RootStackParamList = {
  Main: undefined;
  CoffeeForm: { coffeeId?: string };
  CoffeeDetail: { coffeeId: string };
  BrewDetail: { coffeeId: string; brewId: string };
  BrewForm: { coffeeId: string; brewId?: string };
  AdvisorResult: {
    title: string;
    kind: "diagnose" | "bestRecipe";
    coffeeId: string;
    brewId?: string;
  };
};
