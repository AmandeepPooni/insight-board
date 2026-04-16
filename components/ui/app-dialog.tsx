import { PropsWithChildren, ReactNode } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from "react-native";
import { Text } from "react-native-paper";

import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type AppDialogProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onDismiss: () => void;
  actions?: ReactNode;
  dismissable?: boolean;
  maxHeightPercent?: number;
}>;

export function AppDialog({
  visible,
  title,
  onDismiss,
  actions,
  dismissable = true,
  maxHeightPercent = 0.8,
  children,
}: AppDialogProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardRoot}
      >
        <Pressable
          accessibilityViewIsModal
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={dismissable ? onDismiss : undefined}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.dialog,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderMuted,
                maxHeight: `${Math.round(maxHeightPercent * 100)}%`,
              },
            ]}
          >
            <View style={styles.header}>
              <Text variant="titleLarge" style={{ color: colors.text }}>
                {title}
              </Text>
            </View>
            <View style={styles.content}>{children}</View>
            {actions ? (
              <View
                style={[styles.actions, { borderTopColor: colors.borderMuted }]}
              >
                {actions}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  backdrop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  dialog: {
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 520,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
