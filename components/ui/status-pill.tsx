import { StyleSheet, Text, View } from "react-native";

import { AppFonts, AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type StatusTone = "neutral" | "accent" | "success" | "warning";

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];

  const toneStyles = {
    neutral: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border,
      color: colors.textMuted,
    },
    accent: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentSoft,
      color: colors.accentStrong,
    },
    success: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successSoft,
      color: colors.success,
    },
    warning: {
      backgroundColor: colors.highlightSoft,
      borderColor: colors.highlightSoft,
      color: colors.warning,
    },
  }[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: toneStyles.backgroundColor,
          borderColor: toneStyles.borderColor,
        },
      ]}
    >
      <Text style={[styles.label, { color: toneStyles.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  label: {
    fontFamily: AppFonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
});
