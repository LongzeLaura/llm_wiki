import { beforeEach, describe, expect, it } from "vitest"
import {
  buildAnalysisPrompt,
  buildGenerationPrompt,
  computeIngestGenerationMaxTokens,
  computeIngestReviewMaxTokens,
  computeIngestSourceBudget,
  splitSourceIntoSemanticChunks,
} from "./ingest"
import { useWikiStore } from "@/stores/wiki-store"

beforeEach(() => {
  useWikiStore.getState().setOutputLanguage("auto")
})

// 构造一段最小可用的 RPG Stage 1 Source Profile 测试文本。
// 作用：让 Stage 2 prompt 相关测试可以快速模拟不同的 needed_categories
// 和 live_scene_allowed 组合，而不必在每个用例里手写完整分析结果。
function sourceProfile(
  neededCategories: string,
  extra: string = "",
  liveSceneAllowed = false,
): string {
  return [
    "## Source Profile",
    "- source_kind: mixed",
    // liveSceneAllowed 为 true 时模拟带有 [RPG-LIVE] 的实时跑团输入；否则模拟普通静态来源。
    `- live_input_marker: ${liveSceneAllowed ? "[RPG-LIVE]" : "none"}`,
    "- dominant_focus: focused test fixture",
    // neededCategories 是每个测试关注的核心变量，用来验证 Stage 2 是否只展开指定目录合约。
    `- needed_categories: ${neededCategories}`,
    "- suppressed_categories: []",
    // live_scene_allowed 决定 current-scene 合约是否能被展开。
    `- live_scene_allowed: ${liveSceneAllowed ? "true" : "false"}`,
    "- event_extraction_mode: none",
    // extra 允许单个测试补充额外 profile 行，保持默认 fixture 简短。
    extra,
    "",
    "## Candidate Objects",
    "- Name: fixture",
  ].filter(Boolean).join("\n")
}

describe("buildAnalysisPrompt language directive", () => {
  it("injects the user's explicit language setting", () => {
    useWikiStore.getState().setOutputLanguage("Chinese")
    const prompt = buildAnalysisPrompt("purpose", "index", "english source content")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Chinese")
  })

  it("uses user setting even when source is in a different language", () => {
    useWikiStore.getState().setOutputLanguage("Japanese")
    const prompt = buildAnalysisPrompt("", "", "\u8fd9\u662f\u4e2d\u6587\u5185\u5bb9")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Japanese")
    expect(prompt).not.toContain("OUTPUT LANGUAGE: Chinese")
  })

  it("auto mode falls back to detecting source content language", () => {
    useWikiStore.getState().setOutputLanguage("auto")
    const prompt = buildAnalysisPrompt("", "", "\u3053\u308c\u306f\u65e5\u672c\u8a9e\u306e\u6587\u7ae0\u3067\u3059")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Japanese")
  })

  it("auto mode with empty source defaults to English", () => {
    useWikiStore.getState().setOutputLanguage("auto")
    const prompt = buildAnalysisPrompt("", "", "")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: English")
  })

  it("uses the RPG Stage 1 analysis structure", () => {
    const prompt = buildAnalysisPrompt("", "", "")
    expect(prompt).toContain("## RPG Wiki Extraction Guidance")
    expect(prompt).toContain("## Source Profile")
    expect(prompt).toContain("## Candidate Objects")
    expect(prompt).toContain("## Ignored Noise")
  })

  it("ignores legacy/default analysis mode requests and stays RPG-only", () => {
    const prompt = buildAnalysisPrompt("", "", "")
    expect(prompt).toContain("## RPG Wiki Extraction Guidance")
    expect(prompt).not.toContain("## Key Entities")
    expect(prompt).not.toContain("## Key Concepts")
  })

  it("keeps RPG analysis prompt focused on Stage 1 analysis contract", () => {
    const prompt = buildAnalysisPrompt("", "", "", "llmwikirpg")

    expect(prompt).toContain("## RPG Wiki Extraction Guidance")
    expect(prompt).toContain("## Source Profile")
    expect(prompt).toContain("source_kind: setting_encyclopedia | plot_character_analysis | canon_narrative | dialogue_corpus | live_runtime_input | mixed | unknown")
    expect(prompt).toContain("live_input_marker: [RPG-LIVE] | none")
    expect(prompt).toContain("[RPG-LIVE]")
    expect(prompt).toContain("dominant_focus")
    expect(prompt).toContain("needed_categories")
    expect(prompt).toContain("suppressed_categories")
    expect(prompt).toContain("live_scene_allowed: true | false")
    expect(prompt).toContain("Set live_scene_allowed to true only when the source text contains the exact [RPG-LIVE] marker")
    expect(prompt).toContain("Only put current-scene in needed_categories when [RPG-LIVE] is present and live_scene_allowed is true")
    expect(prompt).toContain("event_extraction_mode: none | discrete_only | plot_arc_preferred | split_if_possible")
    expect(prompt).toContain("Stage 2 will use only Source Profile needed_categories")
    expect(prompt).toContain("Do not include sources in needed_categories")
    expect(prompt).toContain("Choose at most 4 needed_categories")
    expect(prompt).toContain("## Candidate Objects")
    expect(prompt).toContain("object_type")
    expect(prompt).toContain("suggested_route")
    expect(prompt).toContain("action: create | update | merge-into | ignore")
    expect(prompt).toContain("evidence_summary")
    expect(prompt).toContain("brief_inference")
    expect(prompt).toContain("confidence")
    expect(prompt).toContain("uncertainty")
    expect(prompt).toContain("## Ignored Noise")
    expect(prompt).toContain("## Merge Targets")
    expect(prompt).toContain("## Open Questions")
    expect(prompt).toContain("Stage 1 is analysis only")
    expect(prompt).toContain("Allowed object_type values:")
    expect(prompt).toContain("Allowed suggested_route values:")
    expect(prompt).toContain("Allowed action values:")
    expect(prompt).toContain("For every candidate object, decide what the object is before choosing a folder")
    expect(prompt).toContain("Allowed object_type values: source, world_fact, npc_character, player_character, location, faction, item, plot_arc, discrete_event, current_scene_state, relationship, character_trait_or_trivia, wiki_noise")
    expect(prompt).toContain("Object type glossary:")
    expect(prompt).toContain("world_fact: stable or slowly changing setting facts")
    expect(prompt).toContain("story protagonists, viewpoint characters, and controllable source-fiction characters stay here")
    expect(prompt).toContain("player_character: accepted state, resources, goals, abilities, inventory, knowledge, or consequences for the current RPG player-created or explicitly declared PC only")
    expect(prompt).toContain("location: important or repeated places")
    expect(prompt).toContain("faction: organizations, families, institutions")
    expect(prompt).toContain("mark thin evidence as uncertain instead of inventing detail")
    expect(prompt).toContain("item: important equipment, clues, key objects")
    expect(prompt).toContain("plot_arc: routes, storylines, timelines, multi-event courses")
    expect(prompt).toContain("discrete_event: one confirmed already-happened event")
    expect(prompt).toContain("static lore, biographies, summaries, endings, and epilogues are not current_scene_state")
    expect(prompt).toContain("relationship state, trust, tension, conflict, dependency, misunderstandings, history, changes, or constraints, not duplicate character introductions")
    expect(prompt).toContain("Routing discipline:")
    expect(prompt).not.toContain("Routing boundaries:")
    expect(prompt).toContain("evidence_summary must briefly list the source evidence")
    expect(prompt).toContain("brief_inference must be one or two concise sentences")
    expect(prompt).toContain("confidence must be high, medium, or low")
    expect(prompt).toContain("uncertainty must name evidence gaps")
  })

  it("keeps RPG analysis prompt free of default, page-contract, and domain-specific pollution", () => {
    const prompt = buildAnalysisPrompt("", "", "", "llmwikirpg")

    const forbiddenDefaultSections = [
      "## Key Entities",
      "## Key Concepts",
      "Main Arguments & Findings",
      "Recommendations",
    ]
    const forbiddenPageContractTerms = [
      "Character Impression",
      "Psychological Model",
      "Dialogue Style",
      "RP Usage",
    ]
    const forbiddenDomainTerms = [
      "Fate",
      "UBW",
      "HF",
      "Fuyuki",
      "Holy Grail",
      "Heaven's Feel",
    ]

    for (const term of [
      ...forbiddenDefaultSections,
      ...forbiddenPageContractTerms,
      ...forbiddenDomainTerms,
    ]) {
      expect(prompt).not.toContain(term)
    }
  })
})

describe("buildGenerationPrompt language directive", () => {
  it("injects the user's explicit language setting", () => {
    useWikiStore.getState().setOutputLanguage("Chinese")
    const prompt = buildGenerationPrompt("schema", "purpose", "index", "source.pdf")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Chinese")
  })

  it("honors Vietnamese setting", () => {
    useWikiStore.getState().setOutputLanguage("Vietnamese")
    const prompt = buildGenerationPrompt("", "", "", "file.pdf")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Vietnamese")
  })

  it("auto mode detects from source content", () => {
    useWikiStore.getState().setOutputLanguage("auto")
    const prompt = buildGenerationPrompt("", "", "", "file.pdf", undefined, "\u8fd9\u662f\u4e2d\u6587\u6e90\u6587\u672c")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: Chinese")
  })

  it("includes the source filename in output instructions", () => {
    const prompt = buildGenerationPrompt("", "", "", "my-paper.pdf")
    expect(prompt).toContain("my-paper.pdf")
  })

  it("makes project schema routing RPG-authoritative without legacy fallback folders", () => {
    const prompt = buildGenerationPrompt(
      "Use wiki/people/ for people. Use wiki/technologies/ for technical methods.",
      "",
      "",
      "source.pdf",
    )

    expect(prompt).toContain("## RPG Project Schema and Routing (AUTHORITATIVE)")
    expect(prompt).toContain("project-level naming, formatting, and override guidance")
    expect(prompt).not.toContain("otherwise use wiki/entities/")
    expect(prompt).not.toContain("wiki/entities/")
    expect(prompt).not.toContain("wiki/concepts/")
    expect(prompt).not.toContain("wiki/queries/")
  })

  it("respects user setting regardless of source content language", () => {
    useWikiStore.getState().setOutputLanguage("English")
    const prompt = buildGenerationPrompt("", "", "", "x.pdf", undefined, "\u3053\u308c\u306f\u65e5\u672c\u8a9e\u306e\u6587\u7ae0\u3067\u3059")
    expect(prompt).toContain("MANDATORY OUTPUT LANGUAGE: English")
    expect(prompt).not.toContain("OUTPUT LANGUAGE: Japanese")
  })

  it("ignores legacy/default generation mode requests and stays RPG-only", () => {
    const prompt = buildGenerationPrompt("", "", "", "source.md")
    expect(prompt).toContain("## RPG Wiki Generation Contract")
    expect(prompt).not.toContain("wiki/entities/")
    expect(prompt).not.toContain("wiki/concepts/")
    expect(prompt).not.toContain("wiki/queries/")
  })

  it("uses only the minimal RPG generation contract when Source Profile is missing", () => {
    const prompt = buildGenerationPrompt("", "", "", "rpg-session.md", undefined, "", undefined, "llmwikirpg")

    expect(prompt).toContain("## RPG Wiki Generation Contract")
    expect(prompt).toContain("No valid ## Source Profile with needed_categories was found")
    expect(prompt).toContain("add a REVIEW block explaining that focused RPG category selection is missing")
    expect(prompt).toContain("do not compensate by applying every directory contract")
    expect(prompt).not.toContain("## Focused RPG Page Guidance")
    expect(prompt).not.toContain("Character page contract for wiki/characters/*.md")
    expect(prompt).not.toContain("Player contract:")
    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
    expect(prompt).not.toContain("Relationships contract:")
    expect(prompt).not.toContain("Locations short contract:")
    expect(prompt).not.toContain("Factions short contract:")
    expect(prompt).not.toContain("Items short contract:")
    expect(prompt).not.toContain("## What to generate")
    expect(prompt).not.toContain("Entity or schema-defined typed pages for key named things identified in the analysis")
    expect(prompt).not.toContain("Concept or schema-defined typed pages for key ideas, methods, techniques, and abstractions")
  })

  it("treats a Source Profile without needed_categories as invalid", () => {
    const invalidProfile = [
      "## Source Profile",
      "- source_kind: mixed",
      "- dominant_focus: incomplete profile",
      "- suppressed_categories: []",
      "- live_scene_allowed: false",
      "- event_extraction_mode: none",
    ].join("\n")
    const prompt = buildGenerationPrompt("", "", "", "rpg-session.md", undefined, "", undefined, "llmwikirpg", invalidProfile)

    expect(prompt).toContain("No valid ## Source Profile with needed_categories was found")
    expect(prompt).toContain("add a REVIEW block explaining that focused RPG category selection is missing")
    expect(prompt).not.toContain("## Focused RPG Page Guidance")
  })

  it("injects only the world contract from Source Profile needed_categories", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "rpg-session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[world]"),
    )

    expect(prompt).toContain("## Focused RPG Page Guidance")
    expect(prompt).toContain("selected only from Stage 1 ## Source Profile needed_categories: world")
    expect(prompt).toContain("World contract:")
    expect(prompt).not.toContain("### characters (wiki/characters/)")
    expect(prompt).not.toContain("Character page contract for wiki/characters/*.md")
    expect(prompt).not.toContain("Player contract:")
    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
    expect(prompt).not.toContain("Relationships contract:")
    expect(prompt).not.toContain("Locations short contract:")
    expect(prompt).not.toContain("Factions short contract:")
    expect(prompt).not.toContain("Items short contract:")
  })

  it("injects only character and relationship contracts from Source Profile needed_categories", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[characters, relationships]"),
    )

    expect(prompt).toContain("Character page contract for wiki/characters/*.md")
    expect(prompt).toContain("## Character Impression")
    expect(prompt).toContain("Relationships contract:")
    expect(prompt).not.toContain("World contract:")
    expect(prompt).not.toContain("Player contract:")
    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
    expect(prompt).not.toContain("Locations short contract:")
    expect(prompt).not.toContain("Factions short contract:")
    expect(prompt).not.toContain("Items short contract:")
  })

  it("does not expand the current-scene contract without live_scene_allowed true", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[current-scene]"),
    )

    expect(prompt).toContain("REVIEW: current-scene was requested")
    expect(prompt).toContain("[RPG-LIVE]")
    expect(prompt).not.toContain("Current-scene contract:")
  })

  it("expands the current-scene contract only when live_scene_allowed is true", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[current-scene]", "", true),
    )

    expect(prompt).toContain("Current-scene contract:")
    expect(prompt).toContain("The source input must contain the exact [RPG-LIVE] marker")
    expect(prompt).toContain("Use exactly wiki/current-scene/scene_state.md")
    expect(prompt).toContain("Do not copy [RPG-LIVE] into page content")
  })

  it("does not infer focused RPG contracts from schema, purpose, source paths, object_type, or suggested_route", () => {
    const prompt = buildGenerationPrompt(
      "Target path: wiki/characters/rin.md\nobject_type: relationship",
      "suggested_route: wiki/plot-arcs/",
      "",
      "wiki/characters/source-note.md",
      undefined,
      "",
      "wiki/characters/source-note.md",
      "llmwikirpg",
    )

    expect(prompt).toContain("No valid ## Source Profile with needed_categories was found")
    expect(prompt).not.toContain("Character page contract for wiki/characters/*.md")
    expect(prompt).not.toContain("Relationships contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
  })

  it("validates, deduplicates, and caps Source Profile needed_categories", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[sources, world, world, invalid, locations, factions, items, events]"),
    )

    expect(prompt).toContain("World contract:")
    expect(prompt).toContain("Locations short contract:")
    expect(prompt).toContain("Factions short contract:")
    expect(prompt).toContain("Items short contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Sources contract:")
  })

  it("carries Source Profile event_extraction_mode into focused guidance", () => {
    const profile = [
      "## Source Profile",
      "- source_kind: canon_narrative",
      "- dominant_focus: route-level narrative",
      "- needed_categories: [plot-arcs, events]",
      "- suppressed_categories: []",
      "- live_scene_allowed: false",
      "- event_extraction_mode: plot_arc_preferred",
      "",
      "## Candidate Objects",
      "- Name: route",
    ].join("\n")
    const prompt = buildGenerationPrompt("", "", "", "session.md", undefined, "", undefined, "llmwikirpg", profile)

    expect(prompt).toContain("Plot-arcs contract:")
    expect(prompt).toContain("Events contract:")
    expect(prompt).toContain("Source Profile event_extraction_mode: plot_arc_preferred")
    expect(prompt).toContain("prefer plot-arcs unless Stage 1 clearly split discrete confirmed events")
  })

  it("keeps domain guidance independent from the generic RPG generation prompt", () => {
    const generic = buildGenerationPrompt("", "", "", "session.md", undefined, "", undefined, "llmwikirpg")
    const domain = buildGenerationPrompt("", "", "", "fate-notes.md", undefined, "", undefined, "llmwikirpg")

    expect(generic).not.toContain("## Domain-Specific Guidance")
    expect(generic).not.toContain("Fate")
    expect(generic).not.toContain("UBW")
    expect(generic).not.toContain("HF")
    expect(generic).not.toContain("Fuyuki")
    expect(generic).not.toContain("Holy Grail")
    expect(generic).not.toContain("Heaven's Feel")

    expect(domain).toContain("## Domain-Specific Guidance")
    expect(domain).toContain("Detected Fate/stay night style source markers")
    expect(domain).toContain("Holy Grail War material")
  })
})

describe("analysis + generation prompt consistency", () => {
  it("both stages declare the same language for a given setting", () => {
    useWikiStore.getState().setOutputLanguage("Korean")
    const analysis = buildAnalysisPrompt("", "", "")
    const generation = buildGenerationPrompt("", "", "", "f.pdf")
    expect(analysis).toContain("MANDATORY OUTPUT LANGUAGE: Korean")
    expect(generation).toContain("MANDATORY OUTPUT LANGUAGE: Korean")
  })

  it("both stages in auto mode agree on detected language from source", () => {
    useWikiStore.getState().setOutputLanguage("auto")
    const korean = "\uc774\uac83\uc740 \ud55c\uad6d\uc5b4 \ubb38\uc7a5\uc785\ub2c8\ub2e4"
    const analysis = buildAnalysisPrompt("", "", korean)
    const generation = buildGenerationPrompt("", "", "", "f.pdf", undefined, korean)
    expect(analysis).toContain("MANDATORY OUTPUT LANGUAGE: Korean")
    expect(generation).toContain("MANDATORY OUTPUT LANGUAGE: Korean")
  })
})

describe("long-source ingest planning", () => {
  it("scales generation output tokens with the configured context window", () => {
    expect(computeIngestGenerationMaxTokens(64_000)).toBe(8_192)
    expect(computeIngestGenerationMaxTokens(128_000)).toBe(16_384)
    expect(computeIngestGenerationMaxTokens(256_000)).toBe(24_576)
    expect(computeIngestGenerationMaxTokens(1_000_000)).toBe(32_768)
    expect(computeIngestReviewMaxTokens(1_000_000)).toBe(8_192)
  })

  it("scales source budget from the configured context window instead of a fixed 50k cap", () => {
    const small = computeIngestSourceBudget(64_000, 8_000)
    const large = computeIngestSourceBudget(1_000_000, 8_000)

    expect(small).toBeGreaterThan(20_000)
    expect(large).toBeGreaterThan(200_000)
    expect(large).toBeLessThanOrEqual(300_000)
  })

  it("splits long sources on heading and paragraph boundaries with overlap", () => {
    const content = [
      "# Chapter One",
      "",
      "A".repeat(1200),
      "",
      "B".repeat(1200),
      "",
      "## Section Two",
      "",
      "C".repeat(1200),
      "",
      "D".repeat(1200),
    ].join("\n")

    const chunks = splitSourceIntoSemanticChunks(content, 1800, 200)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].headingPath).toBe("Chapter One")
    expect(chunks.some((chunk) => chunk.headingPath.includes("Section Two"))).toBe(true)
    expect(chunks[1].overlapBefore.length).toBeGreaterThan(0)
    expect(chunks[1].main.startsWith(chunks[0].main.slice(-200))).toBe(false)
  })
})
