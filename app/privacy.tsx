import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { common, privacy, session } from '../src/copy';
import { INFORMATION_OFFICER_CONTACT, PRIVACY_NOTICE_VERSION } from '../src/privacy';
import { signOut } from '../src/storage/session';
import { borderWidth, colors, radius, size, spacing, type } from '../src/theme';

/**
 * "Your privacy": the POPIA notice, in plain words, and the one thing on
 * this screen a person can actually do — sign this phone out.
 *
 * Ordered by what someone came for rather than by legal convention. The
 * notice runs to six sections, so an action below it is an action nobody
 * finds; "This phone" therefore sits directly under the intro, and the
 * notice follows as the reference material it is.
 *
 * Reachable before registering (from the consent box) and at any time
 * after (from the deposit screen). Every heading is a header for screen
 * readers, so the page can still be skimmed by heading.
 */
export default function PrivacyScreen() {
  const [signingOut, setSigningOut] = useState(false);

  // Confirmed first: signing out is not destructive to the account, but
  // it does mean typing an ID number again, and a mis-tap on a screen
  // someone opened to read about privacy would be a nasty surprise.
  function askToSignOut() {
    Alert.alert(session.confirmTitle, session.confirmBody, [
      { text: session.cancel, style: 'cancel' },
      {
        text: session.confirm,
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          // Always land on registering, even if a key refused to clear:
          // signOut swallows its own failures, and the launcher sends a
          // phone with no user here anyway.
          void signOut().finally(() => router.replace('/register'));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {privacy.title}
        </Text>
        <Text style={styles.body}>{privacy.intro}</Text>
      </View>

      {/* The only thing here that does something, so it comes before the
          notice rather than after it. Outlined rather than filled, so it
          reads as an action and not as one more block of text. */}
      <View style={[styles.card, styles.action]}>
        <View style={styles.cardHeading}>
          <Icon name="shield" color={colors.accent} size={size.iconSmall} />
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {session.heading}
          </Text>
        </View>
        <Text style={styles.body}>{session.body}</Text>
        <Button
          variant="secondary"
          label={session.signOut}
          disabled={signingOut}
          onPress={askToSignOut}
        />
      </View>

      {privacy.sections.map((section, index) => (
        <View key={section.heading} style={styles.card}>
          <View style={styles.cardHeading}>
            {/* Numbered so a long notice has a sense of place: a reader
                can tell how many there are and where they have got to. */}
            <Text style={styles.number} accessibilityElementsHidden importantForAccessibility="no">
              {index + 1}
            </Text>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {section.heading}
            </Text>
          </View>
          {section.points.map((point) => (
            <View key={point} style={styles.point}>
              <Text style={styles.bullet} accessibilityElementsHidden importantForAccessibility="no">
                •
              </Text>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Icon name="info" color={colors.accent} size={size.iconSmall} />
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {privacy.contactHeading}
          </Text>
        </View>
        <Text selectable style={styles.body}>
          {INFORMATION_OFFICER_CONTACT
            ? privacy.contact(INFORMATION_OFFICER_CONTACT)
            : privacy.contactPending}
        </Text>
        <Text style={styles.body}>{privacy.regulator}</Text>
      </View>

      <Text style={styles.version}>{privacy.version(PRIVACY_NOTICE_VERSION)}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.ink },
  // One card per section. The notice was a single column of bullets,
  // which gives a reader nothing to navigate by and no sense of length.
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  action: {
    backgroundColor: colors.paper,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.title, flex: 1, color: colors.ink },
  number: { ...type.label, width: size.iconSmall, textAlign: 'center', color: colors.accent },
  point: { flexDirection: 'row', gap: spacing.sm },
  bullet: { ...type.body, color: colors.inkMuted },
  pointText: { ...type.body, flex: 1, color: colors.ink },
  version: { ...type.caption, color: colors.inkMuted },
});
