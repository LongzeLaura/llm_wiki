import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildNarrationGeneratorPrompt,
  createFixtureNarrationGeneratorAdapter,
  createLlmRpgNarrationGeneratorAdapter,
  getRpgInteractionRegistryEntry,
  narrationGeneratorInteractionSpec,
  parseRpgNarrationGeneratorOutput,
  validateTurnNarration,
} from "./rpg-interactions"
import {
  sampleRecalledMaterials,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"
import { buildNarrationGeneratorInputFromHandoffs } from "./rpg-runtime"
import type {
  NarrationGeneratorInput,
  NarrationSourceRef,
  PlayerKnowledgeBoundary,
  TurnNarration,
} from "./rpg-runtime"
import { RPG_SCHEMA_SLOTS, RPG_WIKI_SCHEMA } from "./rpg-wiki-schema"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))
vi.mock("@/commands/fs", () => realFs)

const streamChatMock = vi.mocked(streamChat)
let tmpProject: { path: string; cleanup: () => Promise<void> } | undefined

afterEach(async () => {
  streamChatMock.mockReset()
  if (tmpProject) {
    await tmpProject.cleanup()
    tmpProject = undefined
  }
})

describe("RPG Narration Generator interaction", () => {
  it("constructs runtime-only types without creating wiki slot authority", () => {
    const input: NarrationGeneratorInput = sampleNarrationGeneratorInput()
    const output: TurnNarration = sampleTurnNarration()

    expect(input.styleBundle.styleIsNotWorldFact).toBe(true)
    expect(input.playerKnowledgeBoundary.parallelLineDoesNotGrantPcKnowledge).toBe(true)
    expect(output.displayPolicy.parallelLineGrantsPcKnowledge).toBe(false)
    expect(output.tensionBrief.ordinaryEventFact).toBe(false)
    expect(output.nextActionOptions.every((option) => option.optionOnly)).toBe(true)
  })

  it("builds NarrationGeneratorInput from handoffs plus dedicated style/rules/memory readers", async () => {
    tmpProject = await createTempProject("rpg-narration-input-builder")
    await writeNarrationFixture(tmpProject.path)
    const baseInput = sampleNarrationGeneratorInput()

    const { input, warnings } = await buildNarrationGeneratorInputFromHandoffs({
      projectPath: tmpProject.path,
      actionResolution: baseInput.actionResolution,
      worldTickResult: baseInput.worldTickResult,
      visibleSelection: baseInput.visibleSelection,
      postActionWorkingState: baseInput.postActionWorkingState,
      recallSelection: baseInput.recallSelection,
      recalledMaterials: baseInput.recalledMaterials,
      outlineAwareNarrationBrief: baseInput.outlineAwareNarrationBrief,
      provisionalNarrationHandoff: baseInput.provisionalNarrationHandoff,
    })

    expect(warnings).toEqual([])
    expect(input.postActionWorkingState).toBe(baseInput.postActionWorkingState)
    expect(input.actionResolution).toBe(baseInput.actionResolution)
    expect(input.worldTickResult).toBe(baseInput.worldTickResult)
    expect(input.visibleSelection).toBe(baseInput.visibleSelection)
    expect(input.recallSelection).toBe(baseInput.recallSelection)
    expect(input.recalledMaterials).toBe(baseInput.recalledMaterials)
    expect(input.outlineAwareNarrationBrief).toBe(baseInput.outlineAwareNarrationBrief)
    expect(input.styleBundle.toneRules.join("\n")).toContain("tense, grounded, sensory narration")
    expect(input.styleBundle.dictionRules.join("\n")).toContain("short dialogue beats")
    expect(input.styleBundle.pacingRules.join("\n")).toContain("prefers cautious investigation")
    expect(input.styleBundle.sourceRefs.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        "wiki/style/narration.md",
        "wiki/style/dialogue.md",
        "wiki/style/forbidden.md",
        "wiki/memory/player-preferences.md",
      ]),
    )
    expect(
      input.forbiddenNarrationConstraints.some((constraint) =>
        constraint.sourcePath === "wiki/style/forbidden.md" &&
        constraint.mustNotReveal.some((item) => item.includes("forbid naming the gate patron"))
      ),
    ).toBe(true)
    expect(
      input.forbiddenNarrationConstraints.some((constraint) =>
        constraint.sourcePath === "wiki/rules/core.md" &&
        constraint.mustNotReveal.some((item) => item.includes("Never declare the PC knows hidden orders"))
      ),
    ).toBe(true)
    expect(input.forbiddenNarrationConstraints.some((constraint) => constraint.lineTarget === "parallelLine")).toBe(true)
    expect(input.playerKnowledgeBoundary.allowedKnowledgeRefs.map((ref) => ref.path)).toContain(
      "wiki/player/known_information.md",
    )
    expect(input.playerKnowledgeBoundary.parallelLineDoesNotGrantPcKnowledge).toBe(true)
    expect(input.references.map((ref) => ref.path)).toEqual(
      expect.arrayContaining([
        "wiki/style/narration.md",
        "wiki/style/dialogue.md",
        "wiki/style/forbidden.md",
        "wiki/memory/player-preferences.md",
        "wiki/rules/core.md",
        "wiki/player/known_information.md",
      ]),
    )
  })

  it("builds a prompt with the LLM 5 knowledge and output boundaries", () => {
    const prompt = buildNarrationGeneratorPrompt(sampleNarrationGeneratorInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(narrationGeneratorInteractionSpec.kind).toBe("narration_generator")
    expect(combined).toContain("playerFacingText")
    expect(combined).toContain("parallelLineText")
    expect(combined).toContain("tensionBrief")
    expect(combined).toContain("narrationSelfReport")
    expect(combined).toContain("nextActionOptions")
    expect(combined).toContain('"narrationSelfReport"?:')
    expect(combined).toContain("不要输出 displayPolicy、narrationMeta、references")
    expect(combined).toContain("provisionalOutlinePatch.narrationHandoff")
    expect(combined).toContain("outlineRevisionProposal 不是 Narration 的事实材料")
    expect(combined).toContain("parallel line 的展示不等于 PC 已知")
    expect(combined).toContain("style 不会变成世界 / 剧情事实")
    expect(combined).toContain("TurnSemanticHandoff")
    expect(combined).toContain("OutlineAwareNarrationBrief")
    expect(combined).toContain("RecallSelection")
    expect(combined).toContain("recalledMaterials")
    expect(combined).toContain("禁止叙事约束")
    expect(combined).toContain('"reviewHandoff": string')
    expect(combined).toContain('"followedPacingIntent"')
    expect(combined).toContain("option-only future actions")
    expect(combined).not.toContain('"likelyAffectedPaths": string[]')
    expect(combined).not.toContain('"tensionBrief": TensionBrief')
    expect(combined).not.toContain('"displayPolicy": NarrationDisplayPolicy')
    expect(combined).not.toContain('"narrationMeta": NarrationMeta')
    expect(combined).not.toContain('"nextActionOptions": RuntimeNarrationActionOption[]')
    expect(combined).not.toContain('"references": NarrationSourceRef[]')
    expect(prompt.debugSections?.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "系统固定提示词",
        "TurnSemanticHandoff",
        "OutlineAwareNarrationBrief",
        "provisionalOutlinePatch.narrationHandoff / provisionalNarrationHandoff",
        "RecallSelection",
        "recalledMaterials",
        "style bundle",
        "禁止叙事约束",
        "玩家知识边界",
        "references / runtime refs",
      ]),
    )
    expectPromptDebugSectionsRecompose(prompt)
  })

  it("parses bare and fenced TurnNarrationDraft JSON", () => {
    const input = sampleNarrationGeneratorInput()
    const draft = sampleTurnNarrationDraft()

    expect(parseRpgNarrationGeneratorOutput(JSON.stringify(draft), input).playerFacingText).toBe(draft.playerFacingText)
    expect(
      parseRpgNarrationGeneratorOutput(["```json", JSON.stringify(draft, null, 2), "```"].join("\n"), input),
    ).toMatchObject({ playerFacingText: draft.playerFacingText })
  })

  it("escapes raw newlines inside TurnNarrationDraft strings before parsing", () => {
    const input = sampleNarrationGeneratorInput()
    const draft = sampleTurnNarrationDraft()
    const output = JSON.stringify(draft, null, 2).replace(
      "Mira studies the cracked mark and points to the safe edge of the sigil.",
      "Mira studies the cracked mark.\nShe points to the safe edge of the sigil.",
    )
    const reports: unknown[] = []

    const parsed = parseRpgNarrationGeneratorOutput(output, input, {
      onJsonParseReport: (report) => reports.push(report),
    })

    expect(parsed.playerFacingText).toContain("Mira studies the cracked mark.\nShe points")
    expect(reports).toEqual([
      expect.objectContaining({
        operations: expect.arrayContaining(["escaped_raw_newlines_in_strings"]),
        parseSucceeded: true,
      }),
    ])
  })

  it("rejects underspecified legacy TurnNarration output without auto-repair", () => {
    const legacyOutput = {
      playerFacingText: "Mira studies the sigil and points to its safe edge.",
      tensionBrief: "The patrol pressure rises.",
      displayPolicy: {},
      narrationMeta: {},
      nextActionOptions: [],
      references: [],
      warnings: [],
    }

    expect(() => parseRpgNarrationGeneratorOutput(JSON.stringify(legacyOutput), sampleNarrationGeneratorInput())).toThrow(
      /TurnNarrationDraft\.tensionBrief|derivable protocol|displayPolicy|narrationMeta/i,
    )
  })

  it("accepts valid TurnNarration", () => {
    expect(validateTurnNarration(sampleTurnNarration(), sampleNarrationGeneratorInput())).toEqual(sampleTurnNarration())
  })

  it("rejects malformed or polluted TurnNarration output", () => {
    const cases: Array<[string, (output: Record<string, unknown>) => void]> = [
      ["missing playerFacingText", (output) => delete output.playerFacingText],
      ["empty playerFacingText", (output) => { output.playerFacingText = "" }],
      ["tensionBrief as player prose", (output) => { ;(output.tensionBrief as Record<string, unknown>).playerFacing = true }],
      ["nextActionOptions not array", (output) => { output.nextActionOptions = {} }],
      ["illegal option shape", (output) => {
        ;((output.nextActionOptions as Record<string, unknown>[])[0]).happenedStatus = "confirmed_happened"
      }],
      ["references not array", (output) => { output.references = {} }],
      ["illegal reference path", (output) => {
        ;((output.references as Record<string, unknown>[])[0]).path = "wiki/runtime/narration.json"
      }],
      ["wiki writes", (output) => { output.wikiWrites = [] }],
      ["ordinary runtime update", (output) => { output.ordinaryRuntimeUpdate = {} }],
      ["ProposedWikiUpdate", (output) => { output.ProposedWikiUpdate = {} }],
      ["outlineRevisionProposal", (output) => { output.outlineRevisionProposal = {} }],
      ["provisionalOutlinePatch", (output) => { output.provisionalOutlinePatch = {} }],
      ["full outline payload", (output) => { output.fullOutline = "wiki/outlines/main.md payload" }],
      ["parallel line grants PC knowledge", (output) => {
        ;(output.displayPolicy as Record<string, unknown>).parallelLineGrantsPcKnowledge = true
      }],
      ["hidden leak in playerFacingText", (output) => { output.playerFacingText = "Leak gm_only material." }],
      ["respectedMustNotReveal false", (output) => {
        ;(output.narrationMeta as Record<string, unknown>).respectedMustNotReveal = false
      }],
      ["style becomes world fact", (output) => {
        ;(output.narrationMeta as Record<string, unknown>).styleBundleAsWorldFact = true
      }],
      ["tensionBrief ordinary event fact", (output) => {
        ;(output.tensionBrief as Record<string, unknown>).ordinaryEventFact = true
      }],
    ]

    for (const [label, mutate] of cases) {
      const output = cloneTurnNarration() as unknown as Record<string, unknown>
      mutate(output)
      expect(() => validateTurnNarration(output, sampleNarrationGeneratorInput()), label).toThrow(/TurnNarration/i)
    }
  })

  it("rejects provisional patch usage contradictions", () => {
    const output = cloneTurnNarration()
    output.narrationMeta.usedProvisionalPatch = true

    expect(() => validateTurnNarration(output, sampleNarrationGeneratorInput())).toThrow(/usedProvisionalPatch/i)
  })

  it("routes fixture and LLM adapters through parser and validator", async () => {
    const input = sampleNarrationGeneratorInput()
    const draft = sampleTurnNarrationDraft()
    const prompt = buildNarrationGeneratorPrompt(input)

    const fixture = createFixtureNarrationGeneratorAdapter(["```json", JSON.stringify(draft), "```"].join("\n"))
    await expect(fixture.generateNarration(prompt, input)).resolves.toMatchObject({
      playerFacingText: draft.playerFacingText,
    })

    const rawOutput = ["```json\n", JSON.stringify(draft), "\n```"].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1200 }
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(rawOutput.slice(0, 14))
      callbacks.onToken(rawOutput.slice(14))
      callbacks.onDone()
    })

    const llm = createLlmRpgNarrationGeneratorAdapter(
      { llmConfig: sampleLlmConfig(), signal },
      { requestOverrides },
    )
    await expect(llm.generateNarration(prompt, input)).resolves.toMatchObject({
      playerFacingText: draft.playerFacingText,
    })
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

  it("exposes the connected contract through registry and orchestrator wiring", async () => {
    expect(getRpgInteractionRegistryEntry("narration_generator")).toMatchObject({
      kind: "narration_generator",
      stage: "runtime_narration",
      usesLlm: true,
      implemented: true,
      spec: narrationGeneratorInteractionSpec,
    })

    const orchestrator = await fs.readFile("src/lib/rpg-runtime/turn-orchestrator.ts", "utf-8")
    expect(orchestrator).toContain("narrationGeneratorInteractionSpec")
    expect(orchestrator).toContain("buildNarrationGeneratorInputFromHandoffs")
    expect(orchestrator).toContain("RpgNarrationGeneratorAdapter")
    expect(orchestrator).toContain("TurnNarration")
    expect(orchestrator).toContain("RpgTurnResult")
  })

  it("does not change schema slots, wiki runtime category, writer/apply, or UI display integration", async () => {
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime/")

    const runtimeUpdateApply = await fs.readFile("src/lib/rpg-import/runtime-update-apply.ts", "utf-8")
    const controller = await fs.readFile("src/lib/rpg-runtime/runtime-controller.ts", "utf-8")
    const ui = await fs.readFile("src/components/rpg/rpg-runtime-panel.tsx", "utf-8")

    expect(runtimeUpdateApply).not.toContain("narration_generator")
    expect(controller).toContain("TurnNarration")
    expect(controller).not.toContain("narration_generator")
    expect(ui).not.toContain("TurnNarration")
    expect(ui).not.toContain("narration_generator")
  })
})

function cloneTurnNarration(): TurnNarration {
  return JSON.parse(JSON.stringify(sampleTurnNarration())) as TurnNarration
}

function sampleTurnNarrationDraft() {
  return {
    playerFacingText: "Mira studies the cracked mark and points to the safe edge of the sigil.",
    parallelLineText: "Above the canal, the watch captain delays the lower sweep.",
    tensionBrief: {
      summary: "Patrol pressure and Mira's trust remain active.",
      pressureSignals: ["The patrol clock is tighter."],
      relationshipSignals: ["Mira notices Iven waited for her expertise."],
      plotArcSignals: ["The canal gate sequence advances."],
      reviewHandoff: "Keep this as runtime/review context.",
    },
    narrationSelfReport: {
      followedPacingIntent: "followed",
      campaignDelta: "meaningful",
      revealBoundary: "hint_only",
    },
    nextActionOptions: [
      { playerFacingText: "Touch the lantern key to the safe edge.", intent: "use_item", riskLevel: "medium", likelyAffectedPaths: ["wiki/current-scene/scene_state.md"] },
      { playerFacingText: "Ask Mira what the safe edge means.", intent: "talk", riskLevel: "low", likelyAffectedPaths: ["wiki/relationships/runtime/player_mira.md"] },
      { playerFacingText: "Wait and listen for patrol movement.", intent: "wait", riskLevel: "medium", likelyAffectedPaths: ["wiki/current-scene/scene_state.md"] },
    ],
    warnings: [],
  }
}

function sampleNarrationGeneratorInput(): NarrationGeneratorInput {
  const submittedAction = {
    id: "act-narration-generator",
    text: "Ask Mira whether the safe edge of the sigil can open the canal gate quietly.",
    source: "freeform" as const,
  }
  const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, {
    recallSelection: sampleRecallSelection(`post-action-working-state-${submittedAction.id}`),
    recalledMaterials: sampleRecalledMaterials(),
  })
  const ref = sampleReference()
  const playerKnowledgeBoundary = sampleKnowledgeBoundary(ref)

  return {
    postActionWorkingState: runtimeParts.postActionWorkingState,
    actionResolution: runtimeParts.actionResolution,
    worldTickResult: runtimeParts.worldTickResult,
    visibleSelection: runtimeParts.visibleSelection,
    outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
    recallSelection: runtimeParts.recallSelection,
    recalledMaterials: runtimeParts.recalledMaterials,
    styleBundle: {
      bundleId: "style-bundle-grounded-tension",
      toneRules: ["Keep the prose tense and physically grounded."],
      dictionRules: ["Use concrete sensory verbs."],
      pacingRules: ["Do not stall the gate decision."],
      forbiddenStyleMoves: ["Do not turn style notes into lore."],
      sourceRefs: [ref],
      styleIsNotWorldFact: true,
      styleIsNotPlotFact: true,
    },
    forbiddenNarrationConstraints: [
      {
        constraintId: "constraint-no-hidden-patron",
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        stableId: "reveal.gate_patron",
        lineTarget: "playerVisibleLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        mustNotReveal: ["reveal.gate_patron"],
        reason: "The patron reveal is not PC-visible this turn.",
      },
    ],
    playerKnowledgeBoundary,
    references: [ref],
    runtimeRefs: runtimeParts.worldTickResult.runtimeDeltaRefs,
  }
}

function sampleReference(): NarrationSourceRef {
  return {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    runtimeDeltaId: "patrol-countdown-advance",
    lineTarget: "playerVisibleLine",
    usePurpose: "narration",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    reason: "Grounds the player-facing canal gate state.",
  }
}

function sampleKnowledgeBoundary(ref: NarrationSourceRef): PlayerKnowledgeBoundary {
  return {
    boundaryId: "player-knowledge-boundary-act-narration-generator",
    pcKnowledgePath: "wiki/player/known_information.md",
    allowedKnowledgeRefs: [ref],
    forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
    parallelLineDoesNotGrantPcKnowledge: true,
    showParallelLineDoesNotGrantPcKnowledge: true,
    notes: ["Parallel-line display is not PC knowledge."],
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

function expectPromptDebugSectionsRecompose(prompt: ReturnType<typeof buildNarrationGeneratorPrompt>): void {
  const sections = prompt.debugSections ?? []
  expect(sections.filter((section) => section.promptRole === "system").map((section) => section.content).join("\n\n")).toBe(
    prompt.systemPrompt,
  )
  expect(sections.filter((section) => section.promptRole === "user").map((section) => section.content).join("\n\n")).toBe(
    prompt.userPrompt,
  )
}

async function writeNarrationFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/style/narration.md`,
    "# Narration Style\n\n## Runtime Capsule\n- Use tense, grounded, sensory narration.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/style/dialogue.md`,
    "# Dialogue Style\n\n## Runtime Capsule\n- Use short dialogue beats with visible intent.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/style/forbidden.md`,
    "# Forbidden Style\n\n## Runtime Capsule\n- forbid naming the gate patron before the reveal.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/memory/player-preferences.md`,
    "# Player Preferences\n\n## Runtime Capsule\n- The player prefers cautious investigation before force.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/player/known_information.md`,
    "# Known Information\n\n## Runtime Capsule\n- Iven knows the gate has a safe edge, not who funded it.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/rules/core.md`,
    "# Core Rules\n\n## Hard Rules\n- Never declare the PC knows hidden orders from parallel scenes.",
  )
  await writeFileRaw(`${projectPath}/wiki/rules/world.md`, "# World Rules\n\n## Hard Rules\n- Magic residue is visible.")
  await writeFileRaw(`${projectPath}/wiki/rules/table.md`, "# Table Rules\n\n## Hard Rules\n- Must preserve agency.")
}
