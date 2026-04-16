import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
    type Theme,
} from "@react-navigation/native";
import { Platform } from "react-native";
import {
    adaptNavigationTheme,
    MD3DarkTheme,
    MD3LightTheme,
    type MD3Theme,
} from "react-native-paper";

const royalBlue = {
  50: "#E8EAF6",
  100: "#C5CAE9",
  200: "#9FA8DA",
  300: "#7986CB",
  400: "#5C6BC0",
  500: "#3F51B5",
  600: "#3949AB",
  700: "#303F9F",
  800: "#283593",
  900: "#1A237E",
};

const blueGray = {
  50: "#ECEFF1",
  100: "#CFD8DC",
  200: "#B0BEC5",
  300: "#90A4AE",
  400: "#78909C",
  500: "#607D8B",
  600: "#546E7A",
  700: "#455A64",
  800: "#37474F",
  900: "#263238",
};

const gray = {
  50: "#FAFAFA",
  100: "#F5F5F5",
  200: "#EEEEEE",
  300: "#E0E0E0",
  400: "#BDBDBD",
  500: "#9E9E9E",
  600: "#757575",
  700: "#616161",
  800: "#424242",
  900: "#212121",
};

const semantic = {
  successLight: "#E8F5E9",
  success: "#4CAF50",
  successDark: "#1B5E20",
  warningLight: "#FFF8E1",
  warning: "#FFC107",
  warningDark: "#F57F17",
  errorLight: "#FFEBEE",
  error: "#F44336",
  errorDark: "#B71C1C",
};

const sharedRadii = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

const lightPalette = {
  background: "#F6F3EE",
  surface: "#FFFDFC",
  surfaceRaised: "#FFFFFF",
  surfaceSecondary: "#F1F3F6",
  surfaceTertiary: "#EDEBFA",
  surfaceSunken: "#E7EAEE",
  text: blueGray[900],
  textInverse: gray[50],
  textMuted: blueGray[600],
  textSoft: blueGray[500],
  accent: royalBlue[600],
  accentStrong: royalBlue[700],
  accentSoft: "#E8EAF6",
  highlight: semantic.warning,
  highlightSoft: semantic.warningLight,
  success: semantic.successDark,
  successSoft: semantic.successLight,
  warning: semantic.warningDark,
  warningSoft: "#FFF3E0",
  danger: semantic.error,
  dangerSoft: semantic.errorLight,
  border: "#D8DDE4",
  borderMuted: "#E6E9EE",
  tabInactive: blueGray[500],
  shadow: "rgba(38, 50, 56, 0.14)",
  overlay: "rgba(38, 50, 56, 0.12)",
  stage: {
    observation: blueGray[600],
    insight: royalBlue[600],
    actionable: semantic.warningDark,
    impact: semantic.successDark,
  },
  stageSurface: {
    observation: blueGray[50],
    insight: royalBlue[50],
    actionable: "#FFF3E0",
    impact: semantic.successLight,
  },
  priority: {
    P1: semantic.error,
    P2: semantic.warningDark,
    P3: semantic.warning,
    P4: gray[500],
  },
  prioritySurface: {
    P1: semantic.errorLight,
    P2: "#FFF3E0",
    P3: semantic.warningLight,
    P4: gray[100],
  },
  priorityText: {
    P1: semantic.errorDark,
    P2: semantic.warningDark,
    P3: semantic.warningDark,
    P4: blueGray[700],
  },
  radii: sharedRadii,
};

const darkPalette = {
  background: "#101316",
  surface: "#171B20",
  surfaceRaised: "#1C2127",
  surfaceSecondary: "#222930",
  surfaceTertiary: "rgba(197, 202, 233, 0.16)",
  surfaceSunken: "#0D1013",
  text: gray[50],
  textInverse: gray[50],
  textMuted: blueGray[200],
  textSoft: blueGray[300],
  accent: royalBlue[200],
  accentStrong: royalBlue[100],
  accentSoft: "rgba(197, 202, 233, 0.18)",
  highlight: semantic.warning,
  highlightSoft: "rgba(255, 193, 7, 0.16)",
  success: "#81C784",
  successSoft: "rgba(76, 175, 80, 0.18)",
  warning: "#FFB300",
  warningSoft: "rgba(255, 193, 7, 0.18)",
  danger: "#EF9A9A",
  dangerSoft: "rgba(244, 67, 54, 0.18)",
  border: "#33404A",
  borderMuted: "#283038",
  tabInactive: blueGray[300],
  shadow: "#000000",
  overlay: "rgba(0, 0, 0, 0.36)",
  stage: {
    observation: blueGray[200],
    insight: royalBlue[200],
    actionable: semantic.warning,
    impact: semantic.success,
  },
  stageSurface: {
    observation: "rgba(176, 190, 197, 0.14)",
    insight: "rgba(159, 168, 218, 0.18)",
    actionable: "rgba(255, 193, 7, 0.18)",
    impact: "rgba(76, 175, 80, 0.18)",
  },
  priority: {
    P1: "#EF9A9A",
    P2: "#FFB74D",
    P3: "#FFD54F",
    P4: blueGray[300],
  },
  prioritySurface: {
    P1: "rgba(244, 67, 54, 0.16)",
    P2: "rgba(245, 127, 23, 0.18)",
    P3: "rgba(255, 193, 7, 0.18)",
    P4: "rgba(176, 190, 197, 0.12)",
  },
  priorityText: {
    P1: "#FFCDD2",
    P2: "#FFE0B2",
    P3: "#FFF1B8",
    P4: blueGray[100],
  },
  radii: sharedRadii,
};

export const AppTheme = {
  light: lightPalette,
  dark: darkPalette,
};

const fallbackFonts = {
  display: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "sans-serif",
  }),
  body: "sans-serif",
  mono: "monospace",
};

export const AppFonts =
  Platform.select({
    ios: {
      display: "System",
      body: "System",
      mono: "Menlo",
    },
    android: {
      display: "sans-serif-medium",
      body: "sans-serif",
      mono: "monospace",
    },
    web: {
      display: "'Inter', 'Segoe UI', sans-serif",
      body: "'Inter', 'Segoe UI', sans-serif",
      mono: "'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
    },
    default: fallbackFonts,
  }) ?? fallbackFonts;

const {
  LightTheme: AdaptedLightNavigationTheme,
  DarkTheme: AdaptedDarkNavigationTheme,
} = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const lightPaperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: royalBlue[600],
    onPrimary: "#FFFFFF",
    primaryContainer: royalBlue[100],
    onPrimaryContainer: royalBlue[900],
    secondary: blueGray[600],
    onSecondary: "#FFFFFF",
    secondaryContainer: blueGray[100],
    onSecondaryContainer: blueGray[900],
    tertiary: semantic.warning,
    onTertiary: "#FFFFFF",
    tertiaryContainer: semantic.warningLight,
    onTertiaryContainer: blueGray[900],
    error: semantic.error,
    onError: "#FFFFFF",
    errorContainer: semantic.errorLight,
    onErrorContainer: semantic.errorDark,
    background: lightPalette.background,
    onBackground: blueGray[900],
    surface: "#FFFFFF",
    onSurface: blueGray[900],
    surfaceVariant: blueGray[50],
    onSurfaceVariant: blueGray[600],
    outline: gray[300],
    outlineVariant: blueGray[100],
    shadow: blueGray[900],
    scrim: lightPalette.overlay,
    inverseSurface: blueGray[800],
    inverseOnSurface: gray[50],
    inversePrimary: royalBlue[200],
    elevation: {
      level0: "transparent",
      level1: gray[50],
      level2: blueGray[50],
      level3: gray[100],
      level4: blueGray[100],
      level5: gray[200],
    },
    surfaceDisabled: "rgba(38, 50, 56, 0.12)",
    onSurfaceDisabled: "rgba(38, 50, 56, 0.38)",
    backdrop: "rgba(38, 50, 56, 0.4)",
  },
};

const darkPaperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: royalBlue[200],
    onPrimary: royalBlue[900],
    primaryContainer: royalBlue[700],
    onPrimaryContainer: royalBlue[50],
    secondary: blueGray[200],
    onSecondary: blueGray[900],
    secondaryContainer: blueGray[700],
    onSecondaryContainer: blueGray[50],
    tertiary: semantic.warning,
    onTertiary: blueGray[900],
    tertiaryContainer: semantic.warningDark,
    onTertiaryContainer: semantic.warningLight,
    error: "#F2B8B5",
    onError: semantic.errorDark,
    errorContainer: semantic.errorDark,
    onErrorContainer: semantic.errorLight,
    background: darkPalette.background,
    onBackground: gray[50],
    surface: darkPalette.surface,
    onSurface: gray[50],
    surfaceVariant: darkPalette.surfaceSecondary,
    onSurfaceVariant: blueGray[200],
    outline: blueGray[700],
    outlineVariant: darkPalette.borderMuted,
    shadow: "#000000",
    scrim: darkPalette.overlay,
    inverseSurface: gray[50],
    inverseOnSurface: blueGray[900],
    inversePrimary: royalBlue[700],
    elevation: {
      level0: "transparent",
      level1: darkPalette.surfaceRaised,
      level2: darkPalette.surfaceSecondary,
      level3: "#25313D",
      level4: "#293744",
      level5: "#2D3C4B",
    },
    surfaceDisabled: "rgba(250, 250, 250, 0.12)",
    onSurfaceDisabled: "rgba(250, 250, 250, 0.38)",
    backdrop: "rgba(0, 0, 0, 0.55)",
  },
};

export const PaperThemes = {
  light: lightPaperTheme,
  dark: darkPaperTheme,
};

export const Colors = {
  light: {
    text: lightPalette.text,
    background: lightPalette.background,
    tint: lightPalette.accentStrong,
    icon: lightPalette.tabInactive,
    tabIconDefault: lightPalette.tabInactive,
    tabIconSelected: lightPalette.accentStrong,
  },
  dark: {
    text: darkPalette.text,
    background: darkPalette.background,
    tint: darkPalette.accent,
    icon: darkPalette.tabInactive,
    tabIconDefault: darkPalette.tabInactive,
    tabIconSelected: darkPalette.accentStrong,
  },
};

export const Fonts = {
  sans: AppFonts.body,
  serif: AppFonts.display,
  rounded: AppFonts.body,
  mono: AppFonts.mono,
};

export const NavigationThemes: Record<keyof typeof AppTheme, Theme> = {
  light: {
    ...AdaptedLightNavigationTheme,
    colors: {
      ...AdaptedLightNavigationTheme.colors,
      primary: lightPaperTheme.colors.primary,
      background: lightPaperTheme.colors.background,
      card: lightPaperTheme.colors.surface,
      text: lightPaperTheme.colors.onSurface,
      border: lightPaperTheme.colors.outline,
      notification: lightPaperTheme.colors.error,
    },
  },
  dark: {
    ...AdaptedDarkNavigationTheme,
    colors: {
      ...AdaptedDarkNavigationTheme.colors,
      primary: darkPaperTheme.colors.primary,
      background: darkPaperTheme.colors.background,
      card: darkPaperTheme.colors.surface,
      text: darkPaperTheme.colors.onSurface,
      border: darkPaperTheme.colors.outline,
      notification: darkPaperTheme.colors.error,
    },
  },
};
