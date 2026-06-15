import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import type { LlmConfig } from "@/stores/wiki-store"
import { streamChat } from "./llm-client"
import {
  buildStoryOutlineRegeneratorPrompt,
  createFixtureStoryOutlineRegeneratorAdapter,
  createLlmRpgStoryOutlineRegeneratorAdapter,
  getRpgInteractionRegistryEntry,
  parseRpgStoryOutlineRegeneratorOutput,
  storyOutlineRegeneratorInteractionSpec,
  validateStoryOutlineRegeneratorOutput,
} from "./rpg-interactions"
import {
  sampleActionResolution,
  samplePostActionWorkingState,
  sampleRecalledMaterials,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import type {
  OutlineBriefReference,
  OutlineStableRef,
  StoryOutlineRegeneratorInput,
  StoryOutlineRegeneratorOutput,
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

describe("RPG Story Outline Regenerator interaction", () => {
  it("constructs the runtime handoff types without treating them as accepted wiki facts", () => {
    const input: StoryOutlineRegeneratorInput = sampleRegeneratorInput()
    const output: StoryOutlineRegeneratorOutput = sampleRegeneratorOutput()

    expect(input.regenerationRequest.impactLevel).toBe("major_rewrite_required")
    expect(output.provisionalOutlinePatch.scope).toBe("same_turn_only")
    expect(output.provisionalOutlinePatch.nonPersistenceBoundary).toMatchObject({
      writesToWiki: false,
      modifiesMainOutline: false,
      acceptedWikiFacts: false,
    })
    expect(output.outlineRevisionProposal.reviewBoundary).toMatchObject({
      reviewItemKind: "outlineRevision",
      ordinaryRuntimeUpdate: false,
      proposedWikiUpdate: false,
      autoWriteMainOutline: false,
    })
    expect(output.regenerationSafetyReport).toMatchObject({
      reportKind: "regenerationSafetyReport",
      safetyConclusion: "safe",
      noWikiWrite: true,
      ordinaryRuntimeUpdateBoundary: true,
    })
  })

  it("builds a prompt with inputs, outputs, and forbidden pollution boundaries", () => {
    const prompt = buildStoryOutlineRegeneratorPrompt(sampleRegeneratorInput())
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(storyOutlineRegeneratorInteractionSpec.kind).toBe("outline_regeneration")
    expect(combined).toContain("Story Outline Regenerator")
    expect(combined).toContain("条件性 Step 14.5")
    expect(combined).toContain("OutlineImpactReport")
    expect(combined).toContain("RegenerationRequest")
    expect(combined).toContain("post-action working state")
    expect(combined).toContain("recalled outline slices")
    expect(combined).toContain("plot-arc tension fuel")
    expect(combined).toContain("confirmed fact boundaries")
    expect(combined).toContain("forbidden reveal boundaries")
    expect(combined).toContain("provisionalOutlinePatch")
    expect(combined).toContain("outlineRevisionProposal")
    expect(combined).toContain("regenerationSafetyReport")
    expect(combined).toContain("warnings")
    expect(combined).toContain("不要输出面向玩家的 prose")
    expect(combined).toContain("不要输出 wikiWrites")
    expect(combined).toContain("不要直接修改 wiki/outlines/main.md")
    expect(combined).toContain("不要把未来计划")
    expect(combined).toContain("不要重写输入边界中已确认的事实")
    expect(combined).toContain("user_visible_pc_unknown 材料泄露为 PC 已知")
    expect(combined).toContain("wildcard/glob/category/pathPattern")
    expect(combined).toContain("wiki/sources/*.md")
    expect(combined).toContain("wiki/outlines/main.md")
    expect(combined).toContain("wiki/events/*")
    expect(combined).toContain('"narrationHandoff": {')
    expect(combined).toContain('"proposedRevision": {')
    expect(combined).toContain("不要输出 patchId")
    expect(combined).toContain('"checkedRuntimeRefs": string[]')
    expect(combined).not.toContain('"patchId": string')
    expect(combined).not.toContain('"nonPersistenceBoundary": {')
    expect(combined).not.toContain('"reviewBoundary": {')
    expect(combined).not.toContain("RuntimeDeltaRef 输出结构")
    expect(combined).not.toContain('"provisionalOutlinePatch": ProvisionalOutlinePatch')
    expect(combined).not.toContain('"outlineRevisionProposal": OutlineRevisionProposal')
    expect(combined).not.toContain('"regenerationSafetyReport": RegenerationSafetyReport')
    expect(prompt.debugSections?.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "系统固定提示词",
        "OutlineImpactReport",
        "RegenerationRequest",
        "TurnSemanticHandoff",
        "RecalledMaterials",
        "大纲切片",
        "Plot-arc 张力燃料",
        "可见性边界",
        "硬约束",
        "已确认事实边界",
        "禁止揭示边界",
        "Runtime 引用",
        "已知引用",
        "返回契约",
      ]),
    )
    expectPromptDebugSectionsRecompose(prompt)
  })

  it("parses bare and fenced StoryOutlineRegeneratorDraft JSON", () => {
    const input = sampleRegeneratorInput()
    const output = sampleRegeneratorOutput()

    const parsed = parseRpgStoryOutlineRegeneratorOutput(JSON.stringify(output), input)
    expect(parsed.provisionalOutlinePatch.patchId).toBe("provisional-outline-patch-regen-request-major")
    expect(parsed.provisionalOutlinePatch.narrationHandoff.sourcePatchId).toBe(parsed.provisionalOutlinePatch.patchId)
    expect(parsed.outlineRevisionProposal.proposalId).toBe("outline-revision-proposal-regen-request-major")
    expect(
      parseRpgStoryOutlineRegeneratorOutput(["```json", JSON.stringify(output, null, 2), "```"].join("\n"), input)
        .outlineRevisionProposal.reviewBoundary.autoWriteMainOutline,
    ).toBe(false)
  })

  it("rejects legacy placeholder-shaped Story Outline Regenerator output without auto-repair", () => {
    const legacyOutput = {
      provisionalOutlinePatch: {},
      outlineRevisionProposal: {},
      regenerationSafetyReport: {},
      warnings: [],
    }

    expect(() => parseRpgStoryOutlineRegeneratorOutput(JSON.stringify(legacyOutput), sampleRegeneratorInput())).toThrow(
      /nextSceneDirection|summary|safetyConclusion/i,
    )
  })

  it("compiles lightweight draft and strips model-authored ids and boundaries", () => {
    const input = sampleRegeneratorInput()
    const draft = {
      provisionalOutlinePatch: {
        patchId: "model-patch",
        affectedOutlineRefs: ["beat.follow_mira_warning", "reveal.gate_patron"],
        suspendedBeatRefs: ["beat.decode_gate"],
        invalidatedBeatRefs: ["beat.decode_gate"],
        preservedConfirmedFacts: [],
        runtimeDeltaRefs: ["ongoing-mira-sigil-read"],
        narrativeLines: ["playerVisibleLine", "tensionLine"],
        narrationHandoff: {
          handoffId: "model-handoff",
          mustFollow: ["Acknowledge Mira's completed warning."],
          mustPreserveFacts: [],
          mustNotReveal: [],
          invalidatedOldBeats: ["beat.decode_gate"],
          nextSceneDirection: "Keep the next scene focused on the gate decision.",
          outlineRefs: ["beat.follow_mira_warning", "reveal.gate_patron"],
        },
        nonPersistenceBoundary: {
          writesToWiki: false,
          modifiesMainOutline: false,
        },
      },
      outlineRevisionProposal: {
        proposalId: "model-proposal",
        targetOutlineRefs: ["beat.follow_mira_warning", "reveal.gate_patron"],
        invalidatedAssumptions: ["The old touch-first beat order is no longer reliable."],
        mustPreserveFacts: [],
        proposedRevision: {
          summary: "Future-only review candidate: branch the canal gate sequence around Mira's warning.",
          revisedBeats: ["Follow with a trust decision around the safe edge."],
          revisedRevealOrder: ["Keep the hidden patron reveal delayed."],
          branchAdjustments: ["Track the trust-forward branch."],
        },
      },
      regenerationSafetyReport: {
        safetyConclusion: "safe",
        checkedRuntimeRefs: ["ongoing-mira-sigil-read"],
        checkedOutlineRefs: ["beat.follow_mira_warning", "reveal.gate_patron"],
        warnings: [],
      },
      warnings: [],
    }

    const output = parseRpgStoryOutlineRegeneratorOutput(JSON.stringify(draft), input)

    expect(output.provisionalOutlinePatch.patchId).toBe("provisional-outline-patch-regen-request-major")
    expect(output.provisionalOutlinePatch.runtimeDeltaRefs[0]).toMatchObject({
      deltaId: "delta-act-regenerate",
      sourceStage: "actionResolution",
    })
    expect(output.provisionalOutlinePatch.nonPersistenceBoundary.writesToWiki).toBe(false)
    expect(output.outlineRevisionProposal.reviewBoundary.autoWriteMainOutline).toBe(false)
  })

  it("accepts legal output and confirms provisional/review boundaries", () => {
    const output = sampleRegeneratorOutput()

    expect(validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toEqual(output)
    expect(output.provisionalOutlinePatch.nonPersistenceBoundary.sameTurnOnly).toBe(true)
    expect(output.provisionalOutlinePatch.nonPersistenceBoundary.writesToWiki).toBe(false)
    expect(output.provisionalOutlinePatch.nonPersistenceBoundary.modifiesMainOutline).toBe(false)
    expect(output.provisionalOutlinePatch.narrationHandoff.grantsPcKnowledgeFromHiddenMaterial).toBe(false)
    expect(output.outlineRevisionProposal.reviewItemKind).toBe("outlineRevision")
    expect(output.outlineRevisionProposal.reviewBoundary.reviewBoundary).toBe("independent_pending_review")
  })

  it("rejects wiki writes, player prose, nextActionOptions, and ordinary runtime updates", () => {
    const cases: Record<string, unknown>[] = [
      { wikiWrites: [] },
      { wikiWriteProposal: {} },
      { playerFacingText: "This is narration." },
      { narration: "Player-visible prose belongs to Narration." },
      { nextActionOptions: [] },
      { runtimeUpdate: {} },
      { runtimeWikiUpdate: {} },
      { proposedUpdates: [] },
    ]

    for (const pollution of cases) {
      const output = cloneOutput()
      Object.assign(output, pollution)
      expect(() => validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toThrow(
        /StoryOutlineRegeneratorOutput/i,
      )
    }
  })

  it("rejects direct wiki/outlines/main.md modification and future plans written into events", () => {
    const mainOutline = cloneOutput()
    mainOutline.provisionalOutlinePatch.affectedOutlineRefs[0].path = "wiki/outlines/main.md"
    expect(() => validateStoryOutlineRegeneratorOutput(mainOutline, sampleRegeneratorInput())).toThrow(
      /outlines\/main\.md/i,
    )

    const eventWrite = cloneOutput()
    eventWrite.outlineRevisionProposal.targetOutlineRefs[0].path = "wiki/events/future-plan.md"
    expect(() => validateStoryOutlineRegeneratorOutput(eventWrite, sampleRegeneratorInput())).toThrow(/events/i)
  })

  it("rejects wildcard, glob, or category path refs in outline refs and visibility boundaries", () => {
    const wildcardOutlineRef = cloneOutput()
    wildcardOutlineRef.provisionalOutlinePatch.affectedOutlineRefs[0].path = "wiki/sources/*.md"
    expect(() => validateStoryOutlineRegeneratorOutput(wildcardOutlineRef, sampleRegeneratorInput())).toThrow(
      /path|refs/i,
    )

    const wildcardBoundary = cloneOutput()
    wildcardBoundary.provisionalOutlinePatch.visibilityBoundary[0].sourcePath = "wiki/sources/*.md"
    expect(() => validateStoryOutlineRegeneratorOutput(wildcardBoundary, sampleRegeneratorInput())).toThrow(
      /path|refs/i,
    )
  })

  it("rejects confirmed fact rewrites and forbidden reveal leaks", () => {
    const rewrite = cloneOutput()
    rewrite.outlineRevisionProposal.invalidatedAssumptions.push("fact.mira-warning is invalid now.")
    expect(() => validateStoryOutlineRegeneratorOutput(rewrite, sampleRegeneratorInput())).toThrow(
      /confirmed facts/i,
    )

    const leak = cloneOutput()
    leak.provisionalOutlinePatch.narrationHandoff.mustFollow.push("Tell the PC reveal.gate_patron immediately.")
    expect(() => validateStoryOutlineRegeneratorOutput(leak, sampleRegeneratorInput())).toThrow(
      /forbidden reveal/i,
    )
  })

  it("rejects hidden, gm_only, parallelLine-only, or user_visible_pc_unknown material becoming PC knowledge", () => {
    const output = cloneOutput()
    output.provisionalOutlinePatch.narrationHandoff.visibilityBoundaries[0] = {
      ...output.provisionalOutlinePatch.narrationHandoff.visibilityBoundaries[0],
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
      grantsPcKnowledge: true,
    }

    expect(() => validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toThrow(/PC knowledge/i)
  })

  it("rejects outlineRevisionProposal using ordinary runtime update review kind", () => {
    const output = cloneOutput()
    ;(output.outlineRevisionProposal as unknown as Record<string, unknown>).reviewItemKind = "runtimeWikiUpdate"

    expect(() => validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toThrow(/reviewItemKind/i)
  })

  it("rejects provisionalOutlinePatch claims that it has landed or modified outlines/main.md", () => {
    const output = cloneOutput()
    ;(output.provisionalOutlinePatch.nonPersistenceBoundary as unknown as Record<string, unknown>).writesToWiki = true

    expect(() => validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toThrow(/writesToWiki/i)
  })

  it("rejects unsafe safety reports and out-of-bound refs", () => {
    const unsafe = cloneOutput()
    ;(unsafe.regenerationSafetyReport as unknown as Record<string, unknown>).futureNotWrittenAsEvent = false
    expect(() => validateStoryOutlineRegeneratorOutput(unsafe, sampleRegeneratorInput())).toThrow(
      /futureNotWrittenAsEvent/i,
    )

    const unknownRuntimeRef = cloneOutput()
    unknownRuntimeRef.regenerationSafetyReport.checkedRuntimeRefs = ["unknown-delta"]
    expect(() => validateStoryOutlineRegeneratorOutput(unknownRuntimeRef, sampleRegeneratorInput())).toThrow(
      /runtime ref/i,
    )

    const unknownOutlineRef = cloneOutput()
    unknownOutlineRef.regenerationSafetyReport.checkedOutlineRefs = ["unknown-beat"]
    expect(() => validateStoryOutlineRegeneratorOutput(unknownOutlineRef, sampleRegeneratorInput())).toThrow(
      /outline ref/i,
    )
  })

  it("rejects top-level JSON outside the allowed output shape", () => {
    const output = cloneOutput()
    Object.assign(output, { extra: true })

    expect(() => validateStoryOutlineRegeneratorOutput(output, sampleRegeneratorInput())).toThrow(/top-level/i)
  })

  it("routes fixture and LLM adapters through parser and validator", async () => {
    const input = sampleRegeneratorInput()
    const output = sampleRegeneratorOutput()
    const prompt = buildStoryOutlineRegeneratorPrompt(input)
    const fixture = createFixtureStoryOutlineRegeneratorAdapter(output)

    await expect(fixture.regenerateOutline(prompt, input)).resolves.toEqual(output)

    const rawOutput = ["```json\n", JSON.stringify(output), "\n```"].join("")
    const signal = new AbortController().signal
    const requestOverrides = { temperature: 0.1, max_tokens: 1800 }
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(rawOutput.slice(0, 16))
      callbacks.onToken(rawOutput.slice(16))
      callbacks.onDone()
    })

    const llm = createLlmRpgStoryOutlineRegeneratorAdapter(
      { llmConfig: sampleLlmConfig(), signal },
      { requestOverrides },
    )
    const parsed = await llm.regenerateOutline(prompt, input)
    expect(parsed.provisionalOutlinePatch.patchId).toBe("provisional-outline-patch-regen-request-major")
    expect(parsed.provisionalOutlinePatch.nonPersistenceBoundary.writesToWiki).toBe(false)
    expect(parsed.outlineRevisionProposal.reviewBoundary.autoWriteMainOutline).toBe(false)
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

  it("exposes outline_regeneration without changing slots, categories, or wiki runtime paths", async () => {
    expect(getRpgInteractionRegistryEntry("outline_regeneration")).toMatchObject({
      kind: "outline_regeneration",
      stage: "runtime_story_outline_regenerator",
      usesLlm: true,
      implemented: true,
      spec: storyOutlineRegeneratorInteractionSpec,
    })

    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.path)).not.toContain("wiki/runtime/")

    const orchestrator = await fs.readFile("src/lib/rpg-runtime/turn-orchestrator.ts", "utf-8")
    expect(orchestrator).toContain("storyOutlineRegeneratorAdapter")
    expect(orchestrator).toContain('impactLevel === "major_rewrite_required"')
    expect(orchestrator).toContain("requiresRegeneration")
    expect(orchestrator).toContain("storyOutlineRegeneratorInteractionSpec.parseOutput")
  })
})

function cloneOutput(): StoryOutlineRegeneratorOutput {
  return JSON.parse(JSON.stringify(sampleRegeneratorOutput())) as StoryOutlineRegeneratorOutput
}

function sampleRegeneratorInput(): StoryOutlineRegeneratorInput {
  const submittedAction: SubmittedAction = {
    id: "act-regenerate",
    text: "Wait while Mira completes the sigil reading.",
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
  const runtimeRefs = [
    ...postActionWorkingState.runtimeDeltaRefs,
    ...actionResolution.runtimeDeltaRefs,
    ...worldTickResult.runtimeDeltaRefs,
  ]
  const playerRef = playerVisibleReference()

  return {
    postActionWorkingState,
    outlineImpactReport: {
      reportId: "outline-impact-major",
      impactLevel: "major_rewrite_required",
      affected: {
        lines: ["playerVisibleLine", "tensionLine"],
        beats: [stableRef("beat.decode_gate")],
        reveals: [stableRef("reveal.gate_patron")],
        branchConditions: [stableRef("branch.waited_for_mira")],
        plotArcs: [stableRef("plotArc.canal_gate", "wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel")],
        tensionLine: [stableRef("fuel.canal_gate_tension", "wiki/plot-arcs/runtime/canal-gate.md", "plotArc.tension_fuel")],
      },
      invalidatedAssumptions: ["The original beat order cannot assume the player touched the key first."],
      reason: "The player's wait creates a major divergence in the reveal order.",
      requiresRegeneration: true,
    },
    regenerationRequest: {
      requestId: "regen-request-major",
      sourceImpactReportId: "outline-impact-major",
      impactLevel: "major_rewrite_required",
      reason: "Rebuild the near-term outline around Mira's completed reading.",
      affectedLines: ["playerVisibleLine", "tensionLine"],
      sourceRefs: [playerRef],
      mustPreserve: ["fact.mira-warning"],
      mustRecheck: ["reveal.gate_patron", "beat.decode_gate"],
    },
    recalledMaterials: [
      ...sampleRecalledMaterials(),
      {
        path: "wiki/outlines/progress.md",
        lineTarget: "tensionLine",
        readMode: "focusedSection",
        priority: "critical",
        reason: "Read adjacent outline beats.",
        expectedUse: "Support regeneration.",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        sections: [
          {
            sectionId: "outlineProgress.adjacent_beats",
            readMode: "focusedSection",
            priority: "critical",
            reason: "Stable outline section.",
            expectedUse: "Bound regenerated outline refs.",
            content: "Beat decode gate, reveal patron later.",
            warnings: [],
          },
        ],
        warnings: [],
      },
      {
        path: "wiki/plot-arcs/runtime/canal-gate.md",
        lineTarget: "tensionLine",
        readMode: "focusedSection",
        priority: "critical",
        reason: "Read tension fuel.",
        expectedUse: "Support regeneration.",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        sections: [
          {
            sectionId: "plotArc.tension_fuel",
            readMode: "focusedSection",
            priority: "critical",
            reason: "Stable plot-arc section.",
            expectedUse: "Bound tension refs.",
            content: "Canal gate tension remains unresolved.",
            warnings: [],
          },
        ],
        warnings: [],
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
        summary: "Decode the gate before the patron reveal.",
        beatRefs: [
          { ...stableRef("beat.decode_gate"), refType: "beat", beatStatus: "invalidated" },
          { ...stableRef("beat.follow_mira_warning"), refType: "beat", beatStatus: "branch_candidate" },
        ],
        revealRefs: [
          {
            ...stableRef("reveal.gate_patron"),
            refType: "reveal",
            revealPolicy: "forbid",
            revealTiming: "After the sigil is decoded.",
          },
        ],
        branchConditionRefs: [
          {
            ...stableRef("branch.waited_for_mira"),
            refType: "branchCondition",
            conditionStatus: "triggered",
          },
        ],
        dependencies: [
          {
            dependencyId: "dependency.decode-before-patron",
            dependsOnStableIds: ["beat.decode_gate"],
            invalidatedByStableIds: ["branch.waited_for_mira"],
            reason: "The old beat order is invalid after waiting for Mira.",
          },
        ],
        lineTargets: [
          {
            lineTarget: "playerVisibleLine",
            allowedStableIds: ["beat.follow_mira_warning"],
            forbiddenStableIds: ["reveal.gate_patron"],
            guidance: "Use Mira's warning without naming the patron.",
          },
        ],
        revealPolicies: [
          {
            directiveId: "policy-forbid-patron",
            stableId: "reveal.gate_patron",
            policy: "forbid",
            lineTarget: "playerVisibleLine",
            reason: "The patron remains hidden.",
          },
        ],
        invalidationNotes: ["Old touch-first beat is suspended this turn."],
      },
    ],
    plotArcTensionFuel: [
      {
        fuelId: "fuel.canal_gate_tension",
        path: "wiki/plot-arcs/runtime/canal-gate.md",
        sectionId: "plotArc.tension_fuel",
        plotArcId: "plotArc.canal_gate",
        summary: "Mira's warning and the patrol clock keep tension alive.",
        tensionLineTarget: "complicate",
        pressureSources: ["clock-harbor-watch-return"],
        relationshipRefs: ["wiki/relationships/runtime/player_mira.md"],
        forbiddenResolutions: ["Do not reveal the gate patron yet."],
      },
    ],
    visibilityBoundaries: [
      {
        boundaryId: "visibility.pc-known-only",
        lineTarget: "playerVisibleLine",
        visibilityScope: "pc_visible",
        knowledgeScope: "pc_known",
        grantsPcKnowledge: true,
        sourcePath: "wiki/current-scene/scene_state.md",
        sectionId: "slot.current_scene",
        reason: "Only PC-visible material can guide player-facing narration.",
      },
      {
        boundaryId: "visibility.hidden-patron",
        lineTarget: "tensionLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        grantsPcKnowledge: false,
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        reason: "Patron reveal stays hidden.",
      },
    ],
    hardConstraints: [
      {
        constraintId: "constraint.no-patron-reveal",
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        summary: "Do not reveal the gate patron.",
        appliesToLines: ["playerVisibleLine", "parallelLine", "tensionLine"],
        mustPreserve: ["fact.mira-warning"],
        mustNotReveal: ["reveal.gate_patron"],
      },
    ],
    confirmedFacts: [
      {
        factId: "fact.mira-warning",
        summary: "Confirmed fact alpha.",
        sourceRefs: [playerRef],
        runtimeDeltaRefs: [runtimeRefs.find((ref) => ref.deltaId === "ongoing-mira-sigil-read") ?? runtimeRefs[0]],
        happenedStatus: "confirmed_happened",
        mustPreserve: true,
      },
    ],
    forbiddenReveals: [
      {
        revealId: "reveal.gate_patron",
        stableId: "reveal.gate_patron",
        sourcePath: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        lineTarget: "playerVisibleLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        reason: "The patron is forbidden this turn.",
      },
    ],
    runtimeRefs,
    knownReferences: [
      {
        path: "wiki/current-scene/scene_state.md",
        sectionId: "slot.current_scene",
        runtimeDeltaId: "ongoing-mira-sigil-read",
        reason: "Confirmed visible reaction.",
      },
      {
        path: "wiki/outlines/progress.md",
        sectionId: "outlineProgress.adjacent_beats",
        stableId: "beat.follow_mira_warning",
        reason: "Replacement near-term beat.",
      },
    ],
  }
}

function sampleRegeneratorOutput(): StoryOutlineRegeneratorOutput {
  const runtimeRef = runtimeDeltaRef()
  const affectedRefs = [stableRef("beat.follow_mira_warning"), stableRef("reveal.gate_patron")]

  return {
    provisionalOutlinePatch: {
      patchId: "provisional-outline-patch-major",
      sourceRequestId: "regen-request-major",
      scope: "same_turn_only",
      outlineImpactLevel: "major_rewrite_required",
      affectedOutlineRefs: affectedRefs,
      suspendedBeatRefs: [stableRef("beat.decode_gate")],
      invalidatedBeatRefs: [stableRef("beat.decode_gate")],
      preservedConfirmedFacts: ["fact.mira-warning"],
      runtimeDeltaRefs: [runtimeRef],
      narrativeLines: ["playerVisibleLine", "tensionLine"],
      visibilityBoundary: [pcBoundary(), hiddenBoundary()],
      narrationHandoff: {
        handoffId: "provisional-narration-handoff-major",
        sourcePatchId: "provisional-outline-patch-major",
        mustFollow: ["Acknowledge Mira's completed warning and keep the gate decision immediate."],
        mustPreserveFacts: ["fact.mira-warning"],
        mustNotReveal: ["reveal.gate_patron"],
        invalidatedOldBeats: ["beat.decode_gate"],
        nextSceneDirection: "Let the next scene turn on whether Iven trusts Mira's safe-edge warning.",
        narrativeLines: ["playerVisibleLine", "tensionLine"],
        visibilityBoundaries: [pcBoundary(), hiddenBoundary()],
        runtimeDeltaRefs: [runtimeRef],
        outlineRefs: affectedRefs,
        grantsPcKnowledgeFromHiddenMaterial: false,
      },
      nonPersistenceBoundary: {
        sameTurnOnly: true,
        writesToWiki: false,
        modifiesMainOutline: false,
        persistedToOutlinesMain: false,
        ordinaryRuntimeUpdate: false,
        acceptedWikiFacts: false,
      },
    },
    outlineRevisionProposal: {
      proposalId: "outline-revision-proposal-major",
      sourceRequestId: "regen-request-major",
      reviewItemKind: "outlineRevision",
      outlineImpactLevel: "major_rewrite_required",
      targetOutlineRefs: affectedRefs,
      invalidatedAssumptions: ["The old touch-first beat order is no longer reliable."],
      mustPreserveFacts: ["fact.mira-warning"],
      proposedRevision: {
        summary: "Future-only review candidate: branch the canal gate sequence around Mira's warning.",
        revisedBeats: ["Follow with a trust decision around the safe edge."],
        revisedRevealOrder: ["Keep the hidden patron reveal delayed until after the ward response."],
        branchAdjustments: ["Track that waiting for Mira created a trust-forward branch."],
        futureOnly: true,
      },
      visibilityAndKnowledgeScope: [pcBoundary(), hiddenBoundary()],
      runtimeDeltaRefs: [runtimeRef],
      reviewBoundary: {
        reviewItemKind: "outlineRevision",
        reviewBoundary: "independent_pending_review",
        ordinaryRuntimeUpdate: false,
        proposedWikiUpdate: false,
        autoWriteMainOutline: false,
        mainOutlineWritePolicy: "manual_or_review_only",
      },
    },
    regenerationSafetyReport: {
      reportKind: "regenerationSafetyReport",
      safetyConclusion: "safe",
      preservesConfirmedFacts: true,
      futureNotWrittenAsEvent: true,
      forbiddenRevealProtected: true,
      mainOutlineNotDirectlyModified: true,
      provisionalPatchNonPersistent: true,
      proposalReviewBoundary: true,
      ordinaryRuntimeUpdateBoundary: true,
      noWikiWrite: true,
      noPlayerFacingProse: true,
      checkedRuntimeRefs: ["ongoing-mira-sigil-read"],
      checkedOutlineRefs: ["beat.follow_mira_warning", "reveal.gate_patron"],
      warnings: [],
    },
    warnings: [],
  }
}

function playerVisibleReference(): OutlineBriefReference {
  return {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    runtimeDeltaId: "ongoing-mira-sigil-read",
    lineTarget: "playerVisibleLine",
    usePurpose: "outlineControl",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    reason: "Confirmed Mira warning visible to the player.",
  }
}

function stableRef(
  stableId: string,
  path = "wiki/outlines/progress.md",
  sectionId = "outlineProgress.adjacent_beats",
): OutlineStableRef {
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

function runtimeDeltaRef() {
  return {
    deltaId: "ongoing-mira-sigil-read",
    sourceStage: "worldTick",
    sourcePath: ".llm-wiki/runtime/turns/act-world-tick/world-tick.json#ongoing-mira-sigil-read",
    summary: "Mira finishes enough of the sigil read to identify a safe edge.",
    narrativeLine: "playerVisibleLine",
    usePurpose: "worldTick",
    happenedStatus: "confirmed_happened",
  } as const
}

function pcBoundary() {
  return {
    boundaryId: "visibility.pc-known-only",
    lineTarget: "playerVisibleLine",
    visibilityScope: "pc_visible",
    knowledgeScope: "pc_known",
    grantsPcKnowledge: true,
    sourcePath: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    reason: "Player-facing handoff can use confirmed visible facts.",
  } as const
}

function hiddenBoundary() {
  return {
    boundaryId: "visibility.hidden-patron",
    lineTarget: "tensionLine",
    visibilityScope: "gm_only",
    knowledgeScope: "gm_only",
    grantsPcKnowledge: false,
    sourcePath: "wiki/outlines/progress.md",
    sectionId: "outlineProgress.adjacent_beats",
    reason: "Forbidden reveal stays hidden.",
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

function expectPromptDebugSectionsRecompose(prompt: ReturnType<typeof buildStoryOutlineRegeneratorPrompt>): void {
  const sections = prompt.debugSections ?? []
  expect(sections.filter((section) => section.promptRole === "system").map((section) => section.content).join("\n\n")).toBe(
    prompt.systemPrompt,
  )
  expect(sections.filter((section) => section.promptRole === "user").map((section) => section.content).join("\n\n")).toBe(
    prompt.userPrompt,
  )
}
