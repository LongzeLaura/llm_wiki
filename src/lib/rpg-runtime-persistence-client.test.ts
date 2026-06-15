import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  appendRpgApplyJournalEntry,
  appendRpgTurnJournalEntry,
  createRuntimePersistencePaths,
  loadRpgPendingUpdates,
  saveRpgPendingUpdates,
} from "./rpg-runtime/runtime-persistence-client"
import type {
  RuntimeApplyJournalEntry,
  RuntimeTurnJournalEntry,
} from "./rpg-runtime/runtime-persistence-shared"
import type { PendingRpgUpdate } from "./rpg-runtime/update-staging"

const fsMock = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: [] as string[],
}))

vi.mock("@/commands/fs", () => ({
  createDirectory: vi.fn(async (path: string) => {
    fsMock.directories.push(path)
  }),
  fileExists: vi.fn(async (path: string) => fsMock.files.has(path)),
  readFile: vi.fn(async (path: string) => {
    const value = fsMock.files.get(path)
    if (value === undefined) throw new Error(`missing ${path}`)
    return value
  }),
  writeFileAtomic: vi.fn(async (path: string, contents: string) => {
    fsMock.files.set(path, contents)
  }),
}))

describe("RPG Runtime Persistence Client", () => {
  beforeEach(() => {
    fsMock.files.clear()
    fsMock.directories = []
  })

  it("saves and loads pending updates under .llm-wiki/runtime", async () => {
    const projectPath = "C:\\tmp\\rpg-project\\"
    const paths = createRuntimePersistencePaths(projectPath)

    await saveRpgPendingUpdates(projectPath, [samplePendingUpdate("pending-update", "accepted")])
    const result = await loadRpgPendingUpdates(projectPath)

    expect(paths.projectRoot).toBe("C:/tmp/rpg-project")
    expect(fsMock.directories).toContain("C:/tmp/rpg-project/.llm-wiki/runtime")
    expect(fsMock.files.has("C:/tmp/rpg-project/.llm-wiki/runtime/pending-updates.json")).toBe(true)
    expect(result.warnings).toEqual([])
    expect(result.updates).toEqual([samplePendingUpdate("pending-update", "accepted")])
  })

  it("returns an empty queue when pending metadata does not exist", async () => {
    await expect(loadRpgPendingUpdates("C:/tmp/rpg-project")).resolves.toEqual({
      updates: [],
      warnings: [],
    })
  })

  it("appends turn and apply journal JSONL files through atomic writes", async () => {
    const projectPath = "C:/tmp/rpg-project"

    await appendRpgTurnJournalEntry(projectPath, { submittedAction: { id: "turn-1" } } as RuntimeTurnJournalEntry)
    await appendRpgTurnJournalEntry(projectPath, { submittedAction: { id: "turn-2" } } as RuntimeTurnJournalEntry)
    await appendRpgApplyJournalEntry(projectPath, sampleApplyJournalEntry("update-1"))

    const turnLines = fsMock.files.get("C:/tmp/rpg-project/.llm-wiki/runtime/turn-records.jsonl")?.trim().split("\n")
    const applyLines = fsMock.files.get("C:/tmp/rpg-project/.llm-wiki/runtime/apply-results.jsonl")?.trim().split("\n")
    expect(turnLines?.map((line) => JSON.parse(line).submittedAction.id)).toEqual(["turn-1", "turn-2"])
    expect(applyLines?.map((line) => JSON.parse(line).appliedUpdateIds[0])).toEqual(["update-1"])
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

function sampleApplyJournalEntry(updateId: string): RuntimeApplyJournalEntry {
  return {
    timestamp: "2026-06-12T00:00:00.000Z",
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
