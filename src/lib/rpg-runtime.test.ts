import { describe, it, expect, afterEach, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, realFs, writeFileRaw, readFileRaw } from "@/test-helpers/fs-temp"
import { runRpgRuntimePreview } from "./rpg-runtime"
import type { SubmittedAction } from "./rpg-runtime"

vi.mock("@/commands/fs", () => realFs)

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

describe("RPG Runtime Agent v0", () => {
  it("accepts a SubmittedAction and returns a compact read-only story brief", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-preview") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(
      `${projectPath}/wiki/current-scene/scene_state.md`,
      [
        "# Current Scene",
        "",
        "Iven and Mira are beneath the River Port, facing a locked canal gate.",
        "",
        "## Next Action Options",
        "- Abandon Mira and flee through the old sluice.",
      ].join("\n"),
    )
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
    await writeFileRaw(`${projectPath}/wiki/style/narrative.md`, "# Style\n\nMust keep prose tense and grounded.")
    await writeFileRaw(`${projectPath}/wiki/rules/magic.md`, "# Rules\n\nCannot open a warded gate without a key or ritual.")
    await writeFileRaw(`${projectPath}/wiki/memory/manual.md`, "# Memory\n\nMira dislikes grandstanding.")
    await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nMira bargained with a dock runner.")
    await writeFileRaw(`${projectPath}/wiki/plot-arcs/canal-gate.md`, "# Canal Gate\n\nThe sealed gate remains a pressure point.")
    await writeFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`, "# Iven and Mira\n\nTrust is rising but still fragile.")
    await writeFileRaw(`${projectPath}/wiki/sources/session-02.md`, "# Source\n\nThis source summary must not become a hard fact.")

    const submittedAction: SubmittedAction = {
      id: "act-1",
      text: "I show Mira the lantern key and ask whether the gate can be opened quietly.",
      source: "freeform",
    }

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
    })

    expect(result.submittedAction).toEqual(submittedAction)
    expect(result.brief.submittedAction).toEqual(submittedAction)
    expect(result.brief.currentScene).toContain("locked canal gate")
    expect(result.brief.currentScene).not.toContain("Abandon Mira")
    expect(result.brief.playerState).toContain("Smuggler-mage")
    expect(result.brief.styleRules.join("\n")).toContain("tense and grounded")
    expect(result.brief.ruleNotes.join("\n")).toContain("warded gate")
    expect(result.brief.memoryNotes.join("\n")).toContain("grandstanding")
    expect(result.brief.relationshipTensions.join("\n")).toContain("fragile")
    expect(result.brief.activePlotPressure.join("\n")).toContain("pressure point")
    expect(result.brief.hardFacts.join("\n")).toContain("dock runner")
    expect(result.brief.hardFacts.join("\n")).not.toContain("This source summary")
    expect(result.brief.references).toContain("wiki/sources/session-02.md")
  })

  it("ignores legacy directories even when they exist on disk", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-legacy-ignore") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nA quiet room.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nPresent.")
    await writeFileRaw(`${projectPath}/wiki/entities/legacy.md`, "# Legacy Entity\n\nLEGACY_ENTITY_POISON")
    await writeFileRaw(`${projectPath}/wiki/concepts/legacy.md`, "# Legacy Concept\n\nLEGACY_CONCEPT_POISON")
    await writeFileRaw(`${projectPath}/wiki/queries/old-answer.md`, "# Old Query\n\nLEGACY_QUERY_POISON")
    await writeFileRaw(`${projectPath}/wiki/synthesis/old.md`, "# Old Synthesis\n\nLEGACY_SYNTHESIS_POISON")

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Wait quietly.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    const serializedBrief = JSON.stringify(result.brief)
    expect(serializedBrief).not.toContain("LEGACY_ENTITY_POISON")
    expect(serializedBrief).not.toContain("LEGACY_CONCEPT_POISON")
    expect(serializedBrief).not.toContain("LEGACY_QUERY_POISON")
    expect(serializedBrief).not.toContain("LEGACY_SYNTHESIS_POISON")
    expect(result.brief.references.some((ref) => ref.includes("wiki/entities/"))).toBe(false)
    expect(result.brief.references.some((ref) => ref.includes("wiki/concepts/"))).toBe(false)
    expect(result.brief.references.some((ref) => ref.includes("wiki/queries/"))).toBe(false)
  })

  it("retrieves relevant base character pages together with runtime overlays", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-overlay") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nRin waits near the school gate.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nThe current PC is watching Rin.")
    await writeFileRaw(
      `${projectPath}/wiki/characters/rin.md`,
      "# Rin Tohsaka\n\nBase page: Rin is sharp, proud, and careful with magic.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/characters/runtime/rin.md`,
      "# Rin Runtime State\n\nOverlay page: Rin is currently injured and suspicious of the player.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/characters/saber.md`,
      "# Saber\n\nThis unrelated page describes a distant guardian.",
    )

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Ask Rin why she is hiding her injury.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    const characters = result.brief.presentCharacters.join("\n")
    expect(characters).toContain("Base page: Rin")
    expect(characters).toContain("Overlay page: Rin")
    expect(characters).not.toContain("Saber")
    expect(result.brief.references).toContain("wiki/characters/rin.md")
    expect(result.brief.references).toContain("wiki/characters/runtime/rin.md")
  })

  it("does not write any wiki files during stage 1 preview", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-readonly") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nThe door is closed.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nReady.")
    await writeFileRaw(`${projectPath}/wiki/events/session-01.md`, "# Session 01\n\nThe door was discovered.")

    const before = await snapshotFiles(projectPath)
    await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Listen at the closed door.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("The door is closed.")
  })

  it("warns when the fixed current-scene snapshot is missing", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-missing-scene") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nReady.")

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Look around.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    expect(result.warnings).toContain("Missing required RPG runtime page: wiki/current-scene/scene_state.md")
    expect(result.brief.currentScene).toBe("")
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
