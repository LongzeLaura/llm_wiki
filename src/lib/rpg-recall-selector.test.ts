import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildRecallSelectorPrompt,
  createFixtureRecallSelectorAdapter,
  createLlmRpgRecallSelectorAdapter,
  getRpgInteractionRegistryEntry,
  parseRpgRecallSelectionOutput,
  recallSelectorInteractionSpec,
  validateRecallSelection,
} from "./rpg-interactions"
import {
  sampleActionResolution,
  samplePostActionWorkingState,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import type {
  RecallBudget,
  RecallPolicy,
  RecallSelection,
  RecallSelectorInput,
  RetrievalIndexEntry,
  SubmittedAction,
} from "./rpg-runtime"
import { RPG_SCHEMA_SLOTS, RPG_WIKI_SCHEMA } from "./rpg-wiki-schema"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

afterEach(() => {
  streamChatMock.mockReset()
})

describe("RPG Recall Selector interaction", () => {
  it("builds a prompt around PostActionWorkingState and Recall Selector boundaries", () => {
    const prompt = buildRecallSelectorPrompt(sampleRecallSelectorInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(recallSelectorInteractionSpec.kind).toBe("recall_selector")
    expect(combined).toContain("PostActionWorkingState")
    expect(combined).toContain("post-action")
    expect(combined).toContain("not old current-scene coarse recall")
    expect(combined).toContain("recall plan")
    expect(combined).toContain("allowlist")
    expect(combined).toContain("cannot read files")
    expect(combined).toContain("cannot generate narration")
    expect(combined).toContain("cannot write wiki")
    expect(combined).toContain("cannot generate update proposal")
    expect(combined).toContain("Do not enter LLM 4")
    expect(combined).toContain("Outline-aware Brief")
    expect(combined).toContain("Outline Impact")
    expect(combined).toContain("Outline Regeneration")
    expect(combined).toContain("outlineBrief")
    expect(combined).toContain("outlineImpactReport")
    expect(combined).toContain("provisionalOutlinePatch")
    expect(combined).toContain("regenerationRequest")
    expect(combined).toContain("stable sectionId")
    expect(combined).toContain("lineTarget")
    expect(combined).toContain("visibilityScope")
    expect(combined).toContain("knowledgeScope")
    expect(combined).toContain("priority")
    expect(combined).toContain("reason")
    expect(combined).toContain("expectedUse")
    expect(combined).toContain("Exclusions")
    expect(combined).toContain("parallelLine")
    expect(combined).toContain("user_visible_pc_unknown")
    expect(combined).toContain("must never be marked as PC knowledge")
  })

  it("parses bare RecallSelection JSON", () => {
    const input = sampleRecallSelectorInput()
    const selection = sampleRecallSelection()

    expect(parseRpgRecallSelectionOutput(JSON.stringify(selection), input)).toEqual(selection)
  })

  it("parses fenced RecallSelection JSON", () => {
    const input = sampleRecallSelectorInput()
    const selection = sampleRecallSelection()

    expect(
      parseRpgRecallSelectionOutput(["```json", JSON.stringify(selection, null, 2), "```"].join("\n"), input),
    ).toEqual(selection)
  })

  it("accepts a legal RecallSelection", () => {
    const input = sampleRecallSelectorInput()
    const selection = sampleRecallSelection()

    expect(validateRecallSelection(selection, input)).toEqual(selection)
  })

  it("rejects selected path not present in retrievalIndex", () => {
    const input = sampleRecallSelectorInput()
    const selection = cloneSelection()
    selection.selectedItems[0].path = "wiki/locations/unknown.md"

    expect(() => validateRecallSelection(selection, input)).toThrow(/retrievalIndex/i)
  })

  it("rejects selected sectionId not present in the entry availableSections", () => {
    const input = sampleRecallSelectorInput()
    const selection = cloneSelection()
    selection.selectedItems[0].sections[0].sectionId = "natural-heading-only"

    expect(() => validateRecallSelection(selection, input)).toThrow(/sectionId/i)
  })

  it("rejects selected sections that use only a natural heading without sectionId", () => {
    const input = sampleRecallSelectorInput()
    const selection = cloneSelection()
    delete (selection.selectedItems[0].sections[0] as unknown as Record<string, unknown>).sectionId
    ;(selection.selectedItems[0].sections[0] as unknown as Record<string, unknown>).heading = "Visible Deltas"

    expect(() => validateRecallSelection(selection, input)).toThrow(/sectionId/i)
  })

  it("rejects illegal lineTarget, readMode, and priority", () => {
    const invalidLine = cloneSelection()
    invalidLine.selectedItems[0].lineTarget = "wrongLine" as RecallSelection["selectedItems"][number]["lineTarget"]
    expect(() => validateRecallSelection(invalidLine, sampleRecallSelectorInput())).toThrow(/lineTarget/i)

    const invalidReadMode = cloneSelection()
    invalidReadMode.selectedItems[0].readMode = "readEverything" as RecallSelection["selectedItems"][number]["readMode"]
    expect(() => validateRecallSelection(invalidReadMode, sampleRecallSelectorInput())).toThrow(/readMode/i)

    const invalidPriority = cloneSelection()
    invalidPriority.selectedItems[0].priority = "urgent" as RecallSelection["selectedItems"][number]["priority"]
    expect(() => validateRecallSelection(invalidPriority, sampleRecallSelectorInput())).toThrow(/priority/i)
  })

  it("rejects parallelLine or user_visible_pc_unknown material marked as PC knowledge", () => {
    const parallelPcKnown = cloneSelection()
    parallelPcKnown.selectedItems[1].knowledgeScope = "pc_known"
    expect(() => validateRecallSelection(parallelPcKnown, sampleRecallSelectorInput())).toThrow(/PC knowledge/i)

    const userVisiblePcKnown = cloneSelection()
    userVisiblePcKnown.selectedItems[0].visibilityScope = "user_visible_pc_unknown"
    userVisiblePcKnown.selectedItems[0].knowledgeScope = "pc_misunderstanding"
    expect(() => validateRecallSelection(userVisiblePcKnown, sampleRecallSelectorInput())).toThrow(/PC knowledge/i)
  })

  it("rejects a GM-only retrieval entry relabeled as PC-visible or PC-known", () => {
    const selection = cloneSelection()
    selection.selectedItems[2].visibilityScope = "pc_visible"
    selection.selectedItems[2].knowledgeScope = "pc_known"

    expect(() => validateRecallSelection(selection, sampleRecallSelectorInput())).toThrow(/retrievalIndex entry/i)
  })

  it("rejects a GM-only selected section relabeled as PC-visible or PC-known", () => {
    const input = sampleRecallSelectorInput()
    const sceneEntry = input.retrievalIndex.find((entry) => entry.path === "wiki/current-scene/scene_state.md")
    if (!sceneEntry) throw new Error("missing fixture scene entry")
    sceneEntry.availableSections[0] = {
      ...sceneEntry.availableSections[0],
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
    }

    expect(() => validateRecallSelection(cloneSelection(), input)).toThrow(/retrievalIndex section/i)
  })

  it("rejects selected items and sections that exceed the input recall budget", () => {
    const tooManyItemsInput = sampleRecallSelectorInput()
    tooManyItemsInput.recallBudget = {
      ...tooManyItemsInput.recallBudget,
      maxItems: 2,
    }
    const tooManyItems = cloneSelection()
    tooManyItems.recallBudget = {
      ...tooManyItems.recallBudget,
      maxItems: 2,
    }
    expect(() => validateRecallSelection(tooManyItems, tooManyItemsInput)).toThrow(/selected item count/i)

    const tooManySectionsInput = sampleRecallSelectorInput()
    tooManySectionsInput.recallBudget = {
      ...tooManySectionsInput.recallBudget,
      maxSections: 2,
    }
    const tooManySections = cloneSelection()
    tooManySections.recallBudget = {
      ...tooManySections.recallBudget,
      maxSections: 2,
    }
    expect(() => validateRecallSelection(tooManySections, tooManySectionsInput)).toThrow(/selected section count/i)
  })

  it("rejects fullPage reads and widened recall policy when input disallows full-page recall", () => {
    const fullPage = cloneSelection()
    fullPage.selectedItems[0].readMode = "fullPage"
    expect(() => validateRecallSelection(fullPage, sampleRecallSelectorInput())).toThrow(/fullPage/i)

    const widenedPolicy = cloneSelection()
    widenedPolicy.recallPolicy = {
      ...widenedPolicy.recallPolicy,
      allowFullPageRead: true,
    }
    expect(() => validateRecallSelection(widenedPolicy, sampleRecallSelectorInput())).toThrow(/allowFullPageRead/i)
  })

  it("rejects exclusions that reference unknown paths or sections", () => {
    const unknownPath = cloneSelection()
    unknownPath.exclusions[0].path = "wiki/items/missing.md"
    expect(() => validateRecallSelection(unknownPath, sampleRecallSelectorInput())).toThrow(/exclusion path/i)

    const unknownSection = cloneSelection()
    unknownSection.exclusions[0].sectionIds = ["unknown.section"]
    expect(() => validateRecallSelection(unknownSection, sampleRecallSelectorInput())).toThrow(/sectionId/i)
  })

  it("rejects forbidden pollution fields", () => {
    const pollutedOutputs = [
      { narration: "Narration belongs later." },
      { playerFacingText: "Visible prose belongs later." },
      { parallelLineText: "Parallel prose belongs later." },
      { nextActionOptions: [] },
      { wikiWrites: [] },
      { wikiWriteProposal: {} },
      { proposedUpdates: [] },
      { pendingUpdates: [] },
      { recalledMaterials: [{ path: "wiki/current-scene/scene_state.md", fullText: "Do not include full text." }] },
      { outlineBrief: {} },
      { outlineImpactReport: {} },
      { outlineRevision: {} },
      { outlineRevisionProposal: {} },
      { provisionalOutlinePatch: {} },
      { regenerationRequest: {} },
    ]

    for (const pollution of pollutedOutputs) {
      const selection = cloneSelection()
      Object.assign(selection, pollution)

      expect(() => validateRecallSelection(selection, sampleRecallSelectorInput())).toThrow(/RecallSelection/i)
    }
  })

  it("creates a fixture Recall Selector adapter that returns a legal selection", async () => {
    const input = sampleRecallSelectorInput()
    const selection = sampleRecallSelection()
    const adapter = createFixtureRecallSelectorAdapter(selection)

    await expect(adapter.selectRecall(buildRecallSelectorPrompt(input), input)).resolves.toEqual(selection)
  })

  it("creates an LLM Recall Selector adapter that streams output and calls the parser", async () => {
    const input = sampleRecallSelectorInput()
    const selection = sampleRecallSelection()
    const prompt = buildRecallSelectorPrompt(input)
    const output = ["```json\n", JSON.stringify(selection), "\n```"].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1200 }

    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(output.slice(0, 16))
      callbacks.onToken(output.slice(16))
      callbacks.onDone()
    })

    const adapter = createLlmRpgRecallSelectorAdapter({ llmConfig: sampleLlmConfig(), signal }, { requestOverrides })

    await expect(adapter.selectRecall(prompt, input)).resolves.toEqual(selection)
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

  it("exposes recall_selector in the RPG interaction registry", () => {
    expect(getRpgInteractionRegistryEntry("recall_selector")).toMatchObject({
      kind: "recall_selector",
      stage: "runtime_recall_selector",
      usesLlm: true,
      implemented: true,
      spec: recallSelectorInteractionSpec,
    })
  })

  it("connects Recall Selector to runRpgTurn without entering LLM 4", async () => {
    const orchestrator = await fs.readFile("src/lib/rpg-runtime/turn-orchestrator.ts", "utf-8")

    expect(orchestrator).toContain("recallSelectorAdapter")
    expect(orchestrator).toContain("recallSelectorInteractionSpec")
    expect(orchestrator).toContain("createRecallSelectorHandoff")
    expect(orchestrator).not.toContain("createLlmRpgRecallSelectorAdapter")
    expect(orchestrator.indexOf("recallSelectorAdapter.selectRecall")).toBeLessThan(
      orchestrator.indexOf("buildOutlineBriefInputFromTurnStateAndWiki({"),
    )
    expect(orchestrator.indexOf("createRecallSelectorHandoff")).toBeLessThan(
      orchestrator.indexOf("buildOutlineBriefInputFromTurnStateAndWiki({"),
    )
  })

  it("does not change RPG_SCHEMA_SLOTS or add an ordinary wiki/runtime category", () => {
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("runtime/")
  })
})

type MutableRecallSelection = {
  -readonly [K in keyof RecallSelection]: RecallSelection[K]
} & Record<string, unknown>

function cloneSelection(): MutableRecallSelection {
  return JSON.parse(JSON.stringify(sampleRecallSelection())) as MutableRecallSelection
}

function sampleRecallSelectorInput(): RecallSelectorInput {
  const submittedAction: SubmittedAction = {
    id: "act-recall",
    text: "Wait while Mira reads the canal gate sigil.",
    source: "freeform",
  }
  const actionResolution = sampleActionResolution(submittedAction)
  const worldTickResult = sampleWorldTickResult(actionResolution)
  const visibleSelection = sampleVisibleSelection(actionResolution, worldTickResult)
  const postActionWorkingState = samplePostActionWorkingState(
    submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
  )

  return {
    postActionWorkingState,
    actionResolution,
    worldTickResult,
    visibleSelection,
    pacingState: postActionWorkingState.pacingState,
    gapState: postActionWorkingState.gapState,
    retrievalIndex: sampleRetrievalIndex(),
    recallBudget: sampleRecallBudget(),
    recallPolicy: sampleRecallPolicy(),
  }
}

function sampleRecallSelection(): RecallSelection {
  return {
    selectionId: "recall-selection-act-recall",
    sourceWorkingStateId: "act-recall",
    selectedItems: [
      {
        path: "wiki/current-scene/scene_state.md",
        lineTarget: "playerVisibleLine",
        readMode: "focusedSection",
        priority: "critical",
        reason: "Current visible consequences and active clocks constrain immediate narration.",
        expectedUse: "Anchor player-visible scene facts after the World Tick.",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        sections: [
          {
            sectionId: "currentScene.visible_deltas",
            reason: "Stable section for visible post-action deltas.",
            expectedUse: "Prevent narration from inventing a different scene state.",
            priority: "critical",
          },
        ],
      },
      {
        path: "wiki/factions/runtime/harbor-watch.md",
        lineTarget: "parallelLine",
        readMode: "focusedSection",
        priority: "high",
        reason: "World Tick selected a user-visible PC-unknown Harbor Watch parallel lens.",
        expectedUse: "Let later brief decide whether to include parallel-line pressure without granting PC knowledge.",
        visibilityScope: "user_visible_pc_unknown",
        knowledgeScope: "user_only",
        sections: [
          {
            sectionId: "factionRuntime.current_order",
            reason: "Stable section for the captain order referenced by the World Tick.",
            expectedUse: "Support parallel-line context only.",
            priority: "high",
          },
        ],
      },
      {
        path: "wiki/outlines/progress.md",
        lineTarget: "tensionLine",
        readMode: "summary",
        priority: "medium",
        reason: "Gap state points at the canal-gate beat but is not an outline rewrite.",
        expectedUse: "Help LLM 4 later screen adjacent beats without entering outline regeneration here.",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        sections: [
          {
            sectionId: "outlineProgress.adjacent_beats",
            reason: "Stable adjacent-beat section.",
            expectedUse: "Keep recall bounded to beat context.",
            priority: "medium",
          },
        ],
      },
    ],
    exclusions: [
      {
        path: "wiki/plot-arcs/runtime/canal-gate.md",
        sectionIds: ["plotArc.future_branches"],
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        reason: "Future branch material belongs to later outline filtering, not this recall plan.",
      },
    ],
    recallBudget: sampleRecallBudget(),
    recallPolicy: sampleRecallPolicy(),
    warnings: [],
  }
}

function sampleRetrievalIndex(): RetrievalIndexEntry[] {
  return [
    {
      path: "wiki/current-scene/scene_state.md",
      title: "Current Scene",
      categoryId: "current-scene",
      summary: "Latest canal gate scene snapshot.",
      lineTargets: ["playerVisibleLine", "tensionLine"],
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      availableSections: [
        {
          sectionId: "currentScene.visible_deltas",
          sectionRole: "current_visible_state",
          heading: "Visible Deltas",
          aliases: ["Current visible state"],
          lineTargets: ["playerVisibleLine"],
          readModes: ["summary", "focusedSection"],
          visibilityScope: "pc_visible",
          knowledgeScope: "pc_known",
          summary: "Player-visible consequences selected from working state.",
        },
      ],
      tags: ["scene", "clock"],
    },
    {
      path: "wiki/factions/runtime/harbor-watch.md",
      title: "Harbor Watch Runtime",
      categoryId: "factions",
      summary: "Runtime faction movement around the canal.",
      lineTargets: ["parallelLine"],
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
      availableSections: [
        {
          sectionId: "factionRuntime.current_order",
          sectionRole: "parallel_line_order",
          heading: "Current Order",
          aliases: ["Watch captain order"],
          lineTargets: ["parallelLine"],
          readModes: ["summary", "focusedSection"],
          visibilityScope: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
          summary: "PC-unknown order available only as parallel-line material.",
        },
      ],
      tags: ["parallel", "faction"],
    },
    {
      path: "wiki/outlines/progress.md",
      title: "Outline Progress",
      categoryId: "outlines",
      summary: "Current position relative to the canal gate beat.",
      lineTargets: ["tensionLine"],
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
      availableSections: [
        {
          sectionId: "outlineProgress.adjacent_beats",
          sectionRole: "adjacent_beat_context",
          heading: "Adjacent Beats",
          aliases: ["Nearby outline beats"],
          lineTargets: ["tensionLine"],
          readModes: ["summary"],
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
          summary: "Adjacent beats for later outline-aware brief screening.",
        },
      ],
      tags: ["outline", "gap"],
    },
    {
      path: "wiki/plot-arcs/runtime/canal-gate.md",
      title: "Canal Gate Runtime Plot Pressure",
      categoryId: "plot-arcs",
      summary: "Runtime plot pressure and possible branch fuel.",
      lineTargets: ["tensionLine"],
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
      availableSections: [
        {
          sectionId: "plotArc.future_branches",
          sectionRole: "future_branch_fuel",
          heading: "Future Branches",
          aliases: ["Possible branches"],
          lineTargets: ["tensionLine"],
          readModes: ["summary"],
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
          summary: "Possible future branches excluded from this recall plan.",
        },
      ],
      tags: ["plot-arc"],
    },
  ]
}

function sampleRecallBudget(): RecallBudget {
  return {
    maxItems: 4,
    maxSections: 6,
    maxEstimatedTokens: 2200,
    preferredLineTargets: ["playerVisibleLine", "parallelLine", "tensionLine"],
  }
}

function sampleRecallPolicy(): RecallPolicy {
  return {
    allowFullPageRead: false,
    requireStableSectionIds: true,
    pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
    parallelLineDoesNotGrantPcKnowledge: true,
    notes: ["Select by stable sectionId only.", "Parallel-line display is not PC knowledge."],
  }
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
