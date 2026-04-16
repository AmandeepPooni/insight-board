import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { StyleSheet, View } from "react-native";
import { Badge, List, Text } from "react-native-paper";

import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getRelativeTimeLabel } from "@/lib/insight-utils";

type ActivityFeedSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onSelectNotification: (insightId: string) => void;
};

export function ActivityFeedSheet({
  visible,
  onDismiss,
  onSelectNotification,
}: ActivityFeedSheetProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const { notifications } = useInsightBoard();

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Board activity"
      subtitle="Recent moves, edits, and new insights across the board."
      heightPercent={0.74}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {notifications.map((notification) => (
          <List.Item
            key={notification.id}
            title={notification.message}
            description={getRelativeTimeLabel(notification.createdAt)}
            onPress={() => onSelectNotification(notification.insightId)}
            accessibilityLabel={`Open activity for ${notification.message}`}
            titleNumberOfLines={3}
            style={[
              styles.item,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderMuted,
              },
            ]}
            left={(props) => (
              <View style={styles.leftSlot}>
                <List.Icon {...props} icon="bell-ring-outline" />
              </View>
            )}
            right={() =>
              notification.read ? null : <Badge style={styles.badge}>New</Badge>
            }
          />
        ))}
        {notifications.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            No activity yet.
          </Text>
        ) : null}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingBottom: 12,
  },
  item: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  leftSlot: {
    justifyContent: "center",
  },
  badge: {
    alignSelf: "center",
    marginRight: 8,
  },
});
