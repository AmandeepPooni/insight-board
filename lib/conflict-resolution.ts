import { type Insight, type InsightDraft } from "@/lib/insight-board-schema";

export type ConflictField = {
  field: string;
  label: string;
  yours: string;
  theirs: string;
};

/**
 * Compare two versions of an insight and return fields that differ.
 * Used for field-by-field conflict resolution when two users edit simultaneously.
 */
export function detectConflictFields(
  yours: InsightDraft,
  theirs: Insight,
): ConflictField[] {
  const conflicts: ConflictField[] = [];

  if (yours.title.trim() !== theirs.title.trim()) {
    conflicts.push({
      field: "title",
      label: "Title",
      yours: yours.title,
      theirs: theirs.title,
    });
  }

  if (yours.description.trim() !== theirs.description.trim()) {
    conflicts.push({
      field: "description",
      label: "Description",
      yours: yours.description,
      theirs: theirs.description,
    });
  }

  if (yours.priority !== theirs.priority) {
    conflicts.push({
      field: "priority",
      label: "Priority",
      yours: yours.priority,
      theirs: theirs.priority,
    });
  }

  if (yours.stage !== theirs.stage) {
    conflicts.push({
      field: "stage",
      label: "Stage",
      yours: yours.stage,
      theirs: theirs.stage,
    });
  }

  if ((yours.categoryId ?? "") !== (theirs.categoryId ?? "")) {
    conflicts.push({
      field: "categoryId",
      label: "Category",
      yours: yours.categoryId ?? "(none)",
      theirs: theirs.categoryId ?? "(none)",
    });
  }

  if ((yours.hcpId ?? "") !== (theirs.hcpId ?? "")) {
    conflicts.push({
      field: "hcpId",
      label: "Linked HCP",
      yours: yours.hcpId ?? "(none)",
      theirs: theirs.hcpId ?? "(none)",
    });
  }

  if ((yours.drugName ?? "").trim() !== (theirs.drugName ?? "").trim()) {
    conflicts.push({
      field: "drugName",
      label: "Drug Name",
      yours: yours.drugName ?? "",
      theirs: theirs.drugName ?? "",
    });
  }

  const yourTags = [...yours.tagIds].sort().join(",");
  const theirTags = [...theirs.tagIds].sort().join(",");
  if (yourTags !== theirTags) {
    conflicts.push({
      field: "tagIds",
      label: "Tags",
      yours: yours.tagIds.join(", ") || "(none)",
      theirs: theirs.tagIds.join(", ") || "(none)",
    });
  }

  return conflicts;
}

/**
 * Merge two versions of an insight draft, preferring non-overlapping changes.
 * For fields that both changed, use the manual choice map.
 *
 * @param base - The original version both edits started from
 * @param yours - Your local edits
 * @param theirs - The other user's saved version
 * @param manualChoices - For overlapping changes, which version to keep per field
 */
export function mergeInsightDrafts(
  base: Insight,
  yours: InsightDraft,
  theirs: Insight,
  manualChoices: Record<string, "yours" | "theirs">,
): InsightDraft {
  const merged: InsightDraft = {
    id: yours.id,
    title: theirs.title,
    description: theirs.description,
    stage: theirs.stage,
    priority: theirs.priority,
    categoryId: theirs.categoryId,
    hcpId: theirs.hcpId,
    drugName: theirs.drugName,
    tagIds: [...theirs.tagIds],
    customFields: { ...theirs.customFields },
  };

  const fieldsToMerge = [
    "title",
    "description",
    "stage",
    "priority",
    "categoryId",
    "hcpId",
    "drugName",
  ] as const;

  for (const field of fieldsToMerge) {
    const baseVal = String(base[field] ?? "");
    const yoursVal = String(yours[field] ?? "");
    const theirsVal = String(theirs[field] ?? "");

    const youChanged = yoursVal !== baseVal;
    const theyChanged = theirsVal !== baseVal;

    if (youChanged && theyChanged) {
      // Both changed - use manual choice
      const choice = manualChoices[field] ?? "theirs";
      if (choice === "yours") {
        (merged as Record<string, unknown>)[field] = yours[field];
      }
    } else if (youChanged) {
      // Only you changed - take yours
      (merged as Record<string, unknown>)[field] = yours[field];
    }
    // If only they changed or neither changed, keep theirs (already set)
  }

  // Merge tags with same logic
  const baseTags = [...base.tagIds].sort().join(",");
  const yoursTags = [...yours.tagIds].sort().join(",");
  const theirsTags = [...theirs.tagIds].sort().join(",");
  const youChangedTags = yoursTags !== baseTags;
  const theyChangedTags = theirsTags !== baseTags;

  if (youChangedTags && theyChangedTags) {
    const choice = manualChoices["tagIds"] ?? "theirs";
    merged.tagIds = choice === "yours" ? [...yours.tagIds] : [...theirs.tagIds];
  } else if (youChangedTags) {
    merged.tagIds = [...yours.tagIds];
  }

  // Merge custom fields
  for (const key of Object.keys(yours.customFields)) {
    const baseVal = base.customFields[key];
    const yoursVal = yours.customFields[key];
    const theirsVal = theirs.customFields[key];

    if (yoursVal !== baseVal && theirsVal !== baseVal) {
      const choice = manualChoices[`custom_${key}`] ?? "theirs";
      merged.customFields[key] = choice === "yours" ? yoursVal : theirsVal;
    } else if (yoursVal !== baseVal) {
      merged.customFields[key] = yoursVal;
    }
  }

  return merged;
}
