import { afterEach, describe, expect, it } from "vitest"
import {
  createRpgTurnRecord,
  extractRpgStateUpdates,
  acceptPendingRpgUpdate,
  applyRpgPendingUpdates,
  createPendingRpgUpdates,
  type PendingRpgUpdate,
  type ProposedWikiUpdate,
  type RpgTurnResult,
  type RpgUpdateStrategy,
} from "./rpg-runtime"
import { createTempProject, fileExists, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
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

describe("RPG Runtime Write Policy", () => {
  it("overwrites accepted current-scene updates", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-current-scene") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nOld rain.")

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: [acceptedUpdate("scene-update", "wiki/current-scene/scene_state.md", "overwrite", "# Current Scene\n\nNew lantern light.")],
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
    const content = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(content).toBe("# Current Scene\n\nNew lantern light.\n")
    expect(content).not.toContain("Old rain")
  })

  it("appends and creates accepted event updates", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-events") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/events/canal-gate.md`, "# Canal Gate\n\nThe gate was found.")

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate("event-append", "wiki/events/canal-gate.md", "append", "## Turn 5\n\nThe lowest sigil answered."),
        acceptedUpdate("event-create", "wiki/events/brass-light.md", "append", "# Brass Light\n\nThe lantern key flared."),
      ],
    })

    expect(result.appliedUpdates).toHaveLength(2)
    expect(await readFileRaw(`${projectPath}/wiki/events/canal-gate.md`)).toBe(
      "# Canal Gate\n\nThe gate was found.\n\n## Turn 5\n\nThe lowest sigil answered.\n",
    )
    expect(await readFileRaw(`${projectPath}/wiki/events/brass-light.md`)).toBe(
      "# Brass Light\n\nThe lantern key flared.\n",
    )
  })

  it("uses section-aware merge for player updates and replaces stale Current State", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-player-merge") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(
      `${projectPath}/wiki/player/player.md`,
      [
        "# Player",
        "",
        "## Current State",
        "",
        "- Iven is still exhausted in the old tavern.",
        "",
        "## Resources",
        "",
        "- Lantern key is dim.",
        "",
        "## Evidence and Uncertainty",
        "",
        "- Mira noticed the old wound.",
        "",
        "## Trivia",
        "",
        "- Menu metadata.",
      ].join("\n"),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate(
          "player-merge",
          "wiki/player/player.md",
          "merge",
          [
            "## Current State",
            "",
            "- Iven is alert beside the canal gate.",
            "",
            "## Resources",
            "",
            "- Lantern key is lit.",
            "",
            "## Evidence and Uncertainty",
            "",
            "- Mira noticed the old wound.",
            "- The sigil reacted to Iven.",
          ].join("\n"),
        ),
      ],
    })

    const content = await readFileRaw(`${projectPath}/wiki/player/player.md`)
    expect(content).toContain("# Player")
    expect(content).toContain("Iven is alert beside the canal gate.")
    expect(content).not.toContain("old tavern")
    expect(content).toContain("Lantern key is lit.")
    expect(content).not.toContain("Lantern key is dim.")
    expect(content.match(/Mira noticed the old wound/g)).toHaveLength(1)
    expect(content).toContain("The sigil reacted to Iven.")
    expect(content).not.toContain("## Trivia")
  })

  it("section-merges quest objective progress without keeping stale completion state beside it", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-quest-merge") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(
      `${projectPath}/wiki/quests/main.md`,
      [
        "# Main Quest",
        "",
        "## Current State",
        "",
        "- Objective progress: blocked at the outer gate.",
        "",
        "## Obstacles",
        "",
        "- Outer gate is sealed.",
      ].join("\n"),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate(
          "quest-merge",
          "wiki/quests/main.md",
          "merge",
          "## Current State\n\n- Objective progress: outer gate opened; next blocker is the inner sigil.\n\n## Obstacles\n\n- Inner sigil requires brass light.",
        ),
      ],
    })

    const content = await readFileRaw(`${projectPath}/wiki/quests/main.md`)
    expect(content).toContain("outer gate opened")
    expect(content).toContain("inner sigil")
    expect(content).not.toContain("blocked at the outer gate")
    expect(content).not.toContain("Outer gate is sealed")
  })

  it("section-merges runtime outline progress", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-outline-progress") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(
      `${projectPath}/wiki/outlines/progress.md`,
      [
        "# Outline Progress",
        "",
        "## Current Beat",
        "",
        "- Still outside the canal gate.",
        "",
        "## Completed Beats",
        "",
        "- Found the lantern key.",
      ].join("\n"),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate(
          "outline-progress-merge",
          "wiki/outlines/progress.md",
          "merge",
          "## Current Beat\n\n- Entered the canal gate aftermath beat.\n\n## Completed Beats\n\n- Found the lantern key.\n- Opened the outer gate.",
        ),
      ],
    })

    const content = await readFileRaw(`${projectPath}/wiki/outlines/progress.md`)
    expect(content).toContain("Entered the canal gate aftermath beat.")
    expect(content).not.toContain("Still outside the canal gate.")
    expect(content.match(/Found the lantern key/g)).toHaveLength(1)
    expect(content).toContain("Opened the outer gate.")
  })

  it("section-merges relationship current tension and evidence without restoring stale biography sections", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-relationship-merge") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(
      `${projectPath}/wiki/relationships/runtime/iven-mira.md`,
      [
        "# Iven and Mira",
        "",
        "## Current State",
        "",
        "- Mira distrusts Iven after the theft.",
        "",
        "## Evidence and Uncertainty",
        "",
        "- The theft happened before dawn.",
        "",
        "## Full Biography",
        "",
        "- Mira's complete childhood profile does not belong in this relationship page.",
      ].join("\n"),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate(
          "relationship-merge",
          "wiki/relationships/runtime/iven-mira.md",
          "merge",
          "## Current State\n\n- Mira is wary but cooperating after Iven returned the key.\n\n## Evidence and Uncertainty\n\n- The key return was witnessed by Harbor Watch.",
        ),
      ],
    })

    const content = await readFileRaw(`${projectPath}/wiki/relationships/runtime/iven-mira.md`)
    expect(content).toContain("wary but cooperating")
    expect(content).not.toContain("distrusts Iven after the theft")
    expect(content).toContain("The theft happened before dawn.")
    expect(content).toContain("The key return was witnessed by Harbor Watch.")
    expect(content).not.toContain("## Full Biography")
    expect(content).not.toContain("childhood profile")
  })

  it("section-merges plot-arc Possible Futures without moving them into Confirmed Facts", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-plot-merge") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`,
      [
        "# Canal Gate",
        "",
        "## Confirmed Facts",
        "",
        "- The outer gate opened.",
        "",
        "## Possible Futures",
        "",
        "- The canal may flood if the inner sigil is ignored.",
      ].join("\n"),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate(
          "plot-merge",
          "wiki/plot-arcs/runtime/canal-gate.md",
          "merge",
          "## Confirmed Facts\n\n- Mira saw the brass light answer.\n\n## Possible Futures\n\n- The rival may exploit the opened gate.",
        ),
      ],
    })

    const content = await readFileRaw(`${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`)
    const confirmed = content.slice(content.indexOf("## Confirmed Facts"), content.indexOf("## Possible Futures"))
    expect(confirmed).toContain("The outer gate opened.")
    expect(confirmed).toContain("Mira saw the brass light answer.")
    expect(confirmed).not.toContain("may flood")
    expect(confirmed).not.toContain("may exploit")
    expect(content).toContain("The canal may flood if the inner sigil is ignored.")
    expect(content).toContain("The rival may exploit the opened gate.")
  })

  it("uses section-aware merge for runtime overlay paths without touching base canon pages", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-overlay-merge") }
    const projectPath = ctx.tmp.path
    const overlayCases = [
      {
        base: "wiki/characters/mira.md",
        runtime: "wiki/characters/runtime/mira.md",
        stale: "Mira is waiting at the tavern.",
        fresh: "Mira is beside the canal gate with the brass light.",
      },
      {
        base: "wiki/locations/canal-gate.md",
        runtime: "wiki/locations/runtime/canal-gate.md",
        stale: "The gate is sealed and quiet.",
        fresh: "The gate is open and echoing with brass light.",
      },
      {
        base: "wiki/factions/harbor-watch.md",
        runtime: "wiki/factions/runtime/harbor-watch.md",
        stale: "The watch is neutral toward Iven.",
        fresh: "The watch is suspicious after the canal alarm.",
      },
      {
        base: "wiki/items/lantern-key.md",
        runtime: "wiki/items/runtime/lantern-key.md",
        stale: "The lantern key is dim in Mira's pouch.",
        fresh: "The lantern key is lit in Iven's hand.",
      },
      {
        base: "wiki/relationships/iven-mira.md",
        runtime: "wiki/relationships/runtime/iven-mira.md",
        stale: "Mira distrusts Iven after the theft.",
        fresh: "Mira is wary but cooperating after Iven returned the key.",
      },
      {
        base: "wiki/plot-arcs/canal-gate.md",
        runtime: "wiki/plot-arcs/runtime/canal-gate.md",
        stale: "The gate pressure is stalled.",
        fresh: "The gate pressure advanced after the brass light answered.",
      },
    ]

    await Promise.all(
      overlayCases.flatMap((entry) => [
        writeFileRaw(`${projectPath}/${entry.base}`, "# Base Canon\n\n## Canon Facts\n\n- Base canon stays unchanged."),
        writeFileRaw(
          `${projectPath}/${entry.runtime}`,
          `# Runtime Overlay\n\n## Current State\n\n- ${entry.stale}\n\n## Consequences\n\n- Owes Iven one answer.`,
        ),
      ]),
    )

    await applyRpgPendingUpdates({
      projectPath,
      updates: overlayCases.map((entry, index) =>
        acceptedUpdate(`overlay-merge-${index}`, entry.runtime, "merge", `## Current State\n\n- ${entry.fresh}`),
      ),
    })

    for (const entry of overlayCases) {
      const overlay = await readFileRaw(`${projectPath}/${entry.runtime}`)
      expect(overlay).toContain(entry.fresh)
      expect(overlay).not.toContain(entry.stale)
      expect(overlay).toContain("Owes Iven one answer.")
      expect(await readFileRaw(`${projectPath}/${entry.base}`)).toContain("Base canon stays unchanged.")
    }
  })

  it("skips pending and rejected updates without writing wiki files", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-status") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nOriginal.")

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: [
        pendingUpdate("pending-scene", "wiki/current-scene/scene_state.md", "overwrite", "PENDING_POISON", "pending"),
        pendingUpdate("rejected-event", "wiki/events/rejected.md", "append", "REJECTED_POISON", "rejected"),
        pendingUpdate("pending-quest", "wiki/quests/main.md", "merge", "PENDING_QUEST_POISON", "pending"),
        pendingUpdate("rejected-quest", "wiki/quests/main.md", "merge", "REJECTED_QUEST_POISON", "rejected"),
      ],
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates.map((update) => update.id)).toEqual(["pending-scene", "rejected-event", "pending-quest", "rejected-quest"])
    expect(result.warnings).toEqual([])
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("Original.")
    expect(await fileExists(`${projectPath}/wiki/events/rejected.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/quests/main.md`)).toBe(false)
  })

  it("rejects legacy paths without writing them", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-legacy") }
    const projectPath = ctx.tmp.path
    const legacyTargets = [
      "wiki/entities/ghost.md",
      "wiki/concepts/ghost.md",
      "wiki/queries/ghost.md",
      "wiki/comparisons/ghost.md",
      "wiki/synthesis/ghost.md",
      "wiki/methodology/ghost.md",
      "wiki/findings/ghost.md",
      "wiki/thesis/ghost.md",
    ]

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: legacyTargets.map((target, index) => acceptedUpdate(`legacy-${index}`, target, "merge", "LEGACY_POISON")),
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates).toHaveLength(legacyTargets.length)
    expect(result.warnings).toHaveLength(legacyTargets.length)
    for (const target of legacyTargets) {
      expect(await fileExists(`${projectPath}/${target}`)).toBe(false)
    }
  })

  it("rejects stable and manual paths without writing them", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-stable") }
    const projectPath = ctx.tmp.path
    const stableTargets = [
      "wiki/world/basic_overview.md",
      "wiki/style/narrative.md",
      "wiki/rules/magic.md",
      "wiki/sources/campaign-notes.md",
      "wiki/memory/manual.md",
    ]

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: stableTargets.map((target, index) => acceptedUpdate(`stable-${index}`, target, "merge", "STABLE_POISON")),
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates).toHaveLength(stableTargets.length)
    expect(result.warnings).toHaveLength(stableTargets.length)
    for (const target of stableTargets) {
      expect(await fileExists(`${projectPath}/${target}`)).toBe(false)
    }
  })

  it("rejects base characters, locations, factions, items, relationships, and plot-arcs pages", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-base-pages") }
    const projectPath = ctx.tmp.path
    const baseTargets = [
      "wiki/characters/mira.md",
      "wiki/locations/canal-gate.md",
      "wiki/factions/harbor-watch.md",
      "wiki/items/lantern-key.md",
      "wiki/relationships/iven-mira.md",
      "wiki/plot-arcs/canal-gate.md",
    ]

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: baseTargets.map((target, index) => acceptedUpdate(`base-${index}`, target, "merge", "BASE_POISON")),
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates).toHaveLength(baseTargets.length)
    expect(result.warnings).toHaveLength(baseTargets.length)
    for (const target of baseTargets) {
      expect(await fileExists(`${projectPath}/${target}`)).toBe(false)
    }
  })

  it("rejects strategy and path mismatches", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-mismatch") }
    const projectPath = ctx.tmp.path

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: [
        acceptedUpdate("scene-wrong", "wiki/current-scene/scene_state.md", "append", "WRONG_SCENE"),
        acceptedUpdate("event-wrong", "wiki/events/canal-gate.md", "merge", "WRONG_EVENT"),
        acceptedUpdate("player-wrong", "wiki/player/player.md", "overwrite", "WRONG_PLAYER"),
        acceptedUpdate("quest-wrong", "wiki/quests/main.md", "append", "WRONG_QUEST"),
        acceptedUpdate("outside", "wiki/events/../../outside.md", "append", "OUTSIDE_POISON"),
      ],
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates).toHaveLength(5)
    expect(result.warnings.join("\n")).toContain('requires strategy "overwrite"')
    expect(result.warnings.join("\n")).toContain('requires strategy "append"')
    expect(result.warnings.join("\n")).toContain('requires strategy "merge"')
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/player/player.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/quests/main.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/outside.md`)).toBe(false)
  })

  it("does not write unchosen nextActionOptions text through the accepted pending update flow", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-options") }
    const projectPath = ctx.tmp.path
    const unchosenOptionText = "UNCHOSEN_OPTION_POISON: force the gate before Mira finishes reading."
    const turnResult: RpgTurnResult = {
      narrative: [
        "Mira reads the sigil while Iven waits.",
        "",
        "```rpg-wiki-update",
        "targetPath: wiki/events/canal-gate-sigil.md",
        "strategy: append",
        "reason: Record only the completed waiting action.",
        "---",
        "# Canal Gate Sigil",
        "",
        "Iven waited while Mira finished reading the sigil.",
        "```",
      ].join("\n"),
      nextActionOptions: [
        {
          id: "force-gate",
          playerFacingText: unchosenOptionText,
          intent: "fight",
          riskLevel: "high",
          likelyAffectedPaths: ["wiki/events/forced-gate.md"],
        },
      ],
      references: ["wiki/events/canal-gate-sigil.md"],
    }
    const submittedAction = { id: "turn-options", text: "Wait for Mira.", source: "freeform" } as const
    const turnRecord = createRpgTurnRecord({
      submittedAction,
      ...sampleTurnRecordRuntimeParts(submittedAction),
      turnNarration: sampleTurnNarration({ playerFacingText: turnResult.narrative }),
      turnResult,
    })
    const pending = createPendingRpgUpdates(extractRpgStateUpdates({ turnRecord }).proposedUpdates)
    const accepted = acceptPendingRpgUpdate(pending, pending[0].id)

    await applyRpgPendingUpdates({ projectPath, updates: accepted })

    const content = await readFileRaw(`${projectPath}/wiki/events/canal-gate-sigil.md`)
    expect(content).toContain("Iven waited while Mira finished reading the sigil.")
    expect(content).not.toContain(unchosenOptionText)
    expect(await fileExists(`${projectPath}/wiki/events/forced-gate.md`)).toBe(false)
  })
})

function acceptedUpdate(
  id: string,
  targetPath: string,
  strategy: RpgUpdateStrategy,
  content: string,
): PendingRpgUpdate {
  return pendingUpdate(id, targetPath, strategy, content, "accepted")
}

function pendingUpdate(
  id: string,
  targetPath: string,
  strategy: RpgUpdateStrategy,
  content: string,
  status: PendingRpgUpdate["status"],
): PendingRpgUpdate {
  const proposed: ProposedWikiUpdate = {
    id,
    targetPath,
    strategy,
    reason: "Test update.",
    content,
    sourceTurnId: "turn-test",
    references: [],
  }
  return { ...proposed, status }
}
