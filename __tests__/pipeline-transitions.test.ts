import type { Insight, InsightStage } from "@/lib/insight-board-schema";
import {
    getNextStage,
    getPreviousStage,
    sortInsightsForStage,
} from "@/lib/insight-utils";

function createMockInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "test-1",
    title: "Pipeline test insight",
    description: "Testing stage transitions",
    stage: "observation",
    priority: "P2",
    categoryId: "cat-1",
    hcpId: "hcp-1",
    createdBy: "user-1",
    drugName: "Aspirin",
    tagIds: [],
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

/**
 * Simulated optimistic pipeline update:
 * 1. Record current stage (snapshot for rollback)
 * 2. Move insight to next/previous stage
 * 3. If server fails → revert to snapshot
 */
function optimisticMove(
  insights: Insight[],
  insightId: string,
  direction: "forward" | "backward",
): { updated: Insight[]; rollback: () => Insight[] } {
  const snapshot = insights.map((item) => ({ ...item }));
  const index = insights.findIndex((item) => item.id === insightId);

  if (index === -1) {
    return { updated: insights, rollback: () => snapshot };
  }

  const current = insights[index];
  const newStage =
    direction === "forward"
      ? getNextStage(current.stage)
      : getPreviousStage(current.stage);

  if (!newStage) {
    return { updated: insights, rollback: () => snapshot };
  }

  const updated = insights.map((item) =>
    item.id === insightId ? { ...item, stage: newStage as InsightStage } : item,
  );

  return {
    updated,
    rollback: () => snapshot,
  };
}

describe("Pipeline state transitions", () => {
  describe("forward swipe (right)", () => {
    it("moves observation → insight", () => {
      const insights = [createMockInsight({ stage: "observation" })];
      const { updated } = optimisticMove(insights, "test-1", "forward");
      expect(updated[0].stage).toBe("insight");
    });

    it("moves insight → actionable", () => {
      const insights = [createMockInsight({ stage: "insight" })];
      const { updated } = optimisticMove(insights, "test-1", "forward");
      expect(updated[0].stage).toBe("actionable");
    });

    it("moves actionable → impact", () => {
      const insights = [createMockInsight({ stage: "actionable" })];
      const { updated } = optimisticMove(insights, "test-1", "forward");
      expect(updated[0].stage).toBe("impact");
    });

    it("does NOT move past impact (end of pipeline)", () => {
      const insights = [createMockInsight({ stage: "impact" })];
      const { updated } = optimisticMove(insights, "test-1", "forward");
      expect(updated[0].stage).toBe("impact");
    });
  });

  describe("backward swipe (left)", () => {
    it("moves insight → observation", () => {
      const insights = [createMockInsight({ stage: "insight" })];
      const { updated } = optimisticMove(insights, "test-1", "backward");
      expect(updated[0].stage).toBe("observation");
    });

    it("does NOT move past observation (start of pipeline)", () => {
      const insights = [createMockInsight({ stage: "observation" })];
      const { updated } = optimisticMove(insights, "test-1", "backward");
      expect(updated[0].stage).toBe("observation");
    });
  });

  describe("optimistic rollback on failure", () => {
    it("reverts to original stage on rollback", () => {
      const insights = [createMockInsight({ stage: "observation" })];
      const { updated, rollback } = optimisticMove(
        insights,
        "test-1",
        "forward",
      );

      // Verify optimistic update
      expect(updated[0].stage).toBe("insight");

      // Simulate server error → rollback
      const reverted = rollback();
      expect(reverted[0].stage).toBe("observation");
    });

    it("preserves other insights during rollback", () => {
      const insights = [
        createMockInsight({ id: "test-1", stage: "observation" }),
        createMockInsight({ id: "test-2", stage: "actionable" }),
      ];

      const { updated, rollback } = optimisticMove(
        insights,
        "test-1",
        "forward",
      );

      expect(updated[0].stage).toBe("insight");
      expect(updated[1].stage).toBe("actionable"); // unchanged

      const reverted = rollback();
      expect(reverted[0].stage).toBe("observation");
      expect(reverted[1].stage).toBe("actionable");
    });

    it("preserves all original fields after rollback", () => {
      const original = createMockInsight({
        title: "Important Insight",
        priority: "P1",
        stage: "insight",
      });
      const insights = [original];

      const { rollback } = optimisticMove(insights, "test-1", "forward");
      const reverted = rollback();

      expect(reverted[0].title).toBe("Important Insight");
      expect(reverted[0].priority).toBe("P1");
      expect(reverted[0].stage).toBe("insight");
    });
  });

  describe("sort integrity across transitions", () => {
    it("maintains sort order after stage change", () => {
      const insights = [
        createMockInsight({ id: "a", columnOrder: 1 }),
        createMockInsight({ id: "b", columnOrder: 2 }),
        createMockInsight({ id: "c", columnOrder: 3 }),
      ];

      const { updated } = optimisticMove(insights, "b", "forward");

      // The remaining observations should stay sorted
      const remaining = updated.filter((i) => i.stage === "observation");
      const sorted = sortInsightsForStage(remaining);
      expect(sorted.map((i) => i.id)).toEqual(["a", "c"]);
    });
  });
});
