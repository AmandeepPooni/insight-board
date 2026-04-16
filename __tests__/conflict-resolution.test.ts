import {
    detectConflictFields,
    mergeInsightDrafts,
} from "@/lib/conflict-resolution";
import type { Insight, InsightDraft } from "@/lib/insight-board-schema";

function createMockInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "insight-1",
    title: "Original Title",
    description: "Original description",
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

function createMockDraft(overrides: Partial<InsightDraft> = {}): InsightDraft {
  return {
    id: "insight-1",
    title: "Original Title",
    description: "Original description",
    stage: "observation",
    priority: "P2",
    categoryId: "cat-1",
    hcpId: "hcp-1",
    drugName: "Aspirin",
    tagIds: ["tag-1"],
    customFields: {},
    ...overrides,
  };
}

describe("detectConflictFields", () => {
  it("returns empty array when no fields differ", () => {
    const yours = createMockDraft();
    const theirs = createMockInsight();
    expect(detectConflictFields(yours, theirs)).toEqual([]);
  });

  it("detects title conflict", () => {
    const yours = createMockDraft({ title: "My new title" });
    const theirs = createMockInsight({ title: "Their new title" });
    const conflicts = detectConflictFields(yours, theirs);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("title");
    expect(conflicts[0].yours).toBe("My new title");
    expect(conflicts[0].theirs).toBe("Their new title");
  });

  it("detects priority conflict", () => {
    const yours = createMockDraft({ priority: "P1" });
    const theirs = createMockInsight({ priority: "P3" });
    const conflicts = detectConflictFields(yours, theirs);
    expect(conflicts.find((c) => c.field === "priority")).toBeTruthy();
  });

  it("detects stage conflict", () => {
    const yours = createMockDraft({ stage: "insight" });
    const theirs = createMockInsight({ stage: "actionable" });
    const conflicts = detectConflictFields(yours, theirs);
    expect(conflicts.find((c) => c.field === "stage")).toBeTruthy();
  });

  it("detects tag differences", () => {
    const yours = createMockDraft({ tagIds: ["tag-1", "tag-2"] });
    const theirs = createMockInsight({ tagIds: ["tag-1"] });
    const conflicts = detectConflictFields(yours, theirs);
    expect(conflicts.find((c) => c.field === "tagIds")).toBeTruthy();
  });

  it("detects multiple conflicts at once", () => {
    const yours = createMockDraft({
      title: "Different",
      priority: "P1",
      description: "New desc",
    });
    const theirs = createMockInsight({
      title: "Also different",
      priority: "P4",
      description: "Their desc",
    });
    const conflicts = detectConflictFields(yours, theirs);
    expect(conflicts.length).toBeGreaterThanOrEqual(3);
  });
});

describe("mergeInsightDrafts", () => {
  it("takes your change when only you changed a field", () => {
    const base = createMockInsight();
    const yours = createMockDraft({ title: "My new title" });
    const theirs = createMockInsight(); // unchanged
    const merged = mergeInsightDrafts(base, yours, theirs, {});
    expect(merged.title).toBe("My new title");
  });

  it("takes their change when only they changed a field", () => {
    const base = createMockInsight();
    const yours = createMockDraft(); // unchanged
    const theirs = createMockInsight({ title: "Their new title" });
    const merged = mergeInsightDrafts(base, yours, theirs, {});
    expect(merged.title).toBe("Their new title");
  });

  it("uses manual choice when both changed the same field", () => {
    const base = createMockInsight();
    const yours = createMockDraft({ title: "My title" });
    const theirs = createMockInsight({ title: "Their title" });
    const merged = mergeInsightDrafts(base, yours, theirs, {
      title: "yours",
    });
    expect(merged.title).toBe("My title");
  });

  it("defaults to theirs when both changed and no manual choice", () => {
    const base = createMockInsight();
    const yours = createMockDraft({ title: "My title" });
    const theirs = createMockInsight({ title: "Their title" });
    const merged = mergeInsightDrafts(base, yours, theirs, {});
    expect(merged.title).toBe("Their title");
  });

  it("merges non-overlapping changes from both users", () => {
    const base = createMockInsight();
    const yours = createMockDraft({ title: "My title" }); // only title changed
    const theirs = createMockInsight({ priority: "P1" }); // only priority changed
    const merged = mergeInsightDrafts(base, yours, theirs, {});
    expect(merged.title).toBe("My title");
    expect(merged.priority).toBe("P1");
  });

  it("preserves base values when neither changed a field", () => {
    const base = createMockInsight({ description: "Original" });
    const yours = createMockDraft({ description: "Original" });
    const theirs = createMockInsight({ description: "Original" });
    const merged = mergeInsightDrafts(base, yours, theirs, {});
    expect(merged.description).toBe("Original");
  });
});
