import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { realFs, createTempProject, fileExists, readFileRaw, writeFileRaw } from "@/test-helpers/fs-temp"
import { getRpgImportModeSpec, listRpgImportModeSpecs, runRpgImport } from "."
import {
  CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS,
  getCampaignSetupImportTargetPath,
} from "./campaign-setup-import"

vi.mock("@/commands/fs", () => realFs)

let cleanups: Array<() => Promise<void>> = []

beforeEach(() => {
  cleanups = []
})

afterEach(async () => {
  for (const cleanup of cleanups) {
    await cleanup()
  }
  cleanups = []
})

describe("RPG import campaign_setup_import", () => {
  it("is registered in the RPG import registry", () => {
    expect(getRpgImportModeSpec("campaign_setup_import")?.mode).toBe("campaign_setup_import")
    expect(listRpgImportModeSpecs().map((spec) => spec.mode)).toContain("campaign_setup_import")
  })

  it("exposes supported Stage F target paths", () => {
    expect(CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS).toEqual([
      "player_main",
      "player_abilities",
      "player_inventory",
      "player_goals",
      "player_known_information",
      "current_scene",
      "events_prologue",
      "main_quest",
      "quest",
      "player_relationship",
    ])
    expect(getCampaignSetupImportTargetPath("player_main")).toBe("wiki/player/player.md")
    expect(getCampaignSetupImportTargetPath("player_abilities")).toBe("wiki/player/abilities.md")
    expect(getCampaignSetupImportTargetPath("player_inventory")).toBe("wiki/player/inventory.md")
    expect(getCampaignSetupImportTargetPath("player_goals")).toBe("wiki/player/goals.md")
    expect(getCampaignSetupImportTargetPath("player_known_information")).toBe("wiki/player/known_information.md")
    expect(getCampaignSetupImportTargetPath("current_scene")).toBe("wiki/current-scene/scene_state.md")
    expect(getCampaignSetupImportTargetPath("events_prologue")).toBe("wiki/events/prologue.md")
    expect(getCampaignSetupImportTargetPath("main_quest")).toBe("wiki/quests/main.md")
    expect(getCampaignSetupImportTargetPath("quest", { questName: "Find the Silver Gate" })).toBe("wiki/quests/find-the-silver-gate.md")
    expect(getCampaignSetupImportTargetPath("player_relationship", { relatedCharacter: "Archivist Mara" })).toBe("wiki/relationships/player-archivist-mara.md")
    expect(getCampaignSetupImportTargetPath("player_status")).toBeUndefined()
  })

  it("runs through runRpgImport and writes player_main only to the fixed player slot", async () => {
    const projectPath = await createProject("campaign-player-main")
    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: [
        "# Player",
        "",
        "Name: Iven Vale.",
        "Background: an apprentice cartographer.",
        "Skills: lockpicking and moon-map reading.",
      ].join("\n"),
      sourceFileName: "player-main.md",
      targetSlot: "player_main",
      options: { now: "2026-06-08T03:00:00.000Z" },
    })

    expect(result.mode).toBe("campaign_setup_import")
    expect(result.writtenPaths).toContain("wiki/player/player.md")
    expect(result.writtenPaths.some((path) => path.startsWith("wiki/sources/imports/"))).toBe(true)
    expect(result.warnings.join("\n")).toContain("wiki/player/abilities.md")
    expect(result.warnings.join("\n")).toContain("must not route them to wiki/rules/")

    const player = await readFileRaw(`${projectPath}/wiki/player/player.md`)
    expect(player).toContain('slot_id: "player_main"')
    expect(player).toContain('import_mode: "campaign_setup_import"')
    expect(player).toContain('source_file_name: "player-main.md"')
    expect(player).toContain('imported_at: "2026-06-08T03:00:00.000Z"')
    expect(player).toContain("Iven Vale")
    expect(player).toContain("Fixed player slot: `wiki/player/player.md`")

    expect(await fileExists(`${projectPath}/wiki/player/custom.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/player/status.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/player/abilities.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/rules/core.md`)).toBe(false)
  })

  it("writes player subslot imports directly to their fixed player files", async () => {
    const projectPath = await createProject("campaign-player-subslots")
    const cases = [
      {
        targetSlot: "player_abilities",
        path: "wiki/player/abilities.md",
        text: "Ability: moon-map reading. Cost: one candle mark.",
        bodyHeading: "## Player Abilities",
      },
      {
        targetSlot: "player_inventory",
        path: "wiki/player/inventory.md",
        text: "Inventory: one brass lantern, two chalk sticks.",
        bodyHeading: "## Player Inventory",
      },
      {
        targetSlot: "player_goals",
        path: "wiki/player/goals.md",
        text: "Goal: recover the sealed moon map before dawn.",
        bodyHeading: "## Player Goals",
      },
      {
        targetSlot: "player_known_information",
        path: "wiki/player/known_information.md",
        text: "Known: Mara has the western stair key. Suspicion: the archive bell is a warning.",
        bodyHeading: "## Player Known Information",
      },
    ] as const

    for (const testCase of cases) {
      const result = await runRpgImport({
        mode: "campaign_setup_import",
        projectPath,
        sourceText: testCase.text,
        sourceFileName: `${testCase.targetSlot}.md`,
        targetSlot: testCase.targetSlot,
        options: { now: "2026-06-08T03:30:00.000Z" },
      })

      expect(result.writtenPaths).toContain(testCase.path)
      expect(result.skipped).toEqual([])

      const content = await readFileRaw(`${projectPath}/${testCase.path}`)
      expect(content).toContain(`slot_id: "${testCase.targetSlot}"`)
      expect(content).toContain('import_mode: "campaign_setup_import"')
      expect(content).toContain(testCase.bodyHeading)
      expect(content).toContain(testCase.text)
      expect(content).toContain(`Fixed player slot: \`${testCase.path}\``)
    }

    const player = await fileExists(`${projectPath}/wiki/player/player.md`)
    expect(player).toBe(false)
  })

  it("requires targetSlot and sourceText or sourcePath", async () => {
    const projectPath = await createProject("campaign-required")

    await expect(
      runRpgImport({
        mode: "campaign_setup_import",
        projectPath,
        sourceText: "Player setup.",
      }),
    ).rejects.toThrow("targetSlot")

    await expect(
      runRpgImport({
        mode: "campaign_setup_import",
        projectPath,
        targetSlot: "player_main",
      }),
    ).rejects.toThrow("sourceText or sourcePath")
  })

  it("rejects unsupported targetSlot without writing files", async () => {
    const projectPath = await createProject("campaign-unsupported")

    await expect(
      runRpgImport({
        mode: "campaign_setup_import",
        projectPath,
        sourceText: "Do not write this.",
        targetSlot: "player_status",
      }),
    ).rejects.toThrow(/not supported/)

    expect(await fileExists(`${projectPath}/wiki/player/status.md`)).toBe(false)
    expect(await fileExists(`${projectPath}/wiki/sources/imports/player-status--campaign_setup--player_status.md`)).toBe(false)
  })

  it("does not write current_scene without explicit bootstrap or manual confirmation", async () => {
    const projectPath = await createProject("campaign-current-scene-no-confirm")
    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: "Iven stands outside the sealed archive door. Mara waits beside him.",
      sourceFileName: "opening-scene.md",
      targetSlot: "current_scene",
    })

    expect(result.writtenPaths).not.toContain("wiki/current-scene/scene_state.md")
    expect(result.skipped).toContain("wiki/current-scene/scene_state.md")
    expect(result.warnings.join("\n")).toContain("requires explicitBootstrap or manualConfirm")
    expect(await fileExists(`${projectPath}/wiki/current-scene/scene_state.md`)).toBe(false)

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    expect(rawImportPath).toBe("wiki/sources/imports/opening-scene--campaign_setup--current_scene.md")
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)
    expect(raw).toContain("Iven stands outside the sealed archive door")
  })

  it("overwrites current_scene only with explicit bootstrap or manual confirmation", async () => {
    const projectPath = await createProject("campaign-current-scene-confirm")
    await writeFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nOld scene.")

    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: [
        "# Opening Scene",
        "",
        "Iven is in the Moonlit Archive vestibule.",
        "Mara blocks the western stair.",
      ].join("\n"),
      sourceFileName: "opening-scene.md",
      targetSlot: "current_scene",
      options: { explicitBootstrap: true, now: "2026-06-08T04:00:00.000Z" },
    })

    expect(result.writtenPaths).toContain("wiki/current-scene/scene_state.md")
    expect(result.skipped).toEqual([])

    const scene = await readFileRaw(`${projectPath}/wiki/current-scene/scene_state.md`)
    expect(scene).toContain('slot_id: "current_scene"')
    expect(scene).toContain('write_policy: "overwrite"')
    expect(scene).toContain("explicit_bootstrap: true")
    expect(scene).toContain("Iven is in the Moonlit Archive vestibule")
    expect(scene).not.toContain("Old scene.")
  })

  it("writes events_prologue with already-happened facts and filters possible futures", async () => {
    const projectPath = await createProject("campaign-prologue")
    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: [
        "# Prologue",
        "",
        "Already happened: Iven accepted Mara's map case at dusk.",
        "The archive bell rang once.",
        "",
        "## Possible Futures",
        "",
        "- Mara might later betray Iven.",
        "- Future pressure: the bell may wake the patron in Act 2.",
      ].join("\n"),
      sourceFileName: "prologue.md",
      targetSlot: "events_prologue",
    })

    expect(result.writtenPaths).toContain("wiki/events/prologue.md")
    expect(result.warnings.join("\n")).toContain("keeps that material out of wiki/events/")

    const prologue = await readFileRaw(`${projectPath}/wiki/events/prologue.md`)
    expect(prologue).toContain('slot_id: "events_prologue"')
    expect(prologue).toContain("Already happened: Iven accepted Mara's map case")
    expect(prologue).toContain("The archive bell rang once.")
    expect(prologue).not.toContain("Mara might later betray Iven")
    expect(prologue).not.toContain("Future pressure")
    expect(await fileExists(`${projectPath}/wiki/plot-arcs/patron.md`)).toBe(false)
  })

  it("skips events_prologue when only future pressure remains after filtering", async () => {
    const projectPath = await createProject("campaign-prologue-future-only")
    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: [
        "## Possible Futures",
        "",
        "- Future pressure: the patron may reveal the sigil later.",
        "- Foreshadowing should be preserved elsewhere, not events.",
      ].join("\n"),
      sourceFileName: "future-pressure.md",
      targetSlot: "events_prologue",
    })

    expect(result.writtenPaths).not.toContain("wiki/events/prologue.md")
    expect(result.skipped).toContain("wiki/events/prologue.md")
    expect(result.warnings.join("\n")).toContain("no already-happened prologue facts")
    expect(await fileExists(`${projectPath}/wiki/events/prologue.md`)).toBe(false)

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)
    expect(raw).toContain("Future pressure")
  })

  it("writes main_quest and player_relationship to their setup paths, not runtime overlays", async () => {
    const projectPath = await createProject("campaign-optional-slots")

    await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: "Opening objective: recover the sealed moon map. Blocker: archive ward requires Mara's key.",
      sourceFileName: "main-quest.md",
      targetSlot: "main_quest",
    })
    await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: "Iven trusts Mara's skill but suspects she is hiding the west stair's purpose.",
      sourceFileName: "mara.md",
      targetSlot: "player_relationship",
      options: { relatedCharacter: "Mara" },
    })

    const quest = await readFileRaw(`${projectPath}/wiki/quests/main.md`)
    const relationship = await readFileRaw(`${projectPath}/wiki/relationships/player-mara.md`)
    expect(quest).toContain('slot_id: "main_quest"')
    expect(quest).toContain("Opening objective")
    expect(relationship).toContain('slot_id: "player_relationship"')
    expect(relationship).toContain("Initial Relationship")
    expect(await fileExists(`${projectPath}/wiki/relationships/runtime/player-mara.md`)).toBe(false)
  })

  it("uses sourceText over sourcePath while preserving source path provenance", async () => {
    const projectPath = await createProject("campaign-source-priority")
    await writeFileRaw(`${projectPath}/raw/sources/player.md`, "PATH_TEXT_SHOULD_NOT_APPEAR")

    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: "SOURCE_TEXT_SHOULD_APPEAR",
      sourcePath: `${projectPath}/raw/sources/player.md`,
      targetSlot: "player_main",
      options: { now: "2026-06-08T05:00:00.000Z" },
    })

    const player = await readFileRaw(`${projectPath}/wiki/player/player.md`)
    expect(player).toContain("SOURCE_TEXT_SHOULD_APPEAR")
    expect(player).not.toContain("PATH_TEXT_SHOULD_NOT_APPEAR")
    expect(player).toContain(`source_path: "${projectPath}/raw/sources/player.md"`)
    expect(player).toContain("source_text_takes_priority: true")

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)
    expect(raw).toContain("SOURCE_TEXT_SHOULD_APPEAR")
    expect(raw).not.toContain("PATH_TEXT_SHOULD_NOT_APPEAR")
  })

  it("keeps raw source anchor traceable from target file to import source file", async () => {
    const projectPath = await createProject("campaign-anchor")
    const result = await runRpgImport({
      mode: "campaign_setup_import",
      projectPath,
      sourceText: "Iven starts with one brass lantern.",
      sourceFileName: "Player Main!.md",
      targetSlot: "player_main",
    })

    const rawImportPath = result.writtenPaths.find((path) => path.startsWith("wiki/sources/imports/"))
    expect(rawImportPath).toBe("wiki/sources/imports/player-main--campaign_setup--player_main.md")

    const player = await readFileRaw(`${projectPath}/wiki/player/player.md`)
    const raw = await readFileRaw(`${projectPath}/${rawImportPath}`)
    expect(player).toContain(`source_import_path: "${rawImportPath}"`)
    expect(player).toContain("<!-- campaign_setup_import:player_main:player-main--campaign_setup--player_main -->")
    expect(raw).toContain("<!-- campaign_setup_import:player_main:player-main--campaign_setup--player_main:raw -->")
    expect(raw).toContain("Iven starts with one brass lantern.")
  })
})

async function createProject(label: string): Promise<string> {
  const tmp = await createTempProject(label)
  cleanups.push(tmp.cleanup)

  await writeFileRaw(`${tmp.path}/.llm-wiki/project.json`, JSON.stringify({ mode: "llmwikirpg" }))
  await writeFileRaw(`${tmp.path}/schema.md`, "wikiMode: llmwikirpg\n")
  await writeFileRaw(`${tmp.path}/purpose.md`, "# Purpose\n\nTrack RPG campaign setup.\n")
  await writeFileRaw(`${tmp.path}/wiki/index.md`, "# Index\n")
  await writeFileRaw(`${tmp.path}/wiki/overview.md`, "# Overview\n")

  return tmp.path
}
