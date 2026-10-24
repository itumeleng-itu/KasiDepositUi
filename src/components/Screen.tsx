import { usePathname } from 'expo-router';
import type { ComponentRef, ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, size, spacing } from '../theme';
import { SignOutButton } from './SignOutButton';

/** The privacy notice has its own sign-out, in context and explained. */
const NO_FLOATING_SIGN_OUT = ['/privacy'];

interface ScreenProps {
  children: ReactNode;
  // See TextField: the instance type, not the component type.
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}

/**
 * Every screen sits in this: safe areas (notches, gesture bars), a scroll view so nothing is
 * clipped at large font sizes or on small screens, and keyboard avoidance so a focused field
 * is never behind the keyboard. Content is one centred column with a 16 dp gutter.
 */
export function Screen({ children, scrollRef }: ScreenProps) {
  const pathname = usePathname();

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

      {/* Outside the ScrollView, so it stays put instead of scrolling
          away with the content. */}
      {NO_FLOATING_SIGN_OUT.includes(pathname) ? null : <SignOutButton />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  // Extra bottom padding so the floating button never covers the last
  // control on a screen that scrolls to its end.
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxxl + size.touch },
  column: { width: '100%', maxWidth: size.contentMax, alignSelf: 'center', gap: spacing.lg },
});
