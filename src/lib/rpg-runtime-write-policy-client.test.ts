import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyRpgPendingUpdates } from "./rpg-runtime/write-policy-client"
import type { PendingRpgUpdate } from "./rpg-runtime/update-staging"
import type { RpgUpdateStrategy } from "./rpg-runtime/state-extractor"

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

describe("RPG Runtime Write Policy Client", () => {
  beforeEach(() => {
    fsMock.files.clear()
    fsMock.directories = []
  })

  it("overwrites accepted current-scene updates through Tauri fs commands", async () => {
    fsMock.files.set("C:/tmp/rpg-project/wiki/current-scene/scene_state.md", "# Current Scene\n\nOld rain.")

    const result = await applyRpgPendingUpdates({
      projectPath: "C:\\tmp\\rpg-project\\",
      updates: [
        acceptedUpdate("scene-update", "wiki/current-scene/scene_state.md", "overwrite", "# Current Scene\n\nNew lantern light."),
      ],
    })

    expect(result.appliedUpdates).toEqual([
      {
        id: "scene-update",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        status: "applied",
      },
    ])
    expect(result.skippedUpdates).toEqual([])
    expect(result.warnings).toEqual([])
    expect(fsMock.directories).toContain("C:/tmp/rpg-project/wiki/current-scene")
    expect(fsMock.files.get("C:/tmp/rpg-project/wiki/current-scene/scene_state.md")).toBe(
      "# Current Scene\n\nNew lantern light.\n",
    )
  })

  it("appends accepted event updates and creates missing files", async () => {
    fsMock.files.set("C:/tmp/rpg-project/wiki/events/canal-gate.md", "# Canal Gate\n\nThe gate was found.")

    const result = await applyRpgPendingUpdates({
      projectPath: "C:/tmp/rpg-project",
      updates: [
        acceptedUpdate("event-append", "wiki/events/canal-gate.md", "append", "## Turn 5\n\nThe lowest sigil answered."),
        acceptedUpdate("event-create", "wiki/events/brass-light.md", "append", "# Brass Light\n\nThe lantern key flared."),
      ],
    })

    expect(result.appliedUpdates.map((update) => update.id)).toEqual(["event-append", "event-create"])
    expect(fsMock.files.get("C:/tmp/rpg-project/wiki/events/canal-gate.md")).toBe(
      "# Canal Gate\n\nThe gate was found.\n\n## Turn 5\n\nThe lowest sigil answered.\n",
    )
    expect(fsMock.files.get("C:/tmp/rpg-project/wiki/events/brass-light.md")).toBe(
      "# Brass Light\n\nThe lantern key flared.\n",
    )
  })

  it("rejects invalid runtime write targets without creating files", async () => {
    const result = await applyRpgPendingUpdates({
      projectPath: "C:/tmp/rpg-project",
      updates: [
        acceptedUpdate("legacy", "wiki/entities/ghost.md", "merge", "LEGACY_POISON"),
        acceptedUpdate("outside", "wiki/events/../../outside.md", "append", "OUTSIDE_POISON"),
      ],
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates.map((update) => update.id)).toEqual(["legacy", "outside"])
    expect(result.warnings.join("\n")).toContain("outside allowed runtime update paths")
    expect([...fsMock.files.keys()]).toEqual([])
  })
})

function acceptedUpdate(
  id: string,
  targetPath: string,
  strategy: RpgUpdateStrategy,
  content: string,
): PendingRpgUpdate {
  return {
    id,
    targetPath,
    strategy,
    reason: "Test update.",
    content,
    sourceTurnId: "turn-test",
    references: [],
    status: "accepted",
  }
}
