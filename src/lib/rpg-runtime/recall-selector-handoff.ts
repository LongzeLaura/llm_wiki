import fs from "node:fs/promises"
import path from "node:path"
import { RPG_SCHEMA_SLOTS } from "../rpg-wiki-schema"
import type {
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgRecallReadMode,
  RpgVisibilityScope,
} from "../rpg-wiki-schema"
import type {
  ActionResolution,
  PostActionWorkingState,
  RecallExclusion,
  RecallableSection,
  RecallBudget,
  RecallPolicy,
  RecallSelection,
  RecallSelectedItem,
  RecallSelectorHandoff,
  RecallSelectorInput,
  RecalledMaterial,
  RecalledMaterialSection,
  RetrievalIndexEntry,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"

const SYNTHETIC_WHOLE_SECTION_ID = "synthetic.whole"
const SUMMARY_EXCERPT_LIMIT = 800
const FOCUSED_SECTION_EXCERPT_LIMIT = 1200
const FULL_PAGE_LIMIT = 8000
const OUTLINE_MAIN_LIMIT = 1200

export interface BuildRecallSelectorInputFromTurnStateInput {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
}

export interface BuildRecallSelectorInputFromTurnStateResult {
  input: RecallSelectorInput
  warnings: string[]
}

export interface ReadRecalledMaterialsInput {
  projectPath: string
  retrievalIndex: RetrievalIndexEntry[]
  recallSelection: RecallSelection
}

export function buildRecallSelectorInputFromTurnState(
  input: BuildRecallSelectorInputFromTurnStateInput,
): BuildRecallSelectorInputFromTurnStateResult {
  const { retrievalIndex, warnings } = buildRetrievalIndexFromTurnState(input)
  return {
    input: {
      postActionWorkingState: input.postActionWorkingState,
      actionResolution: input.actionResolution,
      worldTickResult: input.worldTickResult,
      visibleSelection: input.visibleSelection,
      pacingState: input.postActionWorkingState.pacingState,
      gapState: input.postActionWorkingState.gapState,
      retrievalIndex,
      recallBudget: defaultRecallBudget(),
      recallPolicy: defaultRecallPolicy(warnings),
    },
    warnings,
  }
}

export function buildRetrievalIndexFromTurnState(
  input: BuildRecallSelectorInputFromTurnStateInput,
): { retrievalIndex: RetrievalIndexEntry[]; warnings: string[] } {
  const builders = new Map<string, RetrievalIndexBuilder>()
  const warnings: string[] = []

  for (const slot of RPG_SCHEMA_SLOTS) {
    addEntry(builders, warnings, {
      path: slot.path,
      summary: `Known schema slot ${slot.slotId}; owner=${slot.owner}; runtimePriority=${slot.runtimePriority}.`,
      lineTarget: lineTargetForPath(slot.path),
      visibilityScope: visibilityForPath(slot.path),
      knowledgeScope: knowledgeForPath(slot.path),
      sectionId: `slot.${slot.slotId}`,
      sectionRole: "schema_slot",
      heading: slot.slotId,
      tags: ["schema-slot", slot.owner, slot.runtimePriority],
    })
  }

  for (const reference of input.postActionWorkingState.references) {
    addEntry(builders, warnings, {
      path: reference,
      summary: "PostActionWorkingState reference from the merged action/world tick handoff.",
      lineTarget: lineTargetForPath(reference),
      visibilityScope: visibilityForPath(reference),
      knowledgeScope: knowledgeForPath(reference),
      tags: ["post-action-working-state-reference"],
    })
  }

  for (const reference of input.actionResolution.references) {
    addEntry(builders, warnings, {
      path: reference.path,
      summary: reference.reason,
      lineTarget: "playerVisibleLine",
      visibilityScope: reference.visibilityScope ?? "pc_visible",
      knowledgeScope: reference.knowledgeScope ?? "pc_known",
      sectionId: reference.sectionId,
      sectionRole: "action_resolution_reference",
      heading: reference.sectionId,
      tags: ["action-resolution-reference", reference.usePurpose],
    })
  }

  for (const reference of input.worldTickResult.references) {
    addEntry(builders, warnings, {
      path: reference.path,
      summary: reference.reason,
      lineTarget: lineTargetFromVisibility(reference.visibility?.visibilityScope) ?? lineTargetForPath(reference.path),
      visibilityScope: reference.visibility?.visibilityScope ?? visibilityForPath(reference.path),
      knowledgeScope: reference.visibility?.knowledgeScope ?? knowledgeForPath(reference.path),
      sectionId: reference.sectionId,
      sectionRole: "world_tick_reference",
      heading: reference.sectionId,
      tags: ["world-tick-reference", reference.usePurpose],
    })
  }

  for (const path of collectAffectedPaths(input)) {
    addEntry(builders, warnings, {
      path,
      summary: "Affected path from Action Resolution, World Tick, visible selection, or working state.",
      lineTarget: lineTargetForPath(path),
      visibilityScope: visibilityForPath(path),
      knowledgeScope: knowledgeForPath(path),
      tags: path.includes("/runtime/") ? ["affected-path", "runtime-overlay"] : ["affected-path"],
    })
  }

  return {
    retrievalIndex: [...builders.values()].map(finalizeEntry).sort((a, b) => a.path.localeCompare(b.path)),
    warnings,
  }
}

export async function createRecallSelectorHandoff(
  input: ReadRecalledMaterialsInput,
): Promise<RecallSelectorHandoff> {
  const readResult = await readRecalledMaterials(input)
  return {
    recallSelection: input.recallSelection,
    recalledMaterials: readResult.recalledMaterials,
    warnings: [...input.recallSelection.warnings, ...readResult.warnings],
  }
}

export async function readRecalledMaterials(
  input: ReadRecalledMaterialsInput,
): Promise<{ recalledMaterials: RecalledMaterial[]; warnings: string[] }> {
  const indexByPath = new Map(input.retrievalIndex.map((entry) => [entry.path, entry]))
  const excludedPaths = new Set(
    input.recallSelection.exclusions
      .filter((exclusion) => exclusion.sectionIds.length === 0)
      .map((exclusion) => exclusion.path),
  )
  const excludedSectionsByPath = buildExcludedSectionsByPath(input.recallSelection.exclusions)
  const warnings: string[] = []
  const recalledMaterials: RecalledMaterial[] = []

  for (const item of input.recallSelection.selectedItems) {
    const entry = indexByPath.get(item.path)
    if (!entry) {
      throw new Error(`Recall reader rejected selected path ${item.path}: path is not present in retrievalIndex.`)
    }
    assertSafeWikiPath(input.projectPath, item.path)

    if (excludedPaths.has(item.path)) {
      warnings.push(`Recall reader skipped excluded path ${item.path}.`)
      continue
    }

    const selectedSections = selectAllowedSections(item, entry, excludedSectionsByPath.get(item.path), warnings)
    if (selectedSections.length === 0) {
      warnings.push(`Recall reader skipped ${item.path}: all selected sections were excluded.`)
      continue
    }

    const materialWarnings: string[] = []
    let fileContent = ""
    if (item.readMode !== "metadataOnly") {
      try {
        fileContent = await fs.readFile(resolveSafeWikiPath(input.projectPath, item.path), "utf-8")
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        materialWarnings.push(`Could not read allowlisted recall path ${item.path}: ${message}`)
      }
    }

    const sections = selectedSections.map((section) =>
      buildRecalledMaterialSection({
        item,
        section,
        fileContent,
        materialWarnings,
      }),
    )

    recalledMaterials.push({
      path: item.path,
      lineTarget: item.lineTarget,
      readMode: item.readMode,
      priority: item.priority,
      reason: item.reason,
      expectedUse: item.expectedUse,
      visibilityScope: item.visibilityScope,
      knowledgeScope: item.knowledgeScope,
      sections,
      warnings: materialWarnings,
    })
  }

  return { recalledMaterials, warnings }
}

function defaultRecallBudget(): RecallBudget {
  return {
    maxItems: 8,
    maxSections: 16,
    maxEstimatedTokens: 6000,
    preferredLineTargets: ["playerVisibleLine", "parallelLine", "tensionLine"],
  }
}

function defaultRecallPolicy(warnings: readonly string[]): RecallPolicy {
  return {
    allowFullPageRead: false,
    requireStableSectionIds: true,
    pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
    parallelLineDoesNotGrantPcKnowledge: true,
    notes: [
      "Recall Selector outputs only an allowlist plan; deterministic local code performs any file read.",
      "First-version retrieval index uses synthetic stable sectionIds when source metadata lacks section-level anchors.",
      "Narration must not treat GM-only, parallelLine, or user_visible_pc_unknown handoff material as PC knowledge.",
      ...warnings,
    ],
  }
}

interface AddEntryInput {
  path: string
  summary: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  sectionId?: string
  sectionRole?: string
  heading?: string
  tags?: string[]
}

interface RetrievalIndexBuilder {
  path: string
  title?: string
  categoryId?: string
  summaries: string[]
  lineTargets: Set<RpgNarrativeLine>
  visibilityScope: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  sections: Map<string, RecallableSection>
  tags: Set<string>
}

function addEntry(builders: Map<string, RetrievalIndexBuilder>, warnings: string[], input: AddEntryInput): void {
  const normalizedPath = normalizeWikiPath(input.path)
  if (!isSafeRetrievalIndexPath(normalizedPath)) return

  let builder = builders.get(normalizedPath)
  if (!builder) {
    builder = {
      path: normalizedPath,
      title: titleFromPath(normalizedPath),
      categoryId: normalizedPath.split("/")[1],
      summaries: [],
      lineTargets: new Set(),
      visibilityScope: input.visibilityScope,
      knowledgeScope: input.knowledgeScope,
      sections: new Map(),
      tags: new Set(),
    }
    builders.set(normalizedPath, builder)
  }

  const sectionId = input.sectionId ?? SYNTHETIC_WHOLE_SECTION_ID
  const addsSyntheticSection = input.sectionId === undefined && !builder.sections.has(sectionId)

  builder.summaries.push(input.summary)
  builder.lineTargets.add(input.lineTarget)
  input.tags?.forEach((tag) => builder?.tags.add(tag))
  addSection(builder, {
    sectionId,
    sectionRole: input.sectionRole ?? "synthetic_whole_file",
    heading: input.heading ?? titleFromPath(normalizedPath),
    aliases: [],
    lineTargets: [input.lineTarget],
    readModes: ["summary", "focusedSection", "metadataOnly"],
    visibilityScope: input.visibilityScope,
    knowledgeScope: input.knowledgeScope,
    summary:
      input.sectionId === undefined
        ? "Synthetic stable whole-file anchor for first-version recall; source lacks section metadata."
        : input.summary,
  })

  if (addsSyntheticSection) {
    warnings.push(`Retrieval index uses synthetic sectionId ${SYNTHETIC_WHOLE_SECTION_ID} for ${normalizedPath}.`)
  }
}

function addSection(builder: RetrievalIndexBuilder, section: RecallableSection): void {
  const existing = builder.sections.get(section.sectionId)
  if (!existing) {
    builder.sections.set(section.sectionId, section)
    return
  }

  builder.sections.set(section.sectionId, {
    ...existing,
    lineTargets: unique([...existing.lineTargets, ...section.lineTargets]),
    readModes: unique([...existing.readModes, ...section.readModes]),
    aliases: unique([...existing.aliases, ...section.aliases]),
    summary: existing.summary ?? section.summary,
  })
}

function finalizeEntry(builder: RetrievalIndexBuilder): RetrievalIndexEntry {
  return {
    path: builder.path,
    title: builder.title,
    categoryId: builder.categoryId,
    summary: unique(builder.summaries).join(" "),
    lineTargets: [...builder.lineTargets],
    visibilityScope: builder.visibilityScope,
    knowledgeScope: builder.knowledgeScope,
    availableSections: [...builder.sections.values()],
    tags: [...builder.tags],
  }
}

function collectAffectedPaths(input: BuildRecallSelectorInputFromTurnStateInput): string[] {
  return unique([
    ...input.actionResolution.eventDraft.affectedRefs,
    ...input.actionResolution.directResults.flatMap((result) => result.affectedRefs),
    ...input.actionResolution.playerActionDelta.runtimeDeltaRefs.map((reference) => reference.sourcePath),
    ...input.worldTickResult.worldDeltas.playerVisibleLine.flatMap((delta) => delta.affectedPaths),
    ...input.worldTickResult.worldDeltas.parallelLine.flatMap((delta) => delta.affectedPaths),
    ...input.worldTickResult.worldDeltas.tensionLine.flatMap((delta) => delta.affectedPaths),
    ...input.worldTickResult.clockUpdates.flatMap((clock) => clock.affectedPaths),
    ...input.worldTickResult.settledOngoingEvents.flatMap((event) => event.affectedPaths),
    ...input.worldTickResult.informationBroadcast.flatMap((broadcast) => broadcast.affectedPaths),
    ...input.worldTickResult.reactionQueue.flatMap((reaction) => reaction.affectedPaths),
    ...input.worldTickResult.pacingUpdate.affectedPaths,
    ...input.worldTickResult.gapState.affectedPaths,
    ...input.visibleSelection.currentSceneVisibleCandidates.flatMap((candidate) => candidate.affectedPaths),
    ...input.visibleSelection.parallelLensCandidates.flatMap((candidate) => candidate.affectedPaths),
    ...input.visibleSelection.tensionCandidates.flatMap((candidate) => candidate.affectedPaths),
    ...input.postActionWorkingState.runtimeDeltaRefs.map((reference) => reference.sourcePath),
  ])
}

function buildExcludedSectionsByPath(exclusions: readonly RecallExclusion[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  for (const exclusion of exclusions) {
    const sections = result.get(exclusion.path) ?? new Set<string>()
    exclusion.sectionIds.forEach((sectionId) => sections.add(sectionId))
    result.set(exclusion.path, sections)
  }
  return result
}

function selectAllowedSections(
  item: RecallSelectedItem,
  entry: RetrievalIndexEntry,
  excludedSectionIds: ReadonlySet<string> | undefined,
  warnings: string[],
): RecallSelectedItem["sections"] {
  const knownSections = new Set(entry.availableSections.map((section) => section.sectionId))
  return item.sections.filter((section) => {
    if (!knownSections.has(section.sectionId)) {
      throw new Error(
        `Recall reader rejected selected section ${section.sectionId} for ${item.path}: sectionId is not present in retrievalIndex.availableSections.`,
      )
    }
    if (excludedSectionIds?.has(section.sectionId)) {
      warnings.push(`Recall reader skipped excluded section ${section.sectionId} for ${item.path}.`)
      return false
    }
    return true
  })
}

function buildRecalledMaterialSection(input: {
  item: RecallSelectedItem
  section: RecallSelectedItem["sections"][number]
  fileContent: string
  materialWarnings: string[]
}): RecalledMaterialSection {
  const sectionWarnings: string[] = []
  const content = contentForReadMode(input.item.path, input.item.readMode, input.fileContent, sectionWarnings)
  return {
    sectionId: input.section.sectionId,
    readMode: input.item.readMode,
    priority: input.section.priority,
    reason: input.section.reason,
    expectedUse: input.section.expectedUse,
    content,
    warnings: [...sectionWarnings, ...input.materialWarnings],
  }
}

function contentForReadMode(path: string, readMode: RpgRecallReadMode, content: string, warnings: string[]): string {
  if (readMode === "metadataOnly") {
    return "[metadata-only recall: deterministic reader did not read file content]"
  }

  if (readMode === "summary") {
    warnings.push("First-version recall reader returns a controlled excerpt for summary mode.")
    return excerpt(content, SUMMARY_EXCERPT_LIMIT)
  }

  if (readMode === "focusedSection") {
    warnings.push("First-version recall reader has no section slicer yet; returning a controlled excerpt for the selected sectionId.")
    return excerpt(content, FOCUSED_SECTION_EXCERPT_LIMIT)
  }

  if (path === "wiki/outlines/main.md") {
    warnings.push("Full-page recall for wiki/outlines/main.md is capped; full outline handoff to Narration is forbidden.")
    return excerpt(content, OUTLINE_MAIN_LIMIT)
  }

  return excerpt(content, FULL_PAGE_LIMIT)
}

function assertSafeWikiPath(projectPath: string, wikiPath: string): void {
  resolveSafeWikiPath(projectPath, wikiPath)
}

function resolveSafeWikiPath(projectPath: string, wikiPath: string): string {
  const normalized = normalizeWikiPath(wikiPath)
  if (!isSafeReadableWikiPath(normalized)) {
    throw new Error(`Recall reader rejected unsafe wiki path ${wikiPath}.`)
  }

  const root = path.resolve(projectPath)
  const resolved = path.resolve(root, normalized)
  const relative = path.relative(root, resolved)
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Recall reader rejected project root escape for ${wikiPath}.`)
  }
  return resolved
}

function isSafeRetrievalIndexPath(value: string): boolean {
  return value.startsWith("wiki/") && !value.startsWith("wiki/runtime/") && !hasUnsafePathSegment(value)
}

function isSafeReadableWikiPath(value: string): boolean {
  return isSafeRetrievalIndexPath(value) && value.length > "wiki/".length
}

function hasUnsafePathSegment(value: string): boolean {
  if (/^[a-z]:/iu.test(value) || value.startsWith("/") || value.startsWith("\\")) return true
  return value.split("/").some((segment) => segment === "" || segment === "." || segment === ".." || segment.startsWith("."))
}

function normalizeWikiPath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function lineTargetForPath(pathValue: string): RpgNarrativeLine {
  const normalized = normalizeWikiPath(pathValue)
  if (normalized.includes("/runtime/") || normalized.startsWith("wiki/outlines/") || normalized.startsWith("wiki/plot-arcs/")) {
    return "tensionLine"
  }
  return "playerVisibleLine"
}

function lineTargetFromVisibility(visibilityScope: RpgVisibilityScope | undefined): RpgNarrativeLine | undefined {
  if (visibilityScope === "user_visible_pc_unknown") return "parallelLine"
  if (visibilityScope === "gm_only" || visibilityScope === "hidden") return "tensionLine"
  return undefined
}

function visibilityForPath(pathValue: string): RpgVisibilityScope {
  const normalized = normalizeWikiPath(pathValue)
  if (normalized.startsWith("wiki/outlines/") || normalized.includes("/runtime/")) return "gm_only"
  return "pc_visible"
}

function knowledgeForPath(pathValue: string): RpgKnowledgeScope {
  const visibility = visibilityForPath(pathValue)
  if (visibility === "gm_only" || visibility === "hidden") return "gm_only"
  if (visibility === "user_visible_pc_unknown") return "user_only"
  return "pc_known"
}

function titleFromPath(pathValue: string): string {
  const parts = pathValue.split("/")
  return parts[parts.length - 1]?.replace(/\.md$/i, "") ?? pathValue
}

function excerpt(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  return `${content.slice(0, maxLength).trimEnd()}\n[recall excerpt truncated]`
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)]
}
