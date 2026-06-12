import { describe, expect, it, vi } from "vitest"
import { streamChat } from "./llm-client"
import {
  createFixtureRuntimeUpdateProposalAdapter,
  createLlmRpgRuntimeUpdateProposalAdapter,
  getRpgInteractionRegistryEntry,
  listImplementedRpgInteractionKinds,
  parseAndValidateRuntimeUpdateProposalResult,
  runtimeUpdateInteractionSpec,
  validateRuntimeUpdateProposalResult,
} from "./rpg-interactions"
import {
  buildRuntimeUpdateProposalInputFromTurnRecord,
  createPendingRpgUpdates,
} from "./rpg-runtime"
import type { RuntimeUpdateProposalResult, SubmittedAction } from "./rpg-runtime"
import {
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"
import type { RpgTurnRecord } from "./rpg-runtime/turn-model"

vi.mock("./llm-client", () => ({
  streamChat: vi.fn(),
}))

const streamChatMock = vi.mocked(streamChat)

describe("LLM 6 Runtime Update Proposal contract", () => {
  it("builds a prompt around structured fact sources and JSON result boundaries", () => {
    const prompt = runtimeUpdateInteractionSpec.buildPrompt(buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord()))
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`

    expect(runtimeUpdateInteractionSpec.kind).toBe("runtime_update_proposal")
    expect(combined).toContain("RuntimeUpdateProposalResult JSON")
    expect(combined).toContain("PostActionWorkingState")
    expect(combined).toContain("ActionResolution")
    expect(combined).toContain("WorldTickResult")
    expect(combined).toContain("TurnNarration")
    expect(combined).toContain("consistencyValidation")
    expect(combined).toContain("generatedNarrative and playerFacingText are display/evidence material")
    expect(combined).not.toContain("The factual source is strictly submittedAction + generatedNarrative + references")
    expect(combined).toContain("parallelLineText and user_visible_pc_unknown material")
    expect(combined).toContain("nextActionOptions are candidate future actions")
    expect(combined).toContain("attempted_not_confirmed cannot enter confirmed events")
    expect(combined).toContain("outlineRevisionProposal can only become independent outlineRevisionReviewItems")
    expect(combined).toContain("sourceDeltas, lineTarget, visibility, knowledgeScope, happenedStatus, confidence, and validationHints")
    expect(combined).toContain("The only accepted output contract is structured JSON")
    expect(combined).not.toContain("fenced ```rpg-wiki-update blocks may still be parsed")
  })

  it("parses and validates bare JSON RuntimeUpdateProposalResult output", () => {
    const turnRecord = sampleTurnRecord()
    const result = runtimeUpdateInteractionSpec.parseOutput(
      JSON.stringify(sampleProposalResult(turnRecord)),
      buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
    )

    expect(result.proposedWikiUpdates).toHaveLength(1)
    expect(result.proposedWikiUpdates[0]).toMatchObject({
      targetPath: "wiki/current-scene/scene_state.md",
      strategy: "overwrite",
      lineTarget: "playerVisibleLine",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      happenedStatus: "ongoing",
      confidence: "high",
    })
    expect(result.pacingUpdateProposal?.targetPath).toBe("wiki/current-scene/scene_state.md")
  })

  it("supports fenced JSON without making markdown update blocks the primary contract", () => {
    const turnRecord = sampleTurnRecord()
    const parsed = parseAndValidateRuntimeUpdateProposalResult(
      ["```json", JSON.stringify(sampleProposalResult(turnRecord)), "```"].join("\n"),
      buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
    )

    expect(parsed.proposedWikiUpdates[0].sourceDeltas[0].sourceStage).toBe("postActionWorkingState")
  })

  it("rejects old rpg-wiki-update blocks instead of parsing compatibility fallback", () => {
    const turnRecord = sampleTurnRecord()
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/events/example.md",
          "strategy: append",
          "reason: Record the completed ward inspection.",
          "---",
          "# Ward Inspection",
          "",
          "Rin confirmed the sigil behaves like a ward.",
          "```",
        ].join("\n"),
        buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord),
      ),
    ).toThrow(/RuntimeUpdateProposalResult must be bare JSON or a fenced JSON block/)
  })

  it("rejects empty runtime update proposal output", () => {
    expect(() =>
      runtimeUpdateInteractionSpec.parseOutput("", buildRuntimeUpdateProposalInputFromTurnRecord(sampleTurnRecord())),
    ).toThrow(/JSON output is empty/)
  })

  it("rejects old proposedUpdates alias as the JSON result protocol", () => {
    expect(() =>
      parseAndValidateRuntimeUpdateProposalResult(
        JSON.stringify({ ...sampleProposalResult(sampleTurnRecord()), proposedWikiUpdates: undefined, proposedUpdates: [] }),
      ),
    ).toThrow(/proposedWikiUpdates/)
    expect(() =>
      parseAndValidateRuntimeUpdateProposalResult(
        JSON.stringify({ ...sampleProposalResult(sampleTurnRecord()), proposedUpdates: [] }),
      ),
    ).toThrow(/proposedWikiUpdates/)
  })

  it("rejects ordinary updates without sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      sourceDeltas: [],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/sourceDeltas/)
  })

  it("rejects attempted_not_confirmed as confirmed event material", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/attempt.md",
      strategy: "append",
      happenedStatus: "attempted_not_confirmed",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/events updates require confirmed_happened/)
  })

  it("rejects event updates sourced from non-confirmed sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/events/attempt.md",
      strategy: "append",
      happenedStatus: "confirmed_happened",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/events/attempt.md"],
          happenedStatus: "attempted_not_confirmed",
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/confirmed_happened sourceDeltas/)
  })

  it("rejects parallel-line user-visible material as automatic PC knowledge", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      visibility: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/player known information/)
  })

  it("rejects player known information sourced from parallelLineText or PC-unknown sourceDeltas", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/player/known_information.md",
      strategy: "merge",
      visibility: "pc_visible",
      knowledgeScope: "pc_known",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          sourceStage: "turnNarration",
          sourceField: "parallelLineText",
          affectedPaths: ["wiki/player/known_information.md"],
          visibility: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/parallel-line or PC-unknown/)
  })

  it("rejects runtime overlay updates without sourceDelta affectedPath traceability", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      targetPath: "wiki/relationships/runtime/player-rin.md",
      strategy: "merge",
      sourceDeltas: [
        {
          ...result.proposedWikiUpdates[0].sourceDeltas[0],
          affectedPaths: ["wiki/current-scene/scene_state.md"],
        },
      ],
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/runtime overlay updates require/)
  })

  it("validates proposalGroups and pacing sourceDelta references", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposalGroups[0] = {
      ...result.proposalGroups[0],
      updateIds: ["missing-update"],
    }
    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/unknown update/)

    const pacingResult = sampleProposalResult(sampleTurnRecord())
    pacingResult.pacingUpdateProposal = {
      ...pacingResult.pacingUpdateProposal!,
      sourceDeltaIds: ["missing-source-delta"],
    }
    expect(() => validateRuntimeUpdateProposalResult(pacingResult)).toThrow(/unknown sourceDelta/)
  })

  it("keeps skipped deltas and outline review items out of ordinary pending updates", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates = []
    result.pacingUpdateProposal = null
    result.skippedDeltas = [
      {
        skipId: "skip-parallel-knowledge",
        sourceDelta: {
          ...sampleProposalResult(sampleTurnRecord()).proposedWikiUpdates[0].sourceDeltas[0],
          deltaId: "source-delta-skipped-parallel",
          visibility: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
          affectedPaths: ["wiki/player/known_information.md"],
        },
        code: "pc_unknown_parallel_line",
        reason: "Parallel-line material is review/journal-only for PC knowledge.",
        reviewPolicy: "review_only",
      },
    ]
    result.outlineRevisionReviewItems = [
      {
        reviewItemId: "outline-review-1",
        sourceProposalId: "outline-proposal-1",
        reviewItemKind: "outlineRevision",
        outlineImpactLevel: "major_rewrite_required",
        summary: "Future-only outline revision needs manual review.",
        proposedRevisionSummary: "Revise future reveal order only.",
        targetOutlineRefs: [],
        mustPreserveFacts: [],
        runtimeDeltaRefs: [],
        reviewPolicy: "manual_review",
        ordinaryRuntimeUpdate: false,
        proposedWikiUpdate: false,
        autoWriteMainOutline: false,
        warnings: [],
      },
    ]
    result.proposalGroups = [
      {
        groupId: "group-skipped-outline",
        title: "Skipped and outline review material",
        lineTarget: "parallelLine",
        updateIds: [],
        skippedDeltaIds: ["skip-parallel-knowledge"],
        sourceDeltaIds: ["source-delta-skipped-parallel"],
        reason: "Review-only material must not become ordinary pending.",
        reviewPolicy: "review_only",
      },
    ]

    const validated = validateRuntimeUpdateProposalResult(result)
    expect(createPendingRpgUpdates(validated.proposedWikiUpdates)).toEqual([])
    expect(validated.skippedDeltas).toHaveLength(1)
    expect(validated.outlineRevisionReviewItems).toHaveLength(1)
  })

  it("rejects outline revision material mixed into ordinary proposedWikiUpdates", () => {
    const result = sampleProposalResult(sampleTurnRecord())
    result.proposedWikiUpdates[0] = {
      ...result.proposedWikiUpdates[0],
      content: "outlineRevisionProposal should update wiki/outlines/main.md",
    }

    expect(() => validateRuntimeUpdateProposalResult(result)).toThrow(/outline revision material/)
  })

  it("adapts fixture output through buildPrompt and parseOutput", async () => {
    const turnRecord = sampleTurnRecord()
    const adapter = createFixtureRuntimeUpdateProposalAdapter(JSON.stringify(sampleProposalResult(turnRecord)))

    await expect(adapter.generateRuntimeUpdateProposal(buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord))).resolves.toMatchObject({
      proposedWikiUpdates: [expect.objectContaining({ targetPath: "wiki/current-scene/scene_state.md" })],
    })
  })

  it("builds deterministic RuntimeUpdateProposalInput from a turn record", () => {
    const turnRecord = sampleTurnRecord()
    const input = buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord)

    expect(input.turnRecord.submittedAction).toEqual(turnRecord.submittedAction)
    expect(input.postActionWorkingState).toEqual(turnRecord.postActionWorkingState)
    expect(input.actionResolution).toEqual(turnRecord.actionResolution)
    expect(input.worldTickResult).toEqual(turnRecord.worldTickResult)
    expect(input.visibleSelection).toEqual(turnRecord.visibleSelection)
    expect(input.recallSelection).toEqual(turnRecord.recallSelection)
    expect(input.recalledMaterials).toEqual(turnRecord.recalledMaterials)
    expect(input.outlineAwareNarrationBrief).toEqual(turnRecord.outlineAwareNarrationBrief)
    expect(input.outlineImpactReport).toEqual(turnRecord.outlineImpactReport)
    expect(input.turnNarration).toEqual(turnRecord.turnNarration)
    expect(input.consistencyValidation.checkedSources).toEqual(
      expect.arrayContaining(["turnRecord", "postActionWorkingState", "turnNarration"]),
    )
    expect(input.allowedTargets.map((target) => target.pathPattern)).toContain("wiki/current-scene/scene_state.md")
    expect(input.writePolicy.every((rule) => rule.reviewPolicy === "pending_review")).toBe(true)
    expect(input.reviewPolicy.find((rule) => rule.reviewItemKind === "outlineRevision")).toMatchObject({
      ordinaryRuntimeUpdate: false,
      autoApply: false,
    })
  })

  it("adapts LLM output through buildPrompt and parseOutput", async () => {
    const turnRecord = sampleTurnRecord()
    streamChatMock.mockImplementationOnce(async (_config, _messages, callbacks) => {
      callbacks.onToken(JSON.stringify(sampleProposalResult(turnRecord)))
      callbacks.onDone()
    })

    const adapter = createLlmRpgRuntimeUpdateProposalAdapter({
      llmConfig: {
        provider: "openai",
        apiKey: "test-key",
        model: "test-model",
        ollamaUrl: "",
        customEndpoint: "",
        maxContextSize: 10000,
      },
    })

    const result = await adapter.generateRuntimeUpdateProposal(buildRuntimeUpdateProposalInputFromTurnRecord(turnRecord))
    expect(result.proposedWikiUpdates[0].sourceDeltas[0].sourceStage).toBe("postActionWorkingState")
    expect(streamChatMock).toHaveBeenCalled()
  })

  it("registers and exports runtime_update_proposal without changing schema slots or writer/apply", () => {
    expect(listImplementedRpgInteractionKinds()).toContain("runtime_update_proposal")
    const entry = getRpgInteractionRegistryEntry("runtime_update_proposal")
    expect(entry?.stage).toBe("runtime_update")
    expect(entry?.spec).toBe(runtimeUpdateInteractionSpec)
    expect(entry?.notes?.join("\n")).toContain("Does not stage pending updates")
  })
})

function sampleTurnRecord(): RpgTurnRecord {
  const submittedAction: SubmittedAction = {
    id: "turn-69",
    text: "Ask Rin whether the sigil is a ward or a lure.",
    source: "freeform",
  }
  return {
    submittedAction,
    ...sampleTurnRecordRuntimeParts(submittedAction),
    turnNarration: sampleTurnNarration({
      playerFacingText: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    }),
    generatedNarrative: "Rin kneels by the gate and confirms the sigil is an old ward, not bait.",
    references: ["wiki/current-scene/scene_state.md", "wiki/player/known_information.md"],
  }
}

function sampleProposalResult(turnRecord: RpgTurnRecord): RuntimeUpdateProposalResult {
  const deltaRef = turnRecord.postActionWorkingState.runtimeDeltaRefs[0]
  return {
    proposedWikiUpdates: [
      {
        id: "runtime-update-scene-turn-69",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep the current scene aligned with the settled ward inspection and patrol pressure.",
        content: "# Current Scene\n\nRin has identified the sigil as a ward while patrol lights draw nearer.",
        sourceTurnId: turnRecord.submittedAction.id,
        references: ["wiki/current-scene/scene_state.md"],
        sourceDeltas: [
          {
            deltaId: "source-delta-current-scene-turn-69",
            sourceStage: "postActionWorkingState",
            sourceField: "campaignDelta",
            summary: "The patrol pressure and Mira/Rin warning move the gate scene forward.",
            lineTarget: "playerVisibleLine",
            visibility: "pc_visible",
            knowledgeScope: "pc_known",
            happenedStatus: "ongoing",
            usePurpose: "writeback",
            affectedPaths: ["wiki/current-scene/scene_state.md"],
            runtimeDeltaRefs: deltaRef ? [deltaRef] : [],
          },
        ],
        lineTarget: "playerVisibleLine",
        visibility: "pc_visible",
        knowledgeScope: "pc_known",
        happenedStatus: "ongoing",
        confidence: "high",
        validationHints: [
          {
            hintId: "hint-scene-turn-69",
            severity: "info",
            code: "structured_source_delta",
            message: "Grounded in PostActionWorkingState rather than nextActionOptions.",
          },
        ],
      },
    ],
    outlineRevisionReviewItems: [],
    journalEntries: ["Runtime update proposal created from structured current-turn facts."],
    skippedDeltas: [],
    pacingUpdateProposal: {
      proposalId: "pacing-turn-69",
      sourceDeltaIds: ["source-delta-current-scene-turn-69"],
      previousPacingState: "low",
      nextPacingState: "none",
      timeDeltaSummary: turnRecord.actionResolution.timeDelta.summary,
      campaignDelta: turnRecord.postActionWorkingState.campaignDelta,
      pacingDebtChange: "decreased",
      targetPath: "wiki/current-scene/scene_state.md",
      reviewPolicy: "pending_review",
    },
    proposalGroups: [
      {
        groupId: "group-player-visible-turn-69",
        title: "Player-visible scene state",
        lineTarget: "playerVisibleLine",
        updateIds: ["runtime-update-scene-turn-69"],
        skippedDeltaIds: [],
        sourceDeltaIds: ["source-delta-current-scene-turn-69"],
        reason: "Current scene snapshot update.",
        reviewPolicy: "pending_review",
      },
    ],
    warnings: [],
  }
}
