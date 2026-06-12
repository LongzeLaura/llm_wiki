import { afterEach, describe, expect, it, vi } from "vitest"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildWorldTickPrompt,
  createFixtureWorldTickAdapter,
  createLlmRpgWorldTickAdapter,
  getRpgInteractionRegistryEntry,
  parseRpgWorldTickOutput,
  worldTickInteractionSpec,
} from "./rpg-interactions"
import { sampleActionResolution } from "./rpg-runtime-test-fixtures"
import type {
  SubmittedAction,
  WorldTickInput,
  WorldTickResult,
  WorldTickVisibilityMeta,
} from "./rpg-runtime"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

afterEach(() => {
  streamChatMock.mockReset()
})

describe("RPG World Tick interaction", () => {
  it("builds a prompt that locks World Tick authority boundaries", () => {
    const prompt = buildWorldTickPrompt(sampleWorldTickInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(worldTickInteractionSpec.kind).toBe("world_tick")
    expect(combined).toContain("ActionResolution.playerActionDelta")
    expect(combined).toContain("canonical player-action-only delta")
    expect(combined).toContain("Do not reinterpret or re-adjudicate the player action")
    expect(combined).toContain("Do not derive canonical player facts from directResults")
    expect(combined).toContain("Only advance the resolved timeDelta interval")
    expect(combined).toContain("no wiki write")
    expect(combined).toContain("no player-facing narration")
    expect(combined).toContain("no nextActionOptions")
    expect(combined).toContain("no Recall Selector output")
    expect(combined).toContain("no Outline revision")
    expect(combined).toContain("Parallel-line display is not PC knowledge")
    expect(combined).toContain("wiki/player/known_information.md")
    expect(combined).toContain("Return only strict WorldTickResult JSON")
  })

  it("parses bare WorldTickResult JSON", () => {
    const result = sampleWorldTickResult()

    expect(parseRpgWorldTickOutput(JSON.stringify(result))).toEqual(result)
  })

  it("parses fenced WorldTickResult JSON", () => {
    const result = sampleWorldTickResult()

    expect(parseRpgWorldTickOutput(["```json", JSON.stringify(result, null, 2), "```"].join("\n"))).toEqual(result)
  })

  it("rejects missing required top-level fields", () => {
    const requiredFields = [
      "timeAdvance",
      "clockUpdates",
      "settledOngoingEvents",
      "informationBroadcast",
      "reactionQueue",
      "pacingUpdate",
      "gapState",
      "references",
      "warnings",
    ] as const

    for (const field of requiredFields) {
      const result = cloneResult()
      removeField(result, field)

      expect(() => parseRpgWorldTickOutput(JSON.stringify(result))).toThrow(new RegExp(field, "i"))
    }
  })

  it("rejects missing worldDeltas lines", () => {
    for (const line of ["playerVisibleLine", "parallelLine", "tensionLine"] as const) {
      const result = cloneResult()
      removeField(result.worldDeltas, line)

      expect(() => parseRpgWorldTickOutput(JSON.stringify(result))).toThrow(new RegExp(line, "i"))
    }
  })

  it("rejects delta-like objects missing visibility, knowledge, happened status, or affected paths", () => {
    const missingVisibility = cloneResult()
    removeField(missingVisibility.worldDeltas.playerVisibleLine[0], "visibility")
    expect(() => parseRpgWorldTickOutput(JSON.stringify(missingVisibility))).toThrow(/visibility/i)

    const missingKnowledgeScope = cloneResult()
    removeField(missingKnowledgeScope.worldDeltas.playerVisibleLine[0].visibility, "knowledgeScope")
    expect(() => parseRpgWorldTickOutput(JSON.stringify(missingKnowledgeScope))).toThrow(/knowledgeScope/i)

    const missingHappenedStatus = cloneResult()
    removeField(missingHappenedStatus.worldDeltas.playerVisibleLine[0], "happenedStatus")
    expect(() => parseRpgWorldTickOutput(JSON.stringify(missingHappenedStatus))).toThrow(/happenedStatus/i)

    const missingAffectedPaths = cloneResult()
    removeField(missingAffectedPaths.worldDeltas.playerVisibleLine[0], "affectedPaths")
    expect(() => parseRpgWorldTickOutput(JSON.stringify(missingAffectedPaths))).toThrow(/affectedPaths/i)
  })

  it("validates delta-like metadata across clocks, settlements, broadcasts, reactions, pacing, and gap state", () => {
    const result = sampleWorldTickResult()
    const checkedDeltas = [
      ...result.worldDeltas.playerVisibleLine,
      ...result.worldDeltas.parallelLine,
      ...result.worldDeltas.tensionLine,
      ...result.clockUpdates,
      ...result.settledOngoingEvents,
      ...result.informationBroadcast,
      ...result.reactionQueue,
      result.pacingUpdate,
      result.gapState,
    ]

    for (const delta of checkedDeltas) {
      expect(delta.narrativeLine).toBeTruthy()
      expect(delta.visibility.visibilityScope).toBeTruthy()
      expect(delta.visibility.knowledgeScope).toBeTruthy()
      expect(delta.happenedStatus).toBeTruthy()
      expect(delta.affectedPaths.length).toBeGreaterThan(0)
      expect(delta.runtimeDeltaRefs.length).toBeGreaterThan(0)
    }
  })

  it("rejects wiki write, narration, next action, outline revision, and Recall Selector pollution", () => {
    const pollutedOutputs = [
      { wikiWrites: [] },
      { proposedUpdates: [] },
      { targetPath: "wiki/events/poison.md", strategy: "append" },
      { narration: "Do not narrate here." },
      { playerFacingText: "Visible prose belongs later." },
      { parallelLineText: "Parallel prose belongs later." },
      { nextActionOptions: [] },
      { outlineRevisionProposal: {} },
      { provisionalOutlinePatch: {} },
      { regenerationRequest: {} },
      { recallSelection: {} },
      { selectedItems: [] },
      { retrievalIndex: {} },
      { recalledMaterials: [] },
    ]

    for (const pollution of pollutedOutputs) {
      const result = cloneResult()
      Object.assign(result, pollution)

      expect(() => parseRpgWorldTickOutput(JSON.stringify(result))).toThrow(/WorldTickResult/i)
    }
  })

  it("creates a fixture World Tick adapter that returns the preset result", async () => {
    const input = sampleWorldTickInput()
    const result = sampleWorldTickResult(input)
    const adapter = createFixtureWorldTickAdapter(result)

    await expect(adapter.advanceWorldTick(buildWorldTickPrompt(input), input)).resolves.toBe(result)
  })

  it("creates an LLM World Tick adapter that streams and parses output", async () => {
    const input = sampleWorldTickInput()
    const result = sampleWorldTickResult(input)
    const prompt = buildWorldTickPrompt(input)
    const output = ["```json\n", JSON.stringify(result), "\n```"].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1200 }

    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(output.slice(0, 20))
      callbacks.onToken(output.slice(20))
      callbacks.onDone()
    })

    const adapter = createLlmRpgWorldTickAdapter({ llmConfig: sampleLlmConfig(), signal }, { requestOverrides })

    await expect(adapter.advanceWorldTick(prompt, input)).resolves.toEqual(result)
    expect(streamChatMock).toHaveBeenCalledWith(
      sampleLlmConfig(),
      [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      expect.objectContaining({
        onToken: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      signal,
      requestOverrides,
    )
  })

  it("exposes world_tick in the RPG interaction registry", () => {
    expect(getRpgInteractionRegistryEntry("world_tick")).toMatchObject({
      kind: "world_tick",
      stage: "runtime_world_tick",
      usesLlm: true,
      implemented: true,
      spec: worldTickInteractionSpec,
    })
  })
})

type MutableWorldTickResult = {
  -readonly [K in keyof WorldTickResult]: WorldTickResult[K]
} & Record<string, unknown>

function cloneResult(): MutableWorldTickResult {
  return JSON.parse(JSON.stringify(sampleWorldTickResult())) as MutableWorldTickResult
}

function removeField(value: object, key: string): void {
  delete (value as Record<string, unknown>)[key]
}

function sampleWorldTickInput(): WorldTickInput {
  const submittedAction: SubmittedAction = {
    id: "act-world-tick",
    text: "Wait two minutes while Mira studies the canal gate sigil.",
    source: "freeform",
  }
  const actionResolution = sampleActionResolution(submittedAction)

  return {
    submittedAction,
    actionResolution,
    playerActionDelta: actionResolution.playerActionDelta,
    timeDelta: actionResolution.timeDelta,
    preActionRefs: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.active_clocks",
        summary: "Pre-action scene clock snapshot.",
        usePurpose: "worldTick",
        visibility: pcVisible(),
      },
    ],
    postActionRefs: [
      {
        path: ".llm-wiki/runtime/turns/act-world-tick/action-resolution.json",
        summary: "Action Resolver output consumed as-is.",
        usePurpose: "worldTick",
        visibility: pcVisible(),
      },
    ],
    activeClocks: [
      {
        clockId: "clock-harbor-watch-return",
        label: "Harbor Watch return",
        clockKind: "countdown",
        currentState: "The patrol is several minutes away.",
        urgency: "medium",
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("clock-harbor-watch-return")],
      },
    ],
    ongoingEvents: [
      {
        eventId: "ongoing-mira-sigil-read",
        summary: "Mira is reading the cracked canal-gate sigil.",
        status: "ongoing",
        participantRefs: ["character:Mira"],
        clockRefs: ["clock-harbor-watch-return"],
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("ongoing-mira-sigil-read")],
      },
    ],
    pacingState: {
      summary: "The scene is progressing but still under patrol pressure.",
      pacingDebt: "low",
      recentLowProgressTurnCount: 1,
      expectedCampaignDelta: "Advance the patrol countdown or reveal a ward clue.",
      stalledLines: [],
      pressureNotes: ["The gate scene should not remain static."],
      affectedPaths: ["wiki/current-scene/scene_state.md"],
      runtimeDeltaRefs: [],
    },
    gapSignals: [
      {
        gapSignalId: "gap-sigil-delay",
        gapMode: "compress",
        gapImpactCandidate: "minor",
        summary: "A short waiting interval may need compression.",
        causalChain: ["The player waits while a clock is active."],
        affectedBeatRefs: ["outline:decode-canal-gate"],
        affectedPaths: ["wiki/outlines/progress.md"],
        visibility: gmOnly(),
        happenedStatus: "possible_future",
        runtimeDeltaRefs: [worldTickDeltaRef("gap-sigil-delay")],
      },
    ],
    visibilityPolicy: {
      allowParallelLineDisplay: true,
      pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
      requireVisibilityMeta: true,
      parallelLineDoesNotGrantPcKnowledge: true,
      notes: ["Parallel-line display is not PC knowledge."],
    },
    runtimeRefs: actionResolution.runtimeDeltaRefs,
  }
}

function sampleWorldTickResult(input = sampleWorldTickInput()): WorldTickResult {
  const { actionResolution } = input
  const worldDeltaRef = worldTickDeltaRef("patrol-countdown-advance")
  const parallelDeltaRef = worldTickDeltaRef("watch-captain-order", "parallelLine")
  const tensionDeltaRef = worldTickDeltaRef("mira-trust-pressure", "tensionLine")
  const gapDeltaRef = worldTickDeltaRef("gap-sigil-delay", "tensionLine", "possible_future")

  return {
    tickId: "world-tick-act-world-tick",
    sourceActionResolutionId: actionResolution.resolutionId,
    timeAdvance: {
      sourceTimeDelta: actionResolution.timeDelta,
      appliedSummary: "Two to five minutes pass while Mira studies the ward.",
      clockReasoning: "The action resolution timeDelta advances the patrol countdown but does not rejudge the player action.",
    },
    worldDeltas: {
      playerVisibleLine: [
        {
          deltaId: "world-delta-patrol-nearer",
          summary: "The Harbor Watch patrol lights move closer above the canal gate.",
          narrativeLine: "playerVisibleLine",
          visibility: pcVisible(),
          happenedStatus: "confirmed_happened",
          affectedPaths: ["wiki/current-scene/scene_state.md"],
          runtimeDeltaRefs: [worldDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: ["clock-harbor-watch-return"],
          knowledgeEffects: ["PC can see patrol light movement, but not the patrol's full plan."],
        },
      ],
      parallelLine: [
        {
          deltaId: "world-delta-watch-captain-order",
          summary: "A watch captain orders a delayed sweep of the lower canal.",
          narrativeLine: "parallelLine",
          visibility: npcKnownUserVisiblePcUnknown(),
          happenedStatus: "confirmed_happened",
          affectedPaths: ["wiki/factions/runtime/harbor-watch.md"],
          runtimeDeltaRefs: [parallelDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: ["clock-harbor-watch-return"],
          knowledgeEffects: ["User-visible parallel information does not update PC knowledge."],
        },
      ],
      tensionLine: [
        {
          deltaId: "world-delta-mira-trust-pressure",
          summary: "Mira notices that the player waited for her expertise under time pressure.",
          narrativeLine: "tensionLine",
          visibility: gmOnly(),
          happenedStatus: "ongoing",
          affectedPaths: ["wiki/relationships/runtime/player_mira.md"],
          runtimeDeltaRefs: [tensionDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: [],
          knowledgeEffects: ["Relationship pressure changes remain runtime state until later narration/writeback gates."],
        },
      ],
    },
    clockUpdates: [
      {
        clockId: "clock-harbor-watch-return",
        clockKind: "countdown",
        updateKind: "decrease",
        previousState: "Patrol several minutes away.",
        nextState: "Patrol lights are near enough to pressure the gate decision.",
        amount: 2,
        timeDeltaBasis: actionResolution.timeDelta,
        reason: "The player waits while the countdown remains active.",
        sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "ongoing",
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldDeltaRef],
      },
    ],
    settledOngoingEvents: [
      {
        eventId: "ongoing-mira-sigil-read",
        settlementKind: "advanced",
        summary: "Mira finishes enough of the sigil read to identify a safe edge.",
        cause: "The player waits through the resolved timeDelta.",
        participantRefs: ["character:Mira"],
        clockUpdateIds: ["clock-harbor-watch-return"],
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "ongoing",
        affectedPaths: ["wiki/current-scene/scene_state.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("ongoing-mira-sigil-read")],
      },
    ],
    informationBroadcast: [
      {
        broadcastId: "broadcast-watch-order",
        informationSummary: "The watch captain's order is heard by nearby Harbor Watch members, not by the PC.",
        sourceActorRefs: ["character:watch-captain"],
        recipientRefs: ["faction:harbor-watch"],
        channel: "spoken order",
        certainty: "confirmed",
        preventsPcKnowledgeLeak: true,
        narrativeLine: "parallelLine",
        visibility: npcKnownUserVisiblePcUnknown(),
        happenedStatus: "confirmed_happened",
        affectedPaths: ["wiki/factions/runtime/harbor-watch.md"],
        runtimeDeltaRefs: [parallelDeltaRef],
      },
    ],
    reactionQueue: [
      {
        reactionId: "reaction-mira-warning",
        actorRef: "character:Mira",
        reactionTiming: "immediate",
        summary: "Mira warns the player to use only the uncracked edge of the key.",
        triggerDeltaIds: ["world-delta-patrol-nearer"],
        knowledgeBasis: ["Mira can see the sigil and hear the patrol lights nearing."],
        priority: "scene_focus",
        narrativeLine: "playerVisibleLine",
        visibility: pcVisible(),
        happenedStatus: "confirmed_happened",
        affectedPaths: ["wiki/current-scene/scene_state.md", "wiki/relationships/runtime/player_mira.md"],
        runtimeDeltaRefs: [worldTickDeltaRef("reaction-mira-warning")],
      },
    ],
    pacingUpdate: {
      updateId: "pacing-gate-pressure",
      previousDebt: "low",
      nextDebt: "none",
      pressureChange: "relieved",
      campaignDelta: "The patrol clock and Mira's warning both move the gate scene forward.",
      compensationNeeded: false,
      narrativeLine: "tensionLine",
      visibility: gmOnly(),
      happenedStatus: "ongoing",
      affectedPaths: ["wiki/current-scene/scene_state.md", "wiki/plot-arcs/runtime/canal-gate.md"],
      runtimeDeltaRefs: [worldTickDeltaRef("pacing-gate-pressure", "tensionLine")],
    },
    gapState: {
      gapSignalId: "gap-sigil-delay",
      gapMode: "compress",
      gapImpactCandidate: "minor",
      isPreliminary: true,
      outlineImpactAuthority: "outlineImpactDetector",
      summary: "The short wait creates no authoritative outline change yet.",
      causalChain: ["A short wait advances a countdown but does not replace an outline beat."],
      affectedBeatRefs: ["outline:decode-canal-gate"],
      narrativeLine: "tensionLine",
      visibility: gmOnly(),
      happenedStatus: "possible_future",
      affectedPaths: ["wiki/outlines/progress.md"],
      runtimeDeltaRefs: [gapDeltaRef],
    },
    runtimeDeltaRefs: [worldDeltaRef, parallelDeltaRef, tensionDeltaRef, gapDeltaRef],
    references: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.active_clocks",
        reason: "Provides the active patrol countdown.",
        usePurpose: "worldTick",
        visibility: pcVisible(),
      },
    ],
    warnings: [],
  }
}

function pcVisible(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    knowledgeSourceKind: "seen",
    knownBy: ["player:Iven"],
    excludedKnowledgeFor: [],
    displayPolicy: "player_visible",
    reason: "The player character can directly perceive this information.",
  }
}

function npcKnownUserVisiblePcUnknown(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "npc_known",
    knowledgeSourceKind: "heard",
    knownBy: ["faction:harbor-watch"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "user_visible_pc_unknown",
    reason: "NPCs heard this information, and user display still does not make it PC knowledge.",
  }
}

function gmOnly(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    knowledgeSourceKind: "documented",
    knownBy: ["gm"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "gm_only",
    reason: "This controls runtime pacing and outline screening rather than PC knowledge.",
  }
}

function worldTickDeltaRef(
  deltaId: string,
  narrativeLine: "playerVisibleLine" | "parallelLine" | "tensionLine" = "playerVisibleLine",
  happenedStatus: "attempted_not_confirmed" | "confirmed_happened" | "ongoing" | "possible_future" = "ongoing",
) {
  return {
    deltaId,
    sourceStage: "worldTick",
    sourcePath: `.llm-wiki/runtime/turns/act-world-tick/world-tick.json#${deltaId}`,
    summary: `World Tick delta ${deltaId}.`,
    narrativeLine,
    usePurpose: "worldTick",
    happenedStatus,
  } as const
}

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
