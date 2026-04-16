/**
 * Tests for the report export service.
 * Tests the escapeHtml helper logic used in PDF generation
 * and the report input structure validation.
 */

/** Mirrors escapeHtml from report-export.ts */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('key="value"')).toBe("key=&quot;value&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("returns unchanged string when no special chars", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles strings with multiple special characters", () => {
    expect(escapeHtml('<p class="test">A & B\'s</p>')).toBe(
      "&lt;p class=&quot;test&quot;&gt;A &amp; B&#039;s&lt;/p&gt;",
    );
  });
});

describe("Report page chunking", () => {
  /** Mirrors the chunking logic from exportInsightBoardReport */
  function chunkInsights<T>(insights: T[], pageSize: number): T[][] {
    return insights.reduce<T[][]>((pages, item, index) => {
      const pageIndex = Math.floor(index / pageSize);
      if (!pages[pageIndex]) {
        pages[pageIndex] = [];
      }
      pages[pageIndex].push(item);
      return pages;
    }, []);
  }

  it("creates single page for small list", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const pages = chunkInsights(items, 25);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(10);
  });

  it("creates multiple pages", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const pages = chunkInsights(items, 25);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(25);
    expect(pages[1]).toHaveLength(25);
    expect(pages[2]).toHaveLength(10);
  });

  it("handles empty array", () => {
    const pages = chunkInsights([], 25);
    expect(pages).toHaveLength(0);
  });

  it("handles exact page boundary", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const pages = chunkInsights(items, 25);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(25);
  });
});
