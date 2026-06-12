import { describe, expect, it } from "vitest"
import { parsePageInfo } from "./knowledge-tree"

describe("parsePageInfo", () => {
  it("unquotes YAML frontmatter type values for knowledge tree grouping", () => {
    expect(parsePageInfo(
      "/project/wiki/player/player.md",
      "player.md",
      [
        "---",
        'type: "player"',
        'title: "Player Character"',
        "---",
        "",
        "# Player Character",
      ].join("\n"),
    )).toMatchObject({
      type: "player",
      title: "Player Character",
    })

    expect(parsePageInfo(
      "/project/wiki/current-scene/scene_state.md",
      "scene_state.md",
      [
        "---",
        'type: "current-scene"',
        'title: "Current Scene State"',
        "---",
        "",
      ].join("\n"),
    ).type).toBe("current-scene")

    expect(parsePageInfo(
      "/project/wiki/relationships/player-mara.md",
      "player-mara.md",
      [
        "---",
        'type: "relationship"',
        'title: "Player Relationship: Mara"',
        "---",
        "",
      ].join("\n"),
    ).type).toBe("relationships")

    expect(parsePageInfo(
      "/project/wiki/events/prologue.md",
      "prologue.md",
      [
        "---",
        'type: "event"',
        'title: "Prologue"',
        "---",
        "",
      ].join("\n"),
    ).type).toBe("events")

    expect(parsePageInfo(
      "/project/wiki/quests/main.md",
      "main.md",
      [
        "---",
        'type: "quest"',
        'title: "Main Quest"',
        "---",
        "",
      ].join("\n"),
    ).type).toBe("quests")
  })
})
