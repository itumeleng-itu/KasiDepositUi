import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, size as sizes } from '../theme';

export type IconName = 'check' | 'cross' | 'alert';

interface IconProps {
  name: IconName;
  color?: string;
  size?: number;
}

// Icons are drawn from plain Views so no icon font or library is needed. They are decorative:
// the text next to them carries the meaning, so screen readers skip them.
const CHECK_WIDTH = 0.32;
const CHECK_HEIGHT = 0.6;
const CHECK_LIFT = 0.08;
const CROSS_LENGTH = 0.8;

export function Icon({ name, color = colors.ink, size = sizes.icon }: IconProps) {
  const stroke = borderWidth.thick;

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'check' && (
        <View
          style={{
            width: size * CHECK_WIDTH,
            height: size * CHECK_HEIGHT,
            borderColor: color,
            borderRightWidth: stroke,
            borderBottomWidth: stroke,
            marginTop: -size * CHECK_LIFT,
            transform: [{ rotate: '45deg' }],
          }}
        />
      )}
      {name === 'cross' && (
        <>
          <View
            style={[
              styles.bar,
              { width: size * CROSS_LENGTH, height: stroke, backgroundColor: color },
              { transform: [{ rotate: '45deg' }] },
            ]}
          />
          <View
            style={[
              styles.bar,
              { width: size * CROSS_LENGTH, height: stroke, backgroundColor: color },
              { transform: [{ rotate: '-45deg' }] },
            ]}
          />
        </>
      )}
      {name === 'alert' && (
        <View
          style={[
            styles.box,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: stroke,
              borderColor: color,
            },
          ]}
        >
          <Text style={[styles.exclaim, { color, fontSize: size * 0.6, lineHeight: size * 0.8 }]}>
            !
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute' },
  exclaim: { fontWeight: '700', textAlign: 'center', includeFontPadding: false },
});
