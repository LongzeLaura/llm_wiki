import { describe, it, expect } from "vitest"
import {
  getWikiTypeStyle,
  WIKI_TYPE_STYLES,
  FALLBACK_TYPE_STYLE,
} from "./wiki-type-style"

describe("getWikiTypeStyle", () => {
  it("returns the RPG character style", () => {
    expect(getWikiTypeStyle("characters")).toBe(WIKI_TYPE_STYLES.characters)
  })

  it("is case-insensitive", () => {
    expect(getWikiTypeStyle("CHARACTERS")).toBe(WIKI_TYPE_STYLES.characters)
    expect(getWikiTypeStyle("Current-Scene")).toBe(WIKI_TYPE_STYLES["current-scene"])
  })

  it("trims surrounding whitespace", () => {
    expect(getWikiTypeStyle("  memory  ")).toBe(WIKI_TYPE_STYLES.memory)
  })

  it("returns the RPG quests style", () => {
    expect(getWikiTypeStyle("quests")).toBe(WIKI_TYPE_STYLES.quests)
  })

  it("returns fallback for null", () => {
    expect(getWikiTypeStyle(null)).toBe(FALLBACK_TYPE_STYLE)
  })

  it("returns fallback for undefined", () => {
    expect(getWikiTypeStyle(undefined)).toBe(FALLBACK_TYPE_STYLE)
  })

  it("returns fallback for empty string", () => {
    expect(getWikiTypeStyle("")).toBe(FALLBACK_TYPE_STYLE)
  })

  it("returns fallback for an unknown type", () => {
    expect(getWikiTypeStyle("zorbax")).toBe(FALLBACK_TYPE_STYLE)
  })

  it("covers every documented page type", () => {
    const expected = [
      "source", "event", "overview",
      "world", "characters", "player", "locations", "factions",
      "items", "plot-arcs", "events", "current-scene", "relationships",
      "style", "rules", "quests", "memory",
    ]
    for (const t of expected) {
      const style = getWikiTypeStyle(t)
      expect(style).not.toBe(FALLBACK_TYPE_STYLE)
      expect(style.label.length).toBeGreaterThan(0)
      expect(style.chipClass).toContain("bg-")
      expect(style.dotClass).toContain("bg-")
    }
  })
})
