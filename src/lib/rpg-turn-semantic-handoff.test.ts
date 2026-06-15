import { describe, expect, it } from "vitest"
import {
  sampleActionResolution,
  samplePostActionWorkingState,
  sampleTurnSemanticHandoff,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"

describe("TurnSemanticHandoff", () => {
  it("builds a bounded compact handoff with semantic separation", () => {
    const actionResolution = sampleActionResolution()
    const worldTickResult = sampleWorldTickResult(actionResolution)
    const visibleSelection = sampleVisibleSelection(actionResolution, worldTickResult)
    const postActionWorkingState = samplePostActionWorkingState(
      { id: "act-1", text: "Ask Mira to inspect the sigil.", source: "freeform" },
      actionResolution,
      worldTickResult,
      visibleSelection,
    )

    const handoff = sampleTurnSemanticHandoff(
      postActionWorkingState.submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
      postActionWorkingState,
    )

    expect(JSON.stringify(handoff).length).toBeLessThanOrEqual(6000)
    expect(handoff.confirmed.some((entry) => entry.happenedStatus === "confirmed_happened")).toBe(true)
    expect(handoff.attemptedOrBlocked.some((entry) => entry.happenedStatus === "attempted_not_confirmed")).toBe(true)
    expect(handoff.possibleFuture.some((entry) => entry.happenedStatus === "possible_future")).toBe(true)
    expect(handoff.pcVisible.every((entry) => entry.affectedPaths.every((path) => path.startsWith("wiki/")))).toBe(true)
    expect(handoff.userVisiblePcUnknown.length).toBeGreaterThan(0)
    expect(new Set(handoff.referenceAllowlist.map((entry) => entry.path)).size).toBe(handoff.referenceAllowlist.length)
    expect(handoff.referenceAllowlist.length).toBeLessThanOrEqual(16)
  })
})
