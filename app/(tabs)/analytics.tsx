import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Text,
} from "react-native-paper";

import { AppScreen } from "@/components/app-screen";
import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { LazySection } from "@/components/ui/lazy-section";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  analyticsRanges,
  priorityDefinitions,
  type AnalyticsRange,
} from "@/lib/insight-board-schema";
import { stageOrder } from "@/lib/insight-utils";
import {
  fetchInsightAnalytics,
  fetchInsightsForAnalyticsExport,
  type InsightAnalyticsSummary,
} from "@/lib/services/insight-board-analytics";
import { getDrugEventSummary } from "@/lib/services/openfda";
import { exportInsightBoardReport } from "@/lib/services/report-export";

function formatPercent(count: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((count / total) * 100)}%`;
}

function formatAveragePipelineTime(days: number, impactCount: number) {
  if (!impactCount) {
    return "N/A";
  }

  if (days < 1) {
    return "<1d";
  }

  return `${days.toFixed(1)}d`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const {
    categories,
    connectionState,
    currentUser,
    hcps,
    stageDefinitions,
    totalInsightCount,
  } = useInsightBoard();
  const [selectedRange, setSelectedRange] = useState<AnalyticsRange>("30d");
  const [trendMode, setTrendMode] = useState<"created" | "resolved">("created");
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<InsightAnalyticsSummary | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const viewportHeight = Dimensions.get("window").height;

  // useCallback: scroll handler fires frequently (16ms throttle);
  // memoize to avoid re-creating the handler on every render
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      setScrollY(event.nativeEvent.contentOffset.y);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    if (connectionState !== "live") {
      return;
    }

    setIsRefreshing(true);
    setRefreshVersion((currentVersion) => currentVersion + 1);
  }, [connectionState]);

  useEffect(() => {
    if (connectionState !== "live") {
      setAnalyticsSummary(null);
      setAnalyticsError(null);
      setIsAnalyticsLoading(false);
      setIsRefreshing(false);
      return;
    }

    let isCancelled = false;

    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    void fetchInsightAnalytics(selectedRange)
      .then((summary) => {
        if (!isCancelled) {
          setAnalyticsSummary(summary);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setAnalyticsError(
            error instanceof Error
              ? error.message
              : "Unable to load analytics.",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsAnalyticsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [connectionState, refreshVersion, selectedRange]);

  const totalInsights = analyticsSummary?.totalInsights ?? 0;
  const previousInsights = analyticsSummary?.previousInsights ?? 0;
  const totalDelta = totalInsights - previousInsights;
  const deltaLabel = `${totalDelta >= 0 ? "+" : ""}${totalDelta} vs previous ${selectedRange}`;
  const hasNoInsightsAtAll =
    connectionState === "live" &&
    !isAnalyticsLoading &&
    !analyticsError &&
    totalInsightCount === 0;
  const hasNoAnalyticsDataInRange =
    connectionState === "live" &&
    !isAnalyticsLoading &&
    !analyticsError &&
    totalInsightCount > 0 &&
    totalInsights === 0;
  const selectedRangeLabel =
    analyticsRanges.find((range) => range.value === selectedRange)?.label ??
    selectedRange;

  const stageCounts = useMemo(
    () =>
      stageDefinitions.map((stage) => ({
        label: stage.label,
        count: analyticsSummary?.stageCounts[stage.key] ?? 0,
      })),
    [analyticsSummary, stageDefinitions],
  );
  const totalStageCount = stageCounts.reduce((sum, row) => sum + row.count, 0);
  const maxStageCount = Math.max(...stageCounts.map((row) => row.count), 1);
  const averagePipelineDays = analyticsSummary?.averagePipelineDays ?? 0;

  const hcpCounts = (analyticsSummary?.hcpCounts ?? []).map((item) => ({
    hcp: hcps.find((hcp) => hcp.id === item.id) ?? {
      id: item.id,
      institution: "",
      name: item.name,
      region: "",
      specialty: "",
    },
    count: item.count,
  }));
  const mostActiveHcp = [...hcpCounts].sort(
    (left, right) => right.count - left.count,
  )[0];
  const categoryCounts = (analyticsSummary?.categoryCounts ?? [])
    .map((item) => ({
      category: categories.find((category) => category.id === item.id) ?? {
        color: colors.accent,
        id: item.id,
        name: item.name,
      },
      count: item.count,
    }))
    .sort((left, right) => right.count - left.count);
  const activeCategoryCounts = categoryCounts.filter((item) => item.count > 0);
  const visibleCategoryCounts = activeCategoryCounts.slice(0, 5);

  const summaryWeeklyBuckets =
    analyticsSummary?.weeklyBuckets ??
    Array.from({ length: 8 }, (_, index) => ({
      createdCount: 0,
      label: `W${index + 1}`,
      resolvedCount: 0,
    }));
  const weeklyBuckets = summaryWeeklyBuckets.map((bucket) => ({
    label: bucket.label,
    count: trendMode === "created" ? bucket.createdCount : bucket.resolvedCount,
  }));

  const maxWeeklyCount = Math.max(
    ...weeklyBuckets.map((bucket) => bucket.count),
    1,
  );
  const maxCategoryCount = Math.max(
    ...activeCategoryCounts.map((item) => item.count),
    1,
  );
  const leaderboardRows = [...hcpCounts]
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const maxLeaderboardCount = Math.max(
    ...leaderboardRows.map((item) => item.count),
    1,
  );

  const heatmap = priorityDefinitions.map((priority) => ({
    priority: priority.key,
    cells:
      analyticsSummary?.heatmap.find((row) => row.priority === priority.key)
        ?.cells ?? stageOrder.map(() => 0),
  }));
  const maxHeat = Math.max(...heatmap.flatMap((row) => row.cells), 1);
  const peakWeeklyBucket = weeklyBuckets.reduce(
    (peak, bucket) => (bucket.count > peak.count ? bucket : peak),
    weeklyBuckets[0],
  );
  const averageWeeklyCount =
    weeklyBuckets.reduce((sum, bucket) => sum + bucket.count, 0) /
    weeklyBuckets.length;

  const stageRows = stageCounts.map((row, index) => ({
    label: row.label,
    count: row.count,
    conversion:
      index === 0 || stageCounts[index - 1].count === 0
        ? "100%"
        : `${Math.round((row.count / stageCounts[index - 1].count) * 100)}%`,
    relativeWidth: maxStageCount ? (row.count / maxStageCount) * 100 : 0,
  }));

  const exportReport = async () => {
    if (connectionState !== "live") {
      return;
    }

    try {
      setIsExporting(true);

      const rangedInsights =
        await fetchInsightsForAnalyticsExport(selectedRange);

      const uniqueDrugNames = Array.from(
        new Set(
          rangedInsights
            .filter((insight) => insight.drugName)
            .map((insight) => insight.drugName),
        ),
      );
      const drugAppendix = await Promise.all(
        uniqueDrugNames.map(async (drugName) => {
          const summary = await getDrugEventSummary(drugName).catch(() => null);

          return {
            drugName,
            reactions:
              summary?.reactions
                .slice(0, 3)
                .map((reaction) => `${reaction.label}: ${reaction.count}`) ??
              [],
          };
        }),
      );

      await exportInsightBoardReport({
        generatedFor: currentUser.fullName,
        rangeLabel:
          analyticsRanges.find((range) => range.value === selectedRange)
            ?.label ?? selectedRange,
        totalInsights,
        deltaLabel,
        averagePipelineDays,
        mostActiveHcp: mostActiveHcp
          ? `${mostActiveHcp.hcp.name} (${mostActiveHcp.count})`
          : "None",
        stageRows,
        insights: rangedInsights,
        categoryLookup: Object.fromEntries(
          categories.map((category) => [category.id, category.name]),
        ),
        hcpLookup: Object.fromEntries(hcps.map((hcp) => [hcp.id, hcp])),
        drugAppendix,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppScreen
      onScroll={handleScroll}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <Card
        mode="contained"
        style={[styles.heroCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={styles.heroContent}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text variant="headlineSmall" style={{ color: colors.text }}>
                Analytics
              </Text>
            </View>
            <Button
              mode="contained-tonal"
              icon={isExporting ? undefined : "file-export-outline"}
              onPress={exportReport}
              disabled={isExporting || connectionState !== "live"}
              loading={isExporting}
              accessibilityLabel={
                isExporting
                  ? "Exporting analytics report"
                  : "Export analytics report"
              }
              accessibilityHint="Generates and shares a PDF summary for the selected analytics range."
            >
              {isExporting
                ? "Exporting..."
                : connectionState === "live"
                  ? "Export report"
                  : "Live board required"}
            </Button>
          </View>

          <View style={styles.heroMetaRow}>
            <Chip compact style={{ backgroundColor: colors.surfaceSecondary }}>
              {selectedRangeLabel}
            </Chip>
            <Chip
              compact
              style={{
                backgroundColor:
                  connectionState === "live"
                    ? colors.stageSurface.impact
                    : colors.surfaceSecondary,
              }}
            >
              {connectionState === "live"
                ? isAnalyticsLoading
                  ? "Loading analytics"
                  : analyticsError
                    ? "Analytics issue"
                    : "Live analytics"
                : "Preview state"}
            </Chip>
            <Chip compact style={{ backgroundColor: colors.surfaceSecondary }}>
              {currentUser.fullName}
            </Chip>
          </View>

          <View
            style={[
              styles.rangeTray,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <View style={styles.rangeRow}>
              {analyticsRanges.map((range) => (
                <Chip
                  key={range.value}
                  selected={selectedRange === range.value}
                  onPress={() => setSelectedRange(range.value)}
                  accessibilityLabel={`${range.label} analytics range${selectedRange === range.value ? ", selected" : ""}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: selectedRange === range.value,
                  }}
                  style={{
                    backgroundColor:
                      selectedRange === range.value
                        ? colors.stageSurface.insight
                        : colors.surface,
                  }}
                >
                  {range.label}
                </Chip>
              ))}
            </View>
          </View>

          {analyticsError ? (
            <Text variant="bodySmall" style={{ color: colors.textMuted }}>
              {analyticsError}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {isAnalyticsLoading ? (
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <View style={styles.loadingAnalyticsState}>
              <ActivityIndicator animating size="small" />
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Loading analytics summary...
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {hasNoInsightsAtAll || hasNoAnalyticsDataInRange ? (
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              {hasNoInsightsAtAll
                ? "No insights available yet"
                : `No insights found in ${selectedRangeLabel}`}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              {hasNoInsightsAtAll
                ? "Add or sync insights first, then refresh analytics."
                : "The board has insights, but none were created inside the selected time window. Try a wider range."}
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.kpiGrid}>
        <KpiCard
          label="Total insights"
          value={String(totalInsights)}
          detail={deltaLabel}
          tone="accent"
        />
        <KpiCard
          label="Avg. pipeline time"
          value={formatAveragePipelineTime(
            averagePipelineDays,
            analyticsSummary?.stageCounts.impact ?? 0,
          )}
          detail="Observation to impact"
          tone="warning"
        />
        <KpiCard
          label="Stage mix"
          value={`${stageCounts.reduce((sum, row) => sum + row.count, 0)}`}
          detail={stageCounts
            .map((row) => `${row.label}: ${row.count}`)
            .join(" · ")}
          tone="neutral"
        />
        <KpiCard
          label="Most active HCP"
          value={mostActiveHcp?.hcp.name ?? "None"}
          detail={`${mostActiveHcp?.count ?? 0} linked insights`}
          tone="success"
        />
      </View>

      <Card
        mode="contained"
        style={[styles.chartCard, { backgroundColor: colors.surface }]}
      >
        <Card.Content style={styles.chartContent}>
          <View style={styles.chartTopRow}>
            <View style={styles.chartTitleBlock}>
              <Text variant="titleLarge" style={{ color: colors.text }}>
                Pipeline funnel
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Stage retention across {selectedRangeLabel.toLowerCase()}.
              </Text>
            </View>
            <Chip compact style={{ backgroundColor: colors.surfaceSecondary }}>
              {totalStageCount} tracked
            </Chip>
          </View>

          <View
            style={[
              styles.chartPanel,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            {stageRows.map((row, index) => (
              <View key={row.label} style={styles.funnelRow}>
                <View style={styles.rowLabelBlock}>
                  <View style={styles.rowLabelHeader}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.stage[stageOrder[index]] },
                      ]}
                    />
                    <Text variant="titleSmall" style={{ color: colors.text }}>
                      {row.label}
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                    {formatPercent(row.count, totalStageCount)} of in-range
                    volume
                  </Text>
                </View>
                <View style={styles.rowTrackBlock}>
                  <View
                    style={[
                      styles.barTrack,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: colors.stage[stageOrder[index]],
                          width: `${row.relativeWidth}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.metricBlock}>
                  <Text variant="titleSmall" style={{ color: colors.text }}>
                    {row.count}
                  </Text>
                  <Text variant="labelSmall" style={{ color: colors.textSoft }}>
                    {row.conversion}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <LazySection viewportHeight={viewportHeight} scrollY={scrollY}>
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <View style={styles.chartTopRow}>
              <View style={styles.chartTitleBlock}>
                <Text variant="titleLarge" style={{ color: colors.text }}>
                  Insights over time
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  Weekly {trendMode} volume across the selected range.
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                Peak {peakWeeklyBucket.label}: {peakWeeklyBucket.count}
              </Chip>
            </View>

            <SegmentedButtons
              value={trendMode}
              onValueChange={(value) =>
                setTrendMode(value as "created" | "resolved")
              }
              buttons={[
                {
                  value: "created",
                  label: "Created",
                  accessibilityLabel: "Show created insights trend",
                },
                {
                  value: "resolved",
                  label: "Resolved",
                  accessibilityLabel: "Show resolved insights trend",
                },
              ]}
            />

            <View
              style={[
                styles.chartPanel,
                styles.weeklyPanel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <View style={styles.chartMetaRow}>
                <View
                  style={[styles.metaPill, { backgroundColor: colors.surface }]}
                >
                  <Text variant="labelSmall" style={{ color: colors.textSoft }}>
                    Avg / week
                  </Text>
                  <Text variant="titleSmall" style={{ color: colors.text }}>
                    {averageWeeklyCount.toFixed(1)}
                  </Text>
                </View>
                <View
                  style={[styles.metaPill, { backgroundColor: colors.surface }]}
                >
                  <Text variant="labelSmall" style={{ color: colors.textSoft }}>
                    Mode
                  </Text>
                  <Text variant="titleSmall" style={{ color: colors.text }}>
                    {trendMode}
                  </Text>
                </View>
              </View>

              <View style={styles.weeklyRow}>
                {weeklyBuckets.map((bucket) => (
                  <View key={bucket.label} style={styles.weeklyColumn}>
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textSoft }}
                    >
                      {bucket.count}
                    </Text>
                    <View
                      style={[
                        styles.weeklyBarTrack,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <View
                        style={[
                          styles.weeklyBarFill,
                          {
                            backgroundColor:
                              trendMode === "created"
                                ? colors.accent
                                : colors.success,
                            height:
                              bucket.count === 0
                                ? 8
                                : `${Math.max((bucket.count / maxWeeklyCount) * 100, 14)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textMuted }}
                    >
                      {bucket.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>
      </LazySection>

      <LazySection viewportHeight={viewportHeight} scrollY={scrollY}>
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <View style={styles.chartTopRow}>
              <View style={styles.chartTitleBlock}>
                <Text variant="titleLarge" style={{ color: colors.text }}>
                  Category distribution
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  Where field volume is clustering by topic.
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                {activeCategoryCounts.length} active
              </Chip>
            </View>

            <View
              style={[
                styles.chartPanel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              {visibleCategoryCounts.length ? (
                visibleCategoryCounts.map((item) => (
                  <View key={item.category.id} style={styles.distributionRow}>
                    <View style={styles.distributionHeaderRow}>
                      <View style={styles.rowLabelHeader}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: item.category.color },
                          ]}
                        />
                        <Text
                          variant="titleSmall"
                          style={{ color: colors.text }}
                        >
                          {item.category.name}
                        </Text>
                      </View>
                      <Chip compact style={{ backgroundColor: colors.surface }}>
                        {item.count}
                      </Chip>
                    </View>
                    <View
                      style={[
                        styles.barTrack,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <View
                        style={[
                          styles.barFill,
                          {
                            backgroundColor: item.category.color,
                            width: `${(item.count / maxCategoryCount) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSoft }}
                    >
                      {formatPercent(item.count, totalStageCount)} of total
                      volume
                    </Text>
                  </View>
                ))
              ) : (
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  No category activity for this range yet.
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>
      </LazySection>

      <LazySection viewportHeight={viewportHeight} scrollY={scrollY}>
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <View style={styles.chartTopRow}>
              <View style={styles.chartTitleBlock}>
                <Text variant="titleLarge" style={{ color: colors.text }}>
                  Priority heatmap
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  See where urgent signals are concentrating by stage.
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                Peak cell {maxHeat}
              </Chip>
            </View>

            <View
              style={[
                styles.chartPanel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <View style={styles.heatLegendRow}>
                <Text variant="labelSmall" style={{ color: colors.textSoft }}>
                  Low
                </Text>
                <View style={styles.heatLegendScale}>
                  {[0.2, 0.4, 0.6, 0.8].map((opacity, index) => (
                    <View
                      key={index}
                      style={[
                        styles.heatLegendCell,
                        {
                          backgroundColor: colors.accent,
                          opacity,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text variant="labelSmall" style={{ color: colors.textSoft }}>
                  High
                </Text>
              </View>

              <View style={styles.heatTable}>
                <View style={styles.heatHeaderRow}>
                  <View style={styles.heatAxisCell}>
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textSoft }}
                    >
                      Pri
                    </Text>
                  </View>
                  {stageDefinitions.map((stage) => (
                    <View key={stage.key} style={styles.heatHeaderCellWrap}>
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.heatHeaderCell,
                          { color: colors.textMuted },
                        ]}
                      >
                        {stage.shortLabel}
                      </Text>
                    </View>
                  ))}
                </View>
                {heatmap.map((row) => (
                  <View key={row.priority} style={styles.heatRow}>
                    <View
                      style={[
                        styles.heatPriorityPill,
                        {
                          backgroundColor: colors.prioritySurface[row.priority],
                        },
                      ]}
                    >
                      <Text
                        variant="labelMedium"
                        style={{ color: colors.priorityText[row.priority] }}
                      >
                        {row.priority}
                      </Text>
                    </View>
                    {row.cells.map((count, index) => {
                      const opacity =
                        count === 0 ? 0.12 : Math.max(count / maxHeat, 0.24);
                      const textColor =
                        colorScheme === "dark" || opacity > 0.48
                          ? colors.textInverse
                          : colors.text;

                      return (
                        <View
                          key={`${row.priority}-${stageOrder[index]}`}
                          style={styles.heatCellWrap}
                        >
                          <View
                            style={[
                              styles.heatCell,
                              {
                                backgroundColor:
                                  colors.stage[stageOrder[index]],
                                opacity,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.heatCellText,
                                { color: textColor },
                              ]}
                            >
                              {count}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>
      </LazySection>

      <LazySection viewportHeight={viewportHeight} scrollY={scrollY}>
        <Card
          mode="contained"
          style={[styles.chartCard, { backgroundColor: colors.surface }]}
        >
          <Card.Content style={styles.chartContent}>
            <View style={styles.chartTopRow}>
              <View style={styles.chartTitleBlock}>
                <Text variant="titleLarge" style={{ color: colors.text }}>
                  HCP leaderboard
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  Top healthcare professionals linked to insight activity.
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                {leaderboardRows.length} ranked
              </Chip>
            </View>

            <View
              style={[
                styles.chartPanel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              {leaderboardRows.length ? (
                leaderboardRows.map((item, index) => (
                  <View key={item.hcp.id} style={styles.leaderboardRow}>
                    <Avatar.Text
                      size={40}
                      label={getInitials(item.hcp.name)}
                      style={{
                        backgroundColor:
                          index === 0 ? colors.surfaceTertiary : colors.surface,
                      }}
                      labelStyle={{ color: colors.text, fontSize: 13 }}
                    />
                    <View style={styles.leaderboardCopy}>
                      <View style={styles.leaderboardTitleRow}>
                        <Text
                          variant="titleSmall"
                          style={{ color: colors.text }}
                        >
                          {item.hcp.name}
                        </Text>
                        <Text
                          variant="labelSmall"
                          style={{ color: colors.textSoft }}
                        >
                          #{index + 1}
                        </Text>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={{ color: colors.textMuted }}
                      >
                        {item.hcp.specialty}
                      </Text>
                      <View
                        style={[
                          styles.barTrack,
                          { backgroundColor: colors.surface },
                        ]}
                      >
                        <View
                          style={[
                            styles.barFill,
                            {
                              backgroundColor: colors.accentStrong,
                              width: `${(item.count / maxLeaderboardCount) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Chip
                      compact
                      style={{
                        backgroundColor:
                          index === 0 ? colors.surfaceTertiary : colors.surface,
                      }}
                    >
                      {item.count}
                    </Chip>
                  </View>
                ))
              ) : (
                <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                  No HCP activity for this range yet.
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>
      </LazySection>
    </AppScreen>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "accent" | "neutral" | "warning" | "success";
}) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const toneStyles = {
    accent: {
      backgroundColor: colors.stageSurface.insight,
      borderColor: colors.accentSoft,
      accentColor: colors.stage.insight,
      valueColor: colors.accentStrong,
    },
    neutral: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.borderMuted,
      accentColor: colors.stage.observation,
      valueColor: colors.text,
    },
    warning: {
      backgroundColor: colors.stageSurface.actionable,
      borderColor: colors.warningSoft,
      accentColor: colors.stage.actionable,
      valueColor: colors.warning,
    },
    success: {
      backgroundColor: colors.stageSurface.impact,
      borderColor: colors.successSoft,
      accentColor: colors.stage.impact,
      valueColor: colors.success,
    },
  }[tone];

  return (
    <Card
      mode="contained"
      style={[
        styles.kpiCard,
        {
          backgroundColor: toneStyles.backgroundColor,
        },
      ]}
    >
      <Card.Content style={{ gap: 8 }}>
        <View
          style={[
            styles.kpiAccent,
            { backgroundColor: toneStyles.accentColor },
          ]}
        />
        <Text variant="labelLarge" style={{ color: colors.textMuted }}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={{ color: toneStyles.valueColor }}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
          {detail}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 22,
    overflow: "hidden",
  },
  heroContent: {
    gap: 18,
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  titleCopy: {
    flex: 1,
    gap: 6,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rangeTray: {
    borderRadius: 18,
    padding: 8,
  },
  rangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    borderRadius: 18,
    minHeight: 122,
    overflow: "hidden",
    width: "48%",
  },
  kpiAccent: {
    borderRadius: 999,
    height: 4,
    width: 36,
  },
  chartCard: {
    borderRadius: 22,
    overflow: "hidden",
  },
  chartContent: {
    gap: 16,
  },
  loadingAnalyticsState: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 96,
  },
  chartTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  chartTitleBlock: {
    flex: 1,
    gap: 4,
  },
  chartPanel: {
    borderRadius: 16,
    gap: 14,
    padding: 16,
  },
  chartMetaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaPill: {
    borderRadius: 16,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  funnelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  rowLabelBlock: {
    gap: 4,
    width: 132,
  },
  rowLabelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  rowTrackBlock: {
    flex: 1,
  },
  metricBlock: {
    alignItems: "flex-end",
    width: 44,
  },
  legendDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  barTrack: {
    borderRadius: 10,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  barFill: {
    borderRadius: 10,
    height: "100%",
  },
  weeklyPanel: {
    gap: 16,
  },
  weeklyRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  weeklyColumn: {
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  weeklyBarTrack: {
    alignSelf: "center",
    borderRadius: 10,
    height: 132,
    justifyContent: "flex-end",
    maxWidth: 26,
    overflow: "hidden",
    width: "100%",
  },
  weeklyBarFill: {
    borderRadius: 10,
    width: "100%",
  },
  distributionRow: {
    gap: 8,
  },
  distributionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heatLegendRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heatLegendScale: {
    flexDirection: "row",
    gap: 4,
  },
  heatLegendCell: {
    borderRadius: 8,
    height: 12,
    width: 18,
  },
  heatTable: {
    gap: 8,
  },
  heatHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  heatAxisCell: {
    alignItems: "flex-start",
    justifyContent: "center",
    width: 44,
  },
  heatHeaderCellWrap: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  heatHeaderCell: {
    textAlign: "center",
  },
  heatRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  heatPriorityPill: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 40,
    width: 44,
  },
  heatCellWrap: {
    flex: 1,
    minWidth: 0,
  },
  heatCell: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 40,
  },
  heatCellText: {
    fontWeight: "700",
  },
  leaderboardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  leaderboardCopy: {
    flex: 1,
    gap: 6,
  },
  leaderboardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exportingRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
