import {
    type CustomFieldValue,
    type Insight,
    type InsightFilters,
    type InsightStage,
} from "@/lib/insight-board-schema";
import { supabase } from "@/lib/services/supabase";

export const STAGE_PAGE_SIZE = 10;

type InsightTagRow = {
  tag_id: string;
};

type InsightRow = {
  id: string;
  title: string;
  description: string | null;
  stage: InsightStage;
  priority: Insight["priority"];
  category_id: string | null;
  hcp_id: string | null;
  created_by: string;
  drug_name: string | null;
  custom_fields: unknown;
  column_order: number;
  created_at: string;
  updated_at: string;
  insight_tags?: InsightTagRow[] | null;
};

type InsightActivityRow = {
  insight_id: string;
  tag_id: string;
};

type StageCountMap = Record<InsightStage, number>;

type FetchStagePageArgs = {
  filters: InsightFilters;
  offset: number;
  searchHcpIds: string[];
  stage: InsightStage;
};

const insightSelect =
  "id,title,description,stage,priority,category_id,hcp_id,created_by,drug_name,custom_fields,column_order,created_at,updated_at,insight_tags(tag_id)";

function sanitizeCustomFields(
  value: unknown,
): Record<string, CustomFieldValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const nextFields: Record<string, CustomFieldValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      entry === null
    ) {
      nextFields[key] = entry;
    }
  }

  return nextFields;
}

function mapInsightRow(row: InsightRow): Insight {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    stage: row.stage,
    priority: row.priority,
    categoryId: row.category_id,
    hcpId: row.hcp_id,
    createdBy: row.created_by,
    drugName: row.drug_name ?? "",
    tagIds: (row.insight_tags ?? []).map((tag) => tag.tag_id),
    customFields: sanitizeCustomFields(row.custom_fields),
    columnOrder: row.column_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewingUserIds: [],
    editingUserId: null,
    swipeUserId: null,
  };
}

function createEmptyStageCounts(): StageCountMap {
  return {
    observation: 0,
    insight: 0,
    actionable: 0,
    impact: 0,
  };
}

function getDateRangeCutoff(range: InsightFilters["dateRange"]) {
  if (!range) {
    return null;
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function escapeOrValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

async function resolveTagMatchedInsightIds(tagIds: string[]) {
  if (!tagIds.length) {
    return null;
  }

  const { data, error } = await supabase
    .from("insight_tags")
    .select("insight_id, tag_id")
    .in("tag_id", tagIds);

  if (error) {
    throw error;
  }

  const groupedTagIds = new Map<string, Set<string>>();

  for (const row of (data ?? []) as InsightActivityRow[]) {
    if (!groupedTagIds.has(row.insight_id)) {
      groupedTagIds.set(row.insight_id, new Set<string>());
    }

    groupedTagIds.get(row.insight_id)?.add(row.tag_id);
  }

  return Array.from(groupedTagIds.entries())
    .filter(([, matchedTagIds]) => matchedTagIds.size === tagIds.length)
    .map(([insightId]) => insightId);
}

function applyInsightFilters(
  query: any,
  filters: InsightFilters,
  searchHcpIds: string[],
  stage: InsightStage,
  tagMatchedInsightIds: string[] | null,
) {
  let nextQuery = query.eq("is_archived", false).eq("stage", stage);

  if (filters.priorities.length) {
    nextQuery = nextQuery.in("priority", filters.priorities);
  }

  if (filters.categoryId) {
    nextQuery = nextQuery.eq("category_id", filters.categoryId);
  }

  if (filters.hcpId) {
    nextQuery = nextQuery.eq("hcp_id", filters.hcpId);
  }

  const cutoff = getDateRangeCutoff(filters.dateRange);
  if (cutoff) {
    nextQuery = nextQuery.gte("created_at", cutoff);
  }

  if (tagMatchedInsightIds) {
    if (!tagMatchedInsightIds.length) {
      return null;
    }

    nextQuery = nextQuery.in("id", tagMatchedInsightIds);
  }

  const normalizedSearch = filters.search.trim();
  if (normalizedSearch) {
    const escapedSearch = escapeOrValue(normalizedSearch);
    const searchClauses = [
      `title.ilike.%${escapedSearch}%`,
      `description.ilike.%${escapedSearch}%`,
      `drug_name.ilike.%${escapedSearch}%`,
    ];

    if (searchHcpIds.length) {
      searchClauses.push(`hcp_id.in.(${searchHcpIds.join(",")})`);
    }

    nextQuery = nextQuery.or(searchClauses.join(","));
  }

  return nextQuery;
}

async function fetchStageCountsInternal(
  filters: InsightFilters,
  searchHcpIds: string[],
) {
  const tagMatchedInsightIds = await resolveTagMatchedInsightIds(
    filters.tagIds,
  );
  const stages: InsightStage[] = [
    "observation",
    "insight",
    "actionable",
    "impact",
  ];
  const counts = createEmptyStageCounts();

  if (tagMatchedInsightIds && tagMatchedInsightIds.length === 0) {
    return counts;
  }

  const results = await Promise.all(
    stages.map(async (stage) => {
      const baseQuery = supabase
        .from("insights")
        .select("id", { count: "exact", head: true });
      const filteredQuery = applyInsightFilters(
        baseQuery,
        filters,
        searchHcpIds,
        stage,
        tagMatchedInsightIds,
      );

      if (!filteredQuery) {
        return [stage, 0] as const;
      }

      const { count, error } = await filteredQuery;

      if (error) {
        throw error;
      }

      return [stage, count ?? 0] as const;
    }),
  );

  for (const [stage, count] of results) {
    counts[stage] = count;
  }

  return counts;
}

export async function fetchFilteredStageCounts(
  filters: InsightFilters,
  searchHcpIds: string[],
) {
  return fetchStageCountsInternal(filters, searchHcpIds);
}

export async function fetchTotalStageCounts() {
  const stages: InsightStage[] = [
    "observation",
    "insight",
    "actionable",
    "impact",
  ];
  const counts = createEmptyStageCounts();

  const results = await Promise.all(
    stages.map(async (stage) => {
      const { count, error } = await supabase
        .from("insights")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .eq("stage", stage);

      if (error) {
        throw error;
      }

      return [stage, count ?? 0] as const;
    }),
  );

  for (const [stage, count] of results) {
    counts[stage] = count;
  }

  return counts;
}

export async function fetchStageInsightPage({
  filters,
  offset,
  searchHcpIds,
  stage,
}: FetchStagePageArgs) {
  const tagMatchedInsightIds = await resolveTagMatchedInsightIds(
    filters.tagIds,
  );

  if (tagMatchedInsightIds && tagMatchedInsightIds.length === 0) {
    return {
      hasMore: false,
      insights: [] as Insight[],
    };
  }

  const baseQuery = supabase.from("insights").select(insightSelect);
  const filteredQuery = applyInsightFilters(
    baseQuery,
    filters,
    searchHcpIds,
    stage,
    tagMatchedInsightIds,
  );

  if (!filteredQuery) {
    return {
      hasMore: false,
      insights: [] as Insight[],
    };
  }

  const { data, error } = await filteredQuery
    .order("column_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .range(offset, offset + STAGE_PAGE_SIZE);

  if (error) {
    throw error;
  }

  const insightRows = ((data ?? []) as InsightRow[]).map(mapInsightRow);
  const hasMore = insightRows.length > STAGE_PAGE_SIZE;

  return {
    hasMore,
    insights: hasMore ? insightRows.slice(0, STAGE_PAGE_SIZE) : insightRows,
  };
}

export async function fetchInsightById(insightId: string) {
  const { data, error } = await supabase
    .from("insights")
    .select(insightSelect)
    .eq("id", insightId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapInsightRow(data as InsightRow) : null;
}

export async function fetchNextColumnOrder(stage: InsightStage) {
  const { data, error } = await supabase
    .from("insights")
    .select("column_order")
    .eq("is_archived", false)
    .eq("stage", stage)
    .order("column_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return ((data as { column_order?: number } | null)?.column_order ?? 0) + 1;
}
