import {
    analyticsRanges,
    defaultInsightFilters,
    priorityDefinitions,
    stageDefinitions,
    type InsightPriority,
    type InsightStage,
} from "@/lib/insight-board-schema";

describe("stageDefinitions", () => {
  const expectedStages: InsightStage[] = [
    "observation",
    "insight",
    "actionable",
    "impact",
  ];

  it("has exactly 4 stages", () => {
    expect(stageDefinitions).toHaveLength(4);
  });

  it("stages appear in pipeline order", () => {
    expect(stageDefinitions.map((d) => d.key)).toEqual(expectedStages);
  });

  it("every stage has key, label, shortLabel, and description", () => {
    for (const def of stageDefinitions) {
      expect(def.key).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.shortLabel).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(10);
    }
  });
});

describe("priorityDefinitions", () => {
  const expectedPriorities: InsightPriority[] = ["P1", "P2", "P3", "P4"];

  it("has exactly 4 priorities", () => {
    expect(priorityDefinitions).toHaveLength(4);
  });

  it("priorities appear in order P1-P4", () => {
    expect(priorityDefinitions.map((d) => d.key)).toEqual(expectedPriorities);
  });

  it("P1 is labeled Critical", () => {
    expect(priorityDefinitions[0].label).toBe("Critical");
  });

  it("P4 is labeled Reference", () => {
    expect(priorityDefinitions[3].label).toBe("Reference");
  });
});

describe("defaultInsightFilters", () => {
  it("has empty search", () => {
    expect(defaultInsightFilters.search).toBe("");
    expect(defaultInsightFilters.searchInput).toBe("");
  });

  it("has empty priorities array", () => {
    expect(defaultInsightFilters.priorities).toEqual([]);
  });

  it("has null categoryId and hcpId", () => {
    expect(defaultInsightFilters.categoryId).toBeNull();
    expect(defaultInsightFilters.hcpId).toBeNull();
  });

  it("has empty tagIds", () => {
    expect(defaultInsightFilters.tagIds).toEqual([]);
  });

  it("has null dateRange", () => {
    expect(defaultInsightFilters.dateRange).toBeNull();
  });
});

describe("analyticsRanges", () => {
  it("has 3 options", () => {
    expect(analyticsRanges).toHaveLength(3);
  });

  it("contains 7d, 30d, 90d", () => {
    expect(analyticsRanges.map((r) => r.value)).toEqual(["7d", "30d", "90d"]);
  });

  it("each has a human-readable label", () => {
    for (const range of analyticsRanges) {
      expect(range.label).toMatch(/\d+ days/);
    }
  });
});
