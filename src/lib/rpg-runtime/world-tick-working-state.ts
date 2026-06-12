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

export interface SelectWorldTickVisibleContentInput {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
}

export interface BuildPostActionWorkingStateInput extends SelectWorldTickVisibleContentInput {
  submittedAction: SubmittedAction
  visibleSelection?: WorldTickVisibleSelection
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
