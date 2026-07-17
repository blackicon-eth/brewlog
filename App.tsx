import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Deep per-weight imports so only the 6 faces we use are bundled (importing from the
// package root would drag in every weight + italic, ~12 MB).
import { EBGaramond_500Medium } from "@expo-google-fonts/eb-garamond/500Medium";
import { EBGaramond_600SemiBold } from "@expo-google-fonts/eb-garamond/600SemiBold";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_500Medium } from "@expo-google-fonts/hanken-grotesk/500Medium";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk/600SemiBold";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { LocaleProvider } from "./src/i18n/LocaleProvider";
import { QvacProvider } from "./src/qvac/QvacProvider";
import { AppModalProvider } from "./src/components/ui";
import { AiOnboardingModal } from "./src/components/AiOnboardingModal";
import { colors } from "./src/design/tokens";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  // Hold on the cream canvas until fonts resolve; on a font error, render anyway so the
  // app still works (text falls back to system faces) rather than getting stuck.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <QvacProvider>
          <AppModalProvider>
            <NavigationContainer>
              <RootNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
            <AiOnboardingModal />
          </AppModalProvider>
        </QvacProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
