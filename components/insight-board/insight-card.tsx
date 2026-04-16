import { StyleSheet, View } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Avatar, Card, Text } from "react-native-paper";

import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  type Insight,
  type PresenceUser,
  type User,
} from "@/lib/insight-board-schema";
import { getRelativeTimeLabel } from "@/lib/insight-utils";

type InsightCardProps = {
  insight: Insight;
  hcpName: string;
  categoryName: string;
  viewingUsers: PresenceUser[];
  editingUser: User | null;
  swipingUser: User | null;
  forwardStageLabel?: string;
  backwardStageLabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onSwipeStart?: () => void;
  onMoveForward?: () => void;
  onMoveBackward?: () => void;
};

export function InsightCard({
  insight,
  hcpName,
  categoryName,
  viewingUsers,
  editingUser,
  swipingUser,
  forwardStageLabel,
  backwardStageLabel,
  onPress,
  onLongPress,
  onSwipeStart,
  onMoveForward,
  onMoveBackward,
}: InsightCardProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const relativeTime = getRelativeTimeLabel(insight.updatedAt);
  const visibleViewers = viewingUsers.slice(0, 2);
  const additionalViewerCount = Math.max(
    viewingUsers.length - visibleViewers.length,
    0,
  );
  const editingUserName = editingUser?.fullName.split(" ")[0] ?? null;
  const swipingUserName = swipingUser?.fullName.split(" ")[0] ?? null;
  const viewingAccessibilityLabel = visibleViewers.length
    ? `${viewingUsers.length} active viewer${viewingUsers.length === 1 ? "" : "s"}`
    : null;
  const hasStatusSignals = Boolean(
    visibleViewers.length || editingUserName || swipingUserName,
  );

  const renderForwardAction = () => (
    <View style={[styles.swipeAction, { backgroundColor: colors.successSoft }]}>
      <Text variant="labelSmall" style={{ color: colors.success }}>
        Move to
      </Text>
      <Text
        variant="labelMedium"
        style={{ color: colors.success, fontWeight: "700" }}
      >
        {forwardStageLabel ?? "Next stage"}
      </Text>
    </View>
  );

  const renderBackwardAction = () => (
    <View style={[styles.swipeAction, { backgroundColor: colors.warningSoft }]}>
      <Text variant="labelSmall" style={{ color: colors.warning }}>
        Return to
      </Text>
      <Text
        variant="labelMedium"
        style={{ color: colors.warning, fontWeight: "700" }}
      >
        {backwardStageLabel ?? "Previous stage"}
      </Text>
    </View>
  );

  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={(direction) => {
        onSwipeStart?.();

        if (direction === "left") {
          onMoveForward?.();
        }

        if (direction === "right") {
          onMoveBackward?.();
        }
      }}
      renderLeftActions={onMoveForward ? renderForwardAction : undefined}
      renderRightActions={onMoveBackward ? renderBackwardAction : undefined}
    >
      <Card
        mode="contained"
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={`${insight.title}, ${insight.priority}, ${hcpName}, ${categoryName}. Long press to move.`}
        accessibilityHint="Double tap to open details. Swipe left or right to change stage, or long press to choose a stage."
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderMuted,
          },
          insight.swipeUserId && {
            borderWidth: 2,
            borderColor: colors.accentStrong,
          },
        ]}
        accessibilityRole="button"
      >
        <Card.Content style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.prioritySurface[insight.priority] },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    color: colors.priorityText[insight.priority],
                    fontWeight: "700",
                  }}
                >
                  {insight.priority}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  styles.categoryBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{ color: colors.textMuted, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {categoryName}
                </Text>
              </View>
              {hasStatusSignals ? (
                <View style={styles.statusGroup}>
                  {visibleViewers.length ? (
                    <View
                      accessibilityLabel={
                        viewingAccessibilityLabel ?? undefined
                      }
                      style={[
                        styles.viewerStack,
                        { backgroundColor: colors.surfaceTertiary },
                      ]}
                    >
                      {visibleViewers.map((user, index) => (
                        <Avatar.Text
                          key={user.id}
                          size={24}
                          label={user.initials}
                          style={[
                            styles.headerAvatar,
                            {
                              backgroundColor:
                                user.status === "active"
                                  ? colors.surfaceTertiary
                                  : colors.surfaceSecondary,
                              borderColor: colors.surface,
                              marginLeft: index === 0 ? 0 : -8,
                            },
                          ]}
                          labelStyle={{ color: colors.text, fontSize: 9 }}
                        />
                      ))}
                      {additionalViewerCount ? (
                        <View
                          style={[
                            styles.viewerOverflow,
                            styles.viewerOverflowCompact,
                            {
                              backgroundColor: colors.surfaceSecondary,
                              borderColor: colors.surface,
                            },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{
                              color: colors.textMuted,
                              fontWeight: "700",
                            }}
                          >
                            +{additionalViewerCount}
                          </Text>
                        </View>
                      ) : null}
                      <Text
                        variant="labelSmall"
                        style={[styles.statusText, { color: colors.textMuted }]}
                      >
                        viewing this
                      </Text>
                    </View>
                  ) : null}
                  {editingUserName ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: colors.surfaceTertiary },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.statusText,
                          { color: colors.accentStrong },
                        ]}
                      >
                        {editingUserName} editing
                      </Text>
                    </View>
                  ) : null}
                  {swipingUserName ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: colors.surfaceTertiary },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={[styles.statusText, { color: colors.accent }]}
                      >
                        {swipingUserName} swiping
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <Text variant="labelMedium" style={{ color: colors.textSoft }}>
              {relativeTime}
            </Text>
          </View>

          <Text
            variant="titleMedium"
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {insight.title}
          </Text>

          <View style={styles.metaLine}>
            <Text
              variant="bodyMedium"
              style={[styles.hcpText, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {hcpName}
            </Text>
            {insight.drugName ? (
              <>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  ·
                </Text>
                <View
                  style={[
                    styles.drugBadge,
                    { borderColor: colors.borderMuted },
                  ]}
                >
                  <Text
                    variant="labelSmall"
                    style={{ color: colors.textMuted, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {insight.drugName}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeAction: {
    alignItems: "center",
    borderRadius: 16,
    gap: 4,
    justifyContent: "center",
    marginBottom: 10,
    minWidth: 124,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  content: {
    gap: 8,
    paddingBottom: 14,
    paddingTop: 14,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
    gap: 8,
    minWidth: 0,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  title: {
    fontWeight: "700",
    lineHeight: 22,
  },
  metaLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  hcpText: {
    flex: 1,
  },
  drugBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexShrink: 1,
    maxWidth: 120,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    minHeight: 22,
  },
  categoryBadge: {
    flexShrink: 1,
    maxWidth: 132,
  },
  activityRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    width: "100%",
  },
  viewerStack: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 999,
    flexShrink: 0,
    minHeight: 28,
    paddingRight: 8,
  },
  statusGroup: {
    alignItems: "center",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    minHeight: 28,
    paddingHorizontal: 10,
  },
  statusText: {
    fontWeight: "600",
    paddingLeft: 4,
    paddingRight: 4,
  },
  viewerOverflow: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 6,
  },
  viewerOverflowCompact: {
    marginLeft: 6,
  },
  headerAvatar: {
    borderWidth: 1,
  },
});
