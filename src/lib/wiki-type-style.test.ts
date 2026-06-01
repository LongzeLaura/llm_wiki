import { describe, it, expect } from "vitest"
import {
  compareWikiTypeOrder,
  getWikiTypeStyle,
  WIKI_TYPE_STYLES,
  FALLBACK_TYPE_STYLE,
} from "./wiki-type-style"

describe("getWikiTypeStyle", () => {
  it("returns the entity style for 'entity'", () => {
    expect(getWikiTypeStyle("entity")).toBe(WIKI_TYPE_STYLES.entity)
  })

  it("is case-insensitive", () => {
    expect(getWikiTypeStyle("ENTITY")).toBe(WIKI_TYPE_STYLES.entity)
    expect(getWikiTypeStyle("Concept")).toBe(WIKI_TYPE_STYLES.concept)
  })

  it("trims surrounding whitespace", () => {
    expect(getWikiTypeStyle("  query  ")).toBe(WIKI_TYPE_STYLES.query)
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

  it("returns a titled fallback for an unknown type", () => {
    const style = getWikiTypeStyle("zorbax")
    expect(style.icon).toBe(FALLBACK_TYPE_STYLE.icon)
    expect(style.graphColor).toBe(FALLBACK_TYPE_STYLE.graphColor)
    expect(style.label).toBe("Zorbax")
    expect(style.pluralLabel).toBe("Zorbax")
  })

  it("covers every documented page type", () => {
    const expected = [
      "entity", "concept", "query", "source", "comparison", "synthesis",
      "catalytic_system", "elementary_process", "mechanistic_network", "evidence_claim",
      "thesis", "finding", "methodology", "event", "overview",
    ]
    for (const t of expected) {
      const style = getWikiTypeStyle(t)
      expect(style).not.toBe(FALLBACK_TYPE_STYLE)
      expect(style.label.length).toBeGreaterThan(0)
      expect(style.chipClass).toContain("bg-")
      expect(style.dotClass).toContain("bg-")
    }
  })

  it("uses registry labels for chemical categories", () => {
    expect(getWikiTypeStyle("catalytic_system").label).toBe("Catalytic System")
    expect(getWikiTypeStyle("elementary_process").label).toBe("Elementary Process")
    expect(getWikiTypeStyle("mechanistic_network").label).toBe("Mechanistic Network")
    expect(getWikiTypeStyle("evidence_claim").label).toBe("Evidence Claim")
  })

  it("preserves stable ordering across legacy and chemical categories", () => {
    expect(compareWikiTypeOrder("overview", "source")).toBeLessThan(0)
    expect(compareWikiTypeOrder("source", "entity")).toBeLessThan(0)
    expect(compareWikiTypeOrder("concept", "catalytic_system")).toBeLessThan(0)
    expect(compareWikiTypeOrder("catalytic_system", "elementary_process")).toBeLessThan(0)
    expect(compareWikiTypeOrder("mechanistic_network", "evidence_claim")).toBeLessThan(0)
  })
})
