import type {
  ActionResolution,
  PostActionWorkingState,
  SubmittedAction,
  WorldTickResult,
  WorldTickSelectedParallelLens,
  WorldTickSelectedTensionSignal,
  WorldTickSelectedVisibleDelta,
  WorldTickVisibleSelection,
} from "./types"
import type { RpgHappenedStatus } from "../rpg-wiki-schema"

export interface SelectWorldTickVisibleContentInput {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
}

export interface BuildPostActionWorkingStateInput extends SelectWorldTickVisibleContentInput {
  submittedAction: SubmittedAction
  visibleSelection?: WorldTickVisibleSelection
}

export interface WorldTickSemanticHandoffEntry {
  source:
    | "actionResolution.directResult"
    | "worldTick.playerVisibleLine"
    | "worldTick.parallelLine"
    | "worldTick.tensionLine"
    | "worldTick.clockUpdate"
    | "worldTick.settledOngoingEvent"
    | "worldTick.informationBroadcast"
    | "worldTick.reactionQueue"
    | "worldTick.pacingUpdate"
    | "worldTick.gapState"
  sourceId: string
  summary: string
  happenedStatus: RpgHappenedStatus
  affectedPaths: string[]
}

export interface WorldTickSemanticHandoff {
  submittedActionId: string
  actionSummary: string
  timeAdvanceSummary: string
  confirmed: WorldTickSemanticHandoffEntry[]
  ongoing: WorldTickSemanticHandoffEntry[]
  possibleFuture: WorldTickSemanticHandoffEntry[]
  pcVisible: WorldTickSemanticHandoffEntry[]
  userVisiblePcUnknown: WorldTickSemanticHandoffEntry[]
  tensionAndGap: WorldTickSemanticHandoffEntry[]
  pacingSummary: string
  candidatePaths: string[]
  warnings: string[]
}

export interface BuildWorldTickSemanticHandoffInput extends BuildPostActionWorkingStateInput {
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
}

export function selectWorldTickVisibleContent(
  input: SelectWorldTickVisibleContentInput,
): WorldTickVisibleSelection {
  const actionVisible = input.actionResolution.directResults.flatMap((result): WorldTickSelectedVisibleDelta[] => {
    if (result.visibilityScope !== "pc_visible" && result.visibilityScope !== "pc_inferred") return []
    return [
      {
        selectionId: `visible-action-${result.resultId}`,
        source: "actionResolution.directResult",
        sourceId: result.resultId,
        summary: result.summary,
        narrativeLine: "playerVisibleLine",
        visibilityScope: result.visibilityScope,
        happenedStatus: result.happenedStatus,
        affectedPaths: [...result.affectedRefs],
        runtimeDeltaRefs: [...input.actionResolution.runtimeDeltaRefs],
        grantsPcKnowledge: true,
      },
    ]
  })

  const worldVisible = input.worldTickResult.worldDeltas.playerVisibleLine.flatMap(
    (delta): WorldTickSelectedVisibleDelta[] => {
      const scope = delta.visibility.visibilityScope
      if (scope !== "pc_visible" && scope !== "pc_inferred") return []
      return [
        {
          selectionId: `visible-world-${delta.deltaId}`,
          source: "worldTick.playerVisibleLine",
          sourceId: delta.deltaId,
          summary: delta.summary,
          narrativeLine: "playerVisibleLine",
          visibilityScope: scope,
          knowledgeScope: delta.visibility.knowledgeScope,
          happenedStatus: delta.happenedStatus,
          affectedPaths: [...delta.affectedPaths],
          runtimeDeltaRefs: [...delta.runtimeDeltaRefs],
          grantsPcKnowledge: delta.visibility.knowledgeScope === "pc_known",
        },
      ]
    },
  )

  const parallelLensCandidates = input.worldTickResult.worldDeltas.parallelLine.flatMap(
    (delta): WorldTickSelectedParallelLens[] => {
      if (delta.visibility.visibilityScope !== "user_visible_pc_unknown") return []
      return [
        {
          lensId: `parallel-${delta.deltaId}`,
          source: "worldTick.parallelLine",
          sourceId: delta.deltaId,
          summary: delta.summary,
          narrativeLine: "parallelLine",
          visibilityScope: "user_visible_pc_unknown",
          knowledgeScope: delta.visibility.knowledgeScope,
          happenedStatus: delta.happenedStatus,
          affectedPaths: [...delta.affectedPaths],
          runtimeDeltaRefs: [...delta.runtimeDeltaRefs],
          grantsPcKnowledge: false,
          pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
        },
      ]
    },
  )

  const tensionCandidates: WorldTickSelectedTensionSignal[] = [
    ...input.worldTickResult.worldDeltas.tensionLine.map((delta): WorldTickSelectedTensionSignal => ({
      signalId: `tension-${delta.deltaId}`,
      source: "worldTick.tensionLine",
      sourceId: delta.deltaId,
      summary: delta.summary,
      narrativeLine: delta.narrativeLine,
      visibilityScope: delta.visibility.visibilityScope,
      knowledgeScope: delta.visibility.knowledgeScope,
      happenedStatus: delta.happenedStatus,
      affectedPaths: [...delta.affectedPaths],
      runtimeDeltaRefs: [...delta.runtimeDeltaRefs],
    })),
    {
      signalId: `tension-${input.worldTickResult.pacingUpdate.updateId}`,
      source: "worldTick.pacingUpdate",
      sourceId: input.worldTickResult.pacingUpdate.updateId,
      summary: input.worldTickResult.pacingUpdate.campaignDelta,
      narrativeLine: input.worldTickResult.pacingUpdate.narrativeLine,
      visibilityScope: input.worldTickResult.pacingUpdate.visibility.visibilityScope,
      knowledgeScope: input.worldTickResult.pacingUpdate.visibility.knowledgeScope,
      happenedStatus: input.worldTickResult.pacingUpdate.happenedStatus,
      affectedPaths: [...input.worldTickResult.pacingUpdate.affectedPaths],
      runtimeDeltaRefs: [...input.worldTickResult.pacingUpdate.runtimeDeltaRefs],
    },
    {
      signalId: `tension-${input.worldTickResult.gapState.gapSignalId}`,
      source: "worldTick.gapState",
      sourceId: input.worldTickResult.gapState.gapSignalId,
      summary: input.worldTickResult.gapState.summary,
      narrativeLine: input.worldTickResult.gapState.narrativeLine,
      visibilityScope: input.worldTickResult.gapState.visibility.visibilityScope,
      knowledgeScope: input.worldTickResult.gapState.visibility.knowledgeScope,
      happenedStatus: input.worldTickResult.gapState.happenedStatus,
      affectedPaths: [...input.worldTickResult.gapState.affectedPaths],
      runtimeDeltaRefs: [...input.worldTickResult.gapState.runtimeDeltaRefs],
    },
  ]

  return {
    currentSceneVisibleCandidates: [...actionVisible, ...worldVisible],
    parallelLensCandidates,
    tensionCandidates,
    notes: [
      "parallelLine candidates do not grant PC knowledge and must not be written to wiki/player/known_information.md by selection alone.",
      "visible selection is local runtime handoff only; it does not generate player prose, nextActionOptions, wiki writes, or Recall Selector output.",
    ],
  }
}

export function buildPostActionWorkingState(input: BuildPostActionWorkingStateInput): PostActionWorkingState {
  const visibleSelection = input.visibleSelection ?? selectWorldTickVisibleContent(input)
  const campaignDelta = input.worldTickResult.pacingUpdate.campaignDelta.trim()
  const warnings = [
    ...input.actionResolution.warnings.map(
      (warning) => `Action Resolver ${warning.severity} ${warning.code}: ${warning.message}`,
    ),
    ...input.worldTickResult.warnings.map(
      (warning) => `World Tick ${warning.severity} ${warning.code}: ${warning.message}`,
    ),
  ]

  if (!campaignDelta) {
    warnings.push("World Tick warning missing_campaign_delta: pacingUpdate.campaignDelta was empty.")
  }

  return {
    submittedAction: input.submittedAction,
    actionResolution: input.actionResolution,
    worldTickResult: input.worldTickResult,
    visibleSelection,
    timeState: {
      actionTimeDelta: input.actionResolution.timeDelta,
      worldTickTimeAdvance: input.worldTickResult.timeAdvance,
    },
    campaignDelta,
    pacingState: input.worldTickResult.pacingUpdate,
    gapState: input.worldTickResult.gapState,
    runtimeDeltaRefs: mergeRuntimeDeltaRefs([
      ...input.actionResolution.runtimeDeltaRefs,
      ...input.worldTickResult.runtimeDeltaRefs,
    ]),
    references: mergeReferencePaths([
      ...input.actionResolution.references.map((reference) => reference.path),
      ...input.worldTickResult.references.map((reference) => reference.path),
    ]),
    warnings,
  }
}

export function buildWorldTickSemanticHandoff(input: BuildWorldTickSemanticHandoffInput): WorldTickSemanticHandoff {
  const entries = collectSemanticEntries(input)
  const pcVisibleIds = new Set(input.visibleSelection.currentSceneVisibleCandidates.map((candidate) => candidate.sourceId))
  const pcUnknownIds = new Set(input.visibleSelection.parallelLensCandidates.map((candidate) => candidate.sourceId))
  const tensionIds = new Set(input.visibleSelection.tensionCandidates.map((candidate) => candidate.sourceId))

  return {
    submittedActionId: input.submittedAction.id,
    actionSummary: input.actionResolution.eventDraft.summary,
    timeAdvanceSummary: input.worldTickResult.timeAdvance.appliedSummary,
    confirmed: entries.filter((entry) => entry.happenedStatus === "confirmed_happened"),
    ongoing: entries.filter((entry) => entry.happenedStatus === "ongoing"),
    possibleFuture: entries.filter((entry) =>
      entry.happenedStatus === "possible_future" || entry.happenedStatus === "intention_only"
    ),
    pcVisible: entries.filter((entry) => pcVisibleIds.has(entry.sourceId)),
    userVisiblePcUnknown: entries.filter((entry) => pcUnknownIds.has(entry.sourceId)),
    tensionAndGap: entries.filter((entry) => tensionIds.has(entry.sourceId)),
    pacingSummary: input.postActionWorkingState.campaignDelta,
    candidatePaths: input.postActionWorkingState.references,
    warnings: input.postActionWorkingState.warnings,
  }
}

function collectSemanticEntries(input: SelectWorldTickVisibleContentInput): WorldTickSemanticHandoffEntry[] {
  return [
    ...input.actionResolution.directResults.map((result): WorldTickSemanticHandoffEntry => ({
      source: "actionResolution.directResult",
      sourceId: result.resultId,
      summary: result.summary,
      happenedStatus: result.happenedStatus,
      affectedPaths: [...result.affectedRefs],
    })),
    ...input.worldTickResult.worldDeltas.playerVisibleLine.map((delta): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.playerVisibleLine",
      sourceId: delta.deltaId,
      summary: delta.summary,
      happenedStatus: delta.happenedStatus,
      affectedPaths: [...delta.affectedPaths],
    })),
    ...input.worldTickResult.worldDeltas.parallelLine.map((delta): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.parallelLine",
      sourceId: delta.deltaId,
      summary: delta.summary,
      happenedStatus: delta.happenedStatus,
      affectedPaths: [...delta.affectedPaths],
    })),
    ...input.worldTickResult.worldDeltas.tensionLine.map((delta): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.tensionLine",
      sourceId: delta.deltaId,
      summary: delta.summary,
      happenedStatus: delta.happenedStatus,
      affectedPaths: [...delta.affectedPaths],
    })),
    ...input.worldTickResult.clockUpdates.map((clock): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.clockUpdate",
      sourceId: clock.clockId,
      summary: clock.reason,
      happenedStatus: clock.happenedStatus,
      affectedPaths: [...clock.affectedPaths],
    })),
    ...input.worldTickResult.settledOngoingEvents.map((event): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.settledOngoingEvent",
      sourceId: event.eventId,
      summary: event.summary,
      happenedStatus: event.happenedStatus,
      affectedPaths: [...event.affectedPaths],
    })),
    ...input.worldTickResult.informationBroadcast.map((broadcast): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.informationBroadcast",
      sourceId: broadcast.broadcastId,
      summary: broadcast.informationSummary,
      happenedStatus: broadcast.happenedStatus,
      affectedPaths: [...broadcast.affectedPaths],
    })),
    ...input.worldTickResult.reactionQueue.map((reaction): WorldTickSemanticHandoffEntry => ({
      source: "worldTick.reactionQueue",
      sourceId: reaction.reactionId,
      summary: reaction.summary,
      happenedStatus: reaction.happenedStatus,
      affectedPaths: [...reaction.affectedPaths],
    })),
    {
      source: "worldTick.pacingUpdate",
      sourceId: input.worldTickResult.pacingUpdate.updateId,
      summary: input.worldTickResult.pacingUpdate.campaignDelta,
      happenedStatus: input.worldTickResult.pacingUpdate.happenedStatus,
      affectedPaths: [...input.worldTickResult.pacingUpdate.affectedPaths],
    },
    {
      source: "worldTick.gapState",
      sourceId: input.worldTickResult.gapState.gapSignalId,
      summary: input.worldTickResult.gapState.summary,
      happenedStatus: input.worldTickResult.gapState.happenedStatus,
      affectedPaths: [...input.worldTickResult.gapState.affectedPaths],
    },
  ]
}

function mergeRuntimeDeltaRefs(refs: ActionResolution["runtimeDeltaRefs"]): ActionResolution["runtimeDeltaRefs"] {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = [ref.deltaId, ref.sourceStage, ref.sourcePath].join("\u0000")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeReferencePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const path of paths) {
    const normalized = path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "")
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result.sort()
}
