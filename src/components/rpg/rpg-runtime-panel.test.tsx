import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  RpgRuntimePanel,
  applyRpgRuntimePanelAcceptedUpdates,
  didApplyCurrentSceneOverwrite,
  getAppliedRpgUpdatePaths,
  loadRpgCurrentScene,
  loadRpgRuntimePanelPendingUpdates,
  saveCompletedRpgRuntimeDebugTrace,
  saveRpgRuntimePanelPendingUpdates,
  submitRpgRuntimePanelAction,
} from "@/components/rpg"
import * as writePolicy from "@/lib/rpg-runtime/write-policy"
import type { LlmConfig } from "@/stores/wiki-store"
import type { RunRpgRuntimeTurnFlowResult } from "@/lib/rpg-runtime/runtime-controller"
import type { SubmittedAction } from "@/lib/rpg-runtime/types"
import type { RpgRuntimeDebugTrace } from "@/lib/rpg-runtime/debug-trace"
import type { PendingRpgUpdate } from "@/lib/rpg-runtime/update-staging"
import * as updateStaging from "@/lib/rpg-runtime/update-staging"
import {
  sampleRecalledMaterials,
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
} from "@/lib/rpg-runtime-test-fixtures"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
  writeFileAtomic: vi.fn(),
  createDirectory: vi.fn(),
  fileExists: vi.fn(),
  listDirectory: vi.fn(),
}))

vi.mock("@/lib/rpg-runtime/write-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rpg-runtime/write-policy")>()
  return {
    ...actual,
    applyRpgPendingUpdates: vi.fn(actual.applyRpgPendingUpdates),
  }
})

vi.mock("@/lib/rpg-runtime/update-staging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rpg-runtime/update-staging")>()
  return {
    ...actual,
    acceptPendingRpgUpdate: vi.fn(actual.acceptPendingRpgUpdate),
    rejectPendingRpgUpdate: vi.fn(actual.rejectPendingRpgUpdate),
  }
})

describe("RpgRuntimePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports and renders the current scene in the runtime container", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "# Current Scene\n\nIven and Mira face the canal gate.",
        }}
      />,
    )

    expect(RpgRuntimePanel).toBeTypeOf("function")
    expect(html).toContain("RPG Runtime")
    expect(html).toContain("Iven and Mira face the canal gate.")
    expect(html).toContain("待处理更新：0")
    expect(html).toContain("待处理 RPG 更新")
  })

  it("loads current-scene from the RPG scene snapshot path", async () => {
    const readScene = vi.fn(async () => "# Current Scene\n\nThe lantern bridge is quiet.")

    const result = await loadRpgCurrentScene("C:/tmp/rpg-project", { readFile: readScene })

    expect(readScene).toHaveBeenCalledWith("C:/tmp/rpg-project/wiki/current-scene/scene_state.md")
    expect(result.currentScene).toContain("lantern bridge")
    expect(result.warnings).toEqual([])
  })

  it("returns a clear warning when the current-scene file is missing", async () => {
    const result = await loadRpgCurrentScene("C:/tmp/rpg-project", {
      readFile: vi.fn(async () => {
        throw new Error("missing")
      }),
    })

    expect(result.currentScene).toBe("")
    expect(result.warnings.join("\n")).toContain("缺少当前场景文件：wiki/current-scene/scene_state.md")
  })

  it("submits a freeform action through the backend runtime flow", async () => {
    const submittedAction: SubmittedAction = {
      id: "freeform-1",
      text: "Check the glowing sigil before opening the gate.",
      source: "freeform",
    }
    const runTurnFlow = vi.fn(async () => sampleRuntimeResult())

    const result = await submitRpgRuntimePanelAction({
      projectPath: "C:/tmp/rpg-project",
      llmConfig: sampleLlmConfig(),
      submittedAction,
      dependencies: {
        runTurnFlow,
      },
    })

    expect(runTurnFlow).toHaveBeenCalledWith({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction,
      llmConfig: sampleLlmConfig(),
    })
    expect(result.lastNarrative).toContain("Mira reads the sigil")
    expect(result.nextActionOptions.map((option) => option.playerFacingText)).toContain("Touch the lantern key to the sigil.")
    expect(result.pendingUpdates).toEqual(sampleRuntimeResult().pendingUpdates)
  })

  it("passes soft semantic repair retry options only when requested", async () => {
    const submittedAction: SubmittedAction = {
      id: "freeform-repair",
      text: "Check the glowing sigil before opening the gate.",
      source: "freeform",
    }
    const runTurnFlow = vi.fn(async () => sampleRuntimeResult())

    await submitRpgRuntimePanelAction({
      projectPath: "C:/tmp/rpg-project",
      llmConfig: sampleLlmConfig(),
      submittedAction,
      softSemanticRepairRetry: { enabled: true, maxAttempts: 1 },
      dependencies: {
        runTurnFlow,
      },
    })

    expect(runTurnFlow).toHaveBeenCalledWith({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction,
      llmConfig: sampleLlmConfig(),
      softSemanticRepairRetry: { enabled: true, maxAttempts: 1 },
    })
  })

  it("renders disabled controls while a turn is submitting", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "The patrol is close.",
          isSubmitting: true,
        }}
      />,
    )

    expect(html).toContain("正在执行回合……")
    expect(html).toContain("disabled")
  })

  it("renders runtime warnings", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "The scene is loaded.",
          warnings: ["Skipped RPG update block: targetPath is outside allowed runtime update paths."],
        }}
      />,
    )

    expect(html).toContain("Runtime 警告")
    expect(html).toContain("outside allowed runtime update paths")
  })

  it("passes pending updates to the review panel", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "The scene is loaded.",
          pendingUpdates: sampleRuntimeResult().pendingUpdates,
        }}
      />,
    )

    expect(html).toContain("待处理更新：1")
    expect(html).toContain("待处理 RPG 更新")
    expect(html).toContain("overwrite: wiki/current-scene/scene_state.md")
    expect(html).toContain("Refresh the current scene snapshot.")
    expect(html).toContain("The lantern key has answered the sigil.")
  })

  it("renders runtime errors clearly", () => {
    const html = renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "The scene is loaded.",
          runtimeError: "RPG runtime error: model output was empty",
        }}
      />,
    )

    expect(html).toContain("RPG runtime error: model output was empty")
  })

  it("does not apply pending updates during panel submission", async () => {
    await submitRpgRuntimePanelAction({
      projectPath: "C:/tmp/rpg-project",
      llmConfig: sampleLlmConfig(),
      submittedAction: {
        id: "freeform-2",
        text: "Wait and listen.",
        source: "freeform",
      },
      dependencies: {
        runTurnFlow: vi.fn(async () => sampleRuntimeResult()),
      },
    })

    expect(updateStaging.acceptPendingRpgUpdate).not.toHaveBeenCalled()
    expect(updateStaging.rejectPendingRpgUpdate).not.toHaveBeenCalled()
    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })

  it("applies only accepted pending updates through the write policy dependency", async () => {
    const acceptedScene = {
      ...sampleRuntimeResult().pendingUpdates[0],
      status: "accepted",
    } satisfies PendingRpgUpdate
    const acceptedSkipped = {
      ...sampleRuntimeResult().pendingUpdates[0],
      id: "update-skipped",
      targetPath: "wiki/world/basic_overview.md",
      status: "accepted",
    } satisfies PendingRpgUpdate
    const pendingEvent = {
      ...sampleRuntimeResult().pendingUpdates[0],
      id: "update-pending",
      targetPath: "wiki/events/pending.md",
      strategy: "append",
      status: "pending",
    } satisfies PendingRpgUpdate
    const rejectedPlayer = {
      ...sampleRuntimeResult().pendingUpdates[0],
      id: "update-rejected",
      targetPath: "wiki/player/player.md",
      strategy: "merge",
      status: "rejected",
    } satisfies PendingRpgUpdate

    vi.mocked(writePolicy.applyRpgPendingUpdates).mockResolvedValueOnce({
      appliedUpdates: [
        {
          id: "update-scene",
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite",
          status: "applied",
        },
      ],
      skippedUpdates: [
        {
          id: "update-skipped",
          targetPath: "wiki/world/basic_overview.md",
          reason: "targetPath is outside allowed runtime write paths.",
        },
      ],
      warnings: ["Skipped RPG pending update \"update-skipped\"."],
    })
    const savePendingUpdates = vi.fn(async () => ({ warnings: [] }))
    const appendApplyJournalEntry = vi.fn(async () => undefined)
    const readFile = vi.fn(async () => "# Current Scene\n\nThe accepted scene is now visible.")
    const reloadProjectFiles = vi.fn(async () => ({ warnings: [] }))

    const result = await applyRpgRuntimePanelAcceptedUpdates({
      projectPath: "C:/tmp/rpg-project",
      updates: [acceptedScene, pendingEvent, rejectedPlayer, acceptedSkipped],
      dependencies: {
        applyPendingUpdates: writePolicy.applyRpgPendingUpdates,
        savePendingUpdates,
        appendApplyJournalEntry,
        readFile,
        reloadProjectFiles,
      },
    })

    expect(writePolicy.applyRpgPendingUpdates).toHaveBeenCalledWith({
      projectPath: "C:/tmp/rpg-project",
      updates: [acceptedScene, acceptedSkipped],
    })
    expect(result.pendingUpdates.map((update) => update.id)).toEqual([
      "update-pending",
      "update-rejected",
      "update-skipped",
    ])
    expect(result.pendingUpdates.find((update) => update.id === "update-skipped")?.status).toBe("accepted")
    expect(savePendingUpdates).toHaveBeenCalledWith("C:/tmp/rpg-project", [
      pendingEvent,
      rejectedPlayer,
      acceptedSkipped,
    ])
    expect(appendApplyJournalEntry).toHaveBeenCalledWith(
      "C:/tmp/rpg-project",
      expect.objectContaining({
        attemptedUpdateIds: ["update-scene", "update-skipped"],
        appliedUpdateIds: ["update-scene"],
        remainingPendingUpdateIds: ["update-pending", "update-rejected", "update-skipped"],
        applyResult: expect.objectContaining({
          appliedUpdates: expect.arrayContaining([expect.objectContaining({ id: "update-scene" })]),
        }),
      }),
    )
    expect(result.skippedApplyReasons).toEqual({
      "update-skipped": "targetPath is outside allowed runtime write paths.",
    })
    expect(result.applyResult.warnings).toContain("Skipped RPG pending update \"update-skipped\".")
    expect(result.affectedPaths).toEqual(["wiki/current-scene/scene_state.md"])
    expect(reloadProjectFiles).toHaveBeenCalledWith("C:/tmp/rpg-project", ["wiki/current-scene/scene_state.md"])
    expect(readFile).toHaveBeenCalledWith("C:/tmp/rpg-project/wiki/current-scene/scene_state.md")
    expect(result.refreshedCurrentScene).toContain("accepted scene is now visible")
  })

  it("computes apply affected paths from applied updates only", () => {
    const applyResult = {
      appliedUpdates: [
        {
          id: "update-scene",
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite" as const,
          status: "applied" as const,
        },
        {
          id: "update-event",
          targetPath: "wiki/events/canal-gate.md",
          strategy: "append" as const,
          status: "applied" as const,
        },
      ],
      skippedUpdates: [
        {
          id: "update-skipped",
          targetPath: "wiki/world/basic_overview.md",
          reason: "targetPath is outside allowed runtime write paths.",
        },
      ],
      warnings: [],
    }

    expect(getAppliedRpgUpdatePaths(applyResult)).toEqual([
      "wiki/current-scene/scene_state.md",
      "wiki/events/canal-gate.md",
    ])
    expect(didApplyCurrentSceneOverwrite(applyResult)).toBe(true)
  })

  it("loads persisted pending updates for panel startup restore", async () => {
    const persistedUpdates = [
      { ...sampleRuntimeResult().pendingUpdates[0], status: "accepted" as const },
      { ...sampleRuntimeResult().pendingUpdates[0], id: "update-rejected", status: "rejected" as const },
    ]
    const loadRuntimeSnapshot = vi.fn(async () => ({
      pendingUpdates: persistedUpdates,
      warnings: ["Recovered pending updates from runtime metadata."],
    }))

    const result = await loadRpgRuntimePanelPendingUpdates("C:/tmp/rpg-project", { loadRuntimeSnapshot })

    expect(loadRuntimeSnapshot).toHaveBeenCalledWith("C:/tmp/rpg-project")
    expect(result.pendingUpdates.map((update) => update.status)).toEqual(["accepted", "rejected"])
    expect(result.warnings).toEqual(["Recovered pending updates from runtime metadata."])
  })

  it("persists accepted and rejected pending queue state through the panel helper", async () => {
    const pending = sampleRuntimeResult().pendingUpdates
    const accepted = updateStaging.acceptPendingRpgUpdate(pending, "update-scene")
    const rejected = updateStaging.rejectPendingRpgUpdate(accepted, "update-scene")
    const savePendingUpdates = vi.fn(async () => ({ warnings: [] }))

    await saveRpgRuntimePanelPendingUpdates({
      projectPath: "C:/tmp/rpg-project",
      updates: rejected,
      dependencies: { savePendingUpdates },
    })

    expect(savePendingUpdates).toHaveBeenCalledWith("C:/tmp/rpg-project", [
      expect.objectContaining({ id: "update-scene", status: "rejected" }),
    ])
  })

  it("does not save debug traces while persistence is disabled", async () => {
    const saveDebugTrace = vi.fn(async () => ({ warnings: [] }))

    const result = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace: sampleDebugTrace("trace-disabled", "succeeded"),
      policy: { enabled: false, maxTraces: 5 },
      savedTraceIds: new Set(),
      dependencies: { saveDebugTrace },
    })

    expect(result).toEqual({ saved: false, warnings: [] })
    expect(saveDebugTrace).not.toHaveBeenCalled()
  })

  it("saves each completed debug trace at most once when persistence is enabled", async () => {
    const trace = sampleDebugTrace("trace-complete", "succeeded")
    const saveDebugTrace = vi.fn(async () => ({ warnings: [] }))
    const savedTraceIds = new Set<string>()

    const first = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace,
      policy: { enabled: true, maxTraces: 10 },
      savedTraceIds,
      dependencies: { saveDebugTrace },
    })
    const duplicate = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace,
      policy: { enabled: true, maxTraces: 10 },
      savedTraceIds,
      dependencies: { saveDebugTrace },
    })
    const running = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace: sampleDebugTrace("trace-running", "running"),
      policy: { enabled: true, maxTraces: 10 },
      savedTraceIds,
      dependencies: { saveDebugTrace },
    })

    expect(first).toEqual({ saved: true, warnings: [] })
    expect(duplicate).toEqual({ saved: false, warnings: [] })
    expect(running).toEqual({ saved: false, warnings: [] })
    expect(saveDebugTrace).toHaveBeenCalledOnce()
    expect(saveDebugTrace).toHaveBeenCalledWith("C:/tmp/rpg-project", trace, { maxTraces: 10 })
  })

  it("returns debug trace persistence warnings and keeps failed traces retryable", async () => {
    const trace = sampleDebugTrace("trace-warning", "failed")
    const savedTraceIds = new Set<string>()
    const saveDebugTrace = vi.fn()
      .mockRejectedValueOnce(new Error("debug disk unavailable"))
      .mockResolvedValueOnce({ warnings: [] })

    const debugResult = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace,
      policy: { enabled: true, maxTraces: 5 },
      savedTraceIds,
      dependencies: { saveDebugTrace },
    })
    expect(debugResult.saved).toBe(false)
    expect(debugResult.warnings.join("\n")).toContain("debug disk unavailable")
    expect(savedTraceIds.has(trace.traceId)).toBe(false)

    const retryResult = await saveCompletedRpgRuntimeDebugTrace({
      projectPath: "C:/tmp/rpg-project",
      trace,
      policy: { enabled: true, maxTraces: 5 },
      savedTraceIds,
      dependencies: { saveDebugTrace },
    })

    expect(savedTraceIds.has(trace.traceId)).toBe(true)
    expect(retryResult).toEqual({ saved: true, warnings: [] })
    expect(saveDebugTrace).toHaveBeenCalledTimes(2)
  })

  it("does not auto-apply restored accepted pending updates", () => {
    renderToStaticMarkup(
      <RpgRuntimePanel
        projectPath="C:/tmp/rpg-project"
        llmConfig={sampleLlmConfig()}
        initialState={{
          currentScene: "The scene is loaded.",
          pendingUpdates: [{ ...sampleRuntimeResult().pendingUpdates[0], status: "accepted" }],
        }}
      />,
    )

    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })

  it("surfaces runtime flow errors from submission", async () => {
    await expect(
      submitRpgRuntimePanelAction({
        projectPath: "C:/tmp/rpg-project",
        llmConfig: sampleLlmConfig(),
        submittedAction: {
          id: "freeform-error",
          text: "Open the gate.",
          source: "freeform",
        },
        dependencies: {
          runTurnFlow: vi.fn(async () => {
            throw new Error("adapter failed")
          }),
        },
      }),
    ).rejects.toThrow(/adapter failed/)
  })
})

function sampleLlmConfig(): LlmConfig {
  return {
    provider: "openai",
    apiKey: "test-key",
    model: "test-model",
    ollamaUrl: "",
    customEndpoint: "",
    maxContextSize: 10000,
  }
}

function sampleDebugTrace(traceId: string, status: RpgRuntimeDebugTrace["status"]): RpgRuntimeDebugTrace {
  return {
    traceId,
    turnId: traceId,
    submittedActionId: `action-${traceId}`,
    submittedActionText: `Action ${traceId}`,
    status,
    startedAt: "2026-06-13T00:00:00.000Z",
    endedAt: status === "running" ? undefined : "2026-06-13T00:00:01.000Z",
    steps: [],
    warnings: [],
  }
}

function sampleRuntimeResult(): RunRpgRuntimeTurnFlowResult {
  const submittedAction: SubmittedAction = {
    id: "freeform-1",
    text: "Check the glowing sigil before opening the gate.",
    source: "freeform",
  }
  const recalledMaterials = sampleRecalledMaterials()
  const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, { recalledMaterials })
  const turnNarration = sampleTurnNarration({
    playerFacingText: "Mira reads the sigil and the lantern key answers with a warm click.",
  })

  return {
    actionResolution: runtimeParts.actionResolution,
    worldTickResult: runtimeParts.worldTickResult,
    visibleSelection: runtimeParts.visibleSelection,
    postActionWorkingState: runtimeParts.postActionWorkingState,
    turnSemanticHandoff: runtimeParts.turnSemanticHandoff,
    recallSelection: runtimeParts.recallSelection,
    recalledMaterials,
    outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
    outlineImpactReport: runtimeParts.outlineImpactReport,
    turnNarration,
    turnResult: {
      narrative: "Mira reads the sigil and the lantern key answers with a warm click.",
      nextActionOptions: [
        {
          id: "opt-key",
          playerFacingText: "Touch the lantern key to the sigil.",
          intent: "use_item",
          riskLevel: "medium",
          likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
        },
        {
          id: "opt-talk",
          playerFacingText: "Ask Mira what the click means.",
          intent: "talk",
          riskLevel: "low",
          likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
        },
        {
          id: "opt-wait",
          playerFacingText: "Wait and listen beyond the canal gate.",
          intent: "wait",
          riskLevel: "medium",
          likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
        },
      ],
      references: ["wiki/current-scene/scene_state.md"],
    },
    turnRecord: {
      submittedAction,
      actionResolution: runtimeParts.actionResolution,
      worldTickResult: runtimeParts.worldTickResult,
      visibleSelection: runtimeParts.visibleSelection,
      postActionWorkingState: runtimeParts.postActionWorkingState,
      recallSelection: runtimeParts.recallSelection,
      recalledMaterials,
      outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
      outlineImpactReport: runtimeParts.outlineImpactReport,
      turnNarration,
      generatedNarrative: "Mira reads the sigil and the lantern key answers with a warm click.",
      references: ["wiki/current-scene/scene_state.md", "wiki/factions/runtime/harbor-watch.md", "wiki/rules/core.md"],
    },
    proposedUpdates: [
      {
        id: "update-scene",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Refresh the current scene snapshot.",
        content: "# Current Scene\n\nThe lantern key has answered the sigil.",
        sourceTurnId: submittedAction.id,
        references: ["wiki/current-scene/scene_state.md"],
      },
    ],
    pendingUpdates: [
      {
        id: "update-scene",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Refresh the current scene snapshot.",
        content: "# Current Scene\n\nThe lantern key has answered the sigil.",
        sourceTurnId: submittedAction.id,
        references: ["wiki/current-scene/scene_state.md"],
        status: "pending",
      },
    ],
    warnings: ["Runtime warning sample."],
    proposalSource: "interaction",
    runtimeUpdateProposal: {
      proposedWikiUpdates: [],
      outlineRevisionReviewItems: [],
      journalEntries: [],
      skippedDeltas: [],
      pacingUpdateProposal: null,
      proposalGroups: [],
      warnings: [],
    },
    runtimeUpdateProposalAudit: {
      proposedWikiUpdateIds: [],
      journalEntries: [],
      skippedDeltas: [],
      proposalGroups: [],
      outlineRevisionReviewItems: [],
      warnings: [],
    },
    runtimePersistenceBoundary: {
      proposedCount: 1,
      acceptedCount: 1,
      rejectedCount: 0,
      pendingEligibleCount: 1,
      pendingEligibleUpdateIds: ["update-scene"],
      rejectedIssueCodes: [],
      warningIssueCodes: [],
      reviewOnlyAuditIds: [],
    },
    outlineRevisionReviewItems: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    proposalGroups: [],
    runtimeUpdateValidation: {
      acceptedUpdates: [
        {
          id: "update-scene",
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite",
          reason: "Refresh the current scene snapshot.",
          content: "# Current Scene\n\nThe lantern key has answered the sigil.",
          sourceTurnId: submittedAction.id,
          references: ["wiki/current-scene/scene_state.md"],
        },
      ],
      rejectedUpdates: [],
      issues: [],
      warnings: [],
    },
  }
}
