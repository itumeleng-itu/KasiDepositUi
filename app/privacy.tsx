import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { common, privacy } from '../src/copy';
import { INFORMATION_OFFICER_CONTACT, PRIVACY_NOTICE_VERSION } from '../src/privacy';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * "Your privacy": the POPIA notice, in plain words. Reachable before registering (from the
 * consent box) and at any time after (from the PIN screen). Every heading is a header for
 * screen readers, so the page can be skimmed by heading.
 */
export default function PrivacyScreen() {
  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {privacy.title}
        </Text>
        <Text style={styles.body}>{privacy.intro}</Text>
      </View>

      {privacy.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {section.heading}
          </Text>
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

      <View style={[styles.section, styles.contact]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {privacy.contactHeading}
        </Text>
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
  section: { gap: spacing.sm },
  sectionTitle: { ...type.title, color: colors.ink },
  point: { flexDirection: 'row', gap: spacing.sm },
  bullet: { ...type.body, color: colors.inkMuted },
  pointText: { ...type.body, flex: 1, color: colors.ink },
  contact: { padding: spacing.lg, borderRadius: radius.control, backgroundColor: colors.surface },
  version: { ...type.caption, color: colors.inkMuted },
});
