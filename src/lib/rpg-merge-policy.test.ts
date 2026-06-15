import { describe, expect, it } from "vitest"
import { buildRpgMergeSystemPrompt, getRpgMergePolicy } from "./rpg-interactions/merge"

describe("getRpgMergePolicy", () => {
  it.each([
    ["wiki/sources/fate-notes.md", "source-evidence", "sources", 0.7],
    ["wiki/world/supernatural_presence.md", "stable-operating-model", "world", 0.45],
    ["wiki/locations/church.md", "stable-operating-model", "locations", 0.45],
    ["wiki/factions/association.md", "stable-operating-model", "factions", 0.45],
    ["wiki/items/jeweled-sword.md", "stable-operating-model", "items", 0.45],
    ["wiki/player/player.md", "runtime-state", "player", 0.3],
    ["wiki/quests/route-objectives.md", "runtime-state", "quests", 0.3],
    ["wiki/events/night-one.md", "event-history", "events", 0.7],
    ["wiki/current-scene/scene_state.md", "current-scene", "current-scene", 0.3],
    ["wiki/style/prose.md", "manual-control", "style", 0.7],
    ["wiki/rules/table.md", "manual-control", "rules", 0.7],
    ["wiki/memory/player-preferences.md", "manual-control", "memory", 0.7],
  ] as const)(
    "classifies %s as %s",
    (path, expectedKind, expectedCategory, expectedThreshold) => {
      const policy = getRpgMergePolicy(path)

      expect(policy.kind).toBe(expectedKind)
      expect(policy.categoryId).toBe(expectedCategory)
      expect(policy.bodyShrinkThreshold).toBe(expectedThreshold)
    },
  )

  it("classifies relationship pages as tension merges with compressive threshold", () => {
    const policy = getRpgMergePolicy("wiki/relationships/rin-shirou.md")

    expect(policy.kind).toBe("relationship-tension")
    expect(policy.categoryId).toBe("relationships")
    expect(policy.bodyShrinkThreshold).toBeLessThan(0.7)
    expect(policy.promptFragment).toContain("playable tension")
  })

  it("classifies runtime overlays as runtime-state merges", () => {
    const policy = getRpgMergePolicy("wiki/characters/runtime/rin.md")

    expect(policy.kind).toBe("runtime-state")
    expect(policy.categoryId).toBe("characters")
    expect(policy.promptFragment).toContain("New confirmed state replaces stale old state")
  })

  it("keeps base character pages as stable operating models", () => {
    const policy = getRpgMergePolicy("wiki/characters/rin.md")

    expect(policy.kind).toBe("stable-operating-model")
    expect(policy.promptFragment).toContain("NPC operating model")
    expect(policy.promptFragment).toContain("wiki/characters/runtime/")
  })

  it("uses fixed world slot guidance for allowed world slots", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/world/basic_overview.md")

    expect(prompt).toContain("Schema slot: world_basic_overview")
    expect(prompt).toContain("Write policy: merge")
    expect(prompt).toContain("Fixed world slot merge for wiki/world/basic_overview.md")
    expect(prompt).toContain("do not create or imply arbitrary wiki/world/<custom>.md pages")
    expect(prompt).toContain("not runtime state")
  })

  it("does not encourage arbitrary world pages as normal world slots", () => {
    const policy = getRpgMergePolicy("wiki/world/tide-laws.md")
    const prompt = buildRpgMergeSystemPrompt("wiki/world/tide-laws.md")

    expect(policy.kind).toBe("generic-rpg")
    expect(prompt).toContain("Unsupported world path merge")
    expect(prompt).toContain("current schema only allows fixed wiki/world/*.md slots")
    expect(prompt).not.toContain("Fixed world slot merge")
  })

  it.each([
    ["wiki/player/player.md", "PC identity"],
    ["wiki/player/abilities.md", "PC abilities"],
    ["wiki/player/inventory.md", "current holdings"],
    ["wiki/player/goals.md", "PC subjective motives"],
    ["wiki/player/known_information.md", "PC-known information"],
  ] as const)("uses fixed player slot guidance for %s", (path, boundaryText) => {
    const prompt = buildRpgMergeSystemPrompt(path)

    expect(prompt).toContain("Fixed player slot merge")
    expect(prompt).toContain("do not create or imply arbitrary wiki/player/*.md runtime pages")
    expect(prompt).toContain(boundaryText)
  })

  it("does not classify arbitrary player pages as fixed player slots", () => {
    const policy = getRpgMergePolicy("wiki/player/custom-sheet.md")
    const prompt = buildRpgMergeSystemPrompt("wiki/player/custom-sheet.md")

    expect(policy.kind).toBe("generic-rpg")
    expect(prompt).toContain("Unsupported player path merge")
    expect(prompt).toContain("current schema only allows fixed wiki/player/*.md slots")
    expect(prompt).not.toContain("Fixed player slot merge")
  })

  it("uses overwrite latest-snapshot guidance for current scene", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/current-scene/scene_state.md")

    expect(prompt).toContain("Schema slot: current_scene")
    expect(prompt).toContain("Write policy: overwrite")
    expect(prompt).toContain("overwrite-only latest snapshot")
    expect(prompt).toContain("not accumulated history")
  })

  it("uses outline progress guidance without rewriting the main outline", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/outlines/progress.md")

    expect(prompt).toContain("Schema slot: outline_progress")
    expect(prompt).toContain("Outline progress merge")
    expect(prompt).toContain("completed beats, skipped beats, advanced beats, delayed beats")
    expect(prompt).toContain("Do not rewrite wiki/outlines/main.md")
  })

  it("uses quest guidance for trackable objectives", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/quests/main.md")

    expect(prompt).toContain("Quest merge for wiki/quests/*.md")
    expect(prompt).toContain("game-recognized trackable objectives")
    expect(prompt).toContain("not any PC wish, subjective goal, player TODO/checklist")
    expect(prompt).toContain("or plot pressure")
  })

  it("uses runtime relationship overlay guidance for relationship runtime pages", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/relationships/runtime/rin-shirou.md")

    expect(prompt).toContain("Runtime relationship overlay merge")
    expect(prompt).toContain("accepted/reviewed relationship deltas")
    expect(prompt).toContain("base relationships/*.md")
  })

  it("uses base relationship guidance for non-runtime relationship pages", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/relationships/rin-shirou.md")

    expect(prompt).toContain("Base relationship boundary merge")
    expect(prompt).toContain("Runtime trust/conflict/misunderstanding changes")
    expect(prompt).toContain("wiki/relationships/runtime/")
  })

  it("uses runtime plot arc overlay guidance for plot arc runtime pages", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/plot-arcs/runtime/main.md")

    expect(prompt).toContain("Runtime plot arc overlay merge")
    expect(prompt).toContain("runtime branch state")
    expect(prompt).toContain("triggered/skipped/advanced/delayed beats")
  })

  it("uses base plot arc guidance for non-runtime plot arc pages", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/plot-arcs/main.md")

    expect(prompt).toContain("Base plot-arc merge")
    expect(prompt).toContain("possible developments")
    expect(prompt).toContain("Possible futures may remain possible futures")
    expect(prompt).toContain("wiki/plot-arcs/runtime/")
  })

  it("keeps event history prompt limited to confirmed happened material", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/events/main.md")

    expect(prompt).toContain("confirmed, already-happened events")
    expect(prompt).toContain("attempted_not_confirmed")
    expect(prompt).toContain("possible_future")
    expect(prompt).toContain("candidate action")
  })

  it("keeps unknown legacy-style paths on the conservative generic policy", () => {
    const policy = getRpgMergePolicy("wiki/entities/foo.md")

    expect(policy.kind).toBe("generic-rpg")
    expect(policy.categoryId).toBe("entities")
    expect(policy.bodyShrinkThreshold).toBe(0.7)
  })
})

describe("buildRpgMergeSystemPrompt", () => {
  it("builds a runtime-oriented prompt instead of the old encyclopedia merge prompt", () => {
    const prompt = buildRpgMergeSystemPrompt("wiki/plot-arcs/main.md")

    expect(prompt).toContain("You are not merging an encyclopedia page.")
    expect(prompt).toContain("Merge policy: plot-pressure")
    expect(prompt).toContain("Write policy: merge")
    expect(prompt).toContain("Category/base-runtime boundary:")
    expect(prompt).toContain("not preserving every factual claim")
    expect(prompt).toContain("Clearly separate confirmed facts from possible futures")
    expect(prompt).not.toContain("Preserves every factual claim from both versions")
  })
})
