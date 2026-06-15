import type {
  OutlineBriefCompilerInput,
  OutlineBriefReference,
  OutlineRevealPolicyDirective,
  OutlineVisibilityBoundary,
  RegenerationRequest,
  StoryOutlineConfirmedFactBoundary,
  StoryOutlineForbiddenRevealBoundary,
  StoryOutlineRegeneratorInput,
  WorldTickVisibleSelection,
} from "./types"
import type { RpgKnowledgeScope, RpgRuntimeDeltaRef, RpgVisibilityScope } from "../rpg-wiki-schema"

export interface BuildStoryOutlineRegeneratorInputFromTurnStateInput {
  outlineBriefInput: OutlineBriefCompilerInput
  outlineImpactReport: StoryOutlineRegeneratorInput["outlineImpactReport"]
  regenerationRequest: RegenerationRequest
}

export function buildStoryOutlineRegeneratorInputFromTurnState(
  input: BuildStoryOutlineRegeneratorInputFromTurnStateInput,
): StoryOutlineRegeneratorInput {
  const runtimeRefs = uniqueRuntimeRefs([
    ...input.outlineBriefInput.runtimeRefs,
    ...input.outlineBriefInput.postActionWorkingState.runtimeDeltaRefs,
  ])

  return {
    turnSemanticHandoff: input.outlineBriefInput.turnSemanticHandoff,
    postActionWorkingState: input.outlineBriefInput.postActionWorkingState,
    outlineImpactReport: input.outlineImpactReport,
    regenerationRequest: input.regenerationRequest,
    recalledMaterials: input.outlineBriefInput.recalledMaterials,
    outlineSlices: input.outlineBriefInput.outlineSlices,
    plotArcTensionFuel: input.outlineBriefInput.plotArcTensionFuel,
    visibilityBoundaries: input.outlineBriefInput.visibilityBoundaries,
    hardConstraints: input.outlineBriefInput.hardConstraints,
    confirmedFacts: buildConfirmedFacts(input.outlineBriefInput, runtimeRefs),
    forbiddenReveals: buildForbiddenReveals(input.outlineBriefInput),
    runtimeRefs,
    knownReferences: input.outlineBriefInput.knownReferences,
  }
}

function buildConfirmedFacts(
  outlineBriefInput: OutlineBriefCompilerInput,
  runtimeRefs: readonly RpgRuntimeDeltaRef[],
): StoryOutlineConfirmedFactBoundary[] {
  return runtimeRefs
    .filter(isConfirmedFactRuntimeRef)
    .map((ref) => ({
      factId: `runtime-fact.${slug(ref.deltaId)}`,
      summary: ref.summary,
      sourceRefs: sourceRefsForRuntimeRef(outlineBriefInput, ref),
      runtimeDeltaRefs: [ref],
      happenedStatus: ref.happenedStatus,
      mustPreserve: true,
    }))
}

function sourceRefsForRuntimeRef(
  outlineBriefInput: OutlineBriefCompilerInput,
  runtimeRef: RpgRuntimeDeltaRef,
): OutlineBriefReference[] {
  const refs = outlineBriefInput.knownReferences
    .filter((ref) => ref.runtimeDeltaId === runtimeRef.deltaId || ref.path === runtimeRef.sourcePath)
    .map((ref) => ({
      path: ref.path,
      sectionId: ref.sectionId,
      runtimeDeltaId: ref.runtimeDeltaId ?? runtimeRef.deltaId,
      stableId: ref.stableId,
      lineTarget: runtimeRef.narrativeLine,
      usePurpose: "outlineControl" as const,
      visibilityScope: visibilityForRuntimeLine(runtimeRef),
      knowledgeScope: knowledgeForRuntimeLine(runtimeRef),
      reason: ref.reason,
    }))

  if (refs.length > 0) return refs

  return [
    {
      path: runtimeRef.sourcePath,
      runtimeDeltaId: runtimeRef.deltaId,
      lineTarget: runtimeRef.narrativeLine,
      usePurpose: "outlineControl",
      visibilityScope: visibilityForRuntimeLine(runtimeRef),
      knowledgeScope: knowledgeForRuntimeLine(runtimeRef),
      reason: "Runtime delta ref from this turn state.",
    },
  ]
}

function buildForbiddenReveals(
  outlineBriefInput: OutlineBriefCompilerInput,
): StoryOutlineForbiddenRevealBoundary[] {
  const reveals = new Map<string, StoryOutlineForbiddenRevealBoundary>()

  for (const constraint of outlineBriefInput.hardConstraints) {
    for (const revealId of constraint.mustNotReveal) {
      addForbiddenReveal(reveals, {
        revealId,
        sourcePath: constraint.sourcePath,
        sectionId: constraint.sectionId,
        lineTarget: constraint.appliesToLines[0] ?? "tensionLine",
        visibilityScope: visibilityForForbiddenBoundary(
          outlineBriefInput.visibilityBoundaries,
          constraint.sourcePath,
          constraint.sectionId,
        ),
        knowledgeScope: knowledgeForForbiddenBoundary(
          outlineBriefInput.visibilityBoundaries,
          constraint.sourcePath,
          constraint.sectionId,
        ),
        reason: constraint.summary,
      })
    }
  }

  for (const slice of outlineBriefInput.outlineSlices) {
    for (const policy of slice.revealPolicies.filter(isForbiddenRevealPolicy)) {
      addForbiddenReveal(reveals, {
        revealId: policy.stableId,
        stableId: policy.stableId,
        sourcePath: slice.path,
        sectionId: slice.sectionId,
        lineTarget: policy.lineTarget,
        visibilityScope: forbiddenVisibility(slice.visibilityScope),
        knowledgeScope: forbiddenKnowledge(slice.knowledgeScope),
        reason: policy.reason,
      })
    }
  }

  for (const item of outlineBriefInput.visibleSelection.parallelLensCandidates) {
    addForbiddenReveal(reveals, {
      revealId: `parallel-lens.${slug(item.sourceId)}`,
      sourcePath: sourcePathFromVisibleSelection(outlineBriefInput.visibleSelection, item.sourceId),
      lineTarget: item.narrativeLine,
      visibilityScope: forbiddenVisibility(item.visibilityScope),
      knowledgeScope: forbiddenKnowledge(item.knowledgeScope),
      reason: item.summary,
    })
  }

  return [...reveals.values()]
}

function addForbiddenReveal(
  reveals: Map<string, StoryOutlineForbiddenRevealBoundary>,
  reveal: StoryOutlineForbiddenRevealBoundary,
): void {
  const key = [reveal.revealId, reveal.sourcePath, reveal.sectionId ?? ""].join("#")
  if (!reveals.has(key)) reveals.set(key, reveal)
}

function isForbiddenRevealPolicy(policy: OutlineRevealPolicyDirective): boolean {
  return policy.policy === "forbid" || policy.policy === "delay"
}

function visibilityForForbiddenBoundary(
  boundaries: readonly OutlineVisibilityBoundary[],
  sourcePath: string,
  sectionId: string | undefined,
): StoryOutlineForbiddenRevealBoundary["visibilityScope"] {
  const boundary = boundaries.find((entry) => entry.sourcePath === sourcePath && entry.sectionId === sectionId)
  return forbiddenVisibility(boundary?.visibilityScope)
}

function knowledgeForForbiddenBoundary(
  boundaries: readonly OutlineVisibilityBoundary[],
  sourcePath: string,
  sectionId: string | undefined,
): StoryOutlineForbiddenRevealBoundary["knowledgeScope"] {
  const boundary = boundaries.find((entry) => entry.sourcePath === sourcePath && entry.sectionId === sectionId)
  return forbiddenKnowledge(boundary?.knowledgeScope)
}

function sourcePathFromVisibleSelection(visibleSelection: WorldTickVisibleSelection, sourceId: string): string {
  return (
    visibleSelection.parallelLensCandidates.find((entry) => entry.sourceId === sourceId)?.affectedPaths[0]
    ?? "wiki/player/known_information.md"
  )
}

function forbiddenVisibility(
  visibilityScope: RpgVisibilityScope | undefined,
): StoryOutlineForbiddenRevealBoundary["visibilityScope"] {
  if (visibilityScope === "user_visible_pc_unknown" || visibilityScope === "gm_only" || visibilityScope === "hidden") {
    return visibilityScope
  }
  return "gm_only"
}

function forbiddenKnowledge(
  knowledgeScope: RpgKnowledgeScope | undefined,
): StoryOutlineForbiddenRevealBoundary["knowledgeScope"] {
  if (
    knowledgeScope === "npc_known"
    || knowledgeScope === "user_only"
    || knowledgeScope === "gm_only"
    || knowledgeScope === "unknown_to_pc"
  ) {
    return knowledgeScope
  }
  return "gm_only"
}

function isConfirmedFactRuntimeRef(
  ref: RpgRuntimeDeltaRef,
): ref is RpgRuntimeDeltaRef & { happenedStatus: "confirmed_happened" | "ongoing" } {
  return ref.happenedStatus === "confirmed_happened" || ref.happenedStatus === "ongoing"
}

function visibilityForRuntimeLine(runtimeRef: RpgRuntimeDeltaRef): RpgVisibilityScope {
  return runtimeRef.narrativeLine === "playerVisibleLine" ? "pc_visible" : "gm_only"
}

function knowledgeForRuntimeLine(runtimeRef: RpgRuntimeDeltaRef): RpgKnowledgeScope {
  return runtimeRef.narrativeLine === "playerVisibleLine" ? "pc_known" : "gm_only"
}

function uniqueRuntimeRefs(refs: readonly RpgRuntimeDeltaRef[]): RpgRuntimeDeltaRef[] {
  const byKey = new Map<string, RpgRuntimeDeltaRef>()
  for (const ref of refs) {
    const key = `${ref.deltaId}#${ref.sourcePath}`
    if (!byKey.has(key)) byKey.set(key, ref)
  }
  return [...byKey.values()]
}

function slug(value: string): string {
  return (
    value
      .trim()
      .replace(/\\/g, "/")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "ref"
  )
}
