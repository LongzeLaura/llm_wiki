import {
  runtimeUpdateInteractionSpec,
  validateRpgRuntimeUpdateProposals,
  type RejectedRpgRuntimeUpdate,
  type RpgRuntimeUpdateValidationIssue,
  type RpgRuntimeUpdateValidationResult,
  validateRpgRuntimeUpdateTarget,
} from "../rpg-interactions/runtime"
import {
  applyRpgPendingUpdates,
  type ApplyRpgPendingUpdatesResult,
} from "../rpg-runtime/write-policy"
import type { ProposedWikiUpdate } from "../rpg-runtime/state-extractor"
import type { RpgTurnRecord } from "../rpg-runtime/turn-model"
import {
  createPendingRpgUpdates,
  type PendingRpgUpdate,
} from "../rpg-runtime/update-staging"
import { buildRuntimeUpdateProposalInputFromTurnRecord } from "../rpg-runtime/runtime-update-proposal-handoff"
import type { RuntimeUpdateProposalResult } from "../rpg-runtime/types"
import type { RpgImportModeSpec, RpgImportRequest, RpgImportResult } from "./types"

export const RUNTIME_UPDATE_APPLY_OPERATIONS = [
  "stage_pending",
  "apply_pending",
] as const

export type RuntimeUpdateApplyOperation = (typeof RUNTIME_UPDATE_APPLY_OPERATIONS)[number]

export interface RuntimeUpdateApplyResult extends RpgImportResult {
  mode: "runtime_update_apply"
  operation: RuntimeUpdateApplyOperation
  proposedUpdates: ProposedWikiUpdate[]
  pendingUpdates: PendingRpgUpdate[]
  runtimeUpdateValidation: RpgRuntimeUpdateValidationResult
  applyResult?: ApplyRpgPendingUpdatesResult
}

interface ResolvedRuntimeUpdateProposals {
  proposedUpdates: ProposedWikiUpdate[]
  outlineRevisionReviewItems: RuntimeUpdateProposalResult["outlineRevisionReviewItems"]
  journalEntries: RuntimeUpdateProposalResult["journalEntries"]
  skippedDeltas: RuntimeUpdateProposalResult["skippedDeltas"]
  pacingUpdateProposal: RuntimeUpdateProposalResult["pacingUpdateProposal"]
  proposalGroups: RuntimeUpdateProposalResult["proposalGroups"]
  warnings: string[]
}

interface TargetPolicyValidationResult {
  acceptedUpdates: ProposedWikiUpdate[]
  rejectedUpdates: RejectedRpgRuntimeUpdate[]
  issues: RpgRuntimeUpdateValidationIssue[]
  warnings: string[]
}

export async function runRuntimeUpdateApplyImport(
  request: RpgImportRequest,
): Promise<RuntimeUpdateApplyResult> {
  const operation = resolveRuntimeUpdateApplyOperation(request.options?.operation)
  if (operation === "apply_pending") {
    return runApplyPending(request)
  }
  return runStagePending(request)
}

export const runtimeUpdateApplyModeSpec: RpgImportModeSpec = {
  mode: "runtime_update_apply",
  run: runRuntimeUpdateApplyImport,
}

async function runStagePending(request: RpgImportRequest): Promise<RuntimeUpdateApplyResult> {
  const resolved = resolveStagePendingProposals(request)
  const runtimeUpdateValidation = validateRuntimeUpdateApplyProposals(resolved.proposedUpdates)
  const pendingUpdates = createPendingRpgUpdates(runtimeUpdateValidation.acceptedUpdates)

  return {
    mode: "runtime_update_apply",
    operation: "stage_pending",
    writtenPaths: [],
    reviewItems: buildStagePendingReviewItems(runtimeUpdateValidation, pendingUpdates, resolved),
    warnings: [...resolved.warnings, ...buildStagePendingAuditWarnings(resolved), ...runtimeUpdateValidation.warnings],
    skipped: skippedPathsFromValidation(runtimeUpdateValidation),
    proposedUpdates: resolved.proposedUpdates,
    pendingUpdates,
    runtimeUpdateValidation,
  }
}

async function runApplyPending(request: RpgImportRequest): Promise<RuntimeUpdateApplyResult> {
  const pendingUpdates = resolvePendingUpdates(request.options?.pendingUpdates)
  const applyResult = await applyRpgPendingUpdates({
    projectPath: request.projectPath,
    updates: pendingUpdates,
  })

  return {
    mode: "runtime_update_apply",
    operation: "apply_pending",
    writtenPaths: applyResult.appliedUpdates.map((update) => update.targetPath),
    reviewItems: buildApplyPendingReviewItems(applyResult),
    warnings: [...applyResult.warnings],
    skipped: applyResult.skippedUpdates.map((update) => update.targetPath),
    proposedUpdates: pendingUpdates.map(stripPendingStatus),
    pendingUpdates,
    runtimeUpdateValidation: emptyRuntimeUpdateValidation(),
    applyResult,
  }
}

function resolveRuntimeUpdateApplyOperation(value: unknown): RuntimeUpdateApplyOperation {
  if (value === undefined) return "stage_pending"
  if (isRuntimeUpdateApplyOperation(value)) return value
  throw new Error(
    `runtime_update_apply options.operation "${String(value)}" is not supported. Supported operations: ${RUNTIME_UPDATE_APPLY_OPERATIONS.join(", ")}.`,
  )
}

function isRuntimeUpdateApplyOperation(value: unknown): value is RuntimeUpdateApplyOperation {
  return RUNTIME_UPDATE_APPLY_OPERATIONS.some((operation) => operation === value)
}

function resolveStagePendingProposals(request: RpgImportRequest): ResolvedRuntimeUpdateProposals {
  if (request.options?.proposedUpdates !== undefined) {
    return {
      proposedUpdates: resolveProposedUpdates(request.options.proposedUpdates),
      outlineRevisionReviewItems: [],
      journalEntries: [],
      skippedDeltas: [],
      pacingUpdateProposal: null,
      proposalGroups: [],
      warnings: [],
    }
  }

  const turnRecord = resolveOptionalTurnRecord(request.options?.turnRecord)
  if (request.sourceText !== undefined) {
    if (!turnRecord) {
      throw new Error("runtime_update_apply stage_pending with sourceText requires options.turnRecord.")
    }
    return runtimeUpdateProposalResultToResolvedProposals(
      runtimeUpdateInteractionSpec.parseOutput(request.sourceText, buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)),
    )
  }

  if (turnRecord) {
    return runtimeUpdateProposalResultToResolvedProposals(
      runtimeUpdateInteractionSpec.parseOutput(
        turnRecord.generatedNarrative,
        buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
      ),
    )
  }

  throw new Error(
    "runtime_update_apply stage_pending requires options.proposedUpdates, or options.turnRecord with optional sourceText runtime update output.",
  )
}

function runtimeUpdateProposalResultToResolvedProposals(
  result: ReturnType<typeof runtimeUpdateInteractionSpec.parseOutput>,
): ResolvedRuntimeUpdateProposals {
  return {
    proposedUpdates: result.proposedWikiUpdates,
    outlineRevisionReviewItems: result.outlineRevisionReviewItems,
    journalEntries: result.journalEntries,
    skippedDeltas: result.skippedDeltas,
    pacingUpdateProposal: result.pacingUpdateProposal,
    proposalGroups: result.proposalGroups,
    warnings: result.warnings,
  }
}

function validateRuntimeUpdateApplyProposals(
  proposedUpdates: ProposedWikiUpdate[],
): RpgRuntimeUpdateValidationResult {
  const targetPolicy = validateRuntimeTargets(proposedUpdates)
  const validation = validateRpgRuntimeUpdateProposals(targetPolicy.acceptedUpdates)
  const issues = [...targetPolicy.issues, ...validation.issues]

  return {
    acceptedUpdates: validation.acceptedUpdates,
    rejectedUpdates: [...targetPolicy.rejectedUpdates, ...validation.rejectedUpdates],
    issues,
    warnings: [...targetPolicy.warnings, ...validation.warnings],
  }
}

function validateRuntimeTargets(updates: ProposedWikiUpdate[]): TargetPolicyValidationResult {
  const acceptedUpdates: ProposedWikiUpdate[] = []
  const rejectedUpdates: RejectedRpgRuntimeUpdate[] = []
  const issues: RpgRuntimeUpdateValidationIssue[] = []
  const warnings: string[] = []

  for (const update of updates) {
    const targetValidation = validateRpgRuntimeUpdateTarget(update.targetPath, update.strategy)
    if (!targetValidation.ok) {
      const issue: RpgRuntimeUpdateValidationIssue = {
        severity: "reject",
        code: "runtime_update_target_policy",
        message: targetValidation.reason,
        targetPath: update.targetPath,
        updateId: update.id,
      }
      issues.push(issue)
      rejectedUpdates.push({ update, issues: [issue] })
      warnings.push(formatValidationIssueWarning(issue))
      continue
    }

    acceptedUpdates.push({
      ...update,
      targetPath: targetValidation.targetPath,
      strategy: targetValidation.strategy,
      references: [...update.references],
    })
  }

  return { acceptedUpdates, rejectedUpdates, issues, warnings }
}

function resolveProposedUpdates(value: unknown): ProposedWikiUpdate[] {
  if (!isProposedWikiUpdateArray(value)) {
    throw new Error("runtime_update_apply stage_pending options.proposedUpdates must be ProposedWikiUpdate[].")
  }
  return value.map(cloneProposedUpdate)
}

function resolvePendingUpdates(value: unknown): PendingRpgUpdate[] {
  if (!isPendingRpgUpdateArray(value)) {
    throw new Error("runtime_update_apply apply_pending requires options.pendingUpdates as PendingRpgUpdate[].")
  }
  return value.map(clonePendingUpdate)
}

function resolveOptionalTurnRecord(value: unknown): RpgTurnRecord | undefined {
  if (value === undefined) return undefined
  if (!isTurnRecord(value)) {
    throw new Error("runtime_update_apply stage_pending options.turnRecord must be an RpgTurnRecord.")
  }
  return {
    submittedAction: {
      id: value.submittedAction.id,
      text: value.submittedAction.text,
      source: value.submittedAction.source,
      ...(value.submittedAction.selectedOptionId
        ? { selectedOptionId: value.submittedAction.selectedOptionId }
        : {}),
    },
    actionResolution: value.actionResolution,
    worldTickResult: value.worldTickResult,
    visibleSelection: value.visibleSelection,
    postActionWorkingState: value.postActionWorkingState,
    recallSelection: value.recallSelection,
    recalledMaterials: [...value.recalledMaterials],
    outlineAwareNarrationBrief: value.outlineAwareNarrationBrief,
    outlineImpactReport: value.outlineImpactReport,
    ...(value.regenerationRequest ? { regenerationRequest: value.regenerationRequest } : {}),
    ...(value.provisionalOutlinePatch ? { provisionalOutlinePatch: value.provisionalOutlinePatch } : {}),
    ...(value.outlineRevisionProposal ? { outlineRevisionProposal: value.outlineRevisionProposal } : {}),
    ...(value.regenerationSafetyReport ? { regenerationSafetyReport: value.regenerationSafetyReport } : {}),
    ...(value.turnNarration ? { turnNarration: value.turnNarration } : {}),
    generatedNarrative: value.generatedNarrative,
    references: [...value.references],
  }
}

function isTurnRecord(value: unknown): value is RpgTurnRecord {
  if (!isRecord(value) || !isRecord(value.submittedAction)) return false
  const action = value.submittedAction
  return (
    typeof action.id === "string" &&
    typeof action.text === "string" &&
    (action.source === "selected_option" || action.source === "freeform") &&
    (action.selectedOptionId === undefined || typeof action.selectedOptionId === "string") &&
    isRecord(value.actionResolution) &&
    isRecord(value.worldTickResult) &&
    isRecord(value.visibleSelection) &&
    isRecord(value.postActionWorkingState) &&
    isRecord(value.recallSelection) &&
    Array.isArray(value.recalledMaterials) &&
    isRecord(value.outlineAwareNarrationBrief) &&
    isRecord(value.outlineImpactReport) &&
    (value.regenerationRequest === undefined || isRecord(value.regenerationRequest)) &&
    (value.provisionalOutlinePatch === undefined || isRecord(value.provisionalOutlinePatch)) &&
    (value.outlineRevisionProposal === undefined || isRecord(value.outlineRevisionProposal)) &&
    (value.regenerationSafetyReport === undefined || isRecord(value.regenerationSafetyReport)) &&
    (value.turnNarration === undefined || isRecord(value.turnNarration)) &&
    typeof value.generatedNarrative === "string" &&
    isStringArray(value.references)
  )
}

function isProposedWikiUpdateArray(value: unknown): value is ProposedWikiUpdate[] {
  return Array.isArray(value) && value.every(isProposedWikiUpdate)
}

function isPendingRpgUpdateArray(value: unknown): value is PendingRpgUpdate[] {
  return Array.isArray(value) && value.every(isPendingRpgUpdate)
}

function isPendingRpgUpdate(value: unknown): value is PendingRpgUpdate {
  return isProposedWikiUpdate(value) &&
    isRecord(value) &&
    (value.status === "pending" || value.status === "accepted" || value.status === "rejected")
}

function isProposedWikiUpdate(value: unknown): value is ProposedWikiUpdate {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.targetPath === "string" &&
    isRpgUpdateStrategy(value.strategy) &&
    typeof value.reason === "string" &&
    typeof value.content === "string" &&
    typeof value.sourceTurnId === "string" &&
    isStringArray(value.references)
  )
}

function isRpgUpdateStrategy(value: unknown): value is ProposedWikiUpdate["strategy"] {
  return value === "overwrite" || value === "append" || value === "merge"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function cloneProposedUpdate(update: ProposedWikiUpdate): ProposedWikiUpdate {
  return {
    ...update,
    references: [...update.references],
  }
}

function clonePendingUpdate(update: PendingRpgUpdate): PendingRpgUpdate {
  return {
    ...cloneProposedUpdate(update),
    status: update.status,
  }
}

function stripPendingStatus(update: PendingRpgUpdate): ProposedWikiUpdate {
  return {
    id: update.id,
    targetPath: update.targetPath,
    strategy: update.strategy,
    reason: update.reason,
    content: update.content,
    sourceTurnId: update.sourceTurnId,
    references: [...update.references],
  }
}

function buildStagePendingReviewItems(
  validation: RpgRuntimeUpdateValidationResult,
  pendingUpdates: PendingRpgUpdate[],
  resolved: ResolvedRuntimeUpdateProposals,
): Record<string, unknown>[] {
  const reviewItems: Record<string, unknown>[] = []

  for (const update of pendingUpdates) {
    reviewItems.push({
      type: "runtime-update-pending",
      title: `Review runtime update for ${update.targetPath}`,
      description: update.reason,
      affectedPages: [update.targetPath],
      updateId: update.id,
      status: update.status,
      strategy: update.strategy,
      sourceTurnId: update.sourceTurnId,
    })
  }

  for (const rejected of validation.rejectedUpdates) {
    reviewItems.push({
      type: "runtime-update-rejected",
      title: `Rejected runtime update for ${rejected.update.targetPath}`,
      description: rejected.issues.map((issue) => issue.message).join(" "),
      affectedPages: [rejected.update.targetPath],
      updateId: rejected.update.id,
      status: "rejected",
      issueCodes: rejected.issues.map((issue) => issue.code),
      sourceTurnId: rejected.update.sourceTurnId,
    })
  }

  for (const issue of validation.issues.filter((entry) => entry.severity === "warning")) {
    reviewItems.push({
      type: "runtime-update-warning",
      title: `Runtime update warning for ${issue.targetPath}`,
      description: issue.message,
      affectedPages: [issue.targetPath],
      updateId: issue.updateId,
      status: "warning",
      issueCode: issue.code,
    })
  }

  for (const warning of resolved.warnings) {
    reviewItems.push({
      type: "runtime-update-warning",
      title: "Runtime update parse warning",
      description: warning,
      affectedPages: [],
      status: "warning",
    })
  }

  reviewItems.push(...buildStagePendingAuditReviewItems(resolved))

  return reviewItems
}

function buildStagePendingAuditReviewItems(resolved: ResolvedRuntimeUpdateProposals): Record<string, unknown>[] {
  const reviewItems: Record<string, unknown>[] = []

  for (const skippedDelta of resolved.skippedDeltas) {
    reviewItems.push({
      type: "runtime-update-skipped-delta",
      title: `Skipped runtime delta ${skippedDelta.skipId}`,
      description: `${skippedDelta.code}: ${skippedDelta.reason}`,
      affectedPages: skippedDelta.sourceDelta.affectedPaths,
      skipId: skippedDelta.skipId,
      sourceDeltaId: skippedDelta.sourceDelta.deltaId,
      reviewPolicy: skippedDelta.reviewPolicy,
      status: "review",
    })
  }

  for (const item of resolved.outlineRevisionReviewItems) {
    reviewItems.push({
      type: "outline-revision-review",
      title: `Outline revision review ${item.reviewItemId}`,
      description: item.summary,
      affectedPages: item.targetOutlineRefs.map((ref) => ref.path),
      reviewItemId: item.reviewItemId,
      sourceProposalId: item.sourceProposalId,
      reviewPolicy: item.reviewPolicy,
      ordinaryRuntimeUpdate: false,
      proposedWikiUpdate: false,
      autoWriteMainOutline: false,
      status: "review",
    })
  }

  for (const [index, entry] of resolved.journalEntries.entries()) {
    reviewItems.push({
      type: "runtime-update-journal-entry",
      title: `Runtime update journal entry ${index + 1}`,
      description: entry,
      affectedPages: [],
      status: "review",
    })
  }

  if (resolved.pacingUpdateProposal) {
    const proposal = resolved.pacingUpdateProposal
    reviewItems.push({
      type: "runtime-update-pacing-proposal",
      title: `Runtime pacing proposal ${proposal.proposalId}`,
      description: proposal.campaignDelta,
      affectedPages: proposal.targetPath === "journal_only" ? [] : [proposal.targetPath],
      proposalId: proposal.proposalId,
      sourceDeltaIds: proposal.sourceDeltaIds,
      reviewPolicy: proposal.reviewPolicy,
      pacingDebtChange: proposal.pacingDebtChange,
      status: "review",
    })
  }

  for (const group of resolved.proposalGroups) {
    reviewItems.push({
      type: "runtime-update-proposal-group",
      title: group.title,
      description: group.reason,
      affectedPages: [],
      groupId: group.groupId,
      updateIds: group.updateIds,
      skippedDeltaIds: group.skippedDeltaIds,
      sourceDeltaIds: group.sourceDeltaIds,
      reviewPolicy: group.reviewPolicy,
      status: "review",
    })
  }

  return reviewItems
}

function buildStagePendingAuditWarnings(resolved: ResolvedRuntimeUpdateProposals): string[] {
  return [
    ...resolved.skippedDeltas.map(
      (delta) => `Runtime update skipped delta ${delta.skipId}: ${delta.code}: ${delta.reason}`,
    ),
    ...resolved.outlineRevisionReviewItems.map(
      (item) => `Runtime update outline revision review ${item.reviewItemId}: ${item.summary}`,
    ),
    ...resolved.journalEntries.map((entry) => `Runtime update proposal journal: ${entry}`),
    ...(resolved.pacingUpdateProposal
      ? [
          `Runtime update pacing proposal ${resolved.pacingUpdateProposal.proposalId}: ${resolved.pacingUpdateProposal.campaignDelta}`,
        ]
      : []),
    ...resolved.proposalGroups.map((group) => `Runtime update proposal group ${group.groupId}: ${group.reason}`),
  ]
}

function buildApplyPendingReviewItems(
  applyResult: ApplyRpgPendingUpdatesResult,
): Record<string, unknown>[] {
  return applyResult.skippedUpdates.map((update) => ({
    type: "runtime-update-skipped",
    title: `Skipped runtime update for ${update.targetPath}`,
    description: update.reason,
    affectedPages: [update.targetPath],
    updateId: update.id,
    status: "skipped",
  }))
}

function skippedPathsFromValidation(validation: RpgRuntimeUpdateValidationResult): string[] {
  return [...new Set(validation.rejectedUpdates.map(({ update }) => update.targetPath))]
}

function emptyRuntimeUpdateValidation(): RpgRuntimeUpdateValidationResult {
  return {
    acceptedUpdates: [],
    rejectedUpdates: [],
    issues: [],
    warnings: [],
  }
}

function formatValidationIssueWarning(issue: RpgRuntimeUpdateValidationIssue): string {
  return `Rejected RPG runtime update ${issue.updateId} (${issue.targetPath}): ${issue.code}: ${issue.message}`
}
