import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createPendingRpgUpdates,
  createRpgTurnRecord,
  extractRpgStateUpdates,
  type RpgTurnRecord,
  type RpgTurnResult,
} from "./rpg-runtime"
import {
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

describe("RPG State Update Extractor", () => {
  it("extracts proposed updates from an explicit completed turn record", () => {
    const turnRecord = sampleCompletedTurnRecord()

    const result = extractRpgStateUpdates({ turnRecord })

    expect(result.warnings).toEqual([])
    expect(result.proposedUpdates).toHaveLength(6)
    expect(result.proposedUpdates.map((update) => [update.targetPath, update.strategy])).toEqual([
      ["wiki/current-scene/scene_state.md", "overwrite"],
      ["wiki/events/canal-gate-sigil.md", "append"],
      ["wiki/player/player.md", "merge"],
      ["wiki/quests/main.md", "merge"],
      ["wiki/relationships/runtime/iven-mira.md", "merge"],
      ["wiki/characters/runtime/mira.md", "merge"],
    ])
    expect(result.proposedUpdates.every((update) => update.sourceTurnId === "turn-5")).toBe(true)
    expect(result.proposedUpdates.every((update) => update.reason.length > 0)).toBe(true)
    expect(result.proposedUpdates.every((update) => update.content.length > 0)).toBe(true)
    expect(result.proposedUpdates.every((update) => update.id.startsWith("rpg-update-turn-5-"))).toBe(true)
    expect(result.proposedUpdates.every((update) => update.references.includes("wiki/current-scene/scene_state.md"))).toBe(true)
  })

  it("does not let unchosen option text enter proposed or pending update serialization", () => {
    const unchosenPlayerFacingText = "Force the canal gate before Mira finishes reading the sigil."
    const turnResult: RpgTurnResult = {
      narrative: updateBlocks([
        {
          targetPath: "wiki/events/canal-gate-sigil.md",
          strategy: "append",
          reason: "Record the completed sigil inspection.",
          content: "# Canal Gate Sigil\n\nIven waited while Mira inspected the lowest sigil.",
        },
      ]),
      nextActionOptions: [
        {
          id: "opt-force",
          playerFacingText: unchosenPlayerFacingText,
          intent: "fight",
          riskLevel: "high",
          likelyAffectedPaths: ["wiki/events/canal-gate-forced.md"],
        },
      ],
      references: ["wiki/events/canal-gate-sigil.md"],
    }
    const submittedAction = { id: "turn-6", text: "Wait for Mira to inspect the sigil.", source: "freeform" } as const
    const turnRecord = createRpgTurnRecord({
      submittedAction,
      ...sampleTurnRecordRuntimeParts(submittedAction),
      turnNarration: sampleTurnNarration({ playerFacingText: turnResult.narrative }),
      turnResult,
    })

    const proposed = extractRpgStateUpdates({ turnRecord }).proposedUpdates
    const pending = createPendingRpgUpdates(proposed)

    expect(JSON.stringify(turnRecord)).not.toContain(unchosenPlayerFacingText)
    expect(JSON.stringify(proposed)).not.toContain(unchosenPlayerFacingText)
    expect(JSON.stringify(pending)).not.toContain(unchosenPlayerFacingText)
  })

  it("supports current-scene, events, player, quests, relationships, and runtime overlay targets", () => {
    const proposedUpdates = extractRpgStateUpdates({ turnRecord: sampleCompletedTurnRecord() }).proposedUpdates

    expect(proposedUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetPath: "wiki/current-scene/scene_state.md", strategy: "overwrite" }),
        expect.objectContaining({ targetPath: "wiki/events/canal-gate-sigil.md", strategy: "append" }),
        expect.objectContaining({ targetPath: "wiki/player/player.md", strategy: "merge" }),
        expect.objectContaining({ targetPath: "wiki/quests/main.md", strategy: "merge" }),
        expect.objectContaining({ targetPath: "wiki/relationships/runtime/iven-mira.md", strategy: "merge" }),
        expect.objectContaining({ targetPath: "wiki/characters/runtime/mira.md", strategy: "merge" }),
      ]),
    )
  })

  it("filters legacy paths and base entity pages instead of proposing runtime updates for them", () => {
    const generatedNarrative = updateBlocks([
      {
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        reason: "Keep the next-turn snapshot current.",
        content: "# Current Scene\n\nIven studies the shrine ledger.",
      },
      {
        targetPath: "wiki/entities/legacy-ledger.md",
        strategy: "merge",
        reason: "This legacy path must be filtered.",
        content: "LEGACY_ENTITY_POISON",
      },
      {
        targetPath: "wiki/concepts/ledger-theory.md",
        strategy: "merge",
        reason: "This legacy concept path must be filtered.",
        content: "LEGACY_CONCEPT_POISON",
      },
      {
        targetPath: "wiki/memory/manual.md",
        strategy: "merge",
        reason: "Memory pages require explicit user action.",
        content: "MEMORY_POISON",
      },
      {
        targetPath: "wiki/characters/mira.md",
        strategy: "merge",
        reason: "Base character pages are stable setting, not runtime update targets.",
        content: "BASE_CHARACTER_POISON",
      },
      {
        targetPath: "wiki/locations/river-port.md",
        strategy: "merge",
        reason: "Base location pages are stable setting, not runtime update targets.",
        content: "BASE_LOCATION_POISON",
      },
      {
        targetPath: "wiki/factions/harbor-watch.md",
        strategy: "merge",
        reason: "Base faction pages are stable setting, not runtime update targets.",
        content: "BASE_FACTION_POISON",
      },
      {
        targetPath: "wiki/items/lantern-key.md",
        strategy: "merge",
        reason: "Base item pages are stable setting, not runtime update targets.",
        content: "BASE_ITEM_POISON",
      },
      {
        targetPath: "wiki/world/basic_overview.md",
        strategy: "merge",
        reason: "World pages are stable setting.",
        content: "WORLD_POISON",
      },
      {
        targetPath: "wiki/style/narrative.md",
        strategy: "merge",
        reason: "Style pages are manually controlled.",
        content: "STYLE_POISON",
      },
      {
        targetPath: "wiki/rules/magic.md",
        strategy: "merge",
        reason: "Rules pages are manually controlled.",
        content: "RULES_POISON",
      },
    ])
    const turnRecord: RpgTurnRecord = {
      submittedAction: { id: "turn-7", text: "Check the shrine ledger.", source: "freeform" },
      ...sampleTurnRecordRuntimeParts({ id: "turn-7", text: "Check the shrine ledger.", source: "freeform" }),
      turnNarration: sampleTurnNarration({ playerFacingText: generatedNarrative }),
      generatedNarrative,
      references: ["wiki/current-scene/scene_state.md", "wiki/entities/legacy-ledger.md"],
    }

    const result = extractRpgStateUpdates({ turnRecord })
    const serialized = JSON.stringify(result.proposedUpdates)

    expect(result.proposedUpdates).toHaveLength(1)
    expect(result.proposedUpdates[0].targetPath).toBe("wiki/current-scene/scene_state.md")
    expect(result.warnings).toHaveLength(10)
    expect(serialized).not.toContain("LEGACY_ENTITY_POISON")
    expect(serialized).not.toContain("LEGACY_CONCEPT_POISON")
    expect(serialized).not.toContain("BASE_CHARACTER_POISON")
    expect(serialized).not.toContain("BASE_LOCATION_POISON")
    expect(serialized).not.toContain("BASE_FACTION_POISON")
    expect(serialized).not.toContain("BASE_ITEM_POISON")
    expect(serialized).not.toContain("WORLD_POISON")
    expect(serialized).not.toContain("STYLE_POISON")
    expect(serialized).not.toContain("RULES_POISON")
    expect(serialized).not.toContain("MEMORY_POISON")
    expect(result.proposedUpdates[0].references).toEqual(["wiki/current-scene/scene_state.md"])
  })

  it("filters blocks whose strategy does not match the target path", () => {
    const generatedNarrative = updateBlocks([
      {
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "merge",
        reason: "Wrong strategy for current scene.",
        content: "# Current Scene\n\nWrong strategy.",
      },
      {
        targetPath: "wiki/events/lower-lock.md",
        strategy: "merge",
        reason: "Wrong strategy for events.",
        content: "# Lower Lock\n\nWrong strategy.",
      },
    ])
    const turnRecord: RpgTurnRecord = {
      submittedAction: { id: "turn-8", text: "Open the lower lock.", source: "freeform" },
      ...sampleTurnRecordRuntimeParts({ id: "turn-8", text: "Open the lower lock.", source: "freeform" }),
      turnNarration: sampleTurnNarration({ playerFacingText: generatedNarrative }),
      generatedNarrative,
      references: [],
    }

    const result = extractRpgStateUpdates({ turnRecord })

    expect(result.proposedUpdates).toEqual([])
    expect(result.warnings.join("\n")).toContain('requires strategy "overwrite"')
    expect(result.warnings.join("\n")).toContain('requires strategy "append"')
  })

  it("does not read or write wiki files while extracting proposed updates", async () => {
    ctx = { tmp: await createTempProject("rpg-state-extractor-readonly") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe canal gate is closed.")
    await writeFileRaw(`${projectPath}/wiki/events/session-04.md`, "# Session 04\n\nThe gate was found.")

    const before = await snapshotFiles(projectPath)
    extractRpgStateUpdates({ turnRecord: sampleCompletedTurnRecord() })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The canal gate is closed.")
  })
})

function sampleCompletedTurnRecord(): RpgTurnRecord {
  const submittedAction = {
    id: "turn-5",
    text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
    source: "freeform" as const,
  }
  const generatedNarrative = updateBlocks([
    {
      targetPath: "wiki/current-scene/scene_state.md",
      strategy: "overwrite",
      reason: "Keep the next-turn scene snapshot aligned with the completed turn.",
      content: "# Current Scene\n\nIven and Mira remain at the locked canal gate while the lowest sigil glows.",
    },
    {
      targetPath: "wiki/events/canal-gate-sigil.md",
      strategy: "append",
      reason: "Record the completed sigil inspection as happened history.",
      content: "# Canal Gate Sigil\n\nMira inspected the lowest sigil and Iven's lantern key answered with brass light.",
    },
    {
      targetPath: "wiki/player/player.md",
      strategy: "merge",
      reason: "Update the player state after using the lantern key.",
      content: "## Current State\n\nIven knows the lantern key reacts to the canal gate's lowest sigil.",
    },
    {
      targetPath: "wiki/quests/main.md",
      strategy: "merge",
      reason: "Track objective progress after the completed sigil inspection.",
      content: "## Current Objective\n\nThe canal gate objective is blocked until Iven decides how to use the lantern key.",
    },
    {
      targetPath: "wiki/relationships/runtime/iven-mira.md",
      strategy: "merge",
      reason: "Update trust after Iven waited for Mira's reading.",
      content: "## Current Tension\n\nMira is wary but appreciates that Iven did not force the gate.",
    },
    {
      targetPath: "wiki/characters/runtime/mira.md",
      strategy: "merge",
      reason: "Update Mira's runtime-only condition.",
      content: "## Current State\n\nMira is limping but focused on reading canal sigils.",
    },
  ])
  return {
    submittedAction,
    ...sampleTurnRecordRuntimeParts(submittedAction),
    turnNarration: sampleTurnNarration({ playerFacingText: generatedNarrative }),
    generatedNarrative,
    references: [
      "wiki/current-scene/scene_state.md",
      "wiki/player/player.md",
      "wiki/characters/runtime/mira.md",
      "wiki/entities/legacy-poison.md",
    ],
  }
}

function updateBlocks(
  blocks: Array<{
    targetPath: string
    strategy: string
    reason: string
    content: string
  }>,
): string {
  return [
    "Mira studies the sigil while the lantern key warms in Iven's palm.",
    "",
    ...blocks.map((block) =>
      [
        "```rpg-wiki-update",
        `targetPath: ${block.targetPath}`,
        `strategy: ${block.strategy}`,
        `reason: ${block.reason}`,
        "---",
        block.content,
        "```",
      ].join("\n"),
    ),
  ].join("\n\n")
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
