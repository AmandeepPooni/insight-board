import { drugSearchIndex } from "@/lib/drug-search-index";

describe("drugSearchIndex", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(drugSearchIndex)).toBe(true);
    expect(drugSearchIndex.length).toBeGreaterThan(0);
  });

  it("contains well-known drugs", () => {
    expect(drugSearchIndex).toContain("Aspirin");
    expect(drugSearchIndex).toContain("Humira");
    expect(drugSearchIndex).toContain("Metformin");
  });

  it("all entries are non-empty strings", () => {
    for (const drug of drugSearchIndex) {
      expect(typeof drug).toBe("string");
      expect(drug.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate entries", () => {
    const uniqueSet = new Set(drugSearchIndex);
    expect(uniqueSet.size).toBe(drugSearchIndex.length);
  });

  it("supports case-insensitive search pattern", () => {
    const query = "aspirin";
    const found = drugSearchIndex.find(
      (drug) => drug.toLowerCase() === query.toLowerCase(),
    );
    expect(found).toBe("Aspirin");
  });

  it("supports prefix-based filtering", () => {
    const prefix = "Met";
    const matches = drugSearchIndex.filter((drug) =>
      drug.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches).toContain("Metformin");
  });
});
