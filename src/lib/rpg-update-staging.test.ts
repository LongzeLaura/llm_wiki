import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  acceptPendingRpgUpdate,
  createPendingRpgUpdates,
  rejectPendingRpgUpdate,
  type ProposedWikiUpdate,
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

describe("RPG Update Staging", () => {
  it("creates pending updates with pending status by default", () => {
    const proposedUpdates = sampleProposedUpdates()

    const pending = createPendingRpgUpdates(proposedUpdates)

    expect(pending).toEqual([
      { ...proposedUpdates[0], references: ["wiki/current-scene/scene_state.md"], status: "pending" },
      { ...proposedUpdates[1], references: ["wiki/events/canal-gate-sigil.md"], status: "pending" },
    ])
    expect(pending.every((update) => update.status === "pending")).toBe(true)
  })

  it("accepts a specified pending update without changing other updates", () => {
    const pending = createPendingRpgUpdates(sampleProposedUpdates())

    const updated = acceptPendingRpgUpdate(pending, "update-current-scene")

    expect(updated[0]).toEqual({ ...pending[0], status: "accepted" })
    expect(updated[1]).toBe(pending[1])
    expect(pending[0].status).toBe("pending")
  })

  it("rejects a specified pending update without changing other updates", () => {
    const pending = createPendingRpgUpdates(sampleProposedUpdates())

    const updated = rejectPendingRpgUpdate(pending, "update-event")

    expect(updated[0]).toBe(pending[0])
    expect(updated[1]).toEqual({ ...pending[1], status: "rejected" })
    expect(pending[1].status).toBe("pending")
  })

  it("leaves pending updates unchanged when the id is unknown", () => {
    const pending = createPendingRpgUpdates(sampleProposedUpdates())

    const updated = acceptPendingRpgUpdate(pending, "missing-update")

    expect(updated).toEqual(pending)
    expect(updated[0]).toBe(pending[0])
    expect(updated[1]).toBe(pending[1])
  })

  it("does not read or write wiki files while staging updates", async () => {
    ctx = { tmp: await createTempProject("rpg-update-staging-readonly") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe gate is sealed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-04.md`, "# Session 04\n\nThe seal was found.")

    const before = await snapshotFiles(projectPath)
    const pending = createPendingRpgUpdates(sampleProposedUpdates())
    const accepted = acceptPendingRpgUpdate(pending, "update-current-scene")
    rejectPendingRpgUpdate(accepted, "update-event")
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The gate is sealed.")
  })
})

function sampleProposedUpdates(): ProposedWikiUpdate[] {
  return [
    {
      id: "update-current-scene",
      targetPath: "wiki/current-scene/scene_state.md",
      strategy: "overwrite",
      reason: "Keep current scene aligned.",
      content: "# Current Scene\n\nThe canal gate is glowing.",
      sourceTurnId: "turn-5",
      references: ["wiki/current-scene/scene_state.md"],
    },
    {
      id: "update-event",
      targetPath: "wiki/events/canal-gate-sigil.md",
      strategy: "append",
      reason: "Record completed history.",
      content: "# Canal Gate Sigil\n\nThe sigil answered the lantern key.",
      sourceTurnId: "turn-5",
      references: ["wiki/events/canal-gate-sigil.md"],
    },
  ]
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
