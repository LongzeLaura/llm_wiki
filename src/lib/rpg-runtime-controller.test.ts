import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, fileExists, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createFixtureRuntimeUpdateInteractionAdapter,
  createFixtureNarrationAdapter,
} from "./rpg-interactions/runtime"
import type { RpgInteractionPrompt } from "./rpg-interactions"
import {
  runRpgRuntimeTurnFlow,
  type RpgTurnResult,
  type SubmittedAction,
} from "./rpg-runtime"
import { RPG_SCHEMA_SLOTS } from "./rpg-wiki-schema"
import type { RuntimeTurnJournalEntry } from "./rpg-runtime/runtime-persistence"
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
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput()),
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

  it("turns interaction rpg-wiki-update fenced blocks into proposed and pending updates", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-fenced") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-fenced"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput()),
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

  it("uses injected runtime update interaction output instead of narration update blocks", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-wins") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-wins"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/player/known_information.md",
          "strategy: merge",
          "reason: Track the player's active key clue from the completed turn.",
          "---",
          "Iven now knows the lantern key answers the canal gate's lowest sigil.",
          "```",
        ].join("\n"),
      ),
    })

    expect(result.proposedUpdates.map((update) => [update.targetPath, update.strategy])).toEqual([
      ["wiki/player/known_information.md", "merge"],
    ])
    expect(result.pendingUpdates).toEqual([
      expect.objectContaining({
        targetPath: "wiki/player/known_information.md",
        strategy: "merge",
        status: "pending",
        content: "Iven now knows the lantern key answers the canal gate's lowest sigil.",
      }),
    ])
  })

  it("does not parse narration update blocks when injected runtime update interaction output is empty", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-empty") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-empty"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(""),
    })

    expect(result.turnResult.narrative).toContain("rpg-wiki-update")
    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
  })

  it("creates pending updates from interaction output even when narration has no update block", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-only") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-only"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
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
      ),
    })

    expect(result.turnResult.narrative).not.toContain("rpg-wiki-update")
    expect(result.proposedUpdates).toEqual([
      expect.objectContaining({
        targetPath: "wiki/events/canal-gate-sigil.md",
        strategy: "append",
      }),
    ])
    expect(result.pendingUpdates).toHaveLength(1)
    expect(result.pendingUpdates[0]).toMatchObject({
      targetPath: "wiki/events/canal-gate-sigil.md",
      status: "pending",
    })
  })

  it("merges interaction parse warnings and skips invalid interaction target paths", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-warning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-warning"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/world/city.md",
          "strategy: merge",
          "reason: Stable world pages are not runtime update targets.",
          "---",
          "WORLD_POISON",
          "```",
        ].join("\n"),
      ),
    })

    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
    expect(result.warnings.join("\n")).toContain("outside allowed runtime update paths")
  })

  it("keeps validation-rejected proposals out of the pending queue and reports them as warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-validation-reject") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-validation-reject"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
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
          "",
          "```rpg-wiki-update",
          "targetPath: wiki/current-scene/scene_state.md",
          "strategy: overwrite",
          "reason: Keep the latest scene snapshot.",
          "---",
          "# Current Scene",
          "",
          "Iven and Mira remain by the canal gate while the lowest sigil glows.",
          "```",
        ].join("\n"),
      ),
    })

    expect(result.proposedUpdates.map((update) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
      "wiki/current-scene/scene_state.md",
    ])
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(["wiki/current-scene/scene_state.md"])
    expect(result.runtimeUpdateValidation.rejectedUpdates.map(({ update }) => update.targetPath)).toEqual([
      "wiki/events/canal-gate-future.md",
    ])
    expect(result.warnings.join("\n")).toContain("events_future_candidate_pollution")
    expect(result.pendingUpdates.some((update) => update.targetPath.includes("future"))).toBe(false)
  })

  it("persists validation rejected summary and warning-only issues in the turn journal", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-validation-journal") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-validation-journal"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/events/canal-gate-future.md",
          "strategy: append",
          "reason: This wrongly stores next action material as event history.",
          "---",
          "# Canal Gate Future",
          "",
          "## Next Actions",
          "- The player may force the gate.",
          "```",
          "",
          "```rpg-wiki-update",
          "targetPath: wiki/player/player.md",
          "strategy: merge",
          "reason: Track a profile-like runtime update for review.",
          "---",
          "# Player Profile",
          "",
          "## Character Profile",
          "This looks like a stable character sheet and should stay warning-visible.",
          "```",
        ].join("\n"),
      ),
      runtimePersistence: { appendTurnJournalEntry },
    })

    const entry = appendTurnJournalEntry.mock.calls[0]?.[1] as RuntimeTurnJournalEntry
    expect(result.pendingUpdates.map((update) => update.targetPath)).toEqual(["wiki/player/player.md"])
    expect(entry.runtimeUpdateValidation).toEqual({
      acceptedUpdateIds: [result.pendingUpdates[0].id],
      rejectedUpdates: [
        expect.objectContaining({
          targetPath: "wiki/events/canal-gate-future.md",
          issueCodes: expect.arrayContaining(["events_future_candidate_pollution"]),
        }),
      ],
      warningIssues: [
        expect.objectContaining({
          targetPath: "wiki/player/player.md",
          code: "runtime_stable_page_pollution",
        }),
      ],
    })
    expect(entry.warnings.join("\n")).toContain("events_future_candidate_pollution")
    expect(entry.warnings.join("\n")).toContain("runtime_stable_page_pollution")
  })

  it("builds the update interaction prompt from the completed turn record without next action option text", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-interaction-prompt") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    let capturedPrompt: RpgInteractionPrompt | undefined

    await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-interaction-prompt"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: {
        async generateUpdateProposal(prompt) {
          capturedPrompt = prompt
          return ""
        },
      },
    })

    const combined = `${capturedPrompt?.systemPrompt ?? ""}\n${capturedPrompt?.userPrompt ?? ""}`
    expect(combined).toContain("Mira traces the lowest sigil")
    expect(combined).toContain("There is intentionally no nextActionOptions section here")
    expect(combined).not.toContain("Touch the lantern key to the lowest sigil")
    expect(combined).not.toContain("opt-key")
  })

  it("appends a completed turn journal entry when persistence is injected", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-journal") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)
    const appendTurnJournalEntry = vi.fn(async (_projectPath: string, _entry: RuntimeTurnJournalEntry) => undefined)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-journal"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/events/canal-gate-sigil.md",
          "strategy: append",
          "reason: Record the completed sigil inspection as happened history.",
          "---",
          "# Canal Gate Sigil",
          "",
          "Mira confirmed the lantern key answers the canal gate's lowest sigil.",
          "```",
        ].join("\n"),
      ),
      runtimePersistence: { appendTurnJournalEntry },
    })

    expect(appendTurnJournalEntry).toHaveBeenCalledOnce()
    const [journalProjectPath, entry] = appendTurnJournalEntry.mock.calls[0] as [string, RuntimeTurnJournalEntry]
    expect(journalProjectPath).toBe(projectPath)
    expect(entry.timestamp).toEqual(expect.any(String))
    expect(entry.submittedAction.id).toBe("turn-journal")
    expect(entry.turnRecord).toEqual(result.turnRecord)
    expect(entry.turnResult).toEqual(result.turnResult)
    expect(entry.proposedUpdates.map((update) => update.id)).toEqual(result.proposedUpdates.map((update) => update.id))
    expect(entry.pendingUpdateIds).toEqual(result.pendingUpdates.map((update) => update.id))
    expect(entry.warnings).toEqual([])
    expect(entry.proposalSource).toBe("interaction")
    expect(result.proposalSource).toBe("interaction")
  })

  it("merges turn journal persistence warnings into controller warnings", async () => {
    ctx = { tmp: await createTempProject("rpg-runtime-controller-journal-warning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgRuntimeTurnFlow({
      projectPath,
      submittedAction: sampleSubmittedAction("turn-journal-warning"),
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResultWithoutUpdateBlocks()),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(""),
      runtimePersistence: {
        appendTurnJournalEntry: vi.fn(async () => ({ warnings: ["Journal write skipped in test."] })),
      },
    })

    expect(result.warnings).toContain("Journal write skipped in test.")
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
        ...sampleTurnResultWithoutUpdateBlocks(),
        narrative: "Mira studies the sigil, but the scene snapshot is missing from disk.",
      }),
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(
        [
          "```rpg-wiki-update",
          "targetPath: wiki/world/city.md",
          "strategy: merge",
          "reason: This stable path must be filtered.",
          "---",
          "WORLD_POISON",
          "```",
        ].join("\n"),
      ),
    })

    expect(result.proposedUpdates).toEqual([])
    expect(result.pendingUpdates).toEqual([])
    expect(result.warnings.join("\n")).toContain("Missing required RPG schema slot: current_scene (wiki/current-scene/scene_state.md)")
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
        updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(""),
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
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput()),
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
      updateInteractionAdapter: createFixtureRuntimeUpdateInteractionAdapter(sampleRuntimeUpdateOutput()),
    })

    expect(result.pendingUpdates).toHaveLength(2)
    expect(result.pendingUpdates.every((update) => update.status === "pending")).toBe(true)
    expect(updateStaging.acceptPendingRpgUpdate).not.toHaveBeenCalled()
    expect(updateStaging.rejectPendingRpgUpdate).not.toHaveBeenCalled()
    expect(writePolicy.applyRpgPendingUpdates).not.toHaveBeenCalled()
  })
})

async function writeTurnFixture(projectPath: string): Promise<void> {
  await Promise.all(
    RPG_SCHEMA_SLOTS.map((slot) =>
      writeFileRaw(`${projectPath}/${slot.path}`, `# ${slot.slotId}\n\nTest fixture slot.`),
    ),
  )
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
        likelyAffectedPaths: ["wiki/relationships/runtime/iven-mira.md"],
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

function sampleTurnResultWithoutUpdateBlocks(): RpgTurnResult {
  return {
    ...sampleTurnResult(),
    narrative: "Mira traces the lowest sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
  }
}

function sampleRuntimeUpdateOutput(): string {
  return sampleTurnResult().narrative
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
