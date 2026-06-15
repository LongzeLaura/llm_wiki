import type {
  RecallExclusion,
  RecallSelection,
  RecallSelectionDraft,
  RecallSelectionDraftExclusion,
  RecallSelectionDraftItem,
  RecallSelectorInput,
  RecallSelectedItem,
  RecallSelectedSection,
  RecallableSection,
  RetrievalIndexEntry,
} from "../../rpg-runtime/types"
import type { RpgRecallReadMode } from "../../rpg-wiki-schema"
import { assertNoForbiddenSoftDraftKeys } from "./soft-draft-protocol"
import { validateRecallSelection } from "./recall-selector-validation"

const ALLOWED_READ_MODES = new Set<RpgRecallReadMode>([
  "summary",
  "focusedSection",
  "fullPage",
  "metadataOnly",
])

const ALLOWED_PRIORITIES = new Set(["critical", "high", "medium", "low"])

const FORBIDDEN_DRAFT_KEY_PATTERNS = [
  /^(?:selectionId|sourceWorkingStateId|recallBudget|recallPolicy|warnings)$/i,
  /^(?:lineTarget|visibilityScope|knowledgeScope)$/i,
  /^(?:sections)$/i,
  /^(?:narration|narrative)$/i,
  /^(?:playerFacingText|parallelLineText|nextActionOptions)$/i,
  /^(?:wikiWrites?|wikiWriteProposal|proposedUpdates?|pendingUpdates?|targetPath|strategy|applyUpdates?)$/i,
  /^(?:recalledMaterials|fullText|rawText|fileContent|pageContent)$/i,
  /^(?:outlineBrief|outlineImpactReport|outlineRevision|outlineRevisionProposal|provisionalOutlinePatch|regenerationRequest)$/i,
] as const

export function compileRecallSelectionDraftOutput(
  draftValue: unknown,
  input: RecallSelectorInput,
): RecallSelection {
  assertNoForbiddenSoftDraftKeys(draftValue, FORBIDDEN_DRAFT_KEY_PATTERNS, "RecallSelectionDraft")

  const draft = validateRecallSelectionDraft(draftValue)
  const indexByPath = new Map(input.retrievalIndex.map((entry) => [entry.path, entry]))
  const actionId = input.postActionWorkingState.submittedAction.id

  const compiled: RecallSelection = {
    selectionId: `recall-selection-${actionId}`,
    sourceWorkingStateId: `post-action-working-state-${actionId}`,
    selectedItems: draft.selectedItems.map((item, index) => compileDraftItem(item, index, indexByPath, input)),
    exclusions: draft.exclusions.map((exclusion, index) => compileDraftExclusion(exclusion, index, indexByPath)),
    recallBudget: input.recallBudget,
    recallPolicy: input.recallPolicy,
    warnings: [],
  }

  return validateRecallSelection(compiled, input)
}

function validateRecallSelectionDraft(value: unknown): RecallSelectionDraft {
  const record = expectRecord(value, "RecallSelectionDraft")
  return {
    selectedItems: readArray(record, "selectedItems", "RecallSelectionDraft.selectedItems").map((item, index) =>
      validateDraftItem(item, index),
    ),
    exclusions: readArray(record, "exclusions", "RecallSelectionDraft.exclusions").map((exclusion, index) =>
      validateDraftExclusion(exclusion, index),
    ),
  }
}

function validateDraftItem(value: unknown, index: number): RecallSelectionDraftItem {
  const label = `RecallSelectionDraft.selectedItems[${index}]`
  const record = expectRecord(value, label)
  const readMode = readString(record, "readMode", `${label}.readMode`) as RpgRecallReadMode
  if (!ALLOWED_READ_MODES.has(readMode)) {
    throw new Error(`Invalid ${label}.readMode: value is not allowed.`)
  }
  const priority = readString(record, "priority", `${label}.priority`) as RecallSelectionDraftItem["priority"]
  if (!ALLOWED_PRIORITIES.has(priority)) {
    throw new Error(`Invalid ${label}.priority: value is not allowed.`)
  }

  return {
    path: readString(record, "path", `${label}.path`),
    readMode,
    priority,
    reason: readString(record, "reason", `${label}.reason`),
    expectedUse: readString(record, "expectedUse", `${label}.expectedUse`),
    sectionIds: readStringArray(record, "sectionIds", `${label}.sectionIds`, { requireNonEmpty: true }),
  }
}

function validateDraftExclusion(value: unknown, index: number): RecallSelectionDraftExclusion {
  const label = `RecallSelectionDraft.exclusions[${index}]`
  const record = expectRecord(value, label)
  return {
    path: readString(record, "path", `${label}.path`),
    sectionIds: readStringArray(record, "sectionIds", `${label}.sectionIds`),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function compileDraftItem(
  item: RecallSelectionDraftItem,
  index: number,
  indexByPath: ReadonlyMap<string, RetrievalIndexEntry>,
  input: RecallSelectorInput,
): RecallSelectedItem {
  const label = `RecallSelectionDraft.selectedItems[${index}]`
  const entry = requireEntry(indexByPath, item.path, `${label}.path`)
  const selectedSections = item.sectionIds.map((sectionId, sectionIndex) =>
    requireSection(entry, sectionId, `${label}.sectionIds[${sectionIndex}]`),
  )
  const boundarySection = selectedSections[0]
  if (!boundarySection) {
    throw new Error(`Invalid ${label}.sectionIds: selected item must reference at least one stable sectionId.`)
  }

  const lineTarget = chooseLineTarget(boundarySection, input, `${label}.sectionIds[0]`)
  const visibilityScope = boundarySection.visibilityScope
  const knowledgeScope = boundarySection.knowledgeScope ?? entry.knowledgeScope
  if (knowledgeScope === undefined) {
    throw new Error(`Invalid ${label}: knowledgeScope boundary is required for recall selection compilation.`)
  }

  return {
    path: item.path,
    lineTarget,
    readMode: item.readMode,
    priority: item.priority,
    reason: item.reason,
    expectedUse: item.expectedUse,
    visibilityScope,
    knowledgeScope,
    sections: selectedSections.map((section): RecallSelectedSection => ({
      sectionId: section.sectionId,
      reason: item.reason,
      expectedUse: item.expectedUse,
      priority: item.priority,
    })),
  }
}

function compileDraftExclusion(
  exclusion: RecallSelectionDraftExclusion,
  index: number,
  indexByPath: ReadonlyMap<string, RetrievalIndexEntry>,
): RecallExclusion {
  const label = `RecallSelectionDraft.exclusions[${index}]`
  const entry = requireEntry(indexByPath, exclusion.path, `${label}.path`)
  const selectedSections = exclusion.sectionIds.map((sectionId, sectionIndex) =>
    requireSection(entry, sectionId, `${label}.sectionIds[${sectionIndex}]`),
  )
  const boundarySection = selectedSections[0] ?? entry.availableSections[0]
  const knowledgeScope = boundarySection?.knowledgeScope ?? entry.knowledgeScope

  return {
    path: exclusion.path,
    sectionIds: exclusion.sectionIds,
    lineTarget: boundarySection?.lineTargets[0] ?? entry.lineTargets[0],
    visibilityScope: boundarySection?.visibilityScope ?? entry.visibilityScope,
    knowledgeScope,
    reason: exclusion.reason,
  }
}

function requireEntry(
  indexByPath: ReadonlyMap<string, RetrievalIndexEntry>,
  path: string,
  label: string,
): RetrievalIndexEntry {
  const entry = indexByPath.get(path)
  if (!entry) {
    throw new Error(`Invalid ${label}: selected path is not present in retrievalIndex.`)
  }
  return entry
}

function requireSection(entry: RetrievalIndexEntry, sectionId: string, label: string): RecallableSection {
  const section = entry.availableSections.find((candidate) => candidate.sectionId === sectionId)
  if (!section) {
    throw new Error(`Invalid ${label}: sectionId is not present in retrievalIndex.availableSections.`)
  }
  return section
}

function chooseLineTarget(
  section: RecallableSection,
  input: RecallSelectorInput,
  label: string,
): RecallSelectedItem["lineTarget"] {
  for (const preferred of input.recallBudget.preferredLineTargets) {
    if (section.lineTargets.includes(preferred)) return preferred
  }
  const first = section.lineTargets[0]
  if (!first) {
    throw new Error(`Invalid ${label}: section has no lineTargets to derive from.`)
  }
  return first
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

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
  options: { requireNonEmpty?: boolean } = {},
): string[] {
  const values = readArray(record, key, label)
    .map((entry, index) => {
      if (typeof entry !== "string") {
        throw new Error(`Invalid ${label}[${index}]: must be a string.`)
      }
      return entry.trim()
    })
    .filter(Boolean)

  if (options.requireNonEmpty && values.length === 0) {
    throw new Error(`Invalid ${label}: must contain at least one sectionId.`)
  }

  return values
}

function readArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an array.`)
  }
  return value
}
