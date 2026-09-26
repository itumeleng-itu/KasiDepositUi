import { StyleSheet, Text, View } from 'react-native';

import { status } from '../copy';
import type { StepState } from '../polling';
import { borderWidth, colors, fontFamily, size, spacing, type } from '../theme';
import { Icon } from './Icon';

const LABELS = [status.steps.checked, status.steps.sent] as const;

const STATE_TEXT: Record<StepState, string> = {
  done: status.stepDone,
  current: status.stepCurrent,
  todo: status.stepTodo,
};

/**
 * Checked, then sent. A real sequence, so a stepper fits. State is never colour alone:
 * done is a tick, the current step is a heavy ring with its number, and every step has its
 * name and a screen-reader state.
 */
export function StepIndicator({ steps }: { steps: readonly [StepState, StepState] }) {
  return (
    <View style={styles.row}>
      {steps.map((state, index) => (
        <View
          key={LABELS[index]}
          style={styles.step}
          accessible
          accessibilityLabel={`${LABELS[index]}, ${STATE_TEXT[state]}`}
        >
          <View style={styles.track}>
            <View style={[styles.line, index > 0 && lineStyle(steps[index - 1])]} />
            <View style={[styles.circle, circleStyle(state)]}>
              {state === 'done' ? (
                <Icon name="check" color={colors.onPrimary} size={size.iconSmall} />
              ) : (
                <Text style={[styles.number, state === 'current' && styles.numberCurrent]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <View style={[styles.line, index < steps.length - 1 && lineStyle(state)]} />
          </View>
          <Text style={[styles.label, state === 'todo' && styles.labelTodo]}>{LABELS[index]}</Text>
        </View>
      ))}
    </View>
  );
}

// A connector is "complete" when the step before it is done.
function lineStyle(from: StepState) {
  return from === 'done' ? styles.lineDone : styles.lineTodo;
}

function circleStyle(state: StepState) {
  if (state === 'done') return styles.circleDone;
  if (state === 'current') return styles.circleCurrent;
  return styles.circleTodo;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: spacing.sm },
  track: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: borderWidth.thick },
  lineDone: { backgroundColor: colors.primary },
  lineTodo: { backgroundColor: colors.line },
  circle: {
    width: size.stepIcon,
    height: size.stepIcon,
    borderRadius: size.stepIcon / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.primary },
  circleCurrent: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick * 2,
    borderColor: colors.primary,
  },
  circleTodo: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.line,
  },
  number: { ...type.label, color: colors.inkMuted },
  numberCurrent: { color: colors.primary, fontFamily: fontFamily.bold },
  label: { ...type.label, color: colors.ink, textAlign: 'center' },
  labelTodo: { color: colors.inkMuted, fontFamily: fontFamily.regular },
});
