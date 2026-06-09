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

  return {
    timestamp: "2026-06-06T00:00:00.000Z",
    submittedAction,
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
    turnRecord: {
      submittedAction,
      generatedNarrative: "Mira reads the sigil.",
      references: ["wiki/current-scene/scene_state.md"],
    },
    proposedUpdates: [],
    pendingUpdateIds: [],
    warnings: [],
    proposalSource: "interaction",
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
