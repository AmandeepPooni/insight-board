import {
    BottomSheetBackdrop,
    BottomSheetModal,
    type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
    PropsWithChildren,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { Platform, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type AppBottomSheetProps = PropsWithChildren<{
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  heightPercent?: number;
}>;

export function AppBottomSheet({
  visible,
  onDismiss,
  title,
  subtitle,
  footer,
  heightPercent = 0.86,
  children,
}: AppBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);
  const reopenFrameRef = useRef<number | null>(null);
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible && reopenFrameRef.current !== null) {
      cancelAnimationFrame(reopenFrameRef.current);
      reopenFrameRef.current = null;
    }

    if (visible) {
      modalRef.current?.present();
      return;
    }

    modalRef.current?.dismiss();
  }, [visible]);

  useEffect(() => {
    return () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current);
      }
    };
  }, []);

  const snapPoints = useMemo(
    () => [`${Math.round(heightPercent * 100)}%`],
    [heightPercent],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={colorScheme === "dark" ? 0.52 : 0.32}
        pressBehavior="close"
      />
    ),
    [colorScheme],
  );

  const handleDismiss = useCallback(() => {
    if (!visibleRef.current) {
      return;
    }

    onDismiss();

    if (reopenFrameRef.current !== null) {
      cancelAnimationFrame(reopenFrameRef.current);
    }

    reopenFrameRef.current = requestAnimationFrame(() => {
      reopenFrameRef.current = null;

      if (visibleRef.current) {
        modalRef.current?.present();
      }
    });
  }, [onDismiss]);

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheetBackground,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderMuted,
        },
      ]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
      handleStyle={styles.handleContainer}
      keyboardBehavior={Platform.OS === "ios" ? "interactive" : "fillParent"}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      topInset={0}
      bottomInset={0}
      onDismiss={handleDismiss}
      style={[styles.modal, { shadowColor: colors.shadow }]}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text variant="titleLarge" style={{ color: colors.text }}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <IconButton
            icon="close"
            onPress={onDismiss}
            accessibilityLabel={`Close ${title}`}
            containerColor={colors.surfaceSecondary}
          />
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? (
          <View
            style={[
              styles.footer,
              { borderTopColor: colors.borderMuted },
              { paddingBottom: Math.max(insets.bottom, 12) + 8 },
            ]}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 8) }} />
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 18,
  },
  sheet: {
    flex: 1,
    minHeight: 0,
  },
  sheetBackground: {
    borderRadius: 32,
    borderWidth: 1,
  },
  handleContainer: {
    paddingTop: 10,
  },
  handle: {
    height: 4,
    width: 48,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 24,
  },
  footer: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
});
