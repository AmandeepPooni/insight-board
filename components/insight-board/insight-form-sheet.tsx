import {
    BottomSheetScrollView,
    BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import {
    type ComponentProps,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    type TextStyle,
    View,
} from "react-native";
import {
    Button,
    Chip,
    HelperText,
    SegmentedButtons,
    Text,
    TextInput,
} from "react-native-paper";
import { z } from "zod";

import { useInsightBoard } from "@/components/providers/insight-board-provider";
import { AppBottomSheet } from "@/components/ui/app-bottom-sheet";
import { AppDialog } from "@/components/ui/app-dialog";
import { AppTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
    type CustomFieldDefinition,
    type FieldType,
    type Insight,
    type InsightDraft,
    priorityDefinitions,
    stageDefinitions,
} from "@/lib/insight-board-schema";

const draftSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  drugName: z.string().optional(),
});

type InsightFormSheetProps = {
  visible: boolean;
  insight: Insight | null;
  onDismiss: () => void;
};

type DraftErrors = Partial<
  Record<keyof InsightDraft | "title" | "description", string>
>;

type NewFieldDraft = {
  label: string;
  key: string;
  type: FieldType;
  optionsText: string;
};

type PaperTextInputProps = ComponentProps<typeof TextInput>;
type SheetTextInputProps = Omit<PaperTextInputProps, "render">;

type AppPalette = (typeof AppTheme)[keyof typeof AppTheme];

function getAppPalette(colorScheme: ReturnType<typeof useColorScheme>) {
  return AppTheme[colorScheme === "dark" ? "dark" : "light"];
}

function renderBottomSheetTextInput(
  props: Parameters<NonNullable<PaperTextInputProps["render"]>>[0],
) {
  return <BottomSheetTextInput {...props} />;
}

function SheetTextInput(props: SheetTextInputProps) {
  return <TextInput {...props} render={renderBottomSheetTextInput} />;
}

function isCustomFieldDefinition(
  value: CustomFieldDefinition | null | undefined,
): value is CustomFieldDefinition {
  if (!value) {
    return false;
  }

  if (
    typeof value.key !== "string" ||
    typeof value.label !== "string" ||
    (value.type !== "text" &&
      value.type !== "number" &&
      value.type !== "date" &&
      value.type !== "select")
  ) {
    return false;
  }

  if (value.type !== "select") {
    return true;
  }

  return Array.isArray(value.options);
}

function getSelectableFieldOptions(field: CustomFieldDefinition) {
  return field.type === "select"
    ? field.options.filter(
        (option): option is string => typeof option === "string",
      )
    : [];
}

function buildDefaultDraft(insight: Insight | null): InsightDraft {
  if (insight) {
    return {
      id: insight.id,
      title: insight.title,
      description: insight.description,
      stage: insight.stage,
      priority: insight.priority,
      categoryId: insight.categoryId,
      hcpId: insight.hcpId,
      drugName: insight.drugName,
      tagIds: insight.tagIds,
      customFields: insight.customFields,
    };
  }

  return {
    title: "",
    description: "",
    stage: "observation",
    priority: "P3",
    categoryId: null,
    hcpId: null,
    drugName: "",
    tagIds: [],
    customFields: {},
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_");
}

function getSelectableChipProps(label: string, selected: boolean) {
  return {
    accessibilityHint: "Double tap to select or clear this option.",
    accessibilityLabel: `${label}${selected ? ", selected" : ""}`,
    accessibilityRole: "checkbox" as const,
    accessibilityState: { checked: selected },
  };
}

function getSelectableChipStyle(colors: AppPalette, selected: boolean) {
  return [
    styles.selectableChip,
    {
      backgroundColor: selected ? colors.accent : colors.surfaceSecondary,
      borderColor: selected ? colors.accent : colors.borderMuted,
    },
  ];
}

function getSelectableChipTextStyle(
  colors: AppPalette,
  selected: boolean,
): TextStyle {
  return {
    color: selected ? "#FFFFFF" : colors.text,
    fontWeight: selected ? ("700" as const) : ("600" as const),
  };
}

function getPriorityChipStyle(
  colors: AppPalette,
  priority: Insight["priority"],
  selected: boolean,
) {
  return [
    styles.selectableChip,
    {
      backgroundColor: selected
        ? colors.priority[priority]
        : colors.prioritySurface[priority],
      borderColor: selected
        ? colors.priority[priority]
        : colors.prioritySurface[priority],
    },
  ];
}

function getPriorityChipTextStyle(
  colors: AppPalette,
  priority: Insight["priority"],
  selected: boolean,
): TextStyle {
  return {
    color: selected ? "#FFFFFF" : colors.priorityText[priority],
    fontWeight: "700" as const,
  };
}

export function InsightFormSheet({
  visible,
  insight,
  onDismiss,
}: InsightFormSheetProps) {
  const colorScheme = useColorScheme();
  const colors = getAppPalette(colorScheme);
  const {
    addCustomFieldDefinition,
    categories,
    customFieldDefinitions,
    drugSearchIndex,
    hcps,
    saveInsight,
    tags,
  } = useInsightBoard();
  const [draft, setDraft] = useState<InsightDraft>(buildDefaultDraft(insight));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [descriptionMode, setDescriptionMode] = useState<"write" | "preview">(
    "write",
  );
  const [dirty, setDirty] = useState(false);
  const [confirmDismissVisible, setConfirmDismissVisible] = useState(false);
  const [newFieldVisible, setNewFieldVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newFieldDraft, setNewFieldDraft] = useState<NewFieldDraft>({
    label: "",
    key: "",
    type: "text",
    optionsText: "",
  });
  const bypassDirtyDismissRef = useRef(false);
  const editingTargetId = insight?.id ?? "new";
  const initialDraftRef = useRef({
    draft: buildDefaultDraft(insight),
    targetId: editingTargetId,
  });

  if (initialDraftRef.current.targetId !== editingTargetId) {
    initialDraftRef.current = {
      draft: buildDefaultDraft(insight),
      targetId: editingTargetId,
    };
  }

  // Pulsing animation for voice recording indicator
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  const onSpeechResult = useCallback(
    (text: string) => {
      const separator = draft.description.trim() ? " " : "";
      updateDraft("description", draft.description + separator + text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.description],
  );

  const {
    available: speechAvailable,
    isListening,
    transcript,
    error: speechError,
    toggle: toggleSpeech,
  } = useSpeechRecognition(onSpeechResult);

  useEffect(() => {
    if (!isListening) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [isListening, pulseAnim]);

  useEffect(() => {
    bypassDirtyDismissRef.current = false;

    if (!visible) {
      setConfirmDismissVisible(false);
      setIsSubmitting(false);
      setNewFieldVisible(false);
      return;
    }

    setDraft(initialDraftRef.current.draft);
    setErrors({});
    setDescriptionMode("write");
    setDirty(false);
  }, [editingTargetId, visible]);

  const validateDraft = (nextDraft: InsightDraft) => {
    const result = draftSchema.safeParse({
      title: nextDraft.title,
      description: nextDraft.description,
      drugName: nextDraft.drugName,
    });

    if (result.success) {
      setErrors({});
      return true;
    }

    const nextErrors: DraftErrors = {};
    for (const issue of result.error.issues) {
      if (issue.path[0] === "title") {
        nextErrors.title = issue.message;
      }

      if (issue.path[0] === "description") {
        nextErrors.description = issue.message;
      }
    }

    setErrors(nextErrors);
    return false;
  };

  const updateDraft = <K extends keyof InsightDraft>(
    key: K,
    value: InsightDraft[K],
  ) => {
    const nextDraft = {
      ...draft,
      [key]: value,
    };

    setDraft(nextDraft);
    setDirty(true);
    validateDraft(nextDraft);
  };

  const requestDismiss = () => {
    if (bypassDirtyDismissRef.current) {
      bypassDirtyDismissRef.current = false;
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (dirty) {
      setConfirmDismissVisible(true);
      return;
    }

    onDismiss();
  };

  const submitForm = async () => {
    const isValid = validateDraft(draft);
    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const didSave = await saveInsight(draft);

    setIsSubmitting(false);
    if (!didSave) {
      return;
    }

    bypassDirtyDismissRef.current = true;
    setDirty(false);
    setConfirmDismissVisible(false);
    onDismiss();
  };

  const filteredHcps = hcps.filter((hcp) => {
    if (!draft.description && !draft.title) {
      return true;
    }

    return true;
  });

  const filteredDrugs = drugSearchIndex.filter((drug) =>
    draft.drugName.trim().length === 0
      ? false
      : drug.toLowerCase().includes(draft.drugName.toLowerCase()),
  );

  const addCustomField = () => {
    const key = newFieldDraft.key || slugify(newFieldDraft.label);
    if (!newFieldDraft.label.trim() || !key) {
      return;
    }

    const definition: CustomFieldDefinition =
      newFieldDraft.type === "select"
        ? {
            key,
            label: newFieldDraft.label.trim(),
            type: "select",
            options: newFieldDraft.optionsText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : {
            key,
            label: newFieldDraft.label.trim(),
            type: newFieldDraft.type,
          };

    addCustomFieldDefinition(definition);
    updateDraft("customFields", {
      ...draft.customFields,
      [key]: null,
    });
    setNewFieldDraft({ label: "", key: "", type: "text", optionsText: "" });
    setNewFieldVisible(false);
  };

  return (
    <>
      <AppBottomSheet
        visible={visible}
        onDismiss={requestDismiss}
        title={insight ? "Edit insight" : "Create insight"}
        subtitle="Capture the core context, assign the right stage, and save when ready."
        footer={
          <View style={styles.footerActions}>
            <Button
              mode="outlined"
              onPress={requestDismiss}
              accessibilityLabel="Cancel insight editing"
              style={styles.footerButton}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={submitForm}
              accessibilityLabel={
                insight ? "Save insight changes" : "Create insight"
              }
              style={styles.footerButton}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {insight ? "Save changes" : "Create insight"}
            </Button>
          </View>
        }
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
        >
          <SheetTextInput
            label="Title"
            mode="outlined"
            value={draft.title}
            onChangeText={(value) => updateDraft("title", value)}
            error={Boolean(errors.title)}
            accessibilityLabel="Insight title"
          />
          {errors.title ? (
            <HelperText type="error">{errors.title}</HelperText>
          ) : null}

          <View style={[styles.section, styles.descriptionSection]}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Description
            </Text>
            <View style={styles.descriptionToolbar}>
              <SegmentedButtons
                value={descriptionMode}
                onValueChange={(value) => {
                  if (value === "write" || value === "preview") {
                    setDescriptionMode(value);
                  }
                }}
                density="small"
                style={styles.descriptionModeToggle}
                buttons={[
                  {
                    value: "write",
                    label: "Write",
                    accessibilityLabel: "Write description mode",
                    checkedColor: colors.text,
                    uncheckedColor: colors.text,
                    style: styles.descriptionModeButton,
                    labelStyle: styles.descriptionModeButtonLabel,
                    showSelectedCheck: false,
                  },
                  {
                    value: "preview",
                    label: "Preview",
                    accessibilityLabel: "Preview description mode",
                    checkedColor: colors.textInverse,
                    uncheckedColor: colors.text,
                    style: styles.descriptionModeButton,
                    labelStyle: styles.descriptionModeButtonLabel,
                    showSelectedCheck: false,
                  },
                ]}
              />
              <Button
                mode="outlined"
                icon={
                  isListening
                    ? "stop-circle"
                    : speechAvailable
                      ? "microphone-outline"
                      : "microphone-off"
                }
                onPress={toggleSpeech}
                accessibilityLabel={
                  isListening
                    ? "Stop voice recording"
                    : speechAvailable
                      ? "Start voice recording"
                      : "Voice input unavailable in this build"
                }
                accessibilityHint={
                  speechAvailable
                    ? "Double tap to dictate into the description field."
                    : "Double tap to learn whether voice input is available on this device."
                }
                accessibilityState={{ checked: isListening }}
                style={[
                  styles.voiceToggleButton,
                  {
                    backgroundColor: isListening
                      ? colors.dangerSoft
                      : colors.surface,
                    borderColor: isListening ? colors.danger : colors.border,
                  },
                ]}
                textColor={
                  isListening
                    ? colors.danger
                    : speechAvailable
                      ? colors.text
                      : colors.textMuted
                }
                contentStyle={styles.toolbarButtonContent}
                labelStyle={styles.toolbarButtonLabel}
              >
                {isListening ? "Stop" : "Voice"}
              </Button>
            </View>
            {descriptionMode === "write" ? (
              <>
                <SheetTextInput
                  label="Description"
                  mode="outlined"
                  value={draft.description}
                  multiline
                  numberOfLines={6}
                  onChangeText={(value) => updateDraft("description", value)}
                  error={Boolean(errors.description)}
                  accessibilityLabel="Insight description"
                />
                {isListening ? (
                  <Animated.View
                    style={[
                      styles.recordingIndicator,
                      {
                        backgroundColor: colors.dangerSoft,
                        opacity: pulseAnim,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.recordingDot,
                        { backgroundColor: colors.danger },
                      ]}
                    />
                    <Text
                      variant="labelMedium"
                      style={{ color: colors.danger }}
                    >
                      Listening...{transcript ? ` "${transcript}"` : ""}
                    </Text>
                  </Animated.View>
                ) : null}
                {speechError ? (
                  <HelperText type="error">{speechError}</HelperText>
                ) : null}
              </>
            ) : (
              <View
                style={[
                  styles.previewSurface,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderMuted,
                  },
                ]}
              >
                <Text variant="bodyLarge" style={{ color: colors.text }}>
                  {draft.description || "Nothing to preview yet."}
                </Text>
              </View>
            )}
            {errors.description ? (
              <HelperText type="error">{errors.description}</HelperText>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Priority
            </Text>
            <View style={styles.chipRow}>
              {priorityDefinitions.map((priority) => {
                const isSelected = draft.priority === priority.key;

                return (
                  <Chip
                    key={priority.key}
                    selected={isSelected}
                    onPress={() => updateDraft("priority", priority.key)}
                    {...getSelectableChipProps(
                      `Priority ${priority.key}`,
                      isSelected,
                    )}
                    selectedColor="#FFFFFF"
                    style={getPriorityChipStyle(
                      colors,
                      priority.key,
                      isSelected,
                    )}
                    textStyle={getPriorityChipTextStyle(
                      colors,
                      priority.key,
                      isSelected,
                    )}
                  >
                    {priority.key}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Stage
            </Text>
            <View style={styles.chipRow}>
              {stageDefinitions.map((stage) => {
                const isSelected = draft.stage === stage.key;

                return (
                  <Chip
                    key={stage.key}
                    selected={isSelected}
                    onPress={() => updateDraft("stage", stage.key)}
                    {...getSelectableChipProps(
                      `Stage ${stage.label}`,
                      isSelected,
                    )}
                    selectedColor="#FFFFFF"
                    style={getSelectableChipStyle(colors, isSelected)}
                    textStyle={getSelectableChipTextStyle(colors, isSelected)}
                  >
                    {stage.label}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Category
            </Text>
            <View style={styles.chipRow}>
              {categories.map((category) => {
                const isSelected = draft.categoryId === category.id;

                return (
                  <Chip
                    key={category.id}
                    selected={isSelected}
                    onPress={() =>
                      updateDraft("categoryId", isSelected ? null : category.id)
                    }
                    {...getSelectableChipProps(
                      `Category ${category.name}`,
                      isSelected,
                    )}
                    selectedColor="#FFFFFF"
                    style={getSelectableChipStyle(colors, isSelected)}
                    textStyle={getSelectableChipTextStyle(colors, isSelected)}
                  >
                    {category.name}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Tags
            </Text>
            <View style={styles.chipRow}>
              {tags.map((tag) => {
                const isSelected = draft.tagIds.includes(tag.id);

                return (
                  <Chip
                    key={tag.id}
                    selected={isSelected}
                    onPress={() =>
                      updateDraft(
                        "tagIds",
                        isSelected
                          ? draft.tagIds.filter((item) => item !== tag.id)
                          : [...draft.tagIds, tag.id],
                      )
                    }
                    {...getSelectableChipProps(`Tag ${tag.name}`, isSelected)}
                    selectedColor="#FFFFFF"
                    style={getSelectableChipStyle(colors, isSelected)}
                    textStyle={getSelectableChipTextStyle(colors, isSelected)}
                  >
                    {tag.name}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleMedium" style={{ color: colors.text }}>
              Linked HCP
            </Text>
            <View style={styles.chipRow}>
              {filteredHcps.map((hcp) => {
                const isSelected = draft.hcpId === hcp.id;

                return (
                  <Chip
                    key={hcp.id}
                    selected={isSelected}
                    onPress={() =>
                      updateDraft("hcpId", isSelected ? null : hcp.id)
                    }
                    {...getSelectableChipProps(
                      `Linked HCP ${hcp.name}`,
                      isSelected,
                    )}
                    selectedColor="#FFFFFF"
                    style={getSelectableChipStyle(colors, isSelected)}
                    textStyle={getSelectableChipTextStyle(colors, isSelected)}
                  >
                    {hcp.name}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SheetTextInput
              label="Drug name"
              mode="outlined"
              value={draft.drugName}
              onChangeText={(value) => updateDraft("drugName", value)}
              accessibilityLabel="Drug name"
            />
            {filteredDrugs.slice(0, 5).length ? (
              <View style={styles.chipRow}>
                {filteredDrugs.slice(0, 5).map((drug) => (
                  <Chip
                    key={drug}
                    onPress={() => updateDraft("drugName", drug)}
                    accessibilityLabel={`Use suggested drug name ${drug}`}
                  >
                    {drug}
                  </Chip>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                Custom fields
              </Text>
              <Button
                onPress={() => setNewFieldVisible(true)}
                accessibilityLabel="Add a custom field"
              >
                + Add field
              </Button>
            </View>
            {customFieldDefinitions
              .filter(isCustomFieldDefinition)
              .map((field) => (
                <CustomFieldInput
                  key={field.key}
                  field={field}
                  value={draft.customFields[field.key] ?? null}
                  colors={colors}
                  onChange={(value) =>
                    updateDraft("customFields", {
                      ...draft.customFields,
                      [field.key]: value,
                    })
                  }
                />
              ))}
          </View>
        </BottomSheetScrollView>
      </AppBottomSheet>

      <AppDialog
        visible={confirmDismissVisible}
        onDismiss={() => setConfirmDismissVisible(false)}
        title="Discard changes?"
        actions={
          <View style={styles.dialogActions}>
            <Button
              onPress={() => setConfirmDismissVisible(false)}
              accessibilityLabel="Keep editing this insight"
            >
              Keep editing
            </Button>
            <Button
              onPress={() => {
                setConfirmDismissVisible(false);
                onDismiss();
              }}
              accessibilityLabel="Discard insight changes"
            >
              Discard
            </Button>
          </View>
        }
      >
        <Text variant="bodyMedium" style={{ color: colors.textMuted }}>
          You have unsaved changes in this form.
        </Text>
      </AppDialog>

      <AppDialog
        visible={newFieldVisible}
        onDismiss={() => setNewFieldVisible(false)}
        title="Add custom field"
        actions={
          <View style={styles.dialogActions}>
            <Button
              onPress={() => setNewFieldVisible(false)}
              accessibilityLabel="Cancel adding a custom field"
            >
              Cancel
            </Button>
            <Button
              onPress={addCustomField}
              accessibilityLabel="Add this custom field"
            >
              Add
            </Button>
          </View>
        }
      >
        <View style={styles.dialogContent}>
          <TextInput
            mode="outlined"
            label="Label"
            value={newFieldDraft.label}
            onChangeText={(value) =>
              setNewFieldDraft((current) => ({ ...current, label: value }))
            }
            accessibilityLabel="Custom field label"
            style={styles.dialogInput}
          />
          <TextInput
            mode="outlined"
            label="Key"
            value={newFieldDraft.key}
            onChangeText={(value) =>
              setNewFieldDraft((current) => ({ ...current, key: value }))
            }
            accessibilityLabel="Custom field key"
            style={styles.dialogInput}
          />
          <View style={styles.chipRow}>
            {(["text", "number", "date", "select"] as FieldType[]).map(
              (type) => {
                const isSelected = newFieldDraft.type === type;

                return (
                  <Chip
                    key={type}
                    selected={isSelected}
                    onPress={() =>
                      setNewFieldDraft((current) => ({ ...current, type }))
                    }
                    {...getSelectableChipProps(
                      `Custom field type ${type}`,
                      isSelected,
                    )}
                    selectedColor="#FFFFFF"
                    style={getSelectableChipStyle(colors, isSelected)}
                    textStyle={getSelectableChipTextStyle(colors, isSelected)}
                  >
                    {type}
                  </Chip>
                );
              },
            )}
          </View>
          {newFieldDraft.type === "select" ? (
            <TextInput
              mode="outlined"
              label="Options (comma separated)"
              value={newFieldDraft.optionsText}
              onChangeText={(value) =>
                setNewFieldDraft((current) => ({
                  ...current,
                  optionsText: value,
                }))
              }
              accessibilityLabel="Custom field options"
              style={styles.dialogInput}
            />
          ) : null}
        </View>
      </AppDialog>
    </>
  );
}

function CustomFieldInput({
  field,
  value,
  colors,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: string | number | null;
  colors: AppPalette;
  onChange: (value: string | number | null) => void;
}) {
  if (!isCustomFieldDefinition(field)) {
    return null;
  }

  if (field.type === "select") {
    const options = getSelectableFieldOptions(field);

    if (!options.length) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text variant="labelLarge" style={{ color: colors.text }}>
          {field.label}
        </Text>
        <View style={styles.chipRow}>
          {options.map((option) => {
            const isSelected = value === option;

            return (
              <Chip
                key={option}
                selected={isSelected}
                onPress={() => onChange(option)}
                {...getSelectableChipProps(
                  `${field.label} ${option}`,
                  isSelected,
                )}
                selectedColor="#FFFFFF"
                style={getSelectableChipStyle(colors, isSelected)}
                textStyle={getSelectableChipTextStyle(colors, isSelected)}
              >
                {option}
              </Chip>
            );
          })}
        </View>
      </View>
    );
  }

  if (field.type === "number") {
    return (
      <SheetTextInput
        label={field.label}
        mode="outlined"
        keyboardType="numeric"
        value={typeof value === "number" ? value.toString() : ""}
        onChangeText={(nextValue) =>
          onChange(nextValue ? Number(nextValue) : null)
        }
        accessibilityLabel={field.label}
      />
    );
  }

  if (field.type === "date") {
    return (
      <SheetTextInput
        label={field.label}
        mode="outlined"
        placeholder="YYYY-MM-DD"
        value={typeof value === "string" ? value : ""}
        onChangeText={(nextValue) => onChange(nextValue || null)}
        accessibilityLabel={field.label}
      />
    );
  }

  return (
    <SheetTextInput
      label={field.label}
      mode="outlined"
      value={typeof value === "string" ? value : ""}
      onChangeText={(nextValue) => onChange(nextValue || null)}
      accessibilityLabel={field.label}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 12,
  },
  section: {
    borderRadius: 22,
    gap: 10,
    minWidth: 0,
    paddingVertical: 2,
  },
  descriptionSection: {
    gap: 8,
    paddingVertical: 0,
  },
  descriptionToolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  descriptionModeToggle: {
    flex: 2,
  },
  descriptionModeButton: {
    minHeight: 40,
  },
  descriptionModeButtonLabel: {
    fontWeight: "600",
    includeFontPadding: false,
    lineHeight: 18,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
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
  selectableChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  previewSurface: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 120,
    padding: 16,
  },
  footerActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  footerButton: {
    flex: 1,
  },
  dialogActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  dialogContent: {
    gap: 12,
  },
  dialogInput: {
    marginBottom: 0,
  },
  voiceToggleButton: {
    flex: 1,
    minWidth: 0,
  },
  toolbarButtonContent: {
    height: 40,
  },
  toolbarButtonLabel: {
    fontWeight: "600",
    includeFontPadding: false,
    lineHeight: 18,
  },
  recordingIndicator: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recordingDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
});
