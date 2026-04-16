import { useScrollToTop } from "@react-navigation/native";
import { PropsWithChildren, useRef } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    RefreshControl,
    ScrollView,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { Edge, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function AppScreen({
  children,
  contentContainerStyle,
  edges = ["top"],
  onScroll,
  refreshing,
  onRefresh,
}: AppScreenProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const topInset = edges.includes("top") ? insets.top : 0;
  const bottomInset = edges.includes("bottom") ? insets.bottom : 0;
  const leftInset = edges.includes("left") ? insets.left : 0;
  const rightInset = edges.includes("right") ? insets.right : 0;

  useScrollToTop(scrollViewRef);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: 20 + topInset,
            paddingBottom: 36 + bottomInset,
            paddingLeft: 16 + leftInset,
            paddingRight: 16 + rightInset,
          },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? 16 : undefined}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    gap: 16,
  },
});
