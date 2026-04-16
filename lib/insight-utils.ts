import {
    type AnalyticsRange,
    type Hcp,
    type Insight,
    type InsightFilters,
    type InsightPriority,
    type InsightStage,
    stageDefinitions,
} from "@/lib/insight-board-schema";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const stageOrder = stageDefinitions.map((item) => item.key);

export function getStageLabel(stage: InsightStage) {
  return stageDefinitions.find((item) => item.key === stage)?.label ?? stage;
}

export function getNextStage(stage: InsightStage) {
  const index = stageOrder.indexOf(stage);
  if (index === -1 || index === stageOrder.length - 1) {
    return null;
  }

  return stageOrder[index + 1];
}

export function getPreviousStage(stage: InsightStage) {
  const index = stageOrder.indexOf(stage);
  if (index <= 0) {
    return null;
  }

  return stageOrder[index - 1];
}

export function getRelativeTimeLabel(dateValue: string) {
  const timestamp = new Date(dateValue).getTime();
  const now = Date.now();
  const diff = Math.max(now - timestamp, 0);
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / DAY_IN_MS);

  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isWithinDateRange(
  dateValue: string,
  range: AnalyticsRange | null,
) {
  if (!range) {
    return true;
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * DAY_IN_MS;
  return new Date(dateValue).getTime() >= cutoff;
}

export function matchesInsightFilters(
  insight: Insight,
  filters: InsightFilters,
  hcpList: Hcp[],
) {
  const normalizedSearch = filters.search.toLowerCase().trim();
  const hcp = hcpList.find((item) => item.id === insight.hcpId) ?? null;

  const matchesSearch =
    normalizedSearch.length === 0 ||
    insight.title.toLowerCase().includes(normalizedSearch) ||
    insight.description.toLowerCase().includes(normalizedSearch) ||
    hcp?.name.toLowerCase().includes(normalizedSearch) ||
    insight.drugName.toLowerCase().includes(normalizedSearch);

  const matchesPriority =
    filters.priorities.length === 0 ||
    filters.priorities.includes(insight.priority);

  const matchesCategory =
    filters.categoryId === null || filters.categoryId === insight.categoryId;

  const matchesHcp = filters.hcpId === null || filters.hcpId === insight.hcpId;

  const matchesTags =
    filters.tagIds.length === 0 ||
    filters.tagIds.every((tagId) => insight.tagIds.includes(tagId));

  return (
    matchesSearch &&
    matchesPriority &&
    matchesCategory &&
    matchesHcp &&
    matchesTags &&
    isWithinDateRange(insight.createdAt, filters.dateRange)
  );
}

export function sortInsightsForStage(insights: Insight[]) {
  return [...insights].sort((left, right) => {
    if (left.columnOrder !== right.columnOrder) {
      return left.columnOrder - right.columnOrder;
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

export function prioritySortWeight(priority: InsightPriority) {
  return { P1: 4, P2: 3, P3: 2, P4: 1 }[priority];
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
