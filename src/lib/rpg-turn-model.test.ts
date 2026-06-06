import { describe, expect, it, afterEach } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { createRpgTurnRecord } from "./rpg-runtime"
import type { RpgTurnResult, SubmittedAction } from "./rpg-runtime"

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

    const record = createRpgTurnRecord({ submittedAction, turnResult })

    expect(record).toEqual({
      submittedAction,
      generatedNarrative: turnResult.narrative,
      references: ["wiki/characters/mira.md", "wiki/current-scene/scene_state.md"],
    })
  })

  it("keeps generated narrative but excludes next action options from the record", () => {
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
      submittedAction: { id: "act-2", text: "Lift the lantern toward the lock.", source: "freeform" },
      turnResult,
    })
    const serializedRecord = JSON.stringify(record)

    expect(record.generatedNarrative).toContain("brass lantern flares")
    expect("nextActionOptions" in record).toBe(false)
    expect(serializedRecord).not.toContain("Leave Mira behind")
    expect(serializedRecord).not.toContain("opt-avoid-mira")
    expect(serializedRecord).not.toContain("wiki/relationships/iven-mira.md")
  })

  it("normalizes, deduplicates, sorts, and filters references", () => {
    const record = createRpgTurnRecord({
      submittedAction: {
        id: "act-3",
        text: "Check the courtyard, then compare notes with Mira.",
        source: "selected_option",
        selectedOptionId: "opt-check-yard",
      },
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
          "wiki/world//shrines.md",
          "wiki/entities/legacy-poison.md",
          "wiki/concepts/legacy-poison.md",
          "wiki/queries/old-answer.md",
          "notes/wiki/events/not-under-wiki.md",
        ],
      },
    })

    expect(record.references).toEqual([
      "wiki/characters/mira.md",
      "wiki/events/session-04.md",
      "wiki/locations/courtyard.md",
      "wiki/world/shrines.md",
    ])
  })

  it("does not write any wiki files while creating a turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-model-readonly") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe door is closed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe door was discovered.")

    const before = await snapshotFiles(projectPath)
    createRpgTurnRecord({
      submittedAction: { id: "act-4", text: "Listen at the closed door.", source: "freeform" },
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
