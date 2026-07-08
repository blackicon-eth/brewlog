import type { ToolId } from "../screens/tools/types";

export type RootStackParamList = {
  Main: undefined;
  Tool: { toolId: ToolId };
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
