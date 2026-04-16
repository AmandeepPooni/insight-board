import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}>;

export function SurfaceCard({
  children,
  style,
  elevated = false,
}: SurfaceCardProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    overflow: "hidden",
    padding: 20,
  },
  elevated: {
    elevation: 3,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
});
