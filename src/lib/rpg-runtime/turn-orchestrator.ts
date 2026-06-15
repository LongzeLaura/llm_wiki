import {
  actionResolverInteractionSpec,
  ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
  buildSoftSemanticRepairRetryPrompt,
  narrationGeneratorInteractionSpec,
  OUTLINE_BRIEF_DRAFT_SCHEMA_PROMPT_LINES,
  outlineBriefInteractionSpec,
  parseRpgActionResolverOutput,
  parseRpgOutlineBriefOutput,
  parseRpgRecallSelectionOutput,
  parseRpgNarrationGeneratorOutput,
  parseRpgStoryOutlineRegeneratorOutput,
  parseRpgWorldTickOutput,
  RECALL_SELECTION_DRAFT_SCHEMA_PROMPT_LINES,
  STORY_OUTLINE_REGENERATOR_DRAFT_SCHEMA_PROMPT_LINES,
  recallSelectorInteractionSpec,
  storyOutlineRegeneratorInteractionSpec,
  type SoftSemanticJsonParseReport,
  type SoftSemanticRepairRetryPromptSummary,
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
  TURN_NARRATION_DRAFT_SCHEMA_PROMPT_LINES,
  WORLD_TICK_DRAFT_SCHEMA_PROMPT_LINES,
  worldTickInteractionSpec,
} from "../rpg-interactions/runtime"
import type { RpgInteractionPrompt } from "../rpg-interactions/interaction-spec"
import { buildNarrationGeneratorInputFromHandoffs } from "./narration-input-builder"
import { buildOutlineBriefInputFromTurnStateAndWiki } from "./outline-brief-input-builder"
import { buildRecallSelectorInputFromTurnStateAndWiki } from "./recall-selector-input-builder"
import { createRecallSelectorHandoff } from "./recall-selector-handoff"
import { buildActionResolverInputFromWiki } from "./action-resolver-input-builder"
import { buildStoryOutlineRegeneratorInputFromTurnState } from "./story-outline-regenerator-handoff"
import {
  classifyRpgRuntimeDebugErrorPhase,
  createJsonRpgRuntimeDebugSection,
  createRpgRuntimeDebugSection,
  stringifyDebugJson,
  toRpgRuntimeDebugError,
  type RpgRuntimeDebugError,
  type RpgRuntimeDebugErrorPhase,
  type RpgRuntimeDebugStepId,
  type RpgRuntimeDebugTraceSink,
} from "./debug-trace"
import {
  createRpgTurnRecord,
  createTurnResultFromTurnNarration,
  type RpgTurnRecord,
  type RpgTurnResult,
} from "./turn-model"
import { buildTurnSemanticHandoff } from "./turn-semantic-handoff"
import {
  buildPostActionWorkingState,
  buildWorldTickSemanticHandoff,
  selectWorldTickVisibleContent,
} from "./world-tick-working-state"
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
  TurnSemanticHandoff,
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
  debugTraceSink?: RpgRuntimeDebugTraceSink
  softSemanticRepairRetry?: SoftSemanticRepairRetryRuntimeOptions
}

export interface SoftSemanticRepairRetryRuntimeOptions {
  enabled?: boolean
  maxAttempts?: 1
  maxFailedOutputChars?: number
}

export interface RunRpgTurnResult {
  actionResolution: ActionResolution
  worldTickResult: WorldTickResult
  visibleSelection: WorldTickVisibleSelection
  postActionWorkingState: PostActionWorkingState
  turnSemanticHandoff: TurnSemanticHandoff
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
  const debugTraceSink = input.debugTraceSink
  const ownsTrace = !!debugTraceSink && !debugTraceSink.getCurrentTrace()
  if (ownsTrace) debugTraceSink.startTrace({ submittedAction: input.submittedAction })

  try {
    debugTraceSink?.startStep("action_resolver")
    const actionResolverInputResult = await buildActionResolverInputFromWiki({
      projectPath: input.projectPath,
      submittedAction: input.submittedAction,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "action_resolver", error, "input_assembly")
      throw error
    })
    const actionResolverInput = actionResolverInputResult.input
    addDebugJsonSection(debugTraceSink, "action_resolver", "inputSections", {
      sectionId: "action-resolver-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildActionResolverInputFromWiki",
      value: actionResolverInputResult,
    })
    addWikiInputSourcePathsSection(debugTraceSink, "action_resolver", "buildActionResolverInputFromWiki", actionResolverInputResult)
    debugTraceSink?.addStepWarnings("action_resolver", actionResolverInputResult.warnings)
    const actionResolverPrompt = actionResolverInteractionSpec.buildPrompt(actionResolverInput)
    addPromptDebugSections(debugTraceSink, "action_resolver", actionResolverPrompt)
    const actionResolution = await runLlmDebugStep(
      debugTraceSink,
      "action_resolver",
      async () => {
        const rawOutput = input.actionResolverAdapter.resolveActionRawOutput
          ? await input.actionResolverAdapter.resolveActionRawOutput(actionResolverPrompt, actionResolverInput)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(debugTraceSink, "action_resolver", rawOutput)
          debugTraceSink?.setStepStatus("action_resolver", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput: actionResolverInput,
            stepId: "action_resolver",
            stageKind: "action_resolver",
            stageLabel: "RPG Action Resolver",
            draftSchemaLines: ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: ACTION_RESOLVER_REPAIR_SAFETY_LINES,
            parseOutput(output, promptInput, options) {
              return parseRpgActionResolverOutput(output, promptInput, options)
            },
            repairRawOutput: input.actionResolverAdapter.repairActionResolutionRawOutput?.bind(input.actionResolverAdapter),
            debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(debugTraceSink, "action_resolver", parsed)
          debugTraceSink?.setStepStatus("action_resolver", "validating")
          return validateActionResolution(parsed)
        }

        const parsed = await input.actionResolverAdapter.resolveAction(actionResolverPrompt, actionResolverInput)
        addRawOutputDebugSection(debugTraceSink, "action_resolver", stringifyDebugJson(parsed))
        addParsedOutputDebugSection(debugTraceSink, "action_resolver", parsed)
        debugTraceSink?.setStepStatus("action_resolver", "validating")
        return validateActionResolution(parsed)
      },
    )
    addValidationDebugSection(debugTraceSink, "action_resolver", {
      summary: "ActionResolution accepted by validateActionResolution.",
      output: actionResolution,
    })
    addStepWarningsFromValue(debugTraceSink, "action_resolver", actionResolution)
    debugTraceSink?.finishStep("action_resolver")

    debugTraceSink?.startStep("world_tick")
    const worldTickInputResult = await buildWorldTickInputFromWiki({
      projectPath: input.projectPath,
      submittedAction: input.submittedAction,
      actionResolution,
      preActionSnapshot: actionResolverInput.preActionSnapshot,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "world_tick", error, "input_assembly")
      throw error
    })
    const worldTickInput = worldTickInputResult.input
    addDebugJsonSection(debugTraceSink, "world_tick", "inputSections", {
      sectionId: "world-tick-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildWorldTickInputFromWiki",
      value: worldTickInputResult,
    })
    addWikiInputSourcePathsSection(debugTraceSink, "world_tick", "buildWorldTickInputFromWiki", worldTickInputResult)
    debugTraceSink?.addStepWarnings("world_tick", worldTickInputResult.warnings)
    const worldTickPrompt = worldTickInteractionSpec.buildPrompt(worldTickInput)
    addPromptDebugSections(debugTraceSink, "world_tick", worldTickPrompt)
    const worldTickResult = await runLlmDebugStep(
      debugTraceSink,
      "world_tick",
      async () => {
        const rawOutput = input.worldTickAdapter.advanceWorldTickRawOutput
          ? await input.worldTickAdapter.advanceWorldTickRawOutput(worldTickPrompt, worldTickInput)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(debugTraceSink, "world_tick", rawOutput)
          debugTraceSink?.setStepStatus("world_tick", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput: worldTickInput,
            stepId: "world_tick",
            stageKind: "world_tick",
            stageLabel: "RPG World Tick",
            draftSchemaLines: WORLD_TICK_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: WORLD_TICK_REPAIR_SAFETY_LINES,
            parseOutput(output, promptInput, options) {
              return parseRpgWorldTickOutput(output, promptInput, options)
            },
            repairRawOutput: input.worldTickAdapter.repairWorldTickRawOutput?.bind(input.worldTickAdapter),
            debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(debugTraceSink, "world_tick", parsed)
          debugTraceSink?.setStepStatus("world_tick", "validating")
          return validateWorldTickResult(parsed)
        }

        const parsed = await input.worldTickAdapter.advanceWorldTick(worldTickPrompt, worldTickInput)
        addRawOutputDebugSection(debugTraceSink, "world_tick", stringifyDebugJson(parsed))
        addParsedOutputDebugSection(debugTraceSink, "world_tick", parsed)
        debugTraceSink?.setStepStatus("world_tick", "validating")
        return validateWorldTickResult(parsed)
      },
    )
    addValidationDebugSection(debugTraceSink, "world_tick", {
      summary: "WorldTickResult accepted by validateWorldTickResult.",
      output: worldTickResult,
    })
    addStepWarningsFromValue(debugTraceSink, "world_tick", worldTickResult)
    const visibleSelection = selectWorldTickVisibleContent({ actionResolution, worldTickResult })
    const postActionWorkingState = buildPostActionWorkingState({
      submittedAction: input.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
    })
    const worldTickSemanticHandoff = buildWorldTickSemanticHandoff({
      submittedAction: input.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
    })
    const turnSemanticHandoff = buildTurnSemanticHandoff({
      submittedAction: input.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      worldTickSemanticHandoff,
    })
    addDebugJsonSection(debugTraceSink, "world_tick", "handoffSections", {
      sectionId: "world-tick-handoff",
      title: "交接 / 下一步输入",
      sourceKind: "local_result",
      sourceLabel: "selectWorldTickVisibleContent / buildPostActionWorkingState",
      value: { visibleSelection, postActionWorkingState },
    })
    addDebugJsonSection(debugTraceSink, "world_tick", "handoffSections", {
      sectionId: "world-tick-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "local_result",
      sourceLabel: "visibleSelection / postActionWorkingState",
      value: summarizeWorldTickHandoff(visibleSelection, postActionWorkingState),
    })
    addDebugJsonSection(debugTraceSink, "world_tick", "handoffSections", {
      sectionId: "world-tick-semantic-handoff",
      title: "World Tick Semantic Handoff",
      sourceKind: "runtime_handoff",
      sourceLabel: "buildWorldTickSemanticHandoff",
      value: worldTickSemanticHandoff,
    })
    addDebugJsonSection(debugTraceSink, "world_tick", "handoffSections", {
      sectionId: "turn-semantic-handoff",
      title: "Turn Semantic Handoff",
      sourceKind: "runtime_handoff",
      sourceLabel: "buildTurnSemanticHandoff",
      value: turnSemanticHandoff,
    })
    debugTraceSink?.addStepWarnings("world_tick", postActionWorkingState.warnings)
    debugTraceSink?.finishStep("world_tick")

    debugTraceSink?.startStep("recall_selector")
    const recallSelectorInputResult = await buildRecallSelectorInputFromTurnStateAndWiki({
      projectPath: input.projectPath,
      submittedAction: input.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      turnSemanticHandoff,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "recall_selector", error, "input_assembly")
      throw error
    })
    addDebugJsonSection(debugTraceSink, "recall_selector", "inputSections", {
      sectionId: "recall-selector-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildRecallSelectorInputFromTurnStateAndWiki",
      value: recallSelectorInputResult,
    })
    addWikiInputSourcePathsSection(
      debugTraceSink,
      "recall_selector",
      "buildRecallSelectorInputFromTurnStateAndWiki",
      recallSelectorInputResult,
    )
    debugTraceSink?.addStepWarnings("recall_selector", recallSelectorInputResult.warnings)
    const recallSelectorPrompt = recallSelectorInteractionSpec.buildPrompt(recallSelectorInputResult.input)
    addPromptDebugSections(debugTraceSink, "recall_selector", recallSelectorPrompt)
    const recallSelection = await runLlmDebugStep(
      debugTraceSink,
      "recall_selector",
      async () => {
        const rawOutput = input.recallSelectorAdapter.selectRecallRawOutput
          ? await input.recallSelectorAdapter.selectRecallRawOutput(recallSelectorPrompt, recallSelectorInputResult.input)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(debugTraceSink, "recall_selector", rawOutput)
          debugTraceSink?.setStepStatus("recall_selector", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput: recallSelectorInputResult.input,
            stepId: "recall_selector",
            stageKind: "recall_selector",
            stageLabel: "RPG Recall Selector",
            draftSchemaLines: RECALL_SELECTION_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: RECALL_SELECTOR_REPAIR_SAFETY_LINES,
            parseOutput(output, promptInput, options) {
              return parseRpgRecallSelectionOutput(output, promptInput, options)
            },
            repairRawOutput: input.recallSelectorAdapter.repairRecallRawOutput?.bind(input.recallSelectorAdapter),
            debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(debugTraceSink, "recall_selector", parsed)
          debugTraceSink?.setStepStatus("recall_selector", "validating")
          return validateRecallSelection(parsed, recallSelectorInputResult.input)
        }

        const parsed = await input.recallSelectorAdapter.selectRecall(recallSelectorPrompt, recallSelectorInputResult.input)
        addRawOutputDebugSection(debugTraceSink, "recall_selector", stringifyDebugJson(parsed))
        addParsedOutputDebugSection(debugTraceSink, "recall_selector", parsed)
        debugTraceSink?.setStepStatus("recall_selector", "validating")
        return validateRecallSelection(parsed, recallSelectorInputResult.input)
      },
    )
    addValidationDebugSection(debugTraceSink, "recall_selector", {
      summary: "RecallSelection accepted by validateRecallSelection.",
      output: recallSelection,
    })
    addValidationWarningsDebugSection(debugTraceSink, "recall_selector", recallSelection.warnings, "RecallSelection.warnings")
    debugTraceSink?.addStepWarnings("recall_selector", recallSelection.warnings)
    const recallHandoff = await createRecallSelectorHandoff({
      projectPath: input.projectPath,
      retrievalIndex: recallSelectorInputResult.input.retrievalIndex,
      recallSelection,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "recall_selector", error, "input_assembly")
      throw error
    })
    addDebugJsonSection(debugTraceSink, "recall_selector", "handoffSections", {
      sectionId: "recall-selector-handoff",
      title: "交接 / 下一步输入",
      sourceKind: "runtime_handoff",
      sourceLabel: "createRecallSelectorHandoff",
      value: recallHandoff,
    })
    addWikiInputSourcePathsSection(debugTraceSink, "recall_selector", "createRecallSelectorHandoff", recallHandoff)
    addDebugJsonSection(debugTraceSink, "recall_selector", "handoffSections", {
      sectionId: "recall-selector-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "runtime_handoff",
      sourceLabel: "recallHandoff / recalledMaterials",
      value: summarizeRecallHandoff(recallHandoff),
    })
    debugTraceSink?.addStepWarnings("recall_selector", recallHandoff.warnings)
    debugTraceSink?.finishStep("recall_selector")

    debugTraceSink?.startStep("outline_brief")
    const outlineBriefInputResult = await buildOutlineBriefInputFromTurnStateAndWiki({
      projectPath: input.projectPath,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      turnSemanticHandoff,
      recallSelection,
      recalledMaterials: recallHandoff.recalledMaterials,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "outline_brief", error, "input_assembly")
      throw error
    })
    const outlineBriefInput = outlineBriefInputResult.input
    addDebugJsonSection(debugTraceSink, "outline_brief", "inputSections", {
      sectionId: "outline-brief-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildOutlineBriefInputFromTurnStateAndWiki",
      value: outlineBriefInputResult,
    })
    addWikiInputSourcePathsSection(debugTraceSink, "outline_brief", "buildOutlineBriefInputFromTurnStateAndWiki", outlineBriefInputResult)
    debugTraceSink?.addStepWarnings("outline_brief", outlineBriefInputResult.warnings)
    const outlineBriefPrompt = outlineBriefInteractionSpec.buildPrompt(outlineBriefInput)
    addPromptDebugSections(debugTraceSink, "outline_brief", outlineBriefPrompt)
    const outlineBriefOutput = await runLlmDebugStep(
      debugTraceSink,
      "outline_brief",
      async () => {
        const rawOutput = input.outlineBriefCompilerAdapter.compileOutlineBriefRawOutput
          ? await input.outlineBriefCompilerAdapter.compileOutlineBriefRawOutput(outlineBriefPrompt, outlineBriefInput)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(debugTraceSink, "outline_brief", rawOutput)
          debugTraceSink?.setStepStatus("outline_brief", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput: outlineBriefInput,
            stepId: "outline_brief",
            stageKind: "outline_brief",
            stageLabel: "RPG Outline Brief",
            draftSchemaLines: OUTLINE_BRIEF_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: OUTLINE_BRIEF_REPAIR_SAFETY_LINES,
            parseOutput(output, promptInput, options) {
              return parseRpgOutlineBriefOutput(output, promptInput, options)
            },
            repairRawOutput: input.outlineBriefCompilerAdapter.repairOutlineBriefRawOutput?.bind(input.outlineBriefCompilerAdapter),
            debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(debugTraceSink, "outline_brief", parsed)
          addDebugJsonSection(debugTraceSink, "outline_brief", "validationSections", {
            sectionId: "outline-brief-compiled-canonical-summary",
            title: "Compiled Canonical Summary",
            sourceKind: "local_result",
            sourceLabel: "parseRpgOutlineBriefOutput",
            value: summarizeOutlineBriefHandoff(parsed),
          })
          debugTraceSink?.setStepStatus("outline_brief", "validating")
          return validateOutlineBriefCompilerOutput(parsed, outlineBriefInput)
        }

        const parsed = await input.outlineBriefCompilerAdapter.compileOutlineBrief(outlineBriefPrompt, outlineBriefInput)
        addRawOutputDebugSection(debugTraceSink, "outline_brief", stringifyDebugJson(parsed))
        addParsedOutputDebugSection(debugTraceSink, "outline_brief", parsed)
        debugTraceSink?.setStepStatus("outline_brief", "validating")
        return validateOutlineBriefCompilerOutput(parsed, outlineBriefInput)
      },
    )
    addValidationDebugSection(debugTraceSink, "outline_brief", {
      summary: "OutlineBriefCompilerOutput accepted by validateOutlineBriefCompilerOutput.",
      output: outlineBriefOutput,
    })
    addValidationWarningsDebugSection(debugTraceSink, "outline_brief", outlineBriefOutput.warnings, "OutlineBriefCompilerOutput.warnings")
    debugTraceSink?.addStepWarnings("outline_brief", outlineBriefOutput.warnings)
    addDebugJsonSection(debugTraceSink, "outline_brief", "handoffSections", {
      sectionId: "outline-brief-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "runtime_handoff",
      sourceLabel: "outlineAwareNarrationBrief / outlineImpactReport / regenerationRequest",
      value: summarizeOutlineBriefHandoff(outlineBriefOutput),
    })
    debugTraceSink?.finishStep("outline_brief")

    const outlineRegeneration = await runStoryOutlineRegeneratorIfNeeded({
      outlineBriefInput,
      outlineImpactReport: outlineBriefOutput.outlineImpactReport,
      regenerationRequest: outlineBriefOutput.regenerationRequest,
      adapter: input.storyOutlineRegeneratorAdapter,
      debugTraceSink,
      softSemanticRepairRetry: input.softSemanticRepairRetry,
    })

    debugTraceSink?.startStep("narration_generator")
    const narrationInputResult = await buildNarrationGeneratorInputFromHandoffs({
      projectPath: input.projectPath,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      turnSemanticHandoff,
      recallSelection,
      recalledMaterials: recallHandoff.recalledMaterials,
      outlineAwareNarrationBrief: outlineBriefOutput.outlineAwareNarrationBrief,
      provisionalNarrationHandoff: outlineRegeneration.output?.provisionalOutlinePatch.narrationHandoff,
    }).catch((error: unknown) => {
      failDebugStep(debugTraceSink, "narration_generator", error, "input_assembly")
      throw error
    })
    const narrationInput = narrationInputResult.input
    addDebugJsonSection(debugTraceSink, "narration_generator", "inputSections", {
      sectionId: "narration-generator-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildNarrationGeneratorInputFromHandoffs",
      value: narrationInputResult,
    })
    addWikiInputSourcePathsSection(debugTraceSink, "narration_generator", "buildNarrationGeneratorInputFromHandoffs", narrationInputResult)
    debugTraceSink?.addStepWarnings("narration_generator", narrationInputResult.warnings)
    const prompt = narrationGeneratorInteractionSpec.buildPrompt(narrationInput)
    addPromptDebugSections(debugTraceSink, "narration_generator", prompt)
    const turnNarration = await runLlmDebugStep(
      debugTraceSink,
      "narration_generator",
      async () => {
        const rawOutput = input.narrationAdapter.generateNarrationRawOutput
          ? await input.narrationAdapter.generateNarrationRawOutput(prompt, narrationInput)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(debugTraceSink, "narration_generator", rawOutput)
          debugTraceSink?.setStepStatus("narration_generator", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput: narrationInput,
            stepId: "narration_generator",
            stageKind: "narration_generator",
            stageLabel: "RPG Narration Generator",
            draftSchemaLines: TURN_NARRATION_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: NARRATION_GENERATOR_REPAIR_SAFETY_LINES,
            parseOutput(output, promptInput, options) {
              return parseRpgNarrationGeneratorOutput(output, promptInput, options)
            },
            repairRawOutput: input.narrationAdapter.repairNarrationRawOutput?.bind(input.narrationAdapter),
            debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(debugTraceSink, "narration_generator", parsed)
          debugTraceSink?.setStepStatus("narration_generator", "validating")
          return validateTurnNarration(parsed, narrationInput)
        }

        const parsed = await input.narrationAdapter.generateNarration(prompt, narrationInput)
        addRawOutputDebugSection(debugTraceSink, "narration_generator", stringifyDebugJson(parsed))
        addParsedOutputDebugSection(debugTraceSink, "narration_generator", parsed)
        debugTraceSink?.setStepStatus("narration_generator", "validating")
        return validateTurnNarration(parsed, narrationInput)
      },
    )
    addValidationDebugSection(debugTraceSink, "narration_generator", {
      summary: "TurnNarration accepted by validateTurnNarration.",
      output: turnNarration,
    })
    addValidationWarningsDebugSection(debugTraceSink, "narration_generator", turnNarration.warnings, "TurnNarration.warnings")
    debugTraceSink?.addStepWarnings("narration_generator", turnNarration.warnings)
    const turnResult = createTurnResultFromTurnNarration(turnNarration)
    const turnRecord = createRpgTurnRecord({
      submittedAction: input.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      turnSemanticHandoff,
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
    addDebugJsonSection(debugTraceSink, "narration_generator", "handoffSections", {
      sectionId: "narration-generator-handoff",
      title: "交接 / 下一步输入",
      sourceKind: "runtime_handoff",
      sourceLabel: "createRpgTurnRecord",
      value: { turnResult, turnRecord },
    })
    addDebugJsonSection(debugTraceSink, "narration_generator", "handoffSections", {
      sectionId: "narration-generator-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "runtime_handoff",
      sourceLabel: "turnResult / turnRecord",
      value: summarizeNarrationHandoff(turnResult, turnRecord),
    })
    debugTraceSink?.finishStep("narration_generator")

    const result = {
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
      turnSemanticHandoff,
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

    if (ownsTrace) debugTraceSink?.finishTrace("succeeded")
    return result
  } catch (error) {
    if (ownsTrace) debugTraceSink?.finishTrace("failed", error)
    throw error
  }
}

async function runStoryOutlineRegeneratorIfNeeded(input: {
  outlineBriefInput: OutlineBriefCompilerInput
  outlineImpactReport: OutlineImpactReport
  regenerationRequest: RegenerationRequest | undefined
  adapter: RpgStoryOutlineRegeneratorAdapter | undefined
  debugTraceSink?: RpgRuntimeDebugTraceSink
  softSemanticRepairRetry?: SoftSemanticRepairRetryRuntimeOptions
}): Promise<{ output?: StoryOutlineRegeneratorOutput; warnings: string[] }> {
  const isMajorRegeneration =
    input.outlineImpactReport.impactLevel === "major_rewrite_required"
    && input.outlineImpactReport.requiresRegeneration

  if (!isMajorRegeneration) {
    input.debugTraceSink?.skipStep(
      "story_outline_regenerator",
      `Skipped: outline impact ${input.outlineImpactReport.reportId} does not require major regeneration.`,
    )
    return { warnings: [] }
  }

  input.debugTraceSink?.startStep("story_outline_regenerator")

  if (!input.regenerationRequest) {
    const warnings = [
      [
        `Outline impact report ${input.outlineImpactReport.reportId} requires regeneration.`,
        "Story Outline Regenerator is not triggered because no regenerationRequest was provided.",
      ].join(" "),
    ]
    input.debugTraceSink?.addStepWarnings("story_outline_regenerator", warnings)
    input.debugTraceSink?.skipStep("story_outline_regenerator", warnings[0])
    return { warnings }
  }

  if (!input.adapter) {
    const warnings = [
      [
        `Outline impact report ${input.outlineImpactReport.reportId} requires regeneration.`,
        "Story Outline Regenerator is not triggered because storyOutlineRegeneratorAdapter is unavailable.",
        `regenerationRequest ${input.regenerationRequest.requestId} was saved for audit/control handoff only.`,
      ].join(" "),
    ]
    input.debugTraceSink?.addStepWarnings("story_outline_regenerator", warnings)
    input.debugTraceSink?.skipStep("story_outline_regenerator", warnings[0])
    return { warnings }
  }

  try {
    const promptInput = buildStoryOutlineRegeneratorInputFromTurnState({
      outlineBriefInput: input.outlineBriefInput,
      outlineImpactReport: input.outlineImpactReport,
      regenerationRequest: input.regenerationRequest,
    })
    addDebugJsonSection(input.debugTraceSink, "story_outline_regenerator", "inputSections", {
      sectionId: "story-outline-regenerator-input-assembly",
      title: "输入组装",
      sourceKind: "local_input_builder",
      sourceLabel: "buildStoryOutlineRegeneratorInputFromTurnState",
      value: promptInput,
    })
    addWikiInputSourcePathsSection(
      input.debugTraceSink,
      "story_outline_regenerator",
      "buildStoryOutlineRegeneratorInputFromTurnState",
      promptInput,
    )
    const prompt = storyOutlineRegeneratorInteractionSpec.buildPrompt(promptInput)
    addPromptDebugSections(input.debugTraceSink, "story_outline_regenerator", prompt)
    const output = await runLlmDebugStep(
      input.debugTraceSink,
      "story_outline_regenerator",
      async () => {
        const rawOutput = input.adapter?.regenerateOutlineRawOutput
          ? await input.adapter.regenerateOutlineRawOutput(prompt, promptInput)
          : undefined
        if (rawOutput !== undefined) {
          addRawOutputDebugSection(input.debugTraceSink, "story_outline_regenerator", rawOutput)
          input.debugTraceSink?.setStepStatus("story_outline_regenerator", "parsing")
          const parsed = await parseSoftSemanticRawOutputWithOptionalRepairRetry({
            rawOutput,
            promptInput,
            stepId: "story_outline_regenerator",
            stageKind: "story_outline_regenerator",
            stageLabel: "RPG Story Outline Regenerator",
            draftSchemaLines: STORY_OUTLINE_REGENERATOR_DRAFT_SCHEMA_PROMPT_LINES,
            safetyInstructionLines: STORY_OUTLINE_REGENERATOR_REPAIR_SAFETY_LINES,
            parseOutput(output, currentPromptInput, options) {
              return parseRpgStoryOutlineRegeneratorOutput(output, currentPromptInput, options)
            },
            repairRawOutput: input.adapter?.repairStoryOutlineRegeneratorRawOutput?.bind(input.adapter),
            debugTraceSink: input.debugTraceSink,
            retryOptions: input.softSemanticRepairRetry,
          })
          addParsedOutputDebugSection(input.debugTraceSink, "story_outline_regenerator", parsed)
          input.debugTraceSink?.setStepStatus("story_outline_regenerator", "validating")
          return parsed
        }

        const adapterOutput = await input.adapter!.regenerateOutline(prompt, promptInput)
        const rawFixtureOutput = JSON.stringify(adapterOutput)
        addRawOutputDebugSection(input.debugTraceSink, "story_outline_regenerator", rawFixtureOutput)
        input.debugTraceSink?.setStepStatus("story_outline_regenerator", "parsing")
        const parsed = storyOutlineRegeneratorInteractionSpec.parseOutput(rawFixtureOutput, promptInput)
        addParsedOutputDebugSection(input.debugTraceSink, "story_outline_regenerator", parsed)
        input.debugTraceSink?.setStepStatus("story_outline_regenerator", "validating")
        return parsed
      },
    )
    addValidationDebugSection(input.debugTraceSink, "story_outline_regenerator", {
      summary: "StoryOutlineRegeneratorOutput accepted by interaction validation.",
      output,
    })
    addValidationWarningsDebugSection(
      input.debugTraceSink,
      "story_outline_regenerator",
      output.warnings,
      "StoryOutlineRegeneratorOutput.warnings",
    )
    addDebugJsonSection(input.debugTraceSink, "story_outline_regenerator", "handoffSections", {
      sectionId: "story-outline-regenerator-handoff",
      title: "交接 / 下一步输入",
      sourceKind: "runtime_handoff",
      sourceLabel: "provisionalOutlinePatch.narrationHandoff",
      value: {
        provisionalOutlinePatch: output.provisionalOutlinePatch,
        outlineRevisionProposal: output.outlineRevisionProposal,
        regenerationSafetyReport: output.regenerationSafetyReport,
      },
    })
    addDebugJsonSection(input.debugTraceSink, "story_outline_regenerator", "handoffSections", {
      sectionId: "story-outline-regenerator-handoff-summary",
      title: "Handoff Summary",
      sourceKind: "runtime_handoff",
      sourceLabel: "provisionalOutlinePatch.narrationHandoff",
      value: summarizeStoryOutlineRegeneratorHandoff(output),
    })

    const warnings = [
      `Story Outline Regenerator ran for regenerationRequest ${input.regenerationRequest.requestId}.`,
      "provisionalOutlinePatch is same-turn only.",
      "outlineRevisionProposal is independent review/pending only.",
      ...output.warnings,
    ]
    input.debugTraceSink?.addStepWarnings("story_outline_regenerator", warnings)
    input.debugTraceSink?.finishStep("story_outline_regenerator")
    return { output, warnings }
  } catch (error) {
    failDebugStep(input.debugTraceSink, "story_outline_regenerator", error, classifyRpgRuntimeDebugErrorPhase(error))
    throw error
  }
}

async function runLlmDebugStep<T>(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  run: () => Promise<T>,
): Promise<T> {
  debugTraceSink?.setStepStatus(stepId, "streaming")
  try {
    return await run()
  } catch (error) {
    const phase = classifyRpgRuntimeDebugErrorPhase(error)
    failDebugStep(debugTraceSink, stepId, error, phase)
    throw error
  }
}

const ACTION_RESOLVER_REPAIR_SAFETY_LINES = [
  "Do not add world tick content, reaction queues, wiki writes, proposed updates, pending updates, player-facing narration, or next action options.",
] as const

const WORLD_TICK_REPAIR_SAFETY_LINES = [
  "Do not add wiki writes, proposed updates, pending updates, Recall Selector output, outline revisions, player-facing narration, or next action options.",
] as const

const RECALL_SELECTOR_REPAIR_SAFETY_LINES = [
  "Do not add recalled file contents, narration, outline brief output, outline revisions, wiki writes, proposed updates, pending updates, or runtime update proposals.",
] as const

const OUTLINE_BRIEF_REPAIR_SAFETY_LINES = [
  "Do not add player-facing narration, wiki writes, proposed updates, pending updates, direct outline edits, or any claim that wiki files were modified.",
] as const

const STORY_OUTLINE_REGENERATOR_REPAIR_SAFETY_LINES = [
  "Do not add player-facing prose, next action options, wiki writes, runtime updates, proposed updates, pending updates, direct outline edits, or confirmed event claims.",
] as const

const NARRATION_GENERATOR_REPAIR_SAFETY_LINES = [
  "Do not add wiki writes, proposed updates, pending updates, runtime update proposals, direct file edits, or claims that wiki files were modified.",
] as const

interface SoftSemanticRawOutputRepairParseInput<TPromptInput, TOutput> {
  rawOutput: string
  promptInput: TPromptInput
  stepId: RpgRuntimeDebugStepId
  stageKind: string
  stageLabel: string
  draftSchemaLines: readonly string[]
  safetyInstructionLines: readonly string[]
  parseOutput: (
    output: string,
    promptInput: TPromptInput,
    options: { onJsonParseReport?: (report: SoftSemanticJsonParseReport) => void },
  ) => TOutput
  repairRawOutput?: (prompt: RpgInteractionPrompt, promptInput: TPromptInput) => Promise<string>
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined
  retryOptions: SoftSemanticRepairRetryRuntimeOptions | undefined
}

export async function parseSoftSemanticRawOutputWithOptionalRepairRetry<TPromptInput, TOutput>(
  input: SoftSemanticRawOutputRepairParseInput<TPromptInput, TOutput>,
): Promise<TOutput> {
  let initialJsonParseReport: SoftSemanticJsonParseReport | undefined
  try {
    return input.parseOutput(input.rawOutput, input.promptInput, {
      onJsonParseReport(report) {
        initialJsonParseReport = report
        addSoftSemanticJsonReportDebugSection(input.debugTraceSink, input.stepId, report)
      },
    })
  } catch (initialError) {
    const phase = classifyRpgRuntimeDebugErrorPhase(initialError)
    const initialDebugError = toRpgRuntimeDebugError(initialError, phase)
    if (!shouldAttemptSoftSemanticRepairRetry(initialDebugError, input.retryOptions, input.repairRawOutput)) {
      throw initialError
    }

    recordSoftSemanticRepairInitialFailureSection(input.debugTraceSink, input.stepId, initialDebugError)
    const repairPromptResult = buildSoftSemanticRepairRetryPrompt({
      stageKind: input.stageKind,
      stageLabel: input.stageLabel,
      failedOutput: input.rawOutput,
      errorSummary: {
        phase: initialDebugError.phase,
        origin: initialDebugError.origin,
        kind: initialDebugError.kind,
        category: initialDebugError.category,
        message: initialDebugError.message,
        name: initialDebugError.name,
      },
      draftSchemaLines: input.draftSchemaLines,
      safetyInstructionLines: input.safetyInstructionLines,
      jsonParseReport: initialJsonParseReport,
      maxFailedOutputChars: input.retryOptions?.maxFailedOutputChars,
    })

    let repairOutputChars = 0
    try {
      input.debugTraceSink?.setStepStatus(input.stepId, "streaming")
      const repairOutput = await input.repairRawOutput!(
        repairPromptResult.prompt,
        input.promptInput,
      )
      repairOutputChars = repairOutput.length
      addSoftSemanticRepairRawOutputDebugSection(input.debugTraceSink, input.stepId, repairOutput)
      input.debugTraceSink?.setStepStatus(input.stepId, "parsing")
      const repaired = input.parseOutput(repairOutput, input.promptInput, {
        onJsonParseReport(report) {
          addSoftSemanticJsonReportDebugSection(input.debugTraceSink, input.stepId, report)
        },
      })
      recordSoftSemanticRepairSummarySection(input.debugTraceSink, input.stepId, {
        promptSummary: repairPromptResult.summary,
        attempted: true,
        succeeded: true,
        outputChars: repairOutput.length,
      })
      input.debugTraceSink?.addStepWarnings(input.stepId, [`repair_retry_succeeded: ${input.stepId}`])
      return repaired
    } catch (repairError) {
      const repairDebugError = toRpgRuntimeDebugError(
        repairError,
        classifyRpgRuntimeDebugErrorPhase(repairError),
      )
      recordSoftSemanticRepairSummarySection(input.debugTraceSink, input.stepId, {
        promptSummary: repairPromptResult.summary,
        attempted: true,
        succeeded: false,
        outputChars: repairOutputChars,
        failureSummary: repairDebugError.message,
        failure: repairDebugError,
      })
      throw repairError
    }
  }
}

function shouldAttemptSoftSemanticRepairRetry(
  error: RpgRuntimeDebugError,
  options: SoftSemanticRepairRetryRuntimeOptions | undefined,
  repairRawOutput: unknown,
): boolean {
  if (!options?.enabled) return false
  if ((options.maxAttempts ?? 1) < 1) return false
  if (typeof repairRawOutput !== "function") return false
  if (error.category !== "mechanical_format") return false
  return error.kind === "json_extract_failed"
    || error.kind === "malformed_json"
    || error.kind === "loose_scalar_array"
    || error.kind === "loose_single_object_array"
    || error.kind === "null_optional_field"
}

function recordSoftSemanticRepairInitialFailureSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  error: RpgRuntimeDebugError,
): void {
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-repair-retry-initial-failure`,
    title: "修复专用重试初始失败",
    sourceKind: "validation",
    sourceLabel: "repair retry initial failure",
    value: {
      phase: error.phase,
      origin: error.origin,
      kind: error.kind,
      category: error.category,
      message: error.message,
      name: error.name,
    },
  })
}

function addSoftSemanticRepairRawOutputDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  rawOutput: string,
): void {
  debugTraceSink?.addStepSection(
    stepId,
    "validationSections",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-repair-retry-raw-output`,
      title: "修复专用重试输出",
      sourceKind: "llm_output",
      sourceLabel: "repairRawOutput",
      contentType: "text",
      content: rawOutput,
    }),
  )
}

function recordSoftSemanticRepairSummarySection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  input: {
    promptSummary: SoftSemanticRepairRetryPromptSummary
    attempted: boolean
    succeeded: boolean
    outputChars: number
    failureSummary?: string
    failure?: RpgRuntimeDebugError
  },
): void {
  debugTraceSink?.recordStepRepairRetry(stepId, {
    attempted: input.attempted,
    succeeded: input.succeeded,
    failureSummary: input.failureSummary,
  })
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-repair-retry-summary`,
    title: "修复专用重试摘要",
    sourceKind: "validation",
    sourceLabel: "repair retry summary",
    value: {
      attempted: input.attempted,
      succeeded: input.succeeded,
      failureSummary: input.failureSummary,
      promptChars: input.promptSummary.promptChars,
      outputChars: input.outputChars,
      truncated: input.promptSummary.truncated,
      promptSummary: input.promptSummary,
      failure: input.failure,
    },
  })
}

function failDebugStep(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  error: unknown,
  phase: RpgRuntimeDebugErrorPhase,
): void {
  recordDebugErrorSection(debugTraceSink, stepId, error, phase)
  debugTraceSink?.failStep(stepId, error, phase)
}

function addPromptDebugSections(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  prompt: RpgInteractionPrompt,
): void {
  if (prompt.debugSections?.length) {
    for (const section of prompt.debugSections) {
      debugTraceSink?.addStepSection(
        stepId,
        "promptSections",
        createRpgRuntimeDebugSection({
          sectionId: section.sectionId,
          title: section.title,
          sourceKind: section.sourceKind,
          sourceLabel: section.sourceLabel,
          contentType: section.contentType,
          content: section.content,
        }),
      )
    }
    return
  }

  debugTraceSink?.addStepSection(
    stepId,
    "promptSections",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-system-prompt`,
      title: "系统提示词",
      sourceKind: "fixed_prompt",
      sourceLabel: "systemPrompt",
      contentType: "text",
      content: prompt.systemPrompt,
    }),
  )
  debugTraceSink?.addStepSection(
    stepId,
    "promptSections",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-user-prompt`,
      title: "用户提示词",
      sourceKind: "runtime_handoff",
      sourceLabel: "userPrompt",
      contentType: "markdown",
      content: prompt.userPrompt,
    }),
  )
}

function addRawOutputDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  rawOutput: string,
): void {
  debugTraceSink?.addStepSection(
    stepId,
    "rawOutput",
    createRpgRuntimeDebugSection({
      sectionId: `${stepId}-raw-output`,
      title: "原始输出",
      sourceKind: "llm_output",
      sourceLabel: "adapter raw output",
      contentType: "text",
      content: rawOutput,
    }),
  )
}

function addParsedOutputDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  value: unknown,
): void {
  addDebugJsonSection(debugTraceSink, stepId, "parsedOutput", {
    sectionId: `${stepId}-parsed-output`,
    title: "解析后输出",
    sourceKind: "local_result",
    sourceLabel: "interaction parseOutput",
    value,
  })
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-parsed-output-summary`,
    title: "解析后输出摘要",
    sourceKind: "local_result",
    sourceLabel: "interaction parseOutput summary",
    value: summarizeParsedOutput(stepId, value),
  })
}

function addSoftSemanticJsonReportDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  report: SoftSemanticJsonParseReport,
): void {
  debugTraceSink?.recordStepLocalJsonRecovery(stepId, {
    operations: report.operations,
    changed: report.changed,
  })
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-soft-semantic-json-recovery`,
    title: "JSON 提取与本地修复",
    sourceKind: "validation",
    sourceLabel: "parseSoftSemanticJsonOutput",
    value: report,
  })

  if (report.changed || report.operations.length > 0) {
    debugTraceSink?.addStepWarnings(stepId, [
      `json_format_recovery: ${report.operations.length > 0 ? report.operations.join(", ") : "text_changed"}`,
    ])
  }
}

function addValidationDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  value: unknown,
): void {
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-validation`,
    title: "校验成功",
    sourceKind: "validation",
    sourceLabel: "runtime validator",
    value,
  })
}

function addValidationWarningsDebugSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  warnings: unknown,
  sourceLabel: string,
): void {
  if (!Array.isArray(warnings) || warnings.length === 0) return
  addDebugJsonSection(debugTraceSink, stepId, "validationSections", {
    sectionId: `${stepId}-validation-warnings-${slug(sourceLabel)}`,
    title: "校验警告",
    sourceKind: "validation",
    sourceLabel,
    value: { warnings },
  })
}

function addDebugJsonSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  area: "inputSections" | "parsedOutput" | "validationSections" | "handoffSections",
  input: {
    sectionId: string
    title: string
    sourceKind: "local_input_builder" | "local_result" | "runtime_handoff" | "validation" | "wiki_file"
    sourceLabel: string
    value: unknown
  },
): void {
  debugTraceSink?.addStepSection(
    stepId,
    area,
    createJsonRpgRuntimeDebugSection(input),
  )
}

interface WikiInputEvidence {
  path: string
  sectionId?: string
  readMode?: string
  sourceField?: string
  warnings: string[]
}

function addWikiInputSourcePathsSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  sourceLabel: string,
  value: unknown,
): void {
  const paths = collectWikiInputEvidence(value)
  const warnings = collectStringArrayFields(value, "warnings")
  if (paths.length === 0 && warnings.length === 0) return

  addDebugJsonSection(debugTraceSink, stepId, "inputSections", {
    sectionId: `${stepId}-wiki-input-source-paths-${slug(sourceLabel)}`,
    title: "Wiki Inputs / Source Paths",
    sourceKind: "wiki_file",
    sourceLabel,
    value: {
      paths,
      warnings,
    },
  })
}

function collectWikiInputEvidence(value: unknown): WikiInputEvidence[] {
  const evidence = new Map<string, WikiInputEvidence>()
  const seen = new WeakSet<object>()

  function add(input: WikiInputEvidence): void {
    const key = [input.path, input.sectionId ?? "", input.readMode ?? "", input.sourceField ?? ""].join("|")
    const existing = evidence.get(key)
    if (existing) {
      existing.warnings = [...new Set([...existing.warnings, ...input.warnings])]
      return
    }
    evidence.set(key, {
      ...input,
      warnings: [...new Set(input.warnings)],
    })
  }

  function visit(entry: unknown, sourceField?: string, parentPath?: string): void {
    if (typeof entry === "string") {
      const path = normalizeWikiEvidencePath(entry)
      if (path) add({ path, sourceField, warnings: [] })
      return
    }

    if (!entry || typeof entry !== "object") return
    if (seen.has(entry)) return
    seen.add(entry)

    if (Array.isArray(entry)) {
      for (const item of entry) visit(item, sourceField, parentPath)
      return
    }

    const record = entry as Record<string, unknown>
    const directPath = firstWikiPath(record.path, record.sourcePath, record.targetPath, parentPath)
    const directWarnings = stringArray(record.warnings)

    if (directPath) {
      const sections = Array.isArray(record.sections) ? record.sections : undefined
      const availableSections = Array.isArray(record.availableSections) ? record.availableSections : undefined
      if (sections?.length) {
        for (const section of sections) {
          if (!section || typeof section !== "object") continue
          const sectionRecord = section as Record<string, unknown>
          add({
            path: directPath,
            sectionId: stringValue(sectionRecord.sectionId),
            readMode: stringValue(sectionRecord.readMode) ?? stringValue(record.readMode),
            sourceField,
            warnings: [...directWarnings, ...stringArray(sectionRecord.warnings)],
          })
        }
      } else if (availableSections?.length) {
        for (const section of availableSections) {
          if (!section || typeof section !== "object") continue
          const sectionRecord = section as Record<string, unknown>
          add({
            path: directPath,
            sectionId: stringValue(sectionRecord.sectionId),
            readMode: stringArray(sectionRecord.readModes).join(", ") || stringValue(record.readMode),
            sourceField,
            warnings: directWarnings,
          })
        }
      } else {
        add({
          path: directPath,
          sectionId: stringValue(record.sectionId),
          readMode: stringValue(record.readMode),
          sourceField,
          warnings: directWarnings,
        })
      }
    }

    for (const [key, child] of Object.entries(record)) {
      if (key === "content") continue
      if (key.endsWith("Path") || key === "path" || key === "sourcePath" || key === "targetPath") {
        const path = normalizeWikiEvidencePath(child)
        if (path) {
          add({
            path,
            sectionId: stringValue(record.sectionId),
            readMode: stringValue(record.readMode),
            sourceField: key,
            warnings: directWarnings,
          })
          continue
        }
      }
      visit(child, key, directPath)
    }
  }

  visit(value)
  return [...evidence.values()].sort((a, b) =>
    [a.path, a.sectionId ?? "", a.readMode ?? "", a.sourceField ?? ""].join("|")
      .localeCompare([b.path, b.sectionId ?? "", b.readMode ?? "", b.sourceField ?? ""].join("|")),
  )
}

function collectStringArrayFields(value: unknown, fieldName: string): string[] {
  const result: string[] = []
  const seen = new WeakSet<object>()

  function visit(entry: unknown): void {
    if (!entry || typeof entry !== "object") return
    if (seen.has(entry)) return
    seen.add(entry)
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }

    const record = entry as Record<string, unknown>
    result.push(...stringArray(record[fieldName]))
    for (const child of Object.values(record)) visit(child)
  }

  visit(value)
  return [...new Set(result)]
}

function firstWikiPath(...values: unknown[]): string | undefined {
  for (const value of values) {
    const path = normalizeWikiEvidencePath(value)
    if (path) return path
  }
  return undefined
}

function normalizeWikiEvidencePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "")
  if (!normalized.startsWith("wiki/")) return undefined
  if (normalized.startsWith("wiki/runtime/")) return undefined
  if (normalized.includes("..")) return undefined
  return normalized
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : []
}

function recordDebugErrorSection(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  error: unknown,
  phase: RpgRuntimeDebugErrorPhase,
): void {
  const area = phase === "input_assembly" ? "inputSections" : "validationSections"
  const debugError = toRpgRuntimeDebugError(error, phase)
  addDebugJsonSection(debugTraceSink, stepId, area, {
    sectionId: `${stepId}-${phase}-error`,
    title: phase === "parse" ? "解析错误" : phase === "validation" ? "校验错误" : "错误",
    sourceKind: phase === "input_assembly" ? "local_input_builder" : "validation",
    sourceLabel: phase,
    value: {
      phase: debugError.phase,
      origin: debugError.origin,
      kind: debugError.kind,
      category: debugError.category,
      message: debugError.message,
      name: debugError.name,
    },
  })
}

function addStepWarningsFromValue(
  debugTraceSink: RpgRuntimeDebugTraceSink | undefined,
  stepId: RpgRuntimeDebugStepId,
  value: unknown,
): void {
  if (!value || typeof value !== "object" || !("warnings" in value)) return
  const warnings = (value as { warnings?: unknown }).warnings
  if (!Array.isArray(warnings)) return
  addValidationWarningsDebugSection(debugTraceSink, stepId, warnings, "output.warnings")
  debugTraceSink?.recordStepLooseCoercions(stepId, warnings)
  debugTraceSink?.addStepWarnings(stepId, warnings.map((warning) => (
    typeof warning === "string" ? warning : stringifyDebugJson(warning)
  )))
}

function summarizeParsedOutput(stepId: RpgRuntimeDebugStepId, value: unknown): unknown {
  if (!value || typeof value !== "object") return { stepId, valueKind: typeof value }
  const record = value as Record<string, unknown>

  if (stepId === "action_resolver") {
    return {
      resolutionId: record.resolutionId,
      submittedActionId: record.submittedActionId,
      eventStatus: (record.eventDraft as { status?: unknown } | undefined)?.status,
      directResultCount: Array.isArray(record.directResults) ? record.directResults.length : 0,
      referenceCount: Array.isArray(record.references) ? record.references.length : 0,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  if (stepId === "world_tick") {
    const worldDeltas = record.worldDeltas as Record<string, unknown[]> | undefined
    return {
      tickId: record.tickId,
      playerVisibleDeltaCount: Array.isArray(worldDeltas?.playerVisibleLine) ? worldDeltas.playerVisibleLine.length : 0,
      parallelDeltaCount: Array.isArray(worldDeltas?.parallelLine) ? worldDeltas.parallelLine.length : 0,
      tensionDeltaCount: Array.isArray(worldDeltas?.tensionLine) ? worldDeltas.tensionLine.length : 0,
      clockUpdateCount: Array.isArray(record.clockUpdates) ? record.clockUpdates.length : 0,
      reactionCount: Array.isArray(record.reactionQueue) ? record.reactionQueue.length : 0,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  if (stepId === "recall_selector") {
    const selectedItems = Array.isArray(record.selectedItems) ? record.selectedItems : []
    return {
      selectionId: record.selectionId,
      selectedItemCount: selectedItems.length,
      selectedSectionCount: selectedItems.reduce((total, item) => {
        const sections = item && typeof item === "object" ? (item as { sections?: unknown }).sections : undefined
        return total + (Array.isArray(sections) ? sections.length : 0)
      }, 0),
      exclusionCount: Array.isArray(record.exclusions) ? record.exclusions.length : 0,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  if (stepId === "outline_brief") {
    return {
      briefId: (record.outlineAwareNarrationBrief as { briefId?: unknown } | undefined)?.briefId,
      impactReportId: (record.outlineImpactReport as { reportId?: unknown } | undefined)?.reportId,
      impactLevel: (record.outlineImpactReport as { impactLevel?: unknown } | undefined)?.impactLevel,
      requiresRegeneration: (record.outlineImpactReport as { requiresRegeneration?: unknown } | undefined)?.requiresRegeneration,
      regenerationRequestId: (record.regenerationRequest as { requestId?: unknown } | undefined)?.requestId,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  if (stepId === "story_outline_regenerator") {
    return {
      patchId: (record.provisionalOutlinePatch as { patchId?: unknown } | undefined)?.patchId,
      narrationHandoffId:
        ((record.provisionalOutlinePatch as { narrationHandoff?: { handoffId?: unknown } } | undefined)
          ?.narrationHandoff?.handoffId),
      outlineRevisionProposalId: (record.outlineRevisionProposal as { proposalId?: unknown } | undefined)?.proposalId,
      safetyConclusion: (record.regenerationSafetyReport as { safetyConclusion?: unknown } | undefined)?.safetyConclusion,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  if (stepId === "narration_generator") {
    return {
      narrationId: (record.narrationMeta as { narrationId?: unknown } | undefined)?.narrationId,
      playerFacingTextChars: typeof record.playerFacingText === "string" ? record.playerFacingText.length : 0,
      hasParallelLineText: typeof record.parallelLineText === "string" && record.parallelLineText.trim().length > 0,
      nextActionOptionCount: Array.isArray(record.nextActionOptions) ? record.nextActionOptions.length : 0,
      warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
    }
  }

  return {
    stepId,
    topLevelKeys: Object.keys(record),
    warningCount: Array.isArray(record.warnings) ? record.warnings.length : 0,
  }
}

function summarizeWorldTickHandoff(
  visibleSelection: WorldTickVisibleSelection,
  postActionWorkingState: PostActionWorkingState,
): unknown {
  return {
    visibleSelection: {
      currentSceneVisibleCandidates: visibleSelection.currentSceneVisibleCandidates.length,
      parallelLensCandidates: visibleSelection.parallelLensCandidates.length,
      tensionCandidates: visibleSelection.tensionCandidates.length,
      notes: visibleSelection.notes,
    },
    postActionWorkingState: {
      submittedActionId: postActionWorkingState.submittedAction.id,
      campaignDelta: postActionWorkingState.campaignDelta,
      referenceCount: postActionWorkingState.references.length,
      runtimeRefCount: postActionWorkingState.runtimeDeltaRefs.length,
      warnings: postActionWorkingState.warnings,
    },
  }
}

function summarizeRecallHandoff(value: unknown): unknown {
  const handoff = value as { recallSelection?: RecallSelection; recalledMaterials?: RecalledMaterial[]; warnings?: string[] }
  return {
    selectionId: handoff.recallSelection?.selectionId,
    recalledMaterialCount: handoff.recalledMaterials?.length ?? 0,
    recalledPaths: handoff.recalledMaterials?.map((material) => ({
      path: material.path,
      sectionIds: material.sections.map((section) => section.sectionId),
      readMode: material.readMode,
      warnings: material.warnings,
    })) ?? [],
    warnings: handoff.warnings ?? [],
  }
}

function summarizeOutlineBriefHandoff(output: {
  outlineAwareNarrationBrief: OutlineAwareNarrationBrief
  outlineImpactReport: OutlineImpactReport
  regenerationRequest?: RegenerationRequest
  warnings: string[]
}): unknown {
  return {
    outlineAwareNarrationBrief: {
      briefId: output.outlineAwareNarrationBrief.briefId,
      playerFacingReferenceCount: output.outlineAwareNarrationBrief.playerFacingBrief.allowedKnowledge.length,
      parallelReferenceCount: output.outlineAwareNarrationBrief.parallelLineBrief.allowedParallelKnowledge.length,
      forbiddenNarrationBoundaryCount: output.outlineAwareNarrationBrief.forbiddenNarrationBoundary.length,
    },
    outlineImpactReport: {
      reportId: output.outlineImpactReport.reportId,
      impactLevel: output.outlineImpactReport.impactLevel,
      requiresRegeneration: output.outlineImpactReport.requiresRegeneration,
      affectedBeatCount: output.outlineImpactReport.affected.beats.length,
    },
    regenerationRequest: output.regenerationRequest
      ? {
          requestId: output.regenerationRequest.requestId,
          impactLevel: output.regenerationRequest.impactLevel,
          affectedLines: output.regenerationRequest.affectedLines,
        }
      : undefined,
    warnings: output.warnings,
  }
}

function summarizeStoryOutlineRegeneratorHandoff(output: StoryOutlineRegeneratorOutput): unknown {
  return {
    provisionalOutlinePatch: {
      patchId: output.provisionalOutlinePatch.patchId,
      scope: output.provisionalOutlinePatch.scope,
      narrationHandoffId: output.provisionalOutlinePatch.narrationHandoff.handoffId,
      sameTurnOnly: output.provisionalOutlinePatch.nonPersistenceBoundary.sameTurnOnly,
      writesToWiki: output.provisionalOutlinePatch.nonPersistenceBoundary.writesToWiki,
    },
    outlineRevisionProposal: {
      proposalId: output.outlineRevisionProposal.proposalId,
      reviewItemKind: output.outlineRevisionProposal.reviewItemKind,
      ordinaryRuntimeUpdate: output.outlineRevisionProposal.reviewBoundary.ordinaryRuntimeUpdate,
      autoWriteMainOutline: output.outlineRevisionProposal.reviewBoundary.autoWriteMainOutline,
    },
    regenerationSafetyReport: {
      safetyConclusion: output.regenerationSafetyReport.safetyConclusion,
      noWikiWrite: output.regenerationSafetyReport.noWikiWrite,
      warningCount: output.regenerationSafetyReport.warnings.length,
    },
    warnings: output.warnings,
  }
}

function summarizeNarrationHandoff(turnResult: RpgTurnResult, turnRecord: RpgTurnRecord): unknown {
  return {
    turnResult: {
      narrativeChars: turnResult.narrative.length,
      actionOptionCount: turnResult.nextActionOptions.length,
      referenceCount: turnResult.references.length,
    },
    turnRecord: {
      submittedActionId: turnRecord.submittedAction.id,
      generatedNarrativeChars: turnRecord.generatedNarrative.length,
      referenceCount: turnRecord.references.length,
      hasProvisionalOutlinePatch: Boolean(turnRecord.provisionalOutlinePatch),
      hasOutlineRevisionProposal: Boolean(turnRecord.outlineRevisionProposal),
    },
  }
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "section"
}
