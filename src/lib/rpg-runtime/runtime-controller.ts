import {
  runtimeUpdateInteractionSpec,
  compileRuntimeUpdateProposalDraftOutput,
  parseAndValidateRuntimeUpdateProposalDraft,
  RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES,
  summarizeRuntimeUpdateProposalDraft,
  type RpgActionResolverAdapter,
  type RpgNarrationGeneratorAdapter,
  type RpgOutlineBriefAdapter,
  type RpgRecallSelectorAdapter,
  type RpgRuntimeUpdateInteractionAdapter,
  type RpgStoryOutlineRegeneratorAdapter,
  type RpgWorldTickAdapter,
  type RpgRuntimeUpdateValidationResult,
} from "../rpg-interactions/runtime"
import type { RpgInteractionPrompt } from "../rpg-interactions/interaction-spec"
import {
  type RuntimeTurnJournalEntry,
  type RuntimeUpdateProposalAuditSummary,
  type RuntimeUpdateValidationJournalSummary,
  type RuntimeUpdateProposalSource,
} from "./runtime-persistence"
import {
  classifyRpgRuntimeDebugErrorPhase,
  createJsonRpgRuntimeDebugSection,
  createRpgRuntimeDebugSection,
  toRpgRuntimeDebugError,
  type RpgRuntimeDebugErrorPhase,
  type RpgRuntimeDebugStepId,
  type RpgRuntimeDebugTraceSink,
} from "./debug-trace"
import { buildRuntimeUpdateProposalInputFromTurnRecord } from "./runtime-update-proposal-handoff"
import { createPendingRpgUpdates, type PendingRpgUpdate } from "./update-staging"
import {
  summarizeRpgRuntimePersistenceBoundary,
  validateRpgRuntimePersistenceBoundary,
  type RpgRuntimePersistenceBoundaryResult,
  type RpgRuntimePersistenceBoundarySummary,
  type RpgRuntimePersistenceReviewOnlyAuditItem,
} from "./persistence-boundary"
import type { ProposedWikiUpdate } from "./state-extractor"
import {
  parseSoftSemanticRawOutputWithOptionalRepairRetry,
  runRpgTurn,
} from "./turn-orchestrator"
import type { SoftSemanticRepairRetryRuntimeOptions } from "./turn-orchestrator"
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
  RuntimeUpdateProposalInput,
  RuntimeUpdateProposalResult,
  SkippedRuntimeDelta,
  SubmittedAction,
  TurnSemanticHandoff,
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
  debugTraceSink?: RpgRuntimeDebugTraceSink
  softSemanticRepairRetry?: SoftSemanticRepairRetryRuntimeOptions
}

export interface RunRpgRuntimeTurnFlowResult {
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
  pendingUpdates: PendingRpgUpdate[]
  warnings: string[]
  proposalSource: RuntimeUpdateProposalSource
  runtimeUpdateProposal: RuntimeUpdateProposalResult
  runtimeUpdateProposalAudit: RuntimeUpdateProposalAuditSummary
  runtimePersistenceBoundary: RpgRuntimePersistenceBoundarySummary
  outlineRevisionReviewItems: OutlineRevisionReviewItem[]
  skippedDeltas: SkippedRuntimeDelta[]
  pacingUpdateProposal: PacingUpdateProposal | null
  proposalGroups: ProposalGroup[]
  runtimeUpdateValidation: RpgRuntimeUpdateValidationResult
}

const RUNTIME_UPDATE_PROPOSAL_REPAIR_SAFETY_LINES = [
  "Do not create pending updates, apply updates, write files, claim files were modified, or add direct persistence/apply instructions.",
  "Do not add target paths outside the failed RuntimeUpdateProposalDraft schema. Any proposedWikiUpdates remain draft review material only.",
] as const

export async function runRpgRuntimeTurnFlow(
  input: RunRpgRuntimeTurnFlowInput,
): Promise<RunRpgRuntimeTurnFlowResult> {
  const debugTraceSink = input.debugTraceSink
  const ownsTrace = !!debugTraceSink && !debugTraceSink.getCurrentTrace()
  if (ownsTrace) debugTraceSink.startTrace({ submittedAction: input.submittedAction })

  try {
    const turn = await runRpgTurn({ ...input, debugTraceSink })
    const extracted = await generateRuntimeUpdateProposal(input, turn.turnRecord)
    const proposedUpdates = extracted.proposedWikiUpdates
    const runtimeUpdateProposalAudit = summarizeRuntimeUpdateProposal(extracted)

    debugTraceSink?.startStep("runtime_update_validation")
    const runtimePersistenceBoundary = validateWithDebugTrace(
      debugTraceSink,
      proposedUpdates,
      buildRuntimePersistenceReviewOnlyAuditItems(extracted),
    )
    const runtimeUpdateValidation: RpgRuntimeUpdateValidationResult = runtimePersistenceBoundary
    const runtimePersistenceBoundarySummary = summarizeRpgRuntimePersistenceBoundary(
      runtimePersistenceBoundary,
      proposedUpdates.length,
    )

    debugTraceSink?.startStep("pending_update_persistence")
    const pendingUpdates = createPendingRpgUpdates(runtimePersistenceBoundary.acceptedUpdates)
    const warnings = [
      ...turn.warnings,
      ...extracted.warnings,
      ...formatRuntimeUpdateProposalAuditWarnings(runtimeUpdateProposalAudit),
      ...runtimePersistenceBoundary.warnings,
    ]
    addDebugJsonSection(debugTraceSink, "pending_update_persistence", "inputSections", {
      sectionId: "pending-update-staging-input",
      title: "输入组装",
      sourceKind: "local_result",
      sourceLabel: "validateRpgRuntimePersistenceBoundary + createPendingRpgUpdates",
      value: {
        acceptedUpdateIds: runtimePersistenceBoundary.acceptedUpdates.map((update) => update.id),
        pendingEligibleUpdateIds: runtimePersistenceBoundary.pendingEligibleUpdateIds,
        boundarySummary: runtimePersistenceBoundarySummary,
      },
    })
    addDebugJsonSection(debugTraceSink, "pending_update_persistence", "handoffSections", {
      sectionId: "pending-update-staging-result",
      title: "交接 / 下一步输入",
      sourceKind: "runtime_handoff",
      sourceLabel: "pending updates returned to runtime panel",
      value: { pendingUpdates },
    })
    const journalWarnings = await persistTurnJournalEntry(input, {
      timestamp: new Date().toISOString(),
      submittedAction: input.submittedAction,
      actionResolution: turn.actionResolution,
      worldTickResult: turn.worldTickResult,
      visibleSelection: turn.visibleSelection,
      postActionWorkingState: turn.postActionWorkingState,
      turnSemanticHandoff: turn.turnSemanticHandoff,
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
      runtimePersistenceBoundary: runtimePersistenceBoundarySummary,
      runtimeUpdateValidation: summarizeRuntimeUpdateValidation(runtimeUpdateValidation),
    })
    addDebugJsonSection(debugTraceSink, "pending_update_persistence", "validationSections", {
      sectionId: "turn-journal-persistence",
      title: "Persistence Result",
      sourceKind: "validation",
      sourceLabel: "appendTurnJournalEntry",
      value: {
        attempted: Boolean(input.runtimePersistence?.appendTurnJournalEntry),
        warnings: journalWarnings,
      },
    })
    addValidationWarningsDebugSection(
      debugTraceSink,
      "pending_update_persistence",
      journalWarnings,
      "appendTurnJournalEntry.warnings",
    )
    debugTraceSink?.addStepWarnings("pending_update_persistence", journalWarnings)
    debugTraceSink?.finishStep("pending_update_persistence")

    const result = {
      actionResolution: turn.actionResolution,
      worldTickResult: turn.worldTickResult,
      visibleSelection: turn.visibleSelection,
      postActionWorkingState: turn.postActionWorkingState,
      turnSemanticHandoff: turn.turnSemanticHandoff,
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
      runtimePersistenceBoundary: runtimePersistenceBoundarySummary,
      outlineRevisionReviewItems: extracted.outlineRevisionReviewItems,
      skippedDeltas: extracted.skippedDeltas,
      pacingUpdateProposal: extracted.pacingUpdateProposal,
      proposalGroups: extracted.proposalGroups,
      runtimeUpdateValidation,
    }

    if (ownsTrace) debugTraceSink?.finishTrace("succeeded")
    return result
  } catch (error) {
    if (ownsTrace) debugTraceSink?.finishTrace("failed", error)
    throw error
  }
}

async function generateRuntimeUpdateProposal(
  input: RunRpgRuntimeTurnFlowInput,
  turnRecord: RpgTurnRecord,
): Promise<RuntimeUpdateProposalResult & { proposalSource: RuntimeUpdateProposalSource }> {
  const debugTraceSink = input.debugTraceSink
  debugTraceSink?.startStep("runtime_update_proposal")

  try {
    const proposalInput = buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "inputSections", {
      sectionId: "runtime-update-proposal-input",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildRuntimeUpdateProposalInputFromTurnRecord",
      value: proposalInput,
    })
    addRuntimeUpdateProposalWikiInputSection(debugTraceSink, proposalInput)
    const prompt = runtimeUpdateInteractionSpec.buildPrompt(proposalInput)
    addPromptDebugSections(debugTraceSink, "runtime_update_proposal", prompt)
    debugTraceSink?.setStepStatus("runtime_update_proposal", "streaming")
    const output = await input.updateInteractionAdapter.generateUpdateProposal(prompt)
    debugTraceSink?.addStepSection(
      "runtime_update_proposal",
      "rawOutput",
      createRpgRuntimeDebugSection({
        sectionId: "runtime-update-proposal-raw-output",
        title: "原始输出",
        sourceKind: "llm_output",
        sourceLabel: "generateUpdateProposal",
        contentType: "text",
        content: output,
      }),
    )
    debugTraceSink?.setStepStatus("runtime_update_proposal", "parsing")
    const repairParsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
      rawOutput: output,
      promptInput: proposalInput,
      stepId: "runtime_update_proposal",
      stageKind: "runtime_update_proposal",
      stageLabel: "RPG Runtime Update Proposal",
      draftSchemaLines: RUNTIME_UPDATE_PROPOSAL_DRAFT_SCHEMA_PROMPT_LINES,
      safetyInstructionLines: RUNTIME_UPDATE_PROPOSAL_REPAIR_SAFETY_LINES,
      parseOutput(rawOutput, currentProposalInput, options) {
        const draft = parseAndValidateRuntimeUpdateProposalDraft(rawOutput, options)
        return {
          draft,
          parsed: compileRuntimeUpdateProposalDraftOutput(draft, currentProposalInput),
        }
      },
      repairRawOutput: input.updateInteractionAdapter.repairUpdateProposalRawOutput
        ? (repairPrompt) => input.updateInteractionAdapter.repairUpdateProposalRawOutput!(repairPrompt)
        : undefined,
      debugTraceSink,
      retryOptions: input.softSemanticRepairRetry,
    })
    const draft = repairParsed.draft
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "parsedOutput", {
      sectionId: "runtime-update-proposal-parsed-draft",
      title: "解析后 Draft",
      sourceKind: "local_result",
      sourceLabel: "parseAndValidateRuntimeUpdateProposalDraft",
      value: draft,
    })
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "validationSections", {
      sectionId: "runtime-update-proposal-draft-summary",
      title: "Draft 摘要",
      sourceKind: "local_result",
      sourceLabel: "RuntimeUpdateProposalDraft summary",
      value: summarizeRuntimeUpdateProposalDraft(draft),
    })
    const parsed = repairParsed.parsed
    debugTraceSink?.setStepStatus("runtime_update_proposal", "validating")
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "validationSections", {
      sectionId: "runtime-update-proposal-validation",
      title: "校验成功",
      sourceKind: "validation",
      sourceLabel: "compileRuntimeUpdateProposalDraftOutput + validateRuntimeUpdateProposalResult",
      value: {
        summary: "RuntimeUpdateProposalResult accepted by interaction validation.",
        proposedWikiUpdateIds: parsed.proposedWikiUpdates.map((update) => update.id),
        warnings: parsed.warnings,
      },
    })
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "validationSections", {
      sectionId: "runtime-update-proposal-compiled-output-summary",
      title: "Compiled Canonical Summary",
      sourceKind: "local_result",
      sourceLabel: "RuntimeUpdateProposalResult summary",
      value: summarizeRuntimeUpdateProposalParsedOutput(parsed),
    })
    addValidationWarningsDebugSection(
      debugTraceSink,
      "runtime_update_proposal",
      parsed.warnings,
      "RuntimeUpdateProposalResult.warnings",
    )
    addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "handoffSections", {
      sectionId: "runtime-update-proposal-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "runtime_handoff",
      sourceLabel: "proposedWikiUpdates / outlineRevisionReviewItems / skippedDeltas",
      value: summarizeRuntimeUpdateProposalHandoff(parsed),
    })
    debugTraceSink?.addStepWarnings("runtime_update_proposal", parsed.warnings)
    debugTraceSink?.finishStep("runtime_update_proposal")
    return {
      ...parsed,
      proposalSource: "interaction",
    }
  } catch (error) {
    failDebugStep(debugTraceSink, "runtime_update_proposal", error, classifyRpgRuntimeDebugErrorPhase(error))
    throw error
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
    return [`无法追加 RPG 回合日志条目：${error instanceof Error ? error.message : String(error)}`]
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

function buildRuntimePersistenceReviewOnlyAuditItems(
  proposal: RuntimeUpdateProposalResult,
): RpgRuntimePersistenceReviewOnlyAuditItem[] {
  return [
    ...proposal.skippedDeltas.map((delta) => ({
      kind: "skipped_delta" as const,
      id: delta.skipId,
      summary: `${delta.code}: ${delta.reason}`,
      reviewPolicy: delta.reviewPolicy,
    })),
    ...proposal.outlineRevisionReviewItems.map((item) => ({
      kind: "outline_revision_review" as const,
      id: item.reviewItemId,
      summary: item.summary,
      reviewPolicy: item.reviewPolicy,
    })),
    ...proposal.journalEntries.map((entry, index) => ({
      kind: "journal_entry" as const,
      id: `runtime-update-journal-${index + 1}`,
      summary: entry,
      reviewPolicy: "review_only",
    })),
    ...(proposal.pacingUpdateProposal
      ? [{
          kind: "pacing_update_proposal" as const,
          id: proposal.pacingUpdateProposal.proposalId,
          summary: proposal.pacingUpdateProposal.campaignDelta,
          reviewPolicy: proposal.pacingUpdateProposal.reviewPolicy,
        }]
      : []),
    ...proposal.proposalGroups.map((group) => ({
      kind: "proposal_group" as const,
      id: group.groupId,
      summary: group.reason,
      reviewPolicy: group.reviewPolicy,
    })),
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

function validateWithDebugTrace(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  proposedUpdates: ProposedWikiUpdate[],
  reviewOnlyAuditItems: readonly RpgRuntimePersistenceReviewOnlyAuditItem[],
): RpgRuntimePersistenceBoundaryResult {
  try {
    addDebugJsonSection(debugTraceSink, "runtime_update_validation", "inputSections", {
      sectionId: "runtime-update-validation-input",
      title: "输入组装",
      sourceKind: "local_result",
      sourceLabel: "runtime_update_proposal.proposedWikiUpdates + review-only audit",
      value: { proposedUpdates, reviewOnlyAuditItems },
    })
    debugTraceSink?.setStepStatus("runtime_update_validation", "validating")
    const validation = validateRpgRuntimePersistenceBoundary({ proposedUpdates, reviewOnlyAuditItems })
    const boundarySummary = summarizeRpgRuntimePersistenceBoundary(validation, proposedUpdates.length)
    addDebugJsonSection(debugTraceSink, "runtime_update_validation", "validationSections", {
      sectionId: "runtime-update-validation-result",
      title: "校验成功",
      sourceKind: "validation",
      sourceLabel: "validateRpgRuntimePersistenceBoundary",
      value: validation,
    })
    addDebugJsonSection(debugTraceSink, "runtime_update_validation", "validationSections", {
      sectionId: "runtime-persistence-boundary-summary",
      title: "Persistence Boundary Summary",
      sourceKind: "validation",
      sourceLabel: "accepted/rejected/pending/review-only boundary",
      value: boundarySummary,
    })
    addValidationWarningsDebugSection(
      debugTraceSink,
      "runtime_update_validation",
      validation.warnings,
      "validateRpgRuntimePersistenceBoundary.warnings",
    )
    debugTraceSink?.addStepWarnings("runtime_update_validation", validation.warnings)
    debugTraceSink?.finishStep("runtime_update_validation")
    return validation
  } catch (error) {
    failDebugStep(debugTraceSink, "runtime_update_validation", error, "validation")
    throw error
  }
}

function addPromptDebugSections(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  prompt: RpgInteractionPrompt,
): void {
  if (prompt.debugSections?.length) {
    for (const section of prompt.debugSections) {
      debugTraceSink?.addStepSection(
        stepId,
        "promptSections",
        createRpgRuntimeDebugSection({
          sectionId: section.sectionId,
          title: section.title,
          sourceKind: section.sourceKind,
          sourceLabel: section.sourceLabel,
          contentType: section.contentType,
          content: section.content,
        }),
      )
    }
    return
  }

  debugTraceSink?.addStepSection(
    stepId,
    "promptSections",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-system-prompt`,
      title: "系统提示词",
      sourceKind: "fixed_prompt",
      sourceLabel: "systemPrompt",
      contentType: "text",
      content: prompt.systemPrompt,
    }),
  )
  debugTraceSink?.addStepSection(
    stepId,
    "promptSections",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-user-prompt`,
      title: "用户提示词",
      sourceKind: "runtime_handoff",
      sourceLabel: "userPrompt",
      contentType: "markdown",
      content: prompt.userPrompt,
    }),
  )
}

function addDebugJsonSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  area: "inputSections" | "parsedOutput" | "validationSections" | "handoffSections",
  input: {
    sectionId: string
    title: string
    sourceKind: "local_input_builder" | "local_result" | "runtime_handoff" | "validation" | "wiki_file"
    sourceLabel: string
    value: unknown
  },
): void {
  debugTraceSink?.addStepSection(
    stepId,
    area,
    createJsonRpgRuntimeDebugSection(input),
  )
}

function addValidationWarningsDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  warnings: readonly string[],
  sourceLabel: string,
): void {
  if (warnings.length === 0) return
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-validation-warnings-${slug(sourceLabel)}`,
    title: "校验警告",
    sourceKind: "validation",
    sourceLabel,
    value: { warnings },
  })
}

function addRuntimeUpdateProposalWikiInputSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  proposalInput: RuntimeUpdateProposalInput,
): void {
  const paths = collectRuntimeUpdateProposalWikiInputs(proposalInput)
  if (paths.length === 0) return

  addDebugJsonSection(debugTraceSink, "runtime_update_proposal", "inputSections", {
    sectionId: "runtime-update-proposal-wiki-input-source-paths",
    title: "Wiki Inputs / Source Paths",
    sourceKind: "wiki_file",
    sourceLabel: "buildRuntimeUpdateProposalInputFromTurnRecord",
    value: {
      paths,
      warnings: proposalInput.consistencyValidation.warnings,
    },
  })
}

function collectRuntimeUpdateProposalWikiInputs(
  proposalInput: RuntimeUpdateProposalInput,
): Array<{ path: string; sectionId?: string; readMode?: string; sourceField: string; warnings: string[] }> {
  const entries = new Map<string, { path: string; sectionId?: string; readMode?: string; sourceField: string; warnings: string[] }>()

  function add(input: { path: string | undefined; sectionId?: string; readMode?: string; sourceField: string; warnings?: readonly string[] }): void {
    const path = normalizeWikiPath(input.path)
    if (!path) return
    const key = [path, input.sectionId ?? "", input.readMode ?? "", input.sourceField].join("|")
    if (!entries.has(key)) {
      entries.set(key, {
        path,
        sectionId: input.sectionId,
        readMode: input.readMode,
        sourceField: input.sourceField,
        warnings: [...(input.warnings ?? [])],
      })
    }
  }

  proposalInput.turnRecord.references.forEach((path) => add({ path, sourceField: "turnRecord.references" }))
  proposalInput.postActionWorkingState.references.forEach((path) =>
    add({ path, sourceField: "postActionWorkingState.references" }),
  )
  proposalInput.actionResolution.references.forEach((reference) =>
    add({ path: reference.path, sectionId: reference.sectionId, sourceField: "actionResolution.references" }),
  )
  proposalInput.worldTickResult.references.forEach((reference) =>
    add({ path: reference.path, sectionId: reference.sectionId, sourceField: "worldTickResult.references" }),
  )
  proposalInput.recallSelection.selectedItems.forEach((item) => {
    if (item.sections.length === 0) add({ path: item.path, readMode: item.readMode, sourceField: "recallSelection.selectedItems" })
    item.sections.forEach((section) =>
      add({
        path: item.path,
        sectionId: section.sectionId,
        readMode: item.readMode,
        sourceField: "recallSelection.selectedItems.sections",
      }),
    )
  })
  proposalInput.recalledMaterials.forEach((material) => {
    if (material.sections.length === 0) {
      add({
        path: material.path,
        readMode: material.readMode,
        sourceField: "recalledMaterials",
        warnings: material.warnings,
      })
    }
    material.sections.forEach((section) =>
      add({
        path: material.path,
        sectionId: section.sectionId,
        readMode: section.readMode,
        sourceField: "recalledMaterials.sections",
        warnings: [...material.warnings, ...section.warnings],
      }),
    )
  })
  proposalInput.outlineAwareNarrationBrief.references.forEach((reference) =>
    add({
      path: reference.path,
      sectionId: reference.sectionId,
      sourceField: "outlineAwareNarrationBrief.references",
    }),
  )
  proposalInput.turnNarration?.references.forEach((reference) =>
    add({ path: reference.path, sectionId: reference.sectionId, sourceField: "turnNarration.references" }),
  )

  return [...entries.values()].sort((a, b) =>
    [a.path, a.sectionId ?? "", a.readMode ?? "", a.sourceField].join("|")
      .localeCompare([b.path, b.sectionId ?? "", b.readMode ?? "", b.sourceField].join("|")),
  )
}

function summarizeRuntimeUpdateProposalParsedOutput(proposal: RuntimeUpdateProposalResult): unknown {
  return {
    proposedWikiUpdateCount: proposal.proposedWikiUpdates.length,
    proposedWikiUpdateIds: proposal.proposedWikiUpdates.map((update) => update.id),
    outlineRevisionReviewItemCount: proposal.outlineRevisionReviewItems.length,
    skippedDeltaCount: proposal.skippedDeltas.length,
    journalEntryCount: proposal.journalEntries.length,
    proposalGroupCount: proposal.proposalGroups.length,
    hasPacingUpdateProposal: Boolean(proposal.pacingUpdateProposal),
    warningCount: proposal.warnings.length,
  }
}

function summarizeRuntimeUpdateProposalHandoff(proposal: RuntimeUpdateProposalResult): unknown {
  return {
    proposedWikiUpdates: proposal.proposedWikiUpdates.map((update) => ({
      id: update.id,
      targetPath: update.targetPath,
      strategy: update.strategy,
      sourceDeltaCount: update.sourceDeltas.length,
      warningHintCount: update.validationHints.filter((hint) => hint.severity === "warning").length,
    })),
    outlineRevisionReviewItems: proposal.outlineRevisionReviewItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      sourceProposalId: item.sourceProposalId,
      outlineImpactLevel: item.outlineImpactLevel,
      reviewPolicy: item.reviewPolicy,
    })),
    skippedDeltas: proposal.skippedDeltas.map((delta) => ({
      skipId: delta.skipId,
      sourceDeltaId: delta.sourceDelta.deltaId,
      code: delta.code,
      reviewPolicy: delta.reviewPolicy,
    })),
    warnings: proposal.warnings,
  }
}

function normalizeWikiPath(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "")
  if (!normalized.startsWith("wiki/")) return undefined
  if (normalized.startsWith("wiki/runtime/")) return undefined
  if (normalized.includes("..")) return undefined
  return normalized
}

function failDebugStep(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  error: unknown,
  phase: RpgRuntimeDebugErrorPhase,
): void {
  recordDebugErrorSection(debugTraceSink, stepId, error, phase)
  debugTraceSink?.failStep(stepId, error, phase)
}

function recordDebugErrorSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  error: unknown,
  phase: RpgRuntimeDebugErrorPhase,
): void {
  const area = phase === "input_assembly" ? "inputSections" : "validationSections"
  const debugError = toRpgRuntimeDebugError(error, phase)
  addDebugJsonSection(debugTraceSink, stepId, area, {
    sectionId: `${stepId}-${phase}-error`,
    title: phase === "parse" ? "解析错误" : phase === "validation" ? "校验错误" : "错误",
    sourceKind: phase === "input_assembly" ? "local_input_builder" : "validation",
    sourceLabel: phase,
    value: {
      phase: debugError.phase,
      origin: debugError.origin,
      kind: debugError.kind,
      category: debugError.category,
      message: debugError.message,
      name: debugError.name,
    },
  })
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "section"
}
