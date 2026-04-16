export type InsightStage = "observation" | "insight" | "actionable" | "impact";
export type InsightPriority = "P1" | "P2" | "P3" | "P4";
export type FieldType = "text" | "number" | "date" | "select";
export type BoardViewMode = "list" | "overview";
export type AnalyticsRange = "7d" | "30d" | "90d";
export type PresenceStatus = "active" | "idle";

type CustomFieldDefBase<T extends FieldType = FieldType> = {
  key: string;
  label: string;
  type: T;
};

export type CustomFieldDef<T extends FieldType = FieldType> = T extends "select"
  ? CustomFieldDefBase<T> & { options: string[] }
  : CustomFieldDefBase<T> & { options?: never };

export type CustomFieldDefinition =
  | CustomFieldDef<"text">
  | CustomFieldDef<"number">
  | CustomFieldDef<"date">
  | CustomFieldDef<"select">;

export type CustomFieldValue = string | number | null;

export type User = {
  id: string;
  fullName: string;
  email: string;
  initials: string;
};

export type PresenceUser = User & {
  status: PresenceStatus;
};

export type Hcp = {
  id: string;
  name: string;
  specialty: string;
  institution: string;
  region: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type InsightActivity = {
  id: string;
  insightId: string;
  userId: string;
  action: "created" | "edited" | "moved" | "commented";
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  message: string;
  createdAt: string;
};

export type BoardNotification = {
  id: string;
  insightId: string;
  stage: InsightStage;
  message: string;
  createdAt: string;
  read: boolean;
};

export type Insight = {
  id: string;
  title: string;
  description: string;
  stage: InsightStage;
  priority: InsightPriority;
  categoryId: string | null;
  hcpId: string | null;
  createdBy: string;
  drugName: string;
  tagIds: string[];
  customFields: Record<string, CustomFieldValue>;
  columnOrder: number;
  createdAt: string;
  updatedAt: string;
  viewingUserIds: string[];
  editingUserId: string | null;
  swipeUserId: string | null;
};

export type InsightDraft = {
  id?: string;
  title: string;
  description: string;
  stage: InsightStage;
  priority: InsightPriority;
  categoryId: string | null;
  hcpId: string | null;
  drugName: string;
  tagIds: string[];
  customFields: Record<string, CustomFieldValue>;
};

export type InsightFilters = {
  searchInput: string;
  search: string;
  priorities: InsightPriority[];
  categoryId: string | null;
  hcpId: string | null;
  tagIds: string[];
  dateRange: AnalyticsRange | null;
};

export const stageDefinitions = [
  {
    key: "observation",
    label: "Observation",
    shortLabel: "Observe",
    description: "Raw field notes from fresh HCP conversations.",
  },
  {
    key: "insight",
    label: "Insight",
    shortLabel: "Insight",
    description: "Validated pattern seen across multiple sources.",
  },
  {
    key: "actionable",
    label: "Actionable",
    shortLabel: "Action",
    description: "Clear follow-up exists and someone should own it.",
  },
  {
    key: "impact",
    label: "Impact",
    shortLabel: "Impact",
    description: "Action was taken and the effect is measurable.",
  },
] as const satisfies readonly {
  key: InsightStage;
  label: string;
  shortLabel: string;
  description: string;
}[];

export const priorityDefinitions = [
  { key: "P1", label: "Critical" },
  { key: "P2", label: "Important" },
  { key: "P3", label: "Moderate" },
  { key: "P4", label: "Reference" },
] as const satisfies readonly { key: InsightPriority; label: string }[];

export const defaultInsightFilters: InsightFilters = {
  searchInput: "",
  search: "",
  priorities: [],
  categoryId: null,
  hcpId: null,
  tagIds: [],
  dateRange: null,
};

export const analyticsRanges = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const satisfies readonly { value: AnalyticsRange; label: string }[];

export const setupSteps = [
  {
    id: "supabase-project",
    title: "Create the Supabase project",
    detail:
      "Create a free project, capture the public URL and publishable key, then use that URL to derive the GraphQL endpoint at /graphql/v1.",
  },
  {
    id: "graphql-extension",
    title: "Enable pg_graphql and camelCase inflection",
    detail:
      "Run the extension SQL from the setup guide so GraphQL collections and fields map cleanly from Postgres tables.",
  },
  {
    id: "schema-and-seed",
    title: "Apply schema, users, seed data, and realtime",
    detail:
      "Create the enums, insights tables, activities, user preferences, then seed Alice and Bob plus the sample HCPs, categories, tags, and insights.",
  },
  {
    id: "client-setup",
    title: "Wire Apollo to Supabase auth and pg_graphql",
    detail:
      "Keep cache normalization keyed by nodeId and pass both the apikey and bearer token from the active Supabase session.",
  },
];

export const requiredPackages = [
  "@apollo/client",
  "graphql",
  "react-native-paper",
  "expo-print",
  "expo-sharing",
  "zod",
  "@react-native-async-storage/async-storage",
];

export const assignmentCoverage = [
  "Pipeline board with list and overview modes",
  "Supabase GraphQL reads and mutations for insights, activity, and preferences",
  "Supabase Realtime presence, broadcast, and Postgres change syncing",
  "OpenFDA drug context with cached label and adverse-event lookups",
  "Analytics screen with KPIs, charts, and PDF export",
];
