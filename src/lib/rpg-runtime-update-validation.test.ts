import { describe, expect, it } from "vitest"
import { validateRpgRuntimeUpdateProposals } from "./rpg-interactions"
import type { ProposedWikiUpdate } from "./rpg-runtime"

describe("RPG Runtime Update Validation", () => {
  it("rejects events updates contaminated by possible futures, next actions, or foreshadowing", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "event-future",
        targetPath: "wiki/events/session-04.md",
        strategy: "append",
        content: [
          "# Session 04",
          "",
          "Mira confirmed the canal sigil responded to the lantern key.",
          "",
          "## Possible Futures",
          "- Next action: the player may force the gate before the patrol returns.",
        ].join("\n"),
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.rejectedUpdates).toHaveLength(1)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["events_future_candidate_pollution", "events_forbidden_future_heading"]),
    )
    expect(result.warnings.join("\n")).toContain("Rejected RPG runtime update event-future")
  })

  it("allows confirmed discrete events", () => {
    const update = sampleUpdate({
      id: "event-confirmed",
      targetPath: "wiki/events/canal-gate-sigil.md",
      strategy: "append",
      content: "# Canal Gate Sigil\n\nMira confirmed the lantern key answered the lowest sigil.",
    })

    const result = validateRpgRuntimeUpdateProposals([update])

    expect(result.acceptedUpdates).toEqual([update])
    expect(result.rejectedUpdates).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it("rejects current-scene updates that look like long-term material or overlong history", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-profile",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: [
          "# Current Scene",
          "",
          "Iven and Mira stand by the canal gate.",
          "",
          "## Character Profile",
          "Iven's full character sheet, biography, appearance, abilities, and long-term background are repeated here.",
        ].join("\n"),
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.rejectedUpdates[0]?.issues.map((issue) => issue.code)).toContain("current_scene_long_term_material")
  })

  it("rejects overlong current-scene snapshots", () => {
    const longSnapshot = [
      "# Current Scene",
      "",
      "Iven and Mira stand by the canal gate.",
      ...Array.from({ length: 50 }, (_, index) => `- Turn ${index + 1}: A previous event is recapped.`),
    ].join("\n")

    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-log",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: longSnapshot,
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["current_scene_snapshot_too_long", "current_scene_event_log_shape"]),
    )
  })

  it("allows plot-arcs possible futures outside confirmed facts", () => {
    const update = sampleUpdate({
      id: "arc-pressure",
      targetPath: "wiki/plot-arcs/runtime/canal-gate.md",
      strategy: "merge",
      content: [
        "# Canal Gate Arc",
        "",
        "## Unresolved Pressure",
        "- The Harbor Watch may arrive if the gate is forced loudly.",
        "",
        "## Possible Futures",
        "- Mira could reveal why she recognizes the ward.",
      ].join("\n"),
    })

    const result = validateRpgRuntimeUpdateProposals([update])

    expect(result.acceptedUpdates).toEqual([update])
    expect(result.rejectedUpdates).toEqual([])
  })

  it("rejects plot-arcs that put possible futures inside confirmed facts", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "arc-confirmed-future",
        targetPath: "wiki/plot-arcs/runtime/canal-gate.md",
        strategy: "merge",
        content: [
          "# Canal Gate Arc",
          "",
          "## Confirmed Facts",
          "- Possible future: the player may force the gate before the patrol returns.",
        ].join("\n"),
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.rejectedUpdates[0]?.issues.map((issue) => issue.code)).toContain(
      "plot_arc_future_in_confirmed_facts",
    )
  })

  it("rejects relationships updates dominated by full profile material", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "relationship-profile",
        targetPath: "wiki/relationships/runtime/iven-mira.md",
        strategy: "merge",
        content: [
          "# Iven and Mira",
          "",
          "## Biography",
          "Mira's full background, appearance, ability profile, and character sheet are repeated instead of the relationship delta.",
        ].join("\n"),
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.rejectedUpdates[0]?.issues.map((issue) => issue.code)).toContain(
      "relationship_full_profile_pollution",
    )
  })

  it("keeps warning-only player updates accepted while preserving warnings", () => {
    const update = sampleUpdate({
      id: "player-profile-warning",
      targetPath: "wiki/player/player.md",
      strategy: "merge",
      content: [
        "# Player Profile",
        "",
        "## Character Profile",
        "This looks like stable character sheet material, but it does not contain candidate future action text.",
      ].join("\n"),
    })

    const result = validateRpgRuntimeUpdateProposals([update])

    expect(result.acceptedUpdates).toEqual([update])
    expect(result.rejectedUpdates).toEqual([])
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "runtime_stable_page_pollution",
        updateId: "player-profile-warning",
      }),
    ])
    expect(result.warnings.join("\n")).toContain("Warning for RPG runtime update player-profile-warning")
  })

  it("rejects candidate action pollution in player, quest, and runtime overlay updates", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "quest-next-action",
        targetPath: "wiki/quests/main.md",
        strategy: "merge",
        content: "Next action: the player may force the canal gate.",
      }),
      sampleUpdate({
        id: "overlay-unchosen",
        targetPath: "wiki/characters/runtime/mira.md",
        strategy: "merge",
        content: "Unchosen option: Mira could run ahead alone.",
      }),
    ])

    expect(result.acceptedUpdates).toEqual([])
    expect(result.rejectedUpdates.map(({ update }) => update.id)).toEqual(["quest-next-action", "overlay-unchosen"])
    expect(result.issues.every((issue) => issue.code === "runtime_candidate_action_pollution")).toBe(true)
  })

  it("warns when current-scene carries long-term NPC state without a character runtime overlay", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-npc-injury",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: "# Current Scene\n\nMira is injured and her loyalty changed after Iven shielded her.",
      }),
    ])

    expect(result.acceptedUpdates.map((update) => update.id)).toEqual(["scene-npc-injury"])
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "current_scene_missing_character_runtime_sync",
        targetPath: "wiki/current-scene/scene_state.md",
      }),
    ])
  })

  it("warns when current-scene long-term location, faction, relationship, plot, and outline changes lack companion targets", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-broad-sync",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: [
          "# Current Scene",
          "",
          "The canal gate is locked and the patrol alerted.",
          "The Harbor Watch alert level rises and became suspicious.",
          "Trust between Iven and Mira changed after the secret was revealed.",
          "The canal plot arc beat triggered early and the pressure escalated.",
          "Outline progress advanced into Act 2 with a deviation from the main plan.",
        ].join("\n"),
      }),
    ])

    expect(result.acceptedUpdates).toHaveLength(1)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "current_scene_missing_location_runtime_sync",
        "current_scene_missing_faction_runtime_sync",
        "current_scene_missing_relationship_runtime_sync",
        "current_scene_missing_plot_arc_runtime_sync",
        "current_scene_missing_outline_progress_sync",
      ]),
    )
    expect(result.rejectedUpdates).toEqual([])
  })

  it("warns when current-scene item holding and object state lacks inventory or item runtime sync", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-item-sync",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: "# Current Scene\n\nIven acquired the brass key, then the item transferred and became sealed.",
      }),
    ])

    expect(result.acceptedUpdates).toHaveLength(1)
    expect(result.issues.map((issue) => issue.code)).toContain("current_scene_missing_item_runtime_sync")
  })

  it("warns when inventory records object state without item runtime sync", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "inventory-damage",
        targetPath: "wiki/player/inventory.md",
        strategy: "merge",
        content: "# Inventory\n\n- Lantern key is damaged and sealed after the ritual.",
      }),
    ])

    expect(result.acceptedUpdates).toHaveLength(1)
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "inventory_missing_item_runtime_sync",
        targetPath: "wiki/player/inventory.md",
      }),
    ])
  })

  it("warns when item runtime records player holding state without inventory sync", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "item-player-holding",
        targetPath: "wiki/items/runtime/lantern-key.md",
        strategy: "merge",
        content: "# Lantern Key Runtime\n\n- Player acquired and equipped the lantern key.",
      }),
    ])

    expect(result.acceptedUpdates).toHaveLength(1)
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "item_runtime_missing_inventory_sync",
        targetPath: "wiki/items/runtime/lantern-key.md",
      }),
    ])
  })

  it("does not warn when companion runtime sync targets are present in the same batch", () => {
    const result = validateRpgRuntimeUpdateProposals([
      sampleUpdate({
        id: "scene-synced",
        targetPath: "wiki/current-scene/scene_state.md",
        strategy: "overwrite",
        content: [
          "# Current Scene",
          "",
          "Mira is injured.",
          "The canal gate is locked.",
          "The Harbor Watch alert level rises.",
          "Iven acquired the brass key and it became sealed.",
          "Trust between Iven and Mira changed.",
          "The plot arc beat triggered and outline progress advanced.",
        ].join("\n"),
      }),
      sampleUpdate({ id: "char-sync", targetPath: "wiki/characters/runtime/mira.md", strategy: "merge" }),
      sampleUpdate({ id: "location-sync", targetPath: "wiki/locations/runtime/canal-gate.md", strategy: "merge" }),
      sampleUpdate({ id: "faction-sync", targetPath: "wiki/factions/runtime/harbor-watch.md", strategy: "merge" }),
      sampleUpdate({ id: "inventory-sync", targetPath: "wiki/player/inventory.md", strategy: "merge" }),
      sampleUpdate({ id: "item-sync", targetPath: "wiki/items/runtime/lantern-key.md", strategy: "merge" }),
      sampleUpdate({ id: "relationship-sync", targetPath: "wiki/relationships/runtime/iven-mira.md", strategy: "merge" }),
      sampleUpdate({ id: "plot-sync", targetPath: "wiki/plot-arcs/runtime/canal-gate.md", strategy: "merge" }),
      sampleUpdate({ id: "outline-sync", targetPath: "wiki/outlines/progress.md", strategy: "merge" }),
    ])

    const syncWarnings = result.issues.filter((issue) => issue.code.includes("missing") && issue.code.includes("sync"))
    expect(syncWarnings).toEqual([])
    expect(result.rejectedUpdates).toEqual([])
  })
})

function sampleUpdate(overrides: Partial<ProposedWikiUpdate>): ProposedWikiUpdate {
  return {
    id: "update-1",
    targetPath: "wiki/events/example.md",
    strategy: "append",
    reason: "Track accepted runtime state.",
    content: "# Update\n\nAccepted runtime state.",
    sourceTurnId: "turn-validation",
    references: ["wiki/current-scene/scene_state.md"],
    ...overrides,
  }
}
