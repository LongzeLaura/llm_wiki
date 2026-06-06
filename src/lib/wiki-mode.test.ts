import { describe, expect, it } from "vitest"
import { detectExplicitWikiMode, detectWikiMode, isRpgWikiMode } from "./wiki-mode"

describe("wiki-mode", () => {
  it("honors an explicit wikiMode override", () => {
    expect(detectExplicitWikiMode("wikiMode: rpg")).toBe("llmwikirpg")
    expect(detectExplicitWikiMode("wikiMode: llmwikirpg")).toBe("llmwikirpg")
    expect(() => detectExplicitWikiMode("wikiMode: default")).toThrow(/Legacy default/)
  })

  it("exposes a named RPG-mode predicate for branch convergence", () => {
    expect(isRpgWikiMode("llmwikirpg")).toBe(true)
  })

  it("honors RPG project metadata before heuristics", () => {
    expect(detectWikiMode({
      projectMeta: '{ "mode": "llmwikirpg" }',
      schema: "| entity | wiki/entities/ | Named things |",
    })).toBe("llmwikirpg")
  })

  it("rejects legacy default project metadata", () => {
    expect(() => detectWikiMode({
      projectMeta: '{ "mode": "default" }',
      paths: ["/project/wiki/current-scene"],
    })).toThrow(/Legacy default/)
  })

  it("detects RPG mode from distinctive schema directories", () => {
    expect(detectWikiMode({
      schema: [
        "| player | wiki/player/ | Player state |",
        "| plot-arc | wiki/plot-arcs/ | Story arc |",
      ].join("\n"),
    })).toBe("llmwikirpg")
  })

  it("detects RPG mode from existing RPG wiki directories", () => {
    expect(detectWikiMode({
      paths: [
        "/project/wiki/current-scene",
        "/project/wiki/player",
        "/project/wiki/events",
      ],
    })).toBe("llmwikirpg")
  })

  it("rejects legacy or non-RPG custom directories", () => {
    expect(() => detectWikiMode({
      schema: "| entity | wiki/entities/ | Named things |",
      index: "## Entities\n- [[openai]]",
    })).toThrow(/not an llmWikiRPG/)

    expect(() => detectWikiMode({
      schema: [
        "| character | wiki/characters/ | Book character |",
        "| source | wiki/sources/ | Reading notes |",
      ].join("\n"),
      paths: ["/project/wiki/characters", "/project/wiki/sources"],
    })).toThrow(/not an llmWikiRPG/)
  })
})
