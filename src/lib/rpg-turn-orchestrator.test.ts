import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createFixtureActionResolverAdapter,
  createFixtureNarrationGeneratorAdapter,
  createFixtureOutlineBriefAdapter,
  createFixtureRecallSelectorAdapter,
  createFixtureWorldTickAdapter,
  validateTurnNarration,
  type RpgActionResolverPrompt,
  type RpgNarrationGeneratorPrompt,
  type RpgOutlineBriefPrompt,
  type RpgStoryOutlineRegeneratorPrompt,
  type RpgWorldTickPrompt,
} from "./rpg-interactions/runtime"
import {
  sampleActionResolution,
  sampleMajorOutlineBriefOutput,
  sampleOutlineBriefOutput,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import {
  runRpgTurn,
  createTurnResultFromTurnNarration,
  type ActionResolverInput,
  type OutlineBriefCompilerInput,
  type NarrationGeneratorInput,
  type StoryOutlineRegeneratorInput,
  type StoryOutlineRegeneratorOutput,
  type SubmittedAction,
  type WorldTickInput,
} from "./rpg-runtime"

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

describe("RPG Runtime Turn Orchestrator", () => {
  it("runs a fixture-driven single turn from submitted action to completed turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-flow") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const submittedAction: SubmittedAction = {
      id: "act-1",
      text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
      source: "freeform",
    }
    const turnNarration = sampleTurnNarration()
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)
    const calls: string[] = []
    let capturedActionResolverPrompt: RpgActionResolverPrompt | undefined
    let capturedWorldTickPrompt: RpgWorldTickPrompt | undefined
    let capturedWorldTickInput: WorldTickInput | undefined
    let capturedRecallSelectorInputPaths: string[] = []
    let capturedOutlineBriefPrompt: RpgOutlineBriefPrompt | undefined
    let capturedOutlineBriefInput: OutlineBriefCompilerInput | undefined
    let capturedPrompt: RpgNarrationGeneratorPrompt | undefined
    let capturedNarrationInput: NarrationGeneratorInput | undefined

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: {
        async resolveAction(prompt) {
          calls.push("actionResolver")
          capturedActionResolverPrompt = prompt
          return actionResolution
        },
      },
      worldTickAdapter: {
        async advanceWorldTick(prompt, promptInput) {
          calls.push("worldTick")
          capturedWorldTickPrompt = prompt
          capturedWorldTickInput = promptInput
          return worldTickResult
        },
      },
      recallSelectorAdapter: {
        async selectRecall(_prompt, promptInput) {
          calls.push("recallSelector")
          capturedRecallSelectorInputPaths = promptInput.retrievalIndex.map((entry) => entry.path)
          return sampleRecallSelection("post-action-working-state-act-1")
        },
      },
      outlineBriefCompilerAdapter: {
        async compileOutlineBrief(prompt, promptInput) {
          calls.push("deterministicReadHandoff")
          calls.push("outlineBriefCompiler")
          capturedOutlineBriefPrompt = prompt
          capturedOutlineBriefInput = promptInput
          expect(promptInput.postActionWorkingState).toEqual(postActionWorkingStateFromPromptInput(promptInput))
          expect(promptInput.recalledMaterials[0]?.path).toBe("wiki/current-scene/scene_state.md")
          return sampleOutlineBriefOutput(submittedAction)
        },
      },
      narrationAdapter: {
        async generateNarration(prompt, promptInput) {
          expect(promptInput.postActionWorkingState.worldTickResult).toEqual(worldTickResult)
          expect(promptInput.recallSelection.selectionId).toBe("recall-selection-act-1")
          expect(promptInput.recalledMaterials[0]?.path).toBe("wiki/current-scene/scene_state.md")
          expect(promptInput.outlineAwareNarrationBrief.briefId).toBe("outline-brief-act-1")
          expect(promptInput.provisionalNarrationHandoff).toBeUndefined()
          calls.push("narration")
          capturedPrompt = prompt
          capturedNarrationInput = promptInput
          return turnNarration
        },
      },
    })

    expect(calls).toEqual([
      "actionResolver",
      "worldTick",
      "recallSelector",
      "deterministicReadHandoff",
      "outlineBriefCompiler",
      "narration",
    ])
    expect(capturedActionResolverPrompt?.systemPrompt).toContain("Action Resolver")
    expect(capturedActionResolverPrompt?.userPrompt).toContain("## Pre-Action Snapshot")
    expect(capturedWorldTickPrompt?.systemPrompt).toContain("World Tick")
    expect(capturedWorldTickInput?.playerActionDelta).toBe(capturedWorldTickInput?.actionResolution.playerActionDelta)
    expect(capturedWorldTickInput?.actionResolution).toEqual(actionResolution)
    expect(capturedRecallSelectorInputPaths).toContain("wiki/current-scene/scene_state.md")
    expect(capturedRecallSelectorInputPaths).toContain("wiki/factions/runtime/harbor-watch.md")
    expect(capturedOutlineBriefPrompt?.systemPrompt).toContain("Outline-aware Brief Compiler")
    expect(capturedOutlineBriefInput?.postActionWorkingState).toEqual(result.postActionWorkingState)
    expect(capturedOutlineBriefInput?.actionResolution).toEqual(actionResolution)
    expect(capturedOutlineBriefInput?.worldTickResult).toEqual(worldTickResult)
    expect(capturedOutlineBriefInput?.visibleSelection).toEqual(result.visibleSelection)
    expect(capturedOutlineBriefInput?.recallSelection).toEqual(result.recallSelection)
    expect(capturedOutlineBriefInput?.recalledMaterials).toEqual(result.recalledMaterials)
    expect(capturedOutlineBriefInput?.visibilityBoundaries[0]).toMatchObject({
      sourcePath: "wiki/current-scene/scene_state.md",
      grantsPcKnowledge: true,
    })
    expect(capturedOutlineBriefInput?.knownReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wiki/current-scene/scene_state.md",
          sectionId: "slot.current_scene",
        }),
      ]),
    )
    expect(capturedPrompt?.systemPrompt).toContain("Narration Generator")
    expect(capturedPrompt?.systemPrompt).toContain("Return strict JSON matching TurnNarration only")
    expect(capturedPrompt?.systemPrompt).toContain("parallel line display is not PC knowledge")
    expect(capturedPrompt?.systemPrompt).toContain("outlineRevisionProposal is not Narration fact material")
    expect(capturedPrompt?.userPrompt).toContain("## ActionResolution")
    expect(capturedPrompt?.userPrompt).toContain("## WorldTickResult")
    expect(capturedPrompt?.userPrompt).toContain("## WorldTickVisibleSelection")
    expect(capturedPrompt?.userPrompt).toContain("## PostActionWorkingState")
    expect(capturedPrompt?.userPrompt).toContain("## RecallSelection")
    expect(capturedPrompt?.userPrompt).toContain("## recalledMaterials")
    expect(capturedPrompt?.userPrompt).toContain("## OutlineAwareNarrationBrief")
    expect(capturedPrompt?.userPrompt).toContain("outline-brief-act-1")
    expect(capturedPrompt?.userPrompt).not.toContain("FULL_OUTLINES_MAIN_POISON")
    expect(capturedPrompt?.userPrompt).toContain("world-delta-watch-captain-order")
    expect(capturedPrompt?.userPrompt).toContain("attempted_not_confirmed")
    expect(capturedPrompt?.userPrompt).toContain("A careful inspection consumes a few focused minutes.")
    expect(capturedPrompt?.userPrompt).toContain(submittedAction.text)
    expect(capturedNarrationInput?.outlineAwareNarrationBrief).toEqual(result.outlineAwareNarrationBrief)
    expect(capturedNarrationInput?.forbiddenNarrationConstraints.map((constraint) => constraint.lineTarget)).toContain(
      "parallelLine",
    )
    expect(capturedNarrationInput?.playerKnowledgeBoundary.parallelLineDoesNotGrantPcKnowledge).toBe(true)
    expect("brief" in result).toBe(false)
    expect(result.actionResolution).toEqual(actionResolution)
    expect(result.worldTickResult).toEqual(worldTickResult)
    expect(result.visibleSelection.parallelLensCandidates[0]).toMatchObject({
      sourceId: "world-delta-watch-captain-order",
      grantsPcKnowledge: false,
    })
    expect(result.postActionWorkingState.campaignDelta).toBe(
      "The patrol clock and Mira's warning both move the gate scene forward.",
    )
    expect(result.turnNarration).toEqual(turnNarration)
    expect(result.turnResult).toEqual(createTurnResultFromTurnNarration(turnNarration))
    expect(result.turnRecord).toEqual({
      submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection: result.visibleSelection,
      postActionWorkingState: result.postActionWorkingState,
      recallSelection: result.recallSelection,
      recalledMaterials: result.recalledMaterials,
      outlineAwareNarrationBrief: result.outlineAwareNarrationBrief,
      outlineImpactReport: result.outlineImpactReport,
      turnNarration,
      generatedNarrative: turnNarration.playerFacingText,
      references: [
        "wiki/current-scene/scene_state.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/player/player.md",
        "wiki/rules/core.md",
      ],
    })
    expect(result.warnings.join("\n")).not.toContain("legacy_context_compiler")
    expect(result.warnings.join("\n")).not.toContain("runtime preview")
  })

  it("builds action resolver input directly from wiki without a later preview result surface", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-action-before-preview") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction: SubmittedAction = {
      id: "act-action-before-preview",
      text: "Ask Mira to inspect the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    let capturedActionInput: ActionResolverInput | undefined

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: {
        async resolveAction(_prompt, promptInput) {
          capturedActionInput = promptInput
          await writeFileRaw(
            `${projectPath}/wiki/characters/runtime/mira.md`,
            "# Mira Runtime State\n\nAFTER_ACTION_PREVIEW_MARKER: Mira changes stance after action resolution starts.",
          )
          return actionResolution
        },
      },
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(actionResolution)),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection("post-action-working-state-act-action-before-preview"),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })

    expect(JSON.stringify(capturedActionInput)).toContain("Overlay page: Mira is limping")
    expect(JSON.stringify(capturedActionInput)).not.toContain("AFTER_ACTION_PREVIEW_MARKER")
    expect("brief" in result).toBe(false)
    expect(JSON.stringify(result)).not.toContain("AFTER_ACTION_PREVIEW_MARKER")
    expect(result.warnings.join("\n")).not.toContain("legacy_context_compiler")
  })

  it("runs world tick and recall selector without invoking a later preview result surface", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-recall-before-preview") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction: SubmittedAction = {
      id: "act-recall-before-preview",
      text: "Ask Mira to inspect the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)
    let capturedWorldTickInput: WorldTickInput | undefined
    let capturedRecallInputSerialized = ""

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(actionResolution),
      worldTickAdapter: {
        async advanceWorldTick(_prompt, promptInput) {
          capturedWorldTickInput = promptInput
          return worldTickResult
        },
      },
      recallSelectorAdapter: {
        async selectRecall(_prompt, promptInput) {
          capturedRecallInputSerialized = JSON.stringify(promptInput)
          await writeFileRaw(
            `${projectPath}/wiki/characters/runtime/mira.md`,
            "# Mira Runtime State\n\nAFTER_RECALL_PREVIEW_MARKER: Mira changes stance after recall selector starts.",
          )
          return sampleRecallSelection("post-action-working-state-act-recall-before-preview")
        },
      },
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })

    expect(JSON.stringify(capturedWorldTickInput)).not.toContain("AFTER_RECALL_PREVIEW_MARKER")
    expect(capturedRecallInputSerialized).not.toContain("AFTER_RECALL_PREVIEW_MARKER")
    expect("brief" in result).toBe(false)
    expect(JSON.stringify(result)).not.toContain("AFTER_RECALL_PREVIEW_MARKER")
    expect(result.warnings.join("\n")).not.toContain("runtime preview")
  })

  it("runs outline brief and narration without invoking a later preview result surface", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-narration-before-preview") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction: SubmittedAction = {
      id: "act-narration-before-preview",
      text: "Ask Mira to inspect the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)
    let capturedOutlineInputSerialized = ""
    let capturedNarrationInputSerialized = ""

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(actionResolution),
      worldTickAdapter: createFixtureWorldTickAdapter(worldTickResult),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection("post-action-working-state-act-narration-before-preview"),
      ),
      outlineBriefCompilerAdapter: {
        async compileOutlineBrief(_prompt, promptInput) {
          capturedOutlineInputSerialized = JSON.stringify(promptInput)
          return sampleOutlineBriefOutput(submittedAction)
        },
      },
      narrationAdapter: {
        async generateNarration(_prompt, promptInput) {
          capturedNarrationInputSerialized = JSON.stringify(promptInput)
          await writeFileRaw(
            `${projectPath}/wiki/characters/runtime/mira.md`,
            "# Mira Runtime State\n\nAFTER_NARRATION_PREVIEW_MARKER: Mira changes stance after narration has its input.",
          )
          return sampleTurnNarration()
        },
      },
    })

    expect(capturedOutlineInputSerialized).not.toContain("AFTER_NARRATION_PREVIEW_MARKER")
    expect(capturedNarrationInputSerialized).not.toContain("AFTER_NARRATION_PREVIEW_MARKER")
    expect("brief" in result).toBe(false)
    expect(JSON.stringify(result)).not.toContain("AFTER_NARRATION_PREVIEW_MARKER")
    expect(result.warnings.join("\n")).not.toContain("runtime preview")
  })

  it("cleans turn result references without allowing legacy paths", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-reference-cleaning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgTurn({
      projectPath,
      submittedAction: { id: "act-2", text: "Ask Mira about the sigil.", source: "freeform" },
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(
        sampleActionResolution({ id: "act-2", text: "Ask Mira about the sigil.", source: "freeform" }),
      ),
      worldTickAdapter: createFixtureWorldTickAdapter(
        sampleWorldTickResult(sampleActionResolution({ id: "act-2", text: "Ask Mira about the sigil.", source: "freeform" })),
      ),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(sampleRecallSelection()),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(
        sampleOutlineBriefOutput({ id: "act-2", text: "Ask Mira about the sigil.", source: "freeform" }),
      ),
      narrationAdapter: createFixtureNarrationGeneratorAdapter({
        ...sampleTurnNarration(),
        references: [
          {
            path: "wiki/player/player.md",
            usePurpose: "narration",
            reason: "Duplicate player reference.",
          },
          {
            path: "wiki/entities/legacy-poison.md",
            usePurpose: "narration",
            reason: "Legacy poison reference.",
          },
          {
            path: "wiki/characters/mira.md",
            usePurpose: "narration",
            reason: "Character reference.",
          },
        ],
      }),
    })

    expect(result.turnResult.references).toEqual(["wiki/characters/mira.md", "wiki/player/player.md"])
    expect(result.turnRecord.references).toEqual([
      "wiki/characters/mira.md",
      "wiki/current-scene/scene_state.md",
      "wiki/factions/runtime/harbor-watch.md",
      "wiki/player/player.md",
      "wiki/rules/core.md",
    ])
  })

  it("rejects malformed narration adapter output", () => {
    expect(() =>
      validateTurnNarration({
        nextActionOptions: sampleTurnNarration().nextActionOptions,
        references: [],
      }),
    ).toThrow(/playerFacingText/)

    expect(() =>
      validateTurnNarration({
        ...sampleTurnNarration(),
        nextActionOptions: sampleTurnNarration().nextActionOptions.slice(0, 2),
      }),
    ).toThrow(/3 to 5/)

    expect(() =>
      validateTurnNarration({
        ...sampleTurnNarration(),
        nextActionOptions: [
          ...sampleTurnNarration().nextActionOptions,
          ...sampleTurnNarration().nextActionOptions,
        ],
      }),
    ).toThrow(/3 to 5/)

    expect(() =>
      validateTurnNarration({
        ...sampleTurnNarration(),
        nextActionOptions: [
          { ...sampleTurnNarration().nextActionOptions[0], intent: "romance" },
          sampleTurnNarration().nextActionOptions[1],
          sampleTurnNarration().nextActionOptions[2],
        ],
      }),
    ).toThrow(/intent/)

    expect(() =>
      validateTurnNarration({
        ...sampleTurnNarration(),
        nextActionOptions: [
          sampleTurnNarration().nextActionOptions[0],
          { ...sampleTurnNarration().nextActionOptions[1], riskLevel: "certain" },
          sampleTurnNarration().nextActionOptions[2],
        ],
      }),
    ).toThrow(/riskLevel/)

    expect(() =>
      validateTurnNarration({
        ...sampleTurnNarration(),
        references: "wiki/current-scene/scene_state.md",
      }),
    ).toThrow(/references/)
  })

  it("does not let unchosen option text enter the completed turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-options") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgTurn({
      projectPath,
      submittedAction: {
        id: "act-3",
        text: "Touch the lantern key to the lowest sigil.",
        source: "selected_option",
        selectedOptionId: "opt-key",
      },
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(
        sampleActionResolution({
          id: "act-3",
          text: "Touch the lantern key to the lowest sigil.",
          source: "selected_option",
          selectedOptionId: "opt-key",
        }),
      ),
      worldTickAdapter: createFixtureWorldTickAdapter(
        sampleWorldTickResult(
          sampleActionResolution({
            id: "act-3",
            text: "Touch the lantern key to the lowest sigil.",
            source: "selected_option",
            selectedOptionId: "opt-key",
          }),
        ),
      ),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(sampleRecallSelection()),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(
        sampleOutlineBriefOutput({
          id: "act-3",
          text: "Touch the lantern key to the lowest sigil.",
          source: "selected_option",
          selectedOptionId: "opt-key",
        }),
      ),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })
    const serializedRecord = JSON.stringify(result.turnRecord)

    expect("nextActionOptions" in result.turnRecord).toBe(false)
    expect(serializedRecord).not.toContain("Force the canal gate before Mira finishes reading.")
    expect(serializedRecord).not.toContain("Ask the patrol for help and reveal the lantern key.")
    expect(serializedRecord).not.toContain("opt-force")
  })

  it("does not write wiki files or generate pending updates during stage 4.5", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-readonly") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const before = await snapshotFiles(projectPath)
    const result = await runRpgTurn({
      projectPath,
      submittedAction: { id: "act-4", text: "Wait for Mira to finish studying the sigil.", source: "freeform" },
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(
        sampleActionResolution({ id: "act-4", text: "Wait for Mira to finish studying the sigil.", source: "freeform" }),
      ),
      worldTickAdapter: createFixtureWorldTickAdapter(
        sampleWorldTickResult(
          sampleActionResolution({ id: "act-4", text: "Wait for Mira to finish studying the sigil.", source: "freeform" }),
        ),
      ),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(sampleRecallSelection()),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(
        sampleOutlineBriefOutput({ id: "act-4", text: "Wait for Mira to finish studying the sigil.", source: "freeform" }),
      ),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(JSON.stringify(result)).not.toContain("pendingUpdates")
    expect(JSON.stringify(result)).not.toContain("proposedUpdates")
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("locked canal gate")
  })

  it("does not call Story Outline Regenerator for non-major impact even when an adapter is provided", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-outline-non-major") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = { id: "act-non-major", text: "Study the sigil carefully.", source: "freeform" as const }
    const regenerateOutline = vi.fn()

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(sampleActionResolution(submittedAction)),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection("post-action-working-state-act-non-major"),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(submittedAction)),
      storyOutlineRegeneratorAdapter: { regenerateOutline },
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })

    expect(regenerateOutline).not.toHaveBeenCalled()
    expect(result.provisionalOutlinePatch).toBeUndefined()
    expect(result.outlineRevisionProposal).toBeUndefined()
    expect(result.warnings.join("\n")).not.toContain("Story Outline Regenerator ran")
  })

  it("calls Story Outline Regenerator for major regeneration before narration and passes the provisional handoff", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-outline-major-called") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const before = await snapshotFiles(projectPath)
    const submittedAction = { id: "act-major", text: "Break the gate seal early.", source: "freeform" as const }
    const calls: string[] = []
    let capturedRegeneratorPrompt: RpgStoryOutlineRegeneratorPrompt | undefined
    let capturedRegeneratorInput: StoryOutlineRegeneratorInput | undefined
    let capturedNarrationInput: NarrationGeneratorInput | undefined

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: {
        async resolveAction() {
          calls.push("actionResolver")
          return sampleActionResolution(submittedAction)
        },
      },
      worldTickAdapter: {
        async advanceWorldTick() {
          calls.push("worldTick")
          return sampleWorldTickResult(sampleActionResolution(submittedAction))
        },
      },
      recallSelectorAdapter: {
        async selectRecall() {
          calls.push("recallSelector")
          return sampleRecallSelection("post-action-working-state-act-major")
        },
      },
      outlineBriefCompilerAdapter: {
        async compileOutlineBrief() {
          calls.push("deterministicReadHandoff")
          calls.push("outlineBriefCompiler")
          return sampleMajorOutlineBriefOutput(submittedAction)
        },
      },
      storyOutlineRegeneratorAdapter: {
        async regenerateOutline(prompt, promptInput) {
          calls.push("storyOutlineRegenerator")
          capturedRegeneratorPrompt = prompt
          capturedRegeneratorInput = promptInput
          return sampleRegeneratorOutputFromInput(promptInput)
        },
      },
      narrationAdapter: {
        async generateNarration(_prompt, promptInput) {
          calls.push("narration")
          capturedNarrationInput = promptInput
          return sampleTurnNarration({
            usedProvisionalPatch: true,
            provisionalHandoffId: promptInput.provisionalNarrationHandoff?.handoffId,
            provisionalSourcePatchId: promptInput.provisionalNarrationHandoff?.sourcePatchId,
          })
        },
      },
    })
    const after = await snapshotFiles(projectPath)

    expect(calls).toEqual([
      "actionResolver",
      "worldTick",
      "recallSelector",
      "deterministicReadHandoff",
      "outlineBriefCompiler",
      "storyOutlineRegenerator",
      "narration",
    ])
    expect(capturedRegeneratorPrompt?.systemPrompt).toContain("Story Outline Regenerator")
    expect(capturedRegeneratorInput).toMatchObject({
      outlineImpactReport: { impactLevel: "major_rewrite_required", requiresRegeneration: true },
      regenerationRequest: { requestId: "regen-request-act-major" },
    })
    expect(capturedRegeneratorInput?.confirmedFacts.length).toBeGreaterThan(0)
    expect(capturedRegeneratorInput?.forbiddenReveals.length).toBeGreaterThan(0)
    expect(capturedNarrationInput).toMatchObject({
      provisionalNarrationHandoff: {
        handoffId: "provisional-narration-handoff-regen-request-act-major",
        mustNotReveal: capturedRegeneratorInput?.forbiddenReveals.map((reveal) => reveal.revealId),
      },
    })
    expect(
      capturedNarrationInput?.forbiddenNarrationConstraints.some((constraint) =>
        constraint.constraintId.startsWith("provisional-must-not-reveal-")
      ),
    ).toBe(true)
    expect(result.turnNarration.narrationMeta.usedProvisionalPatch).toBe(true)
    expect(result.turnNarration.narrationMeta.respectedMustNotReveal).toBe(true)
    expect(result.provisionalOutlinePatch?.narrationHandoff).toEqual(
      result.turnRecord.provisionalOutlinePatch?.narrationHandoff,
    )
    expect(result.outlineRevisionProposal).toEqual(result.turnRecord.outlineRevisionProposal)
    expect(result.regenerationSafetyReport).toEqual(result.turnRecord.regenerationSafetyReport)
    expect(result.warnings.join("\n")).toContain("Story Outline Regenerator ran for regenerationRequest regen-request-act-major")
    expect(result.warnings.join("\n")).not.toContain("Story Outline Regenerator is not triggered in this stage")
    expect(JSON.stringify(result.turnRecord)).toContain("outlineRevisionProposal")
    expect(JSON.stringify(result.turnRecord)).not.toContain("ProposedWikiUpdate")
    expect(after).toEqual(before)
  })

  it("keeps a warning when major regeneration has no adapter", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-outline-major") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = { id: "act-major", text: "Break the gate seal early.", source: "freeform" as const }

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(sampleActionResolution(submittedAction)),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(sampleRecallSelection("post-action-working-state-act-major")),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleMajorOutlineBriefOutput(submittedAction)),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })

    expect(result.outlineImpactReport.requiresRegeneration).toBe(true)
    expect(result.regenerationRequest?.requestId).toBe("regen-request-act-major")
    expect(result.turnRecord.outlineImpactReport).toEqual(result.outlineImpactReport)
    expect(result.turnRecord.regenerationRequest).toEqual(result.regenerationRequest)
    expect(result.warnings.join("\n")).toContain("storyOutlineRegeneratorAdapter is unavailable")
    expect(JSON.stringify(result)).not.toContain("provisionalOutlinePatch")
    expect(JSON.stringify(result)).not.toContain("outlineRevisionProposal")
  })

  it("keeps a warning when major regeneration has no regenerationRequest", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-outline-major-no-request") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = { id: "act-major-no-request", text: "Break the gate seal early.", source: "freeform" as const }
    const regenerateOutline = vi.fn()
    const outlineOutput = sampleMajorOutlineBriefOutput(submittedAction)
    delete outlineOutput.regenerationRequest

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(sampleActionResolution(submittedAction)),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
      recallSelectorAdapter: createFixtureRecallSelectorAdapter(
        sampleRecallSelection("post-action-working-state-act-major-no-request"),
      ),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(outlineOutput),
      storyOutlineRegeneratorAdapter: { regenerateOutline },
      narrationAdapter: createFixtureNarrationGeneratorAdapter(sampleTurnNarration()),
    })

    expect(regenerateOutline).not.toHaveBeenCalled()
    expect(result.regenerationRequest).toBeUndefined()
    expect(result.warnings.join("\n")).toContain("no regenerationRequest was provided")
    expect(result.provisionalOutlinePatch).toBeUndefined()
  })

  it("rejects illegal Story Outline Regenerator output before narration can continue", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-outline-invalid") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = { id: "act-invalid-regenerator", text: "Break the gate seal early.", source: "freeform" as const }
    const generateNarration = vi.fn()

    await expect(
      runRpgTurn({
        projectPath,
        submittedAction,
        wikiMode: "llmwikirpg",
        actionResolverAdapter: createFixtureActionResolverAdapter(sampleActionResolution(submittedAction)),
        worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(submittedAction))),
        recallSelectorAdapter: createFixtureRecallSelectorAdapter(
          sampleRecallSelection("post-action-working-state-act-invalid-regenerator"),
        ),
        outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleMajorOutlineBriefOutput(submittedAction)),
        storyOutlineRegeneratorAdapter: {
          async regenerateOutline(_prompt, promptInput) {
            return {
              ...sampleRegeneratorOutputFromInput(promptInput),
              proposedUpdates: [],
            } as unknown as StoryOutlineRegeneratorOutput
          },
        },
        narrationAdapter: { generateNarration },
      }),
    ).rejects.toThrow(/ordinary runtime updates|ProposedWikiUpdate|Forbidden key/i)
    expect(generateNarration).not.toHaveBeenCalled()
  })
})

function postActionWorkingStateFromPromptInput(promptInput: OutlineBriefCompilerInput) {
  return promptInput.postActionWorkingState
}

async function writeTurnFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
  await writeFileRaw(`${projectPath}/wiki/characters/mira.md`, "# Mira\n\nBase page: Mira reads canal sigils carefully.")
  await writeFileRaw(
    `${projectPath}/wiki/characters/runtime/mira.md`,
    "# Mira Runtime State\n\nOverlay page: Mira is limping and wary of loud magic.",
  )
  await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nMira bargained with a dock runner.")
  await writeFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`, "# Iven and Mira\n\nTrust is fragile.")
}

function sampleRegeneratorOutputFromInput(input: StoryOutlineRegeneratorInput): StoryOutlineRegeneratorOutput {
  const factIds = input.confirmedFacts.map((fact) => fact.factId)
  const forbiddenRevealIds = input.forbiddenReveals.map((reveal) => reveal.revealId)
  const requestId = input.regenerationRequest.requestId

  return {
    provisionalOutlinePatch: {
      patchId: `provisional-outline-patch-${requestId}`,
      sourceRequestId: requestId,
      scope: "same_turn_only",
      outlineImpactLevel: "major_rewrite_required",
      affectedOutlineRefs: [],
      suspendedBeatRefs: [],
      invalidatedBeatRefs: [],
      preservedConfirmedFacts: factIds,
      runtimeDeltaRefs: [],
      narrativeLines: ["playerVisibleLine", "tensionLine"],
      visibilityBoundary: [],
      narrationHandoff: {
        handoffId: `provisional-narration-handoff-${requestId}`,
        sourcePatchId: `provisional-outline-patch-${requestId}`,
        mustFollow: ["Keep the gate consequence immediate without restoring the invalidated old beat."],
        mustPreserveFacts: factIds,
        mustNotReveal: forbiddenRevealIds,
        invalidatedOldBeats: ["old-touch-first-beat"],
        nextSceneDirection: "Frame the next decision around the changed gate seal consequence.",
        narrativeLines: ["playerVisibleLine", "tensionLine"],
        visibilityBoundaries: [],
        runtimeDeltaRefs: [],
        outlineRefs: [],
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
      proposalId: `outline-revision-proposal-${requestId}`,
      sourceRequestId: requestId,
      reviewItemKind: "outlineRevision",
      outlineImpactLevel: "major_rewrite_required",
      targetOutlineRefs: [],
      invalidatedAssumptions: ["A previous optional ordering assumption no longer holds."],
      mustPreserveFacts: factIds,
      proposedRevision: {
        summary: "Future-only review candidate for the changed gate sequence.",
        revisedBeats: ["Review the next gate beat around the new consequence."],
        revisedRevealOrder: ["Keep protected reveals delayed until a later reviewed beat."],
        branchAdjustments: ["Track the branch as pending review only."],
        futureOnly: true,
      },
      visibilityAndKnowledgeScope: [],
      runtimeDeltaRefs: [],
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
      checkedRuntimeRefs: [],
      checkedOutlineRefs: [],
      warnings: [],
    },
    warnings: [],
  }
}

async function snapshotFiles(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`.replace(/\\/g, "/")
      if (entry.isDirectory()) {
        await visit(path)
      } else {
        const relative = path.slice(root.length + 1)
        result[relative] = await fs.readFile(path, "utf-8")
      }
    }
  }

  await visit(root)
  return result
}
