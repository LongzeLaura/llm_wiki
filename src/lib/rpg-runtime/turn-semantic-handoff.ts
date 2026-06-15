import type {
  ActionResolution,
  PostActionWorkingState,
  SubmittedAction,
  TurnSemanticHandoff,
  TurnSemanticHandoffEntry,
  TurnSemanticReferenceAllowlistEntry,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"
import type { WorldTickSemanticHandoff, WorldTickSemanticHandoffEntry } from "./world-tick-working-state"
import { buildWorldTickSemanticHandoff } from "./world-tick-working-state"

const MAX_HANDOFF_CHARS = 6000
const MAX_LIST_ENTRIES = 8
const MAX_REFERENCE_ALLOWLIST = 16
const MAX_SUMMARY_CHARS = 280
const MAX_WARNINGS = 10

export interface BuildTurnSemanticHandoffInput {
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  worldTickSemanticHandoff: WorldTickSemanticHandoff
}

export function buildTurnSemanticHandoff(input: BuildTurnSemanticHandoffInput): TurnSemanticHandoff {
  const handoff: TurnSemanticHandoff = {
    submittedAction: {
      ...input.submittedAction,
      text: compactText(input.submittedAction.text, MAX_SUMMARY_CHARS),
    },
    actionOutcome: compactText(input.actionResolution.eventDraft.summary, MAX_SUMMARY_CHARS),
    timeAdvanceSummary: compactText(input.worldTickSemanticHandoff.timeAdvanceSummary, MAX_SUMMARY_CHARS),
    confirmed: semanticEntries(input.worldTickSemanticHandoff.confirmed),
    attemptedOrBlocked: semanticEntries([
      ...input.worldTickSemanticHandoff.confirmed.filter(() => false),
      ...collectActionAttemptEntries(input.actionResolution),
    ]),
    ongoing: semanticEntries(input.worldTickSemanticHandoff.ongoing),
    possibleFuture: semanticEntries(input.worldTickSemanticHandoff.possibleFuture),
    pcVisible: semanticEntries([
      ...input.worldTickSemanticHandoff.pcVisible,
      ...input.visibleSelection.currentSceneVisibleCandidates
        .filter((candidate) => candidate.visibilityScope === "pc_visible")
        .map((candidate) => ({
          source: candidate.source,
          sourceId: candidate.sourceId,
          summary: candidate.summary,
          happenedStatus: candidate.happenedStatus,
          affectedPaths: candidate.affectedPaths,
        })),
    ]),
    pcInferred: semanticEntries(
      input.visibleSelection.currentSceneVisibleCandidates
        .filter((candidate) => candidate.visibilityScope === "pc_inferred")
        .map((candidate) => ({
          source: candidate.source,
          sourceId: candidate.sourceId,
          summary: candidate.summary,
          happenedStatus: candidate.happenedStatus,
          affectedPaths: candidate.affectedPaths,
        })),
    ),
    userVisiblePcUnknown: semanticEntries(input.worldTickSemanticHandoff.userVisiblePcUnknown),
    gmOnlyControl: semanticEntries(input.worldTickSemanticHandoff.tensionAndGap),
    activeRisks: boundedStrings([
      input.actionResolution.eventDraft.riskSummary,
      ...input.actionResolution.feasibility.limitingFactors,
      ...input.actionResolution.costs.map((cost) => cost.description),
      ...input.actionResolution.obstacles.map((obstacle) => obstacle.description),
    ]),
    pressureSignals: boundedStrings([
      input.postActionWorkingState.campaignDelta,
      ...input.visibleSelection.tensionCandidates.map((candidate) => candidate.summary),
      ...input.worldTickResult.reactionQueue.map((reaction) => reaction.summary),
    ]),
    openQuestions: boundedStrings([
      ...input.actionResolution.parsedIntent.ambiguityNotes,
      ...input.actionResolution.eventDraft.requiredChecks,
      ...input.actionResolution.feasibility.requiredChecks,
      ...input.worldTickResult.gapState.causalChain,
    ]),
    candidatePaths: boundedPaths(input.postActionWorkingState.references),
    referenceAllowlist: buildReferenceAllowlist(input),
    warnings: boundedStrings(input.postActionWorkingState.warnings, MAX_WARNINGS),
  }

  return fitBudget(handoff)
}

export function buildTurnSemanticHandoffFromCanonical(input: Omit<
  BuildTurnSemanticHandoffInput,
  "worldTickSemanticHandoff"
>): TurnSemanticHandoff {
  return buildTurnSemanticHandoff({
    ...input,
    worldTickSemanticHandoff: buildWorldTickSemanticHandoff(input),
  })
}

function collectActionAttemptEntries(actionResolution: ActionResolution): WorldTickSemanticHandoffEntry[] {
  return [
    {
      source: "actionResolution.directResult" as const,
      sourceId: actionResolution.eventDraft.eventId,
      summary: actionResolution.eventDraft.summary,
      happenedStatus: actionResolution.eventDraft.status,
      affectedPaths: actionResolution.eventDraft.affectedRefs,
    },
    ...actionResolution.directResults.map((result) => ({
      source: "actionResolution.directResult" as const,
      sourceId: result.resultId,
      summary: result.summary,
      happenedStatus: result.happenedStatus,
      affectedPaths: result.affectedRefs,
    })),
  ].filter((entry) =>
    entry.happenedStatus === "attempted_not_confirmed" ||
    entry.happenedStatus === "blocked" ||
    entry.happenedStatus === "failed" ||
    entry.happenedStatus === "misunderstanding"
  )
}

function semanticEntries(entries: readonly WorldTickSemanticHandoffEntry[]): TurnSemanticHandoffEntry[] {
  return dedupeBy(entries, (entry) => `${entry.source}:${entry.sourceId}`)
    .slice(0, MAX_LIST_ENTRIES)
    .map((entry) => ({
      source: entry.source,
      sourceId: entry.sourceId,
      summary: compactText(entry.summary, MAX_SUMMARY_CHARS),
      happenedStatus: entry.happenedStatus,
      affectedPaths: boundedPaths(entry.affectedPaths, 6),
    }))
}

function buildReferenceAllowlist(input: BuildTurnSemanticHandoffInput): TurnSemanticReferenceAllowlistEntry[] {
  const references: TurnSemanticReferenceAllowlistEntry[] = [
    ...input.actionResolution.references.map((reference) => ({
      path: reference.path,
      reason: reference.reason,
      lineTarget: "playerVisibleLine" as const,
      visibilityScope: reference.visibilityScope,
      knowledgeScope: reference.knowledgeScope,
    })),
    ...input.worldTickResult.references.map((reference) => ({
      path: reference.path,
      reason: reference.reason,
      lineTarget: reference.visibility?.visibilityScope === "user_visible_pc_unknown"
        ? "parallelLine" as const
        : reference.visibility?.visibilityScope === "gm_only" || reference.visibility?.visibilityScope === "hidden"
          ? "tensionLine" as const
          : "playerVisibleLine" as const,
      visibilityScope: reference.visibility?.visibilityScope,
      knowledgeScope: reference.visibility?.knowledgeScope,
    })),
    ...input.postActionWorkingState.references.map((path) => ({
      path,
      reason: "Candidate path from compact post-action handoff.",
    })),
  ]

  return dedupeBy(references, (entry) => entry.path)
    .filter((entry) => entry.path.startsWith("wiki/") && !entry.path.startsWith("wiki/runtime/"))
    .slice(0, MAX_REFERENCE_ALLOWLIST)
    .map((entry) => ({
      ...entry,
      reason: compactText(entry.reason, MAX_SUMMARY_CHARS),
    }))
}

function fitBudget(handoff: TurnSemanticHandoff): TurnSemanticHandoff {
  let current = handoff
  if (jsonLength(current) <= MAX_HANDOFF_CHARS) return current

  current = {
    ...current,
    activeRisks: current.activeRisks.slice(0, 5),
    pressureSignals: current.pressureSignals.slice(0, 5),
    openQuestions: current.openQuestions.slice(0, 5),
    warnings: current.warnings.slice(0, 5),
  }
  if (jsonLength(current) <= MAX_HANDOFF_CHARS) return current

  current = {
    ...current,
    confirmed: current.confirmed.slice(0, 5),
    attemptedOrBlocked: current.attemptedOrBlocked.slice(0, 5),
    ongoing: current.ongoing.slice(0, 5),
    possibleFuture: current.possibleFuture.slice(0, 5),
    pcVisible: current.pcVisible.slice(0, 5),
    pcInferred: current.pcInferred.slice(0, 5),
    userVisiblePcUnknown: current.userVisiblePcUnknown.slice(0, 5),
    gmOnlyControl: current.gmOnlyControl.slice(0, 5),
    referenceAllowlist: current.referenceAllowlist.slice(0, 10),
  }
  if (jsonLength(current) <= MAX_HANDOFF_CHARS) return current

  return {
    ...current,
    confirmed: current.confirmed.slice(0, 3),
    attemptedOrBlocked: current.attemptedOrBlocked.slice(0, 3),
    ongoing: current.ongoing.slice(0, 3),
    possibleFuture: current.possibleFuture.slice(0, 3),
    pcVisible: current.pcVisible.slice(0, 3),
    pcInferred: current.pcInferred.slice(0, 3),
    userVisiblePcUnknown: current.userVisiblePcUnknown.slice(0, 3),
    gmOnlyControl: current.gmOnlyControl.slice(0, 3),
    candidatePaths: current.candidatePaths.slice(0, 8),
    referenceAllowlist: current.referenceAllowlist.slice(0, 8),
    activeRisks: current.activeRisks.slice(0, 3),
    pressureSignals: current.pressureSignals.slice(0, 3),
    openQuestions: current.openQuestions.slice(0, 3),
    warnings: current.warnings.slice(0, 3),
  }
}

function boundedStrings(values: readonly string[], maxEntries = MAX_LIST_ENTRIES): string[] {
  return unique(values.map((value) => compactText(value, MAX_SUMMARY_CHARS)).filter(Boolean)).slice(0, maxEntries)
}

function boundedPaths(values: readonly string[], maxEntries = MAX_REFERENCE_ALLOWLIST): string[] {
  return unique(values.map(normalizePath).filter((value) => value.startsWith("wiki/"))).slice(0, maxEntries)
}

function compactText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function dedupeBy<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const value of values) {
    const key = keyOf(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function jsonLength(value: unknown): number {
  return JSON.stringify(value).length
}
