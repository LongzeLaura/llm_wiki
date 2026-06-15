import { pathToFileURL } from "node:url"
import {
  createLlmRpgActionResolverAdapter,
  createLlmRpgNarrationGeneratorAdapter,
  createLlmRpgOutlineBriefAdapter,
  createLlmRpgRecallSelectorAdapter,
  createLlmRpgRuntimeUpdateInteractionAdapter,
  createLlmRpgWorldTickAdapter,
} from "@/lib/rpg-interactions/runtime"
import type { LlmConfig } from "@/stores/wiki-store"
import {
  createJsonRpgRuntimeDebugSection,
  createRpgRuntimeDebugTraceStore,
  type RpgRuntimeDebugTraceSink,
  type RpgRuntimeDebugTraceState,
} from "../debug-trace"
import {
  appendRpgTurnJournalEntry,
  saveRpgPendingUpdates,
} from "../runtime-persistence"
import {
  runRpgRuntimeTurnFlow,
  type RunRpgRuntimeTurnFlowInput,
  type RunRpgRuntimeTurnFlowResult,
} from "../runtime-controller"
import type { SoftSemanticRepairRetryRuntimeOptions } from "../turn-orchestrator"
import type { SubmittedAction } from "../types"

export interface RpgRuntimeWorkerInput {
  runId: string
  projectPath: string
  llmConfig: LlmConfig
  submittedAction: SubmittedAction
  softSemanticRepairRetry?: SoftSemanticRepairRetryRuntimeOptions
}

export interface RpgRuntimeWorkerError {
  name?: string
  message: string
  stack?: string
}

export type RpgRuntimeWorkerResponse =
  | {
      ok: true
      result: RunRpgRuntimeTurnFlowResult
    }
  | {
      ok: false
      error: RpgRuntimeWorkerError
    }

export interface RpgRuntimeWorkerTraceEvent {
  runId: string
  sequence: number
  state: RpgRuntimeDebugTraceState
}

export interface RpgRuntimeWorkerDependencies {
  runTurnFlow: (input: RunRpgRuntimeTurnFlowInput) => Promise<RunRpgRuntimeTurnFlowResult>
  savePendingUpdates: typeof saveRpgPendingUpdates
  appendTurnJournalEntry: typeof appendRpgTurnJournalEntry
  createDebugTraceStore: typeof createRpgRuntimeDebugTraceStore
  emitTraceEvent: (event: RpgRuntimeWorkerTraceEvent) => void
}

export const RPG_RUNTIME_TRACE_EVENT_PREFIX = "__RPG_RUNTIME_TRACE_EVENT__"

const defaultDependencies: RpgRuntimeWorkerDependencies = {
  runTurnFlow: runRpgRuntimeTurnFlow,
  savePendingUpdates: saveRpgPendingUpdates,
  appendTurnJournalEntry: appendRpgTurnJournalEntry,
  createDebugTraceStore: createRpgRuntimeDebugTraceStore,
  emitTraceEvent: writeTraceEventToStderr,
}

export async function runRpgRuntimeWorker(
  input: RpgRuntimeWorkerInput,
  dependencies: Partial<RpgRuntimeWorkerDependencies> = {},
): Promise<RpgRuntimeWorkerResponse> {
  const deps = { ...defaultDependencies, ...dependencies }
  const debugTraceStore = deps.createDebugTraceStore()
  let unsubscribeTrace: (() => void) | undefined

  try {
    validateWorkerInput(input)
    unsubscribeTrace = subscribeTraceEvents(debugTraceStore, input.runId, deps.emitTraceEvent)
    debugTraceStore.startTrace({ submittedAction: input.submittedAction })
    assertSupportedWorkerProvider(input.llmConfig)

    const result = await deps.runTurnFlow({
      projectPath: input.projectPath,
      wikiMode: "llmwikirpg",
      submittedAction: input.submittedAction,
      actionResolverAdapter: createLlmRpgActionResolverAdapter({ llmConfig: input.llmConfig }),
      worldTickAdapter: createLlmRpgWorldTickAdapter({ llmConfig: input.llmConfig }),
      recallSelectorAdapter: createLlmRpgRecallSelectorAdapter({ llmConfig: input.llmConfig }),
      outlineBriefCompilerAdapter: createLlmRpgOutlineBriefAdapter({ llmConfig: input.llmConfig }),
      narrationAdapter: createLlmRpgNarrationGeneratorAdapter({ llmConfig: input.llmConfig }),
      updateInteractionAdapter: createLlmRpgRuntimeUpdateInteractionAdapter({ llmConfig: input.llmConfig }),
      runtimePersistence: {
        appendTurnJournalEntry: deps.appendTurnJournalEntry,
      },
      debugTraceSink: debugTraceStore,
      softSemanticRepairRetry: input.softSemanticRepairRetry,
    })

    const persistenceWarnings = await savePendingUpdatesWithTrace({
      projectPath: input.projectPath,
      result,
      debugTraceSink: debugTraceStore,
      savePendingUpdates: deps.savePendingUpdates,
    })
    const finalResult = {
      ...result,
      warnings: [...result.warnings, ...persistenceWarnings],
    }
    debugTraceStore.finishTrace("succeeded")

    return {
      ok: true,
      result: finalResult,
    }
  } catch (error) {
    const currentTrace = debugTraceStore.getCurrentTrace()
    if (currentTrace) {
      if (!currentTrace.steps.some((step) => step.status === "failed")) {
        debugTraceStore.failStep("action_resolver", error, "validation")
      }
      debugTraceStore.finishTrace("failed", error)
    }
    return {
      ok: false,
      error: toWorkerError(error),
    }
  } finally {
    unsubscribeTrace?.()
  }
}

async function savePendingUpdatesWithTrace(input: {
  projectPath: string
  result: RunRpgRuntimeTurnFlowResult
  debugTraceSink: RpgRuntimeDebugTraceSink
  savePendingUpdates: typeof saveRpgPendingUpdates
}): Promise<string[]> {
  try {
    const persistenceResult = await input.savePendingUpdates(input.projectPath, input.result.pendingUpdates)
    const warnings = persistenceResult.warnings ?? []
    input.debugTraceSink.addStepSection(
      "pending_update_persistence",
      "handoffSections",
      createJsonRpgRuntimeDebugSection({
        sectionId: "pending-update-queue-save",
        title: "交接 / 下一步输入",
        sourceKind: "runtime_handoff",
        sourceLabel: "saveRpgPendingUpdates",
        value: {
          pendingUpdateIds: input.result.pendingUpdates.map((update) => update.id),
          warnings,
        },
      }),
    )
    input.debugTraceSink.addStepWarnings("pending_update_persistence", warnings)
    return warnings
  } catch (error) {
    input.debugTraceSink.failStep("pending_update_persistence", error, "persistence")
    throw error
  }
}

function validateWorkerInput(input: RpgRuntimeWorkerInput): void {
  if (!input.runId?.trim()) throw new Error("runId is required.")
  if (!input.projectPath?.trim()) throw new Error("projectPath is required.")
  if (!input.submittedAction?.id?.trim()) throw new Error("submittedAction.id is required.")
  if (!input.submittedAction?.text?.trim()) throw new Error("submittedAction.text is required.")
  if (!input.llmConfig?.provider) throw new Error("llmConfig.provider is required.")
}

function assertSupportedWorkerProvider(llmConfig: LlmConfig): void {
  if (llmConfig.provider === "claude-code" || llmConfig.provider === "codex-cli") {
    throw new Error(
      `RPG runtime Node worker does not support the ${llmConfig.provider} provider yet. ` +
      "Use an HTTP/API provider for runtime turns, or add a Node-native CLI transport in a follow-up stage.",
    )
  }
}

function toWorkerError(error: unknown): RpgRuntimeWorkerError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function subscribeTraceEvents(
  debugTraceStore: RpgRuntimeDebugTraceSink,
  runId: string,
  emitTraceEvent: (event: RpgRuntimeWorkerTraceEvent) => void,
): () => void {
  let sequence = 0
  let skipInitialState = true
  return debugTraceStore.subscribe((state) => {
    if (skipInitialState) {
      skipInitialState = false
      return
    }
    sequence += 1
    emitTraceEvent({ runId, sequence, state })
  })
}

function writeTraceEventToStderr(event: RpgRuntimeWorkerTraceEvent): void {
  process.stderr.write(`${RPG_RUNTIME_TRACE_EVENT_PREFIX}${JSON.stringify(event)}\n`)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf-8")
}

async function main(): Promise<void> {
  const rawInput = await readStdin()
  const parsed = JSON.parse(rawInput) as RpgRuntimeWorkerInput
  const response = await runRpgRuntimeWorker(parsed)
  process.stdout.write(`${JSON.stringify(response)}\n`)
}

function isMainModule(): boolean {
  const entry = process.argv[1]
  return !!entry && import.meta.url === pathToFileURL(entry).href
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    const response: RpgRuntimeWorkerResponse = {
      ok: false,
      error: toWorkerError(error),
    }
    process.stdout.write(`${JSON.stringify(response)}\n`)
  })
}
