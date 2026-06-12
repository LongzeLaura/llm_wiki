import type {
  OutlineRevisionReviewItem,
  PacingUpdateProposal,
  ProposalGroup,
  RuntimeProposedWikiUpdate,
  RuntimeUpdateAllowedTarget,
  RuntimeUpdateProposalInput,
  RuntimeUpdateProposalResult,
  RuntimeUpdateReviewPolicy,
  RuntimeUpdateReviewPolicyRule,
  RuntimeUpdateSourceDelta,
  RuntimeUpdateSourceStage,
  RuntimeUpdateValidationHint,
  RuntimeUpdateWritePolicyRule,
  SkippedRuntimeDelta,
} from "../../rpg-runtime/types"
import type {
  RpgHappenedStatus,
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgReviewItemKind,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import { validateRpgRuntimeUpdateTarget } from "./wiki-update-policy"

const JSON_FENCE_PATTERN = /```(?:json|JSON)\s*([\s\S]*?)```/

const NARRATIVE_LINES = new Set<RpgNarrativeLine>([
  "playerVisibleLine",
  "parallelLine",
  "tensionLine",
])
const VISIBILITY_SCOPES = new Set<RpgVisibilityScope>([
  "pc_visible",
  "pc_inferred",
  "user_visible_pc_unknown",
  "gm_only",
  "hidden",
])
const KNOWLEDGE_SCOPES = new Set<RpgKnowledgeScope>([
  "pc_known",
  "pc_misunderstanding",
  "npc_known",
  "user_only",
  "gm_only",
  "unknown_to_pc",
])
const HAPPENED_STATUSES = new Set<RpgHappenedStatus>([
  "attempted_not_confirmed",
  "confirmed_happened",
  "ongoing",
  "blocked",
  "failed",
  "possible_future",
  "intention_only",
  "misunderstanding",
])
const USE_PURPOSES = new Set<RpgUsePurpose>([
  "actionResolution",
  "worldTick",
  "recall",
  "outlineControl",
  "ruleCheck",
  "narration",
  "writeback",
  "reviewOnly",
  "journalOnly",
])
const SOURCE_STAGES = new Set<RuntimeUpdateSourceStage>([
  "turnRecord",
  "postActionWorkingState",
  "actionResolution",
  "worldTickResult",
  "visibleSelection",
  "recallSelection",
  "recalledMaterials",
  "outlineAwareNarrationBrief",
  "outlineImpactReport",
  "provisionalOutlinePatch",
  "outlineRevisionProposal",
  "turnNarration",
  "consistencyValidation",
])
const REVIEW_POLICIES = new Set<RuntimeUpdateReviewPolicy>([
  "pending_review",
  "manual_review",
  "review_only",
])
const REVIEW_ITEM_KINDS = new Set<RpgReviewItemKind>([
  "runtimeWikiUpdate",
  "outlineRevision",
  "manualControlChange",
])

export function parseRuntimeUpdateProposalJson(output: string): unknown {
  const trimmed = output.trim()
  if (!trimmed) {
    throw new Error("RuntimeUpdateProposalResult JSON output is empty.")
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const fenceMatch = JSON_FENCE_PATTERN.exec(trimmed)
    if (!fenceMatch) {
      throw new Error("RuntimeUpdateProposalResult must be bare JSON or a fenced JSON block.")
    }
    return JSON.parse(fenceMatch[1].trim())
  }
}

export function parseAndValidateRuntimeUpdateProposalResult(
  output: string,
  input?: RuntimeUpdateProposalInput,
): RuntimeUpdateProposalResult {
  return validateRuntimeUpdateProposalResult(parseRuntimeUpdateProposalJson(output), input)
}

export function validateRuntimeUpdateProposalResult(
  value: unknown,
  input?: RuntimeUpdateProposalInput,
): RuntimeUpdateProposalResult {
  const record = expectRecord(value, "RuntimeUpdateProposalResult")
  if ("proposedUpdates" in record) {
    throw new Error("RuntimeUpdateProposalResult must use proposedWikiUpdates, not proposedUpdates.")
  }

  const proposedWikiUpdates = expectArray(
    record.proposedWikiUpdates,
    "RuntimeUpdateProposalResult.proposedWikiUpdates",
  ).map((entry, index) => validateRuntimeProposedWikiUpdate(entry, index, input))
  const outlineRevisionReviewItems = expectArray(
    record.outlineRevisionReviewItems,
    "RuntimeUpdateProposalResult.outlineRevisionReviewItems",
  ).map(validateOutlineRevisionReviewItem)
  const journalEntries = expectStringArray(record.journalEntries, "RuntimeUpdateProposalResult.journalEntries")
  const skippedDeltas = expectArray(record.skippedDeltas, "RuntimeUpdateProposalResult.skippedDeltas")
    .map(validateSkippedRuntimeDelta)
  const pacingUpdateProposal = record.pacingUpdateProposal === null
    ? null
    : validatePacingUpdateProposal(record.pacingUpdateProposal)
  const proposalGroups = expectArray(record.proposalGroups, "RuntimeUpdateProposalResult.proposalGroups")
    .map(validateProposalGroup)
  const warnings = expectStringArray(record.warnings, "RuntimeUpdateProposalResult.warnings")

  validateStructuredProposalReferences({
    proposedWikiUpdates,
    skippedDeltas,
    pacingUpdateProposal,
    proposalGroups,
    input,
  })

  return {
    proposedWikiUpdates,
    outlineRevisionReviewItems,
    journalEntries,
    skippedDeltas,
    pacingUpdateProposal,
    proposalGroups,
    warnings,
  }
}

export function runtimeUpdateTargetRulesToAllowedTargets(
  rules: readonly { pathPattern: string; strategy: RuntimeProposedWikiUpdate["strategy"]; description: string }[],
): RuntimeUpdateAllowedTarget[] {
  return rules.map((rule) => ({
    targetKind: inferAllowedTargetKind(rule.pathPattern),
    pathPattern: rule.pathPattern,
    strategy: rule.strategy,
    description: rule.description,
  }))
}

export function runtimeUpdateTargetRulesToWritePolicy(
  rules: readonly { pathPattern: string; strategy: RuntimeProposedWikiUpdate["strategy"] }[],
): RuntimeUpdateWritePolicyRule[] {
  return rules.map((rule) => ({
    pathPattern: rule.pathPattern,
    allowedStrategy: rule.strategy,
    reviewPolicy: "pending_review",
    notes: ["Runtime Update Proposal may only propose; pending staging and apply stay deterministic later."],
  }))
}

export function defaultRuntimeUpdateReviewPolicy(): RuntimeUpdateReviewPolicyRule[] {
  return [
    {
      reviewItemKind: "runtimeWikiUpdate",
      reviewPolicy: "pending_review",
      ordinaryRuntimeUpdate: true,
      autoApply: false,
      notes: ["Ordinary runtime wiki updates may enter pending review after deterministic validation."],
    },
    {
      reviewItemKind: "outlineRevision",
      reviewPolicy: "manual_review",
      ordinaryRuntimeUpdate: false,
      autoApply: false,
      notes: ["Outline revision proposals stay independent and never auto-write wiki/outlines/main.md."],
    },
    {
      reviewItemKind: "manualControlChange",
      reviewPolicy: "review_only",
      ordinaryRuntimeUpdate: false,
      autoApply: false,
      notes: ["Manual control changes are review-only in this LLM 6 contract."],
    },
  ]
}

function validateRuntimeProposedWikiUpdate(
  value: unknown,
  index: number,
  input?: RuntimeUpdateProposalInput,
): RuntimeProposedWikiUpdate {
  const update = expectRecord(value, `proposedWikiUpdates[${index}]`)
  const id = expectNonEmptyString(update.id, `proposedWikiUpdates[${index}].id`)
  const targetPath = expectNonEmptyString(update.targetPath, `proposedWikiUpdates[${index}].targetPath`)
  const strategy = expectOneOf(
    update.strategy,
    new Set(["overwrite", "append", "merge"]),
    `proposedWikiUpdates[${index}].strategy`,
  ) as RuntimeProposedWikiUpdate["strategy"]
  const targetValidation = validateRpgRuntimeUpdateTarget(targetPath, strategy)
  if (!targetValidation.ok) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: ${targetValidation.reason}`)
  }

  const sourceDeltas = expectArray(update.sourceDeltas, `proposedWikiUpdates[${index}].sourceDeltas`)
    .map(validateRuntimeUpdateSourceDelta)
  if (sourceDeltas.length === 0) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: sourceDeltas must not be empty.`)
  }

  const happenedStatus = expectOneOf(
    update.happenedStatus,
    HAPPENED_STATUSES,
    `proposedWikiUpdates[${index}].happenedStatus`,
  ) as RpgHappenedStatus
  const visibility = expectOneOf(
    update.visibility,
    VISIBILITY_SCOPES,
    `proposedWikiUpdates[${index}].visibility`,
  ) as RpgVisibilityScope
  const knowledgeScope = expectOneOf(
    update.knowledgeScope,
    KNOWLEDGE_SCOPES,
    `proposedWikiUpdates[${index}].knowledgeScope`,
  ) as RpgKnowledgeScope

  if (targetValidation.targetPath.startsWith("wiki/events/") && happenedStatus !== "confirmed_happened") {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: events updates require confirmed_happened.`)
  }
  if (
    targetValidation.targetPath.startsWith("wiki/events/") &&
    sourceDeltas.some((delta) => delta.happenedStatus !== "confirmed_happened")
  ) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: events updates require confirmed_happened sourceDeltas.`)
  }
  if (
    targetValidation.targetPath === "wiki/player/known_information.md"
    && (visibility === "user_visible_pc_unknown" || !["pc_known", "pc_misunderstanding"].includes(knowledgeScope))
  ) {
    throw new Error(
      `Invalid proposedWikiUpdates[${index}]: player known information requires PC-known or PC-misunderstanding material.`,
    )
  }
  if (targetValidation.targetPath === "wiki/player/known_information.md") {
    const unsafeKnowledgeSource = sourceDeltas.find(
      (delta) =>
        delta.visibility === "user_visible_pc_unknown" ||
        !["pc_visible", "pc_inferred"].includes(delta.visibility) ||
        !["pc_known", "pc_misunderstanding"].includes(delta.knowledgeScope) ||
        delta.sourceField === "parallelLineText",
    )
    if (unsafeKnowledgeSource) {
      throw new Error(
        `Invalid proposedWikiUpdates[${index}]: player known information cannot be sourced from parallel-line or PC-unknown material.`,
      )
    }
  }
  if (
    isRuntimeOverlayPath(targetValidation.targetPath) &&
    !sourceDeltas.some((delta) => sourceDeltaTargetsPath(delta, targetValidation.targetPath))
  ) {
    throw new Error(
      `Invalid proposedWikiUpdates[${index}]: runtime overlay updates require at least one sourceDelta that names the target in affectedPaths.`,
    )
  }

  const content = expectNonEmptyString(update.content, `proposedWikiUpdates[${index}].content`)
  rejectForbiddenOrdinaryUpdateContent(content, index, targetValidation.targetPath)

  const sourceTurnId = expectNonEmptyString(update.sourceTurnId, `proposedWikiUpdates[${index}].sourceTurnId`)
  if (input && sourceTurnId !== input.turnRecord.submittedAction.id) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: sourceTurnId must match submittedAction.id.`)
  }

  return {
    id,
    targetPath: targetValidation.targetPath,
    strategy: targetValidation.strategy,
    reason: expectNonEmptyString(update.reason, `proposedWikiUpdates[${index}].reason`),
    content,
    sourceTurnId,
    references: expectStringArray(update.references, `proposedWikiUpdates[${index}].references`),
    sourceDeltas,
    lineTarget: expectOneOf(
      update.lineTarget,
      NARRATIVE_LINES,
      `proposedWikiUpdates[${index}].lineTarget`,
    ) as RpgNarrativeLine,
    visibility,
    knowledgeScope,
    happenedStatus,
    confidence: expectOneOf(
      update.confidence,
      new Set(["low", "medium", "high"]),
      `proposedWikiUpdates[${index}].confidence`,
    ) as RuntimeProposedWikiUpdate["confidence"],
    validationHints: expectArray(update.validationHints, `proposedWikiUpdates[${index}].validationHints`)
      .map(validateRuntimeUpdateValidationHint),
  }
}

function validateRuntimeUpdateSourceDelta(value: unknown): RuntimeUpdateSourceDelta {
  const delta = expectRecord(value, "RuntimeUpdateSourceDelta")
  return {
    deltaId: expectNonEmptyString(delta.deltaId, "RuntimeUpdateSourceDelta.deltaId"),
    sourceStage: expectOneOf(delta.sourceStage, SOURCE_STAGES, "RuntimeUpdateSourceDelta.sourceStage"),
    ...(typeof delta.sourcePath === "string" ? { sourcePath: delta.sourcePath } : {}),
    ...(typeof delta.sourceField === "string" ? { sourceField: delta.sourceField } : {}),
    summary: expectNonEmptyString(delta.summary, "RuntimeUpdateSourceDelta.summary"),
    lineTarget: expectOneOf(delta.lineTarget, NARRATIVE_LINES, "RuntimeUpdateSourceDelta.lineTarget"),
    visibility: expectOneOf(delta.visibility, VISIBILITY_SCOPES, "RuntimeUpdateSourceDelta.visibility"),
    knowledgeScope: expectOneOf(delta.knowledgeScope, KNOWLEDGE_SCOPES, "RuntimeUpdateSourceDelta.knowledgeScope"),
    happenedStatus: expectOneOf(delta.happenedStatus, HAPPENED_STATUSES, "RuntimeUpdateSourceDelta.happenedStatus"),
    usePurpose: expectOneOf(delta.usePurpose, USE_PURPOSES, "RuntimeUpdateSourceDelta.usePurpose"),
    affectedPaths: expectStringArray(delta.affectedPaths, "RuntimeUpdateSourceDelta.affectedPaths"),
    runtimeDeltaRefs: expectArray(delta.runtimeDeltaRefs, "RuntimeUpdateSourceDelta.runtimeDeltaRefs")
      .map((entry) => expectRecord(entry, "RuntimeUpdateSourceDelta.runtimeDeltaRefs[]") as never),
  }
}

function validateRuntimeUpdateValidationHint(value: unknown): RuntimeUpdateValidationHint {
  const hint = expectRecord(value, "RuntimeUpdateValidationHint")
  return {
    hintId: expectNonEmptyString(hint.hintId, "RuntimeUpdateValidationHint.hintId"),
    severity: expectOneOf(
      hint.severity,
      new Set(["info", "warning", "blocker"]),
      "RuntimeUpdateValidationHint.severity",
    ) as RuntimeUpdateValidationHint["severity"],
    code: expectNonEmptyString(hint.code, "RuntimeUpdateValidationHint.code"),
    message: expectNonEmptyString(hint.message, "RuntimeUpdateValidationHint.message"),
  }
}

function validateSkippedRuntimeDelta(value: unknown): SkippedRuntimeDelta {
  const skipped = expectRecord(value, "SkippedRuntimeDelta")
  return {
    skipId: expectNonEmptyString(skipped.skipId, "SkippedRuntimeDelta.skipId"),
    sourceDelta: validateRuntimeUpdateSourceDelta(skipped.sourceDelta),
    code: expectNonEmptyString(skipped.code, "SkippedRuntimeDelta.code"),
    reason: expectNonEmptyString(skipped.reason, "SkippedRuntimeDelta.reason"),
    reviewPolicy: expectOneOf(skipped.reviewPolicy, REVIEW_POLICIES, "SkippedRuntimeDelta.reviewPolicy"),
  }
}

function validatePacingUpdateProposal(value: unknown): PacingUpdateProposal {
  const pacing = expectRecord(value, "PacingUpdateProposal")
  return {
    proposalId: expectNonEmptyString(pacing.proposalId, "PacingUpdateProposal.proposalId"),
    sourceDeltaIds: expectStringArray(pacing.sourceDeltaIds, "PacingUpdateProposal.sourceDeltaIds"),
    ...(typeof pacing.previousPacingState === "string" ? { previousPacingState: pacing.previousPacingState } : {}),
    nextPacingState: expectNonEmptyString(pacing.nextPacingState, "PacingUpdateProposal.nextPacingState"),
    timeDeltaSummary: expectNonEmptyString(pacing.timeDeltaSummary, "PacingUpdateProposal.timeDeltaSummary"),
    campaignDelta: expectNonEmptyString(pacing.campaignDelta, "PacingUpdateProposal.campaignDelta"),
    pacingDebtChange: expectOneOf(
      pacing.pacingDebtChange,
      new Set(["decreased", "unchanged", "increased", "scene_cut_needed"]),
      "PacingUpdateProposal.pacingDebtChange",
    ) as PacingUpdateProposal["pacingDebtChange"],
    targetPath: expectOneOf(
      pacing.targetPath,
      new Set(["wiki/current-scene/scene_state.md", "wiki/outlines/progress.md", "journal_only"]),
      "PacingUpdateProposal.targetPath",
    ) as PacingUpdateProposal["targetPath"],
    reviewPolicy: expectOneOf(pacing.reviewPolicy, REVIEW_POLICIES, "PacingUpdateProposal.reviewPolicy"),
  }
}

function validateProposalGroup(value: unknown): ProposalGroup {
  const group = expectRecord(value, "ProposalGroup")
  return {
    groupId: expectNonEmptyString(group.groupId, "ProposalGroup.groupId"),
    title: expectNonEmptyString(group.title, "ProposalGroup.title"),
    lineTarget: expectOneOf(group.lineTarget, NARRATIVE_LINES, "ProposalGroup.lineTarget"),
    updateIds: expectStringArray(group.updateIds, "ProposalGroup.updateIds"),
    skippedDeltaIds: expectStringArray(group.skippedDeltaIds, "ProposalGroup.skippedDeltaIds"),
    sourceDeltaIds: expectStringArray(group.sourceDeltaIds, "ProposalGroup.sourceDeltaIds"),
    reason: expectNonEmptyString(group.reason, "ProposalGroup.reason"),
    reviewPolicy: expectOneOf(group.reviewPolicy, REVIEW_POLICIES, "ProposalGroup.reviewPolicy"),
  }
}

function validateOutlineRevisionReviewItem(value: unknown): OutlineRevisionReviewItem {
  const item = expectRecord(value, "OutlineRevisionReviewItem")
  const reviewItemKind = expectOneOf(
    item.reviewItemKind,
    REVIEW_ITEM_KINDS,
    "OutlineRevisionReviewItem.reviewItemKind",
  )
  if (reviewItemKind !== "outlineRevision") {
    throw new Error("OutlineRevisionReviewItem.reviewItemKind must be outlineRevision.")
  }
  if (item.ordinaryRuntimeUpdate !== false || item.proposedWikiUpdate !== false || item.autoWriteMainOutline !== false) {
    throw new Error("OutlineRevisionReviewItem must stay independent from ordinary runtime updates.")
  }
  return {
    reviewItemId: expectNonEmptyString(item.reviewItemId, "OutlineRevisionReviewItem.reviewItemId"),
    sourceProposalId: expectNonEmptyString(item.sourceProposalId, "OutlineRevisionReviewItem.sourceProposalId"),
    ...(typeof item.sourceRequestId === "string" ? { sourceRequestId: item.sourceRequestId } : {}),
    reviewItemKind: "outlineRevision",
    outlineImpactLevel: expectOneOf(
      item.outlineImpactLevel,
      new Set(["none", "minor", "branch", "major_rewrite_required"]),
      "OutlineRevisionReviewItem.outlineImpactLevel",
    ) as OutlineRevisionReviewItem["outlineImpactLevel"],
    summary: expectNonEmptyString(item.summary, "OutlineRevisionReviewItem.summary"),
    proposedRevisionSummary: expectNonEmptyString(
      item.proposedRevisionSummary,
      "OutlineRevisionReviewItem.proposedRevisionSummary",
    ),
    targetOutlineRefs: expectArray(item.targetOutlineRefs, "OutlineRevisionReviewItem.targetOutlineRefs")
      .map((entry) => expectRecord(entry, "OutlineRevisionReviewItem.targetOutlineRefs[]") as never),
    mustPreserveFacts: expectStringArray(item.mustPreserveFacts, "OutlineRevisionReviewItem.mustPreserveFacts"),
    runtimeDeltaRefs: expectArray(item.runtimeDeltaRefs, "OutlineRevisionReviewItem.runtimeDeltaRefs")
      .map((entry) => expectRecord(entry, "OutlineRevisionReviewItem.runtimeDeltaRefs[]") as never),
    reviewPolicy: expectOneOf(
      item.reviewPolicy,
      new Set(["manual_review", "review_only"]),
      "OutlineRevisionReviewItem.reviewPolicy",
    ) as OutlineRevisionReviewItem["reviewPolicy"],
    ordinaryRuntimeUpdate: false,
    proposedWikiUpdate: false,
    autoWriteMainOutline: false,
    warnings: expectStringArray(item.warnings, "OutlineRevisionReviewItem.warnings"),
  }
}

function rejectForbiddenOrdinaryUpdateContent(content: string, index: number, targetPath: string): void {
  const lower = content.toLowerCase()
  if (lower.includes("nextactionoptions")) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: nextActionOptions are future candidates, not facts.`)
  }
  if (targetPath.startsWith("wiki/events/") && lower.includes("attempted_not_confirmed")) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: attempted_not_confirmed cannot enter confirmed events.`)
  }
  if (lower.includes("outlinerevisionproposal") || lower.includes("wiki/outlines/main.md")) {
    throw new Error(`Invalid proposedWikiUpdates[${index}]: outline revision material is not an ordinary update.`)
  }
}

function inferAllowedTargetKind(pathPattern: string): RuntimeUpdateAllowedTarget["targetKind"] {
  if (pathPattern === "wiki/current-scene/scene_state.md") return "currentScene"
  if (pathPattern.startsWith("wiki/events/")) return "events"
  if (pathPattern.startsWith("wiki/player/")) return "player"
  if (pathPattern.startsWith("wiki/quests/")) return "quests"
  if (pathPattern === "wiki/outlines/progress.md") return "outlineProgress"
  return "runtimeOverlay"
}

function validateStructuredProposalReferences(input: {
  proposedWikiUpdates: RuntimeProposedWikiUpdate[]
  skippedDeltas: SkippedRuntimeDelta[]
  pacingUpdateProposal: PacingUpdateProposal | null
  proposalGroups: ProposalGroup[]
  input?: RuntimeUpdateProposalInput
}): void {
  const updateIds = new Set(input.proposedWikiUpdates.map((update) => update.id))
  const skippedDeltaIds = new Set(input.skippedDeltas.map((delta) => delta.skipId))
  const sourceDeltaIds = new Set<string>()

  for (const update of input.proposedWikiUpdates) {
    validateAgainstAllowedTargets(update, input.input)
    for (const sourceDelta of update.sourceDeltas) {
      sourceDeltaIds.add(sourceDelta.deltaId)
    }
  }
  for (const skippedDelta of input.skippedDeltas) {
    sourceDeltaIds.add(skippedDelta.sourceDelta.deltaId)
  }

  if (input.pacingUpdateProposal) {
    for (const sourceDeltaId of input.pacingUpdateProposal.sourceDeltaIds) {
      if (!sourceDeltaIds.has(sourceDeltaId)) {
        throw new Error(`Invalid PacingUpdateProposal: sourceDeltaIds references unknown sourceDelta "${sourceDeltaId}".`)
      }
    }
    if (
      input.pacingUpdateProposal.targetPath === "journal_only" &&
      input.pacingUpdateProposal.reviewPolicy === "pending_review"
    ) {
      throw new Error("Invalid PacingUpdateProposal: journal_only pacing proposals cannot use pending_review.")
    }
  }

  for (const group of input.proposalGroups) {
    for (const updateId of group.updateIds) {
      if (!updateIds.has(updateId)) {
        throw new Error(`Invalid ProposalGroup ${group.groupId}: updateIds references unknown update "${updateId}".`)
      }
    }
    for (const skippedDeltaId of group.skippedDeltaIds) {
      if (!skippedDeltaIds.has(skippedDeltaId)) {
        throw new Error(
          `Invalid ProposalGroup ${group.groupId}: skippedDeltaIds references unknown skipped delta "${skippedDeltaId}".`,
        )
      }
    }
    for (const sourceDeltaId of group.sourceDeltaIds) {
      if (!sourceDeltaIds.has(sourceDeltaId)) {
        throw new Error(
          `Invalid ProposalGroup ${group.groupId}: sourceDeltaIds references unknown sourceDelta "${sourceDeltaId}".`,
        )
      }
    }
  }
}

function validateAgainstAllowedTargets(
  update: RuntimeProposedWikiUpdate,
  input?: RuntimeUpdateProposalInput,
): void {
  if (!input) return
  const allowed = input.allowedTargets.some(
    (target) => target.strategy === update.strategy && matchesPathPattern(update.targetPath, target.pathPattern),
  )
  if (!allowed) {
    throw new Error(`Invalid proposedWikiUpdates[]: targetPath "${update.targetPath}" is not present in allowedTargets.`)
  }
}

function isRuntimeOverlayPath(targetPath: string): boolean {
  return /^wiki\/(?:characters|locations|factions|items|relationships|plot-arcs)\/runtime\/[^/]+\.md$/u.test(targetPath)
}

function sourceDeltaTargetsPath(sourceDelta: RuntimeUpdateSourceDelta, targetPath: string): boolean {
  return sourceDelta.affectedPaths.map(normalizeWikiPath).includes(normalizeWikiPath(targetPath))
}

function matchesPathPattern(targetPath: string, pathPattern: string): boolean {
  const normalizedTarget = normalizeWikiPath(targetPath)
  const normalizedPattern = normalizeWikiPath(pathPattern)
  if (!normalizedPattern.includes("*")) return normalizedTarget === normalizedPattern

  const [prefix, suffix] = normalizedPattern.split("*")
  if (!normalizedTarget.startsWith(prefix) || !normalizedTarget.endsWith(suffix)) return false
  const rest = normalizedTarget.slice(prefix.length, normalizedTarget.length - suffix.length)
  return rest.length > 0 && !rest.includes("/")
}

function normalizeWikiPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an array.`)
  }
  return value
}

function expectStringArray(value: unknown, label: string): string[] {
  return expectArray(value, label).map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`Invalid ${label}[${index}]: expected a string.`)
    }
    return entry.trim()
  }).filter(Boolean)
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string.`)
  }
  return value.trim()
}

function expectOneOf<T extends string>(value: unknown, allowed: Set<T>, label: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`Invalid ${label}: unsupported value ${JSON.stringify(value)}.`)
  }
  return value as T
}
