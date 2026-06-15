import type { SubmittedAction } from "./types"

export type RpgRuntimeDebugTraceStatus = "running" | "succeeded" | "failed" | "aborted"

export type RpgRuntimeDebugStepStatus =
  | "pending"
  | "running"
  | "streaming"
  | "parsing"
  | "validating"
  | "succeeded"
  | "failed"
  | "skipped"
  | "aborted"

export type RpgRuntimeDebugStepKind = "llm_interaction" | "deterministic_validation" | "persistence"

export type RpgRuntimeDebugSectionSourceKind =
  | "fixed_prompt"
  | "player_input"
  | "wiki_file"
  | "runtime_handoff"
  | "llm_output"
  | "local_input_builder"
  | "local_result"
  | "validation"

export type RpgRuntimeDebugContentType = "text" | "json" | "markdown"
export type RpgRuntimeDebugTokenMethod = "mixed-char-estimate-v1"
export type RpgRuntimeDebugStepId =
  | "action_resolver"
  | "world_tick"
  | "recall_selector"
  | "outline_brief"
  | "story_outline_regenerator"
  | "narration_generator"
  | "runtime_update_proposal"
  | "runtime_update_validation"
  | "pending_update_persistence"

export type RpgRuntimeDebugSectionArea =
  | "inputSections"
  | "promptSections"
  | "rawOutput"
  | "parsedOutput"
  | "validationSections"
  | "handoffSections"

export type RpgRuntimeDebugErrorPhase =
  | "input_assembly"
  | "llm"
  | "parse"
  | "validation"
  | "persistence"
  | "unknown"

export type RpgRuntimeDebugErrorOrigin =
  | "json_extract"
  | "json_parse"
  | "draft_normalization"
  | "draft_compiler"
  | "canonical_validation"
  | "persistence_boundary"
  | "input_assembly"
  | "provider"
  | "unknown"

export type RpgRuntimeDebugErrorKind =
  | "json_extract_failed"
  | "malformed_json"
  | "loose_scalar_array"
  | "loose_single_object_array"
  | "null_optional_field"
  | "missing_semantic_field"
  | "invalid_semantic_enum"
  | "unsafe_knowledge_boundary"
  | "unknown_reference"
  | "forbidden_safety_key"
  | "forbidden_persistence_claim"
  | "forbidden_write_target"
  | "compiler_invariant_failed"
  | "canonical_validation_failed"
  | "provider_transport_failure"
  | "blocked_by_previous_failure"
  | "input_assembly_failed"
  | "unknown_failure"

export type RpgRuntimeDebugErrorCategory =
  | "mechanical_format"
  | "semantic_contract"
  | "safety"
  | "persistence"
  | "provider"
  | "unknown"

export interface RpgRuntimeDebugErrorClassification {
  phase: RpgRuntimeDebugErrorPhase
  origin: RpgRuntimeDebugErrorOrigin
  kind: RpgRuntimeDebugErrorKind
  category: RpgRuntimeDebugErrorCategory
}

export interface RpgRuntimeDebugError {
  message: string
  name?: string
  stack?: string
  phase?: RpgRuntimeDebugErrorPhase
  origin?: RpgRuntimeDebugErrorOrigin
  kind?: RpgRuntimeDebugErrorKind
  category?: RpgRuntimeDebugErrorCategory
}

export interface RpgRuntimeDebugSection {
  sectionId: string
  title: string
  sourceKind: RpgRuntimeDebugSectionSourceKind
  sourceLabel: string
  contentType: RpgRuntimeDebugContentType
  content: string
  chars: number
  estimatedTokens: number
  tokenMethod: RpgRuntimeDebugTokenMethod
}

export interface RpgRuntimeDebugLooseCoercion {
  message: string
  label?: string
  kind?: string
}

export interface RpgRuntimeDebugStep {
  stepId: RpgRuntimeDebugStepId
  label: string
  kind: RpgRuntimeDebugStepKind
  status: RpgRuntimeDebugStepStatus
  startedAt?: string
  endedAt?: string
  durationMs?: number
  sourceSummary?: string
  failureSummary?: string
  inputSections: RpgRuntimeDebugSection[]
  promptSections: RpgRuntimeDebugSection[]
  rawOutput?: RpgRuntimeDebugSection
  parsedOutput?: RpgRuntimeDebugSection
  validationSections: RpgRuntimeDebugSection[]
  handoffSections: RpgRuntimeDebugSection[]
  warnings: string[]
  formatRecoveryApplied: boolean
  localRepairOperations: string[]
  looseCoercions: RpgRuntimeDebugLooseCoercion[]
  repairRetryAttempted: boolean
  repairRetrySucceeded: boolean
  repairRetryFailureSummary?: string
  error?: RpgRuntimeDebugError
}

export interface RpgRuntimeDebugTrace {
  traceId: string
  turnId: string
  submittedActionId: string
  submittedActionText: string
  status: RpgRuntimeDebugTraceStatus
  startedAt: string
  endedAt?: string
  activeStepId?: RpgRuntimeDebugStepId
  steps: RpgRuntimeDebugStep[]
  warnings: string[]
  error?: RpgRuntimeDebugError
}

export interface RpgRuntimeDebugTraceState {
  currentTrace: RpgRuntimeDebugTrace | null
  lastTrace: RpgRuntimeDebugTrace | null
}

export type RpgRuntimeDebugTraceListener = (state: RpgRuntimeDebugTraceState) => void

export interface StartRpgRuntimeDebugTraceInput {
  submittedAction: SubmittedAction
  turnId?: string
  startedAt?: string
}

export interface CreateRpgRuntimeDebugSectionInput {
  sectionId: string
  title: string
  sourceKind: RpgRuntimeDebugSectionSourceKind
  sourceLabel: string
  contentType: RpgRuntimeDebugContentType
  content: string
}

export interface RpgRuntimeDebugTraceSink {
  subscribe(listener: RpgRuntimeDebugTraceListener): () => void
  getCurrentTrace(): RpgRuntimeDebugTrace | null
  getLastTrace(): RpgRuntimeDebugTrace | null
  clear(): void
  importState(state: RpgRuntimeDebugTraceState): void
  importTrace(trace: RpgRuntimeDebugTrace): void
  startTrace(input: StartRpgRuntimeDebugTraceInput): RpgRuntimeDebugTrace
  startStep(stepId: RpgRuntimeDebugStepId, sourceSummary?: string): void
  setStepStatus(stepId: RpgRuntimeDebugStepId, status: RpgRuntimeDebugStepStatus): void
  addStepSection(
    stepId: RpgRuntimeDebugStepId,
    area: RpgRuntimeDebugSectionArea,
    section: RpgRuntimeDebugSection,
  ): void
  addStepWarnings(stepId: RpgRuntimeDebugStepId, warnings: string[]): void
  recordStepLocalJsonRecovery(
    stepId: RpgRuntimeDebugStepId,
    recovery: { operations: readonly string[]; changed: boolean },
  ): void
  recordStepLooseCoercions(stepId: RpgRuntimeDebugStepId, warnings: readonly unknown[]): void
  recordStepRepairRetry(
    stepId: RpgRuntimeDebugStepId,
    retry: { attempted: boolean; succeeded: boolean; failureSummary?: string },
  ): void
  finishStep(stepId: RpgRuntimeDebugStepId, sourceSummary?: string): void
  skipStep(stepId: RpgRuntimeDebugStepId, reason: string): void
  failStep(stepId: RpgRuntimeDebugStepId, error: unknown, phase?: RpgRuntimeDebugErrorPhase): void
  finishTrace(status: RpgRuntimeDebugTraceStatus, error?: unknown): void
}

const MESSAGE_OVERHEAD = 4
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u

const STEP_DEFINITIONS: ReadonlyArray<{
  stepId: RpgRuntimeDebugStepId
  label: string
  kind: RpgRuntimeDebugStepKind
  sourceSummary: string
}> = [
  {
    stepId: "action_resolver",
    label: "行动裁定",
    kind: "llm_interaction",
    sourceSummary: "玩家行动、行动前 wiki 快照、规则和 runtime 引用。",
  },
  {
    stepId: "world_tick",
    label: "世界推进",
    kind: "llm_interaction",
    sourceSummary: "行动裁定结果，以及当前场景 / 世界 runtime 上下文。",
  },
  {
    stepId: "recall_selector",
    label: "资料回想选择器",
    kind: "llm_interaction",
    sourceSummary: "行动后状态与用于 wiki recall 的检索索引。",
  },
  {
    stepId: "outline_brief",
    label: "大纲摘要",
    kind: "llm_interaction",
    sourceSummary: "Runtime handoff、recalled materials 与大纲控制边界。",
  },
  {
    stepId: "story_outline_regenerator",
    label: "故事大纲再生成器",
    kind: "llm_interaction",
    sourceSummary: "可选的大纲重大影响再生成 handoff。",
  },
  {
    stepId: "narration_generator",
    label: "叙事生成器",
    kind: "llm_interaction",
    sourceSummary: "行动后状态、recall、大纲摘要以及可选的 provisional handoff。",
  },
  {
    stepId: "runtime_update_proposal",
    label: "Runtime 更新提案",
    kind: "llm_interaction",
    sourceSummary: "把完成的回合记录转换为 wiki 更新提案。",
  },
  {
    stepId: "runtime_update_validation",
    label: "Runtime 更新校验",
    kind: "deterministic_validation",
    sourceSummary: "对 runtime wiki 更新提案进行确定性校验。",
  },
  {
    stepId: "pending_update_persistence",
    label: "待处理更新暂存 / 持久化",
    kind: "persistence",
    sourceSummary: "已接受更新的暂存，以及 runtime 日志 / pending 队列持久化 handoff。",
  },
]

export const RPG_RUNTIME_DEBUG_STEP_DEFINITIONS = STEP_DEFINITIONS

export function estimatePromptTokens(text: string): {
  chars: number
  estimatedTokens: number
  method: RpgRuntimeDebugTokenMethod
} {
  const chars = Array.from(text).length
  let cjkChars = 0

  for (const char of Array.from(text)) {
    if (CJK_PATTERN.test(char)) cjkChars += 1
  }

  const nonCjkChars = chars - cjkChars
  return {
    chars,
    estimatedTokens: Math.ceil(cjkChars * 1.1 + nonCjkChars / 4 + MESSAGE_OVERHEAD),
    method: "mixed-char-estimate-v1",
  }
}

export function createRpgRuntimeDebugSection(
  input: CreateRpgRuntimeDebugSectionInput,
): RpgRuntimeDebugSection {
  const estimate = estimatePromptTokens(input.content)
  return {
    ...input,
    chars: estimate.chars,
    estimatedTokens: estimate.estimatedTokens,
    tokenMethod: estimate.method,
  }
}

export function createJsonRpgRuntimeDebugSection(
  input: Omit<CreateRpgRuntimeDebugSectionInput, "content" | "contentType"> & { value: unknown },
): RpgRuntimeDebugSection {
  return createRpgRuntimeDebugSection({
    ...input,
    contentType: "json",
    content: stringifyDebugJson(input.value),
  })
}

export function createRpgRuntimeDebugTraceStore(): RpgRuntimeDebugTraceSink {
  let currentTrace: RpgRuntimeDebugTrace | null = null
  let lastTrace: RpgRuntimeDebugTrace | null = null
  const listeners = new Set<RpgRuntimeDebugTraceListener>()

  function publish(): void {
    const state = {
      currentTrace: cloneTrace(currentTrace),
      lastTrace: cloneTrace(lastTrace),
    }
    for (const listener of listeners) listener(state)
  }

  function updateStep(
    stepId: RpgRuntimeDebugStepId,
    updater: (step: RpgRuntimeDebugStep, trace: RpgRuntimeDebugTrace) => void,
  ): void {
    if (!currentTrace) return
    const step = currentTrace.steps.find((entry) => entry.stepId === stepId)
    if (!step) return
    updater(step, currentTrace)
    publish()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      listener({
        currentTrace: cloneTrace(currentTrace),
        lastTrace: cloneTrace(lastTrace),
      })
      return () => {
        listeners.delete(listener)
      }
    },
    getCurrentTrace() {
      return cloneTrace(currentTrace)
    },
    getLastTrace() {
      return cloneTrace(lastTrace)
    },
    clear() {
      currentTrace = null
      lastTrace = null
      publish()
    },
    importState(state) {
      currentTrace = cloneTrace(state.currentTrace)
      lastTrace = cloneTrace(state.lastTrace)
      publish()
    },
    importTrace(trace) {
      currentTrace = null
      lastTrace = cloneTrace(trace)
      publish()
    },
    startTrace(input) {
      const startedAt = input.startedAt ?? new Date().toISOString()
      const turnId = input.turnId ?? input.submittedAction.id
      currentTrace = {
        traceId: `rpg-runtime-trace-${turnId}-${Date.now().toString(36)}`,
        turnId,
        submittedActionId: input.submittedAction.id,
        submittedActionText: input.submittedAction.text,
        status: "running",
        startedAt,
        steps: STEP_DEFINITIONS.map((definition) => ({
          stepId: definition.stepId,
          label: definition.label,
          kind: definition.kind,
          status: "pending",
          sourceSummary: definition.sourceSummary,
          inputSections: [],
          promptSections: [],
          validationSections: [],
          handoffSections: [],
          warnings: [],
          formatRecoveryApplied: false,
          localRepairOperations: [],
          looseCoercions: [],
          repairRetryAttempted: false,
          repairRetrySucceeded: false,
        })),
        warnings: [],
      }
      lastTrace = null
      publish()
      return cloneTrace(currentTrace)!
    },
    startStep(stepId, sourceSummary) {
      updateStep(stepId, (step, trace) => {
        const startedAt = new Date().toISOString()
        step.status = "running"
        step.startedAt = step.startedAt ?? startedAt
        step.endedAt = undefined
        step.durationMs = undefined
        step.error = undefined
        step.failureSummary = undefined
        if (sourceSummary) step.sourceSummary = sourceSummary
        trace.activeStepId = stepId
      })
    },
    setStepStatus(stepId, status) {
      updateStep(stepId, (step, trace) => {
        step.status = status
        if (!["running", "streaming", "parsing", "validating"].includes(status)) {
          trace.activeStepId = undefined
        } else {
          trace.activeStepId = stepId
        }
      })
    },
    addStepSection(stepId, area, section) {
      updateStep(stepId, (step) => {
        if (area === "rawOutput") {
          step.rawOutput = section
        } else if (area === "parsedOutput") {
          step.parsedOutput = section
        } else {
          step[area].push(section)
        }
      })
    },
    addStepWarnings(stepId, warnings) {
      if (warnings.length === 0) return
      updateStep(stepId, (step, trace) => {
        step.warnings = [...new Set([...step.warnings, ...warnings])]
        trace.warnings = [...new Set([...trace.warnings, ...warnings])]
      })
    },
    recordStepLocalJsonRecovery(stepId, recovery) {
      updateStep(stepId, (step) => {
        step.localRepairOperations = [...new Set([...step.localRepairOperations, ...recovery.operations])]
        if (recovery.changed || recovery.operations.length > 0) step.formatRecoveryApplied = true
      })
    },
    recordStepLooseCoercions(stepId, warnings) {
      const coercions = extractLooseCoercions(warnings)
      if (coercions.length === 0) return
      updateStep(stepId, (step) => {
        const existing = new Set(step.looseCoercions.map((coercion) => looseCoercionKey(coercion)))
        for (const coercion of coercions) {
          const key = looseCoercionKey(coercion)
          if (existing.has(key)) continue
          step.looseCoercions.push(coercion)
          existing.add(key)
        }
        step.formatRecoveryApplied = true
      })
    },
    recordStepRepairRetry(stepId, retry) {
      updateStep(stepId, (step) => {
        step.repairRetryAttempted = step.repairRetryAttempted || retry.attempted
        step.repairRetrySucceeded = step.repairRetrySucceeded || retry.succeeded
        if (retry.failureSummary) step.repairRetryFailureSummary = retry.failureSummary
        if (retry.succeeded) step.formatRecoveryApplied = true
      })
    },
    finishStep(stepId, sourceSummary) {
      updateStep(stepId, (step, trace) => {
        const endedAt = new Date().toISOString()
        step.status = "succeeded"
        step.endedAt = endedAt
        step.durationMs = computeDurationMs(step.startedAt, endedAt)
        if (sourceSummary) step.sourceSummary = sourceSummary
        if (trace.activeStepId === stepId) trace.activeStepId = undefined
      })
    },
    skipStep(stepId, reason) {
      updateStep(stepId, (step, trace) => {
        const endedAt = new Date().toISOString()
        step.status = "skipped"
        step.startedAt = step.startedAt ?? endedAt
        step.endedAt = endedAt
        step.durationMs = computeDurationMs(step.startedAt, endedAt)
        step.sourceSummary = reason
        if (trace.activeStepId === stepId) trace.activeStepId = undefined
      })
    },
    failStep(stepId, error, phase) {
      updateStep(stepId, (step, trace) => {
        const endedAt = new Date().toISOString()
        const debugError = toRpgRuntimeDebugError(error, phase)
        step.status = "failed"
        step.endedAt = endedAt
        step.durationMs = computeDurationMs(step.startedAt, endedAt)
        step.error = debugError
        step.failureSummary = debugError.message
        trace.status = "failed"
        trace.error = debugError
        if (trace.activeStepId === stepId) trace.activeStepId = undefined
      })
    },
    finishTrace(status, error) {
      if (!currentTrace) return
      const endedAt = new Date().toISOString()
      currentTrace.status = status
      currentTrace.endedAt = endedAt
      currentTrace.activeStepId = undefined
      if (error) currentTrace.error = toRpgRuntimeDebugError(error)
      lastTrace = cloneTrace(currentTrace)
      currentTrace = null
      publish()
    },
  }
}

export function toRpgRuntimeDebugError(
  error: unknown,
  phase: RpgRuntimeDebugErrorPhase = "unknown",
): RpgRuntimeDebugError {
  const classification = classifyRpgRuntimeDebugError(error, phase)
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...classification,
    }
  }

  return {
    message: String(error),
    ...classification,
  }
}

export function classifyRpgRuntimeDebugErrorPhase(error: unknown): RpgRuntimeDebugErrorPhase {
  return classifyRpgRuntimeDebugError(error).phase
}

export function classifyRpgRuntimeDebugError(
  error: unknown,
  phaseOverride: RpgRuntimeDebugErrorPhase = "unknown",
): RpgRuntimeDebugErrorClassification {
  const message = error instanceof Error ? error.message : String(error)
  const phase = phaseOverride === "unknown" ? inferRpgRuntimeDebugErrorPhase(message) : phaseOverride
  const kind = classifyRpgRuntimeDebugErrorKind(message, phase)
  return {
    phase,
    kind,
    origin: classifyRpgRuntimeDebugErrorOrigin(message, phase, kind),
    category: classifyRpgRuntimeDebugErrorCategory(kind, phase),
  }
}

function inferRpgRuntimeDebugErrorPhase(message: string): RpgRuntimeDebugErrorPhase {
  if (/\b(?:parse|parser|parsing)\b|json|could not find a json|empty llm output|bare json|fenced json|无法.*json|解析.*json/i.test(message)) return "parse"
  if (/persist|pending|write policy|targetPath|target path|forbidden write|stable\/base|control\/source/i.test(message)) return "persistence"
  if (/invalid|validation|expected|required|unsupported|forbidden|must |必须|缺少|无效/i.test(message)) return "validation"
  if (/stream|llm|provider|transport/i.test(message)) return "llm"
  return "unknown"
}

function classifyRpgRuntimeDebugErrorKind(
  message: string,
  phase: RpgRuntimeDebugErrorPhase,
): RpgRuntimeDebugErrorKind {
  if (/blocked_by_previous_failure|blocked by previous failure/i.test(message)) return "blocked_by_previous_failure"
  if (phase === "input_assembly") return "input_assembly_failed"
  if (phase === "llm") return "provider_transport_failure"

  if (/无法.*JSON.*对象|could not find a json|no json object|empty llm output|收到空的 LLM 输出/i.test(message)) {
    return "json_extract_failed"
  }
  if (phase === "parse" || /解析.*JSON.*失败|malformed json|unexpected token|bad control character/i.test(message)) {
    return "malformed_json"
  }

  if (/forbidden safety key|dangerous safety key/i.test(message)) return "forbidden_safety_key"
  if (/must be an array[^.。]*(?:null)|null[^.。]*must be an array|received null/i.test(message)) return "null_optional_field"
  if (/must be an array[^.。]*(?:object|single object)|single object[^.。]*array|received object/i.test(message)) {
    return "loose_single_object_array"
  }
  if (/must be an array|must be an array when provided/i.test(message)) return "loose_scalar_array"

  if (/unsafe knowledge|knowledge boundary|knowledge leak|must not reveal|GM-only prose leak|player-facing hidden/i.test(message)) {
    return "unsafe_knowledge_boundary"
  }
  if (/unknown reference|unknown .*ref|not in .*allowlist|unrecognized .*ref/i.test(message)) return "unknown_reference"
  if (/forbidden write target|target path policy|targetPath policy|stable\/base|control\/source|outside wiki|wildcard target/i.test(message)) {
    return "forbidden_write_target"
  }
  if (/forbidden persistence|persistence claim|future as confirmed|option-only|confirmed event from option/i.test(message)) {
    return "forbidden_persistence_claim"
  }
  if (/must be one of|unsupported .*value|invalid .*enum|invalid .*status|happenedStatus|visibilityScope|knowledgeScope|riskLevel|intent/i.test(message)) {
    return "invalid_semantic_enum"
  }
  if (/required|missing|must be a non-empty string|must be a string|expected .*string|缺少/i.test(message)) {
    return "missing_semantic_field"
  }
  if (/compile|compiler|invariant/i.test(message)) return "compiler_invariant_failed"
  if (phase === "persistence") return "forbidden_persistence_claim"
  if (phase === "validation") return "canonical_validation_failed"
  return "unknown_failure"
}

function classifyRpgRuntimeDebugErrorOrigin(
  message: string,
  phase: RpgRuntimeDebugErrorPhase,
  kind: RpgRuntimeDebugErrorKind,
): RpgRuntimeDebugErrorOrigin {
  if (kind === "json_extract_failed") return "json_extract"
  if (kind === "malformed_json") return "json_parse"
  if (kind === "loose_scalar_array" || kind === "loose_single_object_array" || kind === "null_optional_field") {
    return "draft_normalization"
  }
  if (kind === "provider_transport_failure") return "provider"
  if (kind === "input_assembly_failed") return "input_assembly"
  if (kind === "forbidden_write_target" || kind === "forbidden_persistence_claim" || phase === "persistence") {
    return "persistence_boundary"
  }
  if (/Draft|draft/i.test(message) || kind === "forbidden_safety_key" || kind === "compiler_invariant_failed") {
    return "draft_compiler"
  }
  if (phase === "validation") return "canonical_validation"
  return "unknown"
}

function classifyRpgRuntimeDebugErrorCategory(
  kind: RpgRuntimeDebugErrorKind,
  phase: RpgRuntimeDebugErrorPhase,
): RpgRuntimeDebugErrorCategory {
  if (
    kind === "json_extract_failed"
    || kind === "malformed_json"
    || kind === "loose_scalar_array"
    || kind === "loose_single_object_array"
    || kind === "null_optional_field"
  ) return "mechanical_format"
  if (
    kind === "forbidden_safety_key"
    || kind === "unsafe_knowledge_boundary"
  ) return "safety"
  if (
    kind === "forbidden_persistence_claim"
    || kind === "forbidden_write_target"
    || phase === "persistence"
  ) return "persistence"
  if (kind === "provider_transport_failure") return "provider"
  if (
    kind === "missing_semantic_field"
    || kind === "invalid_semantic_enum"
    || kind === "unknown_reference"
    || kind === "compiler_invariant_failed"
    || kind === "canonical_validation_failed"
  ) return "semantic_contract"
  return "unknown"
}

export function stringifyDebugJson(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, entry) => {
      if (entry && typeof entry === "object") {
        if (seen.has(entry)) return "[Circular]"
        seen.add(entry)
      }
      return entry
    },
    2,
  )
}

function extractLooseCoercions(warnings: readonly unknown[]): RpgRuntimeDebugLooseCoercion[] {
  return warnings
    .map((warning) => {
      if (typeof warning === "string") return parseLooseCoercionMessage(warning)
      if (!warning || typeof warning !== "object") return undefined
      const record = warning as Record<string, unknown>
      if (record.code !== "loose_draft_coercion") return undefined
      const message = typeof record.message === "string" ? record.message : ""
      if (!message) return undefined
      return {
        message,
        ...optionalStringProperty(record, "label"),
        ...optionalStringProperty(record, "kind"),
        ...parseLooseCoercionLabel(message),
      }
    })
    .filter((entry): entry is RpgRuntimeDebugLooseCoercion => Boolean(entry))
}

function parseLooseCoercionMessage(message: string): RpgRuntimeDebugLooseCoercion | undefined {
  const prefix = "loose_draft_coercion:"
  if (!message.startsWith(prefix)) return undefined
  const parsedMessage = message.slice(prefix.length).trim()
  if (!parsedMessage) return undefined
  return {
    message: parsedMessage,
    ...parseLooseCoercionLabel(parsedMessage),
  }
}

function parseLooseCoercionLabel(message: string): Pick<RpgRuntimeDebugLooseCoercion, "label"> {
  const match = /^([^:]+):\s/.exec(message)
  return match ? { label: match[1] } : {}
}

function optionalStringProperty(
  record: Record<string, unknown>,
  key: "label" | "kind",
): Pick<RpgRuntimeDebugLooseCoercion, "label" | "kind"> {
  const value = record[key]
  return typeof value === "string" && value.trim() ? { [key]: value.trim() } : {}
}

function looseCoercionKey(coercion: RpgRuntimeDebugLooseCoercion): string {
  return [coercion.kind ?? "", coercion.label ?? "", coercion.message].join("|")
}

function computeDurationMs(startedAt: string | undefined, endedAt: string): number | undefined {
  if (!startedAt) return undefined
  const duration = Date.parse(endedAt) - Date.parse(startedAt)
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined
}

function cloneTrace(trace: RpgRuntimeDebugTrace | null): RpgRuntimeDebugTrace | null {
  if (!trace) return null
  return {
    ...trace,
    warnings: [...trace.warnings],
    error: trace.error ? { ...trace.error } : undefined,
    steps: trace.steps.map((step) => ({
      ...step,
      inputSections: step.inputSections.map((section) => ({ ...section })),
      promptSections: step.promptSections.map((section) => ({ ...section })),
      rawOutput: step.rawOutput ? { ...step.rawOutput } : undefined,
      parsedOutput: step.parsedOutput ? { ...step.parsedOutput } : undefined,
      validationSections: step.validationSections.map((section) => ({ ...section })),
      handoffSections: step.handoffSections.map((section) => ({ ...section })),
      warnings: [...step.warnings],
      formatRecoveryApplied: step.formatRecoveryApplied ?? false,
      localRepairOperations: [...(step.localRepairOperations ?? [])],
      looseCoercions: (step.looseCoercions ?? []).map((coercion) => ({ ...coercion })),
      repairRetryAttempted: step.repairRetryAttempted ?? false,
      repairRetrySucceeded: step.repairRetrySucceeded ?? false,
      repairRetryFailureSummary: step.repairRetryFailureSummary,
      error: step.error ? { ...step.error } : undefined,
    })),
  }
}
