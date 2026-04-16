import { z } from "zod";

/**
 * Mirror of the draft validation schema used in insight-form-sheet.tsx.
 * Exported here for testability in isolation.
 */
export const draftSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  drugName: z.string().optional(),
});

describe("draftSchema (Zod validation)", () => {
  it("passes with valid title and description", () => {
    const result = draftSchema.safeParse({
      title: "HCP mentioned off-label usage",
      description:
        "Dr. Smith noted increased patient inquiries about dosage changes.",
    });
    expect(result.success).toBe(true);
  });

  it("fails when title is empty", () => {
    const result = draftSchema.safeParse({
      title: "",
      description: "Some description",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titles = result.error.issues.filter((i) => i.path[0] === "title");
      expect(titles.length).toBeGreaterThan(0);
      expect(titles[0].message).toBe("Title is required.");
    }
  });

  it("fails when description is empty", () => {
    const result = draftSchema.safeParse({
      title: "Valid title",
      description: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const descriptions = result.error.issues.filter(
        (i) => i.path[0] === "description",
      );
      expect(descriptions.length).toBeGreaterThan(0);
    }
  });

  it("fails when title is only whitespace", () => {
    const result = draftSchema.safeParse({
      title: "   ",
      description: "Valid desc",
    });
    expect(result.success).toBe(false);
  });

  it("passes when drugName is omitted", () => {
    const result = draftSchema.safeParse({
      title: "Drug observation",
      description: "Observed reaction in clinic setting.",
    });
    expect(result.success).toBe(true);
  });

  it("passes when drugName is an empty string", () => {
    const result = draftSchema.safeParse({
      title: "Drug observation",
      description: "Observed reaction in clinic setting.",
      drugName: "",
    });
    expect(result.success).toBe(true);
  });

  it("fails when both title and description are missing", () => {
    const result = draftSchema.safeParse({
      title: "",
      description: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});
