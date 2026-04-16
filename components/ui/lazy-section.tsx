import { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    View,
    type LayoutChangeEvent,
    type ViewProps,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";

type LazySectionProps = ViewProps & {
  /** Vertical offset threshold at which the section should be rendered */
  viewportHeight: number;
  /** Current scroll position from the parent ScrollView */
  scrollY: number;
};

/**
 * Lazy-loading wrapper for analytics chart sections.
 * Only renders children once the section is scrolled near the viewport,
 * avoiding unnecessary GraphQL queries and chart renders below the fold.
 * Includes a slide-up + fade-in animation on first appearance.
 */
export function LazySection({
  children,
  viewportHeight,
  scrollY,
  style,
  ...props
}: LazySectionProps) {
  const [layoutY, setLayoutY] = useState<number | null>(null);
  const [hasAppeared, setHasAppeared] = useState(false);
  // Animated value for entrance animation (fade + slide up)
  const animProgress = useRef(new Animated.Value(0)).current;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    setLayoutY(y);
  }, []);

  // Once the section top is within 1.5x the viewport height, mark as appeared
  if (!hasAppeared && layoutY !== null) {
    const threshold = viewportHeight * 1.5;
    if (scrollY + threshold >= layoutY) {
      setHasAppeared(true);
    }
  }

  // Animate entrance when section first appears
  useEffect(() => {
    if (hasAppeared) {
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [hasAppeared, animProgress]);

  return (
    <View onLayout={handleLayout} style={style} {...props}>
      {hasAppeared ? (
        <Animated.View
          style={{
            opacity: animProgress,
            transform: [
              {
                translateY: animProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
        >
          {children}
        </Animated.View>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <ActivityIndicator animating size="small" />
        </View>
      )}
    </View>
  );
}
