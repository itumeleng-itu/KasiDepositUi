import type { ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, size, spacing } from '../theme';

interface ScreenProps {
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
}

/**
 * Every screen sits in this: safe areas (notches, gesture bars), a scroll view so nothing is
 * clipped at large font sizes or on small screens, and keyboard avoidance so a focused field
 * is never behind the keyboard. Content is one centred column with a 16 dp gutter.
 */
export function Screen({ children, scrollRef }: ScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl },
  column: { width: '100%', maxWidth: size.contentMax, alignSelf: 'center', gap: spacing.lg },
});
