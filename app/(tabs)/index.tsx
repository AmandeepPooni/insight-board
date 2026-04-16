import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
    memo,
    startTransition,
    useDeferredValue,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Animated,
    Easing,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import {
    ActivityIndicator,
    Avatar,
    Badge,
    Button,
    Card,
    Chip,
    FAB,
    IconButton,
    Searchbar,
    Snackbar,
    Text,
    TouchableRipple,
} from "react-native-paper";
import Reanimated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityFeedSheet } from "@/components/insight-board/activity-feed-sheet";
import { FilterSheet } from "@/components/insight-board/filter-sheet";
import { InsightCard } from "@/components/insight-board/insight-card";
import { InsightDetailSheet } from "@/components/insight-board/insight-detail-sheet";
import { InsightFormSheet } from "@/components/insight-board/insight-form-sheet";
import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { type Insight } from "@/lib/insight-board-schema";
import { getNextStage, getPreviousStage } from "@/lib/insight-utils";

type AppPalette = (typeof AppTheme)["light"];

type AnimatedViewModeTabsProps = {
  colors: AppPalette;
  value: "list" | "overview";
  onChange: (value: "list" | "overview") => void;
};

type InsightSearchFieldProps = {
  activeFilterCount: number;
  colors: AppPalette;
  onChangeText: (value: string) => void;
  onOpenFilters: () => void;
  value: string;
};

function AnimatedViewModeTabs({
  colors,
  value,
  onChange,
}: AnimatedViewModeTabsProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const progress = useRef(new Animated.Value(value === "list" ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value === "list" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, value]);

  const indicatorWidth = containerWidth > 8 ? (containerWidth - 8) / 2 : 0;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });
  const options = [
    { value: "list" as const, label: "List", icon: "format-list-bulleted" },
    {
      value: "overview" as const,
      label: "Overview",
      icon: "view-grid-outline",
    },
  ] as const;

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[
        styles.viewModeTabs,
        { backgroundColor: colors.surfaceSecondary },
      ]}
    >
      {indicatorWidth ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.viewModeIndicator,
            {
              backgroundColor: colors.surface,
              transform: [{ translateX }],
              width: indicatorWidth,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        const tintColor = selected ? colors.text : colors.textMuted;

        return (
          <Pressable
            key={option.value}
            accessibilityLabel={`Switch to ${option.label.toLowerCase()} view`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={styles.viewModeButton}
          >
            <View style={styles.viewModeButtonInner}>
              <MaterialCommunityIcons
                color={tintColor}
                name={option.icon}
                size={18}
              />
              <Text
                variant="labelLarge"
                style={{
                  color: tintColor,
                  fontWeight: selected ? "700" : "600",
                }}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const InsightSearchField = memo(function InsightSearchField({
  activeFilterCount,
  colors,
  onChangeText,
  onOpenFilters,
  value,
}: InsightSearchFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const deferredValue = useDeferredValue(localValue);
  const lastCommittedValueRef = useRef(value);

  useEffect(() => {
    if (value === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = value;
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (deferredValue === lastCommittedValueRef.current) {
      return;
    }

    lastCommittedValueRef.current = deferredValue;
    startTransition(() => {
      onChangeText(deferredValue);
    });
  }, [deferredValue, onChangeText]);

  return (
    <View style={styles.searchRow}>
      <Searchbar
        placeholder="Search title, description, or drug"
        value={localValue}
        onChangeText={setLocalValue}
        accessibilityLabel="Search insights"
        style={[styles.searchbar, { backgroundColor: colors.surfaceSecondary }]}
      />
      <View style={styles.filterButtonWrap}>
        <TouchableRipple
          accessibilityLabel="Open filters"
          borderless
          onPress={onOpenFilters}
          style={[
            styles.filterIconButton,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <View style={styles.filterIconInner}>
            <MaterialCommunityIcons
              color={colors.textMuted}
              name="tune-variant"
              size={20}
            />
          </View>
        </TouchableRipple>
        {activeFilterCount ? (
          <Badge style={styles.filterBadge}>{activeFilterCount}</Badge>
        ) : null}
      </View>
    </View>
  );
});

type BoardListItem =
  | { id: "header"; type: "header" }
  | { id: "content-spacer"; type: "content-spacer" }
  | { id: "empty"; type: "empty" }
  | { id: "loading"; type: "loading" }
  | {
      id: string;
      type: "overview-stage";
      stageKey: Insight["stage"];
    }
  | { id: string; type: "insight"; insight: Insight };

export default function BoardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const stickySafeTop = Math.max(insets.top + 30, 0);
  const heroFadeEnd = Math.max(120, stickySafeTop + 60);
  const heroFadeMidpoint = Math.round(heroFadeEnd * 0.55);
  const viewModeCollapseEnd = heroFadeEnd + 42;
  const viewModeCollapseMidpoint = Math.round(viewModeCollapseEnd * 0.5);
  const boardListRef = useRef<FlatList<BoardListItem>>(null);
  const scrollY = useSharedValue(0);
  const { isOnline } = useNetworkStatus();
  const {
    announceEditingInsight,
    announceSwipingInsight,
    announceViewingInsight,
    backendError,
    ensureInsightLoaded,
    categories,
    clearFilters,
    connectionState,
    currentUser,
    dismissFeedback,
    feedbackMessage,
    filters,
    getInsightsForStage,
    getStageCounts,
    hasMoreInsightsForStage,
    hasActiveFilters,
    hcps,
    insights,
    isBoardLoading,
    isLoadingMoreForStage,
    isRefreshing,
    loadMoreInsightsForStage,
    markNotificationsRead,
    moveInsightToStage,
    presenceUsers,
    refreshBoard,
    selectedStage,
    setCategoryFilter,
    setDateRangeFilter,
    setHcpFilter,
    setSearchInput,
    setSelectedStage,
    setViewMode,
    stageDefinitions,
    tags,
    teamUsers,
    togglePriorityFilter,
    toggleTagFilter,
    unreadNotificationCount,
    viewMode,
  } = useInsightBoard();
  const [filterVisible, setFilterVisible] = useState(false);
  const [activityVisible, setActivityVisible] = useState(false);
  const [detailInsightId, setDetailInsightId] = useState<string | null>(null);
  const [editingInsightId, setEditingInsightId] = useState<string | null>(null);
  const [editingConflictInsightId, setEditingConflictInsightId] = useState<
    string | null
  >(null);
  const [moveToInsightId, setMoveToInsightId] = useState<string | null>(null);

  useScrollToTop(boardListRef);

  const boardListScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroTopRowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, heroFadeMidpoint, heroFadeEnd],
      [1, 0.4, 0],
      Extrapolation.CLAMP,
    ),
    height: interpolate(
      scrollY.value,
      [heroFadeMidpoint, heroFadeEnd],
      [54, 0],
      Extrapolation.CLAMP,
    ),
    marginBottom: interpolate(
      scrollY.value,
      [heroFadeMidpoint, heroFadeEnd],
      [6, 0],
      Extrapolation.CLAMP,
    ),
    overflow: "hidden",
  }));

  const viewModeCollapseAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, viewModeCollapseEnd],
      [50, 0],
      Extrapolation.CLAMP,
    ),
    marginBottom: interpolate(
      scrollY.value,
      [0, viewModeCollapseEnd],
      [14, 0],
      Extrapolation.CLAMP,
    ),
    opacity: interpolate(
      scrollY.value,
      [0, viewModeCollapseMidpoint, viewModeCollapseEnd],
      [1, 0.4, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, viewModeCollapseEnd],
          [0, -8],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const selectedInsight =
    insights.find((insight) => insight.id === detailInsightId) ?? null;
  const editingInsight =
    insights.find((insight) => insight.id === editingInsightId) ?? null;
  const editingConflictInsight =
    insights.find((insight) => insight.id === editingConflictInsightId) ?? null;
  const moveToInsight =
    insights.find((insight) => insight.id === moveToInsightId) ?? null;
  const currentStageInsights = getInsightsForStage(selectedStage);
  const currentStageCounts = getStageCounts(selectedStage);
  const activeStageDefinition =
    stageDefinitions.find((stage) => stage.key === selectedStage) ??
    stageDefinitions[0];
  const markNotificationsReadRef = useRef(markNotificationsRead);

  const emptyStateTitle =
    connectionState === "live"
      ? hasActiveFilters
        ? "No insights match these filters"
        : `No ${selectedStage} insights yet`
      : connectionState === "auth-required"
        ? "Sign in to load the board"
        : connectionState === "config-required"
          ? "Backend setup required"
          : connectionState === "loading"
            ? "Connecting to the live board"
            : "Unable to load the board";
  const emptyStateMessage =
    connectionState === "live"
      ? hasActiveFilters
        ? "Clear filters, switch stages, or refresh to see more insights."
        : "Pull to refresh or create a new observation."
      : (backendError ??
        (connectionState === "auth-required"
          ? "Authenticate with Supabase to read and write live insights."
          : connectionState === "config-required"
            ? "Add the Supabase public URL and key in your Expo environment."
            : connectionState === "loading"
              ? "The app is still establishing its live GraphQL session."
              : "The live GraphQL query failed. Check the setup tab for details."));

  useEffect(() => {
    markNotificationsReadRef.current = markNotificationsRead;
  }, [markNotificationsRead]);

  useEffect(() => {
    if (!activityVisible || unreadNotificationCount === 0) {
      return;
    }

    markNotificationsReadRef.current();
  }, [activityVisible, unreadNotificationCount]);

  useEffect(() => {
    announceViewingInsight(detailInsightId);

    return () => {
      announceViewingInsight(null);
    };
  }, [announceViewingInsight, detailInsightId]);

  useEffect(() => {
    announceEditingInsight(
      editingInsightId && editingInsightId !== "new" ? editingInsightId : null,
    );

    return () => {
      announceEditingInsight(null);
    };
  }, [announceEditingInsight, editingInsightId]);

  const activeFilterChips = [
    ...filters.priorities.map((priority) => ({
      key: priority,
      label: priority,
      onRemove: () => togglePriorityFilter(priority),
    })),
    ...(filters.categoryId
      ? [
          {
            key: filters.categoryId,
            label:
              categories.find((category) => category.id === filters.categoryId)
                ?.name ?? "Category",
            onRemove: () => setCategoryFilter(null),
          },
        ]
      : []),
    ...(filters.tagIds.map((tagId) => ({
      key: tagId,
      label: tags.find((tag) => tag.id === tagId)?.name ?? tagId,
      onRemove: () => toggleTagFilter(tagId),
    })) ?? []),
    ...(filters.hcpId
      ? [
          {
            key: filters.hcpId,
            label: hcps.find((hcp) => hcp.id === filters.hcpId)?.name ?? "HCP",
            onRemove: () => setHcpFilter(null),
          },
        ]
      : []),
    ...(filters.dateRange
      ? [
          {
            key: filters.dateRange,
            label: filters.dateRange,
            onRemove: () => setDateRangeFilter(null),
          },
        ]
      : []),
  ];
  const activeFilterCount = activeFilterChips.length;
  const visibleResultCount =
    viewMode === "overview"
      ? stageDefinitions.reduce(
          (total, stage) => total + getStageCounts(stage.key).filtered,
          0,
        )
      : currentStageCounts.filtered;
  const visibleResultLabel = `${visibleResultCount} result${visibleResultCount === 1 ? "" : "s"}`;

  const openInsight = (insight: Insight) => {
    if (insight.editingUserId && insight.editingUserId !== currentUser.id) {
      setEditingConflictInsightId(insight.id);
      return;
    }

    setDetailInsightId(insight.id);
  };

  const renderInsightCard = ({ item }: { item: Insight }) => {
    const hcp = hcps.find((candidate) => candidate.id === item.hcpId);
    const category = categories.find(
      (candidate) => candidate.id === item.categoryId,
    );
    const viewingUsers = presenceUsers.filter((user) =>
      item.viewingUserIds.includes(user.id),
    );
    const editingUser =
      presenceUsers.find((user) => user.id === item.editingUserId) ??
      teamUsers.find((user) => user.id === item.editingUserId) ??
      null;
    const swipingUser =
      presenceUsers.find((user) => user.id === item.swipeUserId) ??
      teamUsers.find((user) => user.id === item.swipeUserId) ??
      null;
    const nextStage = getNextStage(item.stage);
    const previousStage = getPreviousStage(item.stage);
    const nextStageLabel = stageDefinitions.find(
      (stage) => stage.key === nextStage,
    )?.label;
    const previousStageLabel = stageDefinitions.find(
      (stage) => stage.key === previousStage,
    )?.label;

    return (
      <InsightCard
        insight={item}
        hcpName={hcp ? `${hcp.name}, ${hcp.specialty}` : "Unlinked HCP"}
        categoryName={category?.name ?? "General"}
        viewingUsers={viewingUsers}
        editingUser={editingUser}
        swipingUser={swipingUser}
        onPress={() => openInsight(item)}
        onLongPress={() => setMoveToInsightId(item.id)}
        onSwipeStart={() => announceSwipingInsight(item.id)}
        forwardStageLabel={nextStageLabel}
        backwardStageLabel={previousStageLabel}
        onMoveForward={
          nextStage ? () => moveInsightToStage(item.id, nextStage) : undefined
        }
        onMoveBackward={
          previousStage
            ? () => moveInsightToStage(item.id, previousStage)
            : undefined
        }
      />
    );
  };

  const headerSection = (
    <View style={{ backgroundColor: colors.surface }}>
      <View
        style={[
          styles.heroSection,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        <Reanimated.View style={[styles.heroTopRow, heroTopRowAnimatedStyle]}>
          <View style={styles.heroPresenceSummary}>
            <View style={styles.presenceRow}>
              {presenceUsers.slice(0, 3).map((user, index) => (
                <Avatar.Text
                  key={user.id}
                  size={42}
                  label={user.initials}
                  style={[
                    styles.presenceAvatar,
                    {
                      backgroundColor:
                        user.status === "active"
                          ? colors.surfaceTertiary
                          : colors.surfaceSecondary,
                      borderColor: colors.surface,
                      marginLeft: index === 0 ? 0 : -8,
                    },
                  ]}
                  labelStyle={{ color: colors.accent, fontSize: 14 }}
                />
              ))}
              {presenceUsers.length > 3 ? (
                <Chip compact style={styles.presenceOverflowChip}>
                  +{presenceUsers.length - 3}
                </Chip>
              ) : null}
            </View>
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              {presenceUsers.length} online now
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.bellWrap}>
              <IconButton
                icon="bell-outline"
                mode="contained-tonal"
                onPress={() => setActivityVisible(true)}
                accessibilityLabel="Open activity feed"
                style={styles.headerIconButton}
              />
              {unreadNotificationCount ? (
                <Badge style={styles.bellBadge}>
                  {unreadNotificationCount}
                </Badge>
              ) : null}
            </View>
          </View>
        </Reanimated.View>
      </View>
      <View
        style={[
          styles.stickyTabsShell,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderMuted,
          },
        ]}
      >
        <Reanimated.View
          style={[styles.viewModeCollapseWrap, viewModeCollapseAnimatedStyle]}
        >
          <AnimatedViewModeTabs
            colors={colors}
            value={viewMode}
            onChange={setViewMode}
          />
        </Reanimated.View>

        <View style={styles.pipelineSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pipelineScrollContent}
          >
            <View style={styles.pipelineTrackShell}>
              <View
                style={[
                  styles.pipelineTrack,
                  { backgroundColor: colors.borderMuted },
                ]}
              />
              <View style={styles.pipelineRow}>
                {stageDefinitions.map((stage) => {
                  const counts = getStageCounts(stage.key);
                  const isSelected = stage.key === selectedStage;
                  const countLabel = hasActiveFilters
                    ? `${counts.filtered} of ${counts.total}`
                    : `${counts.total}`;

                  return (
                    <TouchableRipple
                      key={stage.key}
                      accessibilityLabel={`${stage.label} tab, ${countLabel} insights${isSelected ? ", selected" : ""}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      borderless
                      onPress={() => {
                        setSelectedStage(stage.key);
                        setViewMode("list");
                      }}
                      style={styles.pipelineStepPressable}
                    >
                      <View
                        style={[
                          styles.pipelineStepChip,
                          {
                            backgroundColor: isSelected
                              ? colors.stageSurface[stage.key]
                              : colors.surfaceSecondary,
                            borderColor: isSelected
                              ? colors.stage[stage.key]
                              : colors.borderMuted,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.pipelineStepDot,
                            { backgroundColor: colors.stage[stage.key] },
                          ]}
                        />
                        <Text
                          numberOfLines={1}
                          variant="labelMedium"
                          style={{
                            color: isSelected
                              ? colors.stage[stage.key]
                              : colors.text,
                            fontWeight: "700",
                          }}
                        >
                          {stage.label}{" "}
                          <Text
                            style={{
                              color: isSelected
                                ? colors.stage[stage.key]
                                : colors.textMuted,
                              fontWeight: "600",
                            }}
                          >
                            ({countLabel})
                          </Text>
                        </Text>
                      </View>
                    </TouchableRipple>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>

        <InsightSearchField
          activeFilterCount={activeFilterCount}
          colors={colors}
          onChangeText={setSearchInput}
          onOpenFilters={() => setFilterVisible(true)}
          value={filters.searchInput}
        />

        {hasActiveFilters ? (
          <View style={styles.activeFilterSection}>
            <View style={styles.activeFilterMetaRow}>
              <Text variant="labelMedium" style={{ color: colors.textMuted }}>
                {visibleResultLabel}
              </Text>
              <Button
                compact
                mode="text"
                onPress={clearFilters}
                accessibilityLabel="Clear all active filters"
              >
                Clear all
              </Button>
            </View>
            {activeFilterChips.length ? (
              <View style={styles.activeFilterRow}>
                {activeFilterChips.map((filterChip) => (
                  <Chip
                    key={filterChip.key}
                    compact
                    closeIcon="close"
                    onClose={filterChip.onRemove}
                    style={{ backgroundColor: colors.surfaceSecondary }}
                  >
                    {filterChip.label}
                  </Chip>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  const emptySection = (
    <Card
      mode="contained"
      style={[styles.emptyState, { backgroundColor: colors.surface }]}
    >
      <Card.Content style={styles.emptyStateContent}>
        <View
          style={[
            styles.emptyStateBadge,
            { backgroundColor: colors.surfaceSecondary },
          ]}
        >
          <Text variant="labelLarge" style={{ color: colors.textMuted }}>
            {activeStageDefinition.shortLabel}
          </Text>
        </View>
        <Text variant="titleMedium">{emptyStateTitle}</Text>
        <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
          {emptyStateMessage}
        </Text>
        <View style={styles.emptyStateActions}>
          {hasActiveFilters ? (
            <Button mode="contained-tonal" onPress={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button
              mode="contained"
              accessibilityLabel="Add a new insight"
              onPress={() => {
                if (connectionState === "live") {
                  setEditingInsightId("new");
                  return;
                }

                router.push("/setup");
              }}
            >
              Add insight
            </Button>
          )}
          <Button
            mode="text"
            onPress={refreshBoard}
            accessibilityLabel="Refresh the insight board"
          >
            Refresh
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const loadingSection = (
    <View
      accessible
      accessibilityLabel="Loading live insight cards"
      style={styles.loadingState}
    >
      <ActivityIndicator animating color={colors.accentStrong} size="small" />
    </View>
  );

  const contentItems: BoardListItem[] = isBoardLoading
    ? [{ id: "loading", type: "loading" }]
    : viewMode === "overview"
      ? stageDefinitions.map((stage) => ({
          id: `overview-${stage.key}`,
          type: "overview-stage" as const,
          stageKey: stage.key,
        }))
      : currentStageInsights.length
        ? currentStageInsights.map((insight) => ({
            id: insight.id,
            type: "insight" as const,
            insight,
          }))
        : [{ id: "empty", type: "empty" }];

  const listItems: BoardListItem[] = [
    { id: "header", type: "header" },
    { id: "content-spacer", type: "content-spacer" },
    ...contentItems,
  ];

  const renderOverviewStageSection = (stageKey: Insight["stage"]) => {
    const stage = stageDefinitions.find(
      (candidate) => candidate.key === stageKey,
    );
    if (!stage) {
      return null;
    }

    const stageInsights = getInsightsForStage(stage.key);
    const stageCounts = getStageCounts(stage.key);
    const visibleStageCount = hasActiveFilters
      ? stageCounts.filtered
      : stageCounts.total;

    return (
      <Card
        key={stage.key}
        mode="contained"
        style={[styles.overviewSection, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={styles.overviewContent}>
          <TouchableRipple
            borderless
            accessibilityLabel={`Open ${stage.label} stage overview`}
            onPress={() => {
              setSelectedStage(stage.key);
              setViewMode("list");
            }}
            style={styles.overviewHeaderPressable}
          >
            <View style={styles.overviewHeader}>
              <View style={styles.overviewHeaderCopy}>
                <View style={styles.stageLabelRow}>
                  <View
                    style={[
                      styles.overviewStageMark,
                      { backgroundColor: colors.stage[stage.key] },
                    ]}
                  />
                  <Text variant="titleMedium" style={{ color: colors.text }}>
                    {stage.label}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={{ color: colors.textSoft }}
                  >
                    {visibleStageCount}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  {stage.description}
                </Text>
              </View>
              <Text variant="labelLarge" style={{ color: colors.accentStrong }}>
                {stageInsights.length
                  ? visibleStageCount > 3
                    ? `+${Math.max(visibleStageCount - Math.min(stageInsights.length, 3), 0)} more`
                    : "Open"
                  : visibleStageCount > 0
                    ? "Load stage"
                    : "Open"}
              </Text>
            </View>
          </TouchableRipple>
          {stageInsights.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.miniCardRow}
            >
              {stageInsights.slice(0, 3).map((insight) => (
                <Card
                  key={insight.id}
                  mode="contained"
                  onPress={() => openInsight(insight)}
                  accessibilityLabel={`${insight.title}, ${insight.priority}`}
                  accessibilityRole="button"
                  style={[
                    styles.miniCard,
                    { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Card.Content style={styles.miniCardContent}>
                    <View style={styles.miniCardMeta}>
                      <View
                        style={[
                          styles.priorityDot,
                          {
                            backgroundColor: colors.priority[insight.priority],
                          },
                        ]}
                      />
                    </View>
                    <Text numberOfLines={3} variant="titleSmall">
                      {insight.title}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
            </ScrollView>
          ) : (
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              {visibleStageCount > 0
                ? "Insights load when you open this stage."
                : "No insights in this stage right now."}
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderBoardListItem = ({ item }: { item: BoardListItem }) => {
    if (item.type === "header") {
      return headerSection;
    }

    if (item.type === "content-spacer") {
      return <View style={styles.contentTopSpacer} />;
    }

    if (item.type === "empty") {
      return <View style={styles.contentRow}>{emptySection}</View>;
    }

    if (item.type === "loading") {
      return <View style={styles.contentRow}>{loadingSection}</View>;
    }

    if (item.type === "overview-stage") {
      return (
        <View style={styles.contentRow}>
          {renderOverviewStageSection(item.stageKey)}
        </View>
      );
    }

    return (
      <View style={styles.contentRow}>
        {renderInsightCard({ item: item.insight })}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isOnline ? (
        <View
          style={[
            styles.offlineBanner,
            { backgroundColor: colors.warningSoft },
          ]}
          accessibilityRole="alert"
        >
          <MaterialCommunityIcons
            name="wifi-off"
            size={16}
            color={colors.warning}
          />
          <Text variant="labelMedium" style={{ color: colors.warning }}>
            You&apos;re offline — changes will sync when reconnected
          </Text>
        </View>
      ) : null}
      <Reanimated.FlatList
        ref={boardListRef}
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderBoardListItem}
        stickyHeaderIndices={[0]}
        onScroll={boardListScrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshBoard} />
        }
        onEndReached={() => {
          if (
            viewMode !== "list" ||
            !hasMoreInsightsForStage(selectedStage) ||
            isLoadingMoreForStage(selectedStage)
          ) {
            return;
          }

          loadMoreInsightsForStage(selectedStage);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          viewMode === "list" && isLoadingMoreForStage(selectedStage) ? (
            <View style={styles.paginationFooter}>
              <ActivityIndicator
                animating
                color={colors.accentStrong}
                size="small"
              />
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <FAB
        icon="plus"
        label="New insight"
        style={[
          styles.fab,
          {
            backgroundColor: colors.surface,
            bottom: Math.max(insets.bottom - 10, 4),
            elevation: 0,
            shadowOpacity: 0,
          },
        ]}
        color={colors.accentStrong}
        onPress={() => {
          if (connectionState === "live") {
            setEditingInsightId("new");
            return;
          }

          router.push("/setup");
        }}
        accessibilityLabel="Create insight"
      />

      <FilterSheet
        visible={filterVisible}
        onDismiss={() => setFilterVisible(false)}
      />
      <ActivityFeedSheet
        visible={activityVisible}
        onDismiss={() => setActivityVisible(false)}
        onSelectNotification={(insightId) => {
          void ensureInsightLoaded(insightId).then((targetInsight) => {
            if (!targetInsight) {
              return;
            }

            setSelectedStage(targetInsight.stage);
            setViewMode("list");
            setDetailInsightId(insightId);
            setActivityVisible(false);
          });
        }}
      />
      <InsightDetailSheet
        insight={selectedInsight}
        visible={Boolean(selectedInsight)}
        onDismiss={() => setDetailInsightId(null)}
        onEdit={(insight) => {
          setDetailInsightId(null);
          setEditingInsightId(insight.id);
        }}
        onMoveToStage={(insight, stage) =>
          moveInsightToStage(insight.id, stage)
        }
      />
      <InsightFormSheet
        visible={editingInsightId !== null}
        insight={editingInsightId === "new" ? null : editingInsight}
        onDismiss={() => setEditingInsightId(null)}
      />

      <AppDialog
        visible={Boolean(moveToInsight)}
        onDismiss={() => setMoveToInsightId(null)}
        title="Move to stage"
        actions={
          <View style={styles.dialogActions}>
            <Button onPress={() => setMoveToInsightId(null)}>Cancel</Button>
          </View>
        }
      >
        <View style={styles.dialogContent}>
          <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
            Choose a stage for &quot;{moveToInsight?.title}&quot;
          </Text>
          <View style={styles.moveToStageRow}>
            {stageDefinitions.map((stage) => (
              <Chip
                key={stage.key}
                selected={moveToInsight?.stage === stage.key}
                accessibilityLabel={`Move to ${stage.label}${moveToInsight?.stage === stage.key ? ", current stage" : ""}`}
                onPress={() => {
                  if (moveToInsight && moveToInsight.stage !== stage.key) {
                    moveInsightToStage(moveToInsight.id, stage.key);
                  }
                  setMoveToInsightId(null);
                }}
                style={styles.moveToChip}
              >
                {stage.label}
              </Chip>
            ))}
          </View>
        </View>
      </AppDialog>

      <AppDialog
        visible={Boolean(editingConflictInsight)}
        onDismiss={() => setEditingConflictInsightId(null)}
        title="Another rep is editing"
        actions={
          <View style={styles.dialogActions}>
            <Button
              onPress={() => {
                if (editingConflictInsight) {
                  setDetailInsightId(editingConflictInsight.id);
                }
                setEditingConflictInsightId(null);
              }}
            >
              View only
            </Button>
            <Button
              onPress={() => {
                if (editingConflictInsight) {
                  setEditingInsightId(editingConflictInsight.id);
                }
                setEditingConflictInsightId(null);
              }}
            >
              Edit anyway
            </Button>
          </View>
        }
      >
        <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
          {teamUsers
            .find((user) => user.id === editingConflictInsight?.editingUserId)
            ?.fullName.split(" ")[0] ?? "A teammate"}{" "}
          is currently editing this card.
        </Text>
      </AppDialog>

      <Snackbar
        visible={Boolean(feedbackMessage)}
        onDismiss={dismissFeedback}
        duration={2400}
      >
        {feedbackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBanner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listContent: {
    paddingTop: 0,
  },
  contentRow: {
    paddingHorizontal: 14,
  },
  contentTopSpacer: {
    height: 8,
  },
  heroSection: {
    gap: 6,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  heroPresenceSummary: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
  },
  titleCopy: {
    flex: 1,
    gap: 0,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    margin: 0,
  },
  bellWrap: {
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    right: 2,
    top: 6,
  },
  presenceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  presenceAvatar: {
    borderWidth: 2,
  },
  presenceOverflowChip: {
    marginLeft: 6,
  },
  stickyTabsShell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 0,
  },
  viewModeCollapseWrap: {
    overflow: "hidden",
  },
  viewModeTabs: {
    borderRadius: 20,
    flexDirection: "row",
    overflow: "hidden",
    padding: 4,
    position: "relative",
  },
  viewModeIndicator: {
    borderRadius: 16,
    bottom: 4,
    left: 4,
    position: "absolute",
    top: 4,
  },
  viewModeButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    zIndex: 1,
  },
  viewModeButtonInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  pipelineSection: {
    marginBottom: 14,
    paddingTop: 2,
  },
  pipelineScrollContent: {
    paddingRight: 14,
  },
  pipelineTrackShell: {
    alignSelf: "flex-start",
    paddingHorizontal: 4,
    position: "relative",
  },
  pipelineTrack: {
    height: 2,
    left: 18,
    position: "absolute",
    right: 18,
    top: 21,
  },
  pipelineRow: {
    flexDirection: "row",
    gap: 8,
  },
  pipelineStepPressable: {
    borderRadius: 12,
  },
  pipelineStepChip: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pipelineStepDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  searchbar: {
    borderRadius: 18,
    flex: 1,
    height: 56,
  },
  filterButtonWrap: {
    position: "relative",
  },
  filterIconButton: {
    borderRadius: 18,
    height: 56,
    width: 56,
  },
  filterIconInner: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    right: 6,
    top: 6,
  },
  activeFilterSection: {
    gap: 10,
    marginTop: 14,
  },
  activeFilterMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  activeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emptyState: {
    borderRadius: 18,
    marginBottom: 8,
    overflow: "hidden",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  paginationFooter: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 18,
    paddingTop: 10,
  },
  emptyStateContent: {
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  emptyStateBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  emptyStateActions: {
    flexDirection: "row",
    gap: 10,
  },
  fab: {
    borderRadius: 18,
    position: "absolute",
    right: 16,
  },
  overviewContainer: {
    gap: 18,
    paddingBottom: 96,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  overviewSection: {
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
  },
  overviewContent: {
    gap: 16,
  },
  overviewHeaderPressable: {
    borderRadius: 8,
  },
  overviewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  overviewHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  stageLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  overviewStageMark: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  miniCardRow: {
    flexDirection: "row",
    gap: 12,
  },
  miniCard: {
    borderRadius: 16,
    minHeight: 116,
    overflow: "hidden",
    width: 184,
  },
  miniCardContent: {
    gap: 12,
  },
  miniCardMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  priorityDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  moveToStageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  moveToChip: {
    marginBottom: 4,
  },
  dialogContent: {
    gap: 12,
  },
  dialogActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
});
