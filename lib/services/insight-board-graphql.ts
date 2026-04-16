import { gql } from "@apollo/client";

import {
  type BoardNotification,
  type Category,
  type CustomFieldDefinition,
  type CustomFieldValue,
  type Hcp,
  type Insight,
  type InsightActivity,
  type InsightPriority,
  type InsightStage,
  type Tag,
  type User,
} from "@/lib/insight-board-schema";
import { getStageLabel } from "@/lib/insight-utils";

type Connection<TNode> = {
  edges?:
    | ({
        node?: TNode | null;
      } | null)[]
    | null;
} | null;

type GraphqlUserNode = {
  id: string;
  email: string;
  fullName: string;
};

type GraphqlCategoryNode = {
  id: string;
  name: string;
  color: string;
};

type GraphqlTagNode = {
  id: string;
  name: string;
};

type GraphqlHcpNode = {
  id: string;
  name: string;
  specialty: string;
  institution: string;
  region: string;
};

type GraphqlInsightNode = {
  id: string;
  title: string;
  description: string | null;
  stage: InsightStage;
  priority: InsightPriority;
  categoryId: string | null;
  hcpId: string | null;
  createdBy: string;
  drugName: string | null;
  customFields: unknown;
  columnOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  insightTagsCollection?: Connection<{
    tagId: string;
  }>;
};

type GraphqlActivityNode = {
  id: string;
  insightId: string;
  userId: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user?: GraphqlUserNode | null;
  insight?: {
    id: string;
    title: string;
    stage: InsightStage;
  } | null;
};

type GraphqlPreferenceNode = {
  id: string;
  userId: string;
  customFieldDefinitions: unknown;
};

export type InsightBoardBootstrapData = {
  usersCollection?: Connection<GraphqlUserNode>;
  categoriesCollection?: Connection<GraphqlCategoryNode>;
  tagsCollection?: Connection<GraphqlTagNode>;
  hcpsCollection?: Connection<GraphqlHcpNode>;
  insightsCollection?: Connection<GraphqlInsightNode>;
  insightActivitiesCollection?: Connection<GraphqlActivityNode>;
  userPreferencesCollection?: Connection<GraphqlPreferenceNode>;
};

export type InsightBoardBootstrapVariables = {
  insightFilter?: Record<string, unknown> | null;
};

export type InsightBoardMetadataData = Omit<
  InsightBoardBootstrapData,
  "insightsCollection" | "insightActivitiesCollection"
>;

export type InsightActivityConnectionData = {
  insightActivitiesCollection?: Connection<GraphqlActivityNode>;
};

export type LiveBoardSnapshot = {
  teamUsers: User[];
  currentUser: User;
  categories: Category[];
  tags: Tag[];
  hcps: Hcp[];
  insights: Insight[];
  activities: InsightActivity[];
  notifications: BoardNotification[];
  customFieldDefinitions: CustomFieldDefinition[];
  currentUserPreferenceId: string | null;
};

export const INSIGHT_BOARD_METADATA_QUERY = gql`
  query InsightBoardMetadata {
    usersCollection(first: 50) {
      edges {
        node {
          nodeId
          id
          email
          fullName
        }
      }
    }
    categoriesCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
          color
        }
      }
    }
    tagsCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
        }
      }
    }
    hcpsCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
          specialty
          institution
          region
        }
      }
    }
    userPreferencesCollection(first: 50) {
      edges {
        node {
          nodeId
          id
          userId
          customFieldDefinitions
        }
      }
    }
  }
`;

export const RECENT_BOARD_ACTIVITY_QUERY = gql`
  query RecentBoardActivity {
    insightActivitiesCollection(
      first: 20
      orderBy: [{ createdAt: DescNullsLast }]
    ) {
      edges {
        node {
          nodeId
          id
          insightId
          userId
          action
          fieldName
          oldValue
          newValue
          createdAt
          user {
            nodeId
            id
            email
            fullName
          }
          insight {
            nodeId
            id
            title
            stage
          }
        }
      }
    }
  }
`;

export const INSIGHT_ACTIVITIES_QUERY = gql`
  query InsightActivities($insightId: UUID!) {
    insightActivitiesCollection(
      first: 50
      filter: { insightId: { eq: $insightId } }
      orderBy: [{ createdAt: DescNullsLast }]
    ) {
      edges {
        node {
          nodeId
          id
          insightId
          userId
          action
          fieldName
          oldValue
          newValue
          createdAt
          user {
            nodeId
            id
            email
            fullName
          }
          insight {
            nodeId
            id
            title
            stage
          }
        }
      }
    }
  }
`;

export const INSIGHT_BOARD_BOOTSTRAP_QUERY = gql`
  query InsightBoardBootstrap($insightFilter: InsightsFilter) {
    usersCollection(first: 50) {
      edges {
        node {
          nodeId
          id
          email
          fullName
        }
      }
    }
    categoriesCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
          color
        }
      }
    }
    tagsCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
        }
      }
    }
    hcpsCollection(first: 100) {
      edges {
        node {
          nodeId
          id
          name
          specialty
          institution
          region
        }
      }
    }
    userPreferencesCollection(first: 50) {
      edges {
        node {
          nodeId
          id
          userId
          customFieldDefinitions
        }
      }
    }
    insightsCollection(first: 500, filter: $insightFilter) {
      edges {
        node {
          nodeId
          id
          title
          description
          stage
          priority
          categoryId
          hcpId
          createdBy
          drugName
          customFields
          columnOrder
          isArchived
          createdAt
          updatedAt
          insightTagsCollection(first: 50) {
            edges {
              node {
                nodeId
                tagId
              }
            }
          }
        }
      }
    }
    insightActivitiesCollection(first: 500) {
      edges {
        node {
          nodeId
          id
          insightId
          userId
          action
          fieldName
          oldValue
          newValue
          createdAt
          user {
            nodeId
            id
            email
            fullName
          }
          insight {
            nodeId
            id
            title
            stage
          }
        }
      }
    }
  }
`;

export const CREATE_INSIGHT_MUTATION = gql`
  mutation CreateInsight($objects: [InsightsInsertInput!]!) {
    insertIntoInsightsCollection(objects: $objects) {
      records {
        nodeId
        id
      }
    }
  }
`;

export const UPDATE_INSIGHT_MUTATION = gql`
  mutation UpdateInsight(
    $id: UUID!
    $set: InsightsUpdateInput!
    $atMost: Int!
  ) {
    updateInsightsCollection(
      set: $set
      filter: { id: { eq: $id } }
      atMost: $atMost
    ) {
      records {
        nodeId
        id
      }
    }
  }
`;

export const INSERT_INSIGHT_TAGS_MUTATION = gql`
  mutation InsertInsightTags($objects: [InsightTagsInsertInput!]!) {
    insertIntoInsightTagsCollection(objects: $objects) {
      affectedCount
    }
  }
`;

export const DELETE_INSIGHT_TAGS_MUTATION = gql`
  mutation DeleteInsightTags($insightId: UUID!, $atMost: Int!) {
    deleteFromInsightTagsCollection(
      filter: { insightId: { eq: $insightId } }
      atMost: $atMost
    ) {
      affectedCount
    }
  }
`;

export const INSERT_ACTIVITY_MUTATION = gql`
  mutation InsertActivity($objects: [InsightActivitiesInsertInput!]!) {
    insertIntoInsightActivitiesCollection(objects: $objects) {
      affectedCount
    }
  }
`;

export const INSERT_USER_PREFERENCES_MUTATION = gql`
  mutation InsertUserPreferences($objects: [UserPreferencesInsertInput!]!) {
    insertIntoUserPreferencesCollection(objects: $objects) {
      records {
        nodeId
        id
      }
    }
  }
`;

export const UPDATE_USER_PREFERENCES_MUTATION = gql`
  mutation UpdateUserPreferences(
    $userId: UUID!
    $set: UserPreferencesUpdateInput!
    $atMost: Int!
  ) {
    updateUserPreferencesCollection(
      set: $set
      filter: { userId: { eq: $userId } }
      atMost: $atMost
    ) {
      records {
        nodeId
        id
      }
    }
  }
`;

export function serializeGraphqlJsonValue(value: unknown) {
  return JSON.stringify(value);
}

function parseGraphqlJsonValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function connectionNodes<TNode>(connection: Connection<TNode> | undefined) {
  return (connection?.edges ?? []).flatMap((edge) =>
    edge?.node ? [edge.node] : [],
  );
}

function getInitials(fullName: string, email: string) {
  const nameParts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

function toUser(node: GraphqlUserNode): User {
  return {
    id: node.id,
    fullName: node.fullName,
    email: node.email,
    initials: getInitials(node.fullName, node.email),
  };
}

function isInsightStage(
  value: string | null | undefined,
): value is InsightStage {
  return (
    value === "observation" ||
    value === "insight" ||
    value === "actionable" ||
    value === "impact"
  );
}

function sanitizeCustomFields(
  value: unknown,
): Record<string, CustomFieldValue> {
  const parsedValue = parseGraphqlJsonValue(value);

  if (
    !parsedValue ||
    typeof parsedValue !== "object" ||
    Array.isArray(parsedValue)
  ) {
    return {};
  }

  const result: Record<string, CustomFieldValue> = {};

  for (const [key, entry] of Object.entries(parsedValue)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      entry === null
    ) {
      result[key] = entry;
    }
  }

  return result;
}

function isCustomFieldDefinition(
  value: unknown,
): value is CustomFieldDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<CustomFieldDefinition> & {
    options?: unknown;
  };

  if (
    typeof candidate.key !== "string" ||
    typeof candidate.label !== "string" ||
    (candidate.type !== "text" &&
      candidate.type !== "number" &&
      candidate.type !== "date" &&
      candidate.type !== "select")
  ) {
    return false;
  }

  if (candidate.type !== "select") {
    return true;
  }

  return (
    Array.isArray(candidate.options) &&
    candidate.options.every((item) => typeof item === "string")
  );
}

function parseCustomFieldDefinitions(value: unknown) {
  const parsedValue = parseGraphqlJsonValue(value);

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue.filter(isCustomFieldDefinition);
}

function buildActivityMessage(activity: GraphqlActivityNode) {
  const actorName = activity.user?.fullName?.split(" ")[0] ?? "A teammate";
  const title = activity.insight?.title?.slice(0, 28) ?? "an insight";

  if (activity.action === "created") {
    return `${actorName} created '${title}'.`;
  }

  if (activity.action === "moved") {
    const nextStage = isInsightStage(activity.newValue)
      ? activity.newValue
      : activity.insight?.stage;

    return nextStage
      ? `${actorName} moved '${title}' to ${getStageLabel(nextStage)}.`
      : `${actorName} moved '${title}'.`;
  }

  if (activity.action === "commented") {
    return `${actorName} commented on '${title}'.`;
  }

  return `${actorName} updated '${title}'.`;
}

function normalizeActivityAction(action: string): InsightActivity["action"] {
  if (
    action === "created" ||
    action === "edited" ||
    action === "moved" ||
    action === "commented"
  ) {
    return action;
  }

  return "edited";
}

function mapActivityNode(node: GraphqlActivityNode): InsightActivity {
  return {
    id: node.id,
    insightId: node.insightId,
    userId: node.userId,
    action: normalizeActivityAction(node.action),
    fieldName: node.fieldName ?? undefined,
    oldValue: node.oldValue ?? undefined,
    newValue: node.newValue ?? undefined,
    message: buildActivityMessage(node),
    createdAt: node.createdAt,
  };
}

function buildFallbackUser(
  sessionUser: {
    email: string | null;
    fullName: string;
    id: string | null;
  } | null,
): User {
  const email = sessionUser?.email?.trim() || "current.user@local";
  const fullName =
    sessionUser?.fullName?.trim() || email.split("@")[0] || "Current User";

  return {
    id: sessionUser?.id ?? "current-user",
    email,
    fullName,
    initials: getInitials(fullName, email),
  };
}

export function mapBoardBootstrapData(
  data: InsightBoardBootstrapData | undefined,
  sessionUser: {
    email: string | null;
    fullName: string;
    id: string | null;
  } | null,
): LiveBoardSnapshot {
  const teamUsers = connectionNodes(data?.usersCollection).map(toUser);
  const currentUser =
    teamUsers.find((user) => user.id === sessionUser?.id) ??
    buildFallbackUser(sessionUser);

  const categories = connectionNodes(data?.categoriesCollection).map(
    (node) => ({
      id: node.id,
      name: node.name,
      color: node.color,
    }),
  );

  const tags = connectionNodes(data?.tagsCollection).map((node) => ({
    id: node.id,
    name: node.name,
  }));

  const hcps = connectionNodes(data?.hcpsCollection).map((node) => ({
    id: node.id,
    name: node.name,
    specialty: node.specialty,
    institution: node.institution,
    region: node.region,
  }));

  const insights = connectionNodes(data?.insightsCollection)
    .filter((node) => !node.isArchived)
    .map((node) => ({
      id: node.id,
      title: node.title,
      description: node.description ?? "",
      stage: node.stage,
      priority: node.priority,
      categoryId: node.categoryId,
      hcpId: node.hcpId,
      createdBy: node.createdBy,
      drugName: node.drugName ?? "",
      tagIds: connectionNodes(node.insightTagsCollection).map(
        (tagNode) => tagNode.tagId,
      ),
      customFields: sanitizeCustomFields(node.customFields),
      columnOrder: node.columnOrder,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      viewingUserIds: [],
      editingUserId: null,
      swipeUserId: null,
    }))
    .sort((left, right) => left.columnOrder - right.columnOrder);

  const activities = connectionNodes(data?.insightActivitiesCollection)
    .map(mapActivityNode)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

  const insightsById = new Map(
    insights.map((insight) => [insight.id, insight]),
  );
  const notifications = activities.slice(0, 20).map((activity) => ({
    id: activity.id,
    insightId: activity.insightId,
    stage: insightsById.get(activity.insightId)?.stage ?? "observation",
    message: activity.message,
    createdAt: activity.createdAt,
    read: false,
  }));

  const currentUserPreference = connectionNodes(
    data?.userPreferencesCollection,
  ).find((preference) => preference.userId === currentUser.id);
  const customFieldDefinitions =
    parseCustomFieldDefinitions(
      currentUserPreference?.customFieldDefinitions,
    ) || [];

  return {
    teamUsers,
    currentUser,
    categories,
    tags,
    hcps,
    insights,
    activities,
    notifications,
    customFieldDefinitions,
    currentUserPreferenceId: currentUserPreference?.id ?? null,
  };
}

export function mapActivityConnectionToActivities(
  data: InsightActivityConnectionData | undefined,
) {
  return connectionNodes(data?.insightActivitiesCollection)
    .map(mapActivityNode)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
}

export function mapActivityConnectionToNotifications(
  data: InsightActivityConnectionData | undefined,
) {
  return connectionNodes(data?.insightActivitiesCollection).map((node) => ({
    id: node.id,
    insightId: node.insightId,
    stage: node.insight?.stage ?? "observation",
    message: buildActivityMessage(node),
    createdAt: node.createdAt,
    read: false,
  }));
}
