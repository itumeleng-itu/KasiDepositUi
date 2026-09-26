import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { motion } from '../theme';

/**
 * A short fade whenever `contentKey` changes: the only animation on the status screen, and it is
 * skipped entirely when the user has asked for reduced motion.
 */
export function FadeIn({ contentKey, children }: { contentKey: string; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.short,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [contentKey, reduceMotion, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
