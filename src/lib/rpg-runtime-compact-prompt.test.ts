import { describe, expect, it } from "vitest"
import {
  narrationGeneratorInteractionSpec,
  outlineBriefInteractionSpec,
  recallSelectorInteractionSpec,
  storyOutlineRegeneratorInteractionSpec,
} from "./rpg-interactions/runtime"
import {
  buildOutlineBriefCompilerInputFromTurnState,
  buildStoryOutlineRegeneratorInputFromTurnState,
} from "./rpg-runtime"
import {
  sampleMajorOutlineBriefOutput,
  sampleRecalledMaterials,
  sampleRecallSelection,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"
import type { NarrationGeneratorInput } from "./rpg-runtime/types"

describe("compact semantic handoff prompt boundaries", () => {
  it("does not expand full canonical objects in downstream non-writeback prompts", () => {
    const submittedAction = {
      id: "act-compact-prompt",
      text: "Ask Mira to inspect the canal gate sigil.",
      source: "freeform" as const,
    }
    const recalledMaterials = sampleRecalledMaterials()
    const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, {
      recalledMaterials,
      outlineBriefOutput: sampleMajorOutlineBriefOutput(submittedAction),
    })
    const recallInput = {
      turnSemanticHandoff: runtimeParts.turnSemanticHandoff,
      postActionWorkingState: runtimeParts.postActionWorkingState,
      actionResolution: runtimeParts.actionResolution,
      worldTickResult: runtimeParts.worldTickResult,
      visibleSelection: runtimeParts.visibleSelection,
      retrievalIndex: [
        {
          path: "wiki/current-scene/scene_state.md",
          summary: "Current scene",
          lineTargets: ["playerVisibleLine" as const],
          visibilityScope: "pc_visible" as const,
          knowledgeScope: "pc_known" as const,
          availableSections: [
            {
              sectionId: "slot.current_scene",
              sectionRole: "schema_slot",
              heading: "current_scene",
              aliases: [],
              lineTargets: ["playerVisibleLine" as const],
              readModes: ["summary" as const],
              visibilityScope: "pc_visible" as const,
              knowledgeScope: "pc_known" as const,
            },
          ],
        },
      ],
      recallBudget: runtimeParts.recallSelection.recallBudget,
      recallPolicy: runtimeParts.recallSelection.recallPolicy,
    }
    const recallSelection = sampleRecallSelection()
    const outlineInput = buildOutlineBriefCompilerInputFromTurnState({
      ...runtimeParts,
      recallSelection,
      recalledMaterials,
    })
    const storyInput = buildStoryOutlineRegeneratorInputFromTurnState({
      outlineBriefInput: outlineInput,
      outlineImpactReport: runtimeParts.outlineImpactReport,
      regenerationRequest: runtimeParts.regenerationRequest!,
    })
    const narrationInput: NarrationGeneratorInput = {
      ...runtimeParts,
      recallSelection,
      recalledMaterials,
      styleBundle: {
        bundleId: "style",
        toneRules: [],
        dictionRules: [],
        pacingRules: [],
        forbiddenStyleMoves: [],
        sourceRefs: [],
        styleIsNotWorldFact: true as const,
        styleIsNotPlotFact: true as const,
      },
      forbiddenNarrationConstraints: [],
      playerKnowledgeBoundary: {
        boundaryId: "player-knowledge-boundary-narration-generator",
        pcKnowledgePath: "wiki/player/known_information.md" as const,
        allowedKnowledgeRefs: [],
        forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
        parallelLineDoesNotGrantPcKnowledge: true as const,
        showParallelLineDoesNotGrantPcKnowledge: true as const,
        notes: [],
      },
      references: [],
      runtimeRefs: runtimeParts.postActionWorkingState.runtimeDeltaRefs,
    }

    const prompts = [
      recallSelectorInteractionSpec.buildPrompt(recallInput),
      outlineBriefInteractionSpec.buildPrompt(outlineInput),
      storyOutlineRegeneratorInteractionSpec.buildPrompt(storyInput),
      narrationGeneratorInteractionSpec.buildPrompt(narrationInput),
    ]

    for (const prompt of prompts) {
      const sectionIds = (prompt.debugSections ?? []).map((section) => section.sectionId)
      expect(sectionIds.some((id) => id.endsWith("turn-semantic-handoff"))).toBe(true)
      expect(sectionIds).not.toContain("recall-selector-action-resolution")
      expect(sectionIds).not.toContain("recall-selector-world-tick-result")
      expect(sectionIds).not.toContain("outline-brief-action-resolution")
      expect(sectionIds).not.toContain("outline-brief-world-tick-result")
      expect(sectionIds).not.toContain("narration-generator-action-resolution")
      expect(sectionIds).not.toContain("narration-generator-world-tick-result")
      expect(sectionIds).not.toContain("story-outline-regenerator-post-action-working-state")
    }
  })
})
