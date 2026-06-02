import { describe, expect, it } from "vitest"
import {
  MANDATORY_RPG_CONTEXT_DIRS,
  getRpgRetrievalPriority,
  isRpgRelevantPath,
  prioritizeChatSearchResults,
} from "./rpg-query-priority"
import type { SearchResult } from "./search"

describe("rpg-query-priority", () => {
  it("assigns stronger retrieval priority to live RPG state pages", () => {
    expect(getRpgRetrievalPriority("/project/wiki/current-scene/scene_state.md")).toBeGreaterThan(
      getRpgRetrievalPriority("/project/wiki/world/history.md"),
    )
    expect(getRpgRetrievalPriority("/project/wiki/player/profile.md")).toBeGreaterThan(
      getRpgRetrievalPriority("/project/wiki/items/key.md"),
    )
  })

  it("detects RPG-relevant wiki paths", () => {
    expect(isRpgRelevantPath("/project/wiki/current-scene/scene_state.md")).toBe(true)
    expect(isRpgRelevantPath("/project/wiki/events/timeline.md")).toBe(true)
    expect(isRpgRelevantPath("/project/wiki/concepts/attention.md")).toBe(false)
  })

  it("sorts RPG live context ahead of equally relevant legacy results", () => {
    const results: SearchResult[] = [
      {
        path: "/project/wiki/concepts/attention.md",
        title: "Attention",
        snippet: "concept",
        titleMatch: true,
        score: 10,
        images: [],
      },
      {
        path: "/project/wiki/current-scene/scene_state.md",
        title: "Current Scene",
        snippet: "scene",
        titleMatch: false,
        score: 1,
        images: [],
      },
      {
        path: "/project/wiki/player/profile.md",
        title: "Player",
        snippet: "player",
        titleMatch: false,
        score: 2,
        images: [],
      },
    ]

    const sorted = prioritizeChatSearchResults(results)

    expect(sorted.map((result) => result.path)).toEqual([
      "/project/wiki/current-scene/scene_state.md",
      "/project/wiki/player/profile.md",
      "/project/wiki/concepts/attention.md",
    ])
  })

  it("keeps mandatory RPG context focused on the live state directories", () => {
    expect(MANDATORY_RPG_CONTEXT_DIRS).toEqual([
      { dir: "current-scene", limit: 1, preferredFiles: ["scene_state.md"] },
      { dir: "player", limit: 2 },
      { dir: "events", limit: 2, preferredFiles: ["timeline.md"] },
      { dir: "plot-arcs", limit: 2 },
    ])
  })

  it("can score non-RPG custom directories that happen to share RPG path names", () => {
    expect(getRpgRetrievalPriority("/project/wiki/characters/elizabeth-bennet.md")).toBeGreaterThan(0)
  })
})
