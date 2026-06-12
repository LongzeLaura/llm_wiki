import { afterEach, describe, expect, it, vi } from "vitest"
import { createTempProject, readFileRaw, realFs, writeFileRaw } from "@/test-helpers/fs-temp"
import {
  buildRecallSelectorInputFromTurnState,
  buildRecallSelectorInputFromTurnStateAndWiki,
  createRecallSelectorHandoff,
  readRecalledMaterials,
  type RecallSelection,
  type RetrievalIndexEntry,
  type SubmittedAction,
} from "./rpg-runtime"
import {
  sampleActionResolution,
  samplePostActionWorkingState,
  sampleRecallSelection,
  sampleVisibleSelection,
  sampleWorldTickResult,
} from "./rpg-runtime-test-fixtures"
import { RPG_SCHEMA_SLOTS, RPG_WIKI_SCHEMA } from "./rpg-wiki-schema"

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

describe("RPG Recall Selector deterministic handoff", () => {
  it("builds RecallSelectorInput from post-action turn state plus fixture wiki readers", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-input-builder") }
    const projectPath = ctx.tmp.path
    await writeRecallFixture(projectPath)
    const state = sampleTurnState()

    const { input, warnings } = await buildRecallSelectorInputFromTurnStateAndWiki({
      projectPath,
      submittedAction: state.postActionWorkingState.submittedAction,
      actionResolution: state.actionResolution,
      worldTickResult: state.worldTickResult,
      visibleSelection: state.visibleSelection,
      postActionWorkingState: state.postActionWorkingState,
    })
    const serialized = JSON.stringify(input.retrievalIndex)
    const paths = input.retrievalIndex.map((entry) => entry.path)

    expect(input.postActionWorkingState).toBe(state.postActionWorkingState)
    expect(input.actionResolution).toBe(state.actionResolution)
    expect(paths).toEqual(
      expect.arrayContaining([
        "wiki/current-scene/scene_state.md",
        "wiki/events/session-02.md",
        "wiki/sources/canal-notes.md",
        "wiki/characters/mira.md",
        "wiki/characters/runtime/mira.md",
        "wiki/locations/runtime/canal-gate.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/items/runtime/lantern-key.md",
        "wiki/relationships/runtime/player_mira.md",
        "wiki/plot-arcs/runtime/canal-gate.md",
        "wiki/quests/open-canal-gate.md",
        "wiki/outlines/progress.md",
      ]),
    )
    expect(
      input.retrievalIndex.find((entry) => entry.path === "wiki/current-scene/scene_state.md")?.availableSections,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ sectionId: "slot.current_scene" })]))
    expect(
      input.retrievalIndex.find((entry) => entry.path === "wiki/factions/runtime/harbor-watch.md")?.lineTargets,
    ).toEqual(expect.arrayContaining(["parallelLine", "tensionLine"]))
    expect(serialized).toContain("Relevant source provenance reference")
    expect(serialized).toContain("Runtime plot pressure: gate sequence should move")
    expect(serialized).toContain("Quest: open the canal gate")
    expect(serialized).not.toContain("central compact brief reference available")
    expect(input.recallPolicy.notes.join("\n")).toContain("module-specific wiki reads")
    expect(warnings.join("\n")).toContain("synthetic sectionId")
  })

  it("builds a lightweight retrieval index from post-action state without file bodies", () => {
    const state = sampleTurnState()
    const { input, warnings } = buildRecallSelectorInputFromTurnState(state)
    const serialized = JSON.stringify(input.retrievalIndex)

    expect(input.postActionWorkingState).toBe(state.postActionWorkingState)
    expect(input.retrievalIndex.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "wiki/current-scene/scene_state.md",
        "wiki/factions/runtime/harbor-watch.md",
        "wiki/outlines/progress.md",
      ]),
    )
    expect(serialized).not.toContain("Iven and Mira are beneath the River Port")
    expect(serialized).not.toContain("Base page: Mira")
    expect(input.retrievalIndex.find((entry) => entry.path === "wiki/current-scene/scene_state.md")?.availableSections).toEqual(
      expect.arrayContaining([expect.objectContaining({ sectionId: "slot.current_scene" })]),
    )
    expect(warnings.join("\n")).toContain("synthetic sectionId")
  })

  it("reads only selected allowlist paths and sections into recalledMaterials", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-allowlist") }
    await writeFileRaw(
      `${ctx.tmp.path}/wiki/current-scene/scene_state.md`,
      "# Current Scene\n\nALLOWLISTED_CANAL_GATE_STATE",
    )
    await writeFileRaw(`${ctx.tmp.path}/wiki/player/player.md`, "# Player\n\nUNSELECTED_PLAYER_POISON")

    const selection = sampleRecallSelection()
    const result = await createRecallSelectorHandoff({
      projectPath: ctx.tmp.path,
      retrievalIndex: sampleIndex(),
      recallSelection: selection,
    })
    const serialized = JSON.stringify(result.recalledMaterials)

    expect(result.recallSelection).toEqual(selection)
    expect(result.recalledMaterials).toHaveLength(1)
    expect(result.recalledMaterials[0]).toMatchObject({
      path: "wiki/current-scene/scene_state.md",
      readMode: "summary",
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
    })
    expect(result.recalledMaterials[0].sections.map((section) => section.sectionId)).toEqual(["slot.current_scene"])
    expect(serialized).toContain("ALLOWLISTED_CANAL_GATE_STATE")
    expect(serialized).not.toContain("UNSELECTED_PLAYER_POISON")
    expect(await readFileRaw(`${ctx.tmp.path}/wiki/player/player.md`)).toContain("UNSELECTED_PLAYER_POISON")
  })

  it("rejects selected paths that are absent from the retrieval index", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-unknown-path") }
    await writeFileRaw(`${ctx.tmp.path}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nVisible.")

    const selection = {
      ...sampleRecallSelection(),
      selectedItems: [
        {
          ...sampleRecallSelection().selectedItems[0],
          path: "wiki/player/player.md",
        },
      ],
    } satisfies RecallSelection

    await expect(
      readRecalledMaterials({
        projectPath: ctx.tmp.path,
        retrievalIndex: sampleIndex().filter((entry) => entry.path !== "wiki/player/player.md"),
        recallSelection: selection,
      }),
    ).rejects.toThrow(/not present in retrievalIndex/)
  })

  it("rejects unknown selected sectionIds before reading", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-unknown-section") }
    await writeFileRaw(`${ctx.tmp.path}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nUNKNOWN_SECTION_POISON")
    const selection = {
      ...sampleRecallSelection(),
      selectedItems: [
        {
          ...sampleRecallSelection().selectedItems[0],
          sections: [
            {
              ...sampleRecallSelection().selectedItems[0].sections[0],
              sectionId: "missing.section",
            },
          ],
        },
      ],
    } satisfies RecallSelection

    await expect(
      readRecalledMaterials({
        projectPath: ctx.tmp.path,
        retrievalIndex: sampleIndex(),
        recallSelection: selection,
      }),
    ).rejects.toThrow(/sectionId is not present/)
  })

  it("honors path and section exclusions without reading excluded material", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-exclusions") }
    await writeFileRaw(`${ctx.tmp.path}/wiki/current-scene/scene_state.md`, "# Current Scene\n\nEXCLUDED_SCENE_POISON")

    const pathExcluded = {
      ...sampleRecallSelection(),
      exclusions: [
        {
          path: "wiki/current-scene/scene_state.md",
          sectionIds: [],
          reason: "Do not read the current scene this turn.",
        },
      ],
    } satisfies RecallSelection
    const pathResult = await readRecalledMaterials({
      projectPath: ctx.tmp.path,
      retrievalIndex: sampleIndex(),
      recallSelection: pathExcluded,
    })
    expect(pathResult.recalledMaterials).toEqual([])
    expect(pathResult.warnings.join("\n")).toContain("skipped excluded path")

    const sectionExcluded = {
      ...sampleRecallSelection(),
      exclusions: [
        {
          path: "wiki/current-scene/scene_state.md",
          sectionIds: ["slot.current_scene"],
          reason: "Do not read this section.",
        },
      ],
    } satisfies RecallSelection
    const sectionResult = await readRecalledMaterials({
      projectPath: ctx.tmp.path,
      retrievalIndex: sampleIndex(),
      recallSelection: sectionExcluded,
    })
    expect(sectionResult.recalledMaterials).toEqual([])
    expect(sectionResult.warnings.join("\n")).toContain("skipped excluded section")
    expect(JSON.stringify(sectionResult)).not.toContain("EXCLUDED_SCENE_POISON")
  })

  it("rejects traversal, absolute, hidden, and ordinary wiki/runtime paths", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-path-safety") }
    const unsafePaths = [
      "../wiki/current-scene/scene_state.md",
      "C:/tmp/wiki/current-scene/scene_state.md",
      "wiki/.hidden/scene.md",
      "wiki/runtime/turn.md",
    ]

    for (const unsafePath of unsafePaths) {
      await expect(
        readRecalledMaterials({
          projectPath: ctx.tmp.path,
          retrievalIndex: [
            {
              ...sampleIndex()[0],
              path: unsafePath,
            },
          ],
          recallSelection: {
            ...sampleRecallSelection(),
            selectedItems: [
              {
                ...sampleRecallSelection().selectedItems[0],
                path: unsafePath,
              },
            ],
          },
        }),
      ).rejects.toThrow(/unsafe wiki path|project root escape|not present in retrievalIndex/)
    }
  })

  it("caps wiki/outlines/main.md instead of handing the full outline to Narration", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-outline-cap") }
    await writeFileRaw(
      `${ctx.tmp.path}/wiki/outlines/main.md`,
      `# Main Outline\n\n${"OUTLINE_SECRET ".repeat(700)}END_OF_FULL_OUTLINE_SHOULD_NOT_APPEAR`,
    )
    const selection = {
      ...sampleRecallSelection(),
      selectedItems: [
        {
          ...sampleRecallSelection().selectedItems[0],
          path: "wiki/outlines/main.md",
          lineTarget: "tensionLine",
          readMode: "fullPage",
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
          sections: [
            {
              sectionId: "slot.main_outline",
              reason: "Need only a controlled outline excerpt.",
              expectedUse: "Audit that full outline handoff is capped.",
              priority: "high",
            },
          ],
        },
      ],
      exclusions: [],
    } satisfies RecallSelection
    const result = await readRecalledMaterials({
      projectPath: ctx.tmp.path,
      retrievalIndex: sampleIndex(),
      recallSelection: selection,
    })
    const serialized = JSON.stringify(result.recalledMaterials)

    expect(serialized).toContain("OUTLINE_SECRET")
    expect(serialized).not.toContain("END_OF_FULL_OUTLINE_SHOULD_NOT_APPEAR")
    expect(serialized).toContain("full outline handoff to Narration is forbidden")
  })

  it("preserves parallelLine and user_visible_pc_unknown knowledge boundaries in recalled materials", async () => {
    ctx = { tmp: await createTempProject("rpg-recall-handoff-parallel-boundary") }
    await writeFileRaw(
      `${ctx.tmp.path}/wiki/factions/runtime/harbor-watch.md`,
      "# Harbor Watch Runtime\n\nA captain orders a sweep that the PC does not know.",
    )
    const selection = {
      ...sampleRecallSelection(),
      selectedItems: [
        {
          ...sampleRecallSelection().selectedItems[0],
          path: "wiki/factions/runtime/harbor-watch.md",
          lineTarget: "parallelLine",
          visibilityScope: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
          sections: [
            {
              sectionId: "runtime.current_order",
              reason: "Selected as parallel-line material.",
              expectedUse: "Optional parallel lens, not PC knowledge.",
              priority: "high",
            },
          ],
        },
      ],
      exclusions: [],
    } satisfies RecallSelection

    const result = await readRecalledMaterials({
      projectPath: ctx.tmp.path,
      retrievalIndex: sampleIndex(),
      recallSelection: selection,
    })

    expect(result.recalledMaterials[0]).toMatchObject({
      lineTarget: "parallelLine",
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
    })
    expect(result.recalledMaterials[0].knowledgeScope).not.toBe("pc_known")
  })

  it("does not modify schema slots or add an ordinary wiki/runtime category", () => {
    expect(RPG_SCHEMA_SLOTS).toHaveLength(22)
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).not.toContain("runtime")
  })
})

async function writeRecallFixture(projectPath: string): Promise<void> {
  await writeFileRaw(
    `${projectPath}/wiki/current-scene/scene_state.md`,
    "# Current Scene\n\nIven and Mira are beneath the River Port, facing a locked canal gate.",
  )
  await writeFileRaw(`${projectPath}/wiki/events/session-02.md`, "# Session 02\n\nRelevant event: Mira bargained with a dock runner.")
  await writeFileRaw(`${projectPath}/wiki/sources/canal-notes.md`, "# Canal Notes\n\nSource provenance for the canal gate.")
  await writeFileRaw(`${projectPath}/wiki/characters/mira.md`, "# Mira\n\nBase page: Mira reads canal sigils carefully.")
  await writeFileRaw(`${projectPath}/wiki/characters/runtime/mira.md`, "# Mira Runtime\n\nOverlay page: Mira is limping and wary of loud magic.")
  await writeFileRaw(`${projectPath}/wiki/locations/runtime/canal-gate.md`, "# Canal Gate Runtime\n\nThe gate is locked and watched.")
  await writeFileRaw(`${projectPath}/wiki/factions/runtime/harbor-watch.md`, "# Harbor Watch Runtime\n\nA captain orders a delayed sweep.")
  await writeFileRaw(`${projectPath}/wiki/items/runtime/lantern-key.md`, "# Lantern Key Runtime\n\nThe lantern key reacts to cracked sigils.")
  await writeFileRaw(`${projectPath}/wiki/relationships/runtime/player_mira.md`, "# Player / Mira Runtime\n\nMira notices Iven defers to her expertise.")
  await writeFileRaw(`${projectPath}/wiki/plot-arcs/runtime/canal-gate.md`, "# Canal Gate Runtime Arc\n\nRuntime plot pressure: gate sequence should move.")
  await writeFileRaw(`${projectPath}/wiki/quests/open-canal-gate.md`, "# Open Canal Gate\n\nQuest: open the canal gate without alerting patrols.")
  await writeFileRaw(`${projectPath}/wiki/outlines/progress.md`, "# Outline Progress\n\nCurrent Stage: Decode the canal gate.")
}

function sampleTurnState() {
  const submittedAction: SubmittedAction = {
    id: "act-recall-handoff",
    text: "Wait while Mira reads the canal gate sigil.",
    source: "freeform",
  }
  const actionResolution = sampleActionResolution(submittedAction)
  const worldTickResult = sampleWorldTickResult(actionResolution)
  const visibleSelection = sampleVisibleSelection(actionResolution, worldTickResult)
  return {
    actionResolution,
    worldTickResult,
    visibleSelection,
    postActionWorkingState: samplePostActionWorkingState(
      submittedAction,
      actionResolution,
      worldTickResult,
      visibleSelection,
    ),
  }
}

function sampleIndex(): RetrievalIndexEntry[] {
  return [
    {
      path: "wiki/current-scene/scene_state.md",
      title: "scene_state",
      categoryId: "current-scene",
      summary: "Current scene metadata only.",
      lineTargets: ["playerVisibleLine"],
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      availableSections: [
        {
          sectionId: "slot.current_scene",
          sectionRole: "schema_slot",
          heading: "current_scene",
          aliases: [],
          lineTargets: ["playerVisibleLine"],
          readModes: ["summary", "focusedSection", "metadataOnly"],
          visibilityScope: "pc_visible",
          knowledgeScope: "pc_known",
        },
      ],
    },
    {
      path: "wiki/player/player.md",
      title: "player",
      categoryId: "player",
      summary: "Player page metadata only.",
      lineTargets: ["playerVisibleLine"],
      visibilityScope: "pc_visible",
      knowledgeScope: "pc_known",
      availableSections: [
        {
          sectionId: "slot.player_main",
          sectionRole: "schema_slot",
          heading: "player_main",
          aliases: [],
          lineTargets: ["playerVisibleLine"],
          readModes: ["summary", "focusedSection", "metadataOnly"],
          visibilityScope: "pc_visible",
          knowledgeScope: "pc_known",
        },
      ],
    },
    {
      path: "wiki/factions/runtime/harbor-watch.md",
      title: "harbor-watch",
      categoryId: "factions",
      summary: "Runtime faction overlay metadata only.",
      lineTargets: ["parallelLine", "tensionLine"],
      visibilityScope: "user_visible_pc_unknown",
      knowledgeScope: "user_only",
      availableSections: [
        {
          sectionId: "runtime.current_order",
          sectionRole: "runtime_overlay",
          heading: "current_order",
          aliases: [],
          lineTargets: ["parallelLine", "tensionLine"],
          readModes: ["summary", "focusedSection", "metadataOnly"],
          visibilityScope: "user_visible_pc_unknown",
          knowledgeScope: "user_only",
        },
      ],
    },
    {
      path: "wiki/outlines/main.md",
      title: "main",
      categoryId: "outlines",
      summary: "Main outline metadata only.",
      lineTargets: ["tensionLine"],
      visibilityScope: "gm_only",
      knowledgeScope: "gm_only",
      availableSections: [
        {
          sectionId: "slot.main_outline",
          sectionRole: "schema_slot",
          heading: "main_outline",
          aliases: [],
          lineTargets: ["tensionLine"],
          readModes: ["summary", "focusedSection", "metadataOnly", "fullPage"],
          visibilityScope: "gm_only",
          knowledgeScope: "gm_only",
        },
      ],
    },
  ]
}
