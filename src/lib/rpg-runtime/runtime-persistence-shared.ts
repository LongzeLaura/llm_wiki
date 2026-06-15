import type { PendingRpgUpdate } from "./update-staging"
import type { RpgRuntimePersistenceBoundarySummary } from "./persistence-boundary"
import type { ProposedWikiUpdate } from "./state-extractor"
import type { RpgTurnRecord, RpgTurnResult } from "./turn-model"
import type { ApplyRpgPendingUpdatesResult } from "./write-policy-shared"
import type {
  ActionResolution,
  OutlineAwareNarrationBrief,
  OutlineImpactReport,
  OutlineRevisionProposal,
  PostActionWorkingState,
  ProvisionalOutlinePatch,
  RecalledMaterial,
  RecallSelection,
  RegenerationRequest,
  RegenerationSafetyReport,
  SubmittedAction,
  TurnSemanticHandoff,
  TurnNarration,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"

export type { RpgRuntimePersistenceBoundarySummary } from "./persistence-boundary"

export type RuntimeUpdateProposalSource = "interaction"

export interface RuntimeTurnJournalEntry {
  timestamp: string
  submittedAction: SubmittedAction
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff: TurnSemanticHandoff
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
  pendingUpdateIds: string[]
  warnings: string[]
  proposalSource: RuntimeUpdateProposalSource
  runtimeUpdateProposalAudit?: RuntimeUpdateProposalAuditSummary
  runtimePersistenceBoundary?: RpgRuntimePersistenceBoundarySummary
  runtimeUpdateValidation?: RuntimeUpdateValidationJournalSummary
}

export interface RuntimeUpdateProposalAuditSummary {
  proposedWikiUpdateIds: string[]
  journalEntries: string[]
  skippedDeltas: Array<{
    skipId: string
    sourceDeltaId: string
    code: string
    reason: string
    reviewPolicy: string
  }>
  pacingUpdateProposal?: {
    proposalId: string
    sourceDeltaIds: string[]
    targetPath: string
    reviewPolicy: string
    pacingDebtChange: string
  }
  proposalGroups: Array<{
    groupId: string
    updateIds: string[]
    skippedDeltaIds: string[]
    sourceDeltaIds: string[]
    reviewPolicy: string
  }>
  outlineRevisionReviewItems: Array<{
    reviewItemId: string
    sourceProposalId: string
    outlineImpactLevel: string
    reviewPolicy: string
  }>
  warnings: string[]
}

export interface RuntimeUpdateValidationJournalSummary {
  acceptedUpdateIds: string[]
  rejectedUpdates: Array<{
    id: string
    targetPath: string
    issueCodes: string[]
    messages: string[]
  }>
  warningIssues: Array<{
    updateId: string
    targetPath: string
    code: string
    message: string
  }>
}

export interface RuntimeApplyJournalEntry {
  timestamp: string
  attemptedUpdateIds: string[]
  appliedUpdateIds: string[]
  remainingPendingUpdateIds: string[]
  applyResult: ApplyRpgPendingUpdatesResult
}

export interface RuntimePersistencePaths {
  projectRoot: string
  runtimeDir: string
  turnRecordsPath: string
  pendingUpdatesPath: string
  applyResultsPath: string
}

export interface LoadRpgPendingUpdatesResult {
  updates: PendingRpgUpdate[]
  warnings: string[]
}

export interface SaveRpgPendingUpdatesResult {
  warnings: string[]
}

export interface LoadRpgRuntimeSnapshotResult {
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
}

export const PENDING_UPDATES_VERSION = 1

export function parsePendingUpdatesPayload(payload: unknown): LoadRpgPendingUpdatesResult {
  const rawUpdates = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.updates)
      ? payload.updates
      : undefined

  if (!rawUpdates) {
    return {
      updates: [],
      warnings: ["无法加载 RPG 待处理更新：pending-updates.json 不包含 update 数组。"],
    }
  }

  const warnings: string[] = []
  const updates = rawUpdates.flatMap((value, index) => {
    const update = parsePendingUpdate(value)
    if (update) return [update]
    warnings.push(`已跳过索引 ${index} 处无效的 RPG 待处理更新。`)
    return []
  })

  return { updates, warnings }
}

function parsePendingUpdate(value: unknown): PendingRpgUpdate | undefined {
  if (!isRecord(value)) return undefined
  if (!isString(value.id)) return undefined
  if (!isString(value.targetPath)) return undefined
  if (!isRpgUpdateStrategy(value.strategy)) return undefined
  if (!isString(value.reason)) return undefined
  if (!isString(value.content)) return undefined
  if (!isString(value.sourceTurnId)) return undefined
  if (!Array.isArray(value.references) || !value.references.every(isString)) return undefined
  if (!isPendingStatus(value.status)) return undefined

  return {
    id: value.id,
    targetPath: value.targetPath,
    strategy: value.strategy,
    reason: value.reason,
    content: value.content,
    sourceTurnId: value.sourceTurnId,
    references: [...value.references],
    status: value.status,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRpgUpdateStrategy(value: unknown): value is ProposedWikiUpdate["strategy"] {
  return value === "overwrite" || value === "append" || value === "merge"
}

function isPendingStatus(value: unknown): value is PendingRpgUpdate["status"] {
  return value === "pending" || value === "accepted" || value === "rejected"
}
