import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Chip, RadioButton, Text } from "react-native-paper";

import { AppDialog } from "@/components/ui/app-dialog";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { type ConflictField } from "@/lib/conflict-resolution";

type ConflictResolutionModalProps = {
  visible: boolean;
  conflicts: ConflictField[];
  otherUserName: string;
  onKeepMine: () => void;
  onKeepTheirs: () => void;
  onMerge: (choices: Record<string, "yours" | "theirs">) => void;
  onDismiss: () => void;
};

export function ConflictResolutionModal({
  visible,
  conflicts,
  otherUserName,
  onKeepMine,
  onKeepTheirs,
  onMerge,
  onDismiss,
}: ConflictResolutionModalProps) {
  const colorScheme = useColorScheme();
  const colors = AppTheme[colorScheme ?? "light"];
  const [choices, setChoices] = useState<Record<string, "yours" | "theirs">>(
    {},
  );

  const handleMerge = () => {
    onMerge(choices);
  };

  const setChoice = (field: string, value: "yours" | "theirs") => {
    setChoices((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppDialog
      visible={visible}
      onDismiss={onDismiss}
      title="Edit conflict"
      maxHeightPercent={0.82}
      actions={
        <>
          <Button onPress={onKeepMine} mode="outlined" compact>
            Keep all mine
          </Button>
          <Button onPress={onKeepTheirs} mode="outlined" compact>
            Keep all theirs
          </Button>
          <Button onPress={handleMerge} mode="contained" compact>
            Merge
          </Button>
        </>
      }
    >
      <View style={styles.dialogContent}>
        <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
          {otherUserName} saved changes to this insight while you were editing.
          The fields below differ between your version and theirs.
        </Text>

        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
        >
          {conflicts.map((conflict) => (
            <Card
              key={conflict.field}
              mode="contained"
              style={[
                styles.conflictCard,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Card.Content style={styles.conflictContent}>
                <Chip compact style={{ backgroundColor: colors.surface }}>
                  {conflict.label}
                </Chip>

                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonColumn}>
                    <Text
                      variant="labelMedium"
                      style={{ color: colors.accent }}
                    >
                      Yours
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.text }}
                      numberOfLines={3}
                    >
                      {conflict.yours || "(empty)"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.borderMuted },
                    ]}
                  />

                  <View style={styles.comparisonColumn}>
                    <Text
                      variant="labelMedium"
                      style={{ color: colors.warning }}
                    >
                      Theirs
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.text }}
                      numberOfLines={3}
                    >
                      {conflict.theirs || "(empty)"}
                    </Text>
                  </View>
                </View>

                <RadioButton.Group
                  value={choices[conflict.field] ?? "theirs"}
                  onValueChange={(value) =>
                    setChoice(conflict.field, value as "yours" | "theirs")
                  }
                >
                  <View style={styles.radioRow}>
                    <RadioButton.Item
                      label="Keep mine"
                      value="yours"
                      style={styles.radioItem}
                      labelStyle={styles.radioLabel}
                    />
                    <RadioButton.Item
                      label="Keep theirs"
                      value="theirs"
                      style={styles.radioItem}
                      labelStyle={styles.radioLabel}
                    />
                  </View>
                </RadioButton.Group>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      </View>
    </AppDialog>
  );
}

const styles = StyleSheet.create({
  dialogContent: {
    gap: 12,
  },
  scrollArea: {
    marginTop: 12,
    maxHeight: 340,
  },
  conflictCard: {
    borderRadius: 14,
    marginBottom: 10,
  },
  conflictContent: {
    gap: 8,
  },
  comparisonRow: {
    flexDirection: "row",
    gap: 8,
  },
  comparisonColumn: {
    flex: 1,
    gap: 4,
  },
  divider: {
    width: 1,
  },
  radioRow: {
    flexDirection: "row",
    gap: 4,
  },
  radioItem: {
    flex: 1,
    paddingHorizontal: 0,
  },
  radioLabel: {
    fontSize: 12,
  },
});
