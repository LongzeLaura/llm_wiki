import { describe, expect, it } from "vitest"
import { compileActionResolutionDraftOutput } from "./rpg-interactions/runtime"
import { validateActionResolution } from "./rpg-interactions/runtime/action-resolver-validation"

const input = {
  submittedAction: {
    id: "act-draft",
    text: "Ask Mira to inspect the canal gate sigil.",
    source: "freeform" as const,
  },
  preActionSnapshot: {} as never,
  relevantRules: [],
  fixedSlotRefs: [],
  runtimeRefs: [],
}

function draft() {
  return {
    parsedIntent: {
      intentKind: "investigate",
      actorRef: "player:Iven",
      targetRefs: ["character:Mira"],
      actionScope: "Ask Mira to inspect the canal gate sigil.",
      declaredGoal: "Learn whether the sigil is safe.",
      ambiguityNotes: [],
    },
    eventDraft: {
      eventType: "investigation_attempt",
      summary: "Iven asks Mira to inspect the sigil before touching it.",
      actorRefs: ["player:Iven"],
      targetRefs: ["character:Mira"],
      affectedRefs: ["wiki/current-scene/scene_state.md"],
      riskSummary: "The patrol clock may tighten while they wait.",
      requiredChecks: [],
      ambiguityNotes: [],
    },
    feasibility: {
      status: "partially_feasible",
      rationale: "Mira can inspect it, but the cracked line limits certainty.",
      limitingFactors: [],
      requiredChecks: [],
      alternativeResults: [],
    },
    costs: [],
    obstacles: [],
    directResults: [
      {
        summary: "The sigil inspection begins; success is not yet confirmed.",
        happenedStatus: "attempted_not_confirmed",
        visibilityScope: "pc_visible",
        affectedRefs: ["wiki/current-scene/scene_state.md"],
      },
    ],
    timeDelta: {
      scale: "minutes",
      unit: "minutes",
      min: 2,
      max: 5,
      summary: "A few focused minutes pass.",
      reasoning: "Mira needs time to inspect the cracked mark.",
    },
    progressPotential: {
      level: "medium",
      summary: "The action may reveal a safer way to use the key.",
      possibleUnlocks: [],
      gapTriggerPotential: "minor",
    },
    playerActionDelta: {
      positionChanges: [],
      resourceChanges: [],
      inventoryChanges: [],
      conditionChanges: [],
      knowledgeChanges: [],
      relationshipSignals: [],
      sceneChanges: [],
      interruptedEvents: [],
      exposedInformation: [],
      notes: [],
    },
    referencePaths: ["wiki/current-scene/scene_state.md"],
    warnings: ["Target identity is still somewhat ambiguous."],
  }
}

describe("ActionResolutionDraft compiler", () => {
  it("generates canonical ids and runtime refs without promoting default status", () => {
    const compiled = validateActionResolution(compileActionResolutionDraftOutput(draft(), input))

    expect(compiled.resolutionId).toBe("action-resolution-act-draft")
    expect(compiled.eventDraft.eventId).toBe("event-draft-act-draft")
    expect(compiled.eventDraft.status).toBe("attempted_not_confirmed")
    expect(compiled.runtimeDeltaRefs).toHaveLength(1)
    expect(compiled.references).toEqual([
      expect.objectContaining({
        path: "wiki/current-scene/scene_state.md",
        reason: "Referenced by ActionResolutionDraft.referencePaths[0].",
        usePurpose: "actionResolution",
      }),
    ])
    expect(compiled.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "draft_warning_1",
        message: "Target identity is still somewhat ambiguous.",
        severity: "warning",
      }),
    ]))
    expect(compiled.playerActionDelta.runtimeDeltaRefs[0]).toMatchObject({
      sourceStage: "actionResolution",
      happenedStatus: "attempted_not_confirmed",
    })
  })

  it("strips derivable protocol fields in the draft", () => {
    const compiled = compileActionResolutionDraftOutput({
      ...draft(),
      resolutionId: "model-authored-id",
      runtimeDeltaRefs: ["model-authored-ref"],
    }, input)

    expect(compiled.resolutionId).toBe("action-resolution-act-draft")
    expect(compiled.runtimeDeltaRefs[0].deltaId).toBe("player-action-delta-act-draft")
    expect(compiled.warnings.map((warning) => warning.code)).toContain("derivable_protocol_stripped")
  })

  it("still rejects dangerous writeback fields in the draft", () => {
    expect(() =>
      compileActionResolutionDraftOutput({
        ...draft(),
        wikiWrites: [],
      }, input),
    ).toThrow(/forbidden safety key/)
  })

  it("coerces the trace-derived playerActionDelta.notes string into a warning-backed single item array", () => {
    const traceDerivedDraft = draft()
    traceDerivedDraft.playerActionDelta = {
      ...traceDerivedDraft.playerActionDelta,
      notes: "No wiki write, narration, world tick, or reaction queue is included.",
    } as unknown as typeof traceDerivedDraft.playerActionDelta

    const compiled = validateActionResolution(compileActionResolutionDraftOutput(traceDerivedDraft, input))

    expect(compiled.playerActionDelta.notes).toEqual([
      "No wiki write, narration, world tick, or reaction queue is included.",
    ])
    expect(compiled.warnings).toContainEqual(expect.objectContaining({
      code: "loose_draft_coercion",
      message: expect.stringContaining("ActionResolutionDraft.playerActionDelta.notes"),
      severity: "warning",
    }))
  })

  it("defaults missing optional string arrays and trims blank string entries", () => {
    const looseDraft = draft()
    delete (looseDraft.parsedIntent as Record<string, unknown>).ambiguityNotes
    looseDraft.playerActionDelta = {
      ...looseDraft.playerActionDelta,
      positionChanges: ["  moves beside Mira  ", " ", "\t"],
    } as unknown as typeof looseDraft.playerActionDelta

    const compiled = validateActionResolution(compileActionResolutionDraftOutput(looseDraft, input))

    expect(compiled.parsedIntent.ambiguityNotes).toEqual([])
    expect(compiled.playerActionDelta.positionChanges).toEqual(["moves beside Mira"])
    expect(compiled.warnings.map((warning) => warning.code)).toContain("loose_draft_coercion")
  })

  it("does not record loose recovery when optional arrays are omitted", () => {
    const sparseDraft = draft()
    delete (sparseDraft.parsedIntent as Record<string, unknown>).targetRefs
    delete (sparseDraft.parsedIntent as Record<string, unknown>).ambiguityNotes
    delete (sparseDraft.eventDraft as Record<string, unknown>).actorRefs
    delete (sparseDraft.eventDraft as Record<string, unknown>).targetRefs
    delete (sparseDraft.eventDraft as Record<string, unknown>).affectedRefs
    delete (sparseDraft.eventDraft as Record<string, unknown>).requiredChecks
    delete (sparseDraft.eventDraft as Record<string, unknown>).ambiguityNotes
    sparseDraft.playerActionDelta = {} as never

    const compiled = validateActionResolution(compileActionResolutionDraftOutput(sparseDraft, input))

    expect(compiled.parsedIntent.targetRefs).toEqual([])
    expect(compiled.eventDraft.affectedRefs).toEqual([])
    expect(compiled.playerActionDelta.notes).toEqual([])
    expect(compiled.warnings.map((warning) => warning.code)).not.toContain("loose_draft_coercion")
  })

  it("still rejects non-string entries in string array fields", () => {
    const malformedDraft = draft()
    malformedDraft.playerActionDelta = {
      ...malformedDraft.playerActionDelta,
      notes: [42],
    } as unknown as typeof malformedDraft.playerActionDelta

    expect(() => compileActionResolutionDraftOutput(malformedDraft, input)).toThrow(/notes\[0\].*string/i)
  })

  it("still rejects missing required semantic fields", () => {
    const malformedDraft = draft()
    delete (malformedDraft.eventDraft as Record<string, unknown>).summary

    expect(() => compileActionResolutionDraftOutput(malformedDraft, input)).toThrow(/eventDraft\.summary/i)
  })

  it("still rejects semantic enum aliases after loose draft recovery", () => {
    const malformedEventStatus = draft()
    malformedEventStatus.playerActionDelta = {
      ...malformedEventStatus.playerActionDelta,
      notes: "This recoverable notes string must not weaken enum checks.",
    } as unknown as typeof malformedEventStatus.playerActionDelta
    malformedEventStatus.eventDraft = {
      ...malformedEventStatus.eventDraft,
      status: "happened",
    } as unknown as typeof malformedEventStatus.eventDraft

    expect(() => validateActionResolution(compileActionResolutionDraftOutput(malformedEventStatus, input))).toThrow(
      /eventDraft\.status/i,
    )

    const malformedDirectResult = draft()
    malformedDirectResult.directResults[0] = {
      ...malformedDirectResult.directResults[0],
      happenedStatus: "happened",
    } as unknown as typeof malformedDirectResult.directResults[number]

    expect(() => validateActionResolution(compileActionResolutionDraftOutput(malformedDirectResult, input))).toThrow(
      /directResults\[0\]\.happenedStatus/i,
    )
  })
})
