import { requireOptionalNativeModule } from "expo";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert, Linking, Platform } from "react-native";

type EventSubscription = {
  remove(): void;
};

type SpeechPermissionResponse = {
  granted: boolean;
  canAskAgain: boolean;
};

type SpeechRecognitionResult = {
  transcript: string;
};

type SpeechRecognitionResultEvent = {
  isFinal: boolean;
  results: SpeechRecognitionResult[];
};

type SpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type SpeechRecognitionEventMap = {
  end: null;
  error: SpeechRecognitionErrorEvent;
  result: SpeechRecognitionResultEvent;
  start: null;
};

type SpeechRecognitionStartOptions = {
  interimResults?: boolean;
  lang?: string;
  requiresOnDeviceRecognition?: boolean;
};

type SpeechRecognitionModule = {
  addListener<EventName extends keyof SpeechRecognitionEventMap>(
    eventName: EventName,
    listener: (event: SpeechRecognitionEventMap[EventName]) => void,
  ): EventSubscription;
  isRecognitionAvailable?: () => boolean;
  requestMicrophonePermissionsAsync?: () => Promise<SpeechPermissionResponse>;
  requestPermissionsAsync: () => Promise<SpeechPermissionResponse>;
  start: (options: SpeechRecognitionStartOptions) => void;
  stop: () => void;
};

type SpeechState = {
  isListening: boolean;
  transcript: string;
  error: string | null;
};

type SpeechStateSetter = Dispatch<SetStateAction<SpeechState>>;

const SPEECH_UNAVAILABLE_MESSAGE = "Voice input isn't available in this build.";
const MICROPHONE_PERMISSION_MESSAGE =
  "Microphone permission is required to use voice input.";

let speechModuleCache: SpeechRecognitionModule | null | undefined;

function getSpeechModule(): SpeechRecognitionModule | null {
  if (speechModuleCache !== undefined) {
    return speechModuleCache;
  }

  speechModuleCache = requireOptionalNativeModule<SpeechRecognitionModule>(
    "ExpoSpeechRecognition",
  );

  return speechModuleCache ?? null;
}

function getUnavailableMessage() {
  if (Platform.OS === "android") {
    return "Speech recognition is unavailable on this device right now.";
  }

  if (Platform.OS === "ios") {
    return "Enable Siri and Dictation to use voice input on this device.";
  }

  return "Speech recognition is unavailable on this device right now.";
}

function setSpeechError(setState: SpeechStateSetter, message: string) {
  setState((prev) => ({
    ...prev,
    isListening: false,
    error: message,
  }));
}

function getSpeechModuleOrSetError(setState: SpeechStateSetter) {
  const speech = getSpeechModule();

  if (!speech) {
    setSpeechError(setState, SPEECH_UNAVAILABLE_MESSAGE);
    return null;
  }

  return speech;
}

function getPermissionRequest(speech: SpeechRecognitionModule) {
  const requestMicrophonePermissions = speech.requestMicrophonePermissionsAsync;

  if (Platform.OS === "ios" && requestMicrophonePermissions) {
    return () => requestMicrophonePermissions();
  }

  return () => speech.requestPermissionsAsync();
}

function isRecognitionAvailable(speech: SpeechRecognitionModule) {
  if (typeof speech.isRecognitionAvailable !== "function") {
    return true;
  }

  return speech.isRecognitionAvailable();
}

function useSpeechEvent<EventName extends keyof SpeechRecognitionEventMap>(
  speechModule: SpeechRecognitionModule | null,
  eventName: EventName,
  listener: (event: SpeechRecognitionEventMap[EventName]) => void,
) {
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!speechModule) {
      return;
    }

    const subscription = speechModule.addListener(eventName, (event) => {
      listenerRef.current(event);
    });

    return () => {
      subscription.remove();
    };
  }, [eventName, speechModule]);
}

export function isSpeechRecognitionAvailable() {
  return getSpeechModule() !== null;
}

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    transcript: "",
    error: null,
  });
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const speechModule = getSpeechModule();

  useSpeechEvent(speechModule, "start", () => {
    setState((prev) => ({ ...prev, isListening: true, error: null }));
  });

  useSpeechEvent(speechModule, "end", () => {
    setState((prev) => {
      if (prev.transcript.trim()) {
        onResultRef.current(prev.transcript.trim());
        return { ...prev, isListening: false, transcript: "" };
      } else {
        // If no transcript and no error, set a user-friendly error
        return {
          ...prev,
          isListening: false,
          error: prev.error || "No speech detected, please try again.",
          transcript: "",
        };
      }
    });
  });

  useSpeechEvent(speechModule, "result", (event) => {
    const latestTranscript = event.results[0]?.transcript ?? "";
    setState((prev) => ({ ...prev, transcript: latestTranscript }));
  });

  useSpeechEvent(speechModule, "error", (event) => {
    setState((prev) => ({
      ...prev,
      isListening: false,
      error: event.message || event.error || "Recognition failed",
    }));
  });

  const requestPermission = useCallback(async () => {
    const speech = getSpeechModuleOrSetError(setState);
    if (!speech) {
      return false;
    }

    const requestPermissions = getPermissionRequest(speech);
    const result = await requestPermissions();

    if (result.granted) {
      return true;
    }

    setSpeechError(setState, MICROPHONE_PERMISSION_MESSAGE);

    if (result.canAskAgain === false) {
      Alert.alert(
        "Microphone permission required",
        "InsightBoard needs microphone access for voice notes. Please enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                void Linking.openURL("app-settings:");
              } else {
                void Linking.openSettings();
              }
            },
          },
        ],
      );
    }

    return false;
  }, []);

  const startListening = useCallback(async () => {
    const speech = getSpeechModuleOrSetError(setState);
    if (!speech) {
      return;
    }

    if (!isRecognitionAvailable(speech)) {
      setSpeechError(setState, getUnavailableMessage());
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return;
    }

    setState({ isListening: false, transcript: "", error: null });

    speech.start({
      lang: "en-US",
      interimResults: true,
      requiresOnDeviceRecognition: Platform.OS === "ios",
    });
  }, [requestPermission]);

  const stopListening = useCallback(() => {
    getSpeechModule()?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state.isListening) {
      stopListening();
      return;
    }

    void startListening();
  }, [state.isListening, startListening, stopListening]);

  return {
    available: speechModule !== null,
    isListening: state.isListening,
    transcript: state.transcript,
    error: state.error,
    toggle,
    startListening,
    stopListening,
  };
}
