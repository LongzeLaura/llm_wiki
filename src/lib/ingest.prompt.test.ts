import { beforeEach, describe, expect, it } from "vitest"
import {
  computeIngestGenerationMaxTokens,
  computeIngestReviewMaxTokens,
  computeIngestSourceBudget,
  splitSourceIntoSemanticChunks,
} from "./ingest"
import {
  buildChunkAnalysisSystemPrompt,
  buildChunkAnalysisUserPrompt,
  buildRpgAnalysisPrompt,
  buildRpgGenerationPrompt,
} from "./rpg-interactions/source-ingest"
import { useWikiStore } from "@/stores/wiki-store"

const OLD_LIVE_MARKER = "[RPG" + "-LIVE]"
const OLD_LIVE_MARKER_FIELD = "live_" + "input_marker"
const OLD_LIVE_ALLOWED_FIELD = "live_" + "scene_allowed"

function buildAnalysisPrompt(
  purpose: string,
  index: string,
  sourceContent: string = "",
  wikiMode = "llmwikirpg",
): string {
  void wikiMode
  return buildRpgAnalysisPrompt(purpose, index, sourceContent)
}

function buildGenerationPrompt(
  schema: string,
  purpose: string,
  index: string,
  sourceFileName: string,
  overview?: string,
  sourceContent: string = "",
  sourceSummaryPath?: string,
  wikiMode = "llmwikirpg",
  stage1Analysis?: string,
): string {
  void wikiMode
  return buildRpgGenerationPrompt(
    schema,
    purpose,
    index,
    sourceFileName,
    overview,
    sourceContent,
    sourceSummaryPath,
    stage1Analysis,
  )
}

beforeEach(() => {
  useWikiStore.getState().setOutputLanguage("auto")
})

// 构造一段最小可用的 RPG Stage 1 Source Profile 测试文本。
// 作用：让 Stage 2 prompt 相关测试可以快速模拟不同的 needed_categories
// 组合，而不必在每个用例里手写完整分析结果。
function sourceProfile(
  neededCategories: string,
  extra: string = "",
): string {
  return [
    "## Source Profile",
    "- source_kind: mixed",
    "- dominant_focus: focused test fixture",
    // neededCategories 是每个测试关注的核心变量，用来验证 Stage 2 是否只展开指定目录合约。
    `- needed_categories: ${neededCategories}`,
    "- suppressed_categories: []",
    "- event_extraction_mode: none",
    "- runtime_utility_focus: mixed",
    "- noise_ratio: low",
    "- recommended_ingest_mode: focused_pages",
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
    expect(prompt).toContain("source_kind: setting_encyclopedia | plot_character_analysis | canon_narrative | dialogue_corpus | mixed | unknown")
    expect(prompt).not.toContain(OLD_LIVE_MARKER)
    expect(prompt).not.toContain(OLD_LIVE_MARKER_FIELD)
    expect(prompt).toContain("dominant_focus")
    expect(prompt).toContain("needed_categories")
    expect(prompt).toContain("suppressed_categories")
    expect(prompt).not.toContain(OLD_LIVE_ALLOWED_FIELD)
    expect(prompt).toContain("Ordinary ingest must not put current-scene in needed_categories")
    expect(prompt).toContain("Ordinary ingest must not generate or update wiki/current-scene/scene_state.md")
    expect(prompt).toContain("current-scene is owned by the RPG Play/Runtime apply flow")
    expect(prompt).toContain("event_extraction_mode: none | discrete_only | plot_arc_preferred | split_if_possible")
    expect(prompt).toContain("runtime_utility_focus: npc_portrayal | player_action | plot_pressure | state_update | atmosphere_style | mixed | low")
    expect(prompt).toContain("noise_ratio: low | medium | high")
    expect(prompt).toContain("recommended_ingest_mode: source_only | capsule_pages | focused_pages | review_first")
    expect(prompt).toContain("Stage 2 will use only Source Profile needed_categories")
    expect(prompt).toContain("Do not include sources in needed_categories")
    expect(prompt).toContain("Choose at most 4 needed_categories")
    expect(prompt).toContain("## Candidate Objects")
    expect(prompt).toContain("object_type")
    expect(prompt).toContain("suggested_route")
    expect(prompt).toContain("action: create | update | merge-into | ignore")
    expect(prompt).toContain("runtime_utility: 0 | 1 | 2 | 3 | 4 | 5")
    expect(prompt).toContain("runtime_use")
    expect(prompt).toContain("evidence_summary")
    expect(prompt).toContain("brief_inference")
    expect(prompt).toContain("confidence")
    expect(prompt).toContain("canon_status: canon | inferred_for_play | uncertain")
    expect(prompt).toContain("uncertainty")
    expect(prompt).toContain("## RP Runtime Signals")
    expect(prompt).toContain("kind: portrayal_rule | dialogue_style | behavior_boundary")
    expect(prompt).toContain("utility_score: 0 | 1 | 2 | 3 | 4 | 5")
    expect(prompt).toContain("## Ignored Noise")
    expect(prompt).toContain("## Merge Targets")
    expect(prompt).toContain("## Open Questions")
    expect(prompt).toContain("Stage 1 is analysis only")
    expect(prompt).toContain("Allowed object_type values:")
    expect(prompt).toContain("Allowed suggested_route values:")
    expect(prompt).toContain("Allowed action values:")
    expect(prompt).toContain("For every candidate object, decide what the object is before choosing a folder")
    expect(prompt).toContain("Assess whether the source contains RPG-runtime-useful material")
    expect(prompt).toContain("set noise_ratio to high")
    expect(prompt).toContain("recommended_ingest_mode controls generation intensity")
    expect(prompt).toContain("Allowed object_type values: source, world_fact, npc_character, player_character, location, faction, item, plot_arc, discrete_event, relationship, character_trait_or_trivia, wiki_noise")
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
    expect(prompt).toContain("If source text describes a scene from canon")
    expect(prompt).toContain("relationship state, trust, tension, conflict, dependency, misunderstandings, history, changes, or constraints, not duplicate character introductions")
    expect(prompt).toContain("Routing discipline:")
    expect(prompt).toContain("Score every candidate with runtime_utility:")
    expect(prompt).toContain("Do not create or update non-source RPG pages for candidates with runtime_utility below 3")
    expect(prompt).toContain("RP Runtime Signals must list only signals")
    expect(prompt).toContain("Do not list trivia as RP Runtime Signals")
    expect(prompt).not.toContain("Routing boundaries:")
    expect(prompt).toContain("evidence_summary must briefly list the source evidence")
    expect(prompt).toContain("brief_inference must be one or two concise sentences")
    expect(prompt).toContain("confidence must be high, medium, or low")
    expect(prompt).toContain("uncertainty must name evidence gaps")
  })

  it("adds D1 directory-boundary rules to the RPG analysis prompt", () => {
    const prompt = buildAnalysisPrompt("", "", "", "llmwikirpg")

    expect(prompt).toContain("## RPG Directory Boundary Guidance")
    expect(prompt).toContain("Do not put quests, rules, or style in ordinary Source Profile needed_categories")
    expect(prompt).toContain("PC subjective goals, wishes, promises, commitments, personal motives")
    expect(prompt).toContain("do not classify plot pressure or game objective progress as player goals")
    expect(prompt).toContain("Game-recognized, trackable objectives")
    expect(prompt).toContain("player TODO/checklist or quest ledger")
    expect(prompt).toContain("executable mechanics, limits, costs, checks, allowed/disallowed actions, success/failure boundaries")
    expect(prompt).toContain("ordinary source ingest should emit REVIEW instead of writing rules/")
    expect(prompt).toContain("global writing rules are control_doc_import material for REVIEW")
    expect(prompt).toContain("Forbidden in ordinary Source Ingest")
    expect(prompt).toContain("wiki/memory/**")
    expect(prompt).toContain("wiki/outlines/**")
    expect(prompt).toContain("character-specific voice, catchphrases, address habits, politeness level")
    expect(prompt).toContain("player current holdings, quantity, equipped/backpack status")
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
    expect(prompt).not.toContain("Locations scene-card contract:")
    expect(prompt).not.toContain("Factions pressure-source contract:")
    expect(prompt).not.toContain("Items runtime-function contract:")
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
    expect(prompt).toContain("Runtime Capsule")
    expect(prompt).toContain("Runtime page soft budgets:")
    expect(prompt).toContain("Use Stage 1 Candidate Objects and RP Runtime Signals as a utility gate")
    expect(prompt).toContain("utility_score/runtime_utility 4-5: prioritize in Runtime Capsule")
    expect(prompt).toContain("If ## Structured RP Runtime Signals is present")
    expect(prompt).not.toContain("### characters (wiki/characters/)")
    expect(prompt).not.toContain("Character page contract for wiki/characters/*.md")
    expect(prompt).not.toContain("Player contract:")
    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
    expect(prompt).not.toContain("Relationships contract:")
    expect(prompt).not.toContain("Locations scene-card contract:")
    expect(prompt).not.toContain("Factions pressure-source contract:")
    expect(prompt).not.toContain("Items runtime-function contract:")
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
    expect(prompt).toContain("## Runtime Capsule")
    expect(prompt).toContain("Relationship Levers")
    expect(prompt).toContain("Build a runtime-first NPC operation model")
    expect(prompt).not.toContain("- ## Character Impression")
    expect(prompt).toContain("Relationships contract:")
    expect(prompt).not.toContain("World contract:")
    expect(prompt).not.toContain("Player contract:")
    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain("Events contract:")
    expect(prompt).not.toContain("Plot-arcs contract:")
    expect(prompt).not.toContain("Locations scene-card contract:")
    expect(prompt).not.toContain("Factions pressure-source contract:")
    expect(prompt).not.toContain("Items runtime-function contract:")
  })

  it("does not expand the current-scene contract from ordinary needed_categories", () => {
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

    expect(prompt).toContain("No valid ## Source Profile with needed_categories was found")
    expect(prompt).not.toContain(OLD_LIVE_MARKER)
    expect(prompt).not.toContain("Current-scene contract:")
  })

  it("does not expand the current-scene contract even if old live-scene text is present", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      [
        sourceProfile("[current-scene]", `- ${OLD_LIVE_ALLOWED_FIELD}: true`),
        `- ${OLD_LIVE_MARKER_FIELD}: legacy`,
      ].join("\n"),
    )

    expect(prompt).not.toContain("Current-scene contract:")
    expect(prompt).not.toContain(OLD_LIVE_MARKER)
    expect(prompt).toContain("No valid ## Source Profile with needed_categories was found")
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
    expect(prompt).toContain("Locations scene-card contract:")
    expect(prompt).toContain("Factions pressure-source contract:")
    expect(prompt).toContain("Items runtime-function contract:")
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

  it("requires structured signal gating when Stage 2 sees long-source signals", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "long-route.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      [
        sourceProfile("[plot-arcs, events]", "- event_extraction_mode: split_if_possible"),
        "## Structured RP Runtime Signals",
        "- utilityScore 0-1: source summary / ignored noise only",
      ].join("\n"),
    )

    expect(prompt).toContain("treat it as the authoritative utility-scored signal list")
    expect(prompt).toContain("utility_score/runtime_utility 0-1: keep out of non-source pages and do not use them as page-generation material")
    expect(prompt).toContain("utility_score/runtime_utility 2: use only as REVIEW or Evidence and Uncertainty")
    expect(prompt).toContain("Do not compress long plot/course recaps into one wiki/events/ page")
    expect(prompt).toContain("only confirmed discrete events go to wiki/events/")
    expect(prompt).toContain("Unresolved conflicts, foreshadowing, possible developments, and progression conditions belong in wiki/plot-arcs/ or REVIEW")
    expect(prompt).toContain("For structured signals scored 4-5, put the usable target-page material first in ## Runtime Capsule")
  })

  it("adds D1 directory-boundary rules to the RPG generation prompt", () => {
    const prompt = buildGenerationPrompt(
      "",
      "",
      "",
      "session.md",
      undefined,
      "",
      undefined,
      "llmwikirpg",
      sourceProfile("[player, plot-arcs, characters, items]"),
    )

    expect(prompt).toContain("## RPG Directory Boundary Guidance")
    expect(prompt).toContain("PC subjective goals may enter wiki/player/goals.md only for an explicitly declared current PC")
    expect(prompt).toContain("Do not create wiki/quests/*.md in ordinary Source Ingest")
    expect(prompt).toContain("Plot pressure, unresolved conflict, foreshadowing, and possible development belong in wiki/plot-arcs/, not wiki/player/goals.md")
    expect(prompt).toContain("Player TODO/checklists are REVIEW in ordinary Source Ingest")
    expect(prompt).toContain("Global writing rules are control_doc_import material for REVIEW")
    expect(prompt).toContain("character-specific voice, catchphrases, address habits, politeness level")
    expect(prompt).toContain("Executable mechanics, limits, costs, checks")
    expect(prompt).toContain("control_doc_import material for REVIEW")
    expect(prompt).toContain("world/ should keep only background, common knowledge, history, society, geography, and stable setting facts")
    expect(prompt).toContain("wiki/player/inventory.md is for current holdings")
    expect(prompt).toContain("Do not store player TODO/checklists or quest progress ledgers in plot-arcs")
    expect(prompt).toContain("Character-specific voice, catchphrases, address habits, politeness level, and avoided topics belong here, not in global wiki/style/")
    expect(prompt).toContain("Do not replace wiki/player/inventory.md")
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

  it("asks each long-source chunk to output structured RP Runtime Signals JSON", () => {
    const prompt = buildChunkAnalysisSystemPrompt("purpose", "schema", "index", "long source text")

    expect(prompt).toContain("## RP Runtime Signals JSON")
    expect(prompt).toContain("Output a fenced JSON array of RpgIngestSignal objects")
    expect(prompt).toContain("JSON object fields: kind, optional targetPath, summary, rpUse, evidence, utilityScore, confidence, canonStatus")
    expect(prompt).toContain("utilityScore rules: 0 noise discard/ignored noise; 1 source/archive value only; 2 weak or uncertain signal")
    expect(prompt).toContain("4 strong source-ingest signal for Runtime Capsule")
    expect(prompt).toContain("5 hard constraint")
    expect(prompt).toContain("emit kind noise with utilityScore 0 or 1")
    expect(prompt).toContain("emit state_change signals for wiki/events/ only when the main chunk contains a confirmed discrete already-happened event")
    expect(prompt).toContain("## Source Ingest Target Policy")
    expect(prompt).toContain("wiki/*/runtime/**")
    expect(prompt).toContain("wiki/current-scene/**")
    expect(prompt).toContain("Do not target wiki/quests/ in ordinary Source Ingest")
    expect(prompt).toContain("Do not target wiki/player/goals.md for plot pressure")
    expect(prompt).toContain("Do not turn player TODO/checklists into plot-arcs")
    expect(prompt).toContain("Executable mechanics, limits, costs, checks, allowed/disallowed actions")
    expect(prompt).toContain("campaign_setup_import")
    expect(prompt).toContain("runtime_update_apply")
  })

  it("reminds long-source chunk user prompts to return all three sections", () => {
    const prompt = buildChunkAnalysisUserPrompt(
      "raw/sources/long.md",
      undefined,
      {
        id: "chunk-1",
        index: 1,
        total: 2,
        headingPath: "Chapter One",
        overlapBefore: "",
        main: "Main chunk text",
      },
      "digest",
    )

    expect(prompt).toContain("Return only the three requested sections")
    expect(prompt).toContain("## Chunk Analysis")
    expect(prompt).toContain("## RP Runtime Signals JSON")
    expect(prompt).toContain("## Updated Global Digest")
  })
})
