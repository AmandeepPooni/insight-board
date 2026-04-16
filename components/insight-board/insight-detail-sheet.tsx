import { useQuery } from "@apollo/client/react";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Text,
} from "react-native-paper";

import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDrugContext } from "@/hooks/use-drug-context";
import {
  type CustomFieldDefinition,
  type CustomFieldValue,
  type Insight,
} from "@/lib/insight-board-schema";
import { getRelativeTimeLabel } from "@/lib/insight-utils";
import {
  INSIGHT_ACTIVITIES_QUERY,
  mapActivityConnectionToActivities,
  type InsightActivityConnectionData,
} from "@/lib/services/insight-board-graphql";
import { isLikelyPlaceholderDrugName } from "@/lib/services/openfda";

type InsightDetailSheetProps = {
  insight: Insight | null;
  visible: boolean;
  onDismiss: () => void;
  onEdit: (insight: Insight) => void;
  onMoveToStage: (insight: Insight, stage: Insight["stage"]) => void;
};

function getStageChipProps(label: string, selected: boolean) {
  return {
    accessibilityHint: "Double tap to move this insight to the selected stage.",
    accessibilityLabel: `${label}${selected ? ", current stage" : ""}`,
    accessibilityRole: "checkbox" as const,
    accessibilityState: { checked: selected },
  };
}

function getCustomFieldLabel(
  key: string,
  definition: CustomFieldDefinition | undefined,
) {
  if (definition) {
    return definition.label;
  }

  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getCustomFieldDisplayValue(
  definition: CustomFieldDefinition | undefined,
  value: CustomFieldValue,
) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    if (definition?.type === "date") {
      const parsedDate = new Date(trimmedValue);

      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }

    return trimmedValue;
  }

  return String(value);
}

export function InsightDetailSheet({
  insight,
  visible,
  onDismiss,
  onEdit,
  onMoveToStage,
}: InsightDetailSheetProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const {
    categories,
    customFieldDefinitions,
    currentUser,
    hcps,
    presenceUsers,
    stageDefinitions,
    tags,
  } = useInsightBoard();
  const { eventState, labelState, retry } = useDrugContext(
    insight?.drugName ?? null,
  );
  const activitiesQuery = useQuery<InsightActivityConnectionData>(
    INSIGHT_ACTIVITIES_QUERY,
    {
      skip: !insight?.id || !visible,
      variables: {
        insightId: insight?.id ?? "",
      },
    },
  );

  if (!insight) {
    return null;
  }

  const hcp = hcps.find((item) => item.id === insight.hcpId) ?? null;
  const category =
    categories.find((item) => item.id === insight.categoryId) ?? null;
  const insightActivities = mapActivityConnectionToActivities(
    activitiesQuery.data,
  );
  const viewingUsers = presenceUsers.filter(
    (user) =>
      user.id !== currentUser.id && insight.viewingUserIds.includes(user.id),
  );
  const isTimelineLoading = activitiesQuery.loading && visible;
  const hasInsightActivities = insightActivities.length > 0;
  const hasDrugContext = Boolean(insight.drugName.trim());
  const likelyPlaceholderDrugName = hasDrugContext
    ? isLikelyPlaceholderDrugName(insight.drugName)
    : false;
  const viewingNames = viewingUsers.map((user) => user.fullName.split(" ")[0]);
  const viewingBannerTitle =
    viewingNames.length === 1
      ? `${viewingNames[0]} is also viewing`
      : `${viewingNames.join(", ")} are also viewing`;
  const maxReactionCount =
    eventState.status === "success" && eventState.data
      ? Math.max(...eventState.data.reactions.map((reaction) => reaction.count))
      : 0;
  const customFieldEntries = Object.entries(insight.customFields)
    .map(([key, value]) => {
      const definition = customFieldDefinitions.find(
        (field) => field.key === key,
      );
      const displayValue = getCustomFieldDisplayValue(definition, value);

      if (displayValue === null) {
        return null;
      }

      return {
        key,
        label: getCustomFieldLabel(key, definition),
        value: displayValue,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        key: string;
        label: string;
        value: string;
      } => entry !== null,
    );

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Insight detail"
      subtitle="Review context, activity, and stage progress for this insight."
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerBlock}>
          <View style={styles.headerChips}>
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: colors.prioritySurface[insight.priority] },
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: colors.priorityText[insight.priority] }}
              >
                {insight.priority}
              </Text>
            </View>
            {category ? (
              <Chip
                compact
                style={{ backgroundColor: colors.surfaceSecondary }}
              >
                {category.name}
              </Chip>
            ) : null}
            <Chip
              compact
              icon="clock-outline"
              style={{ backgroundColor: colors.surfaceSecondary }}
            >
              {getRelativeTimeLabel(insight.updatedAt)}
            </Chip>
          </View>
          <Text variant="headlineSmall" style={{ color: colors.text }}>
            {insight.title}
          </Text>
          <Text variant="bodyLarge" style={{ color: colors.textMuted }}>
            {insight.description}
          </Text>
        </View>

        {viewingUsers.length ? (
          <Card
            mode="contained"
            style={{ backgroundColor: colors.surfaceSecondary }}
          >
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleSmall" style={{ color: colors.text }}>
                {viewingBannerTitle}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                This insight is currently open on another teammate&apos;s
                device.
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        <Card
          mode="contained"
          style={[styles.panel, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Stage selector
            </Text>
            <View style={styles.stageChipRow}>
              {stageDefinitions.map((stage) => {
                const isSelected = stage.key === insight.stage;

                return (
                  <Chip
                    key={stage.key}
                    selected={isSelected}
                    onPress={() => onMoveToStage(insight, stage.key)}
                    {...getStageChipProps(`Move to ${stage.label}`, isSelected)}
                    selectedColor="#FFFFFF"
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : colors.surface,
                        borderColor: isSelected
                          ? colors.accent
                          : colors.borderMuted,
                      },
                    ]}
                    textStyle={{
                      color: isSelected ? "#FFFFFF" : colors.text,
                      fontWeight: isSelected ? "700" : "600",
                    }}
                  >
                    {stage.label}
                  </Chip>
                );
              })}
            </View>
          </Card.Content>
        </Card>

        {hcp ? (
          <Card
            mode="contained"
            style={[styles.panel, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Linked HCP
              </Text>
              <Text variant="bodyLarge" style={{ color: colors.text }}>
                {hcp.name}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                {hcp.specialty} at {hcp.institution}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Region: {hcp.region}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {insight.tagIds.length ? (
          <View style={styles.tagRow}>
            {insight.tagIds.map((tagId) => {
              const tag = tags.find((item) => item.id === tagId);
              return tag ? (
                <Chip
                  key={tag.id}
                  compact
                  style={{ backgroundColor: colors.surfaceSecondary }}
                >
                  {tag.name}
                </Chip>
              ) : null;
            })}
          </View>
        ) : null}

        {customFieldEntries.length ? (
          <Card
            mode="contained"
            style={[styles.panel, { backgroundColor: colors.surfaceSecondary }]}
          >
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Custom fields
              </Text>
              <View style={styles.customFieldList}>
                {customFieldEntries.map((entry) => (
                  <View
                    key={entry.key}
                    style={[
                      styles.customFieldItem,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderMuted,
                      },
                    ]}
                  >
                    <Text
                      variant="labelLarge"
                      style={{ color: colors.textMuted }}
                    >
                      {entry.label}
                    </Text>
                    <Text variant="bodyLarge" style={{ color: colors.text }}>
                      {entry.value}
                    </Text>
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {hasDrugContext ? (
          <List.Accordion
            title="Drug context"
            description={`Live OpenFDA context for ${insight.drugName}.`}
            accessibilityLabel={`Drug context for ${insight.drugName}`}
            style={[
              styles.accordion,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderMuted,
              },
            ]}
          >
            {likelyPlaceholderDrugName ? (
              <Card
                mode="contained"
                style={[
                  styles.panel,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Card.Content style={styles.sectionContent}>
                  <Text variant="titleSmall" style={{ color: colors.text }}>
                    OpenFDA needs a real drug name
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.textMuted }}
                  >
                    {insight.drugName} looks like seeded placeholder data. Edit
                    this insight to a real marketed drug name from the form
                    suggestions to load live label and adverse-event context.
                  </Text>
                </Card.Content>
              </Card>
            ) : null}

            <Card
              mode="contained"
              style={[
                styles.panel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content style={styles.sectionContent}>
                <View style={styles.apiHeaderRow}>
                  <View style={styles.apiHeaderCopy}>
                    <Text variant="titleSmall" style={{ color: colors.text }}>
                      Label API
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textMuted }}
                    >
                      Indication, warnings, and dosage guidance.
                    </Text>
                  </View>
                  {labelState.status === "success" && labelState.data ? (
                    <Chip
                      compact
                      style={{ backgroundColor: colors.surfaceSecondary }}
                    >
                      {labelState.data.source === "cache" ? "Cached" : "Live"}
                    </Chip>
                  ) : null}
                </View>

                {labelState.status === "loading" ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator animating size="small" />
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textMuted }}
                    >
                      Loading drug label...
                    </Text>
                  </View>
                ) : null}

                {labelState.status === "error" ? (
                  <View style={styles.stateBlock}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textMuted }}
                    >
                      {labelState.error}
                    </Text>
                    <Button
                      mode="outlined"
                      onPress={retry}
                      accessibilityLabel="Retry drug label lookup"
                    >
                      Retry FDA lookup
                    </Button>
                  </View>
                ) : null}

                {labelState.status === "empty" ? (
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.textMuted }}
                  >
                    No label result was found for this drug name.
                  </Text>
                ) : null}

                {labelState.status === "success" && labelState.data ? (
                  <View style={styles.sectionContent}>
                    {labelState.data.slowLoad ? (
                      <Text
                        variant="bodySmall"
                        style={{ color: colors.textMuted }}
                      >
                        FDA data loading slowly right now.
                      </Text>
                    ) : null}
                    <Text variant="titleSmall" style={{ color: colors.text }}>
                      {labelState.data.indication ??
                        "No indication summary available."}
                    </Text>
                    {labelState.data.boxedWarning ? (
                      <View
                        style={[
                          styles.warningPanel,
                          {
                            backgroundColor: colors.warningSoft,
                            borderColor: colors.warning,
                          },
                        ]}
                      >
                        <Text
                          variant="labelLarge"
                          style={{ color: colors.warning }}
                        >
                          Boxed warning
                        </Text>
                        <Text
                          variant="bodyMedium"
                          style={{ color: colors.text }}
                        >
                          {labelState.data.boxedWarning}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textMuted }}
                    >
                      Dosage forms:{" "}
                      {labelState.data.dosageForms.join(", ") || "Unavailable"}
                    </Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>

            <Card
              mode="contained"
              style={[
                styles.panel,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content style={styles.sectionContent}>
                <View style={styles.apiHeaderRow}>
                  <View style={styles.apiHeaderCopy}>
                    <Text variant="titleSmall" style={{ color: colors.text }}>
                      Adverse events
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textMuted }}
                    >
                      Top reported reactions from OpenFDA event data.
                    </Text>
                  </View>
                  {eventState.status === "success" && eventState.data ? (
                    <Chip
                      compact
                      style={{ backgroundColor: colors.surfaceSecondary }}
                    >
                      {eventState.data.source === "cache" ? "Cached" : "Live"}
                    </Chip>
                  ) : null}
                </View>

                {eventState.status === "loading" ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator animating size="small" />
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textMuted }}
                    >
                      Loading adverse events...
                    </Text>
                  </View>
                ) : null}

                {eventState.status === "error" ? (
                  <View style={styles.stateBlock}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textMuted }}
                    >
                      {eventState.error}
                    </Text>
                    <Button
                      mode="outlined"
                      onPress={retry}
                      accessibilityLabel="Retry adverse event lookup"
                    >
                      Retry FDA lookup
                    </Button>
                  </View>
                ) : null}

                {eventState.status === "empty" ? (
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.textMuted }}
                  >
                    No adverse-event summary was found for this drug name.
                  </Text>
                ) : null}

                {eventState.status === "success" && eventState.data ? (
                  <>
                    {eventState.data.slowLoad ? (
                      <Text
                        variant="bodySmall"
                        style={{ color: colors.textMuted }}
                      >
                        FDA data loading slowly right now.
                      </Text>
                    ) : null}
                    <Divider />
                    {eventState.data.reactions.map((reaction) => (
                      <View key={reaction.label} style={styles.reactionRow}>
                        <Text
                          variant="bodyMedium"
                          style={{ color: colors.text, width: 110 }}
                        >
                          {reaction.label}
                        </Text>
                        <View
                          style={[
                            styles.reactionTrack,
                            { backgroundColor: colors.borderMuted },
                          ]}
                        >
                          <View
                            style={[
                              styles.reactionFill,
                              {
                                backgroundColor: colors.accent,
                                width: `${maxReactionCount ? (reaction.count / maxReactionCount) * 100 : 0}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          variant="labelMedium"
                          style={{ color: colors.textMuted }}
                        >
                          {reaction.count}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </Card.Content>
            </Card>
          </List.Accordion>
        ) : null}

        <View style={styles.timelineSection}>
          <Text variant="titleMedium" style={{ color: colors.text }}>
            Activity timeline
          </Text>
          {isTimelineLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator animating size="small" />
              <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
                Loading activity...
              </Text>
            </View>
          ) : null}
          {!isTimelineLoading && activitiesQuery.error ? (
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              Unable to load recent activity for this insight.
            </Text>
          ) : null}
          {!isTimelineLoading && !activitiesQuery.error && hasInsightActivities
            ? insightActivities.map((activity) => (
                <View key={activity.id} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                  <View style={styles.timelineCopy}>
                    <Text variant="bodyMedium" style={{ color: colors.text }}>
                      {activity.message}
                    </Text>
                    <Text
                      variant="labelMedium"
                      style={{ color: colors.textMuted }}
                    >
                      {getRelativeTimeLabel(activity.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            : null}
          {!isTimelineLoading &&
          !activitiesQuery.error &&
          !hasInsightActivities ? (
            <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
              No activity recorded for this insight yet.
            </Text>
          ) : null}
        </View>
      </BottomSheetScrollView>
      <View style={styles.footerRow}>
        <Button
          mode="outlined"
          onPress={onDismiss}
          accessibilityLabel="Close insight detail"
        >
          Close
        </Button>
        <Button
          mode="contained"
          onPress={() => onEdit(insight)}
          accessibilityLabel="Edit this insight"
        >
          Edit insight
        </Button>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 12,
  },
  headerBlock: {
    gap: 10,
  },
  headerChips: {
    alignContent: "flex-start",
    alignItems: "flex-start",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    width: "100%",
  },
  panel: {
    borderRadius: 22,
    overflow: "hidden",
    marginTop: 8,
  },
  priorityBadge: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
  },
  sectionContent: {
    gap: 10,
  },
  stageChipRow: {
    alignContent: "flex-start",
    alignItems: "flex-start",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    width: "100%",
  },
  tagRow: {
    alignContent: "flex-start",
    alignItems: "flex-start",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    width: "100%",
  },
  customFieldList: {
    gap: 10,
  },
  customFieldItem: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  optionChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  apiHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  apiHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  accordion: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 0,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  warningPanel: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  stateBlock: {
    gap: 12,
  },
  reactionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  reactionTrack: {
    borderRadius: 999,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  reactionFill: {
    borderRadius: 999,
    height: "100%",
  },
  timelineSection: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  timelineDot: {
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  timelineCopy: {
    flex: 1,
    gap: 4,
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
});
