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

  it("merges accepted player, relationships, plot-arcs, and runtime overlay updates by appending a section", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-merge") }
    const projectPath = ctx.tmp.path
    const targets = [
      "wiki/player/player.md",
      "wiki/relationships/iven-mira.md",
      "wiki/plot-arcs/canal-gate.md",
      "wiki/characters/runtime/mira.md",
      "wiki/locations/runtime/canal-gate.md",
      "wiki/factions/runtime/harbor-watch.md",
      "wiki/items/runtime/lantern-key.md",
    ]

    await Promise.all(
      targets.map((target) => writeFileRaw(`${projectPath}/${target}`, `# Existing ${target}\n\nOriginal section.`)),
    )

    const result = await applyRpgPendingUpdates({
      projectPath,
      updates: targets.map((target, index) =>
        acceptedUpdate(`merge-${index}`, target, "merge", `## Runtime Update\n\nMerged into ${target}.`),
      ),
    })

    expect(result.appliedUpdates).toHaveLength(targets.length)
    for (const target of targets) {
      const content = await readFileRaw(`${projectPath}/${target}`)
      expect(content).toContain("Original section.")
      expect(content).toContain(`Merged into ${target}.`)
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
      ],
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates.map((update) => update.id)).toEqual(["pending-scene", "rejected-event"])
    expect(result.warnings).toEqual([])
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("Original.")
    expect(await fileExists(`${projectPath}/wiki/events/rejected.md`)).toBe(false)
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
      "wiki/world/city.md",
      "wiki/style/narrative.md",
      "wiki/rules/magic.md",
      "wiki/sources/campaign-notes.md",
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

  it("rejects base characters, locations, factions, and items pages", async () => {
    ctx = { tmp: await createTempProject("rpg-write-policy-base-pages") }
    const projectPath = ctx.tmp.path
    const baseTargets = [
      "wiki/characters/mira.md",
      "wiki/locations/canal-gate.md",
      "wiki/factions/harbor-watch.md",
      "wiki/items/lantern-key.md",
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
        acceptedUpdate("outside", "wiki/events/../../outside.md", "append", "OUTSIDE_POISON"),
      ],
    })

    expect(result.appliedUpdates).toEqual([])
    expect(result.skippedUpdates).toHaveLength(4)
    expect(result.warnings.join("\n")).toContain('requires strategy "overwrite"')
    expect(result.warnings.join("\n")).toContain('requires strategy "append"')
    expect(result.warnings.join("\n")).toContain('requires strategy "merge"')
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/player/player.md`)).toBe(false)
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
    const turnRecord = createRpgTurnRecord({
      submittedAction: { id: "turn-options", text: "Wait for Mira.", source: "freeform" },
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
