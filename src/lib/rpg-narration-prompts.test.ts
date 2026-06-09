import { describe, expect, it, afterEach } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { buildRpgNarrationPrompt } from "./rpg-interactions/runtime"
import type { CompactStoryBrief } from "./rpg-runtime"

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

describe("RPG Narration Prompt Builder", () => {
  it("builds system and user prompts from a CompactStoryBrief", () => {
    const prompt = buildRpgNarrationPrompt({ brief: sampleBrief() })

    expect(prompt.systemPrompt).toContain("llmWikiRPG narration runtime")
    expect(prompt.userPrompt).toContain("# RPG Narration Brief")
    expect(prompt.userPrompt).toContain("## Submitted Action")
  })

  it("includes the submitted action and compact story context fields", () => {
    const { systemPrompt, userPrompt } = buildRpgNarrationPrompt({ brief: sampleBrief() })
    const combined = `${systemPrompt}\n${userPrompt}`

    expect(combined).toContain("I show Mira the lantern key and ask whether the canal gate can open quietly.")
    expect(combined).toContain("Iven and Mira are beneath the River Port")
    expect(combined).toContain("Smuggler-mage carrying a brass lantern key")
    expect(combined).toContain("The River Port is under curfew")
    expect(combined).toContain("Trust between Iven and Mira is rising but fragile")
    expect(combined).toContain("The sealed canal gate is an active pressure point")
    expect(combined).toContain("The main outline keeps the gate patron hidden until the sigil is decoded")
    expect(combined).toContain("Open the canal gate without alerting the Harbor Watch")
    expect(combined).toContain("Keep prose tense and grounded")
    expect(combined).toContain("Cannot open a warded gate without a key or ritual")
    expect(combined).toContain("Mira dislikes grandstanding")
    expect(combined).toContain("Never reveal the gate's patron before the sigil is decoded")
    expect(combined).toContain("wiki/current-scene/scene_state.md")
  })

  it("requires an RpgTurnResult-compatible output shape", () => {
    const { systemPrompt } = buildRpgNarrationPrompt({ brief: sampleBrief() })

    expect(systemPrompt).toContain("\"narrative\": string")
    expect(systemPrompt).toContain("\"nextActionOptions\": RpgActionOption[]")
    expect(systemPrompt).toContain("\"references\": string[]")
  })

  it("requires 3 to 5 next action options with the allowed fields and enums", () => {
    const { systemPrompt } = buildRpgNarrationPrompt({ brief: sampleBrief() })

    expect(systemPrompt).toContain("Produce 3 to 5 nextActionOptions")
    expect(systemPrompt).toContain("id: string")
    expect(systemPrompt).toContain("playerFacingText: string")
    expect(systemPrompt).toContain("intent: one of investigate, talk, fight, move, wait, use_item, custom")
    expect(systemPrompt).toContain("riskLevel: one of low, medium, high")
    expect(systemPrompt).toContain("likelyAffectedPaths: string[]")
    expect(systemPrompt).toContain("Allowed intent values: investigate, talk, fight, move, wait, use_item, custom.")
    expect(systemPrompt).toContain("Allowed riskLevel values: low, medium, high.")
  })

  it("marks unchosen options as non-factual future candidates", () => {
    const { systemPrompt } = buildRpgNarrationPrompt({ brief: sampleBrief() })

    expect(systemPrompt).toContain("Unchosen nextActionOptions are candidate future actions only")
    expect(systemPrompt).toContain("must not appear inside narrative as completed outcomes")
    expect(systemPrompt).toContain("must not extract facts from unchosen nextActionOptions")
  })

  it("does not instruct the model to perform later writeback stages", () => {
    const { systemPrompt } = buildRpgNarrationPrompt({ brief: sampleBrief() })

    expect(systemPrompt).toContain("Do not perform wiki writes")
    expect(systemPrompt).not.toMatch(/append\s+events/i)
    expect(systemPrompt).not.toMatch(/overwrite\s+current-scene/i)
    expect(systemPrompt).not.toMatch(/generate\s+pending\s+updates/i)
    expect(systemPrompt).not.toMatch(/update\s+relationships/i)
  })

  it("does not read or write wiki files while building prompts", async () => {
    ctx = { tmp: await createTempProject("rpg-narration-contract-readonly") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe door is closed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe door was discovered.")

    const before = await snapshotFiles(projectPath)
    buildRpgNarrationPrompt({ brief: sampleBrief() })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The door is closed.")
  })
})

function sampleBrief(): CompactStoryBrief {
  return {
    submittedAction: {
      id: "act-1",
      text: "I show Mira the lantern key and ask whether the canal gate can open quietly.",
      source: "freeform",
    },
    currentScene: "Iven and Mira are beneath the River Port, facing a locked canal gate.",
    playerState: "Smuggler-mage carrying a brass lantern key.",
    hardFacts: ["The River Port is under curfew.", "Mira bargained with a dock runner last session."],
    activeConstraints: ["Do not resolve the gate without visible cost."],
    presentCharacters: ["Mira is alert, injured, and suspicious of loud magic."],
    relationshipTensions: ["Trust between Iven and Mira is rising but fragile."],
    activePlotPressure: ["The sealed canal gate is an active pressure point."],
    outlineNotes: ["The main outline keeps the gate patron hidden until the sigil is decoded."],
    activeQuests: ["Open the canal gate without alerting the Harbor Watch."],
    relevantLocations: ["wiki/locations/river-port.md: Old sluices connect to the lower city."],
    relevantFactions: ["wiki/factions/harbor-watch.md: Patrols enforce the curfew."],
    relevantItems: ["wiki/items/lantern-key.md: Brass key tied to canal wards."],
    styleRules: ["Keep prose tense and grounded."],
    ruleNotes: ["Cannot open a warded gate without a key or ritual."],
    memoryNotes: ["Mira dislikes grandstanding."],
    forbiddenContradictions: ["Never reveal the gate's patron before the sigil is decoded."],
    references: [
      "wiki/current-scene/scene_state.md",
      "wiki/player/player.md",
      "wiki/relationships/iven-mira.md",
    ],
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
