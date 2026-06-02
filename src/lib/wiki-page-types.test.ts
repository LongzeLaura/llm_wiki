import { describe, expect, it } from "vitest"
import { RPG_CATEGORIES, getRpgCategoryById, getRpgCategoryByPath } from "./rpg-categories"
import { GENERATION_WIKI_TYPES, inferWikiTypeFromPath, wikiTypeLabel } from "./wiki-page-types"

describe("inferWikiTypeFromPath", () => {
  it("recognizes core wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/entities/ada-lovelace.md")).toBe("entity")
    expect(inferWikiTypeFromPath("/project/wiki/concepts/attention.md")).toBe("concept")
    expect(inferWikiTypeFromPath("/project/wiki/sources/paper.md")).toBe("source")
    expect(inferWikiTypeFromPath("/project/wiki/queries/open-question.md")).toBe("query")
    expect(inferWikiTypeFromPath("/project/wiki/comparisons/model-a-vs-b.md")).toBe("comparison")
    expect(inferWikiTypeFromPath("/project/wiki/synthesis/summary.md")).toBe("synthesis")
  })

  it("recognizes research-template wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/findings/result.md")).toBe("finding")
    expect(inferWikiTypeFromPath("/project/wiki/thesis/main-claim.md")).toBe("thesis")
    expect(inferWikiTypeFromPath("/project/wiki/methodology/systematic-review.md")).toBe("methodology")
  })

  it("handles Windows separators and overview pages", () => {
    expect(inferWikiTypeFromPath("C:\\wiki\\findings\\result.md")).toBe("finding")
    expect(inferWikiTypeFromPath("/project/wiki/overview.md")).toBe("overview")
  })

  it("uses custom wiki subdirectories as dynamic types", () => {
    expect(inferWikiTypeFromPath("/project/wiki/people/ada-lovelace.md")).toBe("people")
    expect(inferWikiTypeFromPath("/project/wiki/technologies/vector-db.md")).toBe("technologies")
  })

  it("recognizes RPG wiki directories", () => {
    expect(inferWikiTypeFromPath("/project/wiki/world/history.md")).toBe("world")
    expect(inferWikiTypeFromPath("/project/wiki/characters/rin.md")).toBe("characters")
    expect(inferWikiTypeFromPath("/project/wiki/player/profile.md")).toBe("player")
    expect(inferWikiTypeFromPath("/project/wiki/locations/temple.md")).toBe("locations")
    expect(inferWikiTypeFromPath("/project/wiki/factions/mage-association.md")).toBe("factions")
    expect(inferWikiTypeFromPath("/project/wiki/items/azoth-sword.md")).toBe("items")
    expect(inferWikiTypeFromPath("/project/wiki/plot-arcs/main-arc.md")).toBe("plot-arcs")
    expect(inferWikiTypeFromPath("/project/wiki/events/event-001.md")).toBe("events")
    expect(inferWikiTypeFromPath("/project/wiki/current-scene/scene-state.md")).toBe("current-scene")
    expect(inferWikiTypeFromPath("/project/wiki/relationships/player-rin.md")).toBe("relationships")
  })
})

describe("wikiTypeLabel", () => {
  it("uses readable singular labels for research-template types", () => {
    expect(wikiTypeLabel("finding")).toBe("Finding")
    expect(wikiTypeLabel("thesis")).toBe("Thesis")
    expect(wikiTypeLabel("methodology")).toBe("Methodology")
    expect(wikiTypeLabel("current-scene")).toBe("Current Scene")
    expect(wikiTypeLabel("custom-topic")).toBe("Custom Topic")
  })

  it("keeps generation prompt type list aligned with research-template types", () => {
    expect(GENERATION_WIKI_TYPES).toContain("finding")
    expect(GENERATION_WIKI_TYPES).toContain("thesis")
    expect(GENERATION_WIKI_TYPES).toContain("methodology")
    expect(GENERATION_WIKI_TYPES).toContain("current-scene")
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
