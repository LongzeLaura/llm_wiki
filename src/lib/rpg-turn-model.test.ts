import { describe, expect, it, afterEach } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { cleanRpgReferences, createRpgTurnRecord, createTurnResultFromTurnNarration } from "./rpg-runtime"
import type { RpgTurnResult, SubmittedAction } from "./rpg-runtime"
import {
  sampleRecallSelection,
  sampleTurnNarration,
  sampleTurnRecordRuntimeParts,
} from "./rpg-runtime-test-fixtures"

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

describe("RPG Turn Model", () => {
  it("derives the transitional RpgTurnResult from TurnNarration in one helper", () => {
    const turnNarration = sampleTurnNarration({
      playerFacingText: "Mira names the safe sigil edge while the patrol light nears.",
    })
    turnNarration.references = [
      ...turnNarration.references,
      {
        path: "wiki/entities/legacy-poison.md",
        usePurpose: "narration",
        reason: "Legacy paths must not survive the transition helper.",
      },
      {
        path: "wiki/current-scene/scene_state.md",
        usePurpose: "narration",
        reason: "Duplicate path should be deduplicated.",
      },
    ]

    const result = createTurnResultFromTurnNarration(turnNarration)
    const serialized = JSON.stringify(result)

    expect(result).toEqual({
      narrative: turnNarration.playerFacingText,
      nextActionOptions: turnNarration.nextActionOptions.map((option) => ({
        id: option.id,
        playerFacingText: option.playerFacingText,
        intent: option.intent,
        riskLevel: option.riskLevel,
        likelyAffectedPaths: option.likelyAffectedPaths,
      })),
      references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
    })
    expect(serialized).not.toContain(turnNarration.parallelLineText)
    expect(serialized).not.toContain(turnNarration.tensionBrief.summary)
    expect(serialized).not.toContain("wiki/entities/legacy-poison.md")
  })

  it("creates a completed turn record from a SubmittedAction and RpgTurnResult", () => {
    const submittedAction: SubmittedAction = {
      id: "act-1",
      text: "I ask Mira to inspect the canal-gate sigil with me.",
      source: "freeform",
    }
    const turnResult: RpgTurnResult = {
      narrative: "Mira kneels by the canal gate and traces the cracked sigil without touching it.",
      nextActionOptions: [
        {
          id: "opt-1",
          playerFacingText: "Force the gate before Mira finishes reading the sigil.",
          intent: "fight",
          riskLevel: "high",
          likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/events/session-03.md"],
        },
      ],
      references: ["wiki/characters/mira.md", "wiki/current-scene/scene_state.md"],
    }

    const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction)
    const turnNarration = sampleTurnNarration({ playerFacingText: turnResult.narrative })
    const record = createRpgTurnRecord({
      submittedAction,
      ...runtimeParts,
      turnNarration,
      turnResult,
    })

    expect(record).toEqual({
      submittedAction,
      actionResolution: runtimeParts.actionResolution,
      worldTickResult: runtimeParts.worldTickResult,
      visibleSelection: runtimeParts.visibleSelection,
      postActionWorkingState: runtimeParts.postActionWorkingState,
      recallSelection: sampleRecallSelection(),
      recalledMaterials: [],
      outlineAwareNarrationBrief: runtimeParts.outlineAwareNarrationBrief,
      outlineImpactReport: runtimeParts.outlineImpactReport,
      turnNarration,
      generatedNarrative: turnResult.narrative,
      references: [
        "wiki/characters/mira.md",
        "wiki/current-scene/scene_state.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/player/player.md",
        "wiki/rules/core.md",
      ],
    })
  })

  it("keeps generated narrative and actionResolution but excludes next action options from the record", () => {
    const submittedAction: SubmittedAction = {
      id: "act-2",
      text: "Lift the lantern toward the lock.",
      source: "freeform",
    }
    const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction)
    const turnResult: RpgTurnResult = {
      narrative: "The brass lantern flares once, revealing fresh scratches around the lock.",
      nextActionOptions: [
        {
          id: "opt-avoid-mira",
          playerFacingText: "Leave Mira behind and crawl through the sluice alone.",
          intent: "move",
          riskLevel: "medium",
          likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
        },
      ],
      references: ["wiki/items/brass-lantern.md"],
    }

    const record = createRpgTurnRecord({
      submittedAction,
      ...runtimeParts,
      turnNarration: sampleTurnNarration({ playerFacingText: turnResult.narrative }),
      turnResult,
    })
    const serializedRecord = JSON.stringify(record)

    expect(record.generatedNarrative).toContain("brass lantern flares")
    expect(record.actionResolution).toEqual(runtimeParts.actionResolution)
    expect("nextActionOptions" in record).toBe(false)
    expect(serializedRecord).not.toContain("Leave Mira behind")
    expect(serializedRecord).not.toContain("opt-avoid-mira")
    expect(serializedRecord).not.toContain("wiki/relationships/iven-mira.md")
  })

  it("keeps outline regeneration audit fields separate from narrative and references", () => {
    const submittedAction: SubmittedAction = {
      id: "act-regeneration-audit",
      text: "Break the canal gate seal early.",
      source: "freeform",
    }
    const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction)
    const auditFields = sampleRegenerationAuditFields()

    const record = createRpgTurnRecord({
      submittedAction,
      ...runtimeParts,
      ...auditFields,
      turnNarration: sampleTurnNarration({ playerFacingText: "The seal breaks before the old beat can land." }),
      turnResult: {
        narrative: "The seal breaks before the old beat can land.",
        nextActionOptions: [],
        references: ["wiki/current-scene/scene_state.md"],
      },
    })

    expect(record.provisionalOutlinePatch).toEqual(auditFields.provisionalOutlinePatch)
    expect(record.outlineRevisionProposal).toEqual(auditFields.outlineRevisionProposal)
    expect(record.regenerationSafetyReport).toEqual(auditFields.regenerationSafetyReport)
    expect(record.generatedNarrative).not.toContain("Future-only outline review candidate")
    expect(record.references).not.toContain("wiki/outlines/main.md")
  })

  it("normalizes, deduplicates, sorts, and filters references", () => {
    const submittedAction: SubmittedAction = {
      id: "act-3",
      text: "Check the courtyard, then compare notes with Mira.",
      source: "selected_option",
      selectedOptionId: "opt-check-yard",
    }
    const record = createRpgTurnRecord({
      submittedAction,
      ...sampleTurnRecordRuntimeParts(submittedAction),
      turnNarration: sampleTurnNarration({
        playerFacingText: "The courtyard is empty, but the wet footprints stop at the old shrine door.",
      }),
      turnResult: {
        narrative: "The courtyard is empty, but the wet footprints stop at the old shrine door.",
        nextActionOptions: [],
        references: [
          "",
          "   ",
          "wiki\\events\\session-04.md",
          "wiki/events/session-04.md",
          "./wiki/locations/courtyard.md",
          "/wiki/characters/mira.md",
          "wiki/world//supernatural_presence.md",
          "wiki/quests/main.md",
          "wiki/entities/legacy-poison.md",
          "wiki/concepts/legacy-poison.md",
          "wiki/queries/old-answer.md",
          "notes/wiki/events/not-under-wiki.md",
        ],
      },
    })

    expect(record.references).toEqual([
      "wiki/characters/mira.md",
      "wiki/current-scene/scene_state.md",
      "wiki/events/session-04.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/locations/courtyard.md",
        "wiki/player/player.md",
        "wiki/quests/main.md",
      "wiki/rules/core.md",
      "wiki/world/supernatural_presence.md",
    ])
  })

  it("allows quest references while still filtering legacy directories", () => {
    expect(
      cleanRpgReferences([
        "wiki/quests/main.md",
        "wiki/entities/legacy.md",
        "wiki/concepts/legacy.md",
        "wiki/queries/legacy.md",
      ]),
    ).toEqual(["wiki/quests/main.md"])
  })

  it("does not write any wiki files while creating a turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-model-readonly") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe door is closed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe door was discovered.")

    const before = await snapshotFiles(projectPath)
    createRpgTurnRecord({
      submittedAction: { id: "act-4", text: "Listen at the closed door.", source: "freeform" },
      ...sampleTurnRecordRuntimeParts({ id: "act-4", text: "Listen at the closed door.", source: "freeform" }),
      turnNarration: sampleTurnNarration({ playerFacingText: "No footsteps answer from the other side." }),
      turnResult: {
        narrative: "No footsteps answer from the other side.",
        nextActionOptions: [],
        references: ["wiki/current-scene/scene_state.md", "wiki/events/session-01.md"],
      },
    })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The door is closed.")
  })
})

function sampleRegenerationAuditFields() {
  return {
    provisionalOutlinePatch: {
      patchId: "patch-audit",
      sourceRequestId: "request-audit",
      scope: "same_turn_only" as const,
      outlineImpactLevel: "major_rewrite_required" as const,
      affectedOutlineRefs: [],
      suspendedBeatRefs: [],
      invalidatedBeatRefs: [],
      preservedConfirmedFacts: [],
      runtimeDeltaRefs: [],
      narrativeLines: ["playerVisibleLine" as const],
      visibilityBoundary: [],
      narrationHandoff: {
        handoffId: "handoff-audit",
        sourcePatchId: "patch-audit",
        mustFollow: ["Follow the changed same-turn direction."],
        mustPreserveFacts: [],
        mustNotReveal: [],
        invalidatedOldBeats: [],
        nextSceneDirection: "Continue from the changed seal.",
        narrativeLines: ["playerVisibleLine" as const],
        visibilityBoundaries: [],
        runtimeDeltaRefs: [],
        outlineRefs: [],
        grantsPcKnowledgeFromHiddenMaterial: false as const,
      },
      nonPersistenceBoundary: {
        sameTurnOnly: true as const,
        writesToWiki: false as const,
        modifiesMainOutline: false as const,
        persistedToOutlinesMain: false as const,
        ordinaryRuntimeUpdate: false as const,
        acceptedWikiFacts: false as const,
      },
    },
    outlineRevisionProposal: {
      proposalId: "proposal-audit",
      sourceRequestId: "request-audit",
      reviewItemKind: "outlineRevision" as const,
      outlineImpactLevel: "major_rewrite_required" as const,
      targetOutlineRefs: [],
      invalidatedAssumptions: ["Old sequence needs review."],
      mustPreserveFacts: [],
      proposedRevision: {
        summary: "Future-only outline review candidate.",
        revisedBeats: [],
        revisedRevealOrder: [],
        branchAdjustments: [],
        futureOnly: true as const,
      },
      visibilityAndKnowledgeScope: [],
      runtimeDeltaRefs: [],
      reviewBoundary: {
        reviewItemKind: "outlineRevision" as const,
        reviewBoundary: "independent_pending_review" as const,
        ordinaryRuntimeUpdate: false as const,
        proposedWikiUpdate: false as const,
        autoWriteMainOutline: false as const,
        mainOutlineWritePolicy: "manual_or_review_only" as const,
      },
    },
    regenerationSafetyReport: {
      reportKind: "regenerationSafetyReport" as const,
      safetyConclusion: "safe" as const,
      preservesConfirmedFacts: true as const,
      futureNotWrittenAsEvent: true as const,
      forbiddenRevealProtected: true as const,
      mainOutlineNotDirectlyModified: true as const,
      provisionalPatchNonPersistent: true as const,
      proposalReviewBoundary: true as const,
      ordinaryRuntimeUpdateBoundary: true as const,
      noWikiWrite: true as const,
      noPlayerFacingProse: true as const,
      checkedRuntimeRefs: [],
      checkedOutlineRefs: [],
      warnings: [],
    },
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
