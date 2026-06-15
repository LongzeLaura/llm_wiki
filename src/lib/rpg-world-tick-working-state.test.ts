import { describe, expect, it } from "vitest"
import { RPG_SCHEMA_SLOTS } from "./rpg-wiki-schema"
import { sampleActionResolution, sampleWorldTickResult } from "./rpg-runtime-test-fixtures"
import {
  buildPostActionWorkingState,
  buildWorldTickSemanticHandoff,
  selectWorldTickVisibleContent,
  type SubmittedAction,
} from "./rpg-runtime"

describe("RPG World Tick working state", () => {
  it("selects player-visible, parallel-lens, and tension candidates without granting PC knowledge from parallelLine", () => {
    const submittedAction: SubmittedAction = {
      id: "turn-working-state",
      text: "Wait while Mira studies the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)

    const selection = selectWorldTickVisibleContent({ actionResolution, worldTickResult })

    expect(selection.currentSceneVisibleCandidates.map((candidate) => candidate.source)).toEqual([
      "actionResolution.directResult",
      "worldTick.playerVisibleLine",
    ])
    expect(selection.currentSceneVisibleCandidates.every((candidate) => candidate.narrativeLine === "playerVisibleLine")).toBe(
      true,
    )
    expect(selection.parallelLensCandidates).toEqual([
      expect.objectContaining({
        source: "worldTick.parallelLine",
        sourceId: "world-delta-watch-captain-order",
        visibilityScope: "user_visible_pc_unknown",
        grantsPcKnowledge: false,
        pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
      }),
    ])
    expect(JSON.stringify(selection.parallelLensCandidates)).not.toContain("pc_known")
    expect(selection.tensionCandidates.map((candidate) => candidate.source)).toEqual([
      "worldTick.tensionLine",
      "worldTick.pacingUpdate",
      "worldTick.gapState",
    ])
  })

  it("builds post-action working state by merging refs, warnings, runtime delta refs, pacing, and gap state", () => {
    const submittedAction: SubmittedAction = {
      id: "turn-working-state-merge",
      text: "Ask Mira to keep reading while I listen for patrol steps.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    actionResolution.warnings = [
      {
        code: "action-note",
        message: "The action has an explicit uncertainty.",
        severity: "info",
      },
    ]
    const worldTickResult = sampleWorldTickResult(actionResolution)
    worldTickResult.warnings = [
      {
        code: "world-note",
        message: "The patrol movement remains approximate.",
        severity: "warning",
      },
    ]

    const workingState = buildPostActionWorkingState({ submittedAction, actionResolution, worldTickResult })

    expect(workingState.submittedAction).toEqual(submittedAction)
    expect(workingState.actionResolution).toBe(actionResolution)
    expect(workingState.worldTickResult).toBe(worldTickResult)
    expect(workingState.timeState.actionTimeDelta).toBe(actionResolution.timeDelta)
    expect(workingState.timeState.worldTickTimeAdvance).toBe(worldTickResult.timeAdvance)
    expect(workingState.campaignDelta).toBe("The patrol clock and Mira's warning both move the gate scene forward.")
    expect(workingState.pacingState).toBe(worldTickResult.pacingUpdate)
    expect(workingState.gapState).toBe(worldTickResult.gapState)
    expect(workingState.runtimeDeltaRefs.map((ref) => ref.deltaId)).toEqual([
      actionResolution.runtimeDeltaRefs[0].deltaId,
      "patrol-countdown-advance",
      "watch-captain-order",
      "gap-sigil-delay",
    ])
    expect(workingState.references).toEqual([
      "wiki/current-scene/scene_state.md",
      "wiki/factions/runtime/harbor-watch.md",
      "wiki/rules/core.md",
    ])
    expect(workingState.warnings.join("\n")).toContain("Action Resolver info action-note")
    expect(workingState.warnings.join("\n")).toContain("World Tick warning world-note")
  })

  it("records a warning when World Tick returns an empty campaignDelta", () => {
    const submittedAction: SubmittedAction = {
      id: "turn-working-state-empty-delta",
      text: "Wait in silence.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)
    worldTickResult.pacingUpdate = {
      ...worldTickResult.pacingUpdate,
      campaignDelta: "   ",
    }

    const workingState = buildPostActionWorkingState({ submittedAction, actionResolution, worldTickResult })

    expect(workingState.campaignDelta).toBe("")
    expect(workingState.warnings.join("\n")).toContain("missing_campaign_delta")
  })

  it("builds a compact semantic handoff without replacing the canonical WorldTickResult", () => {
    const submittedAction: SubmittedAction = {
      id: "turn-working-state-semantic-handoff",
      text: "Wait while Mira studies the canal gate sigil.",
      source: "freeform",
    }
    const actionResolution = sampleActionResolution(submittedAction)
    const worldTickResult = sampleWorldTickResult(actionResolution)
    const visibleSelection = selectWorldTickVisibleContent({ actionResolution, worldTickResult })
    const postActionWorkingState = buildPostActionWorkingState({
      submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
    })

    const handoff = buildWorldTickSemanticHandoff({
      submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
    })

    expect(handoff.submittedActionId).toBe(submittedAction.id)
    expect(handoff.actionSummary).toBe(actionResolution.eventDraft.summary)
    expect(handoff.timeAdvanceSummary).toBe(worldTickResult.timeAdvance.appliedSummary)
    expect(handoff.confirmed.map((entry) => entry.source)).toEqual(
      expect.arrayContaining([
        "worldTick.playerVisibleLine",
        "worldTick.parallelLine",
        "worldTick.informationBroadcast",
        "worldTick.reactionQueue",
      ]),
    )
    expect(handoff.ongoing.map((entry) => entry.source)).toEqual(
      expect.arrayContaining([
        "worldTick.tensionLine",
        "worldTick.clockUpdate",
        "worldTick.settledOngoingEvent",
        "worldTick.pacingUpdate",
      ]),
    )
    expect(handoff.possibleFuture).toEqual([
      expect.objectContaining({ source: "worldTick.gapState", sourceId: worldTickResult.gapState.gapSignalId }),
    ])
    expect(handoff.pcVisible.map((entry) => entry.sourceId)).toEqual(
      visibleSelection.currentSceneVisibleCandidates.map((candidate) => candidate.sourceId),
    )
    expect(handoff.userVisiblePcUnknown).toEqual([
      expect.objectContaining({ source: "worldTick.parallelLine", sourceId: "world-delta-watch-captain-order" }),
    ])
    expect(handoff.tensionAndGap.map((entry) => entry.source)).toEqual(
      expect.arrayContaining(["worldTick.tensionLine", "worldTick.pacingUpdate", "worldTick.gapState"]),
    )
    expect(handoff.candidatePaths).toEqual(postActionWorkingState.references)
  })

  it("does not add a normal runtime wiki category or alter schema slots", () => {
    expect(RPG_SCHEMA_SLOTS.map((slot) => slot.slotId)).not.toContain("runtime")
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
  })
})
