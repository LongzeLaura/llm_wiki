import type {
  NarrationGeneratorInput,
  NarrationRevealBoundary,
  NarrationPacingComplianceStatus,
  RuntimeNarrationActionOption,
  TensionBrief,
  TurnNarration,
} from "../../rpg-runtime/types"
import { buildTurnSemanticHandoffFromCanonical } from "../../rpg-runtime/turn-semantic-handoff"
import {
  assertNoForbiddenSoftDraftKeys,
  formatSoftDraftLooseCoercionWarning,
  readArrayLoose,
  readStringArrayLoose,
  stripDerivableDraftKeys,
  type SoftDraftLooseCoercion,
} from "./soft-draft-protocol"

export type TurnNarrationDraft = Record<string, unknown>

const FORBIDDEN_DERIVABLE_KEYS = new Set([
  "narrationId",
  "displayPolicy",
  "narrationMeta",
  "references",
  "sourceRefs",
  "id",
  "optionOnly",
  "happenedStatus",
])

const FORBIDDEN_SAFETY_KEYS = [
  /^(?:proposedUpdates?|proposedWikiUpdates?|pendingUpdates?|wikiWrites?|wikiWriteProposal|writeProposal|targetPath|targetPaths|strategy|applyUpdates?|acceptedUpdates?)$/i,
  /^(?:outlineRevision|outlineRevisionProposal|regenerationRequest|storyOutlineRegeneration)$/i,
] as const

export function compileTurnNarrationDraftOutput(
  draftValue: unknown,
  input: NarrationGeneratorInput,
): TurnNarration {
  assertNoForbiddenSoftDraftKeys(draftValue, FORBIDDEN_SAFETY_KEYS, "TurnNarrationDraft")
  const looseCoercions: SoftDraftLooseCoercion[] = []
  const looseStringArrayOptions = {
    allowNullAsEmpty: true,
    allowStringAsSingle: true,
    coercions: looseCoercions,
  }
  const stripped = stripDerivableDraftKeys(draftValue, FORBIDDEN_DERIVABLE_KEYS, "TurnNarrationDraft")
  const draft = expectRecord(stripped.value, "TurnNarrationDraft")
  const turnSemanticHandoff = input.turnSemanticHandoff ?? buildTurnSemanticHandoffFromCanonical({
    submittedAction: input.postActionWorkingState.submittedAction,
    actionResolution: input.actionResolution,
    worldTickResult: input.worldTickResult,
    visibleSelection: input.visibleSelection,
    postActionWorkingState: input.postActionWorkingState,
  })
  const playerFacingText = readString(draft, "playerFacingText", "TurnNarrationDraft.playerFacingText")
  assertPlayerFacingTextDoesNotLeak(playerFacingText, input)

  const tensionBriefRecord = expectRecord(draft.tensionBrief, "TurnNarrationDraft.tensionBrief")
  const draftWarnings = readStringArrayLoose(draft, "warnings", "TurnNarrationDraft.warnings", looseStringArrayOptions)
  const derivableWarnings = stripped.strippedPaths.map((path) =>
    `Ignored derivable draft protocol field ${path}; local compiler generated the canonical value.`
  )
  const references = input.references.slice(0, 20)
  const tensionBrief: TensionBrief = {
    summary: readString(tensionBriefRecord, "summary", "TurnNarrationDraft.tensionBrief.summary"),
    pressureSignals: readStringArrayLoose(tensionBriefRecord, "pressureSignals", "TurnNarrationDraft.tensionBrief.pressureSignals", looseStringArrayOptions),
    relationshipSignals: readStringArrayLoose(tensionBriefRecord, "relationshipSignals", "TurnNarrationDraft.tensionBrief.relationshipSignals", looseStringArrayOptions),
    plotArcSignals: readStringArrayLoose(tensionBriefRecord, "plotArcSignals", "TurnNarrationDraft.tensionBrief.plotArcSignals", looseStringArrayOptions),
    reviewHandoff: readString(tensionBriefRecord, "reviewHandoff", "TurnNarrationDraft.tensionBrief.reviewHandoff"),
    runtimeReviewHandoff: true,
    ordinaryEventFact: false,
    playerFacing: false,
    references: references.filter((reference) => reference.lineTarget === "tensionLine").slice(0, 8),
  }
  const selfReport = expectRecord(draft.narrationSelfReport ?? {}, "TurnNarrationDraft.narrationSelfReport")
  const nextActionOptions = compileActionOptions(draft, input, looseCoercions)
  const warnings = [
    ...draftWarnings,
    ...derivableWarnings,
    ...looseCoercions.map(formatSoftDraftLooseCoercionWarning),
  ]

  return {
    playerFacingText,
    parallelLineText: readOptionalString(draft, "parallelLineText"),
    tensionBrief,
    displayPolicy: {
      showPlayerFacingText: true,
      showParallelLine: Boolean(readOptionalString(draft, "parallelLineText")),
      parallelLineGrantsPcKnowledge: false,
      showTensionBriefToPlayer: false,
      tensionBriefIsReviewHandoff: true,
    },
    narrationMeta: {
      narrationId: `turn-narration-${slug(turnSemanticHandoff.submittedAction.id)}`,
      usedProvisionalPatch: Boolean(input.provisionalNarrationHandoff),
      respectedMustNotReveal: true,
      followedPacingIntent: (readOptionalString(selfReport, "followedPacingIntent") ?? "not_applicable") as NarrationPacingComplianceStatus,
      timeCompression: (readOptionalString(selfReport, "timeCompression") ?? "none") as TurnNarration["narrationMeta"]["timeCompression"],
      sceneTransition: (readOptionalString(selfReport, "sceneTransition") ?? "none") as TurnNarration["narrationMeta"]["sceneTransition"],
      campaignDelta: (readOptionalString(selfReport, "campaignDelta") ?? "none") as TurnNarration["narrationMeta"]["campaignDelta"],
      revealBoundary: (readOptionalString(selfReport, "revealBoundary") ?? "hint_only") as NarrationRevealBoundary,
      playerKnowledgeBoundary: input.playerKnowledgeBoundary,
      ...(input.provisionalNarrationHandoff
        ? {
            provisionalPatchUsage: {
              usedProvisionalPatch: true,
              handoffId: input.provisionalNarrationHandoff.handoffId,
              sourcePatchId: input.provisionalNarrationHandoff.sourcePatchId,
              followedMustFollow: input.provisionalNarrationHandoff.mustFollow,
              respectedMustNotReveal: true,
              hardConstraintsApplied: input.provisionalNarrationHandoff.mustNotReveal,
              sameTurnOnly: true,
            },
          }
        : {}),
      styleBundleApplied: true,
      styleRemainedNonFact: true,
      warnings,
    },
    nextActionOptions,
    references,
    warnings,
  }
}

function compileActionOptions(
  draft: Record<string, unknown>,
  input: NarrationGeneratorInput,
  looseCoercions: SoftDraftLooseCoercion[],
): RuntimeNarrationActionOption[] {
  if (!("nextActionOptions" in draft)) {
    throw new Error("Invalid TurnNarrationDraft.nextActionOptions: must be an array.")
  }
  return readArrayLoose(draft, "nextActionOptions", "TurnNarrationDraft.nextActionOptions", {
    allowSingleObject: true,
    coercions: looseCoercions,
  }).map((value, index) => {
    const record = expectRecord(value, `TurnNarrationDraft.nextActionOptions[${index}]`)
    return {
      id: `next-action-${slug((input.turnSemanticHandoff ?? buildTurnSemanticHandoffFromCanonical({
        submittedAction: input.postActionWorkingState.submittedAction,
        actionResolution: input.actionResolution,
        worldTickResult: input.worldTickResult,
        visibleSelection: input.visibleSelection,
        postActionWorkingState: input.postActionWorkingState,
      })).submittedAction.id)}-${index + 1}`,
      playerFacingText: readString(record, "playerFacingText", `TurnNarrationDraft.nextActionOptions[${index}].playerFacingText`),
      intent: readString(record, "intent", `TurnNarrationDraft.nextActionOptions[${index}].intent`) as RuntimeNarrationActionOption["intent"],
      riskLevel: readString(record, "riskLevel", `TurnNarrationDraft.nextActionOptions[${index}].riskLevel`) as RuntimeNarrationActionOption["riskLevel"],
      likelyAffectedPaths: readStringArrayLoose(record, "likelyAffectedPaths", `TurnNarrationDraft.nextActionOptions[${index}].likelyAffectedPaths`, {
        allowNullAsEmpty: true,
        allowStringAsSingle: true,
        coercions: looseCoercions,
      }),
      knowledgeScope: "pc_known",
      visibilityScope: "pc_visible",
      grantsPcKnowledge: false,
      optionOnly: true,
      happenedStatus: "possible_future",
      sourceRefs: input.references
        .filter((reference) => reference.visibilityScope === "pc_visible" || reference.visibilityScope === "pc_inferred")
        .slice(0, 4),
    }
  })
}

function assertPlayerFacingTextDoesNotLeak(text: string, input: NarrationGeneratorInput): void {
  const normalized = text.toLowerCase()
  for (const constraint of input.forbiddenNarrationConstraints) {
    for (const forbidden of constraint.mustNotReveal) {
      const marker = forbidden.trim()
      if (marker.length >= 12 && normalized.includes(marker.toLowerCase())) {
        throw new Error("Invalid TurnNarrationDraft.playerFacingText: leaks forbidden narration constraint.")
      }
    }
  }
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

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== "string") throw new Error(`Invalid TurnNarrationDraft.${key}: must be a string when provided.`)
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "turn"
}
