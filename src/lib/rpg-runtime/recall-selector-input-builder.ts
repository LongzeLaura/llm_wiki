import { RPG_SCHEMA_SLOTS, type RpgNarrativeLine, type RpgRecallReadMode } from "../rpg-wiki-schema"
import type {
  ActionResolution,
  PostActionWorkingState,
  RecallableSection,
  RecallBudget,
  RecallPolicy,
  RecallSelectorInput,
  RetrievalIndexEntry,
  SubmittedAction,
  TurnSemanticHandoff,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"
import {
  compactText,
  formatPageEntry,
  isAllowedReference,
  markPages,
  normalizeProjectPath,
  rankedPages,
  readMarkdownDir,
  readRequiredSchemaSlot,
  readSchemaSlotPages,
  tokenize,
  type RuntimePage,
} from "./wiki-readers"

export interface BuildRecallSelectorInputFromTurnStateAndWikiInput {
  projectPath: string
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff?: TurnSemanticHandoff
}

export interface BuildRecallSelectorInputFromTurnStateAndWikiResult {
  input: RecallSelectorInput
  warnings: string[]
}

const MAX_RELEVANT_PAGES = 10
const MAX_REFERENCE_COUNT = 80

export async function buildRecallSelectorInputFromTurnStateAndWiki(
  input: BuildRecallSelectorInputFromTurnStateAndWikiInput,
): Promise<BuildRecallSelectorInputFromTurnStateAndWikiResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()
  const tokens = tokenize(
    [
      input.submittedAction.text,
      input.actionResolution.eventDraft.summary,
      input.postActionWorkingState.campaignDelta,
      collectAffectedPaths(input).join("\n"),
    ].join("\n"),
  )

  const currentScene = await readRequiredSchemaSlot(projectPath, "current_scene", warnings, references)
  const outlineProgressPages = await readSchemaSlotPages(projectPath, ["outline_progress"], warnings)
  const eventPages = rankedPages(await readMarkdownDir(projectPath, "events"), tokens, MAX_RELEVANT_PAGES)
  const sourcePages = rankedPages(await readMarkdownDir(projectPath, "sources", { referenceOnly: true }), tokens, MAX_RELEVANT_PAGES)
  const questPages = rankedPages(await readMarkdownDir(projectPath, "quests"), tokens, MAX_RELEVANT_PAGES)
  const characterPages = selectRelevantPages(await readMarkdownDir(projectPath, "characters"), tokens, input)
  const locationPages = selectRelevantPages(await readMarkdownDir(projectPath, "locations"), tokens, input)
  const factionPages = selectRelevantPages(await readMarkdownDir(projectPath, "factions"), tokens, input)
  const itemPages = selectRelevantPages(await readMarkdownDir(projectPath, "items"), tokens, input)
  const relationshipPages = selectRelevantPages(await readMarkdownDir(projectPath, "relationships"), tokens, input)
  const plotArcPages = selectRelevantPages(await readMarkdownDir(projectPath, "plot-arcs"), tokens, input)

  markPages(
    references,
    [currentScene],
    outlineProgressPages,
    eventPages,
    sourcePages,
    questPages,
    characterPages,
    locationPages,
    factionPages,
    itemPages,
    relationshipPages,
    plotArcPages,
  )
  input.postActionWorkingState.references.forEach((reference) => references.add(reference))
  input.actionResolution.references.forEach((reference) => references.add(reference.path))
  input.worldTickResult.references.forEach((reference) => references.add(reference.path))

  const builders = new Map<string, RetrievalIndexBuilder>()
  const indexWarnings: string[] = []

  addSchemaSlotEntries(builders, indexWarnings)
  addPageEntries(builders, indexWarnings, [currentScene], {
    tags: ["current-scene", "wiki-reader", "post-action-anchor"],
    summaryPrefix: "Current scene snapshot read directly for Recall Selector.",
  })
  addPageEntries(builders, indexWarnings, eventPages, {
    tags: ["event-history", "relevant-events"],
    summaryPrefix: "Recent accepted/relevant event history for recall; do not rewrite happened history.",
  })
  addPageEntries(builders, indexWarnings, sourcePages, {
    tags: ["source-provenance", "metadata-only"],
    summaryPrefix: "Relevant source provenance reference; source content is not current state authority.",
    readModes: ["metadataOnly"],
  })
  addPageEntries(builders, indexWarnings, questPages, {
    tags: ["quest", "objective"],
    summaryPrefix: "Relevant active quest/objective context.",
  })
  addPageEntries(builders, indexWarnings, outlineProgressPages, {
    tags: ["outline-progress", "tension"],
    summaryPrefix: "Outline progress for bounded later outline-aware brief screening.",
  })
  addPageEntries(builders, indexWarnings, [
    ...characterPages,
    ...locationPages,
    ...factionPages,
    ...itemPages,
    ...relationshipPages,
    ...plotArcPages,
  ], {
    tags: ["base-or-runtime-overlay", "relevant-wiki-page"],
    summaryPrefix: "Relevant base page or runtime overlay selected by turn state and affected paths.",
  })
  addTurnStateEntries(builders, indexWarnings, input)

  const retrievalIndex = [...builders.values()]
    .map(finalizeEntry)
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, MAX_REFERENCE_COUNT)

  const allWarnings = [
    ...warnings,
    ...indexWarnings,
    ...[...references]
      .filter((reference) => !isAllowedReference(reference))
      .map((reference) => `Recall Selector input builder skipped disallowed reference: ${reference}`),
  ]

  return {
    input: {
      turnSemanticHandoff: input.turnSemanticHandoff,
      postActionWorkingState: input.postActionWorkingState,
      actionResolution: input.actionResolution,
      worldTickResult: input.worldTickResult,
      visibleSelection: input.visibleSelection,
      pacingState: input.postActionWorkingState.pacingState,
      gapState: input.postActionWorkingState.gapState,
      retrievalIndex,
      recallBudget: defaultRecallBudget(),
      recallPolicy: defaultRecallPolicy(allWarnings),
    },
    warnings: allWarnings,
  }
}

function selectRelevantPages(
  pages: RuntimePage[],
  tokens: string[],
  input: BuildRecallSelectorInputFromTurnStateAndWikiInput,
): RuntimePage[] {
  const affected = new Set(collectAffectedPaths(input).filter(isAllowedReference))
  const affectedPages = pages.filter((page) => affected.has(page.relativePath))
  const ranked = rankedPages(pages, tokens, MAX_RELEVANT_PAGES)
  return uniquePages([...affectedPages, ...ranked]).slice(0, MAX_RELEVANT_PAGES)
}

function addSchemaSlotEntries(builders: Map<string, RetrievalIndexBuilder>, warnings: string[]): void {
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
}

function addPageEntries(
  builders: Map<string, RetrievalIndexBuilder>,
  warnings: string[],
  pages: RuntimePage[],
  options: { tags: string[]; summaryPrefix: string; readModes?: RpgRecallReadMode[] },
): void {
  for (const page of pages) {
    addEntry(builders, warnings, {
      path: page.relativePath,
      summary: compactText(`${options.summaryPrefix}\n${formatPageEntry(page)}`, 900),
      lineTarget: lineTargetForPath(page.relativePath),
      visibilityScope: visibilityForPath(page.relativePath),
      knowledgeScope: knowledgeForPath(page.relativePath),
      sectionId: sectionIdForPath(page.relativePath),
      sectionRole: page.relativePath.includes("/runtime/") ? "runtime_overlay" : "wiki_page",
      heading: titleFromPath(page.relativePath),
      tags: options.tags,
      readModes: options.readModes,
    })
  }
}

function addTurnStateEntries(
  builders: Map<string, RetrievalIndexBuilder>,
  warnings: string[],
  input: BuildRecallSelectorInputFromTurnStateAndWikiInput,
): void {
  for (const path of collectAffectedPaths(input)) {
    addEntry(builders, warnings, {
      path,
      summary: "Affected path from ActionResolution, WorldTickResult, visible selection, or PostActionWorkingState.",
      lineTarget: lineTargetForPath(path),
      visibilityScope: visibilityForPath(path),
      knowledgeScope: knowledgeForPath(path),
      tags: path.includes("/runtime/") ? ["affected-path", "runtime-overlay"] : ["affected-path"],
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
}

function collectAffectedPaths(input: BuildRecallSelectorInputFromTurnStateAndWikiInput): string[] {
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
    ...input.postActionWorkingState.references,
    ...input.postActionWorkingState.runtimeDeltaRefs.map((reference) => reference.sourcePath),
  ]).filter(isAllowedReference)
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
      "Recall Selector input is built from post-action turn state plus module-specific wiki reads.",
      "Recall Selector outputs only an allowlist plan; deterministic local code performs any file read.",
      "Narration must not treat GM-only, parallelLine, or user_visible_pc_unknown handoff material as PC knowledge.",
      ...warnings,
    ],
  }
}

interface AddEntryInput {
  path: string
  summary: string
  lineTarget: RpgNarrativeLine
  visibilityScope: RetrievalIndexEntry["visibilityScope"]
  knowledgeScope: NonNullable<RetrievalIndexEntry["knowledgeScope"]>
  sectionId?: string
  sectionRole?: string
  heading?: string
  tags?: string[]
  readModes?: RpgRecallReadMode[]
}

interface RetrievalIndexBuilder {
  path: string
  title?: string
  categoryId?: string
  summaries: string[]
  lineTargets: Set<RpgNarrativeLine>
  visibilityScope: RetrievalIndexEntry["visibilityScope"]
  knowledgeScope: NonNullable<RetrievalIndexEntry["knowledgeScope"]>
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

  const sectionId = input.sectionId ?? "synthetic.whole"
  const addsSyntheticSection = input.sectionId === undefined && !builder.sections.has(sectionId)
  const readModes = input.readModes ?? ["summary", "focusedSection", "metadataOnly"]

  builder.summaries.push(input.summary)
  builder.lineTargets.add(input.lineTarget)
  input.tags?.forEach((tag) => builder?.tags.add(tag))
  addSection(builder, {
    sectionId,
    sectionRole: input.sectionRole ?? "synthetic_whole_file",
    heading: input.heading ?? titleFromPath(normalizedPath),
    aliases: [],
    lineTargets: [input.lineTarget],
    readModes,
    visibilityScope: input.visibilityScope,
    knowledgeScope: input.knowledgeScope,
    summary: input.sectionId === undefined
      ? "Synthetic stable whole-file anchor for first-version recall; source lacks section metadata."
      : input.summary,
  })

  if (addsSyntheticSection) {
    warnings.push(`Retrieval index uses synthetic sectionId synthetic.whole for ${normalizedPath}.`)
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

function sectionIdForPath(pathValue: string): string {
  const normalized = normalizeWikiPath(pathValue)
  if (normalized === "wiki/current-scene/scene_state.md") return "currentScene.visible_deltas"
  if (normalized.endsWith("/runtime/harbor-watch.md")) return "factionRuntime.current_order"
  if (normalized === "wiki/outlines/progress.md") return "outlineProgress.adjacent_beats"
  return `wiki.${normalized.replace(/^wiki\//, "").replace(/\.md$/i, "").replace(/[^a-z0-9]+/gi, ".").replace(/^\.+|\.+$/g, "")}`
}

function lineTargetForPath(pathValue: string): RpgNarrativeLine {
  const normalized = normalizeWikiPath(pathValue)
  if (normalized.includes("/runtime/") || normalized.startsWith("wiki/outlines/") || normalized.startsWith("wiki/plot-arcs/")) {
    return "tensionLine"
  }
  return "playerVisibleLine"
}

function lineTargetFromVisibility(visibilityScope: RetrievalIndexEntry["visibilityScope"] | undefined): RpgNarrativeLine | undefined {
  if (visibilityScope === "user_visible_pc_unknown") return "parallelLine"
  if (visibilityScope === "gm_only" || visibilityScope === "hidden") return "tensionLine"
  return undefined
}

function visibilityForPath(pathValue: string): RetrievalIndexEntry["visibilityScope"] {
  const normalized = normalizeWikiPath(pathValue)
  if (normalized.startsWith("wiki/outlines/") || normalized.includes("/runtime/")) return "gm_only"
  return "pc_visible"
}

function knowledgeForPath(pathValue: string): NonNullable<RetrievalIndexEntry["knowledgeScope"]> {
  const visibility = visibilityForPath(pathValue)
  if (visibility === "gm_only" || visibility === "hidden") return "gm_only"
  if (visibility === "user_visible_pc_unknown") return "user_only"
  return "pc_known"
}

function isSafeRetrievalIndexPath(value: string): boolean {
  return value.startsWith("wiki/") && !value.startsWith("wiki/runtime/") && !hasUnsafePathSegment(value)
}

function hasUnsafePathSegment(value: string): boolean {
  if (/^[a-z]:/iu.test(value) || value.startsWith("/") || value.startsWith("\\")) return true
  return value.split("/").some((segment) => segment === "" || segment === "." || segment === ".." || segment.startsWith("."))
}

function normalizeWikiPath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function titleFromPath(pathValue: string): string {
  const parts = pathValue.split("/")
  return parts[parts.length - 1]?.replace(/\.md$/i, "") ?? pathValue
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)]
}

function uniquePages(pages: RuntimePage[]): RuntimePage[] {
  const seen = new Set<string>()
  const result: RuntimePage[] = []
  for (const page of pages) {
    if (seen.has(page.relativePath)) continue
    seen.add(page.relativePath)
    result.push(page)
  }
  return result
}
