import { describe, expect, it, vi } from "vitest"
import { createRpgRuntimeDebugTraceStore } from "../debug-trace"
import type { RunRpgRuntimeTurnFlowInput, RunRpgRuntimeTurnFlowResult } from "../runtime-controller"
import { runRpgRuntimeWorker, type RpgRuntimeWorkerInput, type RpgRuntimeWorkerTraceEvent } from "./run-turn-worker"

describe("runRpgRuntimeWorker", () => {
  it("runs the TS runtime flow and persists pending updates from Node", async () => {
    const runtimeResult = sampleRuntimeResult()
    const runTurnFlow = vi.fn(async () => runtimeResult)
    const savePendingUpdates = vi.fn(async () => ({ warnings: ["save warning"] }))
    const appendTurnJournalEntry = vi.fn(async () => ({ warnings: [] }))
    const traceEvents: RpgRuntimeWorkerTraceEvent[] = []

    const response = await runRpgRuntimeWorker(sampleWorkerInput(), {
      runTurnFlow,
      savePendingUpdates,
      appendTurnJournalEntry,
      createDebugTraceStore: createRpgRuntimeDebugTraceStore,
      emitTraceEvent: (event) => traceEvents.push(event),
    })

    expect(response.ok).toBe(true)
    if (!response.ok) throw new Error("expected success")
    expect(runTurnFlow).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction: sampleWorkerInput().submittedAction,
      runtimePersistence: {
        appendTurnJournalEntry,
      },
    }))
    expect(savePendingUpdates).toHaveBeenCalledWith("C:/tmp/rpg-project", runtimeResult.pendingUpdates)
    expect(response.result.warnings).toContain("save warning")
    expect("debugTrace" in response).toBe(false)
    const finalTrace = traceEvents[traceEvents.length - 1]?.state.lastTrace
    expect(traceEvents[0]).toMatchObject({ runId: "run-1", sequence: 1 })
    expect(traceEvents[0]?.state.currentTrace?.status).toBe("running")
    expect(finalTrace?.status).toBe("succeeded")
    expect(
      finalTrace?.steps.find((step) => step.stepId === "pending_update_persistence")?.handoffSections
        .some((section) => section.sectionId === "pending-update-queue-save"),
    ).toBe(true)
  })

  it("returns structured errors and failed traces", async () => {
    const runTurnFlow = vi.fn(async (input: RunRpgRuntimeTurnFlowInput) => {
      const error = new Error("model failed")
      input.debugTraceSink?.startStep("action_resolver")
      input.debugTraceSink?.failStep("action_resolver", error, "llm")
      throw error
    })
    const traceEvents: RpgRuntimeWorkerTraceEvent[] = []

    const response = await runRpgRuntimeWorker(sampleWorkerInput(), {
      runTurnFlow,
      savePendingUpdates: vi.fn(async () => ({ warnings: [] })),
      appendTurnJournalEntry: vi.fn(async () => ({ warnings: [] })),
      createDebugTraceStore: createRpgRuntimeDebugTraceStore,
      emitTraceEvent: (event) => traceEvents.push(event),
    })

    expect(response.ok).toBe(false)
    if (response.ok) throw new Error("expected failure")
    expect(response.error.message).toBe("model failed")
    const failedTrace = traceEvents[traceEvents.length - 1]?.state.lastTrace
    expect(failedTrace?.status).toBe("failed")
    expect(failedTrace?.steps.find((step) => step.stepId === "action_resolver")?.status).toBe("failed")
  })

  it("rejects frontend-only CLI providers in the Node worker stage", async () => {
    const traceEvents: RpgRuntimeWorkerTraceEvent[] = []
    const response = await runRpgRuntimeWorker({
      ...sampleWorkerInput(),
      llmConfig: {
        ...sampleWorkerInput().llmConfig,
        provider: "codex-cli",
      },
    }, {
      emitTraceEvent: (event) => traceEvents.push(event),
    })

    expect(response.ok).toBe(false)
    if (response.ok) throw new Error("expected failure")
    expect(response.error.message).toContain("does not support the codex-cli provider")
    const failedTrace = traceEvents[traceEvents.length - 1]?.state.lastTrace
    expect(failedTrace?.status).toBe("failed")
    expect(failedTrace?.steps.find((step) => step.stepId === "action_resolver")?.status).toBe("failed")
  })
})

function sampleWorkerInput(): RpgRuntimeWorkerInput {
  return {
    runId: "run-1",
    projectPath: "C:/tmp/rpg-project",
    llmConfig: {
      provider: "openai",
      apiKey: "test-key",
      model: "test-model",
      ollamaUrl: "",
      customEndpoint: "",
      maxContextSize: 10000,
    },
    submittedAction: {
      id: "action-1",
      text: "Look around.",
      source: "freeform",
    },
  }
}

function sampleRuntimeResult(): RunRpgRuntimeTurnFlowResult {
  return {
    pendingUpdates: [
      {
        id: "update-scene",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Refresh scene.",
        content: "# Scene",
        sourceTurnId: "action-1",
        references: ["wiki/current-scene/scene_state.md"],
        status: "pending",
      },
    ],
    warnings: ["runtime warning"],
    turnResult: {
      narrative: "You look around.",
      nextActionOptions: [],
      references: [],
    },
  } as unknown as RunRpgRuntimeTurnFlowResult
}
