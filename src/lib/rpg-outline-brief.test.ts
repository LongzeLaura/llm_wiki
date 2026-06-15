import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildOutlineBriefPrompt,
  createFixtureOutlineBriefAdapter,
  createLlmRpgOutlineBriefAdapter,
  getRpgInteractionRegistryEntry,
  outlineBriefInteractionSpec,
  parseRpgOutlineBriefOutput,
  validateOutlineBriefCompilerOutput,
} from "./rpg-interactions"
import {
  sampleActionResolution,
  samplePostActionWorkingState,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import {
  buildOutlineBriefCompilerInputFromTurnState,
  buildOutlineBriefInputFromTurnStateAndWiki,
} from "./rpg-runtime"
import type {
  OutlineBriefCompilerInput,
  OutlineBriefCompilerOutput,
  OutlineBriefReference,
  OutlineStableRef,
  RecallSelection,
  RecalledMaterial,
  SubmittedAction,
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

describe("RPG Outline-aware Brief Compiler interaction", () => {
  it("builds a prompt with LLM 4 responsibilities and strict boundaries", () => {
    const prompt = buildOutlineBriefPrompt(sampleOutlineBriefInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(outlineBriefInteractionSpec.kind).toBe("outline_brief")
    expect(combined).toContain("Outline Brief Draft Generator + Outline Impact Detector")
    expect(combined).toContain("输出是 OutlineBriefDraft")
    expect(combined).toContain("不要输出 briefId")
    expect(combined).toContain("LLM 4 / Step 14")
    expect(combined).toContain("recalledMaterials 是 Recall Selector 过滤后的 handoff")
    expect(combined).toContain("不是完整的大纲权威来源")
    expect(combined).toContain("outlineSlices 是 GM control / reveal gate / progress marker 切片")
    expect(combined).toContain("lineTarget 只是 narration lens fallback")
    expect(combined).toContain("先读取 outlineControl.controlKind")
    expect(combined).toContain("delayed reveal")
    expect(combined).toContain("playerFacingBrief.allowedKnowledge 只能包含 PC 当前可见")
    expect(combined).toContain("仅返回严格 JSON")
    expect(combined).toContain("allowedKnowledgeRefs")
    expect(combined).toContain("outlineImpactReport")
    expect(combined).toContain("不要输出 outlineAwareNarrationBrief")
    expect(combined).toContain("warnings")
    expect(combined).toContain("不要生成面向玩家的叙事正文")
    expect(combined).toContain("不要生成 nextActionOptions")
    expect(combined).toContain("不要写 wiki")
    expect(combined).toContain("不要生成 runtime update proposal 输出")
    expect(combined).toContain("不要生成 outlineRevision")
    expect(combined).toContain("provisionalOutlinePatch")
    expect(combined).toContain("Do not trigger Story Outline Regenerator")
    expect(combined).toContain("不要把 GM-only")
    expect(combined).toContain("user_visible_pc_unknown 材料转成 PC 已知")
    expect(combined).toContain("不要直接读取文件")
    expect(combined).toContain("不要改写 TurnSemanticHandoff")
    expect(combined).toContain("TurnSemanticHandoff")
    expect(combined).toContain("RecallSelection")
    expect(combined).toContain("knownReferences")
    expect(combined).toContain("recalledMaterials、recallSelection、outlineSlices")
    expect(combined).toContain("mustNotRevealTo 包含 pc")
    expect(combined).toContain("wildcard/glob/category/pathPattern")
    expect(combined).toContain("wiki/sources/*.md")
    expect(combined).toContain('"playerFacingBrief": {')
    expect(combined).toContain('"summary": string')
    expect(combined).toContain('"currentSceneFocus": string')
    expect(combined).toContain('"allowedKnowledgeRefs"')
    expect(combined).toContain('"allowedParallelRefs"')
    expect(combined).toContain('"displayPolicy": "user_visible_pc_unknown" | "gm_only" | "hidden"')
    expect(combined).toContain('"affected": {')
    expect(combined).toContain('"lines": ("playerVisibleLine" | "parallelLine" | "tensionLine")[]')
    expect(combined).toContain('"beats": (stableId string or { "stableId": string })[]')
    expect(combined).toContain('"plotArcs": (stableId string or { "stableId": string })[]')
    expect(combined).toContain("sourceFuelIds 只能从下方 “Plot-arc 张力燃料” 的 fuelId 原样选择")
    expect(combined).toContain("plotArcFuel 由本地 compiler 根据 sourceFuelIds 确定性生成")
    expect(combined).not.toContain('"plotArcFuelRefs"')
    expect(combined).not.toContain('"briefId": string')
    expect(combined).not.toContain('"reportId": string')
    expect(combined).not.toContain('"playerFacingBrief": PlayerFacingBrief')
    expect(combined).not.toContain('"parallelLineBrief": ParallelLineBrief')
    expect(combined).not.toContain('"tensionBriefInput": TensionBriefInput')
    expect(prompt.debugSections?.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "系统固定提示词",
        "输入边界",
        "TurnSemanticHandoff",
        "RecallSelection",
        "recalledMaterials",
        "节奏状态",
        "可见性边界",
        "大纲切片",
        "Plot-arc 张力燃料",
        "硬约束元数据",
        "已知引用",
        "返回契约",
      ]),
    )
    expectPromptDebugSectionsRecompose(prompt)
  })

  it("parses bare OutlineBriefDraft JSON into canonical output", () => {
    const input = sampleOutlineBriefInput()
    const output = sampleOutlineBriefDraft()

    expect(parseRpgOutlineBriefOutput(JSON.stringify(output), input)).toMatchObject({
      outlineAwareNarrationBrief: {
        briefId: output.briefId,
        playerFacingBrief: expect.objectContaining({ summary: output.playerFacingBrief.summary }),
      },
      outlineImpactReport: expect.objectContaining({ impactLevel: output.outlineImpactReport.impactLevel }),
    })
  })

  it("parses fenced OutlineBriefDraft JSON into canonical output", () => {
    const input = sampleOutlineBriefInput()
    const output = sampleOutlineBriefDraft()

    expect(
      parseRpgOutlineBriefOutput(["```json", JSON.stringify(output, null, 2), "```"].join("\n"), input),
    ).toMatchObject({
      outlineAwareNarrationBrief: {
        briefId: output.briefId,
      },
    })
  })

  it("derives briefId and reference metadata locally", () => {
    const input = sampleOutlineBriefInput()
    const output = JSON.parse(JSON.stringify(sampleOutlineBriefDraft())) as Record<string, unknown>
    delete output.briefId
    ;(output.playerFacingBrief as Record<string, unknown>).visibilityScope = "gm_only"

    const compiled = parseRpgOutlineBriefOutput(JSON.stringify(output), input)

    expect(compiled.outlineAwareNarrationBrief.briefId).toBe("outline-brief-act-outline")
    expect(compiled.outlineAwareNarrationBrief.playerFacingBrief.visibilityScope).toBe("pc_visible")
  })

  it("derives plot-arc fuel references from sourceFuelIds instead of draft paths", () => {
    const input = sampleOutlineBriefInput()
    const output = JSON.parse(JSON.stringify(sampleOutlineBriefDraft())) as ReturnType<typeof sampleOutlineBriefDraft> & {
      tensionBriefInput: { tensionLineUpdateCandidate: { path?: string } }
    }
    output.tensionBriefInput.tensionLineUpdateCandidate.path = "wiki/plot-arcs/does-not-exist.md"

    expect(parseRpgOutlineBriefOutput(JSON.stringify(output), input).outlineAwareNarrationBrief.tensionBriefInput).toMatchObject({
      tensionLineUpdateCandidate: {
        sourceFuelIds: ["fuel.canal_gate_tension"],
      },
      plotArcFuel: [tensionReference()],
    })
  })

  it("rejects legacy plotArcFuelRefs in OutlineBriefDraft", () => {
    const input = sampleOutlineBriefInput()
    const output = JSON.parse(JSON.stringify(sampleOutlineBriefDraft())) as ReturnType<typeof sampleOutlineBriefDraft> & {
      tensionBriefInput: { plotArcFuelRefs?: unknown[] }
    }
    output.tensionBriefInput.plotArcFuelRefs = [
      {
        path: "wiki/plot-arcs/does-not-exist.md",
        sectionId: "plotArc.tension_fuel",
        stableId: "fuel.canal_gate_tension",
        reason: "Legacy draft field must not be accepted.",
      },
    ]

    expect(() => parseRpgOutlineBriefOutput(JSON.stringify(output), input)).toThrow(/plotArcFuelRefs/i)
  })

  it("rejects unknown plot-arc sourceFuelIds", () => {
    const input = sampleOutlineBriefInput()
    const output = JSON.parse(JSON.stringify(sampleOutlineBriefDraft())) as {
      tensionBriefInput: { tensionLineUpdateCandidate: { sourceFuelIds: string[] } }
    }
    output.tensionBriefInput.tensionLineUpdateCandidate.sourceFuelIds = ["fuel.unknown"]

    expect(() => parseRpgOutlineBriefOutput(JSON.stringify(output), input)).toThrow(
      /sourceFuelIds\[0\].*fuel id is not known from plotArcTensionFuel/i,
    )
  })

  it("rejects the legacy Outline Brief shape without auto-repair", () => {
    const input = sampleOutlineBriefInput()
    const legacyOutput = {
      outlineAwareNarrationBrief: {
        briefId: "outline-brief-act-outline",
        sourceWorkingStateId: "post-action-working-state-act-outline",
        playerFacingBrief: {
          allowedKnowledge: ["The fainted man is breathing weakly."],
          narrativeFocus: "Check the fainted man without revealing hidden outline truth.",
          grantsPcKnowledge: true,
          lineTarget: "playerVisibleLine",
        },
        parallelLineBrief: {
          narrativeFocus: "",
          grantsPcKnowledge: false,
          lineTarget: "parallelLine",
        },
        tensionBriefInput: ["The situation remains suspicious."],
        revealPolicies: [],
        forbiddenNarrationBoundary: [],
        pacingDirective: {
          action: "maintain",
          previousDebt: "low",
          nextDebt: "low",
          pressureChange: "unchanged",
          compensationNeeded: false,
        },
        campaignDeltaRequirement: "none",
        references: [],
      },
      outlineImpactReport: {
        impactLevel: "none",
        affected: { lines: [], beats: [], reveals: [], branchConditions: [], plotArcs: [], tensionLine: [] },
        invalidatedAssumptions: [],
        reason: "No outline impact.",
        requiresRegeneration: false,
      },
      warnings: [],
    }

    expect(() => parseRpgOutlineBriefOutput(JSON.stringify(legacyOutput), input)).toThrow(
      /forbidden canonical key|playerFacingBrief\.summary/i,
    )
  })

  it("accepts a legal output with parallel-line material that does not grant PC knowledge", () => {
    const output = sampleOutlineBriefOutput()

    expect(validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toEqual(output)
    expect(output.outlineAwareNarrationBrief.parallelLineBrief.grantsPcKnowledge).toBe(false)
    expect(output.outlineAwareNarrationBrief.parallelLineBrief.allowedParallelKnowledge[0]).toMatchObject({
      lineTarget: "parallelLine",
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
    })
  })

  it("rejects missing required top-level brief fields", () => {
    const output = cloneOutput()
    delete (output.outlineAwareNarrationBrief as unknown as Record<string, unknown>).briefId

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/briefId/i)
  })

  it("rejects invalid impactLevel", () => {
    const output = cloneOutput()
    output.outlineImpactReport.impactLevel = "catastrophic" as OutlineBriefCompilerOutput["outlineImpactReport"]["impactLevel"]

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/impactLevel/i)
  })

  it("rejects major_rewrite_required without requiresRegeneration", () => {
    const output = cloneOutput()
    output.outlineImpactReport.impactLevel = "major_rewrite_required"
    output.outlineImpactReport.requiresRegeneration = false

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/requiresRegeneration/i)
  })

  it("rejects non-major output that includes regenerationRequest", () => {
    const output = cloneOutput()
    output.regenerationRequest = {
      requestId: "regen-request-invalid",
      sourceImpactReportId: output.outlineImpactReport.reportId,
      impactLevel: "major_rewrite_required",
      reason: "This should not be present for branch impact.",
      affectedLines: ["playerVisibleLine"],
      sourceRefs: [playerVisibleReference()],
      mustPreserve: ["Keep happened facts."],
      mustRecheck: ["Recheck reveal order."],
    }

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/regenerationRequest/i)
  })

  it("rejects forbidden pollution fields", () => {
    const pollutionCases: Record<string, unknown>[] = [
      { narrative: "Player-facing prose belongs to Narration Generator." },
      { playerFacingText: "No prose here." },
      { parallelLineText: "No parallel prose here." },
      { nextActionOptions: [] },
      { wikiWrites: [] },
      { wikiWriteProposal: {} },
      { proposedUpdates: [] },
      { pendingUpdates: [] },
      { outlineRevision: {} },
      { outlineRevisionProposal: {} },
      { provisionalOutlinePatch: {} },
      { fullOutlineText: "Do not dump the full outline." },
      { rawOutline: "Do not dump raw outline." },
      { fileContent: "No file body pollution." },
    ]

    for (const pollution of pollutionCases) {
      const output = cloneOutput()
      Object.assign(output, pollution)

      expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(
        /OutlineBriefCompilerOutput/i,
      )
    }
  })

  it("rejects PC knowledge leakage inside playerFacingBrief", () => {
    const output = cloneOutput()
    output.outlineAwareNarrationBrief.playerFacingBrief.allowedKnowledge.push({
      ...parallelReference(),
      knowledgeScope: "user_only",
      visibilityScope: "user_visible_pc_unknown",
    })

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/PC knowledge|user/i)
  })

  it("rejects delayed main outline reveal slices inside playerFacingBrief.allowedKnowledge", () => {
    const input = sampleOutlineBriefInput()
    input.outlineSlices.push(delayedMainOutlineSlice())
    const output = cloneOutput()
    output.outlineAwareNarrationBrief.playerFacingBrief.allowedKnowledge.push({
      path: "wiki/outlines/main.md",
      sectionId: "outlineMain.delayed_reveals",
      stableId: "reveal.gate_patron",
      lineTarget: "playerVisibleLine",
      usePurpose: "outlineControl",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      reason: "This delayed reveal is not PC knowledge even if the output claims it is safe.",
    })

    expect(() => validateOutlineBriefCompilerOutput(output, input)).toThrow(/delayed outline control|GM-only/i)
  })

  it("rejects parallelLineBrief that grants PC knowledge", () => {
    const output = cloneOutput()
    ;(output.outlineAwareNarrationBrief.parallelLineBrief as unknown as Record<string, unknown>).grantsPcKnowledge = true

    expect(() => validateOutlineBriefCompilerOutput(output, sampleOutlineBriefInput())).toThrow(/grantsPcKnowledge/i)
  })

  it("rejects references to unknown recalled material paths or sectionIds", () => {
    const unknownPath = cloneOutput()
    unknownPath.outlineAwareNarrationBrief.references[0].path = "wiki/outlines/unknown.md"
    expect(() => validateOutlineBriefCompilerOutput(unknownPath, sampleOutlineBriefInput())).toThrow(/path/i)

    const wildcardPath = cloneOutput()
    wildcardPath.outlineAwareNarrationBrief.references[0].path = "wiki/sources/*.md"
    expect(() => validateOutlineBriefCompilerOutput(wildcardPath, sampleOutlineBriefInput())).toThrow(/path/i)

    const unknownSection = cloneOutput()
    unknownSection.outlineAwareNarrationBrief.references[0].sectionId = "outline.unknown_section"
    expect(() => validateOutlineBriefCompilerOutput(unknownSection, sampleOutlineBriefInput())).toThrow(/sectionId/i)
  })

  it("creates a fixture adapter that validates and returns structured output", async () => {
    const input = sampleOutlineBriefInput()
    const output = sampleOutlineBriefOutput()
    const adapter = createFixtureOutlineBriefAdapter(output)

    await expect(adapter.compileOutlineBrief(buildOutlineBriefPrompt(input), input)).resolves.toEqual(output)
  })

  it("creates an LLM adapter that streams output and validates the parsed JSON", async () => {
    const input = sampleOutlineBriefInput()
    const output = sampleOutlineBriefDraft()
    const prompt = buildOutlineBriefPrompt(input)
    const rawOutput = ["```json\n", JSON.stringify(output), "\n```"].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1800 }

    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(rawOutput.slice(0, 12))
      callbacks.onToken(rawOutput.slice(12))
      callbacks.onDone()
    })

    const adapter = createLlmRpgOutlineBriefAdapter({ llmConfig: sampleLlmConfig(), signal }, { requestOverrides })

    await expect(adapter.compileOutlineBrief(prompt, input)).resolves.toMatchObject({
      outlineAwareNarrationBrief: { briefId: output.briefId },
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

  it("exposes outline_brief in the RPG interaction registry", () => {
    expect(getRpgInteractionRegistryEntry("outline_brief")).toMatchObject({
      kind: "outline_brief",
      stage: "runtime_outline_brief_compiler",
      usesLlm: true,
      implemented: true,
      spec: outlineBriefInteractionSpec,
    })
  })

  it("derives first-version OutlineBriefCompilerInput from deterministic recalledMaterials", () => {
    const submittedAction: SubmittedAction = {
      id: "act-derived-outline",
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
    const recallSelection = sampleRecallSelection()
    const recalledMaterials = [
      material("wiki/current-scene/scene_state.md", "slot.current_scene", "playerVisibleLine", "pc_visible", "pc_known"),
      material("wiki/outlines/progress.md", "outlineProgress.delayed_reveal", "tensionLine", "gm_only", "gm_only"),
      material("wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel", "tensionLine", "gm_only", "gm_only"),
      material("wiki/rules/core.md", "rules.hard_gate", "playerVisibleLine", "gm_only", "gm_only"),
      material("wiki/style/forbidden.md", "style.must_not_reveal", "playerVisibleLine", "gm_only", "gm_only"),
      material("wiki/memory/player-preferences.md", "memory.preference", "playerVisibleLine", "gm_only", "gm_only"),
    ]

    const input = buildOutlineBriefCompilerInputFromTurnState({
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      recallSelection,
      recalledMaterials,
    })

    expect(input.postActionWorkingState).toBe(postActionWorkingState)
    expect(input.actionResolution).toBe(actionResolution)
    expect(input.worldTickResult).toBe(worldTickResult)
    expect(input.visibleSelection).toBe(visibleSelection)
    expect(input.recallSelection).toBe(recallSelection)
    expect(input.recalledMaterials).toBe(recalledMaterials)
    expect(input.pacingState).toBe(postActionWorkingState.pacingState)
    expect(input.gapState).toBe(postActionWorkingState.gapState)
    expect(input.reactionQueue).toBe(worldTickResult.reactionQueue)
    expect(input.outlineSlices.map((slice) => slice.path)).toEqual(["wiki/outlines/progress.md"])
    expect(input.plotArcTensionFuel.map((fuel) => fuel.path)).toEqual(["wiki/plot-arcs/runtime/canal-gate.md"])
    expect(input.hardConstraints.map((constraint) => constraint.sourcePath)).toEqual([
      "wiki/outlines/progress.md",
      "wiki/rules/core.md",
      "wiki/style/forbidden.md",
      "wiki/memory/player-preferences.md",
    ])
    expect(input.visibilityBoundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: "wiki/current-scene/scene_state.md",
          sectionId: "slot.current_scene",
          grantsPcKnowledge: true,
        }),
        expect.objectContaining({
          lineTarget: "parallelLine",
          grantsPcKnowledge: false,
        }),
      ]),
    )
    expect(input.knownReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/outlines/progress.md",
          sectionId: "outlineProgress.delayed_reveal",
        }),
        expect.objectContaining({
          path: ".llm-wiki/runtime/turns/act-world-tick/world-tick.json#patrol-countdown-advance",
          runtimeDeltaId: "patrol-countdown-advance",
        }),
      ]),
    )
  })

  it("builds OutlineBriefCompilerInput from turn state plus controlled wiki readers", async () => {
    tmpProject = await createTempProject("rpg-outline-brief-input-builder")
    await writeOutlineBriefFixture(tmpProject.path)
    const submittedAction: SubmittedAction = {
      id: "act-outline-reader",
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
    const recallSelection = sampleRecallSelection()
    const recalledMaterials = sampleRecalledMaterials()

    const { input, warnings } = await buildOutlineBriefInputFromTurnStateAndWiki({
      projectPath: tmpProject.path,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      recallSelection,
      recalledMaterials,
    })

    expect(warnings).toEqual([])
    expect(input.postActionWorkingState).toBe(postActionWorkingState)
    expect(input.actionResolution).toBe(actionResolution)
    expect(input.worldTickResult).toBe(worldTickResult)
    expect(input.visibleSelection).toBe(visibleSelection)
    expect(input.recallSelection).toBe(recallSelection)
    expect(input.recalledMaterials).toBe(recalledMaterials)
    expect(input.outlineSlices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.runtime_capsule",
        }),
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.act_structure",
        }),
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.intended_reveals",
        }),
        expect.objectContaining({
          path: "wiki/outlines/progress.md",
          sectionId: "outlineProgress.current_stage",
        }),
      ]),
    )
    expect(input.outlineSlices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.delayed_reveals",
          lineTarget: "playerVisibleLine",
          outlineControl: expect.objectContaining({
            controlKind: "reveal_gate",
            mustNotRevealTo: ["pc"],
          }),
        }),
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.act_structure",
          outlineControl: expect.objectContaining({
            controlKind: "act_structure",
          }),
        }),
        expect.objectContaining({
          path: "wiki/outlines/progress.md",
          sectionId: "outlineProgress.current_stage",
          outlineControl: expect.objectContaining({
            controlKind: "progress_marker",
          }),
        }),
      ]),
    )
    expect(
      input.outlineSlices.find((slice) => slice.sectionId === "outlineMain.delayed_reveals")?.lineTargets[0]?.guidance,
    ).toContain("lineTarget is only a narration lens fallback")
    expect(input.plotArcTensionFuel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/plot-arcs/canal-gate.md",
          plotArcId: "plotArc.canal-gate",
        }),
        expect.objectContaining({
          path: "wiki/plot-arcs/runtime/canal-gate.md",
          plotArcId: "plotArc.canal-gate",
        }),
        expect.objectContaining({
          path: "wiki/relationships/runtime/player_mira.md",
          relationshipRefs: ["wiki/relationships/runtime/player_mira.md"],
        }),
      ]),
    )
    expect(input.hardConstraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: "wiki/outlines/main.md",
          sectionId: "outlineMain.must_not_contradict",
        }),
        expect.objectContaining({
          sourcePath: "wiki/rules/core.md",
        }),
      ]),
    )
    expect(input.knownReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/outlines/main.md",
          sectionId: "outlineMain.delayed_reveals",
        }),
        expect.objectContaining({
          path: "wiki/relationships/runtime/player_mira.md",
        }),
        expect.objectContaining({
          path: ".llm-wiki/runtime/turns/act-world-tick/world-tick.json#patrol-countdown-advance",
          runtimeDeltaId: "patrol-countdown-advance",
        }),
      ]),
    )
  })

  it("connects LLM 4 to runRpgTurn before the conditional Story Outline Regenerator boundary", async () => {
    const orchestrator = await fs.readFile("src/lib/rpg-runtime/turn-orchestrator.ts", "utf-8")

    expect(orchestrator).toContain("outlineBriefCompilerAdapter")
    expect(orchestrator).toContain("outlineBriefInteractionSpec")
    expect(orchestrator).toContain("storyOutlineRegeneratorAdapter")
    expect(orchestrator).toContain('impactLevel === "major_rewrite_required"')
    expect(orchestrator).toContain("requiresRegeneration")
  })

  it("does not modify wiki writer/apply display, RPG_SCHEMA_SLOTS, or ordinary wiki/runtime categories", async () => {
    const runtimeApply = await fs.readFile("src/lib/rpg-import/runtime-update-apply.ts", "utf-8")
    const runtimePanel = await fs.readFile("src/components/rpg/rpg-runtime-panel.tsx", "utf-8")

    expect(runtimeApply).toContain("outlineAwareNarrationBrief")
    expect(runtimeApply).not.toContain("outline_brief")
    expect(runtimePanel).toContain("runRpgRuntimeTurnFlowClient")
    expect(runtimePanel).not.toContain("outline_brief")
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("runtime/")
  })
})

function cloneOutput(): OutlineBriefCompilerOutput {
  return JSON.parse(JSON.stringify(sampleOutlineBriefOutput())) as OutlineBriefCompilerOutput
}

function sampleOutlineBriefInput(): OutlineBriefCompilerInput {
  const submittedAction: SubmittedAction = {
    id: "act-outline",
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
    recallSelection: sampleRecallSelection(),
    recalledMaterials: sampleRecalledMaterials(),
    pacingState: postActionWorkingState.pacingState,
    gapState: postActionWorkingState.gapState,
    reactionQueue: worldTickResult.reactionQueue,
    visibilityBoundaries: [
      {
        boundaryId: "visibility.pc-known-only",
        lineTarget: "playerVisibleLine",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        grantsPcKnowledge: true,
        sourcePath: "wiki/player/known_information.md",
        sectionId: "playerKnowledge.current",
        reason: "Player-facing brief can use only known or inferred material.",
      },
      {
        boundaryId: "visibility.parallel-no-pc-knowledge",
        lineTarget: "parallelLine",
        visibilityScope: "user_visible_pc_unknown",
        knowledgeScope: "user_only",
        grantsPcKnowledge: false,
        sourcePath: "wiki/factions/runtime/harbor-watch.md",
        sectionId: "factionRuntime.current_order",
        reason: "Parallel line is display-only for the user.",
      },
    ],
    outlineSlices: [
      {
        sliceId: "outline-slice-gate",
        path: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        title: "Canal Gate Adjacent Beats",
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        outlineControl: {
          controlKind: "reveal_gate",
          gmSummary: "The next useful beat is decoding the gate without revealing the patron.",
          playerSafeSummary:
            "A GM-only reveal boundary is active; use only non-spoiler pressure, hints, or pacing without disclosing the truth.",
          actorKnowledgeRefs: ["gm"],
          revealGateRefs: ["gate.wiki-outlines-progress-md-outlineprogress-adjacent-beats"],
          mustNotRevealTo: ["pc"],
          boundaryNote:
            "Treat this as GM control / reveal-gate material first; decide any narration lens only after applying visibility and knowledge boundaries.",
        },
        summary: "The next useful beat is decoding the gate without revealing the patron.",
        beatRefs: [
          {
            ...stableRef("beat.decode_gate", "wiki/outlines/progress.md", "outlineProgress.adjacent_beats"),
            refType: "beat",
            beatStatus: "active",
          },
        ],
        revealRefs: [
          {
            ...stableRef("reveal.gate_patron", "wiki/outlines/progress.md", "outlineProgress.adjacent_beats"),
            refType: "reveal",
            revealPolicy: "delay",
            revealTiming: "After the sigil is decoded.",
          },
        ],
        branchConditionRefs: [
          {
            ...stableRef("branch.waited_for_mira", "wiki/outlines/progress.md", "outlineProgress.adjacent_beats"),
            refType: "branchCondition",
            conditionStatus: "watching",
          },
        ],
        dependencies: [
          {
            dependencyId: "dependency.decode-before-patron",
            dependsOnStableIds: ["beat.decode_gate"],
            invalidatedByStableIds: ["reveal.gate_patron"],
            reason: "The patron reveal depends on decoding the sigil first.",
          },
        ],
        lineTargets: [
          {
            lineTarget: "playerVisibleLine",
            allowedStableIds: ["beat.decode_gate"],
            forbiddenStableIds: ["reveal.gate_patron"],
            guidance: "Keep focus on Mira's visible warning and the patrol pressure.",
          },
        ],
        revealPolicies: [
          {
            directiveId: "policy-delay-patron",
            stableId: "reveal.gate_patron",
            policy: "delay",
            lineTarget: "playerVisibleLine",
            reason: "The patron is not PC knowledge yet.",
          },
        ],
        invalidationNotes: ["If the patron becomes known now, later reveal order breaks."],
      },
    ],
    plotArcTensionFuel: [
      {
        fuelId: "fuel.canal_gate_tension",
        path: "wiki/plot-arcs/runtime/canal-gate.md",
        sectionId: "plotArc.tension_fuel",
        plotArcId: "plotArc.canal_gate",
        summary: "Patrol pressure and Mira's trust can fuel the tension line.",
        tensionLineTarget: "advance",
        pressureSources: ["clock-harbor-watch-return", "relationship:Mira-Iven"],
        relationshipRefs: ["wiki/relationships/runtime/player_mira.md"],
        forbiddenResolutions: ["Do not reveal the gate patron yet."],
      },
    ],
    hardConstraints: [
      {
        constraintId: "constraint.no-patron-reveal",
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        summary: "Do not reveal the gate patron before the sigil is decoded.",
        appliesToLines: ["playerVisibleLine", "parallelLine", "tensionLine"],
        mustPreserve: ["Mira can warn about the safe edge."],
        mustNotReveal: ["reveal.gate_patron"],
      },
    ],
    runtimeRefs: [
      ...postActionWorkingState.runtimeDeltaRefs,
      ...actionResolution.runtimeDeltaRefs,
      ...worldTickResult.runtimeDeltaRefs,
    ],
    knownReferences: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "currentScene.visible_deltas",
        runtimeDeltaId: "patrol-countdown-advance",
        reason: "Current visible pressure.",
      },
      {
        path: "wiki/factions/runtime/harbor-watch.md",
        sectionId: "factionRuntime.current_order",
        runtimeDeltaId: "watch-captain-order",
        reason: "Parallel-line pressure.",
      },
      {
        path: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        stableId: "beat.decode_gate",
        reason: "Adjacent outline beat.",
      },
      {
        path: "wiki/plot-arcs/runtime/canal-gate.md",
        sectionId: "plotArc.tension_fuel",
        stableId: "fuel.canal_gate_tension",
        reason: "Tension-line fuel.",
      },
      {
        path: "wiki/player/known_information.md",
        sectionId: "playerKnowledge.current",
        reason: "PC knowledge boundary.",
      },
    ],
  }
}

function delayedMainOutlineSlice(): OutlineBriefCompilerInput["outlineSlices"][number] {
  return {
    sliceId: "outline-slice-main-delayed-reveals",
    path: "wiki/outlines/main.md",
    sectionId: "outlineMain.delayed_reveals",
    title: "main: outlineMain.delayed_reveals",
    lineTarget: "playerVisibleLine",
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    outlineControl: {
      controlKind: "reveal_gate",
      gmSummary: "The gate patron should remain hidden until the sigil is decoded.",
      playerSafeSummary:
        "A GM-only reveal boundary is active; use only non-spoiler pressure, hints, or pacing without disclosing the truth.",
      actorKnowledgeRefs: ["gm"],
      revealGateRefs: ["gate.wiki-outlines-main-md-outlinemain-delayed-reveals"],
      mustNotRevealTo: ["pc"],
      boundaryNote:
        "Treat this as GM control / reveal-gate material first; decide any narration lens only after applying visibility and knowledge boundaries.",
    },
    summary: "The gate patron should remain hidden until the sigil is decoded.",
    beatRefs: [
      {
        ...stableRef("beat.delayed_gate_patron", "wiki/outlines/main.md", "outlineMain.delayed_reveals"),
        lineTarget: "playerVisibleLine",
        refType: "beat",
        beatStatus: "planned",
      },
    ],
    revealRefs: [
      {
        ...stableRef("reveal.gate_patron", "wiki/outlines/main.md", "outlineMain.delayed_reveals"),
        lineTarget: "playerVisibleLine",
        refType: "reveal",
        revealPolicy: "delay",
        revealTiming: "Only after the sigil is decoded.",
      },
    ],
    branchConditionRefs: [],
    dependencies: [],
    lineTargets: [
      {
        lineTarget: "playerVisibleLine",
        allowedStableIds: ["beat.delayed_gate_patron"],
        forbiddenStableIds: ["reveal.gate_patron"],
        guidance: "lineTarget is only a narration lens fallback, not the outline structure.",
      },
    ],
    revealPolicies: [
      {
        directiveId: "policy.reveal.gate_patron",
        stableId: "reveal.gate_patron",
        policy: "delay",
        lineTarget: "playerVisibleLine",
        reason: "The patron is not PC knowledge.",
      },
    ],
    invalidationNotes: [],
  }
}

function sampleOutlineBriefDraft() {
  return {
    briefId: "outline-brief-act-outline",
    playerFacingBrief: {
      summary: "Keep the scene on Mira's visible sigil read, the warming key, and patrol pressure.",
      currentSceneFocus: "Mira warns which edge of the sigil is safe while the patrol nears.",
      allowedKnowledgeRefs: [
        {
          path: "wiki/current-scene/scene_state.md",
          sectionId: "currentScene.visible_deltas",
          runtimeDeltaId: "patrol-countdown-advance",
          reason: "Use selected visible scene deltas.",
        },
      ],
      immediateReactions: ["Mira warns the player not to touch the cracked edge."],
      clueDirections: ["The safe edge can be tested without naming the patron."],
      mustNotRevealStableIds: ["reveal.gate_patron"],
    },
    parallelLineBrief: {
      summary: "The Harbor Watch order may be held as parallel pressure without informing the PC.",
      allowedParallelRefs: [
        {
          path: "wiki/factions/runtime/harbor-watch.md",
          sectionId: "factionRuntime.current_order",
          runtimeDeltaId: "watch-captain-order",
          reason: "Use only as parallel-line pressure.",
        },
      ],
      parallelBeatFocus: ["A captain orders a delayed lower-canal sweep."],
      displayPolicy: "user_visible_pc_unknown",
    },
    tensionBriefInput: {
      summary: "Advance tension through Mira's fragile trust and the patrol clock.",
      tensionLineUpdateCandidate: {
        summary: "Mira's trust rises because the player waited for her expertise.",
        sourceFuelIds: ["fuel.canal_gate_tension"],
        targetPlotArcIds: ["plotArc.canal_gate"],
        updateKind: "advance",
        reason: "The action produced relationship pressure without resolving the reveal.",
      },
      relationshipPressure: ["Mira notices the player defers to her expertise under time pressure."],
      shouldAdvance: true,
    },
    pacingDirective: {
      intent: "medium",
      reason: "The scene has pressure and should move through the warning, not stall.",
      requiredMovement: ["Move the patrol clock or force a key-use decision."],
      avoidStagnation: true,
    },
    campaignDeltaRequirement: {
      required: true,
      minimumDelta: "meaningful",
      reason: "The turn should change the gate decision pressure.",
      candidateSources: ["patrol-countdown-advance", "fuel.canal_gate_tension"],
    },
    outlineImpactReport: {
      impactLevel: "minor",
      affected: {
        lines: ["playerVisibleLine", "tensionLine"],
        beats: ["beat.decode_gate"],
        reveals: ["reveal.gate_patron"],
        branchConditions: ["branch.waited_for_mira"],
        plotArcs: ["plotArc.canal_gate"],
        tensionLine: ["fuel.canal_gate_tension"],
      },
      invalidatedAssumptions: [],
      reason: "The wait advances pressure but does not break reveal order.",
      requiresRegeneration: false,
    },
    warnings: [],
  } as const
}

function sampleOutlineBriefOutput(): OutlineBriefCompilerOutput {
  const playerRef = playerVisibleReference()
  const parallelRef = parallelReference()
  const tensionRef = tensionReference()

  return {
    outlineAwareNarrationBrief: {
      briefId: "outline-brief-act-outline",
      sourceWorkingStateId: "post-action-working-state-act-outline",
      playerFacingBrief: {
        summary: "Keep the scene on Mira's visible sigil read, the warming key, and patrol pressure.",
        currentSceneFocus: "Mira warns which edge of the sigil is safe while the patrol nears.",
        allowedKnowledge: [playerRef],
        immediateReactions: ["Mira warns the player not to touch the cracked edge."],
        clueDirections: ["The safe edge can be tested without naming the patron."],
        mustNotRevealStableIds: ["reveal.gate_patron"],
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
      },
      parallelLineBrief: {
        summary: "The Harbor Watch order may be held as parallel pressure without informing the PC.",
        allowedParallelKnowledge: [parallelRef],
        parallelBeatFocus: ["A captain orders a delayed lower-canal sweep."],
        displayPolicy: "user_visible_pc_unknown",
        grantsPcKnowledge: false,
      },
      tensionBriefInput: {
        summary: "Advance tension through Mira's fragile trust and the patrol clock.",
        tensionLineUpdateCandidate: {
          candidateId: "tension-candidate-canal-gate",
          summary: "Mira's trust rises because the player waited for her expertise.",
          sourceFuelIds: ["fuel.canal_gate_tension"],
          targetPlotArcIds: ["plotArc.canal_gate"],
          updateKind: "advance",
          reason: "The action produced relationship pressure without resolving the reveal.",
        },
        relationshipPressure: ["Mira notices the player defers to her expertise under time pressure."],
        plotArcFuel: [tensionRef],
        shouldAdvance: true,
      },
      revealPolicies: [
        {
          directiveId: "policy-delay-patron",
          stableId: "reveal.gate_patron",
          policy: "delay",
          lineTarget: "playerVisibleLine",
          reason: "The patron remains outside PC knowledge.",
        },
      ],
      forbiddenNarrationBoundary: [
        {
          itemId: "forbid-patron-name",
          sourcePath: "wiki/outlines/progress.md",
          sectionId: "outlineProgress.adjacent_beats",
          stableId: "reveal.gate_patron",
          lineTarget: "playerVisibleLine",
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
          reason: "Do not reveal the gate patron.",
        },
      ],
      pacingDirective: {
        intent: "medium",
        reason: "The scene has pressure and should move through the warning, not stall.",
        requiredMovement: ["Move the patrol clock or force a key-use decision."],
        avoidStagnation: true,
      },
      campaignDeltaRequirement: {
        required: true,
        minimumDelta: "meaningful",
        reason: "The turn should change the gate decision pressure.",
        candidateSources: ["patrol-countdown-advance", "fuel.canal_gate_tension"],
      },
      references: [playerRef, parallelRef, tensionRef],
    },
    outlineImpactReport: {
      reportId: "outline-impact-act-outline",
      impactLevel: "minor",
      affected: {
        lines: ["playerVisibleLine", "tensionLine"],
        beats: [affectedStableRef("beat.decode_gate")],
        reveals: [affectedStableRef("reveal.gate_patron")],
        branchConditions: [affectedStableRef("branch.waited_for_mira")],
        plotArcs: [affectedStableRef("plotArc.canal_gate", "wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel")],
        tensionLine: [affectedStableRef("fuel.canal_gate_tension", "wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel")],
      },
      invalidatedAssumptions: [],
      reason: "The wait advances pressure but does not break reveal order.",
      requiresRegeneration: false,
    },
    warnings: [],
  }
}

function sampleRecallSelection(): RecallSelection {
  return {
    selectionId: "recall-selection-act-outline",
    sourceWorkingStateId: "post-action-working-state-act-outline",
    selectedItems: [
      selectedItem("wiki/current-scene/scene_state.md", "currentScene.visible_deltas", "playerVisibleLine", "pc_visible", "pc_known"),
      selectedItem("wiki/factions/runtime/harbor-watch.md", "factionRuntime.current_order", "parallelLine", "user_visible_pc_unknown", "user_only"),
      selectedItem("wiki/outlines/progress.md", "outlineProgress.adjacent_beats", "tensionLine", "gm_only", "gm_only"),
      selectedItem("wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel", "tensionLine", "gm_only", "gm_only"),
      selectedItem("wiki/player/known_information.md", "playerKnowledge.current", "playerVisibleLine", "pc_visible", "pc_known"),
    ],
    exclusions: [
      {
        path: "wiki/outlines/main.md",
        sectionIds: ["outlineMain.full"],
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        reason: "Full outline is not handed to LLM 4.",
      },
    ],
    recallBudget: {
      maxItems: 8,
      maxSections: 16,
      maxEstimatedTokens: 6000,
      preferredLineTargets: ["playerVisibleLine", "parallelLine", "tensionLine"],
    },
    recallPolicy: {
      allowFullPageRead: false,
      requireStableSectionIds: true,
      pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
      parallelLineDoesNotGrantPcKnowledge: true,
      notes: ["Fixture selection for outline brief tests."],
    },
    warnings: [],
  }
}

function sampleRecalledMaterials(): RecalledMaterial[] {
  return [
    material("wiki/current-scene/scene_state.md", "currentScene.visible_deltas", "playerVisibleLine", "pc_visible", "pc_known"),
    material("wiki/factions/runtime/harbor-watch.md", "factionRuntime.current_order", "parallelLine", "user_visible_pc_unknown", "user_only"),
    material("wiki/outlines/progress.md", "outlineProgress.adjacent_beats", "tensionLine", "gm_only", "gm_only"),
    material("wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel", "tensionLine", "gm_only", "gm_only"),
    material("wiki/player/known_information.md", "playerKnowledge.current", "playerVisibleLine", "pc_visible", "pc_known"),
  ]
}

function selectedItem(
  path: string,
  sectionId: string,
  lineTarget: "playerVisibleLine" | "parallelLine" | "tensionLine",
  visibilityScope: "pc_visible" | "pc_inferred" | "user_visible_pc_unknown" | "gm_only" | "hidden",
  knowledgeScope: "pc_known" | "pc_misunderstanding" | "npc_known" | "user_only" | "gm_only" | "unknown_to_pc",
): RecallSelection["selectedItems"][number] {
  return {
    path,
    lineTarget,
    readMode: "focusedSection",
    priority: "critical",
    reason: `Recall ${sectionId}.`,
    expectedUse: "Support Outline-aware Brief Compiler.",
    visibilityScope,
    knowledgeScope,
    sections: [
      {
        sectionId,
        reason: "Stable section selected by Recall Selector.",
        expectedUse: "Bound LLM 4 to selected material.",
        priority: "critical",
      },
    ],
  }
}

function material(
  path: string,
  sectionId: string,
  lineTarget: "playerVisibleLine" | "parallelLine" | "tensionLine",
  visibilityScope: "pc_visible" | "pc_inferred" | "user_visible_pc_unknown" | "gm_only" | "hidden",
  knowledgeScope: "pc_known" | "pc_misunderstanding" | "npc_known" | "user_only" | "gm_only" | "unknown_to_pc",
): RecalledMaterial {
  return {
    path,
    lineTarget,
    readMode: "focusedSection",
    priority: "critical",
    reason: `Read ${sectionId}.`,
    expectedUse: "Outline brief fixture material.",
    visibilityScope,
    knowledgeScope,
    sections: [
      {
        sectionId,
        readMode: "focusedSection",
        priority: "critical",
        reason: "Stable selected section.",
        expectedUse: "Support LLM 4 validation.",
        content: `Fixture content for ${sectionId}.`,
        warnings: [],
      },
    ],
    warnings: [],
  }
}

function playerVisibleReference(): OutlineBriefReference {
  return {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "currentScene.visible_deltas",
    runtimeDeltaId: "patrol-countdown-advance",
    lineTarget: "playerVisibleLine",
    usePurpose: "narration",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    reason: "Use selected visible scene deltas.",
  }
}

function parallelReference(): OutlineBriefReference {
  return {
    path: "wiki/factions/runtime/harbor-watch.md",
    sectionId: "factionRuntime.current_order",
    runtimeDeltaId: "watch-captain-order",
    lineTarget: "parallelLine",
    usePurpose: "narration",
    visibilityScope: "user_visible_pc_unknown",
    knowledgeScope: "user_only",
    reason: "Use only as parallel-line pressure.",
  }
}

function tensionReference(): OutlineBriefReference {
  return {
    path: "wiki/plot-arcs/runtime/canal-gate.md",
    sectionId: "plotArc.tension_fuel",
    stableId: "fuel.canal_gate_tension",
    lineTarget: "tensionLine",
    usePurpose: "outlineControl",
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    reason: "Fuel tension-line guidance.",
  }
}

function stableRef(stableId: string, path: string, sectionId: string): OutlineStableRef {
  return {
    refId: `${stableId}.ref`,
    path,
    sectionId,
    stableId,
    summary: `Stable ref ${stableId}.`,
    lineTarget: "tensionLine",
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
  }
}

function affectedStableRef(
  stableId: string,
  path = "wiki/outlines/progress.md",
  sectionId = "outlineProgress.adjacent_beats",
): OutlineStableRef {
  return stableRef(stableId, path, sectionId)
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

function expectPromptDebugSectionsRecompose(prompt: ReturnType<typeof buildOutlineBriefPrompt>): void {
  const sections = prompt.debugSections ?? []
  expect(sections.filter((section) => section.promptRole === "system").map((section) => section.content).join("\n\n")).toBe(
    prompt.systemPrompt,
  )
  expect(sections.filter((section) => section.promptRole === "user").map((section) => section.content).join("\n\n")).toBe(
    prompt.userPrompt,
  )
}

async function writeOutlineBriefFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/outlines/main.md`,
    [
      "# Main Outline",
      "",
      "## Runtime Capsule",
      "- Keep the canal gate pressure immediate.",
      "",
      "## Act Structure",
      "- Act I: decode the canal gate.",
      "",
      "## Intended Reveals",
      "- reveal.gate_patron should arrive after the sigil is decoded.",
      "",
      "## Delayed Reveals",
      "- must not reveal the gate patron name yet.",
      "",
      "## Branch Conditions",
      "- If Iven breaks the seal early, future beats require review.",
      "",
      "## Must Not Contradict",
      "- Mira knows the safe edge but not the patron name.",
    ].join("\n"),
  )
  await writeFileRaw(
    `${projectPath}/wiki/outlines/progress.md`,
    [
      "# Outline Progress",
      "",
      "## Runtime Capsule",
      "- The canal gate scene is active.",
      "",
      "## Current Stage",
      "- Decode the canal gate.",
      "",
      "## Completed Beats",
      "- Mira reached the gate.",
      "",
      "## Divergence Notes",
      "- No major divergence yet.",
      "",
      "## Next Useful Beats",
      "- Let Mira identify the safe edge.",
    ].join("\n"),
  )
  await writeFileRaw(
    `${projectPath}/wiki/plot-arcs/canal-gate.md`,
    "# Canal Gate Arc\n\n## Runtime Capsule\n- Base arc pressure: the gate patron remains hidden.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`,
    "# Canal Gate Runtime\n\n## Current Pressure\n- Runtime plot pressure: patrols are closing in.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/relationships/runtime/player_mira.md`,
    "# Iven / Mira Runtime\n\n## Current Tension\n- Mira notices Iven defers to her expertise.",
  )
  await writeFileRaw(
    `${projectPath}/wiki/rules/core.md`,
    "# Core Rules\n\n## Hard Rules\n- The warded gate cannot open silently without the lantern key.",
  )
  await writeFileRaw(`${projectPath}/wiki/rules/world.md`, "# World Rules\n\n## Constraints\n- Magic leaves visible residue.")
  await writeFileRaw(`${projectPath}/wiki/rules/table.md`, "# Table Rules\n\n## Constraints\n- Never skip player agency.")
}
