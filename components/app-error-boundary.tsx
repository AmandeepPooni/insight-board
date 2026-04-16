import { Component, PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppFonts, PaperThemes } from "@/constants/theme";

type AppErrorBoundaryState = {
  hasError: boolean;
  retryKey: number;
};

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = {
    hasError: false,
    retryKey: 0,
  };

  override componentDidCatch() {
    this.setState({ hasError: true });
  }

  private readonly handleRetry = () => {
    this.setState((currentState) => ({
      hasError: false,
      retryKey: currentState.retryKey + 1,
    }));
  };

  override render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.body}>
            The global error boundary caught a render failure. Retry the app
            shell, then inspect the last interaction that triggered it.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.container} key={this.state.retryKey}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontFamily: AppFonts.display,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    fontFamily: AppFonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: PaperThemes.light.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: PaperThemes.light.colors.onPrimary,
    fontFamily: AppFonts.body,
    fontSize: 14,
    fontWeight: "700",
  },
});
