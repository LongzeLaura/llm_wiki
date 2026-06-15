import type {
  RpgRuntimeDebugSection,
  RpgRuntimeDebugStep,
  RpgRuntimeDebugStepId,
  RpgRuntimeDebugTrace,
} from "./debug-trace"

export type RpgRuntimeFormattingAuditMeasurementKind = "real" | "synthetic"

export type RpgRuntimeFormattingAuditStepState =
  | "executed"
  | "failed"
  | "blocked_by_previous_failure"
  | "unknown_real_model_cost"
  | "synthetic"

export type RpgRuntimeFormattingFailureFrontier =
  | "input_assembly_failure"
  | "provider_transport_failure"
  | "mechanical_format_failure"
  | "parse_failure"
  | "draft_validation_failure"
  | "compiler_failure"
  | "canonical_validation_failure"
  | "write_safety_failure"
  | "persistence_failure"
  | "unknown_failure"

export interface RpgRuntimeFormattingAuditSectionSummary {
  sectionId: string
  title: string
  sourceKind: RpgRuntimeDebugSection["sourceKind"]
  sourceLabel: string
  chars: number
  estimatedTokens: number
}

export interface RpgRuntimeFormattingAuditAreaTotals {
  inputAssemblyChars: number
  promptChars: number
  rawOutputChars: number
  parsedOutputChars: number
  validationChars: number
  handoffChars: number
  totalRecordedChars: number
}

export interface RpgRuntimeFormatRecoverySummary {
  formatRecoveryApplied: boolean
  localRepairOperations: string[]
  looseCoercionCount: number
  looseCoercions: RpgRuntimeDebugStep["looseCoercions"]
  repairRetryAttempted: boolean
  repairRetrySucceeded: boolean
  repairRetryFailureSummary?: string
}

export interface RpgRuntimeFormatRecoveryMetricsRow {
  stepId: RpgRuntimeDebugStepId
  label: string
  traceCount: number
  formatRecoveryAppliedCount: number
  localRepairOperationCount: number
  looseCoercionCount: number
  repairRetryAttemptedCount: number
  repairRetrySucceededCount: number
  repairRetryFailedCount: number
}

export interface RpgRuntimeFormattingAuditRow {
  traceId: string
  measurementKind: RpgRuntimeFormattingAuditMeasurementKind
  stepId: RpgRuntimeDebugStepId
  label: string
  status: RpgRuntimeDebugStep["status"]
  state: RpgRuntimeFormattingAuditStepState
  areaTotals: RpgRuntimeFormattingAuditAreaTotals
  topPromptSections: RpgRuntimeFormattingAuditSectionSummary[]
  topInputAssemblyContributors: RpgRuntimeFormattingAuditSectionSummary[]
  formatRecovery: RpgRuntimeFormatRecoverySummary
  failureFrontier?: RpgRuntimeFormattingFailureFrontier
  failureSummary?: string
  warnings: string[]
}

export interface RpgRuntimeFormattingAuditReport {
  runtimeFormattingAudit: RpgRuntimeFormattingAuditRow[]
  formatRecoveryMetrics: RpgRuntimeFormatRecoveryMetricsRow[]
  realTraceId?: string
  syntheticTraceId?: string
  notes: string[]
}

export interface BuildRuntimeFormattingAuditReportInput {
  realTrace?: RpgRuntimeDebugTrace | null
  syntheticTrace?: RpgRuntimeDebugTrace | null
  topContributorLimit?: number
}

export function buildRuntimeFormattingAuditReport(
  input: BuildRuntimeFormattingAuditReportInput,
): RpgRuntimeFormattingAuditReport {
  const topContributorLimit = input.topContributorLimit ?? 5
  const rows: RpgRuntimeFormattingAuditRow[] = []

  if (input.realTrace) {
    rows.push(...buildTraceRows(input.realTrace, "real", topContributorLimit))
  }

  if (input.syntheticTrace) {
    rows.push(...buildTraceRows(input.syntheticTrace, "synthetic", topContributorLimit))
  }

  const notes = [
    "Real rows are derived from debug trace sections already recorded by the runtime.",
    "Synthetic rows measure local prompt/input/handoff assembly structure only and must not be treated as real model behavior.",
  ]

  if (input.realTrace?.status === "failed") {
    notes.push("Pending real rows after the failed step are marked blocked_by_previous_failure or unknown_real_model_cost.")
  }

  return {
    runtimeFormattingAudit: rows,
    formatRecoveryMetrics: buildFormatRecoveryMetrics(rows),
    realTraceId: input.realTrace?.traceId,
    syntheticTraceId: input.syntheticTrace?.traceId,
    notes,
  }
}

function buildTraceRows(
  trace: RpgRuntimeDebugTrace,
  measurementKind: RpgRuntimeFormattingAuditMeasurementKind,
  topContributorLimit: number,
): RpgRuntimeFormattingAuditRow[] {
  let encounteredFailure = false

  return trace.steps.map((step) => {
    const state = measurementKind === "synthetic"
      ? "synthetic"
      : classifyRealStepState(step, encounteredFailure)
    const failureFrontier = step.status === "failed" ? classifyFailureFrontier(step) : undefined
    if (step.status === "failed") encounteredFailure = true

    return {
      traceId: trace.traceId,
      measurementKind,
      stepId: step.stepId,
      label: step.label,
      status: step.status,
      state,
      areaTotals: computeAreaTotals(step),
      topPromptSections: topSections(step.promptSections, topContributorLimit),
      topInputAssemblyContributors: topSections(step.inputSections, topContributorLimit),
      formatRecovery: summarizeFormatRecovery(step),
      failureFrontier,
      failureSummary: step.failureSummary ?? step.error?.message,
      warnings: [...step.warnings],
    }
  })
}

function summarizeFormatRecovery(step: RpgRuntimeDebugStep): RpgRuntimeFormatRecoverySummary {
  return {
    formatRecoveryApplied: step.formatRecoveryApplied ?? false,
    localRepairOperations: [...(step.localRepairOperations ?? [])],
    looseCoercionCount: step.looseCoercions?.length ?? 0,
    looseCoercions: (step.looseCoercions ?? []).map((coercion) => ({ ...coercion })),
    repairRetryAttempted: step.repairRetryAttempted ?? false,
    repairRetrySucceeded: step.repairRetrySucceeded ?? false,
    repairRetryFailureSummary: step.repairRetryFailureSummary,
  }
}

function buildFormatRecoveryMetrics(
  rows: readonly RpgRuntimeFormattingAuditRow[],
): RpgRuntimeFormatRecoveryMetricsRow[] {
  const byStep = new Map<RpgRuntimeDebugStepId, RpgRuntimeFormatRecoveryMetricsRow>()

  for (const row of rows) {
    let metrics = byStep.get(row.stepId)
    if (!metrics) {
      metrics = {
        stepId: row.stepId,
        label: row.label,
        traceCount: 0,
        formatRecoveryAppliedCount: 0,
        localRepairOperationCount: 0,
        looseCoercionCount: 0,
        repairRetryAttemptedCount: 0,
        repairRetrySucceededCount: 0,
        repairRetryFailedCount: 0,
      }
      byStep.set(row.stepId, metrics)
    }

    metrics.traceCount += 1
    if (row.formatRecovery.formatRecoveryApplied) metrics.formatRecoveryAppliedCount += 1
    metrics.localRepairOperationCount += row.formatRecovery.localRepairOperations.length
    metrics.looseCoercionCount += row.formatRecovery.looseCoercionCount
    if (row.formatRecovery.repairRetryAttempted) metrics.repairRetryAttemptedCount += 1
    if (row.formatRecovery.repairRetrySucceeded) metrics.repairRetrySucceededCount += 1
    if (row.formatRecovery.repairRetryAttempted && !row.formatRecovery.repairRetrySucceeded) {
      metrics.repairRetryFailedCount += 1
    }
  }

  return [...byStep.values()]
}

function classifyRealStepState(
  step: RpgRuntimeDebugStep,
  encounteredFailure: boolean,
): RpgRuntimeFormattingAuditStepState {
  if (step.status === "failed") return "failed"
  if (step.status === "pending") {
    return encounteredFailure ? "blocked_by_previous_failure" : "unknown_real_model_cost"
  }
  return "executed"
}

function computeAreaTotals(step: RpgRuntimeDebugStep): RpgRuntimeFormattingAuditAreaTotals {
  const inputAssemblyChars = sumChars(step.inputSections)
  const promptChars = sumChars(step.promptSections)
  const rawOutputChars = step.rawOutput?.chars ?? 0
  const parsedOutputChars = step.parsedOutput?.chars ?? 0
  const validationChars = sumChars(step.validationSections)
  const handoffChars = sumChars(step.handoffSections)

  return {
    inputAssemblyChars,
    promptChars,
    rawOutputChars,
    parsedOutputChars,
    validationChars,
    handoffChars,
    totalRecordedChars:
      inputAssemblyChars + promptChars + rawOutputChars + parsedOutputChars + validationChars + handoffChars,
  }
}

function topSections(
  sections: readonly RpgRuntimeDebugSection[],
  limit: number,
): RpgRuntimeFormattingAuditSectionSummary[] {
  return [...sections]
    .sort((a, b) => b.chars - a.chars || a.sectionId.localeCompare(b.sectionId))
    .slice(0, limit)
    .map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      sourceKind: section.sourceKind,
      sourceLabel: section.sourceLabel,
      chars: section.chars,
      estimatedTokens: section.estimatedTokens,
    }))
}

function sumChars(sections: readonly RpgRuntimeDebugSection[]): number {
  return sections.reduce((total, section) => total + section.chars, 0)
}

function classifyFailureFrontier(step: RpgRuntimeDebugStep): RpgRuntimeFormattingFailureFrontier {
  const phase = step.error?.phase
  const kind = step.error?.kind
  const category = step.error?.category
  const message = [
    step.failureSummary,
    step.error?.message,
    ...step.validationSections.map((section) => section.content),
  ].filter(Boolean).join("\n")

  if (phase === "input_assembly") return "input_assembly_failure"
  if (phase === "llm") return "provider_transport_failure"
  if (
    category === "mechanical_format"
    || kind === "json_extract_failed"
    || kind === "malformed_json"
    || kind === "loose_scalar_array"
    || kind === "loose_single_object_array"
    || kind === "null_optional_field"
  ) return "mechanical_format_failure"
  if (phase === "parse") return "parse_failure"
  if (phase === "persistence") return "persistence_failure"

  if (/draft/i.test(message) && /invalid|validation|required|missing|must/i.test(message)) {
    return "draft_validation_failure"
  }
  if (/compile|compiler|invariant/i.test(message)) return "compiler_failure"
  if (step.kind === "persistence") return "persistence_failure"
  if (step.kind === "deterministic_validation" || /write policy|targetPath|forbidden write|wiki write|stable\/base|control\/source/i.test(message)) {
    return "write_safety_failure"
  }
  if (phase === "validation") return "canonical_validation_failure"

  return "unknown_failure"
}
