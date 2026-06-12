import {
  actionResolverInteractionSpec,
  narrationGeneratorInteractionSpec,
  outlineBriefInteractionSpec,
  recallSelectorInteractionSpec,
  storyOutlineRegeneratorInteractionSpec,
  type RpgActionResolverAdapter,
  type RpgNarrationGeneratorAdapter,
  type RpgOutlineBriefAdapter,
  type RpgRecallSelectorAdapter,
  type RpgStoryOutlineRegeneratorAdapter,
  type RpgWorldTickAdapter,
  validateActionResolution,
  validateOutlineBriefCompilerOutput,
  validateRecallSelection,
  validateTurnNarration,
  validateWorldTickResult,
  worldTickInteractionSpec,
} from "../rpg-interactions/runtime"
import { buildNarrationGeneratorInputFromHandoffs } from "./narration-input-builder"
import { buildOutlineBriefInputFromTurnStateAndWiki } from "./outline-brief-input-builder"
import { buildRecallSelectorInputFromTurnStateAndWiki } from "./recall-selector-input-builder"
import { createRecallSelectorHandoff } from "./recall-selector-handoff"
import { buildActionResolverInputFromWiki } from "./action-resolver-input-builder"
import { buildStoryOutlineRegeneratorInputFromTurnState } from "./story-outline-regenerator-handoff"
import {
  createRpgTurnRecord,
  createTurnResultFromTurnNarration,
  type RpgTurnRecord,
  type RpgTurnResult,
} from "./turn-model"
import { buildPostActionWorkingState, selectWorldTickVisibleContent } from "./world-tick-working-state"
import { buildWorldTickInputFromWiki } from "./world-tick-input-builder"
import type {
  ActionResolution,
  OutlineBriefCompilerInput,
  PostActionWorkingState,
  RecalledMaterial,
  RecallSelection,
  OutlineAwareNarrationBrief,
  OutlineImpactReport,
  OutlineRevisionProposal,
  RegenerationRequest,
  RegenerationSafetyReport,
  ProvisionalOutlinePatch,
  StoryOutlineRegeneratorOutput,
  SubmittedAction,
  TurnNarration,
  WorldTickResult,
  WorldTickVisibleSelection,
} from "./types"

export interface RunRpgTurnInput {
  projectPath: string
  wikiMode: "llmwikirpg"
  submittedAction: SubmittedAction
  actionResolverAdapter: RpgActionResolverAdapter
  worldTickAdapter: RpgWorldTickAdapter
  recallSelectorAdapter: RpgRecallSelectorAdapter
  outlineBriefCompilerAdapter: RpgOutlineBriefAdapter
  storyOutlineRegeneratorAdapter?: RpgStoryOutlineRegeneratorAdapter
  narrationAdapter: RpgNarrationGeneratorAdapter
}

export interface RunRpgTurnResult {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  recallSelection: RecallSelection
  recalledMaterials: RecalledMaterial[]
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  provisionalOutlinePatch?: ProvisionalOutlinePatch
  outlineRevisionProposal?: OutlineRevisionProposal
  regenerationSafetyReport?: RegenerationSafetyReport
  turnNarration: TurnNarration
  turnResult: RpgTurnResult
  turnRecord: RpgTurnRecord
  warnings: string[]
}

export async function runRpgTurn(input: RunRpgTurnInput): Promise<RunRpgTurnResult> {
  const actionResolverInputResult = await buildActionResolverInputFromWiki({
    projectPath: input.projectPath,
    submittedAction: input.submittedAction,
  })
  const actionResolverInput = actionResolverInputResult.input
  const actionResolverPrompt = actionResolverInteractionSpec.buildPrompt(actionResolverInput)
  const actionResolution = validateActionResolution(
    await input.actionResolverAdapter.resolveAction(actionResolverPrompt, actionResolverInput),
  )

  const worldTickInputResult = await buildWorldTickInputFromWiki({
    projectPath: input.projectPath,
    submittedAction: input.submittedAction,
    actionResolution,
    preActionSnapshot: actionResolverInput.preActionSnapshot,
  })
  const worldTickInput = worldTickInputResult.input
  const worldTickPrompt = worldTickInteractionSpec.buildPrompt(worldTickInput)
  const worldTickResult = validateWorldTickResult(
    await input.worldTickAdapter.advanceWorldTick(worldTickPrompt, worldTickInput),
  )
  const visibleSelection = selectWorldTickVisibleContent({ actionResolution, worldTickResult })
  const postActionWorkingState = buildPostActionWorkingState({
    submittedAction: input.submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
  })
  const recallSelectorInputResult = await buildRecallSelectorInputFromTurnStateAndWiki({
    projectPath: input.projectPath,
    submittedAction: input.submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
  })
  const recallSelectorPrompt = recallSelectorInteractionSpec.buildPrompt(recallSelectorInputResult.input)
  const recallSelection = validateRecallSelection(
    await input.recallSelectorAdapter.selectRecall(recallSelectorPrompt, recallSelectorInputResult.input),
    recallSelectorInputResult.input,
  )
  const recallHandoff = await createRecallSelectorHandoff({
    projectPath: input.projectPath,
    retrievalIndex: recallSelectorInputResult.input.retrievalIndex,
    recallSelection,
  })
  const outlineBriefInputResult = await buildOutlineBriefInputFromTurnStateAndWiki({
    projectPath: input.projectPath,
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
    recallSelection,
    recalledMaterials: recallHandoff.recalledMaterials,
  })
  const outlineBriefInput = outlineBriefInputResult.input
  const outlineBriefPrompt = outlineBriefInteractionSpec.buildPrompt(outlineBriefInput)
  const outlineBriefOutput = validateOutlineBriefCompilerOutput(
    await input.outlineBriefCompilerAdapter.compileOutlineBrief(outlineBriefPrompt, outlineBriefInput),
    outlineBriefInput,
  )
  const outlineRegeneration = await runStoryOutlineRegeneratorIfNeeded({
    outlineBriefInput,
    outlineImpactReport: outlineBriefOutput.outlineImpactReport,
    regenerationRequest: outlineBriefOutput.regenerationRequest,
    adapter: input.storyOutlineRegeneratorAdapter,
  })

  const narrationInputResult = await buildNarrationGeneratorInputFromHandoffs({
    projectPath: input.projectPath,
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
    recallSelection,
    recalledMaterials: recallHandoff.recalledMaterials,
    outlineAwareNarrationBrief: outlineBriefOutput.outlineAwareNarrationBrief,
    provisionalNarrationHandoff: outlineRegeneration.output?.provisionalOutlinePatch.narrationHandoff,
  })
  const narrationInput = narrationInputResult.input
  const prompt = narrationGeneratorInteractionSpec.buildPrompt(narrationInput)
  const turnNarration = validateTurnNarration(
    await input.narrationAdapter.generateNarration(prompt, narrationInput),
    narrationInput,
  )
  const turnResult = createTurnResultFromTurnNarration(turnNarration)
  const turnRecord = createRpgTurnRecord({
    submittedAction: input.submittedAction,
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
    recallSelection,
    recalledMaterials: recallHandoff.recalledMaterials,
    outlineAwareNarrationBrief: outlineBriefOutput.outlineAwareNarrationBrief,
    outlineImpactReport: outlineBriefOutput.outlineImpactReport,
    regenerationRequest: outlineBriefOutput.regenerationRequest,
    provisionalOutlinePatch: outlineRegeneration.output?.provisionalOutlinePatch,
    outlineRevisionProposal: outlineRegeneration.output?.outlineRevisionProposal,
    regenerationSafetyReport: outlineRegeneration.output?.regenerationSafetyReport,
    turnNarration,
    turnResult,
  })

  return {
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState,
    recallSelection,
    recalledMaterials: recallHandoff.recalledMaterials,
    outlineAwareNarrationBrief: outlineBriefOutput.outlineAwareNarrationBrief,
    outlineImpactReport: outlineBriefOutput.outlineImpactReport,
    regenerationRequest: outlineBriefOutput.regenerationRequest,
    provisionalOutlinePatch: outlineRegeneration.output?.provisionalOutlinePatch,
    outlineRevisionProposal: outlineRegeneration.output?.outlineRevisionProposal,
    regenerationSafetyReport: outlineRegeneration.output?.regenerationSafetyReport,
    turnNarration,
    turnResult,
    turnRecord,
    warnings: [
      ...actionResolverInputResult.warnings,
      ...worldTickInputResult.warnings,
      ...postActionWorkingState.warnings,
      ...recallSelectorInputResult.warnings,
      ...recallHandoff.warnings,
      ...outlineBriefInputResult.warnings,
      ...outlineBriefOutput.warnings,
      ...outlineRegeneration.warnings,
      ...narrationInputResult.warnings,
    ],
  }
}

async function runStoryOutlineRegeneratorIfNeeded(input: {
  outlineBriefInput: OutlineBriefCompilerInput
  outlineImpactReport: OutlineImpactReport
  regenerationRequest: RegenerationRequest | undefined
  adapter: RpgStoryOutlineRegeneratorAdapter | undefined
}): Promise<{ output?: StoryOutlineRegeneratorOutput; warnings: string[] }> {
  const isMajorRegeneration =
    input.outlineImpactReport.impactLevel === "major_rewrite_required"
    && input.outlineImpactReport.requiresRegeneration

  if (!isMajorRegeneration) return { warnings: [] }

  if (!input.regenerationRequest) {
    return {
      warnings: [
        [
          `Outline impact report ${input.outlineImpactReport.reportId} requires regeneration.`,
          "Story Outline Regenerator is not triggered because no regenerationRequest was provided.",
        ].join(" "),
      ],
    }
  }

  if (!input.adapter) {
    return {
      warnings: [
        [
          `Outline impact report ${input.outlineImpactReport.reportId} requires regeneration.`,
          "Story Outline Regenerator is not triggered because storyOutlineRegeneratorAdapter is unavailable.",
          `regenerationRequest ${input.regenerationRequest.requestId} was saved for audit/control handoff only.`,
        ].join(" "),
      ],
    }
  }

  const promptInput = buildStoryOutlineRegeneratorInputFromTurnState({
    outlineBriefInput: input.outlineBriefInput,
    outlineImpactReport: input.outlineImpactReport,
    regenerationRequest: input.regenerationRequest,
  })
  const prompt = storyOutlineRegeneratorInteractionSpec.buildPrompt(promptInput)
  const adapterOutput = await input.adapter.regenerateOutline(prompt, promptInput)
  const output = storyOutlineRegeneratorInteractionSpec.parseOutput(JSON.stringify(adapterOutput), promptInput)

  return {
    output,
    warnings: [
      `Story Outline Regenerator ran for regenerationRequest ${input.regenerationRequest.requestId}.`,
      "provisionalOutlinePatch is same-turn only.",
      "outlineRevisionProposal is independent review/pending only.",
      ...output.warnings,
    ],
  }
}
