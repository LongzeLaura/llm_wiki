import { afterEach, describe, expect, it, vi } from "vitest"
import { createTempProject, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import { sampleActionResolution } from "./rpg-runtime-test-fixtures"
import type {
  SubmittedAction,
  WorldTickInput,
  WorldTickResult,
  WorldTickVisibilityMeta,
} from "./rpg-runtime"
import { buildWorldTickInputFromWiki } from "./rpg-runtime"

vi.mock("@/commands/fs", () => realFs)

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG World Tick contract", () => {
  it("builds WorldTickInput directly from fixture wiki files and pre-action snapshot", async () => {
    ctx = { tmp: await createTempProject("rpg-world-tick-input-builder") }
    const projectPath = ctx.tmp.path
    const submittedAction: SubmittedAction = {
      id: "act-world-tick-builder",
      text: "Ask Mira to inspect the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    await writeWorldTickFixture(projectPath)

    const result = await buildWorldTickInputFromWiki({
      projectPath,
      submittedAction,
      actionResolution,
      preActionSnapshot: samplePreActionSnapshot(),
    })
    const serialized = JSON.stringify(result.input)

    expect(result.input.submittedAction).toEqual(submittedAction)
    expect(result.input.actionResolution).toBe(actionResolution)
    expect(result.input.playerActionDelta).toBe(actionResolution.playerActionDelta)
    expect(result.input.preActionRefs.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        "wiki/current-scene/scene_state.md",
        "wiki/events/session-02.md",
        "wiki/relationships/runtime/player_mira.md",
        "wiki/plot-arcs/runtime/canal-gate.md",
        "wiki/quests/open-canal-gate.md",
        "wiki/outlines/progress.md",
        "wiki/rules/core.md",
        "wiki/rules/world.md",
        "wiki/rules/table.md",
        "wiki/characters/runtime/mira.md",
        "wiki/locations/runtime/canal-gate.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/items/runtime/lantern-key.md",
      ]),
    )
    expect(serialized).toContain("Active Clock: Harbor Watch return")
    expect(serialized).toContain("History Constraint: Mira bargained with a dock runner")
    expect(serialized).toContain("Runtime relationship: Mira is wary but engaged")
    expect(serialized).toContain("Runtime plot pressure: gate sequence should move")
    expect(serialized).toContain("Quest: open the canal gate")
    expect(serialized).toContain("Current Stage: Decode the canal gate")
    expect(serialized).toContain("Hard Rule: touching cracked wards has a cost")
    expect(result.input.activeClocks.map((clock) => clock.clockId)).toContain("clock-harbor-watch-return")
    expect(result.input.ongoingEvents.map((event) => event.eventRef)).not.toContain("wiki/events/session-02.md")
    expect(result.input.ongoingEvents.map((event) => event.summary)).toContain("Mira will warn Iven if the sigil sparks.")
    expect(result.input.pacingState.pressureNotes.join("\n")).toContain("Runtime plot pressure")
    expect(result.input.gapSignals[0]).toMatchObject({
      affectedPaths: expect.arrayContaining(["wiki/outlines/progress.md", "wiki/plot-arcs/runtime/canal-gate.md"]),
      visibility: expect.objectContaining({ visibilityScope: "gm_only" }),
    })
    expect(result.input.visibilityPolicy.parallelLineDoesNotGrantPcKnowledge).toBe(true)
    expect(result.input.runtimeRefs).toBe(actionResolution.runtimeDeltaRefs)
  })

  it("directly consumes ActionResolution.playerActionDelta and timeDelta", () => {
    const submittedAction: SubmittedAction = {
      id: "act-world-tick-1",
      text: "Wait two minutes while Mira studies the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)

    const input = {
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
          path: ".llm-wiki/runtime/turns/act-world-tick-1/action-resolution.json",
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
    } satisfies WorldTickInput

    expect(input.playerActionDelta).toBe(actionResolution.playerActionDelta)
    expect(input.timeDelta).toBe(actionResolution.timeDelta)
    expect(input.playerActionDelta.scope).toBe("player_action_only")
    expect(input.visibilityPolicy.parallelLineDoesNotGrantPcKnowledge).toBe(true)
  })

  it("defines the WorldTickResult core shape with visibility and happened-status metadata", () => {
    const submittedAction: SubmittedAction = {
      id: "act-world-tick-2",
      text: "Wait while Mira studies the sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const result = sampleWorldTickResult(actionResolution)

    expect(result.sourceActionResolutionId).toBe(actionResolution.resolutionId)
    expect(result.timeAdvance.sourceTimeDelta).toBe(actionResolution.timeDelta)
    expect(Object.keys(result.worldDeltas)).toEqual([
      "playerVisibleLine",
      "parallelLine",
      "tensionLine",
    ])
    expect(result.clockUpdates[0]?.timeDeltaBasis).toBe(actionResolution.timeDelta)
    expect(result.informationBroadcast[0]?.visibility.knowledgeScope).toBe("npc_known")
    expect(result.reactionQueue[0]?.reactionTiming).toBe("immediate")
    expect(result.gapState.isPreliminary).toBe(true)
    expect(result.gapState.outlineImpactAuthority).toBe("outlineImpactDetector")
    expect(result.gapState.happenedStatus).toBe("possible_future")

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
})

async function writeWorldTickFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    [
      "# Current Scene",
      "",
      "Iven and Mira are beneath the River Port, facing a locked canal gate.",
      "- Active Clock: Harbor Watch return is urgent.",
      "- Pending Reaction: Mira will warn Iven if the sigil sparks.",
      "- Pacing: The gate scene should not stall.",
    ].join("\n"),
  )
  await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nHistory Constraint: Mira bargained with a dock runner.")
  await writeFileRaw(`${projectPath}/wiki/relationships/runtime/player_mira.md`, "# Player / Mira Runtime\n\nRuntime relationship: Mira is wary but engaged.")
  await writeFileRaw(`${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`, "# Canal Gate Runtime\n\nRuntime plot pressure: gate sequence should move.")
  await writeFileRaw(`${projectPath}/wiki/quests/open-canal-gate.md`, "# Open Canal Gate\n\nQuest: open the canal gate without alerting patrols.")
  await writeFileRaw(`${projectPath}/wiki/outlines/progress.md`, "# Outline Progress\n\nCurrent Stage: Decode the canal gate.")
  await writeFileRaw(`${projectPath}/wiki/rules/core.md`, "# Core Rules\n\nHard Rule: touching cracked wards has a cost.")
  await writeFileRaw(`${projectPath}/wiki/rules/world.md`, "# World Rules\n\nHard Rule: patrol clocks advance while waiting.")
  await writeFileRaw(`${projectPath}/wiki/rules/table.md`, "# Table Rules\n\nHard Rule: no free retries under pressure.")
  await writeFileRaw(`${projectPath}/wiki/characters/mira.md`, "# Mira\n\nMira reads canal sigils.")
  await writeFileRaw(`${projectPath}/wiki/characters/runtime/mira.md`, "# Mira Runtime\n\nMira is limping near the gate.")
  await writeFileRaw(`${projectPath}/wiki/locations/runtime/canal-gate.md`, "# Canal Gate Runtime\n\nThe canal gate is locked.")
  await writeFileRaw(`${projectPath}/wiki/factions/runtime/harbor-watch.md`, "# Harbor Watch Runtime\n\nThe patrol is approaching.")
  await writeFileRaw(`${projectPath}/wiki/items/runtime/lantern-key.md`, "# Lantern Key Runtime\n\nThe key reacts to sigils.")
}

function samplePreActionSnapshot() {
  return {
    currentScene: {
      path: "wiki/current-scene/scene_state.md" as const,
      summary: "Iven and Mira face a locked canal gate.",
      visibleSituation: "The canal gate is locked and under patrol pressure.",
      presentCharacters: ["character:Mira"],
      interactableObjects: ["item:lantern-key", "location:canal-gate-sigil"],
      currentDangers: ["Harbor Watch patrol"],
      locationActionConditions: ["The cracked sigil is risky to touch."],
    },
    player: {
      stateSummary: "Iven carries the lantern key.",
      abilities: [],
      inventory: ["Lantern key"],
      goals: ["Open the gate"],
      knownInformation: ["The key may answer a sigil."],
      knownInformationPath: "wiki/player/known_information.md" as const,
      conditionNotes: [],
    },
    activeClocks: [
      {
        clockId: "clock-harbor-watch-return",
        label: "Harbor Watch return",
        summary: "Active Clock: Harbor Watch return is urgent.",
        urgency: "high" as const,
        narrativeLine: "playerVisibleLine" as const,
      },
    ],
    countdowns: [],
    pendingReactions: [
      {
        reactionId: "reaction-mira-warning",
        actorRef: "character:Mira",
        summary: "Mira will warn Iven if the sigil sparks.",
        visibilityScope: "pc_visible" as const,
      },
    ],
    pacingState: {
      summary: "The scene has low pacing debt but should move.",
      pacingDebt: "low" as const,
      recentLowProgressTurnCount: 1,
      expectedCampaignDelta: "Advance patrol or reveal ward clue.",
    },
    outlineProgress: {
      progressPath: "wiki/outlines/progress.md" as const,
      currentBeat: "Decode the canal gate.",
      adjacentBeats: ["Use the lantern key."],
      branchConditions: ["Alerting patrols changes the route."],
      progressSummary: "Current Stage: Decode the canal gate.",
    },
    rulesExcerpts: [],
    references: ["wiki/current-scene/scene_state.md"],
  }
}

function sampleWorldTickResult(actionResolution: ReturnType<typeof sampleActionResolution>): WorldTickResult {
  const worldDeltaRef = worldTickDeltaRef("patrol-countdown-advance")
  const parallelDeltaRef = worldTickDeltaRef("watch-captain-order")
  const gapDeltaRef = worldTickDeltaRef("gap-sigil-delay")

  return {
    tickId: "world-tick-act-world-tick-2",
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
          visibility: userVisiblePcUnknown(),
          happenedStatus: "confirmed_happened",
          affectedPaths: ["wiki/factions/runtime/harbor-watch.md"],
          runtimeDeltaRefs: [parallelDeltaRef],
          sourcePlayerDeltaIds: [actionResolution.playerActionDelta.deltaId],
          sourceClockIds: ["clock-harbor-watch-return"],
          knowledgeEffects: ["User-visible parallel information does not update PC knowledge."],
        },
      ],
      tensionLine: [],
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
      runtimeDeltaRefs: [worldTickDeltaRef("pacing-gate-pressure")],
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
    runtimeDeltaRefs: [worldDeltaRef, parallelDeltaRef, gapDeltaRef],
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
  } satisfies WorldTickResult
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

function userVisiblePcUnknown(): WorldTickVisibilityMeta {
  return {
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "user_only",
    knowledgeSourceKind: "parallel_line",
    knownBy: ["user"],
    excludedKnowledgeFor: ["player:Iven"],
    displayPolicy: "user_visible_pc_unknown",
    reason: "This may be shown as a parallel line without becoming PC knowledge.",
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

function worldTickDeltaRef(deltaId: string) {
  return {
    deltaId,
    sourceStage: "worldTick",
    sourcePath: `.llm-wiki/runtime/turns/act-world-tick/world-tick.json#${deltaId}`,
    summary: `World Tick delta ${deltaId}.`,
    narrativeLine: "playerVisibleLine",
    usePurpose: "worldTick",
    happenedStatus: deltaId.startsWith("gap") ? "possible_future" : "ongoing",
  } as const
}
