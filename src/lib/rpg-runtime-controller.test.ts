import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, fileExists, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createFixtureActionResolverAdapter,
  createFixtureOutlineBriefAdapter,
  createFixtureRecallSelectorAdapter,
  createFixtureRuntimeUpdateInteractionAdapter,
  createFixtureNarrationGeneratorAdapter,
  createFixtureWorldTickAdapter,
} from "./rpg-interactions/runtime"
import {
  sampleActionResolution,
  sampleMajorOutlineBriefOutput,
  sampleOutlineBriefOutput,
  sampleRecallSelection,
  sampleTurnNarration,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import type { RpgInteractionPrompt } from "./rpg-interactions"
import {
  runRpgRuntimeTurnFlow,
  type RpgTurnResult,
  type RuntimeUpdateProposalResult,
  type StoryOutlineRegeneratorInput,
  type StoryOutlineRegeneratorOutput,
  type SubmittedAction,
} from "./rpg-runtime"
import { RPG_SCHEMA_SLOTS } from "./rpg-wiki-schema"
import type { RuntimeTurnJournalEntry } from "./rpg-runtime/runtime-persistence"
import * as updateStaging from "./rpg-runtime/update-staging"
import * as writePolicy from "./rpg-runtime/write-policy"

vi.mock("@/commands/fs", () => realFs)

vi.mock("./rpg-runtime/update-staging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rpg-runtime/update-staging")>()
  return {
    ...actual,
    acceptPendingRpgUpdate: vi.fn(actual.acceptPendingRpgUpdate),
    rejectPendingRpgUpdate: vi.fn(actual.rejectPendingRpgUpdate),
  }
})

vi.mock("./rpg-runtime/write-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rpg-runtime/write-policy")>()
  return {
    ...actual,
    applyRpgPendingUpdates: vi.fn(async () => {
      throw new Error("runRpgRuntimeTurnFlow must not apply pending updates.")
    }),
  }
})

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  vi.clearAllMocks()
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG Runtime Turn Controller", () => {
  it("runs a fixture-driven turn through narration, extraction, and pending update staging", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-flow") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = sampleSubmittedAction()
    const turnResult = sampleTurnResult()

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
      worldTickAdapter: sampleWorldTickAdapter(submittedAction),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter(submittedAction),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: turnResult.narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput(submittedAction)),
    })

    expect("brief" in result).toBe(false)
    expect(result.actionResolution).toEqual(sampleActionResolution(submittedAction))
    expect(result.worldTickResult.sourceActionResolutionId).toBe(result.actionResolution.resolutionId)
    expect(result.visibleSelection.parallelLensCandidates[0]).toMatchObject({
      visibilityScope: "user_visible_pc_unknown",
      grantsPcKnowledge: false,
    })
    expect(result.postActionWorkingState.worldTickResult).toEqual(result.worldTickResult)
    expect(result.recallSelection.selectionId).toBe("recall-selection-act-1")
    expect(result.recalledMaterials[0]?.path).toBe("wiki/current-scene/scene_state.md")
    expect(result.turnResult.narrative).toContain("Mira traces the lowest sigil")
    expect(result.turnResult.nextActionOptions).toHaveLength(3)
    expect(result.turnRecord).toEqual({
      submittedAction,
      actionResolution: result.actionResolution,
      worldTickResult: result.worldTickResult,
      visibleSelection: result.visibleSelection,
      postActionWorkingState: result.postActionWorkingState,
      recallSelection: result.recallSelection,
      recalledMaterials: result.recalledMaterials,
      outlineAwareNarrationBrief: result.outlineAwareNarrationBrief,
      outlineImpactReport: result.outlineImpactReport,
      turnNarration: result.turnNarration,
      generatedNarrative: turnResult.narrative,
      references: [
        "wiki/current-scene/scene_state.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/player/player.md",
        "wiki/rules/core.md",
      ],
    })
    expect(result.proposedUpdates.map((update) => [update.targetPath, update.strategy])).toEqual([
      ["wiki/current-scene/scene_state.md", "overwrite"],
      ["wiki/events/canal-gate-sigil.md", "append"],
    ])
    expect(result.pendingUpdates).toEqual(
      result.proposedUpdates.map((update) => ({
        ...update,
        references: [...update.references],
        status: "pending",
      })),
    )
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
  })

  it("turns structured interaction proposedWikiUpdates into proposed and pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-fenced") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-fenced"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-fenced"),
      worldTickAdapter: sampleWorldTickAdapter("turn-fenced"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-fenced"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResult().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput("turn-fenced")),
    })

    expect(result.proposedUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite",
          content: expect.stringContaining("lowest sigil glows"),
        }),
        expect.objectContaining({
          targetPath: "wiki/events/canal-gate-sigil.md",
          strategy: "append",
          content: expect.stringContaining("Mira confirmed"),
        }),
      ]),
    )
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(
      result.proposedUpdates.map((update) => update.targetPath),
    )
  })

  it("uses injected runtime update interaction output instead of narration update blocks", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-wins") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-wins"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-interaction-wins"),
      worldTickAdapter: sampleWorldTickAdapter("turn-interaction-wins"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-interaction-wins"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResult().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleKnownInformationRuntimeUpdateOutput("turn-interaction-wins"),
      ),
    })

    expect(result.proposedUpdates.map((update) => [update.targetPath, update.strategy])).toEqual([
      ["wiki/player/known_information.md", "merge"],
    ])
    expect(result.pendingUpdates).toEqual([
      expect.objectContaining({
        targetPath: "wiki/player/known_information.md",
        strategy: "merge",
        status: "pending",
        content: "Iven now knows the lantern key answers the canal gate's lowest sigil.",
      }),
    ])
  })

  it("does not derive runtime updates from TurnNarration when structured proposal output is empty", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-empty") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-empty"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-interaction-empty"),
      worldTickAdapter: sampleWorldTickAdapter("turn-interaction-empty"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-interaction-empty"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEmptyRuntimeUpdateProposalOutput("turn-interaction-empty"),
      ),
    })

    expect(result.turnResult.narrative).not.toContain("rpg-wiki-update")
    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
  })

  it("creates pending updates from interaction output even when narration has no update block", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-only") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-only"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-interaction-only"),
      worldTickAdapter: sampleWorldTickAdapter("turn-interaction-only"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-interaction-only"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEventOnlyRuntimeUpdateOutput("turn-interaction-only"),
      ),
    })

    expect(result.turnResult.narrative).not.toContain("rpg-wiki-update")
    expect(result.proposedUpdates).toEqual([
      expect.objectContaining({
        targetPath: "wiki/events/canal-gate-sigil.md",
        strategy: "append",
      }),
    ])
    expect(result.pendingUpdates).toHaveLength(1)
    expect(result.pendingUpdates[0]).toMatchObject({
      targetPath: "wiki/events/canal-gate-sigil.md",
      status: "pending",
    })
  })

  it("uses structured RuntimeUpdateProposalInput and carries structured audit material without applying", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-structured-proposal") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = sampleSubmittedAction("turn-structured-proposal")
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
      worldTickAdapter: sampleWorldTickAdapter(submittedAction),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter(submittedAction),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: {
        async generateUpdateProposal(prompt) {
          expect(prompt.systemPrompt).toContain("RuntimeUpdateProposalResult JSON")
          expect(prompt.userPrompt).toContain("postActionWorkingState")
          expect(prompt.userPrompt).toContain("Allowed Runtime Update Target Rules")
          return JSON.stringify(sampleStructuredRuntimeUpdateProposalResult(submittedAction))
        },
      },
      runtimePersistence: { appendTurnJournalEntry },
    })

    const entry = appendTurnJournalEntry.mock.calls[0]?.[1] as RuntimeTurnJournalEntry
    expect(result.proposedUpdates.map((update) => update.id)).toEqual(["structured-scene-update"])
    expect(result.pendingUpdates.map((update) => update.id)).toEqual(["structured-scene-update"])
    expect(result.pendingUpdates[0]).toMatchObject({
      targetPath: "wiki/current-scene/scene_state.md",
      status: "pending",
    })
    expect(result.skippedDeltas.map((delta) => delta.skipId)).toEqual(["skip-parallel-pc-knowledge"])
    expect(result.outlineRevisionReviewItems.map((item) => item.reviewItemId)).toEqual(["outline-review-structured"])
    expect(result.proposalGroups.map((group) => group.groupId)).toEqual(["group-structured-runtime"])
    expect(result.pacingUpdateProposal?.proposalId).toBe("pacing-structured")
    expect(JSON.stringify(result.pendingUpdates)).not.toContain("skip-parallel-pc-knowledge")
    expect(JSON.stringify(result.pendingUpdates)).not.toContain("outline-review-structured")
    expect(result.warnings.join("\n")).toContain("Skipped runtime delta skip-parallel-pc-knowledge")
    expect(result.warnings.join("\n")).toContain("Outline revision review item outline-review-structured")
    expect(entry.runtimeUpdateProposalAudit).toMatchObject({
      proposedWikiUpdateIds: ["structured-scene-update"],
      skippedDeltas: [expect.objectContaining({ skipId: "skip-parallel-pc-knowledge" })],
      proposalGroups: [expect.objectContaining({ groupId: "group-structured-runtime" })],
      outlineRevisionReviewItems: [expect.objectContaining({ reviewItemId: "outline-review-structured" })],
    })
    expect(entry.pendingUpdateIds).toEqual(["structured-scene-update"])
    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })

  it("rejects invalid structured interaction target paths at the proposal boundary", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-warning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath,
        submittedAction: sampleSubmittedAction("turn-interaction-warning"),
        wikiMode: "llmwikirpg",
        actionResolverAdapter: sampleActionResolverAdapter("turn-interaction-warning"),
        worldTickAdapter: sampleWorldTickAdapter("turn-interaction-warning"),
        recallSelectorAdapter: sampleRecallSelectorAdapter(),
        outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-interaction-warning"),
        narrationAdapter: createFixtureNarrationGeneratorAdapter(
          sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
        ),
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
          sampleInvalidTargetRuntimeUpdateOutput("turn-interaction-warning"),
        ),
      }),
    ).rejects.toThrow(/outside allowed runtime update paths/)
  })

  it("keeps validation-rejected proposals out of the pending queue and reports them as warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-validation-reject") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-validation-reject"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-validation-reject"),
      worldTickAdapter: sampleWorldTickAdapter("turn-validation-reject"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-validation-reject"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleFutureAndSceneRuntimeUpdateOutput("turn-validation-reject"),
      ),
    })

    expect(result.proposedUpdates.map((update) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
      "wiki/current-scene/scene_state.md",
    ])
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(["wiki/current-scene/scene_state.md"])
    expect(result.runtimeUpdateValidation.rejectedUpdates.map(({ update }) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
    ])
    expect(result.warnings.join("\n")).toContain("events_future_candidate_pollution")
    expect(result.pendingUpdates.some((update) => update.targetPath.includes("future"))).toBe(false)
  })

  it("persists validation rejected summary and warning-only issues in the turn journal", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-validation-journal") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-validation-journal"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-validation-journal"),
      worldTickAdapter: sampleWorldTickAdapter("turn-validation-journal"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-validation-journal"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleFutureAndPlayerRuntimeUpdateOutput("turn-validation-journal"),
      ),
      runtimePersistence: { appendTurnJournalEntry },
    })

    const entry = appendTurnJournalEntry.mock.calls[0]?.[1] as RuntimeTurnJournalEntry
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(["wiki/player/player.md"])
    expect(entry.runtimeUpdateValidation).toEqual({
      acceptedUpdateIds: [result.pendingUpdates[0].id],
      rejectedUpdates: [
        expect.objectContaining({
          targetPath: "wiki/events/canal-gate-future.md",
          issueCodes: expect.arrayContaining(["events_future_candidate_pollution"]),
        }),
      ],
      warningIssues: [
        expect.objectContaining({
          targetPath: "wiki/player/player.md",
          code: "runtime_stable_page_pollution",
        }),
      ],
    })
    expect(entry.warnings.join("\n")).toContain("events_future_candidate_pollution")
    expect(entry.warnings.join("\n")).toContain("runtime_stable_page_pollution")
  })

  it("builds the update interaction prompt from the structured proposal input with candidate-action boundaries", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-prompt") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = sampleSubmittedAction("turn-interaction-prompt")
    const actionResolution = sampleActionResolution(submittedAction)
    actionResolution.eventDraft.summary = "POISON_ATTEMPTED_NOT_CONFIRMED_DRAFT_SHOULD_NOT_ENTER_UPDATE_PROMPT"
    let capturedPrompt: RpgInteractionPrompt | undefined

    await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: createFixtureActionResolverAdapter(actionResolution),
      worldTickAdapter: createFixtureWorldTickAdapter(sampleWorldTickResult(actionResolution)),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter(submittedAction),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: {
        async generateUpdateProposal(prompt) {
          capturedPrompt = prompt
          return sampleEmptyRuntimeUpdateProposalOutput(submittedAction)
        },
      },
    })

    const combined = `${capturedPrompt?.systemPrompt ?? ""}\n${capturedPrompt?.userPrompt ?? ""}`
    expect(combined).toContain("Mira traces the lowest sigil")
    expect(combined).toContain("# Runtime Update Proposal Input")
    expect(combined).toContain("postActionWorkingState")
    expect(combined).toContain("actionResolution")
    expect(combined).toContain("worldTickResult")
    expect(combined).toContain("visibleSelection")
    expect(combined).toContain("recallSelection")
    expect(combined).toContain("recalledMaterials")
    expect(combined).toContain("outlineAwareNarrationBrief")
    expect(combined).toContain("outlineImpactReport")
    expect(combined).toContain("turnNarration")
    expect(combined).toContain("consistencyValidation")
    expect(combined).toContain("nextActionOptions are candidate future actions")
    expect(combined).toContain("attempted_not_confirmed cannot enter confirmed events")
    expect(combined).toContain("parallelLineText and user_visible_pc_unknown material")
    expect(combined).toContain("Touch the lantern key to the lowest sigil")
    expect(combined).toContain("opt-key")
    expect(combined).toContain("POISON_ATTEMPTED_NOT_CONFIRMED_DRAFT_SHOULD_NOT_ENTER_UPDATE_PROMPT")
  })

  it("appends a completed turn journal entry when persistence is injected", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-journal") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-journal"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-journal"),
      worldTickAdapter: sampleWorldTickAdapter("turn-journal"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-journal"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEventOnlyRuntimeUpdateOutput("turn-journal"),
      ),
      runtimePersistence: { appendTurnJournalEntry },
    })

    expect(appendTurnJournalEntry).toHaveBeenCalledOnce()
    const [journalProjectPath, entry] = appendTurnJournalEntry.mock.calls[0] as [string, RuntimeTurnJournalEntry]
    expect(journalProjectPath).toBe(projectPath)
    expect(entry.timestamp).toEqual(expect.any(String))
    expect(entry.submittedAction.id).toBe("turn-journal")
    expect(entry.actionResolution).toEqual(result.actionResolution)
    expect(entry.worldTickResult).toEqual(result.worldTickResult)
    expect(entry.visibleSelection).toEqual(result.visibleSelection)
    expect(entry.postActionWorkingState).toEqual(result.postActionWorkingState)
    expect(entry.recallSelection).toEqual(result.recallSelection)
    expect(entry.recalledMaterials).toEqual(result.recalledMaterials)
    expect(entry.outlineAwareNarrationBrief).toEqual(result.outlineAwareNarrationBrief)
    expect(entry.outlineImpactReport).toEqual(result.outlineImpactReport)
    expect(entry.turnNarration).toEqual(result.turnNarration)
    expect(entry.turnRecord).toEqual(result.turnRecord)
    expect(entry.turnResult).toEqual(result.turnResult)
    expect(entry.proposedUpdates.map((update) => update.id)).toEqual(result.proposedUpdates.map((update) => update.id))
    expect(entry.pendingUpdateIds).toEqual(result.pendingUpdates.map((update) => update.id))
    expect(entry.warnings).toEqual(result.warnings)
    expect(entry.warnings.join("\n")).toContain("synthetic sectionId")
    expect(entry.proposalSource).toBe("interaction")
    expect(result.proposalSource).toBe("interaction")
  })

  it("stores Story Outline Regenerator audit fields without staging ordinary runtime updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-regenerator-audit") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = sampleSubmittedAction("turn-regenerator-audit")
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter(submittedAction),
      worldTickAdapter: sampleWorldTickAdapter(submittedAction),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: createFixtureOutlineBriefAdapter(sampleMajorOutlineBriefOutput(submittedAction)),
      storyOutlineRegeneratorAdapter: {
        async regenerateOutline(_prompt, promptInput) {
          return sampleRegeneratorOutputFromInput(promptInput)
        },
      },
      narrationAdapter: {
        async generateNarration(_prompt, promptInput) {
          return sampleTurnNarration({
            playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative,
            usedProvisionalPatch: true,
            provisionalHandoffId: promptInput.provisionalNarrationHandoff?.handoffId,
            provisionalSourcePatchId: promptInput.provisionalNarrationHandoff?.sourcePatchId,
          })
        },
      },
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEmptyRuntimeUpdateProposalOutput(submittedAction),
      ),
      runtimePersistence: { appendTurnJournalEntry },
    })

    const entry = appendTurnJournalEntry.mock.calls[0]?.[1] as RuntimeTurnJournalEntry
    expect(result.provisionalOutlinePatch?.narrationHandoff.handoffId).toContain("regen-request-turn-regenerator-audit")
    expect(result.outlineRevisionProposal?.reviewBoundary).toMatchObject({
      ordinaryRuntimeUpdate: false,
      proposedWikiUpdate: false,
      autoWriteMainOutline: false,
    })
    expect(result.regenerationSafetyReport?.noWikiWrite).toBe(true)
    expect(result.turnRecord.outlineRevisionProposal).toEqual(result.outlineRevisionProposal)
    expect(entry.provisionalOutlinePatch).toEqual(result.provisionalOutlinePatch)
    expect(entry.outlineRevisionProposal).toEqual(result.outlineRevisionProposal)
    expect(entry.regenerationSafetyReport).toEqual(result.regenerationSafetyReport)
    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
    expect(JSON.stringify(result.proposedUpdates)).not.toContain("outlineRevisionProposal")
    expect(JSON.stringify(result.pendingUpdates)).not.toContain("outlineRevisionProposal")
    expect(result.warnings.join("\n")).toContain(
      "Story Outline Regenerator ran for regenerationRequest regen-request-turn-regenerator-audit",
    )
  })

  it("merges turn journal persistence warnings into controller warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-journal-warning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-journal-warning"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-journal-warning"),
      worldTickAdapter: sampleWorldTickAdapter("turn-journal-warning"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-journal-warning"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResultWithoutUpdateBlocks().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEmptyRuntimeUpdateProposalOutput("turn-journal-warning"),
      ),
      runtimePersistence: {
        appendTurnJournalEntry: vi.fn(async () => ({ warnings: ["Journal write skipped in test."] })),
      },
    })

    expect(result.warnings).toContain("Journal write skipped in test.")
  })

  it("merges turn warnings with extractor warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-warnings") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nCarries a brass lantern key.")

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-warnings"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-warnings"),
      worldTickAdapter: sampleWorldTickAdapter("turn-warnings"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-warnings"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: "Mira studies the sigil, but the scene snapshot is missing from disk." }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        sampleEmptyRuntimeUpdateProposalOutput("turn-warnings"),
      ),
    })

    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
    expect(result.warnings.join("\n")).toContain("Missing required RPG schema slot: current_scene (wiki/current-scene/scene_state.md)")
  })

  it("lets malformed narration generator output fail at the TurnNarration validation boundary", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-malformed") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath,
        submittedAction: sampleSubmittedAction("turn-malformed"),
        wikiMode: "llmwikirpg",
        actionResolverAdapter: sampleActionResolverAdapter("turn-malformed"),
        worldTickAdapter: sampleWorldTickAdapter("turn-malformed"),
        recallSelectorAdapter: sampleRecallSelectorAdapter(),
        outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-malformed"),
        narrationAdapter: {
          async generateNarration() {
            return {
              playerFacingText: "The gate clicks.",
              nextActionOptions: [],
              references: [],
            } as unknown as ReturnType<typeof sampleTurnNarration>
          },
        },
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(""),
      }),
    ).rejects.toThrow(/tensionBrief|TurnNarration/i)
  })

  it("does not write wiki files while creating proposed and pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-readonly") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const before = await snapshotFiles(projectPath)

    await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-readonly"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-readonly"),
      worldTickAdapter: sampleWorldTickAdapter("turn-readonly"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-readonly"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResult().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput("turn-readonly")),
    })

    const after = await snapshotFiles(projectPath)
    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("locked canal gate")
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate-sigil.md`)).toBe(false)
  })

  it("does not automatically accept, reject, or apply pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-no-apply") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-no-apply"),
      wikiMode: "llmwikirpg",
      actionResolverAdapter: sampleActionResolverAdapter("turn-no-apply"),
      worldTickAdapter: sampleWorldTickAdapter("turn-no-apply"),
      recallSelectorAdapter: sampleRecallSelectorAdapter(),
      outlineBriefCompilerAdapter: sampleOutlineBriefCompilerAdapter("turn-no-apply"),
      narrationAdapter: createFixtureNarrationGeneratorAdapter(
        sampleTurnNarration({ playerFacingText: sampleTurnResult().narrative }),
      ),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput("turn-no-apply")),
    })

    expect(result.pendingUpdates).toHaveLength(2)
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
    expect(updateStaging.acceptPendingRpgUpdate).not.toHaveBeenCalled()
    expect(updateStaging.rejectPendingRpgUpdate).not.toHaveBeenCalled()
    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })
})

async function writeTurnFixture(projectPath: string): Promise<void> {
  await Promise.all(
    RPG_SCHEMA_SLOTS.map((slot) =>
      writeFileRaw(`${projectPath}/${slot.path}`, `# ${slot.slotId}\n\nTest fixture slot.`),
    ),
  )
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
}

function sampleSubmittedAction(id = "turn-controller"): SubmittedAction {
  return {
    id,
    text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
    source: "freeform",
  }
}

function sampleActionResolverAdapter(actionOrId: SubmittedAction | string = "turn-controller") {
  const action = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return createFixtureActionResolverAdapter(sampleActionResolution(action))
}

function sampleWorldTickAdapter(actionOrId: SubmittedAction | string = "turn-controller") {
  const action = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return createFixtureWorldTickAdapter(sampleWorldTickResult(sampleActionResolution(action)))
}

function sampleRecallSelectorAdapter() {
  return createFixtureRecallSelectorAdapter(sampleRecallSelection())
}

function sampleOutlineBriefCompilerAdapter(actionOrId: SubmittedAction | string = "turn-controller") {
  const action = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return createFixtureOutlineBriefAdapter(sampleOutlineBriefOutput(action))
}

function sampleTurnResult(): RpgTurnResult {
  return {
    narrative: [
      "Mira traces the lowest sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
      "",
      "```rpg-wiki-update",
      "targetPath: wiki/current-scene/scene_state.md",
      "strategy: overwrite",
      "reason: Keep the next-turn scene snapshot aligned with the completed action.",
      "---",
      "# Current Scene",
      "",
      "Iven and Mira remain at the locked canal gate while the lowest sigil glows.",
      "```",
      "",
      "```rpg-wiki-update",
      "targetPath: wiki/events/canal-gate-sigil.md",
      "strategy: append",
      "reason: Record the completed sigil inspection as happened history.",
      "---",
      "# Canal Gate Sigil",
      "",
      "Mira confirmed that the lantern key answers the canal gate's lowest sigil.",
      "```",
    ].join("\n"),
    nextActionOptions: [
      {
        id: "opt-key",
        playerFacingText: "Touch the lantern key to the lowest sigil.",
        intent: "use_item",
        riskLevel: "medium",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/items/runtime/lantern-key.md"],
      },
      {
        id: "opt-talk",
        playerFacingText: "Ask Mira what the glowing brass tooth means.",
        intent: "talk",
        riskLevel: "low",
        likelyAffectedPaths: ["wiki/relationships/runtime/iven-mira.md"],
      },
      {
        id: "opt-wait",
        playerFacingText: "Wait and listen for movement beyond the canal gate.",
        intent: "wait",
        riskLevel: "medium",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
      },
    ],
    references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
  }
}

function sampleTurnResultWithoutUpdateBlocks(): RpgTurnResult {
  return {
    ...sampleTurnResult(),
    narrative: "Mira traces the lowest sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
  }
}

function sampleRuntimeUpdateOutput(actionOrId: SubmittedAction | string = "turn-controller"): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [
      sampleRuntimeProposedWikiUpdate(submittedAction, "scene"),
      sampleRuntimeProposedWikiUpdate(submittedAction, "event"),
    ],
  })
}

function sampleEmptyRuntimeUpdateProposalOutput(actionOrId: SubmittedAction | string = "turn-controller"): string {
  void actionOrId
  return JSON.stringify(sampleEmptyRuntimeUpdateProposalResult())
}

function sampleEventOnlyRuntimeUpdateOutput(actionOrId: SubmittedAction | string): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [sampleRuntimeProposedWikiUpdate(submittedAction, "event")],
  })
}

function sampleKnownInformationRuntimeUpdateOutput(actionOrId: SubmittedAction | string): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [
      sampleRuntimeProposedWikiUpdate(submittedAction, "knownInformation"),
    ],
  })
}

function sampleInvalidTargetRuntimeUpdateOutput(actionOrId: SubmittedAction | string): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [
      {
        ...sampleRuntimeProposedWikiUpdate(submittedAction, "scene"),
        id: "structured-invalid-world-update",
        targetPath: "wiki/world/basic_overview.md",
        strategy: "merge",
        reason: "Stable world pages are not runtime update targets.",
        content: "WORLD_POISON",
        sourceDeltas: [
          {
            ...sampleRuntimeProposedWikiUpdate(submittedAction, "scene").sourceDeltas[0],
            affectedPaths: ["wiki/world/basic_overview.md"],
          },
        ],
      },
    ],
  })
}

function sampleFutureAndSceneRuntimeUpdateOutput(actionOrId: SubmittedAction | string): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [
      sampleRuntimeProposedWikiUpdate(submittedAction, "futureEvent"),
      sampleRuntimeProposedWikiUpdate(submittedAction, "scene"),
    ],
  })
}

function sampleFutureAndPlayerRuntimeUpdateOutput(actionOrId: SubmittedAction | string): string {
  const submittedAction = typeof actionOrId === "string" ? sampleSubmittedAction(actionOrId) : actionOrId
  return JSON.stringify({
    ...sampleEmptyRuntimeUpdateProposalResult(),
    proposedWikiUpdates: [
      sampleRuntimeProposedWikiUpdate(submittedAction, "futureEvent"),
      sampleRuntimeProposedWikiUpdate(submittedAction, "playerProfile"),
    ],
  })
}

function sampleEmptyRuntimeUpdateProposalResult(): RuntimeUpdateProposalResult {
  return {
    proposedWikiUpdates: [],
    outlineRevisionReviewItems: [],
    journalEntries: [],
    skippedDeltas: [],
    pacingUpdateProposal: null,
    proposalGroups: [],
    warnings: [],
  }
}

function sampleRuntimeProposedWikiUpdate(
  submittedAction: SubmittedAction,
  kind: "scene" | "event" | "knownInformation" | "futureEvent" | "playerProfile",
): RuntimeUpdateProposalResult["proposedWikiUpdates"][number] {
  const baseSourceDelta = {
    deltaId: `source-delta-${kind}-${submittedAction.id}`,
    sourceStage: "postActionWorkingState" as const,
    sourceField: "campaignDelta",
    summary: "The canal gate scene moved forward after Mira's inspection.",
    lineTarget: "playerVisibleLine" as const,
    visibility: "pc_visible" as const,
    knowledgeScope: "pc_known" as const,
    happenedStatus: "ongoing" as const,
    usePurpose: "writeback" as const,
    affectedPaths: ["wiki/current-scene/scene_state.md"],
    runtimeDeltaRefs: [],
  }

  if (kind === "event" || kind === "futureEvent") {
    const targetPath = kind === "event" ? "wiki/events/canal-gate-sigil.md" : "wiki/events/canal-gate-future.md"
    return {
      id: `${kind}-update-${submittedAction.id}`,
      targetPath,
      strategy: "append",
      reason: kind === "event"
        ? "Record the completed sigil inspection as happened history."
        : "This wrongly stores possible future options as event history.",
      content: kind === "event"
        ? "# Canal Gate Sigil\n\nMira confirmed that the lantern key answers the canal gate's lowest sigil."
        : "# Canal Gate Future\n\n## Next Actions\n- The player may force the gate before the patrol returns.",
      sourceTurnId: submittedAction.id,
      references: ["wiki/current-scene/scene_state.md"],
      sourceDeltas: [
        {
          ...baseSourceDelta,
          deltaId: `source-delta-${kind}-${submittedAction.id}`,
          happenedStatus: "confirmed_happened",
          affectedPaths: [targetPath],
        },
      ],
      lineTarget: "playerVisibleLine",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      happenedStatus: "confirmed_happened",
      confidence: "high",
      validationHints: [],
    }
  }

  if (kind === "knownInformation") {
    return {
      id: `known-information-update-${submittedAction.id}`,
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      reason: "Track the player's active key clue from the completed turn.",
      content: "Iven now knows the lantern key answers the canal gate's lowest sigil.",
      sourceTurnId: submittedAction.id,
      references: ["wiki/player/known_information.md"],
      sourceDeltas: [
        {
          ...baseSourceDelta,
          deltaId: `source-delta-known-information-${submittedAction.id}`,
          affectedPaths: ["wiki/player/known_information.md"],
        },
      ],
      lineTarget: "playerVisibleLine",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      happenedStatus: "ongoing",
      confidence: "high",
      validationHints: [],
    }
  }

  if (kind === "playerProfile") {
    return {
      id: `player-profile-update-${submittedAction.id}`,
      targetPath: "wiki/player/player.md",
      strategy: "merge",
      reason: "Track a profile-like runtime update for review.",
      content: "# Player Profile\n\n## Character Profile\nThis looks like a stable character sheet and should stay warning-visible.",
      sourceTurnId: submittedAction.id,
      references: ["wiki/player/player.md"],
      sourceDeltas: [
        {
          ...baseSourceDelta,
          deltaId: `source-delta-player-profile-${submittedAction.id}`,
          affectedPaths: ["wiki/player/player.md"],
        },
      ],
      lineTarget: "playerVisibleLine",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      happenedStatus: "ongoing",
      confidence: "medium",
      validationHints: [],
    }
  }

  return {
    id: `scene-update-${submittedAction.id}`,
    targetPath: "wiki/current-scene/scene_state.md",
    strategy: "overwrite",
    reason: "Keep the latest scene snapshot.",
    content: "# Current Scene\n\nIven and Mira remain by the canal gate while the lowest sigil glows.",
    sourceTurnId: submittedAction.id,
    references: ["wiki/current-scene/scene_state.md"],
    sourceDeltas: [baseSourceDelta],
    lineTarget: "playerVisibleLine",
    visibility: "pc_visible",
    knowledgeScope: "pc_known",
    happenedStatus: "ongoing",
    confidence: "high",
    validationHints: [],
  }
}

function sampleStructuredRuntimeUpdateProposalResult(
  submittedAction: SubmittedAction,
): RuntimeUpdateProposalResult {
  const acceptedSourceDelta = {
    deltaId: "source-delta-structured-scene",
    sourceStage: "postActionWorkingState" as const,
    sourceField: "campaignDelta",
    summary: "The canal gate scene moved forward after Mira's warning.",
    lineTarget: "playerVisibleLine" as const,
    visibility: "pc_visible" as const,
    knowledgeScope: "pc_known" as const,
    happenedStatus: "ongoing" as const,
    usePurpose: "writeback" as const,
    affectedPaths: ["wiki/current-scene/scene_state.md"],
    runtimeDeltaRefs: [],
  }
  const skippedSourceDelta = {
    deltaId: "source-delta-parallel-watch-order",
    sourceStage: "turnNarration" as const,
    sourceField: "parallelLineText",
    summary: "The watch captain's offscreen order is user-visible but not PC-known.",
    lineTarget: "parallelLine" as const,
    visibility: "user_visible_pc_unknown" as const,
    knowledgeScope: "user_only" as const,
    happenedStatus: "confirmed_happened" as const,
    usePurpose: "journalOnly" as const,
    affectedPaths: ["wiki/player/known_information.md"],
    runtimeDeltaRefs: [],
  }

  return {
    proposedWikiUpdates: [
      {
        id: "structured-scene-update",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep the next-turn scene snapshot aligned with the settled warning and patrol pressure.",
        content: "# Current Scene\n\nMira has warned Iven about the lowest sigil while patrol lights near.",
        sourceTurnId: submittedAction.id,
        references: ["wiki/current-scene/scene_state.md"],
        sourceDeltas: [acceptedSourceDelta],
        lineTarget: "playerVisibleLine",
        visibility: "pc_visible",
        knowledgeScope: "pc_known",
        happenedStatus: "ongoing",
        confidence: "high",
        validationHints: [
          {
            hintId: "hint-structured-scene",
            severity: "info",
            code: "structured_source_delta",
            message: "Grounded in postActionWorkingState.",
          },
        ],
      },
    ],
    outlineRevisionReviewItems: [
      {
        reviewItemId: "outline-review-structured",
        sourceProposalId: "outline-revision-structured",
        reviewItemKind: "outlineRevision",
        outlineImpactLevel: "major_rewrite_required",
        summary: "Future outline beats need manual review.",
        proposedRevisionSummary: "Review future reveal order only.",
        targetOutlineRefs: [],
        mustPreserveFacts: [],
        runtimeDeltaRefs: [],
        reviewPolicy: "manual_review",
        ordinaryRuntimeUpdate: false,
        proposedWikiUpdate: false,
        autoWriteMainOutline: false,
        warnings: [],
      },
    ],
    journalEntries: ["Structured proposal audit entry."],
    skippedDeltas: [
      {
        skipId: "skip-parallel-pc-knowledge",
        sourceDelta: skippedSourceDelta,
        code: "parallel_line_not_pc_knowledge",
        reason: "User-visible parallel-line material cannot update PC known information.",
        reviewPolicy: "review_only",
      },
    ],
    pacingUpdateProposal: {
      proposalId: "pacing-structured",
      sourceDeltaIds: ["source-delta-structured-scene"],
      previousPacingState: "low",
      nextPacingState: "none",
      timeDeltaSummary: "A few focused minutes passed.",
      campaignDelta: "The canal gate scene advanced.",
      pacingDebtChange: "decreased",
      targetPath: "wiki/current-scene/scene_state.md",
      reviewPolicy: "pending_review",
    },
    proposalGroups: [
      {
        groupId: "group-structured-runtime",
        title: "Structured scene and skipped parallel audit",
        lineTarget: "playerVisibleLine",
        updateIds: ["structured-scene-update"],
        skippedDeltaIds: ["skip-parallel-pc-knowledge"],
        sourceDeltaIds: ["source-delta-structured-scene", "source-delta-parallel-watch-order"],
        reason: "Keep ordinary pending separate from review-only parallel knowledge.",
        reviewPolicy: "pending_review",
      },
    ],
    warnings: [],
  }
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
        mustFollow: ["Keep the regenerated same-turn direction as a hard constraint."],
        mustPreserveFacts: factIds,
        mustNotReveal: forbiddenRevealIds,
        invalidatedOldBeats: ["old-touch-first-beat"],
        nextSceneDirection: "Continue from the changed gate consequence.",
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
      invalidatedAssumptions: ["An old optional ordering assumption needs review."],
      mustPreserveFacts: factIds,
      proposedRevision: {
        summary: "Future-only outline review candidate.",
        revisedBeats: ["Review the next beat after this turn."],
        revisedRevealOrder: ["Keep protected reveals delayed."],
        branchAdjustments: ["Record only as independent review."],
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
