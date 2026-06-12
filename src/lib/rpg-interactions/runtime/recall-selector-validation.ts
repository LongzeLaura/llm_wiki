import type {
  RecallBudget,
  RecallExclusion,
  RecallPolicy,
  RecallSelectedItem,
  RecallSelectedSection,
  RecallSelection,
  RecallSelectionPriority,
  RecallSelectorInput,
  RecallableSection,
  RetrievalIndexEntry,
} from "../../rpg-runtime/types"
import type {
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgRecallReadMode,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"

const ALLOWED_LINE_TARGETS = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
])

const ALLOWED_READ_MODES = new Set<RpgRecallReadMode>([
  "summary",
  "focusedSection",
  "fullPage",
  "metadataOnly",
])

const ALLOWED_PRIORITIES = new Set<RecallSelectionPriority>(["critical", "high", "medium", "low"])

const ALLOWED_VISIBILITY_SCOPES = new Set<RpgVisibilityScope>([
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])

const ALLOWED_KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>([
  "pc_known",
  "pc_misunderstanding",
  "npc_known",
  "user_only",
  "gm_only",
  "unknown_to_pc",
])

const PC_KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>(["pc_known", "pc_misunderstanding"])

const FORBIDDEN_OUTPUT_KEYS = [
  {
    pattern: /^(?:narration|narrative)$/i,
    message: "Recall Selector must not generate narration.",
  },
  {
    pattern: /^(?:playerFacingText|parallelLineText|nextActionOptions)$/i,
    message: "Recall Selector must not generate player-facing prose or next action options.",
  },
  {
    pattern:
      /^(?:wikiWrites?|wikiWriteProposal|proposedUpdates?|pendingUpdates?|targetPath|strategy|applyUpdates?)$/i,
    message: "Recall Selector must not generate wiki writes or update proposals.",
  },
  {
    pattern: /^(?:recalledMaterials|fullText|rawText|fileContent|pageContent)$/i,
    message: "Recall Selector must not include recalled material full text.",
  },
  {
    pattern:
      /^(?:outlineBrief|outlineImpactReport|outlineRevision|outlineRevisionProposal|provisionalOutlinePatch|regenerationRequest)$/i,
    message: "Recall Selector must not generate LLM 4 or outline regeneration output.",
  },
] as const

export function validateRecallSelection(value: unknown, input: RecallSelectorInput): RecallSelection {
  assertNoForbiddenOutputKeys(value)

  const record = expectRecord(value, "RecallSelection")
  const indexByPath = new Map(input.retrievalIndex.map((entry) => [entry.path, entry]))

  const selection: RecallSelection = {
    selectionId: readString(record, "selectionId", "RecallSelection.selectionId"),
    sourceWorkingStateId: readString(record, "sourceWorkingStateId", "RecallSelection.sourceWorkingStateId"),
    selectedItems: readArray(record, "selectedItems", "RecallSelection.selectedItems").map((item, index) =>
      validateSelectedItem(item, index, indexByPath, input.recallPolicy),
    ),
    exclusions: readArray(record, "exclusions", "RecallSelection.exclusions").map((exclusion, index) =>
      validateExclusion(exclusion, index, indexByPath),
    ),
    recallBudget: validateRecallBudget(record.recallBudget, "RecallSelection.recallBudget"),
    recallPolicy: validateRecallPolicy(record.recallPolicy, "RecallSelection.recallPolicy"),
    warnings: readStringArray(record, "warnings", "RecallSelection.warnings"),
  }

  assertRecallBudgetWithinInput(selection, input)
  assertRecallPolicyWithinInput(selection.recallPolicy, input.recallPolicy)

  return selection
}

function validateSelectedItem(
  value: unknown,
  index: number,
  indexByPath: ReadonlyMap<string, RetrievalIndexEntry>,
  recallPolicy: RecallPolicy,
): RecallSelectedItem {
  const label = `RecallSelection.selectedItems[${index}]`
  const record = expectRecord(value, label)
  const path = readString(record, "path", `${label}.path`)
  const entry = indexByPath.get(path)
  if (!entry) {
    throw new Error(`Invalid ${label}.path: selected path is not present in retrievalIndex.`)
  }

  const lineTarget = readEnum(record, "lineTarget", ALLOWED_LINE_TARGETS, `${label}.lineTarget`)
  if (!entry.lineTargets.includes(lineTarget)) {
    throw new Error(`Invalid ${label}.lineTarget: retrievalIndex entry does not support ${lineTarget}.`)
  }

  const readMode = readEnum(record, "readMode", ALLOWED_READ_MODES, `${label}.readMode`)
  const priority = readEnum(record, "priority", ALLOWED_PRIORITIES, `${label}.priority`)
  const visibilityScope = readEnum(
    record,
    "visibilityScope",
    ALLOWED_VISIBILITY_SCOPES,
    `${label}.visibilityScope`,
  )
  const knowledgeScope = readEnum(record, "knowledgeScope", ALLOWED_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`)
  const entryKnowledgeScope = requireKnowledgeScope(entry.knowledgeScope, `retrievalIndex entry ${entry.path}`)

  assertScopesMatch({
    label,
    expectedLabel: `retrievalIndex entry ${entry.path}`,
    visibilityScope,
    knowledgeScope,
    expectedVisibilityScope: entry.visibilityScope,
    expectedKnowledgeScope: entryKnowledgeScope,
  })

  assertNotPcKnowledgeBoundary({
    lineTarget,
    visibilityScope,
    knowledgeScope,
    label,
  })
  if (!recallPolicy.allowFullPageRead && readMode === "fullPage") {
    throw new Error(`Invalid ${label}.readMode: fullPage is not allowed by input.recallPolicy.`)
  }

  const sections = readArray(record, "sections", `${label}.sections`).map((section, sectionIndex) =>
    validateSelectedSection(
      section,
      sectionIndex,
      label,
      entry,
      lineTarget,
      readMode,
      visibilityScope,
      knowledgeScope,
    ),
  )
  if (sections.length === 0) {
    throw new Error(`Invalid ${label}.sections: selected item must reference at least one stable sectionId.`)
  }

  return {
    path,
    lineTarget,
    readMode,
    priority,
    reason: readString(record, "reason", `${label}.reason`),
    expectedUse: readString(record, "expectedUse", `${label}.expectedUse`),
    visibilityScope,
    knowledgeScope,
    sections,
  }
}

function validateSelectedSection(
  value: unknown,
  index: number,
  parentLabel: string,
  entry: RetrievalIndexEntry,
  lineTarget: RpgNarrativeLine,
  readMode: RpgRecallReadMode,
  visibilityScope: RpgVisibilityScope,
  knowledgeScope: RpgKnowledgeScope,
): RecallSelectedSection {
  const label = `${parentLabel}.sections[${index}]`
  const record = expectRecord(value, label)
  const sectionId = readString(record, "sectionId", `${label}.sectionId`)
  const section = entry.availableSections.find((candidate) => candidate.sectionId === sectionId)
  if (!section) {
    throw new Error(`Invalid ${label}.sectionId: sectionId is not present in retrievalIndex.availableSections.`)
  }
  if (!section.lineTargets.includes(lineTarget)) {
    throw new Error(`Invalid ${label}.sectionId: selected section does not support lineTarget ${lineTarget}.`)
  }
  if (!section.readModes.includes(readMode)) {
    throw new Error(`Invalid ${label}.sectionId: selected section does not support readMode ${readMode}.`)
  }
  const sectionKnowledgeScope = requireKnowledgeScope(
    section.knowledgeScope ?? entry.knowledgeScope,
    `retrievalIndex section ${entry.path}#${section.sectionId}`,
  )
  assertScopesMatch({
    label,
    expectedLabel: `retrievalIndex section ${entry.path}#${section.sectionId}`,
    visibilityScope,
    knowledgeScope,
    expectedVisibilityScope: section.visibilityScope,
    expectedKnowledgeScope: sectionKnowledgeScope,
  })
  if (section.visibilityScope === "user_visible_pc_unknown" && PC_KNOWLEDGE_SCOPES.has(knowledgeScope)) {
    throw new Error(`Invalid ${label}: user_visible_pc_unknown section must not be marked as PC knowledge.`)
  }

  return {
    sectionId,
    reason: readString(record, "reason", `${label}.reason`),
    expectedUse: readString(record, "expectedUse", `${label}.expectedUse`),
    priority: readEnum(record, "priority", ALLOWED_PRIORITIES, `${label}.priority`),
  }
}

function validateExclusion(
  value: unknown,
  index: number,
  indexByPath: ReadonlyMap<string, RetrievalIndexEntry>,
): RecallExclusion {
  const label = `RecallSelection.exclusions[${index}]`
  const record = expectRecord(value, label)
  const path = readString(record, "path", `${label}.path`)
  const entry = indexByPath.get(path)
  if (!entry) {
    throw new Error(`Invalid ${label}.path: exclusion path is not present in retrievalIndex.`)
  }

  const lineTarget =
    record.lineTarget === undefined
      ? undefined
      : readEnum(record, "lineTarget", ALLOWED_LINE_TARGETS, `${label}.lineTarget`)
  const visibilityScope =
    record.visibilityScope === undefined
      ? undefined
      : readEnum(record, "visibilityScope", ALLOWED_VISIBILITY_SCOPES, `${label}.visibilityScope`)
  const knowledgeScope =
    record.knowledgeScope === undefined
      ? undefined
      : readEnum(record, "knowledgeScope", ALLOWED_KNOWLEDGE_SCOPES, `${label}.knowledgeScope`)

  if (lineTarget && visibilityScope && knowledgeScope) {
    assertNotPcKnowledgeBoundary({ lineTarget, visibilityScope, knowledgeScope, label })
  }

  const knownSections = new Set(entry.availableSections.map((section) => section.sectionId))
  const sectionIds = readStringArray(record, "sectionIds", `${label}.sectionIds`)
  for (const sectionId of sectionIds) {
    if (!knownSections.has(sectionId)) {
      throw new Error(`Invalid ${label}.sectionIds: sectionId ${sectionId} is not present in retrievalIndex.`)
    }
  }

  return {
    path,
    sectionIds,
    lineTarget,
    visibilityScope,
    knowledgeScope,
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function validateRecallBudget(value: unknown, label: string): RecallBudget {
  const record = expectRecord(value, label)
  return {
    maxItems: readPositiveInteger(record, "maxItems", `${label}.maxItems`),
    maxSections: readPositiveInteger(record, "maxSections", `${label}.maxSections`),
    maxEstimatedTokens: readOptionalPositiveInteger(record, "maxEstimatedTokens", `${label}.maxEstimatedTokens`),
    preferredLineTargets: readArray(record, "preferredLineTargets", `${label}.preferredLineTargets`).map(
      (target, index) => readEnumValue(target, ALLOWED_LINE_TARGETS, `${label}.preferredLineTargets[${index}]`),
    ),
  }
}

function validateRecallPolicy(value: unknown, label: string): RecallPolicy {
  const record = expectRecord(value, label)
  const requireStableSectionIds = readBoolean(record, "requireStableSectionIds", `${label}.requireStableSectionIds`)
  if (requireStableSectionIds !== true) {
    throw new Error(`Invalid ${label}.requireStableSectionIds: must be true.`)
  }

  const pcKnowledgeBoundaryPath = readString(record, "pcKnowledgeBoundaryPath", `${label}.pcKnowledgeBoundaryPath`)
  if (pcKnowledgeBoundaryPath !== "wiki/player/known_information.md") {
    throw new Error(`Invalid ${label}.pcKnowledgeBoundaryPath: must be wiki/player/known_information.md.`)
  }

  const parallelLineDoesNotGrantPcKnowledge = readBoolean(
    record,
    "parallelLineDoesNotGrantPcKnowledge",
    `${label}.parallelLineDoesNotGrantPcKnowledge`,
  )
  if (parallelLineDoesNotGrantPcKnowledge !== true) {
    throw new Error(`Invalid ${label}.parallelLineDoesNotGrantPcKnowledge: must be true.`)
  }

  return {
    allowFullPageRead: readBoolean(record, "allowFullPageRead", `${label}.allowFullPageRead`),
    requireStableSectionIds,
    pcKnowledgeBoundaryPath,
    parallelLineDoesNotGrantPcKnowledge,
    notes: readStringArray(record, "notes", `${label}.notes`),
  }
}

function assertNotPcKnowledgeBoundary(input: {
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  label: string
}): void {
  if (
    (input.lineTarget === "parallelLine" || input.visibilityScope === "user_visible_pc_unknown")
    && PC_KNOWLEDGE_SCOPES.has(input.knowledgeScope)
  ) {
    throw new Error(
      `Invalid ${input.label}: parallelLine or user_visible_pc_unknown material must not be marked as PC knowledge.`,
    )
  }
}

function assertNoForbiddenOutputKeys(value: unknown, path = "RecallSelection"): void {
  if (value === null || typeof value !== "object") return

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenOutputKeys(entry, `${path}[${index}]`))
    return
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const forbidden = FORBIDDEN_OUTPUT_KEYS.find((entry) => entry.pattern.test(key))
    if (forbidden) {
      throw new Error(`Invalid RecallSelection: ${forbidden.message} Forbidden key ${path}.${key}.`)
    }
    assertNoForbiddenOutputKeys(child, `${path}.${key}`)
  }
}

function assertRecallBudgetWithinInput(selection: RecallSelection, input: RecallSelectorInput): void {
  if (selection.selectedItems.length > input.recallBudget.maxItems) {
    throw new Error("Invalid RecallSelection.selectedItems: selected item count exceeds input.recallBudget.maxItems.")
  }

  const selectedSectionCount = selection.selectedItems.reduce((total, item) => total + item.sections.length, 0)
  if (selectedSectionCount > input.recallBudget.maxSections) {
    throw new Error("Invalid RecallSelection.selectedItems: selected section count exceeds input.recallBudget.maxSections.")
  }

  if (selection.recallBudget.maxItems > input.recallBudget.maxItems) {
    throw new Error("Invalid RecallSelection.recallBudget.maxItems: must not exceed input.recallBudget.maxItems.")
  }
  if (selection.recallBudget.maxSections > input.recallBudget.maxSections) {
    throw new Error("Invalid RecallSelection.recallBudget.maxSections: must not exceed input.recallBudget.maxSections.")
  }
  if (
    input.recallBudget.maxEstimatedTokens !== undefined &&
    (selection.recallBudget.maxEstimatedTokens ?? 0) > input.recallBudget.maxEstimatedTokens
  ) {
    throw new Error(
      "Invalid RecallSelection.recallBudget.maxEstimatedTokens: must not exceed input.recallBudget.maxEstimatedTokens.",
    )
  }

  const allowedLineTargets = new Set(input.recallBudget.preferredLineTargets)
  for (const [index, lineTarget] of selection.recallBudget.preferredLineTargets.entries()) {
    if (!allowedLineTargets.has(lineTarget)) {
      throw new Error(
        `Invalid RecallSelection.recallBudget.preferredLineTargets[${index}]: must be present in input.recallBudget.preferredLineTargets.`,
      )
    }
  }
}

function assertRecallPolicyWithinInput(selectionPolicy: RecallPolicy, inputPolicy: RecallPolicy): void {
  if (!inputPolicy.allowFullPageRead && selectionPolicy.allowFullPageRead) {
    throw new Error(
      "Invalid RecallSelection.recallPolicy.allowFullPageRead: must not widen input.recallPolicy.allowFullPageRead.",
    )
  }
}

function assertScopesMatch(input: {
  label: string
  expectedLabel: string
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  expectedVisibilityScope: RpgVisibilityScope
  expectedKnowledgeScope: RpgKnowledgeScope
}): void {
  if (input.visibilityScope !== input.expectedVisibilityScope) {
    throw new Error(
      `Invalid ${input.label}.visibilityScope: must match ${input.expectedLabel} visibilityScope and cannot widen retrieval visibility or mark protected material as PC knowledge.`,
    )
  }
  if (input.knowledgeScope !== input.expectedKnowledgeScope) {
    throw new Error(
      `Invalid ${input.label}.knowledgeScope: must match ${input.expectedLabel} knowledgeScope and cannot widen retrieval knowledge or mark protected material as PC knowledge.`,
    )
  }
}

function requireKnowledgeScope(value: RpgKnowledgeScope | undefined, label: string): RpgKnowledgeScope {
  if (value === undefined) {
    throw new Error(`Invalid ${label}: knowledgeScope boundary is required for recall selection validation.`)
  }
  return value
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: must be a non-empty string.`)
  }
  return value.trim()
}

function readStringArray(record: Record<string, unknown>, key: string, label: string): string[] {
  return readArray(record, key, label)
    .map((entry, index) => {
      if (typeof entry !== "string") {
        throw new Error(`Invalid ${label}[${index}]: must be a string.`)
      }
      return entry.trim()
    })
    .filter(Boolean)
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array.`)
  }
  return value
}

function readPositiveInteger(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key]
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Invalid ${label}: must be a positive integer.`)
  }
  return value as number
}

function readOptionalPositiveInteger(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Invalid ${label}: must be a positive integer when provided.`)
  }
  return value as number
}

function readBoolean(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key]
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}: must be a boolean.`)
  }
  return value
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  label: string,
): T {
  return readEnumValue(record[key], allowed, label)
}

function readEnumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: value is not allowed.`)
  }
  return value as T
}

export type { RecallableSection }
