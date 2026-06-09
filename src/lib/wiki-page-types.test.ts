import { describe, expect, it } from "vitest"
import { RPG_CATEGORIES, getRpgCategoryById, getRpgCategoryByPath } from "./rpg-categories"
import { GENERATION_WIKI_TYPES, inferWikiTypeFromPath, wikiTypeLabel } from "./wiki-page-types"

describe("inferWikiTypeFromPath", () => {
  it("recognizes RPG source and overview pages", () => {
    expect(inferWikiTypeFromPath("/project/wiki/sources/paper.md")).toBe("source")
    expect(inferWikiTypeFromPath("/project/wiki/overview.md")).toBe("overview")
  })

  it("treats legacy llm_wiki directories as unsupported custom directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/entities/ada-lovelace.md")).toBe("entities")
    expect(inferWikiTypeFromPath("/project/wiki/concepts/attention.md")).toBe("concepts")
    expect(inferWikiTypeFromPath("/project/wiki/queries/open-question.md")).toBe("queries")
    expect(inferWikiTypeFromPath("/project/wiki/comparisons/model-a-vs-b.md")).toBe("comparisons")
    expect(inferWikiTypeFromPath("/project/wiki/synthesis/summary.md")).toBe("synthesis")
    expect(inferWikiTypeFromPath("C:\\wiki\\findings\\result.md")).toBe("findings")
  })

  it("uses custom wiki subdirectories as dynamic types", () => {
    expect(inferWikiTypeFromPath("/project/wiki/people/ada-lovelace.md")).toBe("people")
    expect(inferWikiTypeFromPath("/project/wiki/technologies/vector-db.md")).toBe("technologies")
  })

  it("recognizes RPG wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/world/history.md")).toBe("world")
    expect(inferWikiTypeFromPath("/project/wiki/characters/rin.md")).toBe("characters")
    expect(inferWikiTypeFromPath("/project/wiki/characters/runtime/rin.md")).toBe("characters")
    expect(inferWikiTypeFromPath("/project/wiki/player/profile.md")).toBe("player")
    expect(inferWikiTypeFromPath("/project/wiki/locations/temple.md")).toBe("locations")
    expect(inferWikiTypeFromPath("/project/wiki/locations/runtime/church.md")).toBe("locations")
    expect(inferWikiTypeFromPath("/project/wiki/factions/mage-association.md")).toBe("factions")
    expect(inferWikiTypeFromPath("/project/wiki/factions/runtime/mage-association.md")).toBe("factions")
    expect(inferWikiTypeFromPath("/project/wiki/items/azoth-sword.md")).toBe("items")
    expect(inferWikiTypeFromPath("/project/wiki/items/runtime/key.md")).toBe("items")
    expect(inferWikiTypeFromPath("/project/wiki/plot-arcs/main-arc.md")).toBe("plot-arcs")
    expect(inferWikiTypeFromPath("/project/wiki/events/event-001.md")).toBe("events")
    expect(inferWikiTypeFromPath("/project/wiki/current-scene/scene-state.md")).toBe("current-scene")
    expect(inferWikiTypeFromPath("/project/wiki/relationships/player-rin.md")).toBe("relationships")
    expect(inferWikiTypeFromPath("/project/wiki/style/wenfeng.md")).toBe("style")
    expect(inferWikiTypeFromPath("/project/wiki/rules/table-rules.md")).toBe("rules")
    expect(inferWikiTypeFromPath("/project/wiki/quests/main.md")).toBe("quests")
    expect(inferWikiTypeFromPath("/project/wiki/memory/session-note.md")).toBe("memory")
  })
})

describe("wikiTypeLabel", () => {
  it("uses readable labels for RPG and custom types", () => {
    expect(wikiTypeLabel("current-scene")).toBe("Current Scene")
    expect(wikiTypeLabel("quests")).toBe("Quests")
    expect(wikiTypeLabel("custom-topic")).toBe("Custom Topic")
  })

  it("keeps generation prompt type list RPG-only", () => {
    expect(GENERATION_WIKI_TYPES).toContain("current-scene")
    expect(GENERATION_WIKI_TYPES).toContain("source")
    expect(GENERATION_WIKI_TYPES).not.toContain("entity")
    expect(GENERATION_WIKI_TYPES).not.toContain("concept")
    expect(GENERATION_WIKI_TYPES).not.toContain("query")
  })
})

describe("RPG_CATEGORIES", () => {
  it("defines the first-version RPG category registry", () => {
    expect(RPG_CATEGORIES.map((category) => category.id)).toEqual([
      "sources",
      "world",
      "characters",
      "player",
      "locations",
      "factions",
      "items",
      "plot-arcs",
      "events",
      "current-scene",
      "relationships",
    ])
    expect(RPG_CATEGORIES.every((category) => category.path.startsWith("wiki/"))).toBe(true)
  })

  it("looks up RPG categories by id and path", () => {
    expect(getRpgCategoryById("events")?.multipleFiles).toBe(true)
    expect(getRpgCategoryById("current-scene")?.multipleFiles).toBe(false)
    expect(getRpgCategoryByPath("/project/wiki/current-scene")?.id).toBe("current-scene")
  })
})
