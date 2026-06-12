import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, fileExists, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  appendRpgApplyJournalEntry,
  appendRpgTurnJournalEntry,
  createRuntimePersistencePaths,
  loadRpgPendingUpdates,
  saveRpgPendingUpdates,
  type PendingRpgUpdate,
  type RuntimeApplyJournalEntry,
  type RuntimeTurnJournalEntry,
} from "./rpg-runtime"
import {
  sampleRecalledMaterials,
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

describe("RPG Runtime Persistence", () => {
  it("returns an empty pending queue when runtime metadata is missing", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-missing") }

    const result = await loadRpgPendingUpdates(ctx.tmp.path)

    expect(result.updates).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it("saves pending updates under .llm-wiki/runtime/pending-updates.json", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-save") }
    const paths = createRuntimePersistencePaths(ctx.tmp.path)

    const result = await saveRpgPendingUpdates(ctx.tmp.path, [samplePendingUpdate("pending-update", "pending")])

    expect(result.warnings).toEqual([])
    expect(await fileExists(paths.pendingUpdatesPath)).toBe(true)
    expect(await fileExists(`${ctx.tmp.path}/wiki/pending-updates.json`)).toBe(false)
    const raw = JSON.parse(await readFileRaw(paths.pendingUpdatesPath)) as { updates: PendingRpgUpdate[] }
    expect(raw.updates[0]).toMatchObject({
      id: "pending-update",
      status: "pending",
      targetPath: "wiki/current-scene/scene_state.md",
    })
  })

  it("restores pending, accepted, and rejected statuses", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-status") }
    await saveRpgPendingUpdates(ctx.tmp.path, [
      samplePendingUpdate("pending-update", "pending"),
      samplePendingUpdate("accepted-update", "accepted"),
      samplePendingUpdate("rejected-update", "rejected"),
    ])

    const result = await loadRpgPendingUpdates(ctx.tmp.path)

    expect(result.warnings).toEqual([])
    expect(result.updates.map((update) => [update.id, update.status])).toEqual([
      ["pending-update", "pending"],
      ["accepted-update", "accepted"],
      ["rejected-update", "rejected"],
    ])
  })

  it("returns an empty pending queue plus a warning for corrupt pending JSON", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-corrupt") }
    const paths = createRuntimePersistencePaths(ctx.tmp.path)
    await writeFileRaw(paths.pendingUpdatesPath, "{ not json")

    const result = await loadRpgPendingUpdates(ctx.tmp.path)

    expect(result.updates).toEqual([])
    expect(result.warnings.join("\n")).toContain("Could not load RPG pending updates")
  })

  it("appends turn journal entries as one JSON object per line", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-turn-jsonl") }
    const paths = createRuntimePersistencePaths(ctx.tmp.path)

    await appendRpgTurnJournalEntry(ctx.tmp.path, sampleTurnJournalEntry("turn-1"))
    await appendRpgTurnJournalEntry(ctx.tmp.path, sampleTurnJournalEntry("turn-2"))

    const lines = (await readFileRaw(paths.turnRecordsPath)).trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines.map((line) => JSON.parse(line) as RuntimeTurnJournalEntry).map((entry) => entry.submittedAction.id)).toEqual([
      "turn-1",
      "turn-2",
    ])
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).actionResolution.eventDraft.status).toBe(
      "attempted_not_confirmed",
    )
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).worldTickResult.tickId).toBe("world-tick-turn-1")
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).visibleSelection.parallelLensCandidates[0]).toMatchObject({
      grantsPcKnowledge: false,
      pcKnowledgeBoundaryPath: "wiki/player/known_information.md",
    })
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).postActionWorkingState.campaignDelta).toContain(
      "patrol clock",
    )
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).recallSelection.selectionId).toBe("recall-selection-act-1")
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).recalledMaterials[0]).toMatchObject({
      path: "wiki/current-scene/scene_state.md",
    })
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).outlineAwareNarrationBrief.briefId).toBe(
      "outline-brief-turn-1",
    )
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).outlineImpactReport.requiresRegeneration).toBe(false)
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).turnNarration.playerFacingText).toBe("Mira reads the sigil.")
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).turnRecord.turnNarration?.displayPolicy).toMatchObject({
      tensionBriefIsReviewHandoff: true,
      parallelLineGrantsPcKnowledge: false,
    })
    expect((JSON.parse(lines[0]) as RuntimeTurnJournalEntry).runtimeUpdateProposalAudit).toMatchObject({
      proposedWikiUpdateIds: ["update-turn-1"],
      skippedDeltas: [expect.objectContaining({ skipId: "skip-turn-1" })],
      outlineRevisionReviewItems: [expect.objectContaining({ reviewItemId: "outline-review-turn-1" })],
    })
  })

  it("appends apply journal entries as one JSON object per line", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-apply-jsonl") }
    const paths = createRuntimePersistencePaths(ctx.tmp.path)

    await appendRpgApplyJournalEntry(ctx.tmp.path, sampleApplyJournalEntry("update-1"))
    await appendRpgApplyJournalEntry(ctx.tmp.path, sampleApplyJournalEntry("update-2"))

    const lines = (await readFileRaw(paths.applyResultsPath)).trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(lines.map((line) => JSON.parse(line) as RuntimeApplyJournalEntry).map((entry) => entry.appliedUpdateIds[0])).toEqual([
      "update-1",
      "update-2",
    ])
  })

  it("rejects empty projectPath and safely skips writes", async () => {
    expect(() => createRuntimePersistencePaths("   ")).toThrow(/projectPath is required/)

    const result = await saveRpgPendingUpdates("   ", [samplePendingUpdate("pending-update", "pending")])

    expect(result.warnings.join("\n")).toContain("projectPath is required")
  })

  it("writes runtime metadata only under .llm-wiki/runtime, not wiki", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-persistence-boundary") }
    await saveRpgPendingUpdates(ctx.tmp.path, [samplePendingUpdate("pending-update", "pending")])
    await appendRpgTurnJournalEntry(ctx.tmp.path, sampleTurnJournalEntry("turn-boundary"))
    await appendRpgApplyJournalEntry(ctx.tmp.path, sampleApplyJournalEntry("update-boundary"))

    const paths = await listRelativeFiles(ctx.tmp.path)

    expect(paths.sort()).toEqual([
      ".llm-wiki/runtime/apply-results.jsonl",
      ".llm-wiki/runtime/pending-updates.json",
      ".llm-wiki/runtime/turn-records.jsonl",
    ])
    expect(paths.some((relativePath) => relativePath.startsWith("wiki/"))).toBe(false)
  })
})

function samplePendingUpdate(id: string, status: PendingRpgUpdate["status"]): PendingRpgUpdate {
  return {
    id,
    targetPath: "wiki/current-scene/scene_state.md",
    strategy: "overwrite",
    reason: "Keep the current scene snapshot recoverable.",
    content: "# Current Scene\n\nThe canal gate is glowing.",
    sourceTurnId: "turn-1",
    references: ["wiki/current-scene/scene_state.md"],
    status,
  }
}

function sampleTurnJournalEntry(turnId: string): RuntimeTurnJournalEntry {
  const submittedAction = {
    id: turnId,
    text: "Inspect the canal gate.",
    source: "freeform" as const,
  }
  const runtimeParts = sampleTurnRecordRuntimeParts(submittedAction, {
    recalledMaterials: sampleRecalledMaterials(),
  })
  const turnNarration = sampleTurnNarration({ playerFacingText: "Mira reads the sigil." })

  return {
    timestamp: "2026-06-06T00:00:00.000Z",
    submittedAction,
    ...runtimeParts,
    turnResult: {
      narrative: "Mira reads the sigil.",
      nextActionOptions: [
        {
          id: "opt-1",
          playerFacingText: "Touch the lantern key to the sigil.",
          intent: "use_item",
          riskLevel: "medium",
          likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
        },
        {
          id: "opt-2",
          playerFacingText: "Ask Mira what changed.",
          intent: "talk",
          riskLevel: "low",
          likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
        },
        {
          id: "opt-3",
          playerFacingText: "Wait and listen.",
          intent: "wait",
          riskLevel: "medium",
          likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
        },
      ],
      references: ["wiki/current-scene/scene_state.md"],
    },
    turnNarration,
    turnRecord: {
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
      generatedNarrative: "Mira reads the sigil.",
      references: ["wiki/current-scene/scene_state.md", "wiki/factions/runtime/harbor-watch.md", "wiki/rules/core.md"],
    },
    proposedUpdates: [],
    pendingUpdateIds: [],
    warnings: [],
    proposalSource: "interaction",
    runtimeUpdateProposalAudit: {
      proposedWikiUpdateIds: [`update-${turnId}`],
      journalEntries: [`Structured proposal audit for ${turnId}.`],
      skippedDeltas: [
        {
          skipId: `skip-${turnId}`,
          sourceDeltaId: `source-delta-skip-${turnId}`,
          code: "review_only_parallel_line",
          reason: "Parallel-line material is not ordinary pending.",
          reviewPolicy: "review_only",
        },
      ],
      pacingUpdateProposal: {
        proposalId: `pacing-${turnId}`,
        sourceDeltaIds: [`source-delta-${turnId}`],
        targetPath: "journal_only",
        reviewPolicy: "review_only",
        pacingDebtChange: "unchanged",
      },
      proposalGroups: [
        {
          groupId: `group-${turnId}`,
          updateIds: [`update-${turnId}`],
          skippedDeltaIds: [`skip-${turnId}`],
          sourceDeltaIds: [`source-delta-${turnId}`, `source-delta-skip-${turnId}`],
          reviewPolicy: "review_only",
        },
      ],
      outlineRevisionReviewItems: [
        {
          reviewItemId: `outline-review-${turnId}`,
          sourceProposalId: `outline-proposal-${turnId}`,
          outlineImpactLevel: "major_rewrite_required",
          reviewPolicy: "manual_review",
        },
      ],
      warnings: [],
    },
  }
}

function sampleApplyJournalEntry(updateId: string): RuntimeApplyJournalEntry {
  return {
    timestamp: "2026-06-06T00:00:00.000Z",
    attemptedUpdateIds: [updateId],
    appliedUpdateIds: [updateId],
    remainingPendingUpdateIds: [],
    applyResult: {
      appliedUpdates: [
        {
          id: updateId,
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite",
          status: "applied",
        },
      ],
      skippedUpdates: [],
      warnings: [],
    },
  }
}

async function listRelativeFiles(root: string): Promise<string[]> {
  const result: string[] = []

  async function visit(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`.replace(/\\/g, "/")
      if (entry.isDirectory()) {
        await visit(fullPath)
      } else {
        result.push(fullPath.slice(root.length + 1))
      }
    }
  }

  await visit(root)
  return result
}
