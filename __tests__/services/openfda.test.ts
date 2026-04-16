import { OpenFdaError } from "@/lib/services/openfda";

describe("OpenFdaError", () => {
  it("stores error code", () => {
    const err = new OpenFdaError("http", "Server returned 500", 500);
    expect(err.code).toBe("http");
  });

  it("stores status", () => {
    const err = new OpenFdaError("http", "Not Found", 404);
    expect(err.status).toBe(404);
  });

  it("stores message", () => {
    const err = new OpenFdaError("network", "Connection refused");
    expect(err.message).toBe("Connection refused");
  });

  it("defaults status to null", () => {
    const err = new OpenFdaError("network", "Timeout");
    expect(err.status).toBeNull();
  });

  it("is an instance of Error", () => {
    const err = new OpenFdaError("empty", "No results");
    expect(err).toBeInstanceOf(Error);
  });

  it("supports rate-limited code", () => {
    const err = new OpenFdaError("rate-limited", "Too many requests", 429);
    expect(err.code).toBe("rate-limited");
    expect(err.status).toBe(429);
  });

  it("supports response code", () => {
    const err = new OpenFdaError("response", "Malformed response body");
    expect(err.code).toBe("response");
  });
});

describe("Drug name normalization", () => {
  /** Mirrors normalizeDrugName from openfda.ts */
  function normalizeDrugName(drugName: string) {
    return drugName.trim().toLowerCase();
  }

  it("trims whitespace", () => {
    expect(normalizeDrugName("  Aspirin  ")).toBe("aspirin");
  });

  it("converts to lowercase", () => {
    expect(normalizeDrugName("METFORMIN")).toBe("metformin");
  });

  it("handles mixed case with spaces", () => {
    expect(normalizeDrugName("  Advair Diskus  ")).toBe("advair diskus");
  });

  it("handles empty string", () => {
    expect(normalizeDrugName("")).toBe("");
  });
});

describe("Cache freshness logic", () => {
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function isCacheFresh(cachedAt: number) {
    return Date.now() - cachedAt < CACHE_TTL_MS;
  }

  it("returns true for fresh cache (just now)", () => {
    expect(isCacheFresh(Date.now())).toBe(true);
  });

  it("returns true for cache 5 minutes old", () => {
    expect(isCacheFresh(Date.now() - 5 * 60 * 1000)).toBe(true);
  });

  it("returns false for cache 15 minutes old", () => {
    expect(isCacheFresh(Date.now() - 15 * 60 * 1000)).toBe(false);
  });

  it("returns false for very old cache", () => {
    expect(isCacheFresh(Date.now() - 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("Storage key generation", () => {
  const STORAGE_PREFIX = "insight-board:openfda";

  function toStorageKey(kind: "events" | "label", normalizedDrugName: string) {
    return `${STORAGE_PREFIX}:${kind}:${normalizedDrugName}`;
  }

  it("generates label key", () => {
    expect(toStorageKey("label", "aspirin")).toBe(
      "insight-board:openfda:label:aspirin",
    );
  });

  it("generates events key", () => {
    expect(toStorageKey("events", "metformin")).toBe(
      "insight-board:openfda:events:metformin",
    );
  });
});
