import { describe, expect, it } from "vitest"
import { RPG_CATEGORIES } from "./rpg-categories"
import { RPG_WIKI_SCHEMA, getRpgWikiSchemaEntry, rpgSchemaCategoryIdsMatchRegistry } from "./rpg-wiki-schema"

describe("RPG_WIKI_SCHEMA", () => {
  it("keeps schema category ids aligned with the RPG category registry", () => {
    expect(RPG_WIKI_SCHEMA.map((entry) => entry.categoryId)).toEqual(RPG_CATEGORIES.map((category) => category.id))
    expect(RPG_WIKI_SCHEMA).toHaveLength(RPG_CATEGORIES.length)
    expect(RPG_WIKI_SCHEMA.some((entry) => entry.categoryId.includes("runtime"))).toBe(false)
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
    const currentScene = getRpgWikiSchemaEntry("current-scene")

    expect(getRpgWikiSchemaEntry("events")?.updateStrategy).toBe("append")
    expect(currentScene?.updateStrategy).toBe("overwrite")
    expect(currentScene?.recommendedGranularity).toContain("current-scene/scene_state.md")
    expect(currentScene?.extractionGoal).toContain("Only generate or update this from explicit live RPG scene input")
    expect(currentScene?.exclude).toContain("Route summaries, flower-viewing ending scenes, or years-later epilogues written into current-scene")
    expect(getRpgWikiSchemaEntry("world")?.updateStrategy).toBe("cautious-merge")
    expect(getRpgWikiSchemaEntry("characters")?.updateStrategy).toBe("merge")
    expect(getRpgWikiSchemaEntry("relationships")?.updateStrategy).toBe("merge")
  })

  it("turns characters into roleplay-ready character operating models", () => {
    const characters = getRpgWikiSchemaEntry("characters")

    expect(characters?.extractionGoal).toContain("roleplay-ready character profiles / character operating models")
    expect(characters?.extractionGoal).toContain("Keep Canon Facts, Reasonable Interpretation, and RP Usage semantically distinct")
    expect(characters?.extractionGoal).toContain("default here unless the source explicitly says they are the current RPG player character")
    expect(characters?.extractionGoal).toContain("Do not collapse route-specific, timeline-specific, or ending-specific states")

    expect(characters?.fields.map((field) => field.name)).toEqual([
      "identity",
      "roleImpression",
      "canonFacts",
      "characterModel",
      "triggersAndReactions",
      "behaviorRules",
      "dialogueStyle",
      "relationshipDynamics",
      "routeAndTimelineVariants",
      "rpgUsage",
      "evidenceAndUncertainty",
    ])

    expect(characters?.fields.find((field) => field.name === "roleImpression")?.description).toContain("## Character Impression")
    expect(characters?.fields.find((field) => field.name === "canonFacts")?.description).toContain("## Canon Facts")
    expect(characters?.fields.find((field) => field.name === "characterModel")?.description).toContain("## Psychological Model")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Trauma / stress sources")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Defense patterns")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Trigger points")
    expect(characters?.fields.find((field) => field.name === "triggersAndReactions")?.description).toContain("Deep Needs")
    expect(characters?.fields.find((field) => field.name === "dialogueStyle")?.description).toContain("## Dialogue Style")
    expect(characters?.fields.find((field) => field.name === "relationshipDynamics")?.description).toContain("## Relationship Dynamics")
    expect(characters?.fields.find((field) => field.name === "routeAndTimelineVariants")?.description).toContain("## Route and Timeline Variants")
    expect(characters?.fields.find((field) => field.name === "rpgUsage")?.description).toContain("## RP Usage")
    expect(characters?.fields.find((field) => field.name === "evidenceAndUncertainty")?.description).toContain("## Evidence and Uncertainty")

    expect(characters?.exclude).toContain("Encyclopedia trivia that is not useful for portrayal or interaction")
    expect(characters?.exclude).toContain("Fate / UBW / HF / ending-specific state collapsed into one universal current-state summary")
    expect(characters?.exclude).toContain("RP-serving interpretation, convenience assumptions, or play advice written as if they were hard canon facts")

    expect(characters?.recommendedGranularity).toContain("roleplay-ready character card")
    expect(characters?.recommendedGranularity).toContain("## Character Impression")
    expect(characters?.recommendedGranularity).toContain("## Canon Facts")
    expect(characters?.recommendedGranularity).toContain("## Reasonable Interpretation")
    expect(characters?.recommendedGranularity).toContain("## Psychological Model")
    expect(characters?.recommendedGranularity).toContain("## RP Usage")
    expect(characters?.recommendedGranularity).toContain("## Evidence and Uncertainty")
  })

  it("keeps the player boundary strict", () => {
    const player = getRpgWikiSchemaEntry("player")

    expect(player?.extractionGoal).toContain("player-created or explicitly declared player character only")
    expect(player?.exclude).toContain("Original/canon characters unless the source explicitly says they are the current RPG player character")
    expect(player?.exclude).toContain("Original protagonists, POV characters, or game-controllable characters treated as player by default")
  })

  it("hardens the events versus plot-arcs boundary for multi-event routes and timelines", () => {
    const events = getRpgWikiSchemaEntry("events")
    const plotArcs = getRpgWikiSchemaEntry("plot-arcs")

    expect(events?.extractionGoal).toContain("discrete, confirmed events")
    expect(events?.exclude).toContain("Route, storyline, timeline, or complete-course pages that span many independent sub-events")
    expect(events?.exclude).toContain("Multi-day or multi-year narrative overviews that should be split or stored under plot-arcs")
    expect(events?.recommendedGranularity).toContain("time or relative-time anchor, place, participants, what happened, and consequences/state change")
    expect(events?.recommendedGranularity).toContain("contains 5+ independent sub-events")

    expect(plotArcs?.extractionGoal).toContain("Multi-event routes, storyline overviews, and long-span timelines belong here")
    expect(plotArcs?.recommendedGranularity).toContain("route")
  })

  it("keeps pressure to emit core locations and factions on a secondary scan", () => {
    const locations = getRpgWikiSchemaEntry("locations")
    const factions = getRpgWikiSchemaEntry("factions")

    expect(locations?.extractionGoal).toContain("secondary scan")
    expect(locations?.recommendedGranularity).toContain("short stub")
    expect(locations?.recommendedGranularity).toContain("limited-source")

    expect(factions?.extractionGoal).toContain("secondary scan")
    expect(factions?.recommendedGranularity).toContain("short stub")
    expect(factions?.recommendedGranularity).toContain("limited-source")
  })

  it("keeps current campaign state in runtime overlays for stable base categories", () => {
    const expectRuntimeOverlayBoundary = (categoryId: "characters" | "locations" | "factions" | "items") => {
      const entry = getRpgWikiSchemaEntry(categoryId)
      const combinedText = [
        entry?.extractionGoal,
        entry?.recommendedGranularity,
        ...(entry?.fields.map((field) => field.description) ?? []),
        ...(entry?.exclude ?? []),
      ].join("\n")

      expect(combinedText).toMatch(/runtime|overlay/)
    }

    expectRuntimeOverlayBoundary("characters")
    expectRuntimeOverlayBoundary("locations")
    expectRuntimeOverlayBoundary("factions")
    expectRuntimeOverlayBoundary("items")
  })
})
