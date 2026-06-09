import { afterEach, describe, expect, it, vi } from "vitest"
import { createTempProject, fileExists, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  getRpgImportModeSpec,
  listRpgImportModeSpecs,
  runRpgImport,
  type RuntimeUpdateApplyResult,
} from "."
import type { PendingRpgUpdate, ProposedWikiUpdate, RpgTurnRecord, RpgUpdateStrategy } from "../rpg-runtime"

vi.mock("@/commands/fs", () => realFs)

let cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups) {
    await cleanup()
  }
  cleanups = []
})

describe("RPG import runtime_update_apply", () => {
  it("is registered in the RPG import registry", () => {
    expect(getRpgImportModeSpec("runtime_update_apply")?.mode).toBe("runtime_update_apply")
    expect(listRpgImportModeSpecs().map((spec) => spec.mode)).toContain("runtime_update_apply")
  })

  it("stages fenced rpg-wiki-update blocks as proposed and pending updates without writing wiki files", async () => {
    const projectPath = await createProject("runtime-update-stage-fenced")
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nOld scene.")
    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      sourceText: [
        "```rpg-wiki-update",
        "targetPath: wiki/current-scene/scene_state.md",
        "strategy: overwrite",
        "reason: Keep the latest scene snapshot after the completed action.",
        "---",
        "# Current Scene",
        "",
        "Iven and Mira stand by the opened canal gate.",
        "```",
        "",
        "```rpg-wiki-update",
        "targetPath: wiki/events/canal-gate-opened.md",
        "strategy: append",
        "reason: Record the completed gate opening as happened history.",
        "---",
        "# Canal Gate Opened",
        "",
        "Iven opened the canal gate with the lantern key.",
        "```",
      ].join("\n"),
      options: {
        operation: "stage_pending",
        turnRecord: sampleTurnRecord("turn-stage-fenced"),
      },
    }) as RuntimeUpdateApplyResult

    expect(result.mode).toBe("runtime_update_apply")
    expect(result.operation).toBe("stage_pending")
    expect(result.writtenPaths).toEqual([])
    expect(result.proposedUpdates.map((update) => update.targetPath)).toEqual([
      "wiki/current-scene/scene_state.md",
      "wiki/events/canal-gate-opened.md",
    ])
    expect(result.pendingUpdates.map((update) => [update.targetPath, update.status])).toEqual([
      ["wiki/current-scene/scene_state.md", "pending"],
      ["wiki/events/canal-gate-opened.md", "pending"],
    ])
    expect(result.reviewItems.filter((item) => isReviewItemType(item, "runtime-update-pending"))).toHaveLength(2)
    expect(result.runtimeUpdateValidation.rejectedUpdates).toEqual([])
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("Old scene.")
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate-opened.md`)).toBe(false)
  })

  it("keeps validation-rejected updates out of pending", async () => {
    const projectPath = await createProject("runtime-update-stage-validation-reject")
    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      sourceText: [
        "```rpg-wiki-update",
        "targetPath: wiki/events/canal-gate-future.md",
        "strategy: append",
        "reason: This wrongly stores possible future options as event history.",
        "---",
        "# Canal Gate Future",
        "",
        "## Possible Futures",
        "- Next action: the player may force the gate before the patrol returns.",
        "```",
      ].join("\n"),
      options: {
        operation: "stage_pending",
        turnRecord: sampleTurnRecord("turn-stage-reject"),
      },
    }) as RuntimeUpdateApplyResult

    expect(result.proposedUpdates.map((update) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
    ])
    expect(result.pendingUpdates).toEqual([])
    expect(result.skipped).toEqual(["wiki/events/canal-gate-future.md"])
    expect(result.runtimeUpdateValidation.rejectedUpdates.map(({ update }) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
    ])
    expect(result.warnings.join("\n")).toContain("events_future_candidate_pollution")
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate-future.md`)).toBe(false)
  })

  it("rejects stable, base, source, and manual-control targets before pending staging", async () => {
    const projectPath = await createProject("runtime-update-stage-target-policy")
    const forbiddenTargets = [
      "wiki/relationships/iven-mira.md",
      "wiki/plot-arcs/canal-gate.md",
      "wiki/outlines/main.md",
      "wiki/rules/core.md",
      "wiki/style/narration.md",
      "wiki/sources/campaign-notes.md",
      "wiki/world/river-port.md",
    ]

    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      options: {
        operation: "stage_pending",
        proposedUpdates: forbiddenTargets.map((targetPath, index) =>
          proposedUpdate({
            id: `forbidden-${index}`,
            targetPath,
            strategy: targetPath.includes("sources") ? "append" : "merge",
            content: "FORBIDDEN_POISON",
          }),
        ),
      },
    }) as RuntimeUpdateApplyResult

    expect(result.pendingUpdates).toEqual([])
    expect(result.skipped).toEqual(forbiddenTargets)
    expect(result.runtimeUpdateValidation.rejectedUpdates).toHaveLength(forbiddenTargets.length)
    expect(result.warnings.join("\n")).toContain("outside allowed runtime update paths")

    for (const targetPath of forbiddenTargets) {
      expect(await fileExists(`${projectPath}/${targetPath}`)).toBe(false)
    }
  })

  it("applies accepted relationship and plot-arc runtime overlay merges without touching base pages", async () => {
    const projectPath = await createProject("runtime-update-apply-overlays")
    await writeFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`, "# Base Relationship\n\nBase trust model stays stable.")
    await writeFileRaw(`${projectPath}/wiki/plot-arcs/canal-gate.md`, "# Base Plot Arc\n\nBase pressure stays stable.")
    await writeFileRaw(
      `${projectPath}/wiki/relationships/runtime/iven-mira.md`,
      "# Runtime Relationship\n\n## Current State\n\n- Mira distrusts Iven after the theft.\n\n## Evidence and Uncertainty\n\n- The theft happened before dawn.",
    )
    await writeFileRaw(
      `${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`,
      "# Runtime Plot Arc\n\n## Confirmed Facts\n\n- The outer gate was still sealed.\n\n## Possible Futures\n\n- The canal may flood if ignored.",
    )

    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      options: {
        operation: "apply_pending",
        pendingUpdates: [
          pendingUpdate(
            "relationship-runtime",
            "wiki/relationships/runtime/iven-mira.md",
            "merge",
            "## Current State\n\n- Mira is wary but cooperating after Iven returned the key.\n\n## Evidence and Uncertainty\n\n- The key return was witnessed by Harbor Watch.",
            "accepted",
          ),
          pendingUpdate(
            "plot-runtime",
            "wiki/plot-arcs/runtime/canal-gate.md",
            "merge",
            "## Confirmed Facts\n\n- Mira saw the brass light answer.\n\n## Possible Futures\n\n- The rival may exploit the opened gate.",
            "accepted",
          ),
        ],
      },
    }) as RuntimeUpdateApplyResult

    expect(result.writtenPaths).toEqual([
      "wiki/relationships/runtime/iven-mira.md",
      "wiki/plot-arcs/runtime/canal-gate.md",
    ])

    const relationship = await readFileRaw(`${projectPath}/wiki/relationships/runtime/iven-mira.md`)
    expect(relationship).toContain("wary but cooperating")
    expect(relationship).not.toContain("distrusts Iven")
    expect(relationship).toContain("The theft happened before dawn.")
    expect(relationship).toContain("The key return was witnessed by Harbor Watch.")

    const plotArc = await readFileRaw(`${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`)
    const confirmed = plotArc.slice(plotArc.indexOf("## Confirmed Facts"), plotArc.indexOf("## Possible Futures"))
    expect(confirmed).toContain("The outer gate was still sealed.")
    expect(confirmed).toContain("Mira saw the brass light answer.")
    expect(confirmed).not.toContain("may exploit")
    expect(plotArc).toContain("The canal may flood if ignored.")
    expect(plotArc).toContain("The rival may exploit the opened gate.")

    expect(await readFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`)).toContain("Base trust model stays stable.")
    expect(await readFileRaw(`${projectPath}/wiki/plot-arcs/canal-gate.md`)).toContain("Base pressure stays stable.")
  })

  it("applies only accepted pending updates and reports written paths as the actual applied targets", async () => {
    const projectPath = await createProject("runtime-update-apply-status-and-semantics")
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nOld scene.")
    await writeFileRaw(`${projectPath}/wiki/events/canal-gate.md`, "# Canal Gate\n\nThe gate was found.")
    await writeFileRaw(
      `${projectPath}/wiki/player/player.md`,
      "# Player\n\n## Current State\n\n- Iven waits outside the gate.\n\n## Resources\n\n- Lantern key is dim.",
    )
    await writeFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`, "# Base Relationship\n\nBASE_UNCHANGED")

    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      options: {
        operation: "apply_pending",
        pendingUpdates: [
          pendingUpdate("scene-accepted", "wiki/current-scene/scene_state.md", "overwrite", "# Current Scene\n\nNew scene.", "accepted"),
          pendingUpdate("event-append", "wiki/events/canal-gate.md", "append", "## Turn 2\n\nThe lowest sigil answered.", "accepted"),
          pendingUpdate("event-create", "wiki/events/brass-light.md", "append", "# Brass Light\n\nThe lantern key flared.", "accepted"),
          pendingUpdate(
            "player-merge",
            "wiki/player/player.md",
            "merge",
            "## Current State\n\n- Iven stands inside the opened gate.\n\n## Resources\n\n- Lantern key is lit.",
            "accepted",
          ),
          pendingUpdate("pending-event", "wiki/events/pending.md", "append", "PENDING_POISON", "pending"),
          pendingUpdate("rejected-scene", "wiki/current-scene/scene_state.md", "overwrite", "REJECTED_POISON", "rejected"),
          pendingUpdate("base-relationship", "wiki/relationships/iven-mira.md", "merge", "BASE_POISON", "accepted"),
        ],
      },
    }) as RuntimeUpdateApplyResult

    const actualAppliedTargets = result.applyResult?.appliedUpdates.map((update) => update.targetPath)
    expect(result.writtenPaths).toEqual(actualAppliedTargets)
    expect(result.writtenPaths).toEqual([
      "wiki/current-scene/scene_state.md",
      "wiki/events/canal-gate.md",
      "wiki/events/brass-light.md",
      "wiki/player/player.md",
    ])
    expect(result.applyResult?.skippedUpdates.map((update) => update.id)).toEqual([
      "pending-event",
      "rejected-scene",
      "base-relationship",
    ])

    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe("# Current Scene\n\nNew scene.\n")
    expect(await readFileRaw(`${projectPath}/wiki/events/canal-gate.md`)).toBe(
      "# Canal Gate\n\nThe gate was found.\n\n## Turn 2\n\nThe lowest sigil answered.\n",
    )
    expect(await readFileRaw(`${projectPath}/wiki/events/brass-light.md`)).toBe(
      "# Brass Light\n\nThe lantern key flared.\n",
    )

    const player = await readFileRaw(`${projectPath}/wiki/player/player.md`)
    expect(player).toContain("Iven stands inside the opened gate.")
    expect(player).not.toContain("Iven waits outside the gate.")
    expect(player).toContain("Lantern key is lit.")
    expect(player).not.toContain("Lantern key is dim.")

    expect(await fileExists(`${projectPath}/wiki/events/pending.md`)).toBe(false)
    expect(await readFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`)).toContain("BASE_UNCHANGED")
    expect(await readFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`)).not.toContain("BASE_POISON")
  })

  it("can stage direct ProposedWikiUpdate objects for allowed runtime overlay targets", async () => {
    const projectPath = await createProject("runtime-update-stage-direct")
    const result = await runRpgImport({
      mode: "runtime_update_apply",
      projectPath,
      options: {
        operation: "stage_pending",
        proposedUpdates: [
          proposedUpdate({
            id: "relationship-direct",
            targetPath: "wiki/relationships/runtime/iven-mira.md",
            strategy: "merge",
            content: "## Current State\n\n- Trust increased after Iven kept the promise.",
          }),
          proposedUpdate({
            id: "plot-direct",
            targetPath: "wiki/plot-arcs/runtime/canal-gate.md",
            strategy: "merge",
            content: "## Confirmed Facts\n\n- The canal-gate beat advanced after the brass light answered.",
          }),
        ],
      },
    }) as RuntimeUpdateApplyResult

    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual([
      "wiki/relationships/runtime/iven-mira.md",
      "wiki/plot-arcs/runtime/canal-gate.md",
    ])
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
    expect(result.runtimeUpdateValidation.rejectedUpdates).toEqual([])
  })
})

async function createProject(label: string): Promise<string> {
  const tmp = await createTempProject(label)
  cleanups.push(tmp.cleanup)

  await writeFileRaw(`${tmp.path}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
  await writeFileRaw(`${tmp.path}/schema.md`, "wikiMode: llmwikirpg\n")
  await writeFileRaw(`${tmp.path}/purpose.md`, "# Purpose\n\nTrack runtime update apply.\n")
  await writeFileRaw(`${tmp.path}/wiki/index.md`, "# Index\n")
  await writeFileRaw(`${tmp.path}/wiki/overview.md`, "# Overview\n")

  return tmp.path
}

function sampleTurnRecord(id: string): RpgTurnRecord {
  return {
    submittedAction: {
      id,
      text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
      source: "freeform",
    },
    generatedNarrative: "Mira inspected the canal gate sigil.",
    references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
  }
}

function proposedUpdate(overrides: Partial<ProposedWikiUpdate>): ProposedWikiUpdate {
  return {
    id: "update-1",
    targetPath: "wiki/events/example.md",
    strategy: "append",
    reason: "Track accepted runtime state.",
    content: "# Update\n\nAccepted runtime state.",
    sourceTurnId: "turn-direct",
    references: ["wiki/current-scene/scene_state.md"],
    ...overrides,
  }
}

function pendingUpdate(
  id: string,
  targetPath: string,
  strategy: RpgUpdateStrategy,
  content: string,
  status: PendingRpgUpdate["status"],
): PendingRpgUpdate {
  return {
    ...proposedUpdate({
      id,
      targetPath,
      strategy,
      content,
      sourceTurnId: "turn-apply",
    }),
    status,
  }
}

function isReviewItemType(item: unknown, type: string): boolean {
  return typeof item === "object" && item !== null && "type" in item && item.type === type
}
