import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
    Avatar,
    Button,
    Card,
    Chip,
    HelperText,
    Text,
    TextInput,
} from "react-native-paper";

import { AppScreen } from "@/components/app-screen";
import { useBackend } from "@/components/providers/backend-provider";
import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    configuredSupabaseHost,
    configuredSupabaseKeyType,
    env,
    hasSupabaseEnv,
} from "@/lib/env";
import {
    assignmentCoverage,
    requiredPackages,
} from "@/lib/insight-board-schema";

export default function SetupScreen() {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const {
    backendError,
    categories,
    connectionState,
    customFieldDefinitions,
    hcps,
    setupSteps,
    tags,
    teamUsers,
    totalInsightCount,
  } = useInsightBoard();
  const {
    authError,
    clearAuthError,
    demoAccounts,
    isConfigured,
    isSessionLoading,
    session,
    signIn,
    signOut,
  } = useBackend();
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? "");
  const connectionChipIcon =
    connectionState === "live"
      ? "cloud-check-outline"
      : connectionState === "loading"
        ? "cloud-sync-outline"
        : connectionState === "auth-required"
          ? "account-lock-outline"
          : connectionState === "config-required"
            ? "cog-outline"
            : "alert-circle-outline";
  const connectionChipLabel =
    connectionState === "live"
      ? "Live board connected"
      : connectionState === "loading"
        ? "Connecting to live board"
        : connectionState === "auth-required"
          ? "Sign in required"
          : connectionState === "config-required"
            ? "Env required"
            : "Connection issue";
  const connectionChipBackground =
    connectionState === "live"
      ? colors.stageSurface.insight
      : connectionState === "loading"
        ? colors.surfaceTertiary
        : connectionState === "auth-required"
          ? colors.stageSurface.actionable
          : connectionState === "config-required"
            ? colors.stageSurface.observation
            : colors.stageSurface.impact;

  const liveDataLooksSparse =
    connectionState === "live" &&
    categories.length === 0 &&
    tags.length === 0 &&
    hcps.length === 0 &&
    totalInsightCount === 0;

  const submitSignIn = () => {
    clearAuthError();
    void signIn({ email, password });
  };

  return (
    <AppScreen>
      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 16 }}>
          <View style={styles.titleBlock}>
            <Text variant="headlineMedium" style={{ color: colors.text }}>
              Workspace setup
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              Verify configuration, sign in with a demo account, and confirm the
              board can read and write the live GraphQL workspace.
            </Text>
          </View>

          <View style={styles.chipRow}>
            <Chip
              icon={hasSupabaseEnv ? "check-circle-outline" : "clock-outline"}
              style={{
                backgroundColor: hasSupabaseEnv
                  ? colors.stageSurface.impact
                  : colors.stageSurface.actionable,
              }}
            >
              {hasSupabaseEnv ? "Public env detected" : "Awaiting public env"}
            </Chip>
            <Chip
              icon={connectionChipIcon}
              style={{ backgroundColor: connectionChipBackground }}
            >
              {connectionChipLabel}
            </Chip>
          </View>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            Environment status
          </Text>
          <Chip
            icon={hasSupabaseEnv ? "check-circle-outline" : "clock-outline"}
          >
            {hasSupabaseEnv ? "Public env detected" : "Awaiting public env"}
          </Chip>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            Supabase host: {configuredSupabaseHost ?? "not configured"}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            Public key type: {configuredSupabaseKeyType ?? "missing"}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            GraphQL endpoint:{" "}
            {env.graphqlEndpoint || "set EXPO_PUBLIC_SUPABASE_URL first"}
          </Text>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            Auth and live connection
          </Text>
          <View style={styles.chipRow}>
            <Chip icon={connectionChipIcon}>{connectionChipLabel}</Chip>
            <Chip icon={session ? "account-check-outline" : "account-outline"}>
              {session ? "Signed in" : "Sign in required"}
            </Chip>
          </View>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            GraphQL reads need both the public API key and a bearer token from
            an authenticated Supabase session because your RLS policies are
            scoped to the authenticated role.
          </Text>
          {session ? (
            <>
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Active session: {session.user.email}
              </Text>
              <Button
                mode="outlined"
                onPress={() => {
                  void signOut();
                }}
                disabled={isSessionLoading}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <View style={styles.chipRow}>
                {demoAccounts.map((account) => (
                  <Chip
                    key={account.email}
                    onPress={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                    }}
                  >
                    {account.label}
                  </Chip>
                ))}
              </View>
              <TextInput
                label="Email"
                mode="outlined"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                label="Password"
                mode="outlined"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Button
                mode="contained"
                onPress={submitSignIn}
                disabled={!isConfigured || isSessionLoading}
              >
                {isSessionLoading ? "Signing in..." : "Sign in to live board"}
              </Button>
            </>
          )}
          <HelperText type="error" visible={Boolean(authError || backendError)}>
            {authError || backendError || " "}
          </HelperText>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            Live data snapshot
          </Text>
          <View style={styles.metricsGrid}>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {teamUsers.length}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  users
                </Text>
              </Card.Content>
            </Card>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {categories.length}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  categories
                </Text>
              </Card.Content>
            </Card>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {tags.length}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  tags
                </Text>
              </Card.Content>
            </Card>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {hcps.length}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  HCPs
                </Text>
              </Card.Content>
            </Card>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {totalInsightCount}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  insights
                </Text>
              </Card.Content>
            </Card>
            <Card
              mode="contained"
              style={[
                styles.metricCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content>
                <Text variant="headlineSmall" style={{ color: colors.text }}>
                  {customFieldDefinitions.length}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  custom fields
                </Text>
              </Card.Content>
            </Card>
          </View>
          {liveDataLooksSparse ? (
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              The auth users are present, but the board reference tables are
              still empty. Run the seed SQL from the setup guide if you want
              live categories, HCPs, tags, and starter insights instead of an
              empty board.
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            Required packages
          </Text>
          <View style={styles.chipRow}>
            {requiredPackages.map((pkg) => (
              <Chip
                key={pkg}
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                {pkg}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            Setup steps
          </Text>
          <View style={styles.stepList}>
            {setupSteps.map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <Avatar.Text
                  size={32}
                  label={String(index + 1)}
                  style={{ backgroundColor: colors.surfaceTertiary }}
                  labelStyle={{ color: colors.accentStrong, fontSize: 14 }}
                />
                <View style={styles.stepCopy}>
                  <Text variant="titleMedium" style={{ color: colors.text }}>
                    {step.title}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.textMuted }}
                  >
                    {step.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={[styles.sectionCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={{ gap: 14 }}>
          <Text variant="titleLarge" style={{ color: colors.text }}>
            What this scaffold already covers
          </Text>
          <View style={styles.stepList}>
            {assignmentCoverage.map((item) => (
              <Text
                key={item}
                variant="bodyMedium"
                style={{ color: colors.textMuted }}
              >
                - {item}
              </Text>
            ))}
          </View>
        </Card.Content>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 28,
    overflow: "hidden",
  },
  titleBlock: {
    gap: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flexBasis: "31%",
    minHeight: 88,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stepList: {
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
  },
  stepCopy: {
    flex: 1,
    gap: 4,
  },
});
