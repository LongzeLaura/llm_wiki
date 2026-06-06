import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  RpgRuntimePanel,
  applyRpgRuntimePanelAcceptedUpdates,
  loadRpgCurrentScene,
  submitRpgRuntimePanelAction,
} from "@/components/rpg"
import * as writePolicy from "@/lib/rpg-runtime/write-policy"
import type { LlmConfig } from "@/stores/wiki-store"
import type { RpgNarrationAdapter } from "@/lib/rpg-runtime/narration-adapter"
import type { RunRpgRuntimeTurnFlowResult } from "@/lib/rpg-runtime/runtime-controller"
import type { SubmittedAction } from "@/lib/rpg-runtime/types"
import type { PendingRpgUpdate } from "@/lib/rpg-runtime/update-staging"

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
}))

vi.mock("@/lib/rpg-runtime/write-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rpg-runtime/write-policy")>()
  return {
    ...actual,
    applyRpgPendingUpdates: vi.fn(actual.applyRpgPendingUpdates),
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
    expect(html).toContain("Pending updates: 0")
    expect(html).toContain("Pending RPG updates")
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
    expect(result.warnings.join("\n")).toContain("Missing current scene: wiki/current-scene/scene_state.md")
  })

  it("submits a freeform action through the LLM adapter and runtime flow", async () => {
    const submittedAction: SubmittedAction = {
      id: "freeform-1",
      text: "Check the glowing sigil before opening the gate.",
      source: "freeform",
    }
    const narrationAdapter: RpgNarrationAdapter = {
      generateTurn: vi.fn(),
    }
    const createNarrationAdapter = vi.fn(() => narrationAdapter)
    const runTurnFlow = vi.fn(async () => sampleRuntimeResult())

    const result = await submitRpgRuntimePanelAction({
      projectPath: "C:/tmp/rpg-project",
      llmConfig: sampleLlmConfig(),
      submittedAction,
      dependencies: { createNarrationAdapter, runTurnFlow },
    })

    expect(createNarrationAdapter).toHaveBeenCalledWith({
      llmConfig: sampleLlmConfig(),
      signal: undefined,
    })
    expect(runTurnFlow).toHaveBeenCalledWith({
      projectPath: "C:/tmp/rpg-project",
      wikiMode: "llmwikirpg",
      submittedAction,
      narrationAdapter,
    })
    expect(result.lastNarrative).toContain("Mira reads the sigil")
    expect(result.nextActionOptions.map((option) => option.playerFacingText)).toContain("Touch the lantern key to the sigil.")
    expect(result.pendingUpdates).toEqual(sampleRuntimeResult().pendingUpdates)
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

    expect(html).toContain("Running turn...")
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

    expect(html).toContain("Runtime warnings")
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

    expect(html).toContain("Pending updates: 1")
    expect(html).toContain("Pending RPG updates")
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
        createNarrationAdapter: () => ({ generateTurn: vi.fn() }),
        runTurnFlow: vi.fn(async () => sampleRuntimeResult()),
      },
    })

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
      targetPath: "wiki/world/stable.md",
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
          targetPath: "wiki/world/stable.md",
          reason: "targetPath is outside allowed runtime write paths.",
        },
      ],
      warnings: ["Skipped RPG pending update \"update-skipped\"."],
    })

    const result = await applyRpgRuntimePanelAcceptedUpdates({
      projectPath: "C:/tmp/rpg-project",
      updates: [acceptedScene, pendingEvent, rejectedPlayer, acceptedSkipped],
      dependencies: { applyPendingUpdates: writePolicy.applyRpgPendingUpdates },
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
    expect(result.skippedApplyReasons).toEqual({
      "update-skipped": "targetPath is outside allowed runtime write paths.",
    })
    expect(result.applyResult.warnings).toContain("Skipped RPG pending update \"update-skipped\".")
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
          createNarrationAdapter: () => ({ generateTurn: vi.fn() }),
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

function sampleRuntimeResult(): RunRpgRuntimeTurnFlowResult {
  const submittedAction: SubmittedAction = {
    id: "freeform-1",
    text: "Check the glowing sigil before opening the gate.",
    source: "freeform",
  }

  return {
    brief: {
      submittedAction,
      currentScene: "Iven and Mira face the canal gate.",
      playerState: "",
      hardFacts: [],
      activeConstraints: [],
      presentCharacters: [],
      relationshipTensions: [],
      activePlotPressure: [],
      relevantLocations: [],
      relevantFactions: [],
      relevantItems: [],
      styleRules: [],
      ruleNotes: [],
      memoryNotes: [],
      forbiddenContradictions: [],
      references: ["wiki/current-scene/scene_state.md"],
    },
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
      generatedNarrative: "Mira reads the sigil and the lantern key answers with a warm click.",
      references: ["wiki/current-scene/scene_state.md"],
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
  }
}
