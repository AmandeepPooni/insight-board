import { useApolloClient, useQuery } from "@apollo/client/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
    PropsWithChildren,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState, LayoutAnimation, Platform, UIManager } from "react-native";
import { useDebounceValue } from "usehooks-ts";

import { useBackend } from "@/components/providers/backend-provider";
import { drugSearchIndex } from "@/lib/drug-search-index";
import {
    defaultInsightFilters,
    setupSteps,
    stageDefinitions,
    type BoardNotification,
    type BoardViewMode,
    type Category,
    type CustomFieldDefinition,
    type Hcp,
    type Insight,
    type InsightDraft,
    type InsightFilters,
    type InsightStage,
    type PresenceStatus,
    type PresenceUser,
    type Tag,
    type User,
} from "@/lib/insight-board-schema";
import { getStageLabel, sortInsightsForStage } from "@/lib/insight-utils";
import {
    fetchFilteredStageCounts,
    fetchInsightById,
    fetchNextColumnOrder,
    fetchStageInsightPage,
    fetchTotalStageCounts,
} from "@/lib/services/insight-board-data";
import {
    CREATE_INSIGHT_MUTATION,
    DELETE_INSIGHT_TAGS_MUTATION,
    INSERT_ACTIVITY_MUTATION,
    INSERT_INSIGHT_TAGS_MUTATION,
    INSERT_USER_PREFERENCES_MUTATION,
    INSIGHT_BOARD_METADATA_QUERY,
    RECENT_BOARD_ACTIVITY_QUERY,
    UPDATE_INSIGHT_MUTATION,
    UPDATE_USER_PREFERENCES_MUTATION,
    mapActivityConnectionToNotifications,
    mapBoardBootstrapData,
    serializeGraphqlJsonValue,
    type InsightActivityConnectionData,
    type InsightBoardMetadataData,
} from "@/lib/services/insight-board-graphql";
import { supabase } from "@/lib/services/supabase";

type ConnectionState =
  | "auth-required"
  | "config-required"
  | "error"
  | "live"
  | "loading";

type PresenceMeta = {
  email: string;
  fullName: string;
  initials: string;
  lastActiveAt: string;
  status: PresenceStatus;
  userId: string;
};

type CollaborationBroadcastPayload = {
  insightId: string | null;
  kind: "editing" | "swiping" | "viewing";
  userId: string;
};

type SwipeSignal = {
  expiresAt: number;
  insightId: string;
};

type OptimisticStageMove = {
  fromColumnOrder: number;
  fromStage: InsightStage;
  toColumnOrder: number;
  toStage: InsightStage;
  updatedAt: string;
};

type StageCache = {
  hasLoaded: boolean;
  hasMore: boolean;
  insights: Insight[];
  isLoading: boolean;
  isLoadingMore: boolean;
  nextOffset: number;
};

type StageCountRecord = Record<InsightStage, number>;

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_TAGS: Tag[] = [];
const EMPTY_HCPS: Hcp[] = [];
const EMPTY_USERS: User[] = [];
const EMPTY_CUSTOM_FIELD_DEFINITIONS: CustomFieldDefinition[] = [];

type InsightBoardContextValue = {
  connectionState: ConnectionState;
  isBoardLoading: boolean;
  backendError: string | null;
  insights: Insight[];
  notifications: BoardNotification[];
  categories: Category[];
  tags: Tag[];
  hcps: Hcp[];
  teamUsers: User[];
  presenceUsers: PresenceUser[];
  stageDefinitions: typeof stageDefinitions;
  currentUser: User;
  customFieldDefinitions: CustomFieldDefinition[];
  drugSearchIndex: readonly string[];
  setupSteps: typeof setupSteps;
  selectedStage: InsightStage;
  setSelectedStage: (stage: InsightStage) => void;
  viewMode: BoardViewMode;
  setViewMode: (mode: BoardViewMode) => void;
  filters: InsightFilters;
  hasActiveFilters: boolean;
  setSearchInput: (value: string) => void;
  togglePriorityFilter: (priority: Insight["priority"]) => void;
  setCategoryFilter: (categoryId: string | null) => void;
  setHcpFilter: (hcpId: string | null) => void;
  toggleTagFilter: (tagId: string) => void;
  setDateRangeFilter: (range: InsightFilters["dateRange"]) => void;
  clearFilters: () => void;
  getInsightsForStage: (stage: InsightStage) => Insight[];
  getStageCounts: (stage: InsightStage) => { total: number; filtered: number };
  hasMoreInsightsForStage: (stage: InsightStage) => boolean;
  isLoadingMoreForStage: (stage: InsightStage) => boolean;
  loadMoreInsightsForStage: (stage: InsightStage) => void;
  ensureInsightLoaded: (insightId: string) => Promise<Insight | null>;
  totalInsightCount: number;
  moveInsightToStage: (insightId: string, stage: InsightStage) => void;
  saveInsight: (draft: InsightDraft) => Promise<boolean>;
  addCustomFieldDefinition: (definition: CustomFieldDefinition) => void;
  announceViewingInsight: (insightId: string | null) => void;
  announceEditingInsight: (insightId: string | null) => void;
  announceSwipingInsight: (insightId: string | null) => void;
  unreadNotificationCount: number;
  markNotificationsRead: () => void;
  feedbackMessage: string | null;
  dismissFeedback: () => void;
  isRefreshing: boolean;
  refreshBoard: () => void;
};

const InsightBoardContext = createContext<InsightBoardContextValue | null>(
  null,
);

function getSessionUserFullName(
  sessionEmail: string | null,
  metadata: unknown,
) {
  if (metadata && typeof metadata === "object") {
    const fullName = (metadata as { full_name?: string; name?: string })
      .full_name;
    if (typeof fullName === "string" && fullName.trim()) {
      return fullName.trim();
    }

    const name = (metadata as { full_name?: string; name?: string }).name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }

  if (sessionEmail?.trim()) {
    return sessionEmail.split("@")[0] || "Current User";
  }

  return "Current User";
}

function getUnavailableFeedbackMessage(connectionState: ConnectionState) {
  if (connectionState === "config-required") {
    return "Configure the Supabase public URL and key first.";
  }

  if (connectionState === "auth-required") {
    return "Sign in to load the live board.";
  }

  if (connectionState === "loading") {
    return "Live board is still connecting.";
  }

  return "The live board is not available right now.";
}

function replaceUserSignal(
  currentSignals: Record<string, string>,
  userId: string,
  insightId: string | null,
) {
  const nextSignals = { ...currentSignals };
  delete nextSignals[userId];

  if (insightId) {
    nextSignals[userId] = insightId;
  }

  return nextSignals;
}

function mapSignalsByInsight(signalsByUser: Record<string, string>) {
  const nextSignals: Record<string, string[]> = {};

  for (const [userId, insightId] of Object.entries(signalsByUser)) {
    if (!nextSignals[insightId]) {
      nextSignals[insightId] = [];
    }

    nextSignals[insightId].push(userId);
  }

  return nextSignals;
}

function mapSingleSignalByInsight(signalsByUser: Record<string, string>) {
  const nextSignals: Record<string, string> = {};

  for (const [userId, insightId] of Object.entries(signalsByUser)) {
    nextSignals[insightId] = userId;
  }

  return nextSignals;
}

function animateNextBoardLayout() {
  if (Platform.OS === "web") {
    return;
  }

  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function createEmptyStageCounts(): StageCountRecord {
  return {
    observation: 0,
    insight: 0,
    actionable: 0,
    impact: 0,
  };
}

function createEmptyStageCache(): StageCache {
  return {
    hasLoaded: false,
    hasMore: true,
    insights: [],
    isLoading: false,
    isLoadingMore: false,
    nextOffset: 0,
  };
}

function createEmptyStageCaches(): Record<InsightStage, StageCache> {
  return {
    observation: createEmptyStageCache(),
    insight: createEmptyStageCache(),
    actionable: createEmptyStageCache(),
    impact: createEmptyStageCache(),
  };
}

function dedupeInsights(insights: Insight[]) {
  const insightsById = new Map<string, Insight>();

  for (const insight of insights) {
    insightsById.set(insight.id, insight);
  }

  return Array.from(insightsById.values());
}

export function InsightBoardProvider({ children }: PropsWithChildren) {
  const apolloClient = useApolloClient();
  const { authError, isConfigured, isSessionLoading, session } = useBackend();
  const [selectedStageState, setSelectedStageState] =
    useState<InsightStage>("observation");
  const [viewModeState, setViewModeState] = useState<BoardViewMode>("list");
  const [filters, setFilters] = useState<InsightFilters>(defaultInsightFilters);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [optimisticStageMoves, setOptimisticStageMoves] = useState<
    Record<string, OptimisticStageMove>
  >({});
  const [presenceByUser, setPresenceByUser] = useState<
    Record<string, PresenceMeta>
  >({});
  const [viewingByUser, setViewingByUser] = useState<Record<string, string>>(
    {},
  );
  const [editingByUser, setEditingByUser] = useState<Record<string, string>>(
    {},
  );
  const [swipingByUser, setSwipingByUser] = useState<
    Record<string, SwipeSignal>
  >({});
  const [stageCaches, setStageCaches] = useState(createEmptyStageCaches);
  const [hydratedInsightsById, setHydratedInsightsById] = useState<
    Record<string, Insight>
  >({});
  const [totalStageCounts, setTotalStageCounts] = useState<StageCountRecord>(
    createEmptyStageCounts,
  );
  const [filteredStageCounts, setFilteredStageCounts] =
    useState<StageCountRecord>(createEmptyStageCounts);
  const [boardDataVersion, setBoardDataVersion] = useState(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const swipeTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const localSwipeBroadcastTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastActivityAtRef = useRef(Date.now());
  const currentPresenceStatusRef = useRef<PresenceStatus>("active");
  const stageCachesRef = useRef(stageCaches);
  const hydratedInsightsRef = useRef(hydratedInsightsById);
  const [debouncedSearchInput] = useDebounceValue(filters.searchInput, 300);

  const sessionUser = {
    email: session?.user.email ?? null,
    fullName: getSessionUserFullName(
      session?.user.email ?? null,
      session?.user.user_metadata,
    ),
    id: session?.user.id ?? null,
  };

  const metadataQuery = useQuery<InsightBoardMetadataData>(
    INSIGHT_BOARD_METADATA_QUERY,
    {
      skip: !isConfigured || !session,
    },
  );
  const recentActivityQuery = useQuery<InsightActivityConnectionData>(
    RECENT_BOARD_ACTIVITY_QUERY,
    {
      skip: !isConfigured || !session,
    },
  );

  const metadataSnapshot = mapBoardBootstrapData(
    metadataQuery.data,
    sessionUser,
  );
  const connectionState: ConnectionState = !isConfigured
    ? "config-required"
    : isSessionLoading && !session
      ? "loading"
      : !session
        ? "auth-required"
        : metadataQuery.loading && !metadataQuery.data
          ? "loading"
          : metadataQuery.error && !metadataQuery.data
            ? "error"
            : "live";

  const requestVersion = `${connectionState}:${boardDataVersion}:${JSON.stringify(
    {
      categoryId: filters.categoryId,
      dateRange: filters.dateRange,
      hcpId: filters.hcpId,
      priorities: [...filters.priorities].sort(),
      search: filters.search,
      tagIds: [...filters.tagIds].sort(),
    },
  )}`;
  const requestVersionRef = useRef(requestVersion);

  useEffect(() => {
    requestVersionRef.current = requestVersion;
  }, [requestVersion]);

  useEffect(() => {
    stageCachesRef.current = stageCaches;
  }, [stageCaches]);

  useEffect(() => {
    hydratedInsightsRef.current = hydratedInsightsById;
  }, [hydratedInsightsById]);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    setFilters((currentFilters) => {
      const trimmedSearch = debouncedSearchInput.trim();
      if (trimmedSearch === currentFilters.search) {
        return currentFilters;
      }

      return {
        ...currentFilters,
        search: trimmedSearch,
      };
    });
  }, [debouncedSearchInput]);

  const sourceCategories =
    connectionState === "live" ? metadataSnapshot.categories : EMPTY_CATEGORIES;
  const sourceTags =
    connectionState === "live" ? metadataSnapshot.tags : EMPTY_TAGS;
  const sourceHcps =
    connectionState === "live" ? metadataSnapshot.hcps : EMPTY_HCPS;
  const sourceTeamUsers =
    connectionState === "live" ? metadataSnapshot.teamUsers : EMPTY_USERS;
  const sourceCustomFieldDefinitions =
    connectionState === "live"
      ? metadataSnapshot.customFieldDefinitions
      : EMPTY_CUSTOM_FIELD_DEFINITIONS;
  const sourceCurrentUser = metadataSnapshot.currentUser;

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.priorities.length ||
    filters.categoryId ||
    filters.hcpId ||
    filters.tagIds.length ||
    filters.dateRange,
  );

  const searchHcpIds = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    if (!normalizedSearch) {
      return [];
    }

    return sourceHcps
      .filter((hcp) => hcp.name.toLowerCase().includes(normalizedSearch))
      .map((hcp) => hcp.id);
  }, [filters.search, sourceHcps]);

  const clearSwipeSignal = useCallback((userId: string) => {
    const timeout = swipeTimeoutsRef.current[userId];
    if (timeout) {
      clearTimeout(timeout);
      delete swipeTimeoutsRef.current[userId];
    }

    setSwipingByUser((currentSignals) => {
      if (!currentSignals[userId]) {
        return currentSignals;
      }

      const nextSignals = { ...currentSignals };
      delete nextSignals[userId];
      return nextSignals;
    });
  }, []);

  const scheduleSwipeSignalExpiry = useCallback(
    (userId: string) => {
      const timeout = swipeTimeoutsRef.current[userId];
      if (timeout) {
        clearTimeout(timeout);
      }

      swipeTimeoutsRef.current[userId] = setTimeout(() => {
        clearSwipeSignal(userId);
      }, 1600);
    },
    [clearSwipeSignal],
  );

  useEffect(() => {
    if (connectionState !== "live") {
      setReadNotificationIds([]);
      setStageCaches(createEmptyStageCaches());
      setHydratedInsightsById({});
      setOptimisticStageMoves({});
      setTotalStageCounts(createEmptyStageCounts());
      setFilteredStageCounts(createEmptyStageCounts());
      setPresenceByUser({});
      setViewingByUser({});
      setEditingByUser({});
      setSwipingByUser({});
      currentPresenceStatusRef.current = "active";
      return;
    }

    setReadNotificationIds([]);
  }, [connectionState, session?.user.id]);

  const touchActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    currentPresenceStatusRef.current = "active";
  }, []);

  const trackPresence = useCallback(
    async (status: PresenceStatus) => {
      const channel = realtimeChannelRef.current;
      if (!channel || connectionState !== "live") {
        return;
      }

      currentPresenceStatusRef.current = status;

      await channel.track({
        email: sourceCurrentUser.email,
        fullName: sourceCurrentUser.fullName,
        initials: sourceCurrentUser.initials,
        lastActiveAt: new Date(lastActivityAtRef.current).toISOString(),
        status,
        userId: sourceCurrentUser.id,
      });
    },
    [
      connectionState,
      sourceCurrentUser.email,
      sourceCurrentUser.fullName,
      sourceCurrentUser.id,
      sourceCurrentUser.initials,
    ],
  );

  const sendBroadcast = useCallback(
    async (payload: CollaborationBroadcastPayload) => {
      const channel = realtimeChannelRef.current;
      if (!channel || connectionState !== "live") {
        return;
      }

      await channel.send({
        type: "broadcast",
        event: "collaboration",
        payload,
      });
    },
    [connectionState],
  );

  const clearAllCollaborationTimeouts = useCallback(() => {
    for (const timeout of Object.values(swipeTimeoutsRef.current)) {
      clearTimeout(timeout);
    }

    if (localSwipeBroadcastTimeoutRef.current) {
      clearTimeout(localSwipeBroadcastTimeoutRef.current);
    }
  }, []);

  const resetLoadedBoardData = useCallback(() => {
    setStageCaches(createEmptyStageCaches());
    setHydratedInsightsById({});
    setOptimisticStageMoves({});
  }, []);

  const invalidateBoardData = useCallback(
    (options?: {
      refetchMetadata?: boolean;
      refetchNotifications?: boolean;
    }) => {
      resetLoadedBoardData();
      setBoardDataVersion((currentVersion) => currentVersion + 1);

      if (options?.refetchMetadata) {
        void metadataQuery.refetch();
      }

      if (options?.refetchNotifications !== false) {
        void recentActivityQuery.refetch();
      }
    },
    [metadataQuery, recentActivityQuery, resetLoadedBoardData],
  );

  const handleCollaborationBroadcast = useCallback(
    (payload: CollaborationBroadcastPayload) => {
      if (!payload || payload.userId === sourceCurrentUser.id) {
        return;
      }

      if (payload.kind === "viewing") {
        setViewingByUser((currentSignals) =>
          replaceUserSignal(currentSignals, payload.userId, payload.insightId),
        );
        return;
      }

      if (payload.kind === "editing") {
        setEditingByUser((currentSignals) =>
          replaceUserSignal(currentSignals, payload.userId, payload.insightId),
        );
        return;
      }

      if (!payload.insightId) {
        clearSwipeSignal(payload.userId);
        return;
      }

      const insightId = payload.insightId;

      setSwipingByUser((currentSignals) => ({
        ...currentSignals,
        [payload.userId]: {
          expiresAt: Date.now() + 1600,
          insightId,
        },
      }));
      scheduleSwipeSignalExpiry(payload.userId);
    },
    [clearSwipeSignal, scheduleSwipeSignalExpiry, sourceCurrentUser.id],
  );

  useEffect(() => {
    if (connectionState !== "live" || !session) {
      return;
    }

    const channel = supabase.channel("insight-board", {
      config: {
        broadcast: { self: false },
        presence: { key: session.user.id },
      },
    });
    realtimeChannelRef.current = channel;

    const syncPresence = () => {
      const rawState = channel.presenceState() as Record<
        string,
        PresenceMeta[]
      >;
      const nextPresence: Record<string, PresenceMeta> = {};

      for (const entries of Object.values(rawState)) {
        for (const entry of entries) {
          if (entry?.userId) {
            nextPresence[entry.userId] = entry;
          }
        }
      }

      setPresenceByUser(nextPresence);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("broadcast", { event: "collaboration" }, ({ payload }) => {
        handleCollaborationBroadcast(payload as CollaborationBroadcastPayload);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insights" },
        () => {
          invalidateBoardData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insight_activities" },
        () => {
          void recentActivityQuery.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insight_tags" },
        () => {
          invalidateBoardData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          void metadataQuery.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tags" },
        () => {
          void metadataQuery.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hcps" },
        () => {
          void metadataQuery.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences" },
        () => {
          void metadataQuery.refetch();
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          return;
        }

        touchActivity();
        void trackPresence("active");
      });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        appStateRef.current = nextState;

        if (nextState === "active") {
          touchActivity();
          void trackPresence("active");
          return;
        }

        currentPresenceStatusRef.current = "idle";
        void channel.untrack();
      },
    );

    return () => {
      appStateSubscription.remove();
      realtimeChannelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [
    connectionState,
    handleCollaborationBroadcast,
    invalidateBoardData,
    metadataQuery,
    recentActivityQuery,
    session,
    touchActivity,
    trackPresence,
  ]);

  useEffect(() => {
    if (connectionState !== "live") {
      return;
    }

    const timer = setInterval(() => {
      if (appStateRef.current !== "active") {
        return;
      }

      const isIdle = Date.now() - lastActivityAtRef.current >= 2 * 60 * 1000;
      const nextStatus: PresenceStatus = isIdle ? "idle" : "active";
      if (nextStatus === currentPresenceStatusRef.current) {
        return;
      }

      void trackPresence(nextStatus);
    }, 30000);

    return () => clearInterval(timer);
  }, [connectionState, trackPresence]);

  useEffect(() => {
    return clearAllCollaborationTimeouts;
  }, [clearAllCollaborationTimeouts]);

  useEffect(() => {
    if (connectionState !== "live") {
      return;
    }

    resetLoadedBoardData();
  }, [
    connectionState,
    filters.categoryId,
    filters.dateRange,
    filters.hcpId,
    filters.priorities,
    filters.search,
    filters.tagIds,
    resetLoadedBoardData,
  ]);

  useEffect(() => {
    if (connectionState !== "live") {
      return;
    }

    let isCancelled = false;

    void fetchTotalStageCounts()
      .then((counts) => {
        if (!isCancelled) {
          setTotalStageCounts(counts);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setFeedbackMessage(
            error instanceof Error
              ? error.message
              : "Unable to load stage counts.",
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [boardDataVersion, connectionState]);

  useEffect(() => {
    if (connectionState !== "live") {
      return;
    }

    if (!hasActiveFilters) {
      setFilteredStageCounts(totalStageCounts);
      return;
    }

    let isCancelled = false;

    void fetchFilteredStageCounts(filters, searchHcpIds)
      .then((counts) => {
        if (!isCancelled) {
          setFilteredStageCounts(counts);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setFeedbackMessage(
            error instanceof Error
              ? error.message
              : "Unable to load filtered stage counts.",
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    boardDataVersion,
    connectionState,
    filters,
    hasActiveFilters,
    searchHcpIds,
    totalStageCounts,
  ]);

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const loadStagePage = useCallback(
    async (stage: InsightStage, append: boolean) => {
      if (connectionState !== "live") {
        return;
      }

      const currentCache = stageCachesRef.current[stage];
      if (append) {
        if (
          currentCache.isLoading ||
          currentCache.isLoadingMore ||
          !currentCache.hasMore
        ) {
          return;
        }
      } else if (currentCache.isLoading) {
        return;
      }

      const requestToken = requestVersionRef.current;
      const nextOffset = append ? currentCache.nextOffset : 0;

      setStageCaches((currentCaches) => ({
        ...currentCaches,
        [stage]: {
          ...currentCaches[stage],
          hasLoaded: append ? currentCaches[stage].hasLoaded : false,
          hasMore: append ? currentCaches[stage].hasMore : true,
          insights: append ? currentCaches[stage].insights : [],
          isLoading: !append,
          isLoadingMore: append,
          nextOffset: append ? currentCaches[stage].nextOffset : 0,
        },
      }));

      try {
        const result = await fetchStageInsightPage({
          filters,
          offset: nextOffset,
          searchHcpIds,
          stage,
        });

        if (requestVersionRef.current !== requestToken) {
          return;
        }

        setStageCaches((currentCaches) => {
          const mergedInsights = append
            ? sortInsightsForStage(
                dedupeInsights([
                  ...currentCaches[stage].insights,
                  ...result.insights,
                ]),
              )
            : result.insights;

          return {
            ...currentCaches,
            [stage]: {
              hasLoaded: true,
              hasMore: result.hasMore,
              insights: mergedInsights,
              isLoading: false,
              isLoadingMore: false,
              nextOffset: mergedInsights.length,
            },
          };
        });
      } catch (error) {
        if (requestVersionRef.current !== requestToken) {
          return;
        }

        setStageCaches((currentCaches) => ({
          ...currentCaches,
          [stage]: {
            ...currentCaches[stage],
            isLoading: false,
            isLoadingMore: false,
          },
        }));
        setFeedbackMessage(
          getErrorMessage(error, "Unable to load stage insights."),
        );
      }
    },
    [connectionState, filters, searchHcpIds],
  );

  useEffect(() => {
    if (connectionState !== "live") {
      return;
    }

    const currentStageCache = stageCachesRef.current[selectedStageState];
    if (currentStageCache.hasLoaded || currentStageCache.isLoading) {
      return;
    }

    void loadStagePage(selectedStageState, false);
  }, [
    boardDataVersion,
    connectionState,
    filters.categoryId,
    filters.dateRange,
    filters.hcpId,
    filters.priorities,
    filters.search,
    filters.tagIds,
    loadStagePage,
    selectedStageState,
  ]);

  const viewingByInsight = mapSignalsByInsight(viewingByUser);
  const editingByInsight = mapSingleSignalByInsight(editingByUser);
  const swipingSignalsByUser = Object.fromEntries(
    Object.entries(swipingByUser)
      .filter(([, signal]) => signal.expiresAt > Date.now())
      .map(([userId, signal]) => [userId, signal.insightId]),
  );
  const swipingByInsight = mapSingleSignalByInsight(swipingSignalsByUser);

  const loadedStageInsights = useMemo(
    () => Object.values(stageCaches).flatMap((cache) => cache.insights),
    [stageCaches],
  );

  const sourceInsights =
    connectionState === "live"
      ? dedupeInsights([
          ...loadedStageInsights,
          ...Object.values(hydratedInsightsById),
        ]).map((insight) => ({
          ...insight,
          stage: optimisticStageMoves[insight.id]?.toStage ?? insight.stage,
          columnOrder:
            optimisticStageMoves[insight.id]?.toColumnOrder ??
            insight.columnOrder,
          updatedAt:
            optimisticStageMoves[insight.id]?.updatedAt ?? insight.updatedAt,
          editingUserId: editingByInsight[insight.id] ?? null,
          swipeUserId: swipingByInsight[insight.id] ?? null,
          viewingUserIds: viewingByInsight[insight.id] ?? [],
        }))
      : [];

  const sourcePresenceUsers =
    connectionState === "live"
      ? Object.values(presenceByUser)
          .map((presence) => {
            const matchingUser = sourceTeamUsers.find(
              (user) => user.id === presence.userId,
            ) ?? {
              email: presence.email,
              fullName: presence.fullName,
              id: presence.userId,
              initials: presence.initials,
            };

            return {
              ...matchingUser,
              status: presence.status,
            };
          })
          .sort((left, right) => {
            if (left.id === sourceCurrentUser.id) {
              return -1;
            }

            if (right.id === sourceCurrentUser.id) {
              return 1;
            }

            return left.fullName.localeCompare(right.fullName);
          })
      : [];

  const sourceNotifications =
    connectionState === "live"
      ? mapActivityConnectionToNotifications(recentActivityQuery.data).map(
          (notification) => ({
            ...notification,
            read: readNotificationIds.includes(notification.id),
          }),
        )
      : [];

  const currentStageCache = stageCaches[selectedStageState];
  const hasSelectedStageInsights = sourceInsights.some(
    (insight) => insight.stage === selectedStageState,
  );
  const isBoardLoading =
    connectionState === "loading" ||
    (connectionState === "live" &&
      !currentStageCache.hasLoaded &&
      !hasSelectedStageInsights);
  const backendError =
    authError ??
    metadataQuery.error?.message ??
    recentActivityQuery.error?.message ??
    null;

  const getInsightsForStage = (stage: InsightStage) =>
    sortInsightsForStage(
      sourceInsights.filter((insight) => insight.stage === stage),
    );

  const getStageCounts = (stage: InsightStage) => ({
    total: totalStageCounts[stage] ?? 0,
    filtered: hasActiveFilters
      ? (filteredStageCounts[stage] ?? 0)
      : (totalStageCounts[stage] ?? 0),
  });

  const syncInsightTags = async (insightId: string, tagIds: string[]) => {
    await apolloClient.mutate({
      mutation: DELETE_INSIGHT_TAGS_MUTATION,
      variables: {
        insightId,
        atMost: 250,
      },
    });

    if (!tagIds.length) {
      return;
    }

    await apolloClient.mutate({
      mutation: INSERT_INSIGHT_TAGS_MUTATION,
      variables: {
        objects: tagIds.map((tagId) => ({ insightId, tagId })),
      },
    });
  };

  const createRemoteActivity = async (
    insightId: string,
    activity: {
      action: "created" | "edited" | "moved" | "commented";
      createdAt: string;
      fieldName?: string;
      newValue?: string;
      oldValue?: string;
    },
  ) => {
    if (!session) {
      return;
    }

    await apolloClient.mutate({
      mutation: INSERT_ACTIVITY_MUTATION,
      variables: {
        objects: [
          {
            insightId,
            userId: session.user.id,
            action: activity.action,
            fieldName: activity.fieldName ?? null,
            oldValue: activity.oldValue ?? null,
            newValue: activity.newValue ?? null,
            createdAt: activity.createdAt,
          },
        ],
      },
    });
  };

  const toRemoteCustomFields = (customFields: InsightDraft["customFields"]) => {
    const nextFields: Record<string, string | number | null> = {};

    for (const [key, value] of Object.entries(customFields)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        value === null
      ) {
        nextFields[key] = value;
      }
    }

    return nextFields;
  };

  const moveRemoteInsightToStage = async (
    insightId: string,
    stage: InsightStage,
  ) => {
    if (connectionState !== "live") {
      setFeedbackMessage(getUnavailableFeedbackMessage(connectionState));
      return;
    }

    const targetInsight = sourceInsights.find((item) => item.id === insightId);
    if (
      !targetInsight ||
      targetInsight.stage === stage ||
      optimisticStageMoves[insightId]
    ) {
      return;
    }

    touchActivity();

    const nextColumnOrder = await fetchNextColumnOrder(stage);
    const timestamp = new Date().toISOString();

    animateNextBoardLayout();
    setOptimisticStageMoves((currentMoves) => ({
      ...currentMoves,
      [insightId]: {
        fromColumnOrder: targetInsight.columnOrder,
        fromStage: targetInsight.stage,
        toColumnOrder: nextColumnOrder,
        toStage: stage,
        updatedAt: timestamp,
      },
    }));

    try {
      await apolloClient.mutate({
        mutation: UPDATE_INSIGHT_MUTATION,
        variables: {
          id: insightId,
          set: {
            stage,
            columnOrder: nextColumnOrder,
            updatedAt: timestamp,
          },
          atMost: 1,
        },
      });
    } catch (error) {
      animateNextBoardLayout();
      setOptimisticStageMoves((currentMoves) => {
        if (!currentMoves[insightId]) {
          return currentMoves;
        }

        const nextMoves = { ...currentMoves };
        delete nextMoves[insightId];
        return nextMoves;
      });
      setFeedbackMessage(
        `${getErrorMessage(error, "Unable to move insight.")} Returned to ${getStageLabel(targetInsight.stage)}.`,
      );
      return;
    }

    void createRemoteActivity(insightId, {
      action: "moved",
      fieldName: "stage",
      oldValue: targetInsight.stage,
      newValue: stage,
      createdAt: timestamp,
    }).catch(() => undefined);

    invalidateBoardData();
    setFeedbackMessage(`Moved to ${getStageLabel(stage)}.`);
  };

  const saveRemoteInsight = async (draft: InsightDraft) => {
    if (connectionState !== "live" || !session) {
      setFeedbackMessage(getUnavailableFeedbackMessage(connectionState));
      return false;
    }

    touchActivity();

    const timestamp = new Date().toISOString();
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      stage: draft.stage,
      priority: draft.priority,
      categoryId: draft.categoryId,
      hcpId: draft.hcpId,
      drugName: draft.drugName.trim() || null,
      customFields: serializeGraphqlJsonValue(
        toRemoteCustomFields(draft.customFields),
      ),
      updatedAt: timestamp,
    };

    if (draft.id) {
      await apolloClient.mutate({
        mutation: UPDATE_INSIGHT_MUTATION,
        variables: {
          id: draft.id,
          set: payload,
          atMost: 1,
        },
      });

      await syncInsightTags(draft.id, draft.tagIds);
      await createRemoteActivity(draft.id, {
        action: "edited",
        createdAt: timestamp,
      });
      invalidateBoardData();
      setFeedbackMessage("Insight updated.");
      return true;
    }

    const nextColumnOrder = await fetchNextColumnOrder(draft.stage);

    const response = await apolloClient.mutate<{
      insertIntoInsightsCollection?: {
        records?: { id: string }[];
      };
    }>({
      mutation: CREATE_INSIGHT_MUTATION,
      variables: {
        objects: [
          {
            ...payload,
            createdBy: session.user.id,
            columnOrder: nextColumnOrder,
            isArchived: false,
            createdAt: timestamp,
          },
        ],
      },
    });

    const insertedInsightId =
      response.data?.insertIntoInsightsCollection?.records?.[0]?.id ?? null;

    if (!insertedInsightId) {
      throw new Error("The insight was created but no ID was returned.");
    }

    await syncInsightTags(insertedInsightId, draft.tagIds);
    await createRemoteActivity(insertedInsightId, {
      action: "created",
      createdAt: timestamp,
    });

    setSelectedStageState(draft.stage);
    setViewModeState("list");
    invalidateBoardData();
    setFeedbackMessage("Insight created.");
    return true;
  };

  const saveRemoteCustomFieldDefinition = async (
    definition: CustomFieldDefinition,
  ) => {
    if (connectionState !== "live" || !session) {
      setFeedbackMessage(getUnavailableFeedbackMessage(connectionState));
      return;
    }

    touchActivity();

    const alreadyExists = sourceCustomFieldDefinitions.some(
      (item) => item.key === definition.key,
    );
    if (alreadyExists) {
      setFeedbackMessage("Custom field key already exists.");
      return;
    }

    const nextDefinitions = [...sourceCustomFieldDefinitions, definition];

    if (metadataSnapshot.currentUserPreferenceId) {
      await apolloClient.mutate({
        mutation: UPDATE_USER_PREFERENCES_MUTATION,
        variables: {
          userId: session.user.id,
          set: {
            customFieldDefinitions: serializeGraphqlJsonValue(nextDefinitions),
          },
          atMost: 1,
        },
      });
    } else {
      await apolloClient.mutate({
        mutation: INSERT_USER_PREFERENCES_MUTATION,
        variables: {
          objects: [
            {
              userId: session.user.id,
              customFieldDefinitions:
                serializeGraphqlJsonValue(nextDefinitions),
            },
          ],
        },
      });
    }

    await metadataQuery.refetch();
    setFeedbackMessage("Custom field added.");
  };

  const markNotificationsRead = () => {
    if (connectionState !== "live") {
      return;
    }

    const unreadIds = sourceNotifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    setReadNotificationIds((currentIds) => {
      const missingIds = unreadIds.filter((id) => !currentIds.includes(id));
      return missingIds.length ? [...currentIds, ...missingIds] : currentIds;
    });
  };

  const refreshBoard = () => {
    if (connectionState !== "live") {
      setFeedbackMessage(getUnavailableFeedbackMessage(connectionState));
      return;
    }

    touchActivity();
    setIsRefreshing(true);
    resetLoadedBoardData();
    setBoardDataVersion((currentVersion) => currentVersion + 1);
    void Promise.all([metadataQuery.refetch(), recentActivityQuery.refetch()])
      .then(() => {
        setFeedbackMessage("Board refreshed.");
      })
      .catch((error) => {
        setFeedbackMessage(getErrorMessage(error, "Unable to refresh board."));
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  };

  const setSelectedStage = (stage: InsightStage) => {
    touchActivity();
    setSelectedStageState(stage);
  };

  const setViewMode = (mode: BoardViewMode) => {
    touchActivity();
    setViewModeState(mode);
  };

  const loadMoreInsightsForStage = (stage: InsightStage) => {
    touchActivity();
    void loadStagePage(stage, true);
  };

  const ensureInsightLoaded = useCallback(async (insightId: string) => {
    const loadedInsight =
      stageCachesRef.current.observation.insights
        .concat(stageCachesRef.current.insight.insights)
        .concat(stageCachesRef.current.actionable.insights)
        .concat(stageCachesRef.current.impact.insights)
        .find((insight) => insight.id === insightId) ??
      hydratedInsightsRef.current[insightId] ??
      null;

    if (loadedInsight) {
      return loadedInsight;
    }

    const fetchedInsight = await fetchInsightById(insightId);
    if (!fetchedInsight) {
      return null;
    }

    setHydratedInsightsById((currentInsights) => ({
      ...currentInsights,
      [insightId]: fetchedInsight,
    }));
    return fetchedInsight;
  }, []);

  const moveInsightToStage = (insightId: string, stage: InsightStage) => {
    void moveRemoteInsightToStage(insightId, stage);
  };

  const saveInsight = (draft: InsightDraft) => {
    return saveRemoteInsight(draft).catch((error) => {
      setFeedbackMessage(getErrorMessage(error, "Unable to save insight."));
      return false;
    });
  };

  const addCustomFieldDefinition = (definition: CustomFieldDefinition) => {
    void saveRemoteCustomFieldDefinition(definition).catch((error) => {
      setFeedbackMessage(
        getErrorMessage(error, "Unable to save custom field definition."),
      );
    });
  };

  const announceViewingInsight = useCallback(
    (insightId: string | null) => {
      touchActivity();

      if (connectionState !== "live") {
        return;
      }

      void sendBroadcast({
        insightId,
        kind: "viewing",
        userId: sourceCurrentUser.id,
      });
    },
    [connectionState, sendBroadcast, sourceCurrentUser.id, touchActivity],
  );

  const announceEditingInsight = useCallback(
    (insightId: string | null) => {
      touchActivity();

      if (connectionState !== "live") {
        return;
      }

      void sendBroadcast({
        insightId,
        kind: "editing",
        userId: sourceCurrentUser.id,
      });
    },
    [connectionState, sendBroadcast, sourceCurrentUser.id, touchActivity],
  );

  const announceSwipingInsight = useCallback(
    (insightId: string | null) => {
      touchActivity();

      if (connectionState !== "live") {
        return;
      }

      if (localSwipeBroadcastTimeoutRef.current) {
        clearTimeout(localSwipeBroadcastTimeoutRef.current);
        localSwipeBroadcastTimeoutRef.current = null;
      }

      void sendBroadcast({
        insightId,
        kind: "swiping",
        userId: sourceCurrentUser.id,
      });

      if (!insightId) {
        return;
      }

      localSwipeBroadcastTimeoutRef.current = setTimeout(() => {
        void sendBroadcast({
          insightId: null,
          kind: "swiping",
          userId: sourceCurrentUser.id,
        });
        localSwipeBroadcastTimeoutRef.current = null;
      }, 1600);
    },
    [connectionState, sendBroadcast, sourceCurrentUser.id, touchActivity],
  );

  const totalInsightCount = Object.values(totalStageCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  const contextValue: InsightBoardContextValue = {
    connectionState,
    isBoardLoading,
    backendError,
    insights: sourceInsights,
    notifications: sourceNotifications,
    categories: sourceCategories,
    tags: sourceTags,
    hcps: sourceHcps,
    teamUsers: sourceTeamUsers,
    presenceUsers: sourcePresenceUsers,
    stageDefinitions,
    currentUser: sourceCurrentUser,
    customFieldDefinitions: sourceCustomFieldDefinitions,
    drugSearchIndex,
    setupSteps,
    selectedStage: selectedStageState,
    setSelectedStage,
    viewMode: viewModeState,
    setViewMode,
    filters,
    hasActiveFilters,
    setSearchInput: (value) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        searchInput: value,
      }));
    },
    togglePriorityFilter: (priority) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        priorities: currentFilters.priorities.includes(priority)
          ? currentFilters.priorities.filter((item) => item !== priority)
          : [...currentFilters.priorities, priority],
      }));
    },
    setCategoryFilter: (categoryId) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        categoryId,
      }));
    },
    setHcpFilter: (hcpId) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        hcpId,
      }));
    },
    toggleTagFilter: (tagId) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        tagIds: currentFilters.tagIds.includes(tagId)
          ? currentFilters.tagIds.filter((item) => item !== tagId)
          : [...currentFilters.tagIds, tagId],
      }));
    },
    setDateRangeFilter: (range) => {
      touchActivity();
      setFilters((currentFilters) => ({
        ...currentFilters,
        dateRange: range,
      }));
    },
    clearFilters: () => {
      touchActivity();
      setFilters(defaultInsightFilters);
    },
    getInsightsForStage,
    getStageCounts,
    hasMoreInsightsForStage: (stage) => stageCaches[stage].hasMore,
    isLoadingMoreForStage: (stage) => stageCaches[stage].isLoadingMore,
    loadMoreInsightsForStage,
    ensureInsightLoaded,
    totalInsightCount,
    moveInsightToStage,
    saveInsight,
    addCustomFieldDefinition,
    announceViewingInsight,
    announceEditingInsight,
    announceSwipingInsight,
    unreadNotificationCount: sourceNotifications.filter(
      (notification) => !notification.read,
    ).length,
    markNotificationsRead,
    feedbackMessage,
    dismissFeedback: () => setFeedbackMessage(null),
    isRefreshing,
    refreshBoard,
  };

  return (
    <InsightBoardContext.Provider value={contextValue}>
      {children}
    </InsightBoardContext.Provider>
  );
}

export function useInsightBoard() {
  const context = useContext(InsightBoardContext);

  if (!context) {
    throw new Error("useInsightBoard must be used within InsightBoardProvider");
  }

  return context;
}
