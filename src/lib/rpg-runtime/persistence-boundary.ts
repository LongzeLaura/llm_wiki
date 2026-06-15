import {
  validateRpgRuntimeUpdateProposals,
  validateRpgRuntimeUpdateTarget,
  type RejectedRpgRuntimeUpdate,
  type RpgRuntimeUpdateValidationIssue,
  type RpgRuntimeUpdateValidationResult,
} from "../rpg-interactions/runtime"
import type { ProposedWikiUpdate } from "./state-extractor"

export type RpgRuntimePersistenceReviewOnlyAuditKind =
  | "skipped_delta"
  | "outline_revision_review"
  | "pacing_update_proposal"
  | "journal_entry"
  | "proposal_group"

export interface RpgRuntimePersistenceReviewOnlyAuditItem {
  kind: RpgRuntimePersistenceReviewOnlyAuditKind
  id: string
  summary: string
  reviewPolicy?: string
}

export interface RpgRuntimePersistenceBoundaryInput {
  proposedUpdates: ProposedWikiUpdate[]
  reviewOnlyAuditItems?: readonly RpgRuntimePersistenceReviewOnlyAuditItem[]
}

export interface RpgRuntimePersistenceBoundarySummary {
  proposedCount: number
  acceptedCount: number
  rejectedCount: number
  pendingEligibleCount: number
  pendingEligibleUpdateIds: string[]
  rejectedIssueCodes: string[]
  warningIssueCodes: string[]
  reviewOnlyAuditIds: string[]
}

export interface RpgRuntimePersistenceBoundaryResult extends RpgRuntimeUpdateValidationResult {
  pendingEligibleUpdateIds: string[]
  reviewOnlyAuditItems: RpgRuntimePersistenceReviewOnlyAuditItem[]
}

interface TargetPolicyValidationResult {
  acceptedUpdates: ProposedWikiUpdate[]
  rejectedUpdates: RejectedRpgRuntimeUpdate[]
  issues: RpgRuntimeUpdateValidationIssue[]
  warnings: string[]
}

export function validateRpgRuntimePersistenceBoundary(
  input: RpgRuntimePersistenceBoundaryInput,
): RpgRuntimePersistenceBoundaryResult {
  const targetPolicy = validateRuntimeTargets(input.proposedUpdates)
  const validation = validateRpgRuntimeUpdateProposals(targetPolicy.acceptedUpdates)
  const issues = [...targetPolicy.issues, ...validation.issues]
  const acceptedUpdates = validation.acceptedUpdates

  return {
    acceptedUpdates,
    rejectedUpdates: [...targetPolicy.rejectedUpdates, ...validation.rejectedUpdates],
    issues,
    warnings: [...targetPolicy.warnings, ...validation.warnings],
    pendingEligibleUpdateIds: acceptedUpdates.map((update) => update.id),
    reviewOnlyAuditItems: [...(input.reviewOnlyAuditItems ?? [])],
  }
}

export function summarizeRpgRuntimePersistenceBoundary(
  result: RpgRuntimePersistenceBoundaryResult,
  proposedUpdateCount?: number,
): RpgRuntimePersistenceBoundarySummary {
  return {
    proposedCount: proposedUpdateCount ?? result.acceptedUpdates.length + result.rejectedUpdates.length,
    acceptedCount: result.acceptedUpdates.length,
    rejectedCount: result.rejectedUpdates.length,
    pendingEligibleCount: result.pendingEligibleUpdateIds.length,
    pendingEligibleUpdateIds: [...result.pendingEligibleUpdateIds],
    rejectedIssueCodes: uniqueStrings(
      result.rejectedUpdates.flatMap(({ issues }) => issues.map((issue) => issue.code)),
    ),
    warningIssueCodes: uniqueStrings(
      result.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.code),
    ),
    reviewOnlyAuditIds: result.reviewOnlyAuditItems.map((item) => item.id),
  }
}

function validateRuntimeTargets(updates: readonly ProposedWikiUpdate[]): TargetPolicyValidationResult {
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

function formatValidationIssueWarning(issue: RpgRuntimeUpdateValidationIssue): string {
  return `Rejected RPG runtime update ${issue.updateId} (${issue.targetPath}): ${issue.code}: ${issue.message}`
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}
