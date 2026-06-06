import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROJECT_MODE,
  getProjectModeBootstrap,
  normalizeProjectMode,
} from "./project-mode"

describe("project-mode", () => {
  it("normalizes explicit RPG mode names only", () => {
    expect(normalizeProjectMode("default")).toBeNull()
    expect(normalizeProjectMode("rpg")).toBe("llmwikirpg")
    expect(normalizeProjectMode("llmwikirpg")).toBe("llmwikirpg")
    expect(normalizeProjectMode("unknown")).toBeNull()
  })

  it("makes llmWikiRPG the only project mode", () => {
    expect(DEFAULT_PROJECT_MODE).toBe("llmwikirpg")
  })

  it("provides llmWikiRPG bootstrap files and directories", () => {
    const bootstrap = getProjectModeBootstrap()
    expect(bootstrap.schema).toContain("wikiMode: llmwikirpg")
    expect(bootstrap.schema).toContain("This project schema supports only `llmwikirpg`")
    expect(bootstrap.schema).toContain("wiki/current-scene/")
    expect(bootstrap.schema).toContain("wiki/characters/runtime/")
    expect(bootstrap.schema).toContain("wiki/locations/runtime/")
    expect(bootstrap.schema).toContain("wiki/factions/runtime/")
    expect(bootstrap.schema).toContain("wiki/items/runtime/")
    expect(bootstrap.schema).toContain("Overlay Resolution")
    expect(bootstrap.schema).toContain("runtime blocked")
    expect(bootstrap.schema).toContain("Legacy directories rejected")
    expect(bootstrap.schema).toContain("`wiki/entities/`")
    expect(bootstrap.schema).toContain("`wiki/concepts/`")
    expect(bootstrap.schema).toContain("`wiki/queries/`")
    expect(bootstrap.extraDirs).not.toContain("wiki/entities")
    expect(bootstrap.extraDirs).not.toContain("wiki/concepts")
    expect(bootstrap.extraDirs).not.toContain("wiki/queries")
    expect(bootstrap.extraDirs).toContain("wiki/characters/runtime")
    expect(bootstrap.extraDirs).toContain("wiki/locations/runtime")
    expect(bootstrap.extraDirs).toContain("wiki/factions/runtime")
    expect(bootstrap.extraDirs).toContain("wiki/items/runtime")
    expect(bootstrap.extraDirs).toContain("wiki/quests")
    expect(bootstrap.extraDirs).toContain("wiki/memory")
    expect(bootstrap.index).toContain("## Plot Arcs")
  })
})
