import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { createRpgRuntimeDebugTraceStore, type RpgRuntimeDebugTrace } from "./debug-trace"
import {
  runRpgRuntimeTurnFlowClient,
  type RpgRuntimeTraceEvent,
  type RpgRuntimeWorkerResponse,
} from "./runtime-controller-client"
import type { RunRpgRuntimeTurnFlowResult } from "./runtime-controller"
import type { SubmittedAction } from "./types"

const listeners: Record<string, (event: { payload: RpgRuntimeTraceEvent }) => void> = {}

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, cb: (event: { payload: RpgRuntimeTraceEvent }) => void) => {
    listeners[event] = cb
    return () => {
      delete listeners[event]
    }
  }),
}))

describe("runRpgRuntimeTurnFlowClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const event of Object.keys(listeners)) delete listeners[event]
  })

  it("listens for runtime trace events before invoking the Tauri RPG runtime command", async () => {
    const debugTraceSink = createRpgRuntimeDebugTraceStore()
    const response: RpgRuntimeWorkerResponse = {
      ok: true,
      result: sampleRuntimeResult(),
    }
    vi.mocked(invoke).mockImplementationOnce(async (_command, payload) => {
      expect(listen).toHaveBeenCalledTimes(1)
      const runId = (payload as { runId: string }).runId
      listeners[`rpg-runtime:${runId}:trace`]?.({
        payload: {
          runId,
          sequence: 1,
          state: {
            currentTrace: sampleTrace("trace-running", "running"),
            lastTrace: null,
          },
        },
      })
      expect(debugTraceSink.getCurrentTrace()?.traceId).toBe("trace-running")
      listeners[`rpg-runtime:${runId}:trace`]?.({
        payload: {
          runId,
          sequence: 2,
          state: {
            currentTrace: null,
            lastTrace: sampleTrace("trace-success", "succeeded"),
          },
        },
      })
      return response
    })

    const result = await runRpgRuntimeTurnFlowClient({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction: sampleSubmittedAction(),
      llmConfig: sampleLlmConfig(),
      debugTraceSink,
    })

    expect(invoke).toHaveBeenCalledWith("rpg_runtime_run_turn", {
      runId: expect.any(String),
      projectPath: "C:/tmp/rpg-project",
      llmConfig: sampleLlmConfig(),
      submittedAction: sampleSubmittedAction(),
      softSemanticRepairRetry: undefined,
    })
    expect(result.pendingUpdates).toEqual([])
    expect(debugTraceSink.getLastTrace()?.traceId).toBe("trace-success")
    expect(debugTraceSink.getCurrentTrace()).toBeNull()
  })

  it("keeps failed trace events before throwing worker errors", async () => {
    const debugTraceSink = createRpgRuntimeDebugTraceStore()
    const response: RpgRuntimeWorkerResponse = {
      ok: false,
      error: {
        name: "Error",
        message: "RPG runtime worker failed",
      },
    }
    vi.mocked(invoke).mockImplementationOnce(async (_command, payload) => {
      const runId = (payload as { runId: string }).runId
      listeners[`rpg-runtime:${runId}:trace`]?.({
        payload: {
          runId,
          sequence: 1,
          state: {
            currentTrace: null,
            lastTrace: sampleTrace("trace-failed", "failed"),
          },
        },
      })
      return response
    })

    await expect(runRpgRuntimeTurnFlowClient({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction: sampleSubmittedAction(),
      llmConfig: sampleLlmConfig(),
      debugTraceSink,
    })).rejects.toThrow("RPG runtime worker failed")

    expect(debugTraceSink.getLastTrace()?.traceId).toBe("trace-failed")
    expect(debugTraceSink.getLastTrace()?.status).toBe("failed")
  })
})

function sampleSubmittedAction(): SubmittedAction {
  return {
    id: "action-1",
    text: "Look around.",
    source: "freeform",
  }
}

function sampleLlmConfig() {
  return {
    provider: "openai" as const,
    apiKey: "test-key",
    model: "test-model",
    ollamaUrl: "",
    customEndpoint: "",
    maxContextSize: 10000,
  }
}

function sampleRuntimeResult(): RunRpgRuntimeTurnFlowResult {
  return {
    pendingUpdates: [],
    warnings: [],
    turnResult: {
      narrative: "You look around.",
      nextActionOptions: [],
      references: [],
    },
  } as unknown as RunRpgRuntimeTurnFlowResult
}

function sampleTrace(traceId: string, status: RpgRuntimeDebugTrace["status"]): RpgRuntimeDebugTrace {
  return {
    traceId,
    turnId: "action-1",
    submittedActionId: "action-1",
    submittedActionText: "Look around.",
    status,
    startedAt: "2026-06-13T00:00:00.000Z",
    endedAt: "2026-06-13T00:00:01.000Z",
    steps: [],
    warnings: [],
  }
}
