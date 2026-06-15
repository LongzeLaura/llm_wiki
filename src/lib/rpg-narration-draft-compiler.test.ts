import { describe, expect, it } from "vitest"
import { compileTurnNarrationDraftOutput } from "./rpg-interactions/runtime"
import { validateTurnNarration } from "./rpg-interactions/runtime/narration-generator-validation"
import {
  sampleRecalledMaterials,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"
import type { NarrationGeneratorInput } from "./rpg-runtime/types"

function input(): NarrationGeneratorInput {
  const submittedAction = {
    id: "act-narration-draft",
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform" as const,
  }
  const recalledMaterials = sampleRecalledMaterials()
  const parts = sampleTurnRecordRuntimeParts(submittedAction, { recalledMaterials })
  const visibleRef = {
    path: "wiki/current-scene/scene_state.md",
    sectionId: "slot.current_scene",
    lineTarget: "playerVisibleLine" as const,
    usePurpose: "narration" as const,
    visibilityScope: "pc_visible" as const,
    knowledgeScope: "pc_known" as const,
    reason: "Visible scene source.",
  }

  return {
    postActionWorkingState: parts.postActionWorkingState,
    actionResolution: parts.actionResolution,
    worldTickResult: parts.worldTickResult,
    visibleSelection: parts.visibleSelection,
    turnSemanticHandoff: parts.turnSemanticHandoff,
    recallSelection: parts.recallSelection,
    recalledMaterials,
    outlineAwareNarrationBrief: parts.outlineAwareNarrationBrief,
    styleBundle: {
      bundleId: "style-bundle-test",
      toneRules: ["Use concrete table narration."],
      dictionRules: ["Keep prose observable."],
      pacingRules: ["Move the scene forward."],
      forbiddenStyleMoves: ["Do not reveal hidden truth."],
      sourceRefs: [visibleRef],
      styleIsNotWorldFact: true,
      styleIsNotPlotFact: true,
    },
    forbiddenNarrationConstraints: [
      {
        constraintId: "hidden-patron",
        lineTarget: "playerVisibleLine",
        visibilityScope: "gm_only",
        knowledgeScope: "gm_only",
        mustNotReveal: ["The hidden patron is beneath the canal."],
        reason: "Protect hidden reveal.",
      },
    ],
    playerKnowledgeBoundary: {
      boundaryId: "player-knowledge-boundary-narration-generator",
      pcKnowledgePath: "wiki/player/known_information.md",
      allowedKnowledgeRefs: [visibleRef],
      forbiddenVisibilityScopes: ["user_visible_pc_unknown", "gm_only", "hidden"],
      parallelLineDoesNotGrantPcKnowledge: true,
      showParallelLineDoesNotGrantPcKnowledge: true,
      notes: ["Parallel line display is not PC knowledge."],
    },
    references: [visibleRef],
    runtimeRefs: parts.postActionWorkingState.runtimeDeltaRefs,
  }
}

function draft() {
  return {
    playerFacingText: "Mira studies the cracked mark and points to the safe edge of the sigil.",
    parallelLineText: "Above the canal, the watch captain delays the lower sweep.",
    tensionBrief: {
      summary: "Patrol pressure and Mira's trust remain active.",
      reviewHandoff: "Keep this as runtime/review context.",
    },
    nextActionOptions: [
      { playerFacingText: "Touch the lantern key to the safe edge.", intent: "use_item", riskLevel: "medium" },
      { playerFacingText: "Ask Mira what the safe edge means.", intent: "talk", riskLevel: "low" },
      { playerFacingText: "Wait and listen for patrol movement.", intent: "wait", riskLevel: "medium" },
    ],
    warnings: [],
  }
}

describe("TurnNarrationDraft compiler", () => {
  it("generates canonical narration metadata, refs, and option protocol", () => {
    const compiled = validateTurnNarration(compileTurnNarrationDraftOutput(draft(), input()), input())

    expect(compiled.narrationMeta.narrationId).toBe("turn-narration-act-narration-draft")
    expect(compiled.displayPolicy.parallelLineGrantsPcKnowledge).toBe(false)
    expect(compiled.nextActionOptions.map((option) => option.id)).toEqual([
      "next-action-act-narration-draft-1",
      "next-action-act-narration-draft-2",
      "next-action-act-narration-draft-3",
    ])
    expect(compiled.nextActionOptions.every((option) => option.optionOnly)).toBe(true)
    expect(compiled.nextActionOptions.every((option) => option.likelyAffectedPaths.length === 0)).toBe(true)
    expect(compiled.narrationMeta.followedPacingIntent).toBe("not_applicable")
    expect(compiled.tensionBrief.pressureSignals).toEqual([])
    expect(compiled.tensionBrief.relationshipSignals).toEqual([])
    expect(compiled.tensionBrief.plotArcSignals).toEqual([])
    expect(compiled.references).toHaveLength(1)
  })

  it("rejects player-facing prose that contains a forbidden reveal", () => {
    expect(() =>
      compileTurnNarrationDraftOutput({
        ...draft(),
        playerFacingText: "The hidden patron is beneath the canal.",
      }, input()),
    ).toThrow(/leaks forbidden/)
  })

  it("strips derivable option and narration protocol fields", () => {
    const noisyDraft = {
      ...draft(),
      narrationMeta: { narrationId: "model-authored" },
      displayPolicy: { showPlayerFacingText: false },
      nextActionOptions: draft().nextActionOptions.map((option, index) => ({
        ...option,
        id: `model-option-${index}`,
        sourceRefs: [{ path: "wiki/current-scene/scene_state.md" }],
        optionOnly: false,
        happenedStatus: "confirmed_happened",
      })),
    }

    const compiled = compileTurnNarrationDraftOutput(noisyDraft, input())

    expect(compiled.narrationMeta.narrationId).toBe("turn-narration-act-narration-draft")
    expect(compiled.nextActionOptions[0]).toMatchObject({
      id: "next-action-act-narration-draft-1",
      optionOnly: true,
      happenedStatus: "possible_future",
    })
    expect(compiled.warnings.some((warning) => warning.includes("derivable draft protocol"))).toBe(true)
  })

  it("coerces loose warning, tension signal, and likely path string-array shapes", () => {
    const looseDraft = draft()
    ;(looseDraft as Record<string, unknown>).warnings = "Narration draft emitted one plain warning."
    looseDraft.tensionBrief = {
      ...(looseDraft.tensionBrief as Record<string, unknown>),
      pressureSignals: "The patrol clock is tighter." as unknown as string[],
      relationshipSignals: ["  Mira notices the wait.  ", " "],
    } as unknown as typeof looseDraft.tensionBrief
    looseDraft.nextActionOptions[0] = {
      ...(looseDraft.nextActionOptions[0] as Record<string, unknown>),
      likelyAffectedPaths: ["  wiki/current-scene/scene_state.md  ", " "],
    } as unknown as typeof looseDraft.nextActionOptions[number]

    const compiled = validateTurnNarration(compileTurnNarrationDraftOutput(looseDraft, input()), input())

    expect(compiled.warnings).toContain("Narration draft emitted one plain warning.")
    expect(compiled.warnings.some((warning) => warning.includes("loose_draft_coercion"))).toBe(true)
    expect(compiled.tensionBrief.pressureSignals).toEqual(["The patrol clock is tighter."])
    expect(compiled.tensionBrief.relationshipSignals).toEqual(["Mira notices the wait."])
    expect(compiled.nextActionOptions[0].likelyAffectedPaths).toEqual(["wiki/current-scene/scene_state.md"])
  })

  it("does not let a single nextActionOptions object bypass the canonical option count validator", () => {
    const singleOptionDraft = {
      ...draft(),
      nextActionOptions: draft().nextActionOptions[0],
    }
    const ctx = input()
    const compiled = compileTurnNarrationDraftOutput(singleOptionDraft, ctx)

    expect(compiled.nextActionOptions).toHaveLength(1)
    expect(compiled.warnings.some((warning) => warning.includes("TurnNarrationDraft.nextActionOptions"))).toBe(true)
    expect(() => validateTurnNarration(compiled, ctx)).toThrow(/3 to 5/)
  })

  it("still rejects forbidden write fields and invalid action option enums", () => {
    expect(() =>
      compileTurnNarrationDraftOutput({
        ...draft(),
        wikiWrites: [],
      }, input()),
    ).toThrow(/forbidden/)

    const invalidIntentDraft = draft()
    invalidIntentDraft.nextActionOptions[0] = {
      ...invalidIntentDraft.nextActionOptions[0],
      intent: "sing" as never,
    }

    expect(() => validateTurnNarration(compileTurnNarrationDraftOutput(invalidIntentDraft, input()), input())).toThrow(
      /intent/i,
    )

    const invalidRiskDraft = draft()
    invalidRiskDraft.nextActionOptions[0] = {
      ...(invalidRiskDraft.nextActionOptions[0] as Record<string, unknown>),
      likelyAffectedPaths: "wiki/current-scene/scene_state.md" as unknown as string[],
      riskLevel: "dangerous" as never,
    } as unknown as typeof invalidRiskDraft.nextActionOptions[number]

    expect(() => validateTurnNarration(compileTurnNarrationDraftOutput(invalidRiskDraft, input()), input())).toThrow(
      /riskLevel/i,
    )
  })
})
