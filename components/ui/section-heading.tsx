import { StyleSheet, Text, View } from "react-native";

import { AppFonts, AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  detail?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  detail,
}: SectionHeadingProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];

  return (
    <View style={styles.container}>
      <Text style={[styles.eyebrow, { color: colors.accentStrong }]}>
        {eyebrow}
      </Text>
      <Text
        style={[
          styles.title,
          { color: colors.text, fontFamily: AppFonts.display },
        ]}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  eyebrow: {
    fontFamily: AppFonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
  },
  detail: {
    fontFamily: AppFonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
});
