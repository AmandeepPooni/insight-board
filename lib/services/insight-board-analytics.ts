import {
    type AnalyticsRange,
    type Insight,
    type InsightPriority,
    type InsightStage,
} from "@/lib/insight-board-schema";
import { supabase } from "@/lib/services/supabase";

type AnalyticsWeeklyBucket = {
  createdCount: number;
  label: string;
  resolvedCount: number;
};

type AnalyticsWeeklyBucketValue = {
  created_count?: number | string | null;
  createdCount?: number | string | null;
  label?: string | null;
  resolved_count?: number | string | null;
  resolvedCount?: number | string | null;
};

type AnalyticsHeatmapRow = {
  cells: number[];
  priority: InsightPriority;
};

type AnalyticsHeatmapRowValue = {
  cells?: number[] | string | null;
  priority?: InsightPriority | string | null;
};

type AnalyticsNamedCount = {
  count: number;
  id: string;
  name: string;
};

type AnalyticsNamedCountValue = {
  count?: number | string | null;
  id?: string | null;
  name?: string | null;
};

type AnalyticsPayload = {
  average_pipeline_days?: number | string | null;
  averagePipelineDays?: number | string | null;
  category_counts?: AnalyticsNamedCountValue[] | string | null;
  categoryCounts?: AnalyticsNamedCountValue[] | string | null;
  get_insight_analytics?: AnalyticsPayload | AnalyticsPayload[] | string | null;
  hcp_counts?: AnalyticsNamedCountValue[] | string | null;
  hcpCounts?: AnalyticsNamedCountValue[] | string | null;
  heatmap?: AnalyticsHeatmapRowValue[] | string | null;
  previous_insights?: number | string | null;
  previousInsights?: number | string | null;
  stage_counts?: Partial<Record<InsightStage, number>> | string | null;
  stageCounts?: Partial<Record<InsightStage, number>> | string | null;
  total_insights?: number | string | null;
  totalInsights?: number | string | null;
  weekly_buckets?: AnalyticsWeeklyBucketValue[] | string | null;
  weeklyBuckets?: AnalyticsWeeklyBucketValue[] | string | null;
};

type AnalyticsExportRow = {
  category_id: string | null;
  created_at: string;
  description: string | null;
  drug_name: string | null;
  hcp_id: string | null;
  id: string;
  priority: Insight["priority"];
  stage: InsightStage;
  title: string;
  updated_at: string;
};

type AnalyticsImpactRow = {
  id: string;
  created_at: string;
  updated_at: string;
};

type AnalyticsImpactActivityRow = {
  created_at: string;
  insight_id: string;
};

type AnalyticsReferenceRow = {
  id: string;
  name: string;
};

type InsightCountFilters = {
  categoryId?: string;
  createdAtGte?: string;
  createdAtLt?: string;
  hcpId?: string;
  priority?: InsightPriority;
  stage?: InsightStage;
  updatedAtGte?: string;
  updatedAtLt?: string;
};

export type InsightAnalyticsSummary = {
  averagePipelineDays: number;
  categoryCounts: AnalyticsNamedCount[];
  hcpCounts: AnalyticsNamedCount[];
  heatmap: AnalyticsHeatmapRow[];
  previousInsights: number;
  stageCounts: Record<InsightStage, number>;
  totalInsights: number;
  weeklyBuckets: AnalyticsWeeklyBucket[];
};

const ANALYTICS_STAGES: InsightStage[] = [
  "observation",
  "insight",
  "actionable",
  "impact",
];
const ANALYTICS_PRIORITIES: InsightPriority[] = ["P1", "P2", "P3", "P4"];
const ANALYTICS_PAGE_SIZE = 500;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEKLY_BUCKET_COUNT = 8;

function getRangeDays(range: AnalyticsRange) {
  if (range === "7d") {
    return 7;
  }

  if (range === "30d") {
    return 30;
  }

  return 90;
}

function createEmptyStageCounts() {
  return {
    observation: 0,
    insight: 0,
    actionable: 0,
    impact: 0,
  } satisfies Record<InsightStage, number>;
}

function getRangeCutoff(range: AnalyticsRange, now = new Date()) {
  return new Date(
    now.getTime() - getRangeDays(range) * DAY_IN_MS,
  ).toISOString();
}

function getPreviousRangeCutoff(range: AnalyticsRange, now = new Date()) {
  return new Date(
    now.getTime() - getRangeDays(range) * 2 * DAY_IN_MS,
  ).toISOString();
}

function createEmptyAnalyticsSummary(): InsightAnalyticsSummary {
  return {
    averagePipelineDays: 0,
    categoryCounts: [],
    hcpCounts: [],
    heatmap: [],
    previousInsights: 0,
    stageCounts: createEmptyStageCounts(),
    totalInsights: 0,
    weeklyBuckets: [],
  };
}

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown) {
  const normalizedValue = parseJsonValue(value);

  if (
    !normalizedValue ||
    typeof normalizedValue !== "object" ||
    Array.isArray(normalizedValue)
  ) {
    return null;
  }

  return normalizedValue as Record<string, unknown>;
}

function readNumber(value: unknown) {
  const normalizedValue = parseJsonValue(value);

  if (typeof normalizedValue === "number" && Number.isFinite(normalizedValue)) {
    return normalizedValue;
  }

  if (typeof normalizedValue === "string" && normalizedValue.trim()) {
    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function readString(value: unknown, fallback = "") {
  const normalizedValue = parseJsonValue(value);
  return typeof normalizedValue === "string" ? normalizedValue : fallback;
}

function unwrapAnalyticsPayload(value: unknown): AnalyticsPayload {
  const normalizedValue = parseJsonValue(value);

  if (Array.isArray(normalizedValue)) {
    return unwrapAnalyticsPayload(normalizedValue[0] ?? null);
  }

  const record = asRecord(normalizedValue);
  if (!record) {
    return {};
  }

  if (record.get_insight_analytics !== undefined) {
    return unwrapAnalyticsPayload(record.get_insight_analytics);
  }

  return record as AnalyticsPayload;
}

function normalizeStageCounts(value: unknown) {
  const stageCounts = createEmptyStageCounts();
  const stageCountRecord = asRecord(value);

  for (const stage of Object.keys(stageCounts) as InsightStage[]) {
    stageCounts[stage] = readNumber(stageCountRecord?.[stage]);
  }

  return stageCounts;
}

function normalizeNamedCounts(value: unknown) {
  const normalizedValue = parseJsonValue(value);
  if (!Array.isArray(normalizedValue)) {
    return [] as AnalyticsNamedCount[];
  }

  return normalizedValue.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const id = readString(record.id);
    const name = readString(record.name, id);

    if (!id || !name) {
      return [];
    }

    return [
      {
        count: readNumber(record.count),
        id,
        name,
      },
    ];
  });
}

function normalizeHeatmapRows(value: unknown) {
  const normalizedValue = parseJsonValue(value);
  if (!Array.isArray(normalizedValue)) {
    return [] as AnalyticsHeatmapRow[];
  }

  return normalizedValue.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const priority = readString(record.priority) as InsightPriority;
    if (!priority) {
      return [];
    }

    const cells = parseJsonValue(record.cells);

    return [
      {
        cells: Array.isArray(cells)
          ? cells.map((cell) => readNumber(cell))
          : [],
        priority,
      },
    ];
  });
}

function normalizeWeeklyBuckets(value: unknown) {
  const normalizedValue = parseJsonValue(value);
  if (!Array.isArray(normalizedValue)) {
    return [] as AnalyticsWeeklyBucket[];
  }

  return normalizedValue.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const label = readString(record.label);
    if (!label) {
      return [];
    }

    return [
      {
        createdCount: readNumber(record.createdCount ?? record.created_count),
        label,
        resolvedCount: readNumber(
          record.resolvedCount ?? record.resolved_count,
        ),
      },
    ];
  });
}

function hasAnalyticsData(summary: InsightAnalyticsSummary) {
  return (
    summary.totalInsights > 0 ||
    summary.previousInsights > 0 ||
    summary.averagePipelineDays > 0 ||
    Object.values(summary.stageCounts).some((count) => count > 0) ||
    summary.categoryCounts.some((item) => item.count > 0) ||
    summary.hcpCounts.some((item) => item.count > 0) ||
    summary.heatmap.some((row) => row.cells.some((cell) => cell > 0)) ||
    summary.weeklyBuckets.some(
      (bucket) => bucket.createdCount > 0 || bucket.resolvedCount > 0,
    )
  );
}

function applyInsightCountFilters(query: any, filters: InsightCountFilters) {
  let nextQuery = query.eq("is_archived", false);

  if (filters.stage) {
    nextQuery = nextQuery.eq("stage", filters.stage);
  }

  if (filters.priority) {
    nextQuery = nextQuery.eq("priority", filters.priority);
  }

  if (filters.categoryId) {
    nextQuery = nextQuery.eq("category_id", filters.categoryId);
  }

  if (filters.hcpId) {
    nextQuery = nextQuery.eq("hcp_id", filters.hcpId);
  }

  if (filters.createdAtGte) {
    nextQuery = nextQuery.gte("created_at", filters.createdAtGte);
  }

  if (filters.createdAtLt) {
    nextQuery = nextQuery.lt("created_at", filters.createdAtLt);
  }

  if (filters.updatedAtGte) {
    nextQuery = nextQuery.gte("updated_at", filters.updatedAtGte);
  }

  if (filters.updatedAtLt) {
    nextQuery = nextQuery.lt("updated_at", filters.updatedAtLt);
  }

  return nextQuery;
}

async function fetchInsightCount(filters: InsightCountFilters) {
  const query = applyInsightCountFilters(
    supabase.from("insights").select("id", { count: "exact", head: true }),
    filters,
  );
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function fetchReferenceCounts(
  table: "categories" | "hcps",
  foreignKey: "categoryId" | "hcpId",
  cutoff: string,
) {
  const { data, error } = await supabase.from(table).select("id,name");

  if (error) {
    throw error;
  }

  const references = (data ?? []) as AnalyticsReferenceRow[];
  const counts = await Promise.all(
    references.map(async (reference) => {
      const count = await fetchInsightCount({
        [foreignKey]: reference.id,
        createdAtGte: cutoff,
      });

      return {
        count,
        id: reference.id,
        name: reference.name,
      };
    }),
  );

  return counts
    .filter((item) => item.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.name.localeCompare(right.name);
    });
}

async function fetchWeeklyBuckets(cutoff: string, now = new Date()) {
  const bucketIndices = Array.from(
    { length: WEEKLY_BUCKET_COUNT },
    (_, index) => index,
  );

  return Promise.all(
    bucketIndices.map(async (bucketIndex) => {
      const bucketStart = new Date(
        now.getTime() - (WEEKLY_BUCKET_COUNT - bucketIndex) * 7 * DAY_IN_MS,
      ).toISOString();
      const bucketEnd = new Date(
        now.getTime() - (WEEKLY_BUCKET_COUNT - bucketIndex - 1) * 7 * DAY_IN_MS,
      ).toISOString();
      const createdLowerBound = cutoff > bucketStart ? cutoff : bucketStart;
      const createdCount =
        createdLowerBound >= bucketEnd
          ? 0
          : await fetchInsightCount({
              createdAtGte: createdLowerBound,
              createdAtLt: bucketEnd,
            });
      const resolvedCount =
        cutoff >= bucketEnd
          ? 0
          : await fetchInsightCount({
              createdAtGte: cutoff,
              updatedAtGte: bucketStart,
              updatedAtLt: bucketEnd,
            });

      return {
        createdCount,
        label: `W${bucketIndex + 1}`,
        resolvedCount,
      };
    }),
  );
}

async function fetchHeatmap(cutoff: string) {
  return Promise.all(
    ANALYTICS_PRIORITIES.map(async (priority) => ({
      cells: await Promise.all(
        ANALYTICS_STAGES.map((stage) =>
          fetchInsightCount({
            createdAtGte: cutoff,
            priority,
            stage,
          }),
        ),
      ),
      priority,
    })),
  );
}

async function fetchImpactMoveActivities(insightIds: string[]) {
  if (!insightIds.length) {
    return new Map<string, string>();
  }

  const firstImpactMoveByInsight = new Map<string, string>();
  const chunkSize = 100;

  for (let offset = 0; offset < insightIds.length; offset += chunkSize) {
    const chunk = insightIds.slice(offset, offset + chunkSize);
    const { data, error } = await supabase
      .from("insight_activities")
      .select("insight_id,created_at")
      .eq("action", "moved")
      .eq("field_name", "stage")
      .eq("new_value", "impact")
      .in("insight_id", chunk)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as AnalyticsImpactActivityRow[]) {
      if (!firstImpactMoveByInsight.has(row.insight_id)) {
        firstImpactMoveByInsight.set(row.insight_id, row.created_at);
      }
    }
  }

  return firstImpactMoveByInsight;
}

async function fetchAveragePipelineDays(cutoff: string, now = new Date()) {
  let offset = 0;
  let totalDays = 0;
  let totalRows = 0;
  const impactRows: AnalyticsImpactRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("insights")
      .select("id,created_at,updated_at")
      .eq("is_archived", false)
      .eq("stage", "impact")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range(offset, offset + ANALYTICS_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as AnalyticsImpactRow[];
    impactRows.push(...rows);

    if (rows.length < ANALYTICS_PAGE_SIZE) {
      break;
    }

    offset += ANALYTICS_PAGE_SIZE;
  }

  const firstImpactMoveByInsight = await fetchImpactMoveActivities(
    impactRows.map((row) => row.id),
  );

  for (const row of impactRows) {
    const createdAt = Date.parse(row.created_at);
    const impactMovedAt = firstImpactMoveByInsight.get(row.id);
    const completedAt = impactMovedAt
      ? Date.parse(impactMovedAt)
      : Math.max(Date.parse(row.updated_at), now.getTime());
    const days = Math.max((completedAt - createdAt) / DAY_IN_MS, 0);

    if (Number.isFinite(days)) {
      totalDays += days;
      totalRows += 1;
    }
  }

  return totalRows ? Number((totalDays / totalRows).toFixed(2)) : 0;
}

async function fetchDirectInsightAnalytics(range: AnalyticsRange) {
  const now = new Date();
  const cutoff = getRangeCutoff(range, now);
  const previousCutoff = getPreviousRangeCutoff(range, now);
  const emptySummary = createEmptyAnalyticsSummary();

  const [
    totalInsights,
    previousInsights,
    stageEntries,
    categoryCounts,
    hcpCounts,
    weeklyBuckets,
    heatmap,
    averagePipelineDays,
  ] = await Promise.all([
    fetchInsightCount({ createdAtGte: cutoff }),
    fetchInsightCount({
      createdAtGte: previousCutoff,
      createdAtLt: cutoff,
    }),
    Promise.all(
      ANALYTICS_STAGES.map(
        async (stage) =>
          [
            stage,
            await fetchInsightCount({ createdAtGte: cutoff, stage }),
          ] as const,
      ),
    ),
    fetchReferenceCounts("categories", "categoryId", cutoff),
    fetchReferenceCounts("hcps", "hcpId", cutoff),
    fetchWeeklyBuckets(cutoff, now),
    fetchHeatmap(cutoff),
    fetchAveragePipelineDays(cutoff),
  ]);

  for (const [stage, count] of stageEntries) {
    emptySummary.stageCounts[stage] = count;
  }

  return {
    ...emptySummary,
    averagePipelineDays,
    categoryCounts,
    hcpCounts,
    heatmap,
    previousInsights,
    totalInsights,
    weeklyBuckets,
  };
}

function mapExportRow(row: AnalyticsExportRow): Insight {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    stage: row.stage,
    priority: row.priority,
    categoryId: row.category_id,
    hcpId: row.hcp_id,
    createdBy: "analytics-export",
    drugName: row.drug_name ?? "",
    tagIds: [],
    customFields: {},
    columnOrder: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewingUserIds: [],
    editingUserId: null,
    swipeUserId: null,
  };
}

async function fetchRpcInsightAnalytics(range: AnalyticsRange) {
  const { data, error } = await supabase.rpc("get_insight_analytics", {
    range_days: getRangeDays(range),
  });

  if (error) {
    throw error;
  }

  const payload = unwrapAnalyticsPayload(data);
  const stageCounts = normalizeStageCounts(
    payload.stageCounts ?? payload.stage_counts,
  );

  return {
    averagePipelineDays: readNumber(
      payload.averagePipelineDays ?? payload.average_pipeline_days,
    ),
    categoryCounts: normalizeNamedCounts(
      payload.categoryCounts ?? payload.category_counts,
    ),
    hcpCounts: normalizeNamedCounts(payload.hcpCounts ?? payload.hcp_counts),
    heatmap: normalizeHeatmapRows(payload.heatmap),
    previousInsights: readNumber(
      payload.previousInsights ?? payload.previous_insights,
    ),
    stageCounts,
    totalInsights: readNumber(payload.totalInsights ?? payload.total_insights),
    weeklyBuckets: normalizeWeeklyBuckets(
      payload.weeklyBuckets ?? payload.weekly_buckets,
    ),
  } satisfies InsightAnalyticsSummary;
}

function needsAveragePipelineFallback(summary: InsightAnalyticsSummary) {
  return summary.stageCounts.impact > 0 && summary.averagePipelineDays <= 0;
}

export async function fetchInsightAnalytics(range: AnalyticsRange) {
  try {
    const rpcSummary = await fetchRpcInsightAnalytics(range);

    if (
      hasAnalyticsData(rpcSummary) &&
      !needsAveragePipelineFallback(rpcSummary)
    ) {
      return rpcSummary;
    }

    const directSummary = await fetchDirectInsightAnalytics(range);

    if (hasAnalyticsData(rpcSummary)) {
      return needsAveragePipelineFallback(rpcSummary)
        ? {
            ...rpcSummary,
            averagePipelineDays: directSummary.averagePipelineDays,
          }
        : rpcSummary;
    }

    return hasAnalyticsData(directSummary) ? directSummary : rpcSummary;
  } catch {
    return fetchDirectInsightAnalytics(range);
  }
}

export async function fetchInsightsForAnalyticsExport(range: AnalyticsRange) {
  const pageSize = 200;
  const rangeDays = getRangeDays(range);
  const cutoff = new Date(
    Date.now() - rangeDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const allInsights: Insight[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("insights")
      .select(
        "id,title,description,stage,priority,category_id,hcp_id,drug_name,created_at,updated_at",
      )
      .eq("is_archived", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as AnalyticsExportRow[];
    allInsights.push(...rows.map(mapExportRow));

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allInsights;
}
