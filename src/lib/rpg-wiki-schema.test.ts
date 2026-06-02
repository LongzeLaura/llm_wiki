import { describe, expect, it } from "vitest"
import { RPG_CATEGORIES } from "./rpg-categories"
import { RPG_WIKI_SCHEMA, getRpgWikiSchemaEntry, rpgSchemaCategoryIdsMatchRegistry } from "./rpg-wiki-schema"

describe("RPG_WIKI_SCHEMA", () => {
  it("keeps schema category ids aligned with the RPG category registry", () => {
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(RPG_CATEGORIES.map((category) => category.id))
    expect(rpgSchemaCategoryIdsMatchRegistry()).toBe(true)
  })

  it("reuses labels and paths from the RPG category registry", () => {
    for (const entry of RPG_WIKI_SCHEMA) {
      const category = RPG_CATEGORIES.find((candidate) => candidate.id === entry.categoryId)
      expect(category).toBeDefined()
      expect(entry.label).toBe(category?.label)
      expect(entry.path).toBe(category?.path)
    }
  })

  it("defines extraction scope, fields, exclusions, granularity, and update strategy", () => {
    for (const entry of RPG_WIKI_SCHEMA) {
      expect(entry.extractionGoal.length).toBeGreaterThan(0)
      expect(entry.fields.length).toBeGreaterThan(0)
      expect(entry.fields.every((field) => field.name && field.description)).toBe(true)
      expect(entry.exclude.length).toBeGreaterThan(0)
      expect(entry.recommendedGranularity.length).toBeGreaterThan(0)
    }
  })

  it("represents dynamic update boundaries from the schema document", () => {
    expect(getRpgWikiSchemaEntry("events")?.updateStrategy).toBe("append")
    expect(getRpgWikiSchemaEntry("current-scene")?.updateStrategy).toBe("overwrite")
    expect(getRpgWikiSchemaEntry("current-scene")?.recommendedGranularity).toContain("current-scene/scene_state.md")
    expect(getRpgWikiSchemaEntry("world")?.updateStrategy).toBe("cautious-merge")
    expect(getRpgWikiSchemaEntry("characters")?.updateStrategy).toBe("merge")
    expect(getRpgWikiSchemaEntry("relationships")?.updateStrategy).toBe("merge")
  })
})
