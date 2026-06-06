import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, fileExists, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createFixtureNarrationAdapter,
  runRpgRuntimeTurnFlow,
  type RpgTurnResult,
  type SubmittedAction,
} from "./rpg-runtime"
import * as updateStaging from "./rpg-runtime/update-staging"
import * as writePolicy from "./rpg-runtime/write-policy"

vi.mock("@/commands/fs", () => realFs)

vi.mock("./rpg-runtime/update-staging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rpg-runtime/update-staging")>()
  return {
    ...actual,
    acceptPendingRpgUpdate: vi.fn(actual.acceptPendingRpgUpdate),
    rejectPendingRpgUpdate: vi.fn(actual.rejectPendingRpgUpdate),
  }
})

vi.mock("./rpg-runtime/write-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rpg-runtime/write-policy")>()
  return {
    ...actual,
    applyRpgPendingUpdates: vi.fn(async () => {
      throw new Error("runRpgRuntimeTurnFlow must not apply pending updates.")
    }),
  }
})

interface Ctx {
  tmp: { path: string; cleanup: () => Promise<void> }
}

let ctx: Ctx | undefined

afterEach(async () => {
  vi.clearAllMocks()
  if (ctx) {
    await ctx.tmp.cleanup()
    ctx = undefined
  }
})

describe("RPG Runtime Turn Controller", () => {
  it("runs a fixture-driven turn through narration, extraction, and pending update staging", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-flow") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const submittedAction = sampleSubmittedAction()
    const turnResult = sampleTurnResult()

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(turnResult),
    })

    expect(result.brief.submittedAction).toEqual(submittedAction)
    expect(result.brief.currentScene).toContain("locked canal gate")
    expect(result.turnResult.narrative).toContain("Mira traces the lowest sigil")
    expect(result.turnResult.nextActionOptions).toHaveLength(3)
    expect(result.turnRecord).toEqual({
      submittedAction,
      generatedNarrative: turnResult.narrative,
      references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
    })
    expect(result.proposedUpdates.map((update) => [update.targetPath, update.strategy])).toEqual([
      ["wiki/current-scene/scene_state.md", "overwrite"],
      ["wiki/events/canal-gate-sigil.md", "append"],
    ])
    expect(result.pendingUpdates).toEqual(
      result.proposedUpdates.map((update) => ({
        ...update,
        references: [...update.references],
        status: "pending",
      })),
    )
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
  })

  it("turns rpg-wiki-update fenced blocks into proposed and pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-fenced") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-fenced"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
    })

    expect(result.proposedUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetPath: "wiki/current-scene/scene_state.md",
          strategy: "overwrite",
          content: expect.stringContaining("lowest sigil glows"),
        }),
        expect.objectContaining({
          targetPath: "wiki/events/canal-gate-sigil.md",
          strategy: "append",
          content: expect.stringContaining("Mira confirmed"),
        }),
      ]),
    )
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(
      result.proposedUpdates.map((update) => update.targetPath),
    )
  })

  it("merges turn warnings with extractor warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-warnings") }
    const projectPath = ctx.tmp.path
    await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nCarries a brass lantern key.")

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-warnings"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter({
        ...sampleTurnResult(),
        narrative: [
          "Mira studies the sigil, but the scene snapshot is missing from disk.",
          "",
          "```rpg-wiki-update",
          "targetPath: wiki/world/city.md",
          "strategy: merge",
          "reason: This stable path must be filtered.",
          "---",
          "WORLD_POISON",
          "```",
        ].join("\n"),
      }),
    })

    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
    expect(result.warnings.join("\n")).toContain("Missing required RPG runtime page: wiki/current-scene/scene_state.md")
    expect(result.warnings.join("\n")).toContain("outside allowed runtime update paths")
  })

  it("lets malformed narration adapter output fail at the existing turn validation boundary", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-malformed") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    await expect(
      runRpgRuntimeTurnFlow({
        projectPath,
        submittedAction: sampleSubmittedAction("turn-malformed"),
        wikiMode: "llmwikirpg",
        narrationAdapter: {
          async generateTurn() {
            return {
              narrative: "The gate clicks.",
              nextActionOptions: [],
              references: [],
            } as unknown as RpgTurnResult
          },
        },
      }),
    ).rejects.toThrow(/3 to 5/)
  })

  it("does not write wiki files while creating proposed and pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-readonly") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const before = await snapshotFiles(projectPath)

    await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-readonly"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
    })

    const after = await snapshotFiles(projectPath)
    expect(after).toEqual(before)
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("locked canal gate")
    expect(await fileExists(`${projectPath}/wiki/events/canal-gate-sigil.md`)).toBe(false)
  })

  it("does not automatically accept, reject, or apply pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-no-apply") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-no-apply"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
    })

    expect(result.pendingUpdates).toHaveLength(2)
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
    expect(updateStaging.acceptPendingRpgUpdate).not.toHaveBeenCalled()
    expect(updateStaging.rejectPendingRpgUpdate).not.toHaveBeenCalled()
    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })
})

async function writeTurnFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
}

function sampleSubmittedAction(id = "turn-controller"): SubmittedAction {
  return {
    id,
    text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
    source: "freeform",
  }
}

function sampleTurnResult(): RpgTurnResult {
  return {
    narrative: [
      "Mira traces the lowest sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
      "",
      "```rpg-wiki-update",
      "targetPath: wiki/current-scene/scene_state.md",
      "strategy: overwrite",
      "reason: Keep the next-turn scene snapshot aligned with the completed action.",
      "---",
      "# Current Scene",
      "",
      "Iven and Mira remain at the locked canal gate while the lowest sigil glows.",
      "```",
      "",
      "```rpg-wiki-update",
      "targetPath: wiki/events/canal-gate-sigil.md",
      "strategy: append",
      "reason: Record the completed sigil inspection as happened history.",
      "---",
      "# Canal Gate Sigil",
      "",
      "Mira confirmed that the lantern key answers the canal gate's lowest sigil.",
      "```",
    ].join("\n"),
    nextActionOptions: [
      {
        id: "opt-key",
        playerFacingText: "Touch the lantern key to the lowest sigil.",
        intent: "use_item",
        riskLevel: "medium",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/items/runtime/lantern-key.md"],
      },
      {
        id: "opt-talk",
        playerFacingText: "Ask Mira what the glowing brass tooth means.",
        intent: "talk",
        riskLevel: "low",
        likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
      },
      {
        id: "opt-wait",
        playerFacingText: "Wait and listen for movement beyond the canal gate.",
        intent: "wait",
        riskLevel: "medium",
        likelyAffectedPaths: ["wiki/current-scene/scene_state.md"],
      },
    ],
    references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md"],
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
