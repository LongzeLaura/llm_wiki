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

function runtimeCapsule(line = "- 当前状态会影响玩家选择，并提供可调查线索、风险约束和场景氛围。"): string {
  return ["## Runtime Capsule", line, ""].join("\n")
}

describe("validateRpgExtraction", () => {
  it("warns when wiki/player contains an obvious canon character without explicit PC declaration", () => {
    const result = validateRpgExtraction([
      makePage("wiki/player/shirou.md", "卫宫士郎", `${runtimeCapsule()}冬木市的原作主角。`, "player"),
    ], {
      sourcePath: "raw/sources/fate-summary.md",
      sourceText: "这是人物设定与路线概述。",
    })

    expect(result.warnings.some((warning) => warning.includes("wiki/player"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("suspicious player page"))).toBe(true)
  })

  it("warns when character pages use player-facing wording without a current PC", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/characters/rin.md",
        "远坂凛",
        [
          runtimeCapsule(),
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
        `${runtimeCapsule("- 已发生事件改变当前状态，并留下后果与风险。")}2004-02-01 圣杯战争开始。多年后，樱与士郎再会。`,
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

    expect(result.warnings.some((warning) => warning.includes("ordinary ingest") || warning.includes("current-scene"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("current-scene"))).toBe(true)
  })

  it("creates source-ingest boundary reviews for other-mode targets", () => {
    const result = validateRpgExtraction([
      makePage("wiki/rules/core.md", "Rules", "Hard rules.", "rules"),
      makePage("wiki/style/narration.md", "Style", "Global narration style.", "style"),
      makePage("wiki/memory/long-term.md", "Memory", "Long-term memory note.", "memory"),
      makePage("wiki/outlines/main.md", "Outline", "Future GM outline.", "outlines"),
      makePage("wiki/current-scene/scene_state.md", "Current Scene", "Live scene bootstrap.", "current-scene"),
      makePage("wiki/characters/runtime/rin.md", "Rin Runtime", "Runtime overlay.", "characters"),
      makePage("wiki/quests/main.md", "Main Quest", "Trackable objective.", "quests"),
    ])

    expect(result.warnings.some((warning) => warning.includes("control_doc_import"))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("runtime_update_apply"))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes("review-only"))).toBe(true)
    for (const label of ["rules", "style", "memory", "outlines", "current-scene", "characters/runtime", "quests"]) {
      expect(result.reviewItems.some((item) => item.title.includes(label))).toBe(true)
    }
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
      makePage("wiki/world/basic_overview.md", "圣杯战争", `${runtimeCapsule()}冬木市、柳洞寺、魔术协会、圣堂教会都被卷入冲突。`, "world"),
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
      makePage("wiki/player/archer.md", "Archer", `${runtimeCapsule("- Current state changes trust, risk, and player-facing constraints.")}A canon servant from the original work.`, "player"),
      makePage(
        "wiki/events/heavens-feel-route.md",
        "Heaven's Feel route timeline",
        `${runtimeCapsule("- Confirmed current state consequences remain after the event.")}2004-02-01 the war begins. Years later, the ending epilogue resolves their story.`,
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
      makePage("wiki/player/player.md", "白野", `${runtimeCapsule()}当前PC。`, "player"),
      makePage(
        "wiki/characters/ally.md",
        "盟友",
        [
          runtimeCapsule(),
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

  it("warns when a runtime-facing RPG page is missing Runtime Capsule", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/locations/tohsaka-mansion.md",
        "远坂宅邸",
        "远坂宅邸是远坂家族居住的洋馆，历史悠久，建筑风格典雅。",
        "locations",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("Runtime Capsule"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("missing Runtime Capsule"))).toBe(true)
  })

  it("warns when Runtime Capsule lacks runtime value", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/characters/rin.md",
        "远坂凛",
        [
          "## Runtime Capsule",
          "远坂凛是本作主要角色之一，拥有很多故事背景。",
        ].join("\n"),
        "characters",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("weak") || warning.includes("runtime value"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("weak Runtime Capsule"))).toBe(true)
  })

  it("warns when a runtime-facing page exceeds its soft budget", () => {
    const longBody = Array.from({ length: 80 }, (_, index) => `第${index + 1}段：已发生事件造成当前状态变化，并留下后果、风险与线索。`).join("\n")
    const result = validateRpgExtraction([
      makePage(
        "wiki/events/long-route.md",
        "长事件记录",
        `${runtimeCapsule("- 已发生事件改变当前状态，并留下后果、风险与线索。")}${longBody}`,
        "events",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("soft") || warning.includes("budget"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("soft budget") || item.title.includes("exceeds soft budget"))).toBe(true)
  })

  it("warns when runtime-facing pages contain low-value encyclopedia noise without RP utility", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/characters/noise.md",
        "百科噪声角色",
        [
          "## Runtime Capsule",
          "该角色是作品资料中的登场人物之一。",
          "",
          "## Metadata",
          "发售版本覆盖多个平台，销量资料有多种说法。",
          "声优与配音信息经常被列在资料页中。",
          "生日、血型、身高、体重、萌点、粉丝标签和 trivia 占据主要内容。",
        ].join("\n"),
        "characters",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("low-value encyclopedia noise"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("low-value encyclopedia noise"))).toBe(true)
  })

  it("warns when events contain future or unresolved plot material", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/events/future-plan.md",
        "未来计划误入事件",
        `${runtimeCapsule("- 已发生事件影响当前状态和后果。")}未来可能会揭示新的伏笔，如果玩家调查旧教会，可发展为下一阶段推进条件。`,
        "events",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("future") || warning.includes("未来"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("future or unresolved plot material"))).toBe(true)
  })

  it("warns when plot-arcs write possible futures as confirmed facts", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/plot-arcs/secret-reveal.md",
        "秘密揭示线",
        `${runtimeCapsule("- 伏笔和秘密会制造张力，并限制玩家选择。")}未来可能揭示某个秘密，但文本又写成已经确认发生且必然发生。`,
        "plot-arcs",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("future") || warning.includes("未来"))).toBe(true)
    expect(result.reviewItems.some((item) => item.title.includes("future written as fact"))).toBe(true)
  })

  it("does not apply runtime-facing capsule or encyclopedia-noise lint to source pages", () => {
    const result = validateRpgExtraction([
      makePage(
        "wiki/sources/source-summary.md",
        "Source Summary",
        "这份来源摘要包含发售、版本、平台、声优、生日、血型、身高、体重和 trivia 材料。",
        "sources",
      ),
    ])

    expect(result.warnings.some((warning) => warning.includes("Runtime Capsule") || warning.includes("low-value encyclopedia noise"))).toBe(false)
    expect(result.reviewItems.some((item) => item.title.includes("Runtime Capsule") || item.title.includes("low-value encyclopedia noise"))).toBe(false)
  })
})
