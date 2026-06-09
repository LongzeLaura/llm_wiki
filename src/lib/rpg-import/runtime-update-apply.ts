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
    reviewItems: buildStagePendingReviewItems(runtimeUpdateValidation, pendingUpdates, resolved.warnings),
    warnings: [...resolved.warnings, ...runtimeUpdateValidation.warnings],
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
      warnings: [],
    }
  }

  const turnRecord = resolveOptionalTurnRecord(request.options?.turnRecord)
  if (request.sourceText !== undefined) {
    if (!turnRecord) {
      throw new Error("runtime_update_apply stage_pending with sourceText requires options.turnRecord.")
    }
    return runtimeUpdateInteractionSpec.parseOutput(request.sourceText, { turnRecord })
  }

  if (turnRecord) {
    return runtimeUpdateInteractionSpec.parseOutput(turnRecord.generatedNarrative, { turnRecord })
  }

  throw new Error(
    "runtime_update_apply stage_pending requires options.proposedUpdates, or options.turnRecord with optional sourceText runtime update output.",
  )
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
  parseWarnings: string[],
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

  for (const warning of parseWarnings) {
    reviewItems.push({
      type: "runtime-update-warning",
      title: "Runtime update parse warning",
      description: warning,
      affectedPages: [],
      status: "warning",
    })
  }

  return reviewItems
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
