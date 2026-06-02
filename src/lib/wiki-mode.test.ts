import { describe, expect, it } from "vitest"
import { detectExplicitWikiMode, detectWikiMode } from "./wiki-mode"

describe("wiki-mode", () => {
  it("honors an explicit wikiMode override", () => {
    expect(detectExplicitWikiMode("wikiMode: rpg")).toBe("llmwikirpg")
    expect(detectExplicitWikiMode("wikiMode: llmwikirpg")).toBe("llmwikirpg")
    expect(detectWikiMode({ schema: 'wikiMode = "default"', index: "wiki/current-scene/" })).toBe("default")
  })

  it("honors project metadata before heuristics", () => {
    expect(detectWikiMode({
      projectMeta: '{ "mode": "llmwikirpg" }',
      schema: "| entity | wiki/entities/ | Named things |",
    })).toBe("llmwikirpg")
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

  it("stays in default mode for legacy or non-RPG custom directories", () => {
    expect(detectWikiMode({
      schema: "| entity | wiki/entities/ | Named things |",
      index: "## Entities\n- [[openai]]",
    })).toBe("default")

    expect(detectWikiMode({
      schema: [
        "| character | wiki/characters/ | Book character |",
        "| source | wiki/sources/ | Reading notes |",
      ].join("\n"),
      paths: ["/project/wiki/characters", "/project/wiki/sources"],
    })).toBe("default")
  })
})
