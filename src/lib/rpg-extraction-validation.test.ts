import { describe, expect, it } from "vitest"
import { validateRpgExtraction } from "./rpg-extraction-validation"

function makePage(path: string, title: string, body: string, type: string): { path: string; content: string } {
  return {
    path,
    content: [
      "---",
      `type: "${type}"`,
      `title: "${title}"`,
      "---",
      "",
      `# ${title}`,
      "",
      body,
    ].join("\n"),
  }
}

describe("validateRpgExtraction", () => {
  it("warns when wiki/player contains an obvious canon character without explicit PC declaration", () => {
    const result = validateRpgExtraction([
      makePage("wiki/player/shirou.md", "卫宫士郎", "冬木市的原作主角。", "player"),
    ], {
      sourcePath: "raw/sources/fate-summary.md",
      sourceText: "这是人物设定与路线概述。",
    })

    expect(result.warnings[0]).toContain("wiki/player")
    expect(result.reviewItems[0].title).toContain("suspicious player page")
  })

  it("warns when character pages use player-facing wording without a current PC", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/characters/rin.md",
        "远坂凛",
        [
          "## 与当前PC交互规则",
          "会先观察玩家角色再决定是否合作。",
        ].join("\n"),
        "characters",
      ),
    ], {
      sourcePath: "raw/sources/rin-profile.md",
      sourceText: "这是角色设定，没有任何现行PC声明。",
    })

    expect(result.warnings[0]).toContain("no current PC")
    expect(result.reviewItems[0].description).toContain("wiki/characters/")
  })

  it("warns when an event page looks like a route or timeline overview", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/events/heavens-feel.md",
        "Heaven's Feel 路线时间线",
        "2004-02-01 圣杯战争开始。多年后，樱与士郎再会。",
        "events",
      ),
    ])

    expect(result.warnings[0]).toContain("too broad")
    expect(result.reviewItems[0].title).toContain("plot-arcs")
  })

  it("creates a review item when current-scene is generated from static setting material", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/current-scene/scene_state.md",
        "Current Scene",
        "Saber and Shirou watch cherry blossoms in the True End epilogue.",
        "current-scene",
      ),
    ], {
      sourcePath: "raw/sources/fate-encyclopedia.md",
      sourceText: "百科词条：HF True End 结局。多年后两人赏花。",
    })

    expect(result.reviewItems).toHaveLength(1)
    expect(result.reviewItems[0].title).toContain("current-scene")
  })

  it("warns when legacy llm_wiki directories appear in RPG extraction output", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/concepts/poor-moe.md",
        "贫穷萌点",
        "这是角色的萌点之一，也属于傲娇标签。",
        "concept",
      ),
    ])

    expect(result.warnings[0]).toContain("Legacy llm_wiki path")
    expect(result.reviewItems[0].title).toContain("legacy path rejected")
  })

  it("creates omission reviews when obvious locations or factions are present but their directories stay empty", () => {
    const result = validateRpgExtraction([
      makePage("wiki/world/war.md", "圣杯战争", "冬木市、柳洞寺、魔术协会、圣堂教会都被卷入冲突。", "world"),
    ], {
      sourcePath: "raw/sources/war-summary.md",
      sourceText: "冬木市、柳洞寺、魔术协会、圣堂教会都被卷入冲突。",
      existingCategoryPageCounts: {
        locations: 0,
        factions: 0,
      },
    })

    expect(result.warnings.some((warning) => warning.includes("wiki/locations/"))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("wiki/factions/"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("missing locations"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("missing factions"))).toBe(true)
  })

  it("flags the canonical task-9 warning fixtures together", () => {
    const result = validateRpgExtraction([
      makePage("wiki/player/archer.md", "Archer", "A canon servant from the original work.", "player"),
      makePage(
        "wiki/events/heavens-feel-route.md",
        "Heaven's Feel route timeline",
        "2004-02-01 the war begins. Years later, the ending epilogue resolves their story.",
        "events",
      ),
      makePage(
        "wiki/concepts/poor-moe.md",
        "poor-moe trope",
        "This is a moe trait and a tsundere-style fandom tag for one character.",
        "concept",
      ),
      makePage(
        "wiki/current-scene/scene_state.md",
        "Current Scene",
        "In the true ending epilogue, they watch cherry blossoms years later.",
        "current-scene",
      ),
    ], {
      sourcePath: "raw/sources/fate-encyclopedia.md",
      sourceText: "Encyclopedia summary of a route ending, timeline recap, and character profile.",
    })

    expect(result.warnings.some((warning) => warning.includes("wiki/player"))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("too broad"))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("Legacy llm_wiki path"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("current-scene"))).toBe(true)
  })

  it("does not warn about character player wording when a current PC already exists", () => {
    const result = validateRpgExtraction([
      makePage("wiki/player/player.md", "白野", "当前PC。", "player"),
      makePage(
        "wiki/characters/ally.md",
        "盟友",
        [
          "## 与当前PC交互规则",
          "会在夜间行动前先与当前PC确认计划。",
        ].join("\n"),
        "characters",
      ),
    ], {
      sourceText: "当前PC是白野。",
    })

    expect(result.warnings).toEqual([])
    expect(result.reviewItems).toEqual([])
  })
})
