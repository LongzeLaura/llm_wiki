import { afterEach, describe, expect, it, vi } from "vitest"
import type { LlmConfig } from "@/stores/wiki-store"
import { createTempProject, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import { streamChat } from "./llm-client"
import {
  actionResolverInteractionSpec,
  buildActionResolverPrompt,
  createFixtureActionResolverAdapter,
  createLlmRpgActionResolverAdapter,
  parseRpgActionResolverOutput,
  type RpgActionResolverPrompt,
} from "./rpg-interactions/runtime"
import { RPG_SCHEMA_SLOTS, RPG_WIKI_SCHEMA } from "./rpg-wiki-schema"
import {
  ACTION_RESOLVER_DEFAULT_EVENT_STATUS,
  buildActionResolverInputFromWiki,
  type ActionResolution,
  type ActionResolverInput,
} from "./rpg-runtime"

vi.mock("@/commands/fs", () => realFs)

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)
let tmp: { path: string; cleanup: () => Promise<void> } | undefined

afterEach(async () => {
  streamChatMock.mockReset()
  if (tmp) {
    await tmp.cleanup()
    tmp = undefined
  }
})

describe("RPG Action Resolver", () => {
  it("uses ActionResolverInput and ActionResolution fixtures with the default attempt boundary", () => {
    const input = sampleActionResolverInput()
    const resolution = sampleActionResolution()

    expect(input.preActionSnapshot.currentScene.path).toBe("wiki/current-scene/scene_state.md")
    expect(input.preActionSnapshot.player.knownInformationPath).toBe("wiki/player/known_information.md")
    expect(input.preActionSnapshot.outlineProgress.progressPath).toBe("wiki/outlines/progress.md")
    expect(input.fixedSlotRefs.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        "wiki/current-scene/scene_state.md",
        "wiki/player/known_information.md",
        "wiki/outlines/progress.md",
        "wiki/rules/core.md",
      ]),
    )
    expect(resolution.eventDraft.status).toBe(ACTION_RESOLVER_DEFAULT_EVENT_STATUS)
    expect(resolution.playerActionDelta.scope).toBe("player_action_only")
    expect(resolution.runtimeDeltaRefs[0]?.sourceStage).toBe("actionResolution")
  })

  it("builds an Action Resolver prompt with required stage boundaries", () => {
    const prompt = buildActionResolverPrompt(sampleActionResolverInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(actionResolverInteractionSpec.kind).toBe("action_resolver")
    expect(combined).toContain("玩家行动是一种尝试")
    expect(combined).toContain("attempted_not_confirmed")
    expect(combined).toContain("可行性、代价、障碍和直接结果")
    expect(combined).toContain("no world tick")
    expect(combined).toContain("no wiki write")
    expect(combined).toContain("no player-facing narration")
    expect(combined).toContain("可选字段没有值时必须省略整个 key")
    expect(combined).toContain("禁止输出 undefined")
    expect(combined).toContain("禁止用 null 代替缺失值")
    expect(combined).not.toContain("| undefined")
    expect(combined).not.toMatch(/:\s*undefined\b/)
    expect(combined).toContain("不要输出 resolutionId")
    expect(combined).not.toContain("\"costId\"")
    expect(combined).toContain("\"kind\"")
    expect(combined).toContain("\"appliesIf\"")
    expect(combined).not.toContain("\"obstacleId\"")
    expect(combined).toContain("\"bypassHint\"")
    expect(combined).not.toContain("\"resultId\"")
    expect(combined).toContain("\"happenedStatus\"")
    expect(prompt.systemPrompt).toContain("\"referencePaths\": string[]")
    expect(prompt.systemPrompt).toContain("\"warnings\": string[]")
    expect(prompt.systemPrompt).not.toContain("\"references\": [{")
    expect(prompt.systemPrompt).not.toContain("\"code\": string")
    expect(combined).toContain("wiki/current-scene/scene_state.md")
    expect(combined).toContain("wiki/player/known_information.md")
    expect(combined).toContain("wiki/outlines/progress.md")
    expect(combined).toContain("wiki/rules/core.md")
    expect(prompt.debugSections?.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "系统固定提示词",
        "已提交行动",
        "行动前快照",
        "相关规则",
        "固定槽位引用",
        "最近回合摘要",
        "Runtime 引用",
        "返回契约",
      ]),
    )
    expectPromptDebugSectionsRecompose(prompt)
  })

  it("parses legal fenced ActionResolution JSON", () => {
    const resolution = sampleActionResolution()
    const output = ["```json", JSON.stringify(resolution, null, 2), "```"].join("\n")

    expect(parseRpgActionResolverOutput(output)).toEqual(resolution)
  })

  it("repairs trailing commas before parsing ActionResolution JSON", () => {
    const resolution = sampleActionResolution()
    const output = JSON.stringify(resolution, null, 2).replace(/\n}$/, ",\n}")
    const reports: unknown[] = []

    expect(parseRpgActionResolverOutput(output, undefined, { onJsonParseReport: (report) => reports.push(report) })).toEqual(
      resolution,
    )
    expect(reports).toEqual([
      expect.objectContaining({
        operations: expect.arrayContaining(["removed_trailing_commas"]),
        parseSucceeded: true,
      }),
    ])
  })

  it("accepts legal ActionResolution JSON that omits optional fields", () => {
    const raw = cloneResolution()
    delete raw.parsedIntent.timeJumpSignal
    delete raw.eventDraft.confirmationBasis
    delete raw.timeDelta.min
    delete raw.timeDelta.max

    const parsed = parseRpgActionResolverOutput(JSON.stringify(raw))

    expect(parsed.parsedIntent.timeJumpSignal).toBeUndefined()
    expect(parsed.eventDraft.confirmationBasis).toBeUndefined()
    expect(parsed.timeDelta.min).toBeUndefined()
    expect(parsed.timeDelta.max).toBeUndefined()
  })

  it("keeps invalid undefined literal output as a JSON protocol error", () => {
    const output = [
      "{",
      "  \"resolutionId\": \"bad-resolution\",",
      "  \"submittedActionId\": \"act-1\",",
      "  \"parsedIntent\": {",
      "    \"timeJumpSignal\": undefined",
      "  }",
      "}",
    ].join("\n")

    expect(() => parseRpgActionResolverOutput(output)).toThrow(/解析 JSON 失败/)
  })

  it("defaults a missing eventDraft.status to attempted_not_confirmed", () => {
    const raw = cloneResolution()
    delete raw.eventDraft.status

    expect(parseRpgActionResolverOutput(JSON.stringify(raw)).eventDraft.status).toBe(
      ACTION_RESOLVER_DEFAULT_EVENT_STATUS,
    )
  })

  it("rejects missing timeDelta", () => {
    const raw = cloneResolution()
    delete raw.timeDelta

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/timeDelta/i)
  })

  it("rejects missing progressPotential", () => {
    const raw = cloneResolution()
    delete raw.progressPotential

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/progressPotential/i)
  })

  it("rejects generic one-turn/one-minute timeDelta defaults", () => {
    const raw = cloneResolution()
    raw.timeDelta.summary = "One turn, one minute."
    raw.timeDelta.reasoning = "Default one turn minute fallback."

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/generic one-turn\/one-minute/i)
  })

  it("rejects illegal eventDraft.status values", () => {
    const raw = cloneResolution()
    raw.eventDraft.status = "surely_happened"

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/eventDraft\.status/i)
  })

  it("rejects unsafe confirmed_happened event drafts for ordinary attempts", () => {
    const raw = cloneResolution()
    raw.eventDraft.status = "confirmed_happened"
    delete raw.eventDraft.confirmationBasis

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/confirmed_happened/i)
  })

  it("rejects mixed feasibility, cost, obstacle, and direct result fields", () => {
    const raw = cloneResolution()
    raw.feasibility.costs = []

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/must be separate top-level fields/i)
  })

  it("rejects wiki write proposal pollution", () => {
    const raw = cloneResolution()
    raw.proposedUpdates = [
      {
        targetPath: "wiki/events/session-04.md",
        strategy: "append",
      },
    ]

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/wiki write proposals/i)
  })

  it("rejects player-facing narration pollution", () => {
    const raw = cloneResolution()
    raw.playerFacingNarration = "You see the gate open in a dramatic paragraph."

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/player-facing narration/i)
  })

  it("rejects World Tick and Reaction result pollution", () => {
    const raw = cloneResolution()
    raw.worldTick = {
      reactionQueue: ["Mira runs ahead offscreen."],
    }

    expect(() => parseRpgActionResolverOutput(JSON.stringify(raw))).toThrow(/World Tick or Reaction/i)
  })

  it("creates a fixture adapter that returns structured ActionResolution", async () => {
    const resolution = sampleActionResolution()
    const adapter = createFixtureActionResolverAdapter(resolution)

    await expect(adapter.resolveAction(samplePrompt(), sampleActionResolverInput())).resolves.toEqual(resolution)
  })

  it("builds ActionResolverInput directly from wiki files", async () => {
    tmp = await createTempProject("rpg-action-resolver-input-builder")
    const projectPath = tmp.path
    await writeActionResolverWikiFixture(projectPath)

    const result = await buildActionResolverInputFromWiki({
      projectPath,
      submittedAction: {
        id: "act-builder",
        text: "Ask Mira to inspect the canal gate sigil with the lantern key before the Harbor Watch returns.",
        source: "freeform",
      },
    })
    const input = result.input
    const serialized = JSON.stringify(input)

    expect(input.submittedAction.id).toBe("act-builder")
    expect(input.preActionSnapshot.currentScene.summary).toContain("canal gate")
    expect(input.preActionSnapshot.currentScene.visibleSituation).toContain("lowest sigil")
    expect(input.preActionSnapshot.currentScene.presentCharacters.join("\n")).toContain("Mira")
    expect(input.preActionSnapshot.currentScene.presentCharacters.join("\n")).toContain("runtime overlay")
    expect(input.preActionSnapshot.currentScene.interactableObjects.join("\n")).toContain("lantern key")
    expect(input.preActionSnapshot.player.stateSummary).toContain("smuggler-mage")
    expect(input.preActionSnapshot.player.abilities.join("\n")).toContain("ward pressure")
    expect(input.preActionSnapshot.player.inventory.join("\n")).toContain("brass lantern key")
    expect(input.preActionSnapshot.player.goals.join("\n")).toContain("open the canal gate")
    expect(input.preActionSnapshot.player.knownInformation.join("\n")).toContain("Mira recognizes canal ward marks")
    expect(input.relevantRules.map((rule) => rule.path)).toEqual(
      expect.arrayContaining(["wiki/rules/core.md", "wiki/rules/world.md", "wiki/rules/table.md"]),
    )
    expect(serialized).toContain("Harbor Watch runtime overlay")
    expect(serialized).toContain("River Port runtime overlay")
    expect(serialized).toContain("lantern key runtime overlay")
    expect(serialized).toContain("Quiet canal route")
    expect(serialized).not.toContain("UNRELATED_SABER_RUNTIME_POISON")
    expect(serialized).not.toContain("UNRELATED_EA_ITEM_POISON")
    expect(input.preActionSnapshot.references).toEqual(
      expect.arrayContaining([
        "wiki/current-scene/scene_state.md",
        "wiki/player/player.md",
        "wiki/player/abilities.md",
        "wiki/player/inventory.md",
        "wiki/player/goals.md",
        "wiki/player/known_information.md",
        "wiki/rules/core.md",
        "wiki/rules/world.md",
        "wiki/rules/table.md",
        "wiki/characters/mira.md",
        "wiki/characters/runtime/mira.md",
        "wiki/locations/river-port.md",
        "wiki/locations/runtime/river-port.md",
        "wiki/items/lantern-key.md",
        "wiki/items/runtime/lantern-key.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/quests/quiet-canal-route.md",
      ]),
    )
    expect(result.warnings).toEqual([])
  })

  it("creates a real Action Resolver adapter that streams and parses structured JSON", async () => {
    const resolution = sampleActionResolution()
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1200 }
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken("```json\n")
      callbacks.onToken(JSON.stringify(resolution))
      callbacks.onToken("\n```")
      callbacks.onDone()
    })

    const adapter = createLlmRpgActionResolverAdapter(
      { llmConfig: sampleLlmConfig(), signal },
      { requestOverrides },
    )

    const parsed = await adapter.resolveAction(samplePrompt(), sampleActionResolverInput())
    expect(parsed.resolutionId).toBe("action-resolution-act-1")
    expect(parsed.eventDraft.eventId).toBe("event-draft-act-1")
    expect(parsed.runtimeDeltaRefs[0]?.deltaId).toBe("player-action-delta-act-1")
    expect(parsed.warnings.map((warning) => warning.code)).toContain("derivable_protocol_stripped")
    expect(streamChatMock).toHaveBeenCalledWith(
      sampleLlmConfig(),
      [
        { role: "system", content: "System action resolver instructions." },
        { role: "user", content: "User action resolver input." },
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

  it("creates a real Action Resolver repair adapter method with repair request overrides", async () => {
    const signal = new AbortController().signal
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken("{\"ok\":true}")
      callbacks.onDone()
    })

    const adapter = createLlmRpgActionResolverAdapter(
      { llmConfig: sampleLlmConfig(), signal },
      { repairRequestOverrides: { max_tokens: 900 } },
    )

    await expect(
      adapter.repairActionResolutionRawOutput?.(samplePrompt(), sampleActionResolverInput()),
    ).resolves.toBe("{\"ok\":true}")
    expect(streamChatMock).toHaveBeenCalledWith(
      sampleLlmConfig(),
      [
        { role: "system", content: "System action resolver instructions." },
        { role: "user", content: "User action resolver input." },
      ],
      expect.objectContaining({
        onToken: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      signal,
      expect.objectContaining({
        temperature: 0,
        max_tokens: 900,
      }),
    )
  })

  it("keeps RPG schema runtime category and fixed slot boundaries unchanged", () => {
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("runtime/")
  })
})

function sampleActionResolverInput(): ActionResolverInput {
  return {
    submittedAction: {
      id: "act-1",
      text: "I ask Mira to inspect the canal-gate sigil before I touch the lantern key to it.",
      source: "freeform",
    },
    preActionSnapshot: {
      currentScene: {
        path: "wiki/current-scene/scene_state.md",
        summary: "Iven and Mira face a locked canal gate under curfew.",
        currentTime: "Late night",
        currentLocation: "River Port canal gate",
        visibleSituation: "A sigil glows on the gate and patrol lanterns move above.",
        presentCharacters: ["player:Iven", "character:Mira"],
        interactableObjects: ["item:lantern-key", "location:canal-gate-sigil"],
        currentDangers: ["The Harbor Watch patrol may return."],
        locationActionConditions: ["The gate is warded and cannot be opened silently without reading the sigil."],
        lastTurnSummary: "Mira warned Iven that loud magic would draw the patrol.",
      },
      player: {
        stateSummary: "Iven is a smuggler-mage carrying a brass lantern key.",
        abilities: ["Can sense weak ward pressure through touch."],
        inventory: ["Brass lantern key"],
        goals: ["Open the canal gate without alerting the Harbor Watch."],
        knownInformation: ["Mira recognizes canal ward marks but has not explained why."],
        knownInformationPath: "wiki/player/known_information.md",
        conditionNotes: ["Uninjured but under time pressure."],
      },
      activeClocks: [
        {
          clockId: "clock-harbor-watch-return",
          label: "Harbor Watch return",
          summary: "Patrol may return if the scene drags or becomes loud.",
          urgency: "medium",
          narrativeLine: "playerVisibleLine",
        },
      ],
      countdowns: [],
      pendingReactions: [
        {
          reactionId: "reaction-mira-wary",
          actorRef: "character:Mira",
          summary: "Mira is ready to stop Iven from touching the sigil too quickly.",
          visibilityScope: "pc_visible",
        },
      ],
      pacingState: {
        summary: "The last turn advanced investigation but not the gate objective.",
        pacingDebt: "low",
        recentLowProgressTurnCount: 1,
        expectedCampaignDelta: "Resolve whether the sigil can be safely touched.",
      },
      outlineProgress: {
        progressPath: "wiki/outlines/progress.md",
        currentBeat: "Decode the canal gate sigil before opening the lower route.",
        adjacentBeats: ["Open the quiet route", "Avoid revealing the gate patron"],
        branchConditions: ["Forcing the gate loudly alerts the Harbor Watch."],
        progressSummary: "The party is between investigation and route-opening beats.",
      },
      rulesExcerpts: [
        {
          ruleId: "ward-touch-risk",
          path: "wiki/rules/core.md",
          excerpt: "Unknown wards require inspection before touch; reckless contact may trigger a backlash.",
          usePurpose: "ruleCheck",
        },
      ],
      references: [
        "wiki/current-scene/scene_state.md",
        "wiki/player/known_information.md",
        "wiki/outlines/progress.md",
        "wiki/rules/core.md",
      ],
    },
    relevantRules: [
      {
        ruleId: "ward-touch-risk",
        path: "wiki/rules/core.md",
        excerpt: "Unknown wards require inspection before touch; reckless contact may trigger a backlash.",
        usePurpose: "ruleCheck",
      },
    ],
    fixedSlotRefs: [
      {
        path: "wiki/current-scene/scene_state.md",
        role: "preActionSceneSnapshot",
        summary: "Frozen current scene snapshot.",
        required: true,
      },
      {
        path: "wiki/player/known_information.md",
        role: "playerKnowledgeBoundary",
        summary: "Only PC-known or PC-misunderstood information.",
        required: true,
      },
      {
        path: "wiki/outlines/progress.md",
        role: "outlineRelativeProgress",
        summary: "Current and adjacent outline beats.",
        required: true,
      },
      {
        path: "wiki/rules/core.md",
        role: "actionAdjudicationRules",
        summary: "Executable ward-touch adjudication rule.",
        required: true,
      },
    ],
    recentTurnSummary: "Iven prepared to use the lantern key, but Mira warned him to inspect the sigil first.",
    runtimeRefs: [sampleDeltaRef()],
  }
}

async function writeActionResolverWikiFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    [
      "# Current Scene",
      "",
      "Current Time: Late night",
      "Current Location: River Port canal gate",
      "Iven and Mira face the locked canal gate while the lowest sigil glows.",
      "- Present Characters: Iven, Mira",
      "- Interactable Objects: brass lantern key, lowest sigil",
      "- Active Clock: Harbor Watch return pressure is medium.",
      "- Pending Reaction: Mira will stop reckless ward contact.",
      "- Background Archive: Saber and Ea are unrelated encyclopedia terms, not active scene refs.",
    ].join("\n"),
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nIven is a smuggler-mage under patrol pressure.")
  await writeFileRaw(`${projectPath}/wiki/player/abilities.md`, "# Abilities\n\n- Can sense weak ward pressure.")
  await writeFileRaw(`${projectPath}/wiki/player/inventory.md`, "# Inventory\n\n- brass lantern key")
  await writeFileRaw(`${projectPath}/wiki/player/goals.md`, "# Goals\n\n- open the canal gate quietly")
  await writeFileRaw(
    `${projectPath}/wiki/player/known_information.md`,
    "# Known Information\n\n- Mira recognizes canal ward marks.",
  )
  await writeFileRaw(`${projectPath}/wiki/rules/core.md`, "# Core Rules\n\nUnknown wards require inspection before touch.")
  await writeFileRaw(`${projectPath}/wiki/rules/world.md`, "# World Rules\n\nCanal wards answer keyed brass.")
  await writeFileRaw(`${projectPath}/wiki/rules/table.md`, "# Table Rules\n\nRisky magic under patrol pressure costs time.")
  await writeFileRaw(`${projectPath}/wiki/characters/mira.md`, "# Mira\n\nMira reads canal sigils carefully.")
  await writeFileRaw(
    `${projectPath}/wiki/characters/runtime/mira.md`,
    "# Mira Runtime\n\nMira runtime overlay: limping, wary, ready to react.",
  )
  await writeFileRaw(`${projectPath}/wiki/locations/river-port.md`, "# River Port\n\nCanal gate sigils control quiet routes.")
  await writeFileRaw(
    `${projectPath}/wiki/locations/runtime/river-port.md`,
    "# River Port Runtime\n\nRiver Port runtime overlay: patrol lights move above the gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/items/lantern-key.md`, "# Lantern Key\n\nA brass lantern key fits canal wards.")
  await writeFileRaw(
    `${projectPath}/wiki/items/runtime/lantern-key.md`,
    "# Lantern Key Runtime\n\nlantern key runtime overlay: the lowest tooth glows near the sigil.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/characters/runtime/saber.md`,
    "# Saber Runtime\n\nUNRELATED_SABER_RUNTIME_POISON",
  )
  await writeFileRaw(
    `${projectPath}/wiki/items/ea.md`,
    "# Ea\n\nUNRELATED_EA_ITEM_POISON",
  )
  await writeFileRaw(
    `${projectPath}/wiki/factions/runtime/harbor-watch.md`,
    "# Harbor Watch Runtime\n\nHarbor Watch runtime overlay: patrol may return if magic flares.",
  )
  await writeFileRaw(`${projectPath}/wiki/quests/quiet-canal-route.md`, "# Quiet canal route\n\nOpen the quiet route.")
  await writeFileRaw(`${projectPath}/wiki/outlines/progress.md`, "# Progress\n\nCurrent Beat: Decode the gate sigil.")
}

function sampleActionResolution(): ActionResolution {
  const deltaRef = sampleDeltaRef()

  return {
    resolutionId: "action-resolution-act-1",
    submittedActionId: "act-1",
    parsedIntent: {
      intentKind: "investigate",
      actorRef: "player:Iven",
      targetRefs: ["character:Mira", "location:canal-gate-sigil", "item:lantern-key"],
      actionScope: "Ask Mira to inspect the sigil before any physical contact.",
      declaredGoal: "Determine whether the lantern key can be used quietly and safely.",
      ambiguityNotes: [],
    },
    eventDraft: {
      eventId: "event-draft-act-1-sigil-inspection",
      eventType: "investigation_attempt",
      summary: "Iven attempts to get Mira's read on the canal-gate sigil before touching it with the key.",
      status: ACTION_RESOLVER_DEFAULT_EVENT_STATUS,
      actorRefs: ["player:Iven"],
      targetRefs: ["character:Mira", "location:canal-gate-sigil"],
      affectedRefs: ["wiki/current-scene/scene_state.md", "wiki/player/known_information.md"],
      riskSummary: "The attempt is low risk if Mira answers before Iven touches the ward.",
      requiredChecks: ["Mira must be willing and able to interpret the sigil quickly."],
      ambiguityNotes: [],
    },
    feasibility: {
      status: "partially_feasible",
      rationale: "Asking Mira is feasible, but the answer may be incomplete under patrol pressure.",
      limitingFactors: ["Mira is injured and wary of loud magic.", "The patrol clock is active."],
      requiredChecks: ["Whether Mira recognizes this exact ward mark."],
      alternativeResults: ["Mira can warn Iven what not to touch even if she cannot decode everything."],
    },
    costs: [
      {
        costId: "cost-time-inspection",
        kind: "time",
        description: "The exchange and inspection consume a few focused minutes.",
        appliesIf: "Iven waits for Mira to inspect instead of touching the sigil immediately.",
      },
    ],
    obstacles: [
      {
        obstacleId: "obstacle-incomplete-sigil",
        severity: "moderate",
        description: "The sigil is cracked, so Mira may only identify part of the ward.",
        bypassHint: "Combine Mira's read with the lantern key's reaction.",
      },
    ],
    directResults: [
      {
        resultId: "direct-result-sigil-read-started",
        summary: "The direct result is the start of a cautious sigil read, not a completed gate opening.",
        happenedStatus: "attempted_not_confirmed",
        visibilityScope: "pc_visible",
        affectedRefs: ["wiki/current-scene/scene_state.md"],
      },
    ],
    timeDelta: {
      scale: "minutes",
      unit: "minutes",
      min: 2,
      max: 5,
      summary: "A focused question and ward inspection naturally take a few minutes.",
      reasoning: "Mira needs time to look over the cracked mark while patrol pressure remains relevant.",
    },
    progressPotential: {
      level: "medium",
      summary: "The action may reveal safe use conditions for the lantern key and advance the gate objective.",
      possibleUnlocks: ["Safe key contact", "Patrol-risk tradeoff", "Mira's hidden ward knowledge"],
      gapTriggerPotential: "minor",
    },
    playerActionDelta: {
      deltaId: "player-action-delta-act-1",
      causedByActionId: "act-1",
      scope: "player_action_only",
      positionChanges: [],
      resourceChanges: [],
      inventoryChanges: [],
      conditionChanges: [],
      knowledgeChanges: ["Potentially learns whether the sigil is safe to touch."],
      relationshipSignals: ["Iven defers to Mira's expertise instead of grandstanding."],
      sceneChanges: ["Attention shifts from forcing the gate to interpreting the sigil."],
      interruptedEvents: [],
      exposedInformation: ["Mira may reveal familiarity with canal wards."],
      runtimeDeltaRefs: [deltaRef],
      notes: ["No wiki write, narration, or world tick is included."],
    },
    runtimeDeltaRefs: [deltaRef],
    references: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.active_clocks",
        reason: "Provides the current gate, patrol, and scene pressure.",
        usePurpose: "actionResolution",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
      },
      {
        path: "wiki/rules/core.md",
        sectionId: "rules.ward_touch",
        reason: "Defines the ward inspection risk.",
        usePurpose: "ruleCheck",
      },
    ],
    warnings: [],
  }
}

function sampleDeltaRef(): ActionResolution["runtimeDeltaRefs"][number] {
  return {
    deltaId: "delta-act-1-sigil-read",
    sourceStage: "actionResolution",
    sourcePath: ".llm-wiki/runtime/turns/act-1/action-resolution.json",
    summary: "Iven attempts a cautious sigil inspection with Mira before touching the ward.",
    narrativeLine: "playerVisibleLine",
    usePurpose: "actionResolution",
    happenedStatus: "attempted_not_confirmed",
  }
}

function cloneResolution(): any {
  return JSON.parse(JSON.stringify(sampleActionResolution()))
}

function samplePrompt(): RpgActionResolverPrompt {
  return {
    systemPrompt: "System action resolver instructions.",
    userPrompt: "User action resolver input.",
  }
}

function expectPromptDebugSectionsRecompose(prompt: RpgActionResolverPrompt): void {
  const sections = prompt.debugSections ?? []
  expect(sections.filter((section) => section.promptRole === "system").map((section) => section.content).join("\n\n")).toBe(
    prompt.systemPrompt,
  )
  expect(sections.filter((section) => section.promptRole === "user").map((section) => section.content).join("\n\n")).toBe(
    prompt.userPrompt,
  )
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
