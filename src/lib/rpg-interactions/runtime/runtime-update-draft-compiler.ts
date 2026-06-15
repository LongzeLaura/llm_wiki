import type {
  OutlineRevisionReviewItem,
  PacingUpdateProposal,
  ProposalGroup,
  RuntimeProposedWikiUpdate,
  RuntimeUpdateProposalInput,
  RuntimeUpdateProposalResult,
  RuntimeUpdateSourceDelta,
  RuntimeUpdateSourceStage,
  RuntimeUpdateValidationHint,
  SkippedRuntimeDelta,
} from "../../rpg-runtime/types"
import type {
  RpgBeliefState,
  RpgHappenedStatus,
  RpgKnowledgeActorRef,
  RpgKnowledgeScope,
  RpgNarrativeLine,
  RpgRevealState,
  RpgUsePurpose,
  RpgVisibilityScope,
} from "../../rpg-wiki-schema"
import { validateRuntimeUpdateProposalResult } from "./runtime-update-proposal-validation"
import {
  parseSoftSemanticJsonOutput,
  type SoftSemanticJsonParseReport,
} from "./soft-semantic-json"

const STRATEGIES = new Set(["overwrite", "append", "merge"])
const CONFIDENCE = new Set(["low", "medium", "high"])
const HAPPENED_STATUSES = new Set([
  "attempted_not_confirmed",
  "confirmed_happened",
  "ongoing",
  "blocked",
  "failed",
  "possible_future",
  "intention_only",
  "misunderstanding",
])
const REVIEW_POLICIES = new Set(["pending_review", "manual_review", "review_only"])
const PACING_DEBT_CHANGES = new Set(["decreased", "unchanged", "increased", "scene_cut_needed"])
const PACING_TARGETS = new Set(["wiki/current-scene/scene_state.md", "wiki/outlines/progress.md", "journal_only"])

export interface RuntimeUpdateDraftSourceRef {
  path?: string
  sectionId?: string
  runtimeDeltaId?: string
  reason: string
}

export interface RuntimeUpdateProposalDraft {
  proposedWikiUpdates: Array<{
    targetPath: string
    strategy: RuntimeProposedWikiUpdate["strategy"]
    reason: string
    content: string
    runtimeDeltaIds: string[]
    sourceRefs: RuntimeUpdateDraftSourceRef[]
    happenedStatus: RpgHappenedStatus
    confidence: "low" | "medium" | "high"
    riskNotes: string[]
  }>
  outlineRevisionReviewItems: Array<{
    summary: string
    proposedRevisionSummary: string
    warnings: string[]
  }>
  journalEntries: string[]
  skippedDeltas: Array<{
    runtimeDeltaId?: string
    sourceRef?: RuntimeUpdateDraftSourceRef
    code: string
    reason: string
    reviewPolicy: "pending_review" | "manual_review" | "review_only"
  }>
  pacingUpdateProposal?: {
    sourceRuntimeDeltaIds: string[]
    nextPacingState: string
    timeDeltaSummary: string
    campaignDelta: string
    pacingDebtChange: "decreased" | "unchanged" | "increased" | "scene_cut_needed"
    targetPath: "wiki/current-scene/scene_state.md" | "wiki/outlines/progress.md" | "journal_only"
    reviewPolicy: "pending_review" | "manual_review" | "review_only"
  } | null
  warnings: string[]
}

interface SourceCandidate {
  delta: RuntimeUpdateSourceDelta
  keys: Set<string>
}

export interface ParseRuntimeUpdateProposalDraftJsonOptions {
  onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void
}

export function parseRuntimeUpdateProposalDraftJson(
  output: string,
  options: ParseRuntimeUpdateProposalDraftJsonOptions = {},
): unknown {
  try {
    const result = parseSoftSemanticJsonOutput(output, { label: "RuntimeUpdateProposalDraft" })
    options.onJsonParseReport?.(result.report)
    return result.parsed
  } catch (error) {
    const report = error instanceof Error && "report" in error
      ? (error as { report?: SoftSemanticJsonParseReport }).report
      : undefined
    if (report) options.onJsonParseReport?.(report)
    throw error
  }
}

export function parseAndValidateRuntimeUpdateProposalDraft(
  output: string,
  options: ParseRuntimeUpdateProposalDraftJsonOptions = {},
): RuntimeUpdateProposalDraft {
  return validateRuntimeUpdateProposalDraft(parseRuntimeUpdateProposalDraftJson(output, options))
}

export function validateRuntimeUpdateProposalDraft(value: unknown): RuntimeUpdateProposalDraft {
  assertNoForbiddenDraftKeys(value)
  const record = expectRecord(value, "RuntimeUpdateProposalDraft")
  return {
    proposedWikiUpdates: optionalArray(record, "proposedWikiUpdates", "RuntimeUpdateProposalDraft.proposedWikiUpdates")
      .map(validateDraftUpdate),
    outlineRevisionReviewItems: optionalArray(
      record,
      "outlineRevisionReviewItems",
      "RuntimeUpdateProposalDraft.outlineRevisionReviewItems",
    ).map(validateDraftOutlineReviewItem),
    journalEntries: optionalStringArray(record, "journalEntries", "RuntimeUpdateProposalDraft.journalEntries") ?? [],
    skippedDeltas: optionalArray(record, "skippedDeltas", "RuntimeUpdateProposalDraft.skippedDeltas")
      .map(validateDraftSkippedDelta),
    pacingUpdateProposal: record.pacingUpdateProposal === undefined || record.pacingUpdateProposal === null
      ? null
      : validateDraftPacingProposal(record.pacingUpdateProposal),
    warnings: optionalStringArray(record, "warnings", "RuntimeUpdateProposalDraft.warnings") ?? [],
  }
}

export function compileRuntimeUpdateProposalDraftOutput(
  value: unknown,
  input: RuntimeUpdateProposalInput,
): RuntimeUpdateProposalResult {
  const draft = validateRuntimeUpdateProposalDraft(value)
  const sourceCandidates = buildSourceCandidates(input)
  const proposedWikiUpdates = draft.proposedWikiUpdates.map((update, index) =>
    compileDraftUpdate(update, index, input, sourceCandidates),
  )
  const skippedDeltas = draft.skippedDeltas.map((skip, index) =>
    compileSkippedDelta(skip, index, input, sourceCandidates),
  )
  const outlineRevisionReviewItems = compileOutlineRevisionReviewItems(draft, input)
  const pacingUpdateProposal = compilePacingUpdateProposal(draft, input, sourceCandidates, proposedWikiUpdates, skippedDeltas)
  const proposalGroups = compileProposalGroups(input, proposedWikiUpdates, skippedDeltas)
  const output: RuntimeUpdateProposalResult = {
    proposedWikiUpdates,
    outlineRevisionReviewItems,
    journalEntries: draft.journalEntries,
    skippedDeltas,
    pacingUpdateProposal,
    proposalGroups,
    warnings: draft.warnings,
  }
  return validateRuntimeUpdateProposalResult(output, input)
}

export function summarizeRuntimeUpdateProposalDraft(draft: RuntimeUpdateProposalDraft): unknown {
  return {
    proposedWikiUpdateCount: draft.proposedWikiUpdates.length,
    skippedDeltaCount: draft.skippedDeltas.length,
    outlineRevisionReviewItemCount: draft.outlineRevisionReviewItems.length,
    journalEntryCount: draft.journalEntries.length,
    hasPacingUpdateProposal: Boolean(draft.pacingUpdateProposal),
    warningCount: draft.warnings.length,
  }
}

function compileDraftUpdate(
  draftUpdate: RuntimeUpdateProposalDraft["proposedWikiUpdates"][number],
  index: number,
  input: RuntimeUpdateProposalInput,
  sourceCandidates: SourceCandidate[],
): RuntimeProposedWikiUpdate {
  const targetPath = normalizeWikiPath(draftUpdate.targetPath)
  if (targetPath.includes("*")) throw new Error(`Invalid RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].targetPath: wildcard paths are forbidden.`)
  if (targetPath === "wiki/outlines/main.md") {
    throw new Error(`Invalid RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].targetPath: ordinary updates cannot target wiki/outlines/main.md.`)
  }
  if (targetPath.startsWith("wiki/events/") && draftUpdate.happenedStatus !== "confirmed_happened") {
    throw new Error(`Invalid RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}]: events updates require confirmed_happened.`)
  }
  const sourceDeltas = resolveDraftUpdateSourceDeltas(draftUpdate, targetPath, index, input, sourceCandidates)
  if (targetPath.startsWith("wiki/events/") && sourceDeltas.some((delta) => delta.happenedStatus !== "confirmed_happened")) {
    throw new Error(`Invalid RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}]: events source deltas must be confirmed_happened.`)
  }
  const primary = sourceDeltas[0]
  const targetMeta = deriveTargetMetadata(targetPath, draftUpdate.happenedStatus)
  return {
    id: `runtime-update-${input.turnRecord.submittedAction.id}-${index + 1}`,
    targetPath,
    strategy: draftUpdate.strategy,
    reason: draftUpdate.reason,
    content: draftUpdate.content,
    sourceTurnId: input.turnRecord.submittedAction.id,
    references: uniqueStrings([
      ...draftUpdate.sourceRefs.flatMap((ref) => [ref.path, ref.runtimeDeltaId].filter((value): value is string => !!value)),
      ...sourceDeltas.flatMap((delta) => [delta.sourcePath, ...delta.runtimeDeltaRefs.map((ref) => ref.sourcePath)].filter((value): value is string => !!value)),
    ]),
    sourceDeltas,
    lineTarget: targetMeta.lineTarget ?? primary.lineTarget,
    visibility: targetMeta.visibility ?? primary.visibility,
    knowledgeScope: targetMeta.knowledgeScope ?? primary.knowledgeScope,
    happenedStatus: draftUpdate.happenedStatus,
    confidence: draftUpdate.confidence,
    validationHints: compileValidationHints(draftUpdate.riskNotes, index),
  }
}

function resolveDraftUpdateSourceDeltas(
  draftUpdate: RuntimeUpdateProposalDraft["proposedWikiUpdates"][number],
  targetPath: string,
  index: number,
  input: RuntimeUpdateProposalInput,
  sourceCandidates: SourceCandidate[],
): RuntimeUpdateSourceDelta[] {
  const requestedKeys = new Set<string>([
    ...draftUpdate.runtimeDeltaIds.map((id) => `runtime:${id}`),
    ...draftUpdate.sourceRefs.flatMap((ref) => sourceRefKeys(ref)),
  ])
  let candidates = sourceCandidates.filter((candidate) =>
    [...requestedKeys].some((key) => candidate.keys.has(key)),
  )
  if (requestedKeys.size === 0) {
    candidates = sourceCandidates.filter((candidate) => candidate.delta.affectedPaths.map(normalizeWikiPath).includes(targetPath))
  }
  if (candidates.length === 0 && requestedKeys.size === 0 && targetPath === "wiki/current-scene/scene_state.md") {
    candidates = sourceCandidates.slice(0, 1)
  }
  if (
    candidates.length === 0 &&
    (targetPath === "wiki/current-scene/scene_state.md" || targetPath === "wiki/player/known_information.md")
  ) {
    candidates = sourceCandidates.filter((candidate) =>
      candidate.delta.visibility === "pc_visible" || candidate.delta.visibility === "pc_inferred"
    ).slice(0, 1)
  }
  if (candidates.length === 0) {
    throw new Error(
      `Invalid RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}]: proposals require known runtimeDeltaIds or sourceRefs from the input.`,
    )
  }
  return candidates.map((candidate, sourceIndex) =>
    normalizeSourceDeltaForTarget(candidate.delta, targetPath, input, `update-${index + 1}-source-${sourceIndex + 1}`),
  )
}

function compileSkippedDelta(
  skip: RuntimeUpdateProposalDraft["skippedDeltas"][number],
  index: number,
  input: RuntimeUpdateProposalInput,
  sourceCandidates: SourceCandidate[],
): SkippedRuntimeDelta {
  const keys = new Set<string>([
    ...(skip.runtimeDeltaId ? [`runtime:${skip.runtimeDeltaId}`] : []),
    ...(skip.sourceRef ? sourceRefKeys(skip.sourceRef) : []),
  ])
  const candidate = sourceCandidates.find((entry) => [...keys].some((key) => entry.keys.has(key)))
  const sourceDelta = candidate?.delta ?? makeSourceDelta({
    input,
    id: `skipped-draft-${index + 1}`,
    stage: "consistencyValidation",
    sourcePath: skip.sourceRef?.path,
    sourceField: skip.sourceRef ? "sourceRef" : "runtimeDeltaId",
    summary: skip.reason,
    lineTarget: "parallelLine",
    visibility: "user_visible_pc_unknown",
    knowledgeScope: "user_only",
    happenedStatus: "confirmed_happened",
    usePurpose: "reviewOnly",
    affectedPaths: [skip.sourceRef?.path ?? "wiki/current-scene/scene_state.md"],
    runtimeDeltaRefs: [],
    targetPath: skip.sourceRef?.path ?? "wiki/current-scene/scene_state.md",
  })
  return {
    skipId: `runtime-skip-${input.turnRecord.submittedAction.id}-${index + 1}`,
    sourceDelta: normalizeSourceDeltaForTarget(sourceDelta, sourceDelta.affectedPaths[0] ?? "wiki/current-scene/scene_state.md", input, `skip-${index + 1}`),
    code: skip.code,
    reason: skip.reason,
    reviewPolicy: skip.reviewPolicy,
  }
}

function compileOutlineRevisionReviewItems(
  draft: RuntimeUpdateProposalDraft,
  input: RuntimeUpdateProposalInput,
): OutlineRevisionReviewItem[] {
  if (input.outlineRevisionProposal) {
    const draftItem = draft.outlineRevisionReviewItems[0]
    return [{
    reviewItemId: `outline-revision-review-${input.turnRecord.submittedAction.id}`,
    sourceProposalId: input.outlineRevisionProposal.proposalId,
    sourceRequestId: input.outlineRevisionProposal.sourceRequestId,
    reviewItemKind: "outlineRevision",
    outlineImpactLevel: input.outlineRevisionProposal.outlineImpactLevel,
    summary: draftItem?.summary ?? input.outlineRevisionProposal.proposedRevision.summary,
    proposedRevisionSummary: draftItem?.proposedRevisionSummary ?? input.outlineRevisionProposal.proposedRevision.summary,
    targetOutlineRefs: input.outlineRevisionProposal.targetOutlineRefs,
    mustPreserveFacts: input.outlineRevisionProposal.mustPreserveFacts,
    runtimeDeltaRefs: input.outlineRevisionProposal.runtimeDeltaRefs,
    reviewPolicy: "manual_review",
    ordinaryRuntimeUpdate: false,
    proposedWikiUpdate: false,
    autoWriteMainOutline: false,
    warnings: draftItem?.warnings ?? [],
    }]
  }
  return draft.outlineRevisionReviewItems.map((item, index) => ({
    reviewItemId: `outline-revision-review-${input.turnRecord.submittedAction.id}-${index + 1}`,
    sourceProposalId: `outline-revision-draft-${input.turnRecord.submittedAction.id}-${index + 1}`,
    reviewItemKind: "outlineRevision",
    outlineImpactLevel: input.outlineImpactReport.impactLevel,
    summary: item.summary,
    proposedRevisionSummary: item.proposedRevisionSummary,
    targetOutlineRefs: [],
    mustPreserveFacts: [],
    runtimeDeltaRefs: [],
    reviewPolicy: "manual_review",
    ordinaryRuntimeUpdate: false,
    proposedWikiUpdate: false,
    autoWriteMainOutline: false,
    warnings: item.warnings,
  }))
}

function compilePacingUpdateProposal(
  draft: RuntimeUpdateProposalDraft,
  input: RuntimeUpdateProposalInput,
  sourceCandidates: SourceCandidate[],
  updates: RuntimeProposedWikiUpdate[],
  skippedDeltas: SkippedRuntimeDelta[],
): PacingUpdateProposal | null {
  if (!draft.pacingUpdateProposal) return null
  const sourceDeltaIds = draft.pacingUpdateProposal.sourceRuntimeDeltaIds
    .map((runtimeDeltaId) => sourceCandidates.find((candidate) => candidate.keys.has(`runtime:${runtimeDeltaId}`))?.delta.deltaId)
    .filter((value): value is string => !!value)
  const knownSourceDeltaIds = new Set([
    ...updates.flatMap((update) => update.sourceDeltas.map((delta) => delta.deltaId)),
    ...skippedDeltas.map((skip) => skip.sourceDelta.deltaId),
  ])
  return {
    proposalId: `pacing-update-${input.turnRecord.submittedAction.id}`,
    sourceDeltaIds: sourceDeltaIds.filter((id) => knownSourceDeltaIds.has(id)),
    previousPacingState: input.postActionWorkingState.pacingState.previousDebt,
    nextPacingState: draft.pacingUpdateProposal.nextPacingState,
    timeDeltaSummary: draft.pacingUpdateProposal.timeDeltaSummary,
    campaignDelta: draft.pacingUpdateProposal.campaignDelta,
    pacingDebtChange: draft.pacingUpdateProposal.pacingDebtChange,
    targetPath: draft.pacingUpdateProposal.targetPath,
    reviewPolicy: draft.pacingUpdateProposal.reviewPolicy,
  }
}

function compileProposalGroups(
  input: RuntimeUpdateProposalInput,
  updates: RuntimeProposedWikiUpdate[],
  skippedDeltas: SkippedRuntimeDelta[],
): ProposalGroup[] {
  if (updates.length === 0 && skippedDeltas.length === 0) return []
  return [{
    groupId: `runtime-update-group-${input.turnRecord.submittedAction.id}-1`,
    title: `Runtime update proposals for ${input.turnRecord.submittedAction.id}`,
    lineTarget: updates[0]?.lineTarget ?? skippedDeltas[0]?.sourceDelta.lineTarget ?? "playerVisibleLine",
    updateIds: updates.map((update) => update.id),
    skippedDeltaIds: skippedDeltas.map((skip) => skip.skipId),
    sourceDeltaIds: [
      ...updates.flatMap((update) => update.sourceDeltas.map((delta) => delta.deltaId)),
      ...skippedDeltas.map((skip) => skip.sourceDelta.deltaId),
    ],
    reason: "Compiled from RuntimeUpdateProposalDraft.",
    reviewPolicy: "pending_review",
  }]
}

function buildSourceCandidates(input: RuntimeUpdateProposalInput): SourceCandidate[] {
  const candidates: SourceCandidate[] = []
  const add = (delta: RuntimeUpdateSourceDelta, extraKeys: string[] = []) => {
    candidates.push({ delta, keys: new Set([`delta:${delta.deltaId}`, ...delta.runtimeDeltaRefs.map((ref) => `runtime:${ref.deltaId}`), ...delta.affectedPaths.map((path) => `path:${normalizeWikiPath(path)}`), ...extraKeys]) })
  }
  input.turnRecord.references.forEach((path, index) => {
    const targetMeta = deriveTargetMetadata(normalizeWikiPath(path), "ongoing")
    add(makeSourceDelta({
      input,
      id: `turn-record-ref-${index + 1}`,
      stage: "turnRecord",
      sourcePath: path,
      sourceField: "references",
      summary: input.turnRecord.generatedNarrative || `Turn reference ${path}.`,
      lineTarget: targetMeta.lineTarget ?? "playerVisibleLine",
      visibility: targetMeta.visibility ?? "pc_visible",
      knowledgeScope: targetMeta.knowledgeScope ?? "pc_known",
      happenedStatus: "ongoing",
      affectedPaths: [path],
      runtimeDeltaRefs: input.postActionWorkingState.runtimeDeltaRefs,
      targetPath: path,
    }), [`path:${normalizeWikiPath(path)}`])
  })
  input.visibleSelection.currentSceneVisibleCandidates.forEach((candidate, index) => add(makeSourceDelta({
    input,
    id: candidate.selectionId,
    stage: "visibleSelection",
    sourceField: "currentSceneVisibleCandidates",
    summary: candidate.summary,
    lineTarget: "playerVisibleLine",
    visibility: candidate.visibilityScope,
    knowledgeScope: candidate.knowledgeScope ?? "pc_known",
    happenedStatus: candidate.happenedStatus,
    affectedPaths: candidate.affectedPaths,
    runtimeDeltaRefs: candidate.runtimeDeltaRefs,
    targetPath: candidate.affectedPaths[0],
  }), [`visible:${candidate.selectionId}`, `index:${index}`]))
  input.visibleSelection.parallelLensCandidates.forEach((candidate, index) => add(makeSourceDelta({
    input,
    id: candidate.lensId,
    stage: "visibleSelection",
    sourceField: "parallelLensCandidates",
    summary: candidate.summary,
    lineTarget: "parallelLine",
    visibility: candidate.visibilityScope,
    knowledgeScope: candidate.knowledgeScope,
    happenedStatus: candidate.happenedStatus,
    affectedPaths: candidate.affectedPaths,
    runtimeDeltaRefs: candidate.runtimeDeltaRefs,
    targetPath: candidate.affectedPaths[0],
  }), [`visible:${candidate.lensId}`, `index:${index}`]))
  input.visibleSelection.tensionCandidates.forEach((candidate, index) => add(makeSourceDelta({
    input,
    id: candidate.signalId,
    stage: "visibleSelection",
    sourceField: "tensionCandidates",
    summary: candidate.summary,
    lineTarget: candidate.narrativeLine,
    visibility: candidate.visibilityScope,
    knowledgeScope: candidate.knowledgeScope,
    happenedStatus: candidate.happenedStatus,
    affectedPaths: candidate.affectedPaths,
    runtimeDeltaRefs: candidate.runtimeDeltaRefs,
    targetPath: candidate.affectedPaths[0],
  }), [`visible:${candidate.signalId}`, `index:${index}`]))
  input.actionResolution.directResults.forEach((result, index) => add(makeSourceDelta({
    input,
    id: result.resultId,
    stage: "actionResolution",
    sourceField: "directResults",
    summary: result.summary,
    lineTarget: "playerVisibleLine",
    visibility: result.visibilityScope,
    knowledgeScope: result.visibilityScope === "pc_visible" || result.visibilityScope === "pc_inferred" ? "pc_known" : "gm_only",
    happenedStatus: result.happenedStatus,
    affectedPaths: result.affectedRefs.filter((ref) => ref.startsWith("wiki/")),
    runtimeDeltaRefs: input.actionResolution.runtimeDeltaRefs,
    targetPath: result.affectedRefs.find((ref) => ref.startsWith("wiki/")),
  }), [`action-result:${result.resultId}`, `index:${index}`]))
  for (const [line, worldDeltas] of Object.entries(input.worldTickResult.worldDeltas) as Array<[RpgNarrativeLine, typeof input.worldTickResult.worldDeltas.playerVisibleLine]>) {
    worldDeltas.forEach((delta, index) => add(makeSourceDelta({
      input,
      id: delta.deltaId,
      stage: "worldTickResult",
      sourceField: `worldDeltas.${line}`,
      summary: delta.summary,
      lineTarget: delta.narrativeLine,
      visibility: delta.visibility.visibilityScope,
      knowledgeScope: delta.visibility.knowledgeScope,
      happenedStatus: delta.happenedStatus,
      affectedPaths: delta.affectedPaths,
      runtimeDeltaRefs: delta.runtimeDeltaRefs,
      targetPath: delta.affectedPaths[0],
    }), [`world:${delta.deltaId}`, `index:${index}`]))
  }
  input.recalledMaterials.forEach((material, index) => add(makeSourceDelta({
    input,
    id: `recalled-${index + 1}`,
    stage: "recalledMaterials",
    sourcePath: material.path,
    sourceField: "recalledMaterials",
    summary: material.reason,
    lineTarget: material.lineTarget,
    visibility: material.visibilityScope,
    knowledgeScope: material.knowledgeScope,
    happenedStatus: "confirmed_happened",
    affectedPaths: [material.path],
    runtimeDeltaRefs: [],
    knowledgeClaims: material.knowledgeClaims,
    targetPath: material.path,
  }), [`path:${normalizeWikiPath(material.path)}`, ...material.sections.map((section) => `section:${normalizeWikiPath(material.path)}#${section.sectionId}`)]))
  input.outlineAwareNarrationBrief.references.forEach((reference, index) => add(makeSourceDelta({
    input,
    id: `outline-brief-ref-${index + 1}`,
    stage: "outlineAwareNarrationBrief",
    sourcePath: reference.path,
    sourceField: "references",
    summary: reference.reason,
    lineTarget: reference.lineTarget,
    visibility: reference.visibilityScope,
    knowledgeScope: reference.knowledgeScope,
    happenedStatus: "confirmed_happened",
    affectedPaths: [reference.path],
    runtimeDeltaRefs: reference.runtimeDeltaId
      ? [{
          deltaId: reference.runtimeDeltaId,
          sourceStage: "outlineBrief",
          sourcePath: reference.path,
          summary: reference.reason,
          narrativeLine: reference.lineTarget,
          usePurpose: reference.usePurpose,
          happenedStatus: "confirmed_happened",
        }]
      : [],
    knowledgeClaims: reference.knowledgeClaims,
    targetPath: reference.path,
  }), [`path:${normalizeWikiPath(reference.path)}`]))
  input.turnNarration?.references.forEach((reference, index) => add(makeSourceDelta({
    input,
    id: `turn-narration-ref-${index + 1}`,
    stage: "turnNarration",
    sourcePath: reference.path,
    sourceField: "references",
    summary: reference.reason,
    lineTarget: reference.lineTarget ?? "playerVisibleLine",
    visibility: reference.visibilityScope ?? "pc_visible",
    knowledgeScope: reference.knowledgeScope ?? "pc_known",
    happenedStatus: "ongoing",
    affectedPaths: [reference.path],
    runtimeDeltaRefs: reference.runtimeDeltaId
      ? [{
          deltaId: reference.runtimeDeltaId,
          sourceStage: "turnNarration",
          sourcePath: reference.path,
          summary: reference.reason,
          narrativeLine: reference.lineTarget ?? "playerVisibleLine",
          usePurpose: reference.usePurpose,
          happenedStatus: "ongoing",
        }]
      : [],
    knowledgeClaims: reference.knowledgeClaims,
    targetPath: reference.path,
  }), [`path:${normalizeWikiPath(reference.path)}`]))
  return candidates
}

function makeSourceDelta(input: {
  input: RuntimeUpdateProposalInput
  id: string
  stage: RuntimeUpdateSourceStage
  sourcePath?: string
  sourceField?: string
  summary: string
  lineTarget: RpgNarrativeLine
  visibility: RpgVisibilityScope
  knowledgeScope: RpgKnowledgeScope
  happenedStatus: RpgHappenedStatus
  usePurpose?: RpgUsePurpose
  affectedPaths: string[]
  runtimeDeltaRefs: RuntimeUpdateSourceDelta["runtimeDeltaRefs"]
  knowledgeClaims?: RuntimeUpdateSourceDelta["knowledgeClaims"]
  revealGateRefs?: string[]
  revealState?: RpgRevealState
  targetPath?: string
}): RuntimeUpdateSourceDelta {
  const affectedPaths = uniqueStrings(input.affectedPaths.map(normalizeWikiPath).filter(Boolean))
  return {
    deltaId: `runtime-source-${slug(input.input.turnRecord.submittedAction.id)}-${slug(input.id)}`,
    sourceStage: input.stage,
    ...(input.sourcePath ? { sourcePath: normalizeWikiPath(input.sourcePath) } : {}),
    ...(input.sourceField ? { sourceField: input.sourceField } : {}),
    summary: input.summary,
    lineTarget: input.lineTarget,
    visibility: input.visibility,
    knowledgeScope: input.knowledgeScope,
    happenedStatus: input.happenedStatus,
    usePurpose: input.usePurpose ?? "writeback",
    affectedPaths,
    runtimeDeltaRefs: input.runtimeDeltaRefs,
    knowledgeClaims: input.knowledgeClaims?.length
      ? input.knowledgeClaims
      : [createKnowledgeClaim(input.summary, input.targetPath ?? affectedPaths[0], input.visibility, input.knowledgeScope)],
    revealGateRefs: input.revealGateRefs ?? [],
    ...(input.revealState ? { revealState: input.revealState } : {}),
  }
}

function normalizeSourceDeltaForTarget(
  sourceDelta: RuntimeUpdateSourceDelta,
  targetPath: string,
  input: RuntimeUpdateProposalInput,
  suffix: string,
): RuntimeUpdateSourceDelta {
  const targetMeta = deriveTargetMetadata(targetPath, sourceDelta.happenedStatus)
  return {
    ...sourceDelta,
    deltaId: `${sourceDelta.deltaId}-${suffix}`,
    affectedPaths: uniqueStrings([...sourceDelta.affectedPaths, targetPath]),
    visibility: targetMeta.visibility ?? sourceDelta.visibility,
    knowledgeScope: targetMeta.knowledgeScope ?? sourceDelta.knowledgeScope,
    lineTarget: targetMeta.lineTarget ?? sourceDelta.lineTarget,
    happenedStatus: targetPath.startsWith("wiki/events/") ? "confirmed_happened" : sourceDelta.happenedStatus,
    knowledgeClaims: [createKnowledgeClaim(sourceDelta.summary, targetPath, targetMeta.visibility ?? sourceDelta.visibility, targetMeta.knowledgeScope ?? sourceDelta.knowledgeScope)],
    runtimeDeltaRefs: sourceDelta.runtimeDeltaRefs.length > 0
      ? sourceDelta.runtimeDeltaRefs
      : input.postActionWorkingState.runtimeDeltaRefs,
  }
}

function createKnowledgeClaim(
  summary: string,
  targetPath: string | undefined,
  visibility: RpgVisibilityScope,
  knowledgeScope: RpgKnowledgeScope,
): RuntimeUpdateSourceDelta["knowledgeClaims"][number] {
  const targetActor = actorRefFromRuntimePath(targetPath)
  const holder = chooseHolder(targetActor, visibility, knowledgeScope)
  const nonHolders = holder === "pc" ? [] : ["pc" as const]
  const pcBelief: RpgBeliefState = holder === "pc"
    ? (knowledgeScope === "pc_misunderstanding" ? "misunderstood" : "known")
    : "unknown"
  const holderBelief: RpgBeliefState = knowledgeScope === "pc_misunderstanding" ? "misunderstood" : "known"
  return {
    claimId: `claim-${slug(summary).slice(0, 48) || "runtime-update"}`,
    summary,
    truthStatus: "true",
    holders: [holder],
    nonHolders,
    beliefStateByActor: uniqueActors([
      { actor: holder, beliefState: holderBelief, reason: "Compiled from draft source boundary." },
      ...(holder === "pc" ? [] : [{ actor: "pc" as const, beliefState: pcBelief, reason: "Compiled as not granted to PC by this source." }]),
    ]),
  }
}

function chooseHolder(
  targetActor: RpgKnowledgeActorRef | undefined,
  visibility: RpgVisibilityScope,
  knowledgeScope: RpgKnowledgeScope,
): RpgKnowledgeActorRef {
  if (targetActor) return targetActor
  if (knowledgeScope === "pc_known" || knowledgeScope === "pc_misunderstanding") return "pc"
  if (knowledgeScope === "user_only" || visibility === "user_visible_pc_unknown") return "user"
  if (knowledgeScope === "npc_known") return "npc:runtime"
  return "gm"
}

function deriveTargetMetadata(
  targetPath: string,
  happenedStatus: RpgHappenedStatus,
): { lineTarget?: RpgNarrativeLine; visibility?: RpgVisibilityScope; knowledgeScope?: RpgKnowledgeScope } {
  if (targetPath === "wiki/player/known_information.md") {
    return { lineTarget: "playerVisibleLine", visibility: "pc_visible", knowledgeScope: "pc_known" }
  }
  if (targetPath.startsWith("wiki/characters/runtime/") || targetPath.startsWith("wiki/factions/runtime/")) {
    return { lineTarget: "parallelLine", visibility: "user_visible_pc_unknown", knowledgeScope: "npc_known" }
  }
  if (targetPath.startsWith("wiki/relationships/runtime/")) {
    return { lineTarget: "tensionLine", visibility: "user_visible_pc_unknown", knowledgeScope: "npc_known" }
  }
  if (targetPath.startsWith("wiki/plot-arcs/runtime/") || targetPath === "wiki/outlines/progress.md") {
    return { lineTarget: "tensionLine", visibility: "gm_only", knowledgeScope: "gm_only" }
  }
  if (targetPath.startsWith("wiki/events/")) {
    return {
      lineTarget: "playerVisibleLine",
      visibility: happenedStatus === "confirmed_happened" ? "gm_only" : "hidden",
      knowledgeScope: "gm_only",
    }
  }
  return { lineTarget: "playerVisibleLine", visibility: "pc_visible", knowledgeScope: "pc_known" }
}

function compileValidationHints(riskNotes: readonly string[], updateIndex: number): RuntimeUpdateValidationHint[] {
  if (riskNotes.length === 0) {
    return [{
      hintId: `runtime-update-hint-${updateIndex + 1}-1`,
      severity: "info",
      code: "draft_compiled",
      message: "Runtime update proposal metadata was compiled locally from draft and known turn sources.",
    }]
  }
  return riskNotes.map((note, index) => ({
    hintId: `runtime-update-hint-${updateIndex + 1}-${index + 1}`,
    severity: "warning",
    code: "draft_risk_note",
    message: note,
  }))
}

function sourceRefKeys(ref: RuntimeUpdateDraftSourceRef): string[] {
  return [
    ref.runtimeDeltaId ? `runtime:${ref.runtimeDeltaId}` : undefined,
    ref.path ? `path:${normalizeWikiPath(ref.path)}` : undefined,
    ref.path && ref.sectionId ? `section:${normalizeWikiPath(ref.path)}#${ref.sectionId}` : undefined,
  ].filter((value): value is string => !!value)
}

function actorRefFromRuntimePath(targetPath: string | undefined): RpgKnowledgeActorRef | undefined {
  if (!targetPath) return undefined
  const character = /^wiki\/characters\/runtime\/([^/]+)\.md$/u.exec(targetPath)
  if (character) return `npc:${character[1]}`
  const faction = /^wiki\/factions\/runtime\/([^/]+)\.md$/u.exec(targetPath)
  if (faction) return `faction:${faction[1]}`
  const relationship = /^wiki\/relationships\/runtime\/([^/]+)\.md$/u.exec(targetPath)
  if (relationship) return `npc:${relationship[1]}`
  return undefined
}

function validateDraftUpdate(value: unknown, index: number): RuntimeUpdateProposalDraft["proposedWikiUpdates"][number] {
  const record = expectRecord(value, `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}]`)
  return {
    targetPath: readString(record, "targetPath", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].targetPath`),
    strategy: readEnum<RuntimeProposedWikiUpdate["strategy"]>(
      record,
      "strategy",
      STRATEGIES,
      `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].strategy`,
    ),
    reason: readString(record, "reason", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].reason`),
    content: readString(record, "content", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].content`),
    runtimeDeltaIds: optionalStringArray(record, "runtimeDeltaIds", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].runtimeDeltaIds`) ?? [],
    sourceRefs: optionalArray(record, "sourceRefs", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].sourceRefs`)
      .map((entry, refIndex) => validateDraftSourceRef(entry, `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].sourceRefs[${refIndex}]`)),
    happenedStatus: readEnum<RpgHappenedStatus>(
      record,
      "happenedStatus",
      HAPPENED_STATUSES,
      `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].happenedStatus`,
    ),
    confidence: readEnum<RuntimeUpdateProposalDraft["proposedWikiUpdates"][number]["confidence"]>(
      record,
      "confidence",
      CONFIDENCE,
      `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].confidence`,
    ),
    riskNotes: optionalStringArray(record, "riskNotes", `RuntimeUpdateProposalDraft.proposedWikiUpdates[${index}].riskNotes`) ?? [],
  }
}

function validateDraftSourceRef(value: unknown, label: string): RuntimeUpdateDraftSourceRef {
  const record = expectRecord(value, label)
  if (record.path === undefined && record.runtimeDeltaId === undefined) {
    throw new Error(`Invalid ${label}: sourceRef requires path or runtimeDeltaId.`)
  }
  return {
    ...(typeof record.path === "string" && record.path.trim() ? { path: normalizeWikiPath(record.path) } : {}),
    ...(typeof record.sectionId === "string" && record.sectionId.trim() ? { sectionId: record.sectionId.trim() } : {}),
    ...(typeof record.runtimeDeltaId === "string" && record.runtimeDeltaId.trim() ? { runtimeDeltaId: record.runtimeDeltaId.trim() } : {}),
    reason: readString(record, "reason", `${label}.reason`),
  }
}

function validateDraftSkippedDelta(value: unknown, index: number): RuntimeUpdateProposalDraft["skippedDeltas"][number] {
  const record = expectRecord(value, `RuntimeUpdateProposalDraft.skippedDeltas[${index}]`)
  return {
    ...(typeof record.runtimeDeltaId === "string" && record.runtimeDeltaId.trim() ? { runtimeDeltaId: record.runtimeDeltaId.trim() } : {}),
    ...(record.sourceRef === undefined ? {} : { sourceRef: validateDraftSourceRef(record.sourceRef, `RuntimeUpdateProposalDraft.skippedDeltas[${index}].sourceRef`) }),
    code: readString(record, "code", `RuntimeUpdateProposalDraft.skippedDeltas[${index}].code`),
    reason: readString(record, "reason", `RuntimeUpdateProposalDraft.skippedDeltas[${index}].reason`),
    reviewPolicy: readEnum<RuntimeUpdateProposalDraft["skippedDeltas"][number]["reviewPolicy"]>(
      record,
      "reviewPolicy",
      REVIEW_POLICIES,
      `RuntimeUpdateProposalDraft.skippedDeltas[${index}].reviewPolicy`,
    ),
  }
}

function validateDraftOutlineReviewItem(
  value: unknown,
  index: number,
): RuntimeUpdateProposalDraft["outlineRevisionReviewItems"][number] {
  const record = expectRecord(value, `RuntimeUpdateProposalDraft.outlineRevisionReviewItems[${index}]`)
  return {
    summary: readString(record, "summary", `RuntimeUpdateProposalDraft.outlineRevisionReviewItems[${index}].summary`),
    proposedRevisionSummary: readString(
      record,
      "proposedRevisionSummary",
      `RuntimeUpdateProposalDraft.outlineRevisionReviewItems[${index}].proposedRevisionSummary`,
    ),
    warnings: optionalStringArray(record, "warnings", `RuntimeUpdateProposalDraft.outlineRevisionReviewItems[${index}].warnings`) ?? [],
  }
}

function validateDraftPacingProposal(value: unknown): NonNullable<RuntimeUpdateProposalDraft["pacingUpdateProposal"]> {
  const record = expectRecord(value, "RuntimeUpdateProposalDraft.pacingUpdateProposal")
  return {
    sourceRuntimeDeltaIds: optionalStringArray(
      record,
      "sourceRuntimeDeltaIds",
      "RuntimeUpdateProposalDraft.pacingUpdateProposal.sourceRuntimeDeltaIds",
    ) ?? [],
    nextPacingState: readString(record, "nextPacingState", "RuntimeUpdateProposalDraft.pacingUpdateProposal.nextPacingState"),
    timeDeltaSummary: readString(record, "timeDeltaSummary", "RuntimeUpdateProposalDraft.pacingUpdateProposal.timeDeltaSummary"),
    campaignDelta: readString(record, "campaignDelta", "RuntimeUpdateProposalDraft.pacingUpdateProposal.campaignDelta"),
    pacingDebtChange: readEnum<NonNullable<RuntimeUpdateProposalDraft["pacingUpdateProposal"]>["pacingDebtChange"]>(
      record,
      "pacingDebtChange",
      PACING_DEBT_CHANGES,
      "RuntimeUpdateProposalDraft.pacingUpdateProposal.pacingDebtChange",
    ),
    targetPath: readEnum<NonNullable<RuntimeUpdateProposalDraft["pacingUpdateProposal"]>["targetPath"]>(
      record,
      "targetPath",
      PACING_TARGETS,
      "RuntimeUpdateProposalDraft.pacingUpdateProposal.targetPath",
    ),
    reviewPolicy: readEnum<NonNullable<RuntimeUpdateProposalDraft["pacingUpdateProposal"]>["reviewPolicy"]>(
      record,
      "reviewPolicy",
      REVIEW_POLICIES,
      "RuntimeUpdateProposalDraft.pacingUpdateProposal.reviewPolicy",
    ),
  }
}

function assertNoForbiddenDraftKeys(value: unknown, path = "RuntimeUpdateProposalDraft"): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenDraftKeys(entry, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/^(?:id|sourceTurnId|sourceDeltas|lineTarget|visibility|knowledgeScope|knowledgeClaims|revealGateRefs|validationHints|proposalGroups)$/u.test(key)) {
      throw new Error(`Invalid RuntimeUpdateProposalDraft: forbidden canonical key ${path}.${key}.`)
    }
    assertNoForbiddenDraftKeys(child, `${path}.${key}`)
  }
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected an object.`)
  }
  return value as Record<string, unknown>
}

function optionalArray(record: Record<string, unknown>, key: string, label: string): unknown[] {
  if (record[key] === undefined) return []
  if (!Array.isArray(record[key])) throw new Error(`Invalid ${label}: expected an array.`)
  return record[key]
}

function optionalStringArray(record: Record<string, unknown>, key: string, label: string): string[] | undefined {
  if (record[key] === undefined) return undefined
  if (!Array.isArray(record[key])) throw new Error(`Invalid ${label}: expected an array.`)
  return record[key].map((entry, index) => {
    if (typeof entry !== "string") throw new Error(`Invalid ${label}[${index}]: expected a string.`)
    return entry.trim()
  }).filter(Boolean)
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string.`)
  }
  return value.trim()
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T> | ReadonlySet<string>,
  label: string,
): T {
  const value = record[key]
  const allowedValues = allowed as ReadonlySet<string>
  if (typeof value !== "string" || !allowedValues.has(value)) {
    throw new Error(`Invalid ${label}: unsupported value ${JSON.stringify(value)}.`)
  }
  return value as T
}

function normalizeWikiPath(value: string | undefined): string {
  return (value ?? "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").replace(/^\/+/, "")
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeWikiPath).filter(Boolean))]
}

function uniqueActors(values: Array<{ actor: RpgKnowledgeActorRef; beliefState: RpgBeliefState; reason: string }>): Array<{ actor: RpgKnowledgeActorRef; beliefState: RpgBeliefState; reason: string }> {
  const seen = new Set<RpgKnowledgeActorRef>()
  return values.filter((value) => {
    if (seen.has(value.actor)) return false
    seen.add(value.actor)
    return true
  })
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "runtime"
}
