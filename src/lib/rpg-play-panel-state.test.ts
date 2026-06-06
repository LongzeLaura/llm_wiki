import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createRpgPlayPanelState,
  createSubmittedActionFromFreeform,
  createSubmittedActionFromOption,
  getRpgPlayPanelSemanticBuckets,
  selectRpgPlayPanelOption,
  setRpgPlayPanelFreeformText,
  submitRpgPlayPanelFreeformAction,
  submitSelectedRpgPlayPanelOption,
} from "./rpg-runtime/play-panel-state"
import type { RpgActionOption } from "./rpg-runtime"

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

describe("RPG Play Panel state", () => {
  it("models current scene, last narrative, future options, freeform text, and selected option", () => {
    const state = createRpgPlayPanelState({
      currentScene: "Iven and Mira face the canal gate.",
      lastNarrative: "The brass key warmed in Iven's palm.",
      nextActionOptions: sampleOptions(),
      freeformActionText: "Ask Mira to read the sigil.",
    })

    const selected = selectRpgPlayPanelOption(state, "opt-talk")

    expect(selected.currentScene).toContain("canal gate")
    expect(selected.lastNarrative).toContain("brass key")
    expect(selected.nextActionOptions).toHaveLength(3)
    expect(selected.freeformActionText).toBe("Ask Mira to read the sigil.")
    expect(selected.selectedOptionId).toBe("opt-talk")
  })

  it("constructs a selected-option SubmittedAction with selectedOptionId", () => {
    const option = sampleOptions()[0]

    expect(createSubmittedActionFromOption(option, "act-1")).toEqual({
      id: "act-1",
      text: option.playerFacingText,
      source: "selected_option",
      selectedOptionId: option.id,
    })
  })

  it("constructs a freeform SubmittedAction without selectedOptionId", () => {
    const action = createSubmittedActionFromFreeform("  Circle the gate and search for a hinge.  ", "act-2")

    expect(action).toEqual({
      id: "act-2",
      text: "Circle the gate and search for a hinge.",
      source: "freeform",
    })
    expect(action).not.toHaveProperty("selectedOptionId")
  })

  it("records submitted actions without turning unselected options into completed facts", () => {
    const selected = submitSelectedRpgPlayPanelOption(
      selectRpgPlayPanelOption(
        createRpgPlayPanelState({
          currentScene: "The canal gate blocks the lower tunnel.",
          lastNarrative: "Mira points out a hairline crack in the sigil.",
          nextActionOptions: sampleOptions(),
        }),
        "opt-talk",
      ),
      "act-3",
    )
    const buckets = getRpgPlayPanelSemanticBuckets(selected)

    expect(buckets.submittedAction).toEqual({
      id: "act-3",
      text: "Ask Mira what the cracked sigil means before touching it.",
      source: "selected_option",
      selectedOptionId: "opt-talk",
    })
    expect(buckets.completedNarrative).toContain("hairline crack")
    expect(buckets.futureCandidateActions).toContain("Force the canal gate before the patrol returns.")
    expect(buckets.completedNarrative).not.toContain("Force the canal gate")
    expect(JSON.stringify(buckets.submittedAction)).not.toContain("Wait in silence and watch the patrol route.")
    expect(buckets.pendingWikiUpdates).toEqual([])
  })

  it("submits freeform text independently of a previously selected option", () => {
    const selected = selectRpgPlayPanelOption(
      createRpgPlayPanelState({
        currentScene: "The gate is still sealed.",
        nextActionOptions: sampleOptions(),
      }),
      "opt-force",
    )
    const typed = setRpgPlayPanelFreeformText(selected, "Look for an older service latch instead.")
    const submitted = submitRpgPlayPanelFreeformAction(typed, "act-4")

    expect(submitted.submittedAction).toEqual({
      id: "act-4",
      text: "Look for an older service latch instead.",
      source: "freeform",
    })
    expect(submitted.submittedAction).not.toHaveProperty("selectedOptionId")
    expect(submitted.selectedOptionId).toBeNull()
  })

  it("does not read or write wiki files while updating play-panel state", async () => {
    ctx = { tmp: await createTempProject("rpg-play-panel-state-readonly") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe gate is sealed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe gate was found.")

    const before = await snapshotFiles(projectPath)
    const state = createRpgPlayPanelState({
      currentScene: "The gate is sealed.",
      lastNarrative: "No one has forced it yet.",
      nextActionOptions: sampleOptions(),
    })
    getRpgPlayPanelSemanticBuckets(submitSelectedRpgPlayPanelOption(selectRpgPlayPanelOption(state, "opt-talk"), "act-5"))
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The gate is sealed.")
  })
})

function sampleOptions(): RpgActionOption[] {
  return [
    {
      id: "opt-talk",
      playerFacingText: "Ask Mira what the cracked sigil means before touching it.",
      intent: "talk",
      riskLevel: "low",
      likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
    },
    {
      id: "opt-force",
      playerFacingText: "Force the canal gate before the patrol returns.",
      intent: "fight",
      riskLevel: "high",
      likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/events/session-03.md"],
    },
    {
      id: "opt-wait",
      playerFacingText: "Wait in silence and watch the patrol route.",
      intent: "wait",
      riskLevel: "medium",
      likelyAffectedPaths: ["wiki/plot-arcs/canal-gate.md"],
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
