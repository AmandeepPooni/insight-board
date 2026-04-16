import { useEffect, useState } from "react";

import {
    getDrugEventSummary,
    getDrugLabel,
    OpenFdaError,
    type DrugEventSummary,
    type DrugLabelSummary,
} from "@/lib/services/openfda";

type RequestState<TData> = {
  data: TData | null;
  error: string | null;
  status: "empty" | "error" | "idle" | "loading" | "success";
};

function createIdleState<TData>(): RequestState<TData> {
  return {
    data: null,
    error: null,
    status: "idle",
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof OpenFdaError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load FDA data right now.";
}

export function useDrugContext(drugName: string | null) {
  const [labelState, setLabelState] =
    useState<RequestState<DrugLabelSummary>>(createIdleState);
  const [eventState, setEventState] =
    useState<RequestState<DrugEventSummary>>(createIdleState);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const normalizedDrugName = drugName?.trim() ?? "";
    if (!normalizedDrugName) {
      setLabelState(createIdleState());
      setEventState(createIdleState());
      return;
    }

    let isCancelled = false;

    setLabelState({
      data: null,
      error: null,
      status: "loading",
    });
    setEventState({
      data: null,
      error: null,
      status: "loading",
    });

    void getDrugLabel(normalizedDrugName)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        if (!result) {
          setLabelState({
            data: null,
            error: null,
            status: "empty",
          });
          return;
        }

        setLabelState({
          data: result,
          error: null,
          status: "success",
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setLabelState({
          data: null,
          error: getErrorMessage(error),
          status: "error",
        });
      });

    void getDrugEventSummary(normalizedDrugName)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        if (!result) {
          setEventState({
            data: null,
            error: null,
            status: "empty",
          });
          return;
        }

        setEventState({
          data: result,
          error: null,
          status: "success",
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setEventState({
          data: null,
          error: getErrorMessage(error),
          status: "error",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [drugName, refreshKey]);

  return {
    eventState,
    labelState,
    retry: () => setRefreshKey((current) => current + 1),
  };
}
