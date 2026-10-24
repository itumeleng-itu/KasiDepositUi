import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { session } from '../copy';
import { signOut } from '../storage/session';
import { loadUser } from '../storage/user';
import { colors, radius, size, spacing, type } from '../theme';

/**
 * Sign out, floating in the bottom-right corner of every screen.
 *
 * Carries a label as well as an icon. A lone glyph in a corner is a
 * guess, and this one wipes the phone — an action nobody should take by
 * deduction. Confirmed before it does anything, for the same reason.
 *
 * Hidden until there is someone to sign out. On a first run the phone
 * holds no user, so the button would clear nothing and send a person
 * who is already registering back to registering.
 */
export function SignOutButton() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-checked whenever the screen gains focus, so it appears as soon
  // as registration finishes rather than on the next cold start, and
  // goes again after signing out.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadUser()
        .then((user) => !cancelled && setSignedIn(user !== null))
        .catch(() => !cancelled && setSignedIn(false));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!signedIn) return null;

  function ask() {
    Alert.alert(session.confirmTitle, session.confirmBody, [
      { text: session.cancel, style: 'cancel' },
      {
        text: session.confirm,
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          // signOut never rejects; the launcher sends a phone with no
          // user to registering anyway, so this is where we land.
          void signOut().finally(() => {
            setSignedIn(false);
            router.replace('/register');
          });
        },
      },
    ]);
  }

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        onPress={ask}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={session.signOut}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{session.confirm}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits over the scroll view without catching touches meant for it:
  // box-none lets everything through except the button itself.
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: size.touch,
    paddingHorizontal: spacing.lg + 3,
    borderRadius: radius.device,
    backgroundColor: colors.ink,
  },
  pressed: { opacity: 0.85 },
  label: { ...type.label, color: colors.paper },
});
