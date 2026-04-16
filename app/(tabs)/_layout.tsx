import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

import { InsightBoardProvider } from "@/components/providers/insight-board-provider";

type AnimatedTabButtonProps = {
  accessibilityLabel?: string;
  focused: boolean;
  label: string;
  onLongPress: () => void;
  onPress: () => void;
  renderIcon: (color: string) => React.ReactNode;
  testID?: string;
};

function AnimatedTabButton({
  accessibilityLabel,
  focused,
  label,
  onLongPress,
  onPress,
  renderIcon,
  testID,
}: AnimatedTabButtonProps) {
  const theme = useTheme();
  const activeProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(activeProgress, {
      toValue: focused ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeProgress, focused]);

  const handlePressIn = () => {
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Animated.spring(pressScale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 28,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 26,
      bounciness: 8,
    }).start();
  };

  const tintColor = focused
    ? theme.colors.primary
    : theme.colors.onSurfaceVariant;
  const backgroundScaleX = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1],
  });
  const backgroundOpacity = activeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButtonPressable}
      testID={testID}
    >
      <View style={styles.tabButton}>
        <Animated.View
          style={[
            styles.tabButtonIndicator,
            { transform: [{ scale: pressScale }] },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabButtonBackground,
              {
                backgroundColor: theme.colors.secondaryContainer,
                opacity: backgroundOpacity,
                transform: [{ scaleX: backgroundScaleX }],
              },
            ]}
          />
          <View style={styles.tabButtonIconSlot}>{renderIcon(tintColor)}</View>
        </Animated.View>
        <View style={styles.tabButtonContent}>
          <Text style={[styles.tabLabel, { color: tintColor }]}>{label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MD3TabBar({
  navigation,
  state,
  descriptors,
  insets,
}: BottomTabBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View
        style={[
          styles.tabBarShell,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
            paddingBottom: Math.max(insets.bottom, 6),
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : (options.title ?? route.name);

            return (
              <AnimatedTabButton
                key={route.key}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                focused={focused}
                label={label}
                onLongPress={() => {
                  navigation.emit({
                    type: "tabLongPress",
                    target: route.key,
                  });
                }}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (event.defaultPrevented || focused) {
                    return;
                  }

                  navigation.dispatch({
                    ...CommonActions.navigate(route.name, route.params),
                    target: state.key,
                  });
                }}
                renderIcon={(color) => {
                  if (options.tabBarIcon) {
                    return options.tabBarIcon({ focused, color, size: 24 });
                  }

                  return null;
                }}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const theme = useTheme();

  return (
    <InsightBoardProvider>
      <Tabs
        tabBar={(props) => <MD3TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Board",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                size={24}
                name={focused ? "layers" : "layers-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "Analytics",
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons
                size={24}
                name={focused ? "chart-pie" : "chart-pie-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="setup"
          options={{
            title: "Setup",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                size={24}
                name={focused ? "settings" : "settings-outline"}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </InsightBoardProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  tabBarShell: {
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tabBarRow: {
    flexDirection: "row",
  },
  tabButtonPressable: {
    flex: 1,
  },
  tabButton: {
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: 4,
  },
  tabButtonIndicator: {
    alignItems: "center",
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    overflow: "hidden",
    width: 62,
  },
  tabButtonBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  tabButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonIconSlot: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 62,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
});
