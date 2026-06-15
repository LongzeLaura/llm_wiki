import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import type { LlmConfig } from "@/stores/wiki-store"
import type { RpgRuntimeDebugTraceSink, RpgRuntimeDebugTraceState } from "./debug-trace"
import type { RunRpgRuntimeTurnFlowResult } from "./runtime-controller"
import type { SoftSemanticRepairRetryRuntimeOptions } from "./turn-orchestrator"
import type { SubmittedAction } from "./types"

export interface RunRpgRuntimeTurnFlowClientInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  llmConfig: LlmConfig
  debugTraceSink?: RpgRuntimeDebugTraceSink
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

export interface RpgRuntimeTraceEvent {
  runId: string
  sequence: number
  state: RpgRuntimeDebugTraceState
}

export async function runRpgRuntimeTurnFlowClient(
  input: RunRpgRuntimeTurnFlowClientInput,
): Promise<RunRpgRuntimeTurnFlowResult> {
  const runId = createRpgRuntimeRunId()
  let unlistenTrace: UnlistenFn | undefined

  try {
    if (input.debugTraceSink) {
      unlistenTrace = await listen<RpgRuntimeTraceEvent>(getRpgRuntimeTraceEventTopic(runId), (event) => {
        if (event.payload?.runId !== runId) return
        input.debugTraceSink?.importState(event.payload.state)
      })
    }

    const response = await invoke<RpgRuntimeWorkerResponse>("rpg_runtime_run_turn", {
      runId,
      projectPath: input.projectPath,
      llmConfig: input.llmConfig,
      submittedAction: input.submittedAction,
      softSemanticRepairRetry: input.softSemanticRepairRetry,
    })

    if (!response.ok) {
      throw workerErrorToError(response.error)
    }

    return response.result
  } finally {
    unlistenTrace?.()
  }
}

function workerErrorToError(error: RpgRuntimeWorkerError): Error {
  const result = new Error(error.message)
  result.name = error.name ?? "RpgRuntimeWorkerError"
  if (error.stack) result.stack = error.stack
  return result
}

function createRpgRuntimeRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getRpgRuntimeTraceEventTopic(runId: string): string {
  return `rpg-runtime:${runId}:trace`
}
