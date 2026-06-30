import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { theme } from "../theme";
import { CoffeesScreen } from "../screens/CoffeesScreen";
import { CoffeeFormScreen } from "../screens/CoffeeFormScreen";
import { CoffeeDetailScreen } from "../screens/CoffeeDetailScreen";
import { BrewFormScreen } from "../screens/BrewFormScreen";
import { AdvisorResultScreen } from "../screens/AdvisorResultScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="Coffees" component={CoffeesScreen} options={{ title: "Brewlog" }} />
      <Stack.Screen name="CoffeeForm" component={CoffeeFormScreen} options={{ title: "Coffee" }} />
      <Stack.Screen name="CoffeeDetail" component={CoffeeDetailScreen} options={{ title: "Coffee" }} />
      <Stack.Screen name="BrewForm" component={BrewFormScreen} options={{ title: "Brew" }} />
      <Stack.Screen name="AdvisorResult" component={AdvisorResultScreen} options={{ title: "Advisor", presentation: "modal" }} />
    </Stack.Navigator>
  );
}
