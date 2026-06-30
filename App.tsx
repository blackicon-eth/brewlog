import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { QvacProvider } from "./src/qvac/QvacProvider";

export default function App() {
  return (
    <SafeAreaProvider>
      <QvacProvider>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </QvacProvider>
    </SafeAreaProvider>
  );
}
