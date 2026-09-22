import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { common, failure } from '../src/copy';
import { colors, type } from '../src/theme';

/**
 * If a screen ever throws while rendering, the user gets a plain message and a way to try again
 * instead of a blank or crashed app. Nothing about the error (which could hold account details)
 * is shown.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {failure.unknown.message}
      </Text>
      <Button
        label={common.tryAgain}
        onPress={() => {
          retry().catch(() => {});
        }}
      />
    </Screen>
  );
}

export default function RootLayout() {
  // Every text style in theme.ts names one of these families directly, so nothing must render
  // with the system-font fallback: we show the plain background (the launcher does the same
  // while it reads storage) until Inter is ready, which on a warm cache is near-instant.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return <View style={styles.blank} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
  title: { ...type.headline, color: colors.ink },
});
