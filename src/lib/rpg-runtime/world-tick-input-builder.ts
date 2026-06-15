import type { RpgSchemaSlotId } from "@/lib/rpg-wiki-schema"
import type {
  ActionResolution,
  PreActionSnapshot,
  SubmittedAction,
  WorldTickActiveClock,
  WorldTickGapSignal,
  WorldTickInput,
  WorldTickOngoingEvent,
  WorldTickPacingState,
  WorldTickRuntimeReference,
  WorldTickVisibilityMeta,
} from "./types"
import {
  compactText,
  formatPageEntry,
  isAllowedReference,
  markGroups,
  markPages,
  normalizeProjectPath,
  rankedPages,
  readMarkdownDir,
  readRelevantOverlayGroups,
  readRequiredSchemaSlot,
  readSchemaSlotPages,
  tokenize,
  type RuntimePage,
  type RuntimePageGroup,
} from "./wiki-readers"

export interface BuildWorldTickInputFromWikiInput {
  projectPath: string
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  preActionSnapshot: PreActionSnapshot
}

export interface BuildWorldTickInputFromWikiResult {
  input: WorldTickInput
  warnings: string[]
}

const CURRENT_SCENE_SLOT_ID = "current_scene" satisfies RpgSchemaSlotId
const OUTLINE_PROGRESS_SLOT_IDS = ["outline_progress"] as const satisfies readonly RpgSchemaSlotId[]
const RULE_SLOT_IDS = ["rules_core", "rules_world", "rules_table"] as const satisfies readonly RpgSchemaSlotId[]
const MAX_REFERENCES = 60
const MAX_RELEVANT_PAGES = 8
const MAX_REF_SUMMARY_CHARS = 1200

export async function buildWorldTickInputFromWiki(
  input: BuildWorldTickInputFromWikiInput,
): Promise<BuildWorldTickInputFromWikiResult> {
  const projectPath = normalizeProjectPath(input.projectPath)
  const warnings: string[] = []
  const references = new Set<string>()

  const currentScene = await readRequiredSchemaSlot(projectPath, CURRENT_SCENE_SLOT_ID, warnings, references)
  const affectedPaths = collectAffectedWikiPaths(input.actionResolution)
  const actionTokens = tokenize(buildWorldTickQueryText(input, affectedPaths))
  const affectedTokens = tokenize(affectedPaths.join("\n"))
  const tokens = [...new Set([...actionTokens, ...affectedTokens])]

  const eventPages = rankedPages(await readMarkdownDir(projectPath, "events"), tokens, MAX_RELEVANT_PAGES)
  const questPages = rankedPages(await readMarkdownDir(projectPath, "quests"), tokens, MAX_RELEVANT_PAGES)
  const relationshipRuntimePages = rankedPages(
    runtimeOnly(await readMarkdownDir(projectPath, "relationships")),
    tokens,
    MAX_RELEVANT_PAGES,
  )
  const plotArcRuntimePages = rankedPages(
    runtimeOnly(await readMarkdownDir(projectPath, "plot-arcs")),
    tokens,
    MAX_RELEVANT_PAGES,
  )
  const outlineProgressPages = await readSchemaSlotPages(projectPath, OUTLINE_PROGRESS_SLOT_IDS, warnings)
  const rulePages = await readSchemaSlotPages(projectPath, RULE_SLOT_IDS, warnings)

  const characterGroups = await readRelevantOverlayGroups(projectPath, "characters", tokens)
  const locationGroups = await readRelevantOverlayGroups(projectPath, "locations", tokens)
  const factionGroups = await readRelevantOverlayGroups(projectPath, "factions", tokens)
  const itemGroups = await readRelevantOverlayGroups(projectPath, "items", tokens)

  markPages(
    references,
    [currentScene],
    eventPages,
    questPages,
    relationshipRuntimePages,
    plotArcRuntimePages,
    outlineProgressPages,
    rulePages,
  )
  markGroups(references, characterGroups, locationGroups, factionGroups, itemGroups)
  input.actionResolution.references.forEach((reference) => references.add(reference.path))

  const preActionRefs = [
    runtimeReferenceFromPage(currentScene, "Current scene snapshot for World Tick clocks, reactions, pacing, and visible state.", pcVisible()),
    ...eventPages.map((page) =>
      runtimeReferenceFromPage(page, "Recent event history constraint; do not rewrite happened history.", pcVisible()),
    ),
    ...relationshipRuntimePages.map((page) =>
      runtimeReferenceFromPage(page, "Runtime relationship overlay for reaction and pressure checks.", gmOnly()),
    ),
    ...plotArcRuntimePages.map((page) =>
      runtimeReferenceFromPage(page, "Runtime plot-arc overlay for pacing and gap checks.", gmOnly()),
    ),
    ...questPages.map((page) =>
      runtimeReferenceFromPage(page, "Active quest objective relevant to world movement.", pcVisible()),
    ),
    ...outlineProgressPages.map((page) =>
      runtimeReferenceFromPage(page, "Outline progress context for preliminary gap signals only.", gmOnly()),
    ),
    ...rulePages.map((page) =>
      runtimeReferenceFromPage(page, "Hard rule constraint for world tick; no re-adjudication of player action.", gmOnly(), "ruleCheck"),
    ),
    ...groupsToRuntimeReferences(characterGroups, "Affected character base/runtime overlay for reactions."),
    ...groupsToRuntimeReferences(locationGroups, "Affected location base/runtime overlay for scene consequences."),
    ...groupsToRuntimeReferences(factionGroups, "Affected faction base/runtime overlay for parallel or tension movement."),
    ...groupsToRuntimeReferences(itemGroups, "Affected item base/runtime overlay for object-state consequences."),
  ]

  return {
    input: {
      submittedAction: input.submittedAction,
      actionResolution: input.actionResolution,
      playerActionDelta: input.actionResolution.playerActionDelta,
      timeDelta: input.actionResolution.timeDelta,
      preActionRefs: dedupeRuntimeReferences(preActionRefs),
      postActionRefs: buildPostActionRefs(input.actionResolution),
      activeClocks: buildActiveClocks(input.preActionSnapshot, input.actionResolution),
      ongoingEvents: buildOngoingEvents(input.preActionSnapshot),
      pacingState: buildPacingState({
        preActionSnapshot: input.preActionSnapshot,
        currentScene,
        questPages,
        relationshipRuntimePages,
        plotArcRuntimePages,
      }),
      gapSignals: buildGapSignals(input.actionResolution, input.preActionSnapshot, outlineProgressPages, plotArcRuntimePages),
      visibilityPolicy: {
        allowParallelLineDisplay: true,
        pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
        requireVisibilityMeta: true,
        parallelLineDoesNotGrantPcKnowledge: true,
        notes: [
          "World Tick may produce parallel-line movement, but parallel-line display is not PC knowledge.",
          "World Tick consumes ActionResolution.playerActionDelta as-is and must not re-adjudicate the player action.",
        ],
      },
      runtimeRefs: input.actionResolution.runtimeDeltaRefs,
    },
    warnings: [
      ...warnings,
      ...missingReferenceWarnings([...references].filter((reference) => !isAllowedReference(reference))),
    ],
  }
}

function buildWorldTickQueryText(input: BuildWorldTickInputFromWikiInput, affectedPaths: string[]): string {
  const snapshot = input.preActionSnapshot
  return [
    input.submittedAction.text,
    input.actionResolution.eventDraft.summary,
    input.actionResolution.parsedIntent.actorRef,
    ...input.actionResolution.parsedIntent.targetRefs,
    ...input.actionResolution.eventDraft.actorRefs,
    ...input.actionResolution.eventDraft.targetRefs,
    ...input.actionResolution.eventDraft.affectedRefs,
    ...input.actionResolution.playerActionDelta.sceneChanges,
    ...input.actionResolution.playerActionDelta.knowledgeChanges,
    ...input.actionResolution.references.map((reference) => reference.path),
    ...affectedPaths,
    snapshot.currentScene.currentLocation,
    ...snapshot.currentScene.presentCharacters,
    ...snapshot.currentScene.interactableObjects,
    ...snapshot.currentScene.currentDangers,
    ...snapshot.currentScene.locationActionConditions,
    ...snapshot.activeClocks.map((clock) => `${clock.label}\n${clock.summary}`),
    ...snapshot.countdowns.map((clock) => `${clock.label}\n${clock.summary}`),
    ...snapshot.pendingReactions.map((reaction) => `${reaction.actorRef}\n${reaction.summary}`),
  ].filter(Boolean).join("\n")
}

function buildPostActionRefs(actionResolution: ActionResolution): WorldTickRuntimeReference[] {
  const actionRefs = actionResolution.references.map((reference): WorldTickRuntimeReference => ({
    path: reference.path,
    sectionId: reference.sectionId,
    summary: reference.reason,
    usePurpose: "worldTick",
    visibility: visibilityFromReference(reference.visibilityScope, reference.knowledgeScope),
  }))

  const runtimeRefs = actionResolution.runtimeDeltaRefs.map((reference): WorldTickRuntimeReference => ({
    path: reference.sourcePath,
    summary: reference.summary,
    usePurpose: "worldTick",
    visibility: visibilityFromLine(reference.narrativeLine),
  }))

  return dedupeRuntimeReferences([...actionRefs, ...runtimeRefs])
}

function buildActiveClocks(
  preActionSnapshot: PreActionSnapshot,
  actionResolution: ActionResolution,
): WorldTickActiveClock[] {
  return [...preActionSnapshot.activeClocks, ...preActionSnapshot.countdowns].map((clock, index) => ({
    clockId: clock.clockId,
    label: clock.label,
    clockKind: clock.label.toLowerCase().includes("countdown") ? "countdown" : "dangerClock",
    currentState: clock.summary,
    urgency: clock.urgency,
    narrativeLine: clock.narrativeLine,
    visibility: pcVisible(),
    affectedPaths: ["wiki/current-scene/scene_state.md", ...actionResolution.eventDraft.affectedRefs].filter(isAllowedReference),
    runtimeDeltaRefs: actionResolution.runtimeDeltaRefs.slice(0, index === 0 ? 1 : 0),
  }))
}

function buildOngoingEvents(preActionSnapshot: PreActionSnapshot): WorldTickOngoingEvent[] {
  return preActionSnapshot.pendingReactions.map((reaction, index): WorldTickOngoingEvent => ({
    eventId: `pre-action-reaction-${index + 1}`,
    summary: reaction.summary,
    status: "ongoing",
    participantRefs: [reaction.actorRef],
    clockRefs: [],
    narrativeLine: "playerVisibleLine",
    visibility: visibilityFromPendingReaction(reaction.visibilityScope),
    affectedPaths: ["wiki/current-scene/scene_state.md"],
    runtimeDeltaRefs: [],
  }))
}

function buildPacingState(input: {
  preActionSnapshot: PreActionSnapshot
  currentScene: RuntimePage
  questPages: RuntimePage[]
  relationshipRuntimePages: RuntimePage[]
  plotArcRuntimePages: RuntimePage[]
}): WorldTickPacingState {
  const pressureNotes = [
    input.preActionSnapshot.pacingState.summary,
    ...input.questPages.map(formatPageEntry),
    ...input.relationshipRuntimePages.map(formatPageEntry),
    ...input.plotArcRuntimePages.map(formatPageEntry),
  ].filter(Boolean)

  return {
    summary: compactText([input.preActionSnapshot.pacingState.summary, formatPageEntry(input.currentScene)].join("\n\n"), 1600),
    pacingDebt: input.preActionSnapshot.pacingState.pacingDebt ?? "low",
    recentLowProgressTurnCount: input.preActionSnapshot.pacingState.recentLowProgressTurnCount ?? 0,
    expectedCampaignDelta:
      input.preActionSnapshot.pacingState.expectedCampaignDelta ??
      input.preActionSnapshot.outlineProgress.currentBeat,
    stalledLines: [],
    pressureNotes: pressureNotes.map((note) => compactText(note, MAX_REF_SUMMARY_CHARS)).slice(0, 8),
    affectedPaths: ["wiki/current-scene/scene_state.md", "wiki/outlines/progress.md"],
    runtimeDeltaRefs: [],
  }
}

function buildGapSignals(
  actionResolution: ActionResolution,
  preActionSnapshot: PreActionSnapshot,
  outlineProgressPages: RuntimePage[],
  plotArcRuntimePages: RuntimePage[],
): WorldTickGapSignal[] {
  const gapPotential = actionResolution.progressPotential.gapTriggerPotential
  const gapMode: WorldTickGapSignal["gapMode"] =
    gapPotential === "major"
      ? "major_divergence_event"
      : gapPotential === "branch"
        ? "branching_event"
        : gapPotential === "minor"
          ? "compress"
          : "none"

  return [
    {
      gapSignalId: `gap-from-${actionResolution.resolutionId}`,
      gapMode,
      gapImpactCandidate: gapPotential,
      summary: compactText(actionResolution.progressPotential.summary, 500),
      causalChain: [
        actionResolution.eventDraft.summary,
        actionResolution.timeDelta.summary,
        preActionSnapshot.outlineProgress.progressSummary,
      ].filter(Boolean),
      affectedBeatRefs: [
        preActionSnapshot.outlineProgress.currentBeat,
        ...preActionSnapshot.outlineProgress.adjacentBeats,
      ].filter(Boolean),
      affectedPaths: [
        "wiki/outlines/progress.md",
        ...outlineProgressPages.map((page) => page.relativePath),
        ...plotArcRuntimePages.map((page) => page.relativePath),
      ].filter(isAllowedReference),
      visibility: gmOnly(),
      happenedStatus: gapMode === "none" ? "attempted_not_confirmed" : "possible_future",
      runtimeDeltaRefs: [],
    },
  ]
}

function collectAffectedWikiPaths(actionResolution: ActionResolution): string[] {
  return [
    ...actionResolution.eventDraft.affectedRefs,
    ...actionResolution.directResults.flatMap((result) => result.affectedRefs),
    ...actionResolution.playerActionDelta.runtimeDeltaRefs.map((reference) => reference.sourcePath),
  ].filter(isAllowedReference)
}

function runtimeOnly(pages: RuntimePage[]): RuntimePage[] {
  return pages.filter((page) => page.relativePath.includes("/runtime/"))
}

function runtimeReferenceFromPage(
  page: RuntimePage,
  reason: string,
  visibility: WorldTickVisibilityMeta,
  usePurpose: WorldTickRuntimeReference["usePurpose"] = "worldTick",
): WorldTickRuntimeReference {
  return {
    path: page.relativePath,
    summary: compactText(`${reason}\n${formatPageEntry(page)}`, MAX_REF_SUMMARY_CHARS),
    usePurpose,
    visibility,
  }
}

function groupsToRuntimeReferences(groups: RuntimePageGroup[], reason: string): WorldTickRuntimeReference[] {
  return groups.flatMap((group) =>
    group.pages.map((page) =>
      runtimeReferenceFromPage(
        page,
        `${reason} group=${group.slug}; relevanceScore=${group.score}.`,
        page.relativePath.includes("/runtime/") ? gmOnly() : pcVisible(),
      ),
    ),
  )
}

function dedupeRuntimeReferences(references: WorldTickRuntimeReference[]): WorldTickRuntimeReference[] {
  const seen = new Set<string>()
  const result: WorldTickRuntimeReference[] = []
  for (const reference of references) {
    const key = [reference.path, reference.sectionId ?? "", reference.usePurpose].join("\u0000")
    if (seen.has(key)) continue
    seen.add(key)
    result.push(reference)
  }
  return result.slice(0, MAX_REFERENCES)
}

function visibilityFromLine(line: "playerVisibleLine" | "parallelLine" | "tensionLine"): WorldTickVisibilityMeta {
  if (line === "parallelLine") return userVisiblePcUnknown()
  if (line === "tensionLine") return gmOnly()
  return pcVisible()
}

function visibilityFromReference(
  visibilityScope: ActionResolution["references"][number]["visibilityScope"],
  knowledgeScope: ActionResolution["references"][number]["knowledgeScope"],
): WorldTickVisibilityMeta {
  if (visibilityScope === "user_visible_pc_unknown") return userVisiblePcUnknown()
  if (visibilityScope === "gm_only" || visibilityScope === "hidden") return gmOnly()
  return {
    ...pcVisible(),
    visibilityScope: visibilityScope ?? "pc_visible",
    knowledgeScope: knowledgeScope ?? "pc_known",
  }
}

function visibilityFromPendingReaction(visibilityScope: PreActionSnapshot["pendingReactions"][number]["visibilityScope"]): WorldTickVisibilityMeta {
  if (visibilityScope === "user_visible_pc_unknown") return userVisiblePcUnknown()
  if (visibilityScope === "gm_only" || visibilityScope === "hidden") return gmOnly()
  return pcVisible()
}

function pcVisible(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    knowledgeSourceKind: "documented",
    knownBy: ["player"],
    excludedKnowledgeFor: [],
    displayPolicy: "player_visible",
    reason: "Available to the PC or already player-visible in the current wiki/turn state.",
  }
}

function userVisiblePcUnknown(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "user_only",
    knowledgeSourceKind: "parallel_line",
    knownBy: ["user"],
    excludedKnowledgeFor: ["player"],
    displayPolicy: "user_visible_pc_unknown",
    reason: "May be used as parallel-line material but does not grant PC knowledge.",
  }
}

function gmOnly(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    knowledgeSourceKind: "documented",
    knownBy: ["gm"],
    excludedKnowledgeFor: ["player"],
    displayPolicy: "gm_only",
    reason: "Control, pacing, rule, runtime overlay, or outline material; not direct PC knowledge.",
  }
}

function missingReferenceWarnings(paths: string[]): string[] {
  return paths.map((path) => `World Tick input builder skipped disallowed reference: ${path}`)
}
