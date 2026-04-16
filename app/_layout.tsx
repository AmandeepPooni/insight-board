import { ApolloProvider } from "@apollo/client/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import "react-native-reanimated";

import { AppErrorBoundary } from "@/components/app-error-boundary";
import { BackendProvider } from "@/components/providers/backend-provider";
import { AppTheme, NavigationThemes, PaperThemes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { apolloClient } from "@/lib/services/apollo";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = AppTheme[colorScheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BackendProvider>
        <ApolloProvider client={apolloClient}>
          <PaperProvider theme={PaperThemes[colorScheme]}>
            <BottomSheetModalProvider>
              <ThemeProvider value={NavigationThemes[colorScheme]}>
                <AppErrorBoundary>
                  <Stack
                    screenOptions={{
                      contentStyle: { backgroundColor: colors.background },
                      headerShadowVisible: false,
                    }}
                  >
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                  </Stack>
                </AppErrorBoundary>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
              </ThemeProvider>
            </BottomSheetModalProvider>
          </PaperProvider>
        </ApolloProvider>
      </BackendProvider>
    </GestureHandlerRootView>
  );
}
