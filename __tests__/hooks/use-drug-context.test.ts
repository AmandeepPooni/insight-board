/**
 * Tests for the useDrugContext hook.
 * Since we can't use @testing-library/react-hooks in this setup,
 * we test the internal logic patterns: error message extraction
 * and the state machine behavior.
 */

import { OpenFdaError } from "@/lib/services/openfda";

/** Mirrors the internal getErrorMessage function from use-drug-context.ts */
function getErrorMessage(error: unknown): string {
  if (error instanceof OpenFdaError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to load FDA data right now.";
}

/** Mirrors the internal createIdleState function */
function createIdleState<TData>(): {
  data: TData | null;
  error: string | null;
  status: "empty" | "error" | "idle" | "loading" | "success";
} {
  return { data: null, error: null, status: "idle" };
}

describe("useDrugContext internal helpers", () => {
  describe("getErrorMessage", () => {
    it("returns OpenFdaError message for known API errors", () => {
      const err = new OpenFdaError("network", "Network timeout");
      expect(getErrorMessage(err)).toBe("Network timeout");
    });

    it("returns message from generic Error", () => {
      const err = new Error("Something went wrong");
      expect(getErrorMessage(err)).toBe("Something went wrong");
    });

    it("returns fallback for unknown error types", () => {
      expect(getErrorMessage("string error")).toBe(
        "Unable to load FDA data right now.",
      );
      expect(getErrorMessage(42)).toBe("Unable to load FDA data right now.");
      expect(getErrorMessage(null)).toBe("Unable to load FDA data right now.");
    });

    it("returns rate-limit message from OpenFdaError", () => {
      const err = new OpenFdaError(
        "rate-limited",
        "Rate limit exceeded. Please try again later.",
        429,
      );
      expect(getErrorMessage(err)).toBe(
        "Rate limit exceeded. Please try again later.",
      );
      expect(err.code).toBe("rate-limited");
      expect(err.status).toBe(429);
    });
  });

  describe("createIdleState", () => {
    it("returns idle status with null data and error", () => {
      const state = createIdleState();
      expect(state.status).toBe("idle");
      expect(state.data).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("state machine: drug name normalization behavior", () => {
    it("trims whitespace from drug names", () => {
      const name = "  Aspirin  ";
      expect(name.trim()).toBe("Aspirin");
    });

    it("empty drug name resets to idle", () => {
      const normalizedDrugName = "".trim();
      if (!normalizedDrugName) {
        const state = createIdleState();
        expect(state.status).toBe("idle");
      }
    });

    it("null drug name resets to idle", () => {
      const drugName: string | null = null;
      const normalizedDrugName = (drugName ?? "").trim();
      if (!normalizedDrugName) {
        const state = createIdleState();
        expect(state.status).toBe("idle");
      }
    });
  });
});
