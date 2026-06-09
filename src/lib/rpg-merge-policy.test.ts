import { describe, expect, it } from "vitest"
import { buildRpgMergeSystemPrompt, getRpgMergePolicy } from "./rpg-interactions/merge"

describe("getRpgMergePolicy", () => {
  it.each([
    ["wiki/sources/fate-notes.md", "source-evidence", "sources", 0.7],
    ["wiki/world/magecraft.md", "stable-operating-model", "world", 0.45],
    ["wiki/locations/church.md", "stable-operating-model", "locations", 0.45],
    ["wiki/factions/association.md", "stable-operating-model", "factions", 0.45],
    ["wiki/items/jeweled-sword.md", "stable-operating-model", "items", 0.45],
    ["wiki/player/status.md", "runtime-state", "player", 0.3],
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
    expect(prompt).toContain("not preserving every factual claim")
    expect(prompt).toContain("Clearly separate confirmed facts from possible futures")
    expect(prompt).not.toContain("Preserves every factual claim from both versions")
  })
})
