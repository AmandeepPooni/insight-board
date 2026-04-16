import {
    defaultInsightFilters,
    type Insight,
    type InsightFilters,
} from "@/lib/insight-board-schema";
import {
    getNextStage,
    getPreviousStage,
    getRelativeTimeLabel,
    getStageLabel,
    isWithinDateRange,
    matchesInsightFilters,
    prioritySortWeight,
    sortInsightsForStage,
} from "@/lib/insight-utils";

function createMockInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "test-1",
    title: "Test Insight",
    description: "Test description",
    stage: "observation",
    priority: "P2",
    categoryId: "cat-1",
    hcpId: "hcp-1",
    createdBy: "user-1",
    drugName: "Aspirin",
    tagIds: ["tag-1"],
    customFields: {},
    columnOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewingUserIds: [],
    editingUserId: null,
    swipeUserId: null,
    ...overrides,
  };
}

describe("getNextStage", () => {
  it("returns insight for observation", () => {
    expect(getNextStage("observation")).toBe("insight");
  });

  it("returns actionable for insight", () => {
    expect(getNextStage("insight")).toBe("actionable");
  });

  it("returns impact for actionable", () => {
    expect(getNextStage("actionable")).toBe("impact");
  });

  it("returns null for impact (last stage)", () => {
    expect(getNextStage("impact")).toBeNull();
  });
});

describe("getPreviousStage", () => {
  it("returns null for observation (first stage)", () => {
    expect(getPreviousStage("observation")).toBeNull();
  });

  it("returns observation for insight", () => {
    expect(getPreviousStage("insight")).toBe("observation");
  });

  it("returns insight for actionable", () => {
    expect(getPreviousStage("actionable")).toBe("insight");
  });

  it("returns actionable for impact", () => {
    expect(getPreviousStage("impact")).toBe("actionable");
  });
});

describe("getStageLabel", () => {
  it("returns Observation for observation", () => {
    expect(getStageLabel("observation")).toBe("Observation");
  });

  it("returns Impact for impact", () => {
    expect(getStageLabel("impact")).toBe("Impact");
  });
});

describe("getRelativeTimeLabel", () => {
  it("returns 'm ago' for recent timestamps", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getRelativeTimeLabel(fiveMinAgo)).toBe("5m ago");
  });

  it("returns 'h ago' for timestamps within a day", () => {
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000,
    ).toISOString();
    expect(getRelativeTimeLabel(threeHoursAgo)).toBe("3h ago");
  });

  it("returns Yesterday for 1 day ago", () => {
    const yesterday = new Date(
      Date.now() - 1 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(getRelativeTimeLabel(yesterday)).toBe("Yesterday");
  });

  it("returns 'd ago' for timestamps within a week", () => {
    const threeDaysAgo = new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(getRelativeTimeLabel(threeDaysAgo)).toBe("3d ago");
  });
});

describe("isWithinDateRange", () => {
  it("returns true for null range", () => {
    expect(isWithinDateRange("2020-01-01", null)).toBe(true);
  });

  it("returns true for recent dates with 7d range", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDateRange(recent, "7d")).toBe(true);
  });

  it("returns false for old dates with 7d range", () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDateRange(old, "7d")).toBe(false);
  });
});

describe("matchesInsightFilters", () => {
  const defaultFilters: InsightFilters = { ...defaultInsightFilters };
  const hcps = [
    {
      id: "hcp-1",
      name: "Dr. Smith",
      specialty: "Cardiology",
      institution: "General Hospital",
      region: "East",
    },
  ];

  it("matches all insights with default filters", () => {
    const insight = createMockInsight();
    expect(matchesInsightFilters(insight, defaultFilters, hcps)).toBe(true);
  });

  it("filters by priority", () => {
    const insight = createMockInsight({ priority: "P1" });
    const filters = { ...defaultFilters, priorities: ["P3" as const] };
    expect(matchesInsightFilters(insight, filters, hcps)).toBe(false);
  });

  it("filters by category", () => {
    const insight = createMockInsight({ categoryId: "cat-2" });
    const filters = { ...defaultFilters, categoryId: "cat-1" };
    expect(matchesInsightFilters(insight, filters, hcps)).toBe(false);
  });

  it("filters by search term in title", () => {
    const insight = createMockInsight({ title: "HCP prescribing patterns" });
    const filters = { ...defaultFilters, search: "prescribing" };
    expect(matchesInsightFilters(insight, filters, hcps)).toBe(true);
  });

  it("filters by HCP id", () => {
    const insight = createMockInsight({ hcpId: "hcp-2" });
    const filters = { ...defaultFilters, hcpId: "hcp-1" };
    expect(matchesInsightFilters(insight, filters, hcps)).toBe(false);
  });

  it("uses AND logic for multiple filters", () => {
    const insight = createMockInsight({ priority: "P1", categoryId: "cat-2" });
    const filters = {
      ...defaultFilters,
      priorities: ["P1" as const],
      categoryId: "cat-1",
    };
    expect(matchesInsightFilters(insight, filters, hcps)).toBe(false);
  });
});

describe("sortInsightsForStage", () => {
  it("sorts by columnOrder ascending", () => {
    const insights = [
      createMockInsight({ id: "a", columnOrder: 3 }),
      createMockInsight({ id: "b", columnOrder: 1 }),
      createMockInsight({ id: "c", columnOrder: 2 }),
    ];
    const sorted = sortInsightsForStage(insights);
    expect(sorted.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("uses updatedAt as tiebreaker (newest first)", () => {
    const now = Date.now();
    const insights = [
      createMockInsight({
        id: "a",
        columnOrder: 1,
        updatedAt: new Date(now - 1000).toISOString(),
      }),
      createMockInsight({
        id: "b",
        columnOrder: 1,
        updatedAt: new Date(now).toISOString(),
      }),
    ];
    const sorted = sortInsightsForStage(insights);
    expect(sorted[0].id).toBe("b");
  });
});

describe("prioritySortWeight", () => {
  it("assigns higher weight to P1 than P4", () => {
    expect(prioritySortWeight("P1")).toBeGreaterThan(prioritySortWeight("P4"));
  });
});
