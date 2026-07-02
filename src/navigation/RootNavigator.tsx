import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { theme } from "../theme";
import { MainTabs } from "../screens/MainTabs";
import { CoffeeFormScreen } from "../screens/CoffeeFormScreen";
import { CoffeeDetailScreen } from "../screens/CoffeeDetailScreen";
import { BrewDetailScreen } from "../screens/BrewDetailScreen";
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
      <Stack.Screen name="Main" component={MainTabs} options={{ title: "Brewlog", headerShown: false }} />
      <Stack.Screen name="CoffeeForm" component={CoffeeFormScreen} options={{ title: "Coffee", headerShown: false }} />
      <Stack.Screen name="CoffeeDetail" component={CoffeeDetailScreen} options={{ title: "Coffee", headerShown: false }} />
      <Stack.Screen name="BrewDetail" component={BrewDetailScreen} options={{ title: "Brew", headerShown: false }} />
      <Stack.Screen name="BrewForm" component={BrewFormScreen} options={{ title: "Brew", headerShown: false }} />
      <Stack.Screen
        name="AdvisorResult"
        component={AdvisorResultScreen}
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack.Navigator>
  );
}
