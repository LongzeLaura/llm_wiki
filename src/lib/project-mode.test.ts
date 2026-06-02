import { describe, expect, it } from "vitest"
import {
  getProjectModeBootstrap,
  normalizeProjectMode,
} from "./project-mode"

describe("project-mode", () => {
  it("normalizes legacy and explicit RPG mode names", () => {
    expect(normalizeProjectMode("default")).toBe("default")
    expect(normalizeProjectMode("rpg")).toBe("llmwikirpg")
    expect(normalizeProjectMode("llmwikirpg")).toBe("llmwikirpg")
    expect(normalizeProjectMode("unknown")).toBeNull()
  })

  it("provides llmWikiRPG bootstrap files and directories", () => {
    const bootstrap = getProjectModeBootstrap("llmwikirpg")
    expect(bootstrap).not.toBeNull()
    expect(bootstrap?.schema).toContain("wikiMode: llmwikirpg")
    expect(bootstrap?.schema).toContain("wiki/current-scene/")
    expect(bootstrap?.extraDirs).toContain("wiki/quests")
    expect(bootstrap?.extraDirs).toContain("wiki/memory")
    expect(bootstrap?.index).toContain("## Plot Arcs")
  })

  it("does not override bootstrap files for default mode", () => {
    expect(getProjectModeBootstrap("default")).toBeNull()
  })
})
