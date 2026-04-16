/**
 * Tests for speech recognition hook behavior.
 * Since the hook depends on native modules (expo-speech-recognition),
 * we test the logic patterns and state transitions.
 */

type SpeechState = {
  isListening: boolean;
  transcript: string;
  error: string | null;
};

function createInitialState(): SpeechState {
  return { isListening: false, transcript: "", error: null };
}

/** Simulates the state machine transitions from the speech recognition hook. */
function reduceState(
  state: SpeechState,
  action:
    | { type: "start" }
    | { type: "end" }
    | { type: "result"; transcript: string }
    | { type: "error"; error: string },
): SpeechState {
  switch (action.type) {
    case "start":
      return { ...state, isListening: true, error: null };
    case "end":
      return { ...state, isListening: false, transcript: "" };
    case "result":
      return { ...state, transcript: action.transcript };
    case "error":
      return { ...state, isListening: false, error: action.error };
  }
}

describe("useSpeechRecognition state machine", () => {
  it("initializes in non-listening state", () => {
    const state = createInitialState();
    expect(state.isListening).toBe(false);
    expect(state.transcript).toBe("");
    expect(state.error).toBeNull();
  });

  it("transitions to listening on start", () => {
    let state = createInitialState();
    state = reduceState(state, { type: "start" });
    expect(state.isListening).toBe(true);
    expect(state.error).toBeNull();
  });

  it("clears previous error on start", () => {
    let state: SpeechState = {
      isListening: false,
      transcript: "",
      error: "Previous error",
    };
    state = reduceState(state, { type: "start" });
    expect(state.error).toBeNull();
  });

  it("updates transcript on result event", () => {
    let state = createInitialState();
    state = reduceState(state, { type: "start" });
    state = reduceState(state, {
      type: "result",
      transcript: "HCP mentioned dosage",
    });
    expect(state.transcript).toBe("HCP mentioned dosage");
  });

  it("replaces transcript on subsequent results", () => {
    let state = createInitialState();
    state = reduceState(state, { type: "start" });
    state = reduceState(state, { type: "result", transcript: "partial" });
    state = reduceState(state, {
      type: "result",
      transcript: "partial transcript complete",
    });
    expect(state.transcript).toBe("partial transcript complete");
  });

  it("stops listening and clears transcript on end", () => {
    let state = createInitialState();
    state = reduceState(state, { type: "start" });
    state = reduceState(state, { type: "result", transcript: "Some text" });
    state = reduceState(state, { type: "end" });
    expect(state.isListening).toBe(false);
    expect(state.transcript).toBe("");
  });

  it("sets error and stops listening on error event", () => {
    let state = createInitialState();
    state = reduceState(state, { type: "start" });
    state = reduceState(state, {
      type: "error",
      error: "Recognition failed",
    });
    expect(state.isListening).toBe(false);
    expect(state.error).toBe("Recognition failed");
  });

  it("full lifecycle: start → results → end", () => {
    let state = createInitialState();
    let deliveredText = "";

    state = reduceState(state, { type: "start" });
    expect(state.isListening).toBe(true);

    state = reduceState(state, {
      type: "result",
      transcript: "Drug reaction observed",
    });
    expect(state.transcript).toBe("Drug reaction observed");

    // Before end, capture the transcript for the callback
    if (state.transcript.trim()) {
      deliveredText = state.transcript.trim();
    }
    state = reduceState(state, { type: "end" });

    expect(state.isListening).toBe(false);
    expect(deliveredText).toBe("Drug reaction observed");
  });
});
