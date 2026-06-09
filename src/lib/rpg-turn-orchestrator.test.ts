import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import { createTempProject, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  createFixtureNarrationAdapter,
  validateRpgTurnResult,
  type RpgNarrationPrompt,
} from "./rpg-interactions/runtime"
import {
  runRpgTurn,
  type RpgTurnResult,
  type SubmittedAction,
} from "./rpg-runtime"

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

describe("RPG Runtime Turn Orchestrator", () => {
  it("runs a fixture-driven single turn from submitted action to completed turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-flow") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const submittedAction: SubmittedAction = {
      id: "act-1",
      text: "Ask Mira to inspect the canal gate sigil before I use the lantern key.",
      source: "freeform",
    }
    const turnResult = sampleTurnResult()
    let capturedPrompt: RpgNarrationPrompt | undefined

    const result = await runRpgTurn({
      projectPath,
      submittedAction,
      wikiMode: "llmwikirpg",
      narrationAdapter: {
        async generateTurn(prompt) {
          capturedPrompt = prompt
          return turnResult
        },
      },
    })

    expect(capturedPrompt?.systemPrompt).toContain("RpgTurnResult")
    expect(capturedPrompt?.userPrompt).toContain(submittedAction.text)
    expect(result.brief.submittedAction).toEqual(submittedAction)
    expect(result.brief.currentScene).toContain("locked canal gate")
    expect(result.brief.playerState).toContain("lantern key")
    expect(result.brief.presentCharacters.join("\n")).toContain("Base page: Mira")
    expect(result.brief.presentCharacters.join("\n")).toContain("Overlay page: Mira is limping")
    expect(result.turnResult).toEqual({
      ...turnResult,
      references: ["wiki/characters/mira.md", "wiki/current-scene/scene_state.md", "wiki/player/player.md"],
    })
    expect(result.turnRecord).toEqual({
      submittedAction,
      generatedNarrative: turnResult.narrative,
      references: ["wiki/characters/mira.md", "wiki/current-scene/scene_state.md", "wiki/player/player.md"],
    })
  })

  it("cleans turn result references without allowing legacy paths", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-reference-cleaning") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgTurn({
      projectPath,
      submittedAction: { id: "act-2", text: "Ask Mira about the sigil.", source: "freeform" },
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter({
        ...sampleTurnResult(),
        references: [
          "wiki\\player\\player.md",
          "wiki/player/player.md",
          "wiki/entities/legacy-poison.md",
          "wiki/concepts/legacy-poison.md",
          "./wiki/characters/mira.md",
        ],
      }),
    })

    expect(result.turnResult.references).toEqual(["wiki/characters/mira.md", "wiki/player/player.md"])
    expect(result.turnRecord.references).toEqual(["wiki/characters/mira.md", "wiki/player/player.md"])
  })

  it("rejects malformed narration adapter output", () => {
    expect(() =>
      validateRpgTurnResult({
        nextActionOptions: sampleOptions(),
        references: [],
      }),
    ).toThrow(/narrative/)

    expect(() =>
      validateRpgTurnResult({
        narrative: "The gate clicks.",
        nextActionOptions: sampleOptions().slice(0, 2),
        references: [],
      }),
    ).toThrow(/3 to 5/)

    expect(() =>
      validateRpgTurnResult({
        narrative: "The gate clicks.",
        nextActionOptions: [...sampleOptions(), ...sampleOptions()],
        references: [],
      }),
    ).toThrow(/3 to 5/)

    expect(() =>
      validateRpgTurnResult({
        narrative: "The gate clicks.",
        nextActionOptions: [
          { ...sampleOptions()[0], intent: "romance" },
          sampleOptions()[1],
          sampleOptions()[2],
        ],
        references: [],
      }),
    ).toThrow(/intent/)

    expect(() =>
      validateRpgTurnResult({
        narrative: "The gate clicks.",
        nextActionOptions: [
          sampleOptions()[0],
          { ...sampleOptions()[1], riskLevel: "certain" },
          sampleOptions()[2],
        ],
        references: [],
      }),
    ).toThrow(/riskLevel/)

    expect(() =>
      validateRpgTurnResult({
        narrative: "The gate clicks.",
        nextActionOptions: sampleOptions(),
        references: "wiki/current-scene/scene_state.md",
      }),
    ).toThrow(/references/)
  })

  it("does not let unchosen option text enter the completed turn record", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-options") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const result = await runRpgTurn({
      projectPath,
      submittedAction: {
        id: "act-3",
        text: "Touch the lantern key to the lowest sigil.",
        source: "selected_option",
        selectedOptionId: "opt-key",
      },
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
    })
    const serializedRecord = JSON.stringify(result.turnRecord)

    expect("nextActionOptions" in result.turnRecord).toBe(false)
    expect(serializedRecord).not.toContain("Force the canal gate before Mira finishes reading.")
    expect(serializedRecord).not.toContain("Ask the patrol for help and reveal the lantern key.")
    expect(serializedRecord).not.toContain("opt-force")
  })

  it("does not write wiki files or generate pending updates during stage 4.5", async () => {
    ctx = { tmp: await createTempProject("rpg-turn-orchestrator-readonly") }
    const projectPath = ctx.tmp.path
    await writeTurnFixture(projectPath)

    const before = await snapshotFiles(projectPath)
    const result = await runRpgTurn({
      projectPath,
      submittedAction: { id: "act-4", text: "Wait for Mira to finish studying the sigil.", source: "freeform" },
      wikiMode: "llmwikirpg",
      narrationAdapter: createFixtureNarrationAdapter(sampleTurnResult()),
    })
    const after = await snapshotFiles(projectPath)

    expect(after).toEqual(before)
    expect(JSON.stringify(result)).not.toContain("pendingUpdates")
    expect(JSON.stringify(result)).not.toContain("proposedUpdates")
    expect(await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)).toContain("locked canal gate")
  })
})

async function writeTurnFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/player/player.md`, "# Iven\n\nSmuggler-mage carrying a brass lantern key.")
  await writeFileRaw(`${projectPath}/wiki/characters/mira.md`, "# Mira\n\nBase page: Mira reads canal sigils carefully.")
  await writeFileRaw(
    `${projectPath}/wiki/characters/runtime/mira.md`,
    "# Mira Runtime State\n\nOverlay page: Mira is limping and wary of loud magic.",
  )
  await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nMira bargained with a dock runner.")
  await writeFileRaw(`${projectPath}/wiki/relationships/iven-mira.md`, "# Iven and Mira\n\nTrust is fragile.")
}

function sampleTurnResult(): RpgTurnResult {
  return {
    narrative:
      "Mira steadies herself against the damp stone and studies the sigil. When Iven raises the lantern key, one brass tooth glows in answer.",
    nextActionOptions: sampleOptions(),
    references: ["wiki/current-scene/scene_state.md", "wiki/player/player.md", "wiki/characters/mira.md"],
  }
}

function sampleOptions(): RpgTurnResult["nextActionOptions"] {
  return [
    {
      id: "opt-key",
      playerFacingText: "Touch the lantern key to the lowest sigil.",
      intent: "use_item",
      riskLevel: "medium",
      likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/items/lantern-key.md"],
    },
    {
      id: "opt-force",
      playerFacingText: "Force the canal gate before Mira finishes reading.",
      intent: "fight",
      riskLevel: "high",
      likelyAffectedPaths: ["wiki/current-scene/scene_state.md", "wiki/events/session-03.md"],
    },
    {
      id: "opt-talk",
      playerFacingText: "Ask Mira what the glowing brass tooth means.",
      intent: "talk",
      riskLevel: "low",
      likelyAffectedPaths: ["wiki/relationships/iven-mira.md"],
    },
    {
      id: "opt-patrol",
      playerFacingText: "Ask the patrol for help and reveal the lantern key.",
      intent: "talk",
      riskLevel: "high",
      likelyAffectedPaths: ["wiki/factions/harbor-watch.md"],
    },
  ]
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
