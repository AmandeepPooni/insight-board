import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { StyleSheet, View } from "react-native";
import { Button, Card, Chip, Text } from "react-native-paper";

import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    analyticsRanges,
    priorityDefinitions,
} from "@/lib/insight-board-schema";

type FilterSheetProps = {
  visible: boolean;
  onDismiss: () => void;
};

function getSelectableChipProps(label: string, selected: boolean) {
  return {
    accessibilityHint: "Double tap to apply or remove this filter.",
    accessibilityLabel: `${label}${selected ? ", selected" : ""}`,
    accessibilityRole: "checkbox" as const,
    accessibilityState: { checked: selected },
  };
}

export function FilterSheet({ visible, onDismiss }: FilterSheetProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const {
    categories,
    filters,
    hcps,
    setCategoryFilter,
    setDateRangeFilter,
    setHcpFilter,
    togglePriorityFilter,
    toggleTagFilter,
    tags,
    clearFilters,
  } = useInsightBoard();

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Filters"
      subtitle="Narrow the board by priority, category, date, HCP, and tags."
      footer={
        <Button
          mode="contained-tonal"
          onPress={clearFilters}
          accessibilityLabel="Clear all filters"
        >
          Clear all
        </Button>
      }
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card
          mode="contained"
          style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Priority
            </Text>
            <View style={styles.chipRow}>
              {priorityDefinitions.map((item) => (
                <Chip
                  key={item.key}
                  selected={filters.priorities.includes(item.key)}
                  onPress={() => togglePriorityFilter(item.key)}
                  {...getSelectableChipProps(
                    `Filter by ${item.key}`,
                    filters.priorities.includes(item.key),
                  )}
                  style={styles.optionChip}
                >
                  {item.key}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card
          mode="contained"
          style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Category
            </Text>
            <View style={styles.chipRow}>
              <Chip
                selected={filters.categoryId === null}
                onPress={() => setCategoryFilter(null)}
                {...getSelectableChipProps(
                  "Filter by any category",
                  filters.categoryId === null,
                )}
                style={styles.optionChip}
              >
                Any
              </Chip>
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  selected={filters.categoryId === category.id}
                  onPress={() =>
                    setCategoryFilter(
                      filters.categoryId === category.id ? null : category.id,
                    )
                  }
                  {...getSelectableChipProps(
                    `Filter by ${category.name}`,
                    filters.categoryId === category.id,
                  )}
                  style={styles.optionChip}
                >
                  {category.name}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card
          mode="contained"
          style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Date range
            </Text>
            <View style={styles.chipRow}>
              <Chip
                selected={filters.dateRange === null}
                onPress={() => setDateRangeFilter(null)}
                {...getSelectableChipProps(
                  "Filter by any time",
                  filters.dateRange === null,
                )}
                style={styles.optionChip}
              >
                Any time
              </Chip>
              {analyticsRanges.map((range) => (
                <Chip
                  key={range.value}
                  selected={filters.dateRange === range.value}
                  onPress={() =>
                    setDateRangeFilter(
                      filters.dateRange === range.value ? null : range.value,
                    )
                  }
                  {...getSelectableChipProps(
                    `Filter by ${range.label}`,
                    filters.dateRange === range.value,
                  )}
                  style={styles.optionChip}
                >
                  {range.label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card
          mode="contained"
          style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              HCP
            </Text>
            <View style={styles.chipRow}>
              <Chip
                selected={filters.hcpId === null}
                onPress={() => setHcpFilter(null)}
                {...getSelectableChipProps(
                  "Filter by any HCP",
                  filters.hcpId === null,
                )}
                style={styles.optionChip}
              >
                Any HCP
              </Chip>
              {hcps.map((hcp) => (
                <Chip
                  key={hcp.id}
                  selected={filters.hcpId === hcp.id}
                  onPress={() =>
                    setHcpFilter(filters.hcpId === hcp.id ? null : hcp.id)
                  }
                  {...getSelectableChipProps(
                    `Filter by ${hcp.name}`,
                    filters.hcpId === hcp.id,
                  )}
                  style={styles.optionChip}
                >
                  {hcp.name}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card
          mode="contained"
          style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Tags
            </Text>
            <View style={styles.chipRow}>
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  selected={filters.tagIds.includes(tag.id)}
                  onPress={() => toggleTagFilter(tag.id)}
                  {...getSelectableChipProps(
                    `Filter by ${tag.name}`,
                    filters.tagIds.includes(tag.id),
                  )}
                  style={styles.optionChip}
                >
                  {tag.name}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 12,
  },
  section: {
    borderRadius: 22,
    overflow: "hidden",
  },
  sectionContent: {
    gap: 12,
  },
  chipRow: {
    alignContent: "flex-start",
    alignItems: "flex-start",
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
    width: "100%",
  },
  optionChip: {
    alignSelf: "flex-start",
  },
});
