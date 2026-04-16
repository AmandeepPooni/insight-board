import AsyncStorage from "@react-native-async-storage/async-storage";

const OPEN_FDA_BASE_URL = "https://api.fda.gov";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RATE_LIMIT_RETRIES = 3;
const STORAGE_PREFIX = "insight-board:openfda";
const LABEL_SEARCH_FIELDS = [
  "openfda.brand_name",
  "openfda.generic_name",
  "openfda.substance_name",
] as const;
const EVENT_SEARCH_FIELDS = [
  "patient.drug.openfda.brand_name",
  "patient.drug.openfda.generic_name",
  "patient.drug.medicinalproduct",
] as const;

type CacheSource = "network" | "cache";

type OpenFdaMeta = {
  results?: {
    total?: number;
  };
};

type OpenFdaLabelApiResponse = {
  meta?: OpenFdaMeta;
  results?: OpenFdaLabelApiResult[];
  error?: {
    code?: string;
    message?: string;
  };
};

type OpenFdaLabelApiResult = {
  boxed_warning?: string[];
  dosage_and_administration?: string[];
  dosage_forms_and_strengths?: string[];
  indications_and_usage?: string[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    route?: string[];
    substance_name?: string[];
  };
  warnings?: string[];
  warnings_and_cautions?: string[];
  warnings_and_precautions?: string[];
};

type OpenFdaEventApiResponse = {
  meta?: OpenFdaMeta;
  results?: OpenFdaEventApiResult[];
  error?: {
    code?: string;
    message?: string;
  };
};

type OpenFdaEventApiResult = {
  count: number;
  term: string;
};

type CacheEnvelope<TData> = {
  cachedAt: number;
  data: TData;
};

export type DrugReaction = {
  count: number;
  label: string;
};

export type DrugLabelSummary = {
  boxedWarning: string | null;
  brandName: string;
  dosageForms: string[];
  fetchedAt: number;
  indication: string | null;
  slowLoad: boolean;
  source: CacheSource;
};

export type DrugEventSummary = {
  brandName: string;
  fetchedAt: number;
  reactions: DrugReaction[];
  slowLoad: boolean;
  source: CacheSource;
};

export class OpenFdaError extends Error {
  readonly code: "empty" | "http" | "network" | "rate-limited" | "response";
  readonly status: number | null;

  constructor(
    code: OpenFdaError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const labelCache = new Map<string, CacheEnvelope<DrugLabelSummary>>();
const eventCache = new Map<string, CacheEnvelope<DrugEventSummary>>();

function normalizeDrugName(drugName: string) {
  return drugName.trim().toLowerCase();
}

function escapeOpenFdaSearchValue(drugName: string) {
  return drugName.trim().replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildOpenFdaSearchQuery(fields: readonly string[], drugName: string) {
  const escapedDrugName = escapeOpenFdaSearchValue(drugName);
  return fields.map((field) => `${field}:"${escapedDrugName}"`).join(" OR ");
}

function buildOpenFdaUrl(
  path: "/drug/event.json" | "/drug/label.json",
  params: Record<string, number | string>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  return `${OPEN_FDA_BASE_URL}${path}?${searchParams.toString()}`;
}

export function isLikelyPlaceholderDrugName(drugName: string) {
  const normalizedDrugName = normalizeDrugName(drugName).replace(/\s+/g, " ");

  return (
    /^drug [a-z0-9]+$/.test(normalizedDrugName) ||
    /^product [a-z0-9]+$/.test(normalizedDrugName) ||
    /^molecule [a-z0-9]+$/.test(normalizedDrugName)
  );
}

function toStorageKey(kind: "events" | "label", normalizedDrugName: string) {
  return `${STORAGE_PREFIX}:${kind}:${normalizedDrugName}`;
}

function isCacheFresh(cachedAt: number) {
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function dedupe<TValue>(values: TValue[]) {
  return Array.from(new Set(values));
}

function cleanOpenFdaText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .replace(/^\d+(?:\.\d+)?\s+[A-Z][A-Z\s()/-]+\s*/g, "")
    .trim();
}

function toSentence(value: string | null | undefined) {
  const cleaned = cleanOpenFdaText(value);
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/.*?[.](?:\s|$)/);
  if (match?.[0]) {
    return match[0].trim();
  }

  return cleaned.slice(0, 220).trim();
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function extractDosageForms(result: OpenFdaLabelApiResult) {
  const dosageText = cleanOpenFdaText(
    result.dosage_forms_and_strengths?.[0] ??
      result.dosage_and_administration?.[0] ??
      null,
  );

  const strengths = dedupe(
    Array.from(
      dosageText.matchAll(/\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|mL|ml|units?|%)\b/gi),
      (match) => match[0],
    ),
  ).slice(0, 5);

  if (strengths.length) {
    return strengths;
  }

  const routes = result.openfda?.route ?? [];
  return dedupe(routes.map((route) => toTitleCase(route))).slice(0, 3);
}

async function readPersistedCache<TData>(
  kind: "events" | "label",
  normalizedDrugName: string,
) {
  const rawValue = await AsyncStorage.getItem(
    toStorageKey(kind, normalizedDrugName),
  );

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as CacheEnvelope<TData>;
  } catch {
    return null;
  }
}

async function writePersistedCache<TData>(
  kind: "events" | "label",
  normalizedDrugName: string,
  envelope: CacheEnvelope<TData>,
) {
  await AsyncStorage.setItem(
    toStorageKey(kind, normalizedDrugName),
    JSON.stringify(envelope),
  );
}

async function getCachedValue<TData>(
  kind: "events" | "label",
  cache: Map<string, CacheEnvelope<TData>>,
  normalizedDrugName: string,
  allowStale: boolean,
) {
  const memoryValue = cache.get(normalizedDrugName) ?? null;
  if (memoryValue && (allowStale || isCacheFresh(memoryValue.cachedAt))) {
    return memoryValue;
  }

  const persistedValue = await readPersistedCache<TData>(
    kind,
    normalizedDrugName,
  );

  if (!persistedValue) {
    return null;
  }

  cache.set(normalizedDrugName, persistedValue);

  if (allowStale || isCacheFresh(persistedValue.cachedAt)) {
    return persistedValue;
  }

  return null;
}

async function writeCacheValue<TData>(
  kind: "events" | "label",
  cache: Map<string, CacheEnvelope<TData>>,
  normalizedDrugName: string,
  data: TData,
) {
  const envelope: CacheEnvelope<TData> = {
    cachedAt: Date.now(),
    data,
  };

  cache.set(normalizedDrugName, envelope);
  await writePersistedCache(kind, normalizedDrugName, envelope);
}

async function fetchJsonWithRetry<TResponse>(url: string) {
  let attempt = 0;
  let slowLoad = false;

  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    let response: Response;

    try {
      response = await fetch(url);
    } catch {
      throw new OpenFdaError(
        "network",
        "Unable to reach OpenFDA. Check your connection and try again.",
      );
    }

    if (response.status === 429) {
      if (attempt === MAX_RATE_LIMIT_RETRIES) {
        throw new OpenFdaError(
          "rate-limited",
          "OpenFDA is rate limiting requests right now.",
          response.status,
        );
      }

      slowLoad = true;
      const retryDelayMs = 400 * 2 ** attempt;
      attempt += 1;
      await sleep(retryDelayMs);
      continue;
    }

    const payload = (await response
      .json()
      .catch(() => null)) as TResponse | null;

    if (response.status === 404) {
      return {
        payload,
        slowLoad,
        status: "empty" as const,
      };
    }

    if (!response.ok || !payload) {
      throw new OpenFdaError(
        "http",
        "OpenFDA returned an unexpected response.",
        response.status,
      );
    }

    return {
      payload,
      slowLoad,
      status: "success" as const,
    };
  }

  throw new OpenFdaError(
    "response",
    "OpenFDA did not return a usable payload.",
  );
}

function withCacheSource<
  TData extends { fetchedAt: number; source: CacheSource },
>(data: TData, source: CacheSource) {
  return {
    ...data,
    source,
  };
}

export async function getDrugLabel(drugName: string) {
  const normalizedDrugName = normalizeDrugName(drugName);
  if (!normalizedDrugName) {
    throw new OpenFdaError("empty", "Drug name is required.");
  }

  const trimmedDrugName = drugName.trim();

  const freshCache = await getCachedValue(
    "label",
    labelCache,
    normalizedDrugName,
    false,
  );
  if (freshCache) {
    return withCacheSource(freshCache.data, "cache");
  }

  const labelUrl = buildOpenFdaUrl("/drug/label.json", {
    search: buildOpenFdaSearchQuery(LABEL_SEARCH_FIELDS, trimmedDrugName),
    limit: 1,
  });

  try {
    const result = await fetchJsonWithRetry<OpenFdaLabelApiResponse>(labelUrl);
    if (result.status === "empty" || !result.payload?.results?.length) {
      return null;
    }

    const labelResult = result.payload.results[0];
    const summary: DrugLabelSummary = {
      brandName:
        labelResult.openfda?.brand_name?.[0] ??
        labelResult.openfda?.generic_name?.[0] ??
        labelResult.openfda?.substance_name?.[0] ??
        trimmedDrugName,
      boxedWarning: toSentence(
        labelResult.boxed_warning?.[0] ??
          labelResult.warnings?.[0] ??
          labelResult.warnings_and_precautions?.[0] ??
          labelResult.warnings_and_cautions?.[0] ??
          null,
      ),
      dosageForms: extractDosageForms(labelResult),
      fetchedAt: Date.now(),
      indication: toSentence(labelResult.indications_and_usage?.[0] ?? null),
      slowLoad: result.slowLoad,
      source: "network",
    };

    await writeCacheValue("label", labelCache, normalizedDrugName, summary);
    return summary;
  } catch (error) {
    const staleCache = await getCachedValue(
      "label",
      labelCache,
      normalizedDrugName,
      true,
    );
    if (staleCache) {
      return withCacheSource(staleCache.data, "cache");
    }

    throw error;
  }
}

export async function getDrugEventSummary(drugName: string) {
  const normalizedDrugName = normalizeDrugName(drugName);
  if (!normalizedDrugName) {
    throw new OpenFdaError("empty", "Drug name is required.");
  }

  const trimmedDrugName = drugName.trim();

  const freshCache = await getCachedValue(
    "events",
    eventCache,
    normalizedDrugName,
    false,
  );
  if (freshCache) {
    return withCacheSource(freshCache.data, "cache");
  }

  const eventUrl = buildOpenFdaUrl("/drug/event.json", {
    search: buildOpenFdaSearchQuery(EVENT_SEARCH_FIELDS, trimmedDrugName),
    count: "patient.reaction.reactionmeddrapt.exact",
    limit: 5,
  });

  try {
    const result = await fetchJsonWithRetry<OpenFdaEventApiResponse>(eventUrl);
    if (result.status === "empty" || !result.payload?.results?.length) {
      return null;
    }

    const summary: DrugEventSummary = {
      brandName: trimmedDrugName,
      fetchedAt: Date.now(),
      reactions: result.payload.results.map((reaction) => ({
        count: reaction.count,
        label: toTitleCase(reaction.term),
      })),
      slowLoad: result.slowLoad,
      source: "network",
    };

    await writeCacheValue("events", eventCache, normalizedDrugName, summary);
    return summary;
  } catch (error) {
    const staleCache = await getCachedValue(
      "events",
      eventCache,
      normalizedDrugName,
      true,
    );
    if (staleCache) {
      return withCacheSource(staleCache.data, "cache");
    }

    throw error;
  }
}
