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
    await writeFileRaw(`${projectPath}/wiki/player/abilities.md`, "# Abilities\n\nQuiet lock rituals.")
    await writeFileRaw(`${projectPath}/wiki/player/inventory.md`, "# Inventory\n\nA brass lantern key.")
    await writeFileRaw(`${projectPath}/wiki/player/goals.md`, "# Goals\n\nOpen the canal gate.")
    await writeFileRaw(`${projectPath}/wiki/player/known_information.md`, "# Known Information\n\nThe gate is warded.")
    await writeFileRaw(`${projectPath}/wiki/player/custom.md`, "# Custom\n\nPLAYER_CUSTOM_POISON.")
    await writeFileRaw(`${projectPath}/wiki/outlines/main.md`, "# Main Outline\n\nKeep the gate patron hidden until the sigil is decoded.")
    await writeFileRaw(`${projectPath}/wiki/outlines/progress.md`, "# Outline Progress\n\nThe canal gate beat is active.")
    await writeFileRaw(`${projectPath}/wiki/style/narrative.md`, "# Style\n\nMust keep prose tense and grounded.")
    await writeFileRaw(`${projectPath}/wiki/rules/magic.md`, "# Rules\n\nCannot open a warded gate without a key or ritual.")
    await writeFileRaw(`${projectPath}/wiki/memory/manual.md`, "# Memory\n\nMira dislikes grandstanding.")
    await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nMira bargained with a dock runner.")
    await writeFileRaw(`${projectPath}/wiki/plot-arcs/canal-gate.md`, "# Canal Gate\n\nThe sealed gate remains a pressure point.")
    await writeFileRaw(
      `${projectPath}/wiki/quests/main.md`,
      [
        "# Main Quest",
        "",
        "Open the canal gate without alerting the Harbor Watch.",
        "",
        "## Next Action Options",
        "- UNCHOSEN_QUEST_OPTION_POISON: abandon the gate and flee.",
      ].join("\n"),
    )
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
    expect(result.brief.playerState).toContain("Quiet lock rituals")
    expect(result.brief.playerState).not.toContain("PLAYER_CUSTOM_POISON")
    expect(result.brief.outlineNotes.join("\n")).toContain("gate patron hidden")
    expect(result.brief.outlineNotes.join("\n")).toContain("canal gate beat is active")
    expect(result.brief.styleRules.join("\n")).toContain("tense and grounded")
    expect(result.brief.ruleNotes.join("\n")).toContain("warded gate")
    expect(result.brief.memoryNotes.join("\n")).toContain("grandstanding")
    expect(result.brief.relationshipTensions.join("\n")).toContain("fragile")
    expect(result.brief.activePlotPressure.join("\n")).toContain("pressure point")
    expect(result.brief.activeQuests.join("\n")).toContain("Open the canal gate")
    expect(result.brief.hardFacts.join("\n")).toContain("dock runner")
    expect(result.brief.hardFacts.join("\n")).not.toContain("This source summary")
    expect(JSON.stringify(result.brief)).not.toContain("This source summary must not become")
    expect(result.brief.references).toContain("wiki/sources/session-02.md")
    expect(result.brief.references).toContain("wiki/outlines/main.md")
    expect(result.brief.references).toContain("wiki/outlines/progress.md")
    expect(result.brief.references).toContain("wiki/quests/main.md")
    expect(JSON.stringify(result.brief)).not.toContain("UNCHOSEN_QUEST_OPTION_POISON")
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

  it("retrieves relevant relationship and plot-arc pages together with runtime overlays", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-relationship-plot-overlay") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(
      `${projectPath}/wiki/current-scene/scene_state.md`,
      "# Current Scene\n\nNessa and Orin stand before the Moon Gate.",
    )
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nOrin is deciding whether to trust Nessa.")
    await writeFileRaw(
      `${projectPath}/wiki/relationships/nessa-orin.md`,
      [
        "# Nessa and Orin",
        "",
        "## Runtime Capsule",
        "- REL_BASE_D3: Nessa trusts Orin only when the Moon Gate truth is named.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/relationships/runtime/nessa-orin.md`,
      [
        "# Nessa and Orin Runtime",
        "",
        "## Current Tension",
        "- REL_OVERLAY_D3: Nessa is currently angry after Orin hid the gate key.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/relationships/distant-alliance.md`,
      "# Distant Alliance\n\nREL_UNRELATED_BASE_POISON: a treaty from another region.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/relationships/runtime/distant-alliance.md`,
      "# Distant Alliance Runtime\n\nREL_UNRELATED_RUNTIME_POISON: a dormant treaty status.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/moon-gate.md`,
      [
        "# Moon Gate",
        "",
        "## Runtime Capsule",
        "- ARC_BASE_D3: The Moon Gate pressure rises if the seal is named aloud.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/runtime/moon-gate.md`,
      [
        "# Moon Gate Runtime",
        "",
        "## Current Pressure",
        "- ARC_OVERLAY_D3: The seal has begun to crack after Orin's last ritual.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/ancient-crown.md`,
      "# Ancient Crown\n\nARC_UNRELATED_BASE_POISON: a dormant court mystery.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/runtime/ancient-crown.md`,
      "# Ancient Crown Runtime\n\nARC_UNRELATED_RUNTIME_POISON: a distant crown rumor.",
    )

    const before = await snapshotFiles(projectPath)
    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: {
        id: "act-1",
        text: "Ask Nessa whether the Moon Gate seal can still be repaired.",
        source: "freeform",
      },
      wikiMode: "llmwikirpg",
    })
    const after = await snapshotFiles(projectPath)

    const relationships = result.brief.relationshipTensions.join("\n")
    expect(relationships).toContain("REL_BASE_D3")
    expect(relationships).toContain("REL_OVERLAY_D3")
    expect(relationships).not.toContain("REL_UNRELATED_BASE_POISON")
    expect(relationships).not.toContain("REL_UNRELATED_RUNTIME_POISON")

    const plotArcs = result.brief.activePlotPressure.join("\n")
    expect(plotArcs).toContain("ARC_BASE_D3")
    expect(plotArcs).toContain("ARC_OVERLAY_D3")
    expect(plotArcs).not.toContain("ARC_UNRELATED_BASE_POISON")
    expect(plotArcs).not.toContain("ARC_UNRELATED_RUNTIME_POISON")

    expect(result.brief.references).toContain("wiki/relationships/nessa-orin.md")
    expect(result.brief.references).toContain("wiki/relationships/runtime/nessa-orin.md")
    expect(result.brief.references).toContain("wiki/plot-arcs/moon-gate.md")
    expect(result.brief.references).toContain("wiki/plot-arcs/runtime/moon-gate.md")
    expect(result.brief.references).not.toContain("wiki/relationships/distant-alliance.md")
    expect(result.brief.references).not.toContain("wiki/relationships/runtime/distant-alliance.md")
    expect(result.brief.references).not.toContain("wiki/plot-arcs/ancient-crown.md")
    expect(result.brief.references).not.toContain("wiki/plot-arcs/runtime/ancient-crown.md")
    expect(after).toEqual(before)
  })

  it("prefers character Runtime Capsule and portrayal sections over static evidence", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-character-capsule") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(
      `${projectPath}/wiki/current-scene/scene_state.md`,
      "# Current Scene\n\nSCENE_PRIORITY: Mira and Iven are pressed against the canal gate.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/player/player.md`,
      [
        "# Player",
        "",
        "## Current State",
        "- PLAYER_PRIORITY: Iven is holding the lantern key and hiding a shaking hand.",
        "",
        "## Long Biography",
        "- PLAYER_STATIC_POISON should not outrank current state.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/characters/mira.md`,
      [
        "# Mira",
        "",
        "## Runtime Capsule",
        "- CHARACTER_CAPSULE: Mira protects scared allies but distrusts theatrical magic.",
        "",
        "## Behavior Rules",
        "- CHARACTER_BEHAVIOR: If Iven asks softly, Mira tests the claim before agreeing.",
        "",
        "## Dialogue Style",
        "- CHARACTER_DIALOGUE: short, dry sentences; she deflects fear with practical questions.",
        "",
        "## Relationship Levers",
        "- CHARACTER_LEVER: calm honesty raises trust; grandstanding triggers withdrawal.",
        "",
        "## Canon Facts",
        "- CHARACTER_CANON_POISON: an exhaustive static biography should not be selected by default.",
        "",
        "## Evidence and Uncertainty",
        "- CHARACTER_EVIDENCE_POISON: citation trail and route trivia should stay out of the turn brief.",
      ].join("\n"),
    )
    await writeFileRaw(
      `${projectPath}/wiki/relationships/iven-mira.md`,
      [
        "# Iven and Mira",
        "",
        "## Runtime Capsule",
        "- RELATIONSHIP_PRIORITY: Trust is fragile but repairable if Iven stays honest.",
      ].join("\n"),
    )

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Ask Mira to help inspect the lantern key quietly.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    const characters = result.brief.presentCharacters.join("\n")
    const serializedBrief = JSON.stringify(result.brief)
    expect(result.brief.currentScene).toContain("SCENE_PRIORITY")
    expect(result.brief.playerState).toContain("PLAYER_PRIORITY")
    expect(result.brief.relationshipTensions.join("\n")).toContain("RELATIONSHIP_PRIORITY")
    expect(characters).toContain("CHARACTER_CAPSULE")
    expect(characters).toContain("CHARACTER_BEHAVIOR")
    expect(characters).toContain("CHARACTER_DIALOGUE")
    expect(characters).toContain("CHARACTER_LEVER")
    expect(serializedBrief).not.toContain("CHARACTER_CANON_POISON")
    expect(serializedBrief).not.toContain("CHARACTER_EVIDENCE_POISON")
    expect(serializedBrief).not.toContain("PLAYER_STATIC_POISON")
  })

  it("prefers location scene hooks and affordances over long history", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-location-capsule") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nIven reaches the River Port sluice.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nReady.")
    await writeFileRaw(
      `${projectPath}/wiki/locations/river-port.md`,
      [
        "# River Port",
        "",
        "## Runtime Capsule",
        "- LOCATION_CAPSULE: the port is a tense threshold where sound carries through old canals.",
        "",
        "## Scene Hooks",
        "- LOCATION_HOOK: a half-open sluice can be forced, bribed open, or used as cover.",
        "",
        "## Interactables",
        "- LOCATION_INTERACTABLE: rusted crank, tide bell, lock chain, and watch lantern.",
        "",
        "## Risks",
        "- LOCATION_RISK: loud metal draws the Harbor Watch within one exchange.",
        "",
        "## Clues",
        "- LOCATION_CLUE: fresh wax on the chain points to a recent hidden passage use.",
        "",
        "## Sensory Anchors",
        "- LOCATION_SENSORY: cold mist, tar, bell echoes, and wet rope fibers.",
        "",
        "## Long History",
        "- LOCATION_HISTORY_POISON: a multi-century geography article should not enter the runtime brief.",
      ].join("\n"),
    )

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Search the River Port sluice for clues before the watch arrives.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    const locations = result.brief.relevantLocations.join("\n")
    expect(locations).toContain("LOCATION_CAPSULE")
    expect(locations).toContain("LOCATION_HOOK")
    expect(locations).toContain("LOCATION_INTERACTABLE")
    expect(locations).toContain("LOCATION_RISK")
    expect(locations).toContain("LOCATION_CLUE")
    expect(locations).toContain("LOCATION_SENSORY")
    expect(JSON.stringify(result.brief)).not.toContain("LOCATION_HISTORY_POISON")
  })

  it("prefers relationship tension triggers and progression conditions over background encyclopedia", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-relationship-capsule") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nMira waits for Iven's answer.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nIven is trying not to lie.")
    await writeFileRaw(
      `${projectPath}/wiki/relationships/iven-mira.md`,
      [
        "# Iven and Mira",
        "",
        "## Runtime Capsule",
        "- REL_CAPSULE: fragile trust can become cooperation only if Iven names the risk.",
        "",
        "## Current Tension",
        "- REL_TENSION: Mira wants proof before she risks the gate.",
        "",
        "## Triggers",
        "- REL_TRIGGER: evasion lowers trust; admitting fear makes Mira soften.",
        "",
        "## Unresolved Questions",
        "- REL_QUESTION: Mira still does not know who gave Iven the key.",
        "",
        "## Progression Conditions",
        "- REL_PROGRESSION: cooperation unlocks after one concrete cost is accepted.",
        "",
        "## Background Encyclopedia",
        "- REL_BACKGROUND_POISON: a full relationship chronology should not be selected by default.",
      ].join("\n"),
    )

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Tell Mira the truth about the key and ask for help.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    const relationships = result.brief.relationshipTensions.join("\n")
    expect(relationships).toContain("REL_CAPSULE")
    expect(relationships).toContain("REL_TENSION")
    expect(relationships).toContain("REL_TRIGGER")
    expect(relationships).toContain("REL_QUESTION")
    expect(relationships).toContain("REL_PROGRESSION")
    expect(JSON.stringify(result.brief)).not.toContain("REL_BACKGROUND_POISON")
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

  it("warns when required schema slots are missing", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-missing-scene") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nReady.")

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Look around.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    expect(result.warnings).toContain("Missing required RPG schema slot: current_scene (wiki/current-scene/scene_state.md)")
    expect(result.warnings).toContain("Missing required RPG schema slot: player_abilities (wiki/player/abilities.md)")
    expect(result.brief.currentScene).toBe("")
  })

  it("does not use arbitrary player files to replace missing fixed player slots", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-fixed-player-slots") }
    const projectPath = ctx.tmp.path

    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nA quiet room.")
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Player\n\nPresent.")
    await writeFileRaw(`${projectPath}/wiki/player/custom-status.md`, "# Custom Status\n\nPLAYER_CUSTOM_STATUS_POISON")

    const result = await runRpgRuntimePreview({
      projectPath,
      submittedAction: { id: "act-1", text: "Wait quietly.", source: "freeform" },
      wikiMode: "llmwikirpg",
    })

    expect(result.brief.playerState).toContain("Present")
    expect(result.brief.playerState).not.toContain("PLAYER_CUSTOM_STATUS_POISON")
    expect(result.warnings).toContain("Missing required RPG schema slot: player_abilities (wiki/player/abilities.md)")
    expect(result.warnings).toContain("Missing required RPG schema slot: player_inventory (wiki/player/inventory.md)")
    expect(result.brief.references).not.toContain("wiki/player/custom-status.md")
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
