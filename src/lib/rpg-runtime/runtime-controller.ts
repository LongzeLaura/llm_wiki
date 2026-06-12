import {
  runtimeUpdateInteractionSpec,
  type RpgActionResolverAdapter,
  type RpgNarrationGeneratorAdapter,
  type RpgOutlineBriefAdapter,
  type RpgRecallSelectorAdapter,
  type RpgRuntimeUpdateInteractionAdapter,
  type RpgStoryOutlineRegeneratorAdapter,
  type RpgWorldTickAdapter,
  validateRpgRuntimeUpdateProposals,
  type RpgRuntimeUpdateValidationResult,
} from "../rpg-interactions/runtime"
import {
  type RuntimeTurnJournalEntry,
  type RuntimeUpdateProposalAuditSummary,
  type RuntimeUpdateValidationJournalSummary,
  type RuntimeUpdateProposalSource,
} from "./runtime-persistence"
import { buildRuntimeUpdateProposalInputFromTurnRecord } from "./runtime-update-proposal-handoff"
import { createPendingRpgUpdates, type PendingRpgUpdate } from "./update-staging"
import type { ProposedWikiUpdate } from "./state-extractor"
import { runRpgTurn } from "./turn-orchestrator"
import type { RpgTurnRecord, RpgTurnResult } from "./turn-model"
import type {
  ActionResolution,
  OutlineAwareNarrationBrief,
  OutlineImpactReport,
  OutlineRevisionProposal,
  PostActionWorkingState,
  ProvisionalOutlinePatch,
  RecalledMaterial,
  RecallSelection,
  RegenerationSafetyReport,
  RegenerationRequest,
  OutlineRevisionReviewItem,
  PacingUpdateProposal,
  ProposalGroup,
  RuntimeUpdateProposalResult,
  SkippedRuntimeDelta,
  SubmittedAction,
  TurnNarration,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"

export interface RpgRuntimeTurnPersistence {
  appendTurnJournalEntry: (projectPath: string, entry: RuntimeTurnJournalEntry) => Promise<{ warnings?: string[] } | void>
}

export interface RunRpgRuntimeTurnFlowInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  actionResolverAdapter: RpgActionResolverAdapter
  worldTickAdapter: RpgWorldTickAdapter
  recallSelectorAdapter: RpgRecallSelectorAdapter
  outlineBriefCompilerAdapter: RpgOutlineBriefAdapter
  storyOutlineRegeneratorAdapter?: RpgStoryOutlineRegeneratorAdapter
  narrationAdapter: RpgNarrationGeneratorAdapter
  updateInteractionAdapter: RpgRuntimeUpdateInteractionAdapter
  runtimePersistence?: RpgRuntimeTurnPersistence
}

export interface RunRpgRuntimeTurnFlowResult {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  provisionalOutlinePatch?: ProvisionalOutlinePatch
  outlineRevisionProposal?: OutlineRevisionProposal
  regenerationSafetyReport?: RegenerationSafetyReport
  turnNarration: TurnNarration
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  proposedUpdates: ProposedWikiUpdate[]
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
  proposalSource: RuntimeUpdateProposalSource
  runtimeUpdateProposal: RuntimeUpdateProposalResult
  runtimeUpdateProposalAudit: RuntimeUpdateProposalAuditSummary
  outlineRevisionReviewItems: OutlineRevisionReviewItem[]
  skippedDeltas: SkippedRuntimeDelta[]
  pacingUpdateProposal: PacingUpdateProposal | null
  proposalGroups: ProposalGroup[]
  runtimeUpdateValidation: RpgRuntimeUpdateValidationResult
}

export async function runRpgRuntimeTurnFlow(
  input: RunRpgRuntimeTurnFlowInput,
): Promise<RunRpgRuntimeTurnFlowResult> {
  const turn = await runRpgTurn(input)
  const extracted = await generateRuntimeUpdateProposal(input, turn.turnRecord)
  const proposedUpdates = extracted.proposedWikiUpdates
  const runtimeUpdateValidation = validateRpgRuntimeUpdateProposals(proposedUpdates)
  const pendingUpdates = createPendingRpgUpdates(runtimeUpdateValidation.acceptedUpdates)
  const runtimeUpdateProposalAudit = summarizeRuntimeUpdateProposal(extracted)
  const warnings = [
    ...turn.warnings,
    ...extracted.warnings,
    ...formatRuntimeUpdateProposalAuditWarnings(runtimeUpdateProposalAudit),
    ...runtimeUpdateValidation.warnings,
  ]
  const journalWarnings = await persistTurnJournalEntry(input, {
    timestamp: new Date().toISOString(),
    submittedAction: input.submittedAction,
    actionResolution: turn.actionResolution,
    worldTickResult: turn.worldTickResult,
    visibleSelection: turn.visibleSelection,
    postActionWorkingState: turn.postActionWorkingState,
    recallSelection: turn.recallSelection,
    recalledMaterials: turn.recalledMaterials,
    outlineAwareNarrationBrief: turn.outlineAwareNarrationBrief,
    outlineImpactReport: turn.outlineImpactReport,
    regenerationRequest: turn.regenerationRequest,
    provisionalOutlinePatch: turn.provisionalOutlinePatch,
    outlineRevisionProposal: turn.outlineRevisionProposal,
    regenerationSafetyReport: turn.regenerationSafetyReport,
    turnNarration: turn.turnNarration,
    turnResult: turn.turnResult,
    turnRecord: turn.turnRecord,
    proposedUpdates,
    pendingUpdateIds: pendingUpdates.map((update) => update.id),
    warnings,
    proposalSource: extracted.proposalSource,
    runtimeUpdateProposalAudit,
    runtimeUpdateValidation: summarizeRuntimeUpdateValidation(runtimeUpdateValidation),
  })

  return {
    actionResolution: turn.actionResolution,
    worldTickResult: turn.worldTickResult,
    visibleSelection: turn.visibleSelection,
    postActionWorkingState: turn.postActionWorkingState,
    recallSelection: turn.recallSelection,
    recalledMaterials: turn.recalledMaterials,
    outlineAwareNarrationBrief: turn.outlineAwareNarrationBrief,
    outlineImpactReport: turn.outlineImpactReport,
    regenerationRequest: turn.regenerationRequest,
    provisionalOutlinePatch: turn.provisionalOutlinePatch,
    outlineRevisionProposal: turn.outlineRevisionProposal,
    regenerationSafetyReport: turn.regenerationSafetyReport,
    turnNarration: turn.turnNarration,
    turnResult: turn.turnResult,
    turnRecord: turn.turnRecord,
    proposedUpdates,
    pendingUpdates,
    warnings: [...warnings, ...journalWarnings],
    proposalSource: extracted.proposalSource,
    runtimeUpdateProposal: extracted,
    runtimeUpdateProposalAudit,
    outlineRevisionReviewItems: extracted.outlineRevisionReviewItems,
    skippedDeltas: extracted.skippedDeltas,
    pacingUpdateProposal: extracted.pacingUpdateProposal,
    proposalGroups: extracted.proposalGroups,
    runtimeUpdateValidation,
  }
}

async function generateRuntimeUpdateProposal(
  input: RunRpgRuntimeTurnFlowInput,
  turnRecord: RpgTurnRecord,
): Promise<RuntimeUpdateProposalResult & { proposalSource: RuntimeUpdateProposalSource }> {
  const proposalInput = buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)
  const prompt = runtimeUpdateInteractionSpec.buildPrompt(proposalInput)
  const output = await input.updateInteractionAdapter.generateUpdateProposal(prompt)
  return {
    ...runtimeUpdateInteractionSpec.parseOutput(output, proposalInput),
    proposalSource: "interaction",
  }
}

async function persistTurnJournalEntry(
  input: RunRpgRuntimeTurnFlowInput,
  entry: RuntimeTurnJournalEntry,
): Promise<string[]> {
  const appendTurnJournal = input.runtimePersistence?.appendTurnJournalEntry
  if (!appendTurnJournal) return []

  try {
    const result = await appendTurnJournal(input.projectPath, entry)
    return result?.warnings ?? []
  } catch (error) {
    return [`Could not append RPG turn journal entry: ${error instanceof Error ? error.message : String(error)}`]
  }
}

function summarizeRuntimeUpdateProposal(
  proposal: RuntimeUpdateProposalResult,
): RuntimeUpdateProposalAuditSummary {
  return {
    proposedWikiUpdateIds: proposal.proposedWikiUpdates.map((update) => update.id),
    journalEntries: [...proposal.journalEntries],
    skippedDeltas: proposal.skippedDeltas.map((delta) => ({
      skipId: delta.skipId,
      sourceDeltaId: delta.sourceDelta.deltaId,
      code: delta.code,
      reason: delta.reason,
      reviewPolicy: delta.reviewPolicy,
    })),
    ...(proposal.pacingUpdateProposal
      ? {
          pacingUpdateProposal: {
            proposalId: proposal.pacingUpdateProposal.proposalId,
            sourceDeltaIds: [...proposal.pacingUpdateProposal.sourceDeltaIds],
            targetPath: proposal.pacingUpdateProposal.targetPath,
            reviewPolicy: proposal.pacingUpdateProposal.reviewPolicy,
            pacingDebtChange: proposal.pacingUpdateProposal.pacingDebtChange,
          },
        }
      : {}),
    proposalGroups: proposal.proposalGroups.map((group) => ({
      groupId: group.groupId,
      updateIds: [...group.updateIds],
      skippedDeltaIds: [...group.skippedDeltaIds],
      sourceDeltaIds: [...group.sourceDeltaIds],
      reviewPolicy: group.reviewPolicy,
    })),
    outlineRevisionReviewItems: proposal.outlineRevisionReviewItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      sourceProposalId: item.sourceProposalId,
      outlineImpactLevel: item.outlineImpactLevel,
      reviewPolicy: item.reviewPolicy,
    })),
    warnings: [...proposal.warnings],
  }
}

function formatRuntimeUpdateProposalAuditWarnings(
  audit: RuntimeUpdateProposalAuditSummary,
): string[] {
  return [
    ...audit.skippedDeltas.map(
      (delta) =>
        `Skipped runtime delta ${delta.skipId} (${delta.sourceDeltaId}): ${delta.code}: ${delta.reason} [${delta.reviewPolicy}]`,
    ),
    ...audit.outlineRevisionReviewItems.map(
      (item) =>
        `Outline revision review item ${item.reviewItemId} stays independent from ordinary pending updates [${item.reviewPolicy}].`,
    ),
    ...audit.journalEntries.map((entry) => `Runtime update proposal journal: ${entry}`),
  ]
}

function summarizeRuntimeUpdateValidation(
  validation: RpgRuntimeUpdateValidationResult,
): RuntimeUpdateValidationJournalSummary {
  return {
    acceptedUpdateIds: validation.acceptedUpdates.map((update) => update.id),
    rejectedUpdates: validation.rejectedUpdates.map(({ update, issues }) => ({
      id: update.id,
      targetPath: update.targetPath,
      issueCodes: issues.map((issue) => issue.code),
      messages: issues.map((issue) => issue.message),
    })),
    warningIssues: validation.issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => ({
        updateId: issue.updateId,
        targetPath: issue.targetPath,
        code: issue.code,
        message: issue.message,
      })),
  }
}
