import type { IngestScenario } from "./types"

const RPG_PROJECT_META = JSON.stringify({ mode: "llmwikirpg" }, null, 2)

const RPG_SCHEMA = `# llmWikiRPG Schema

wikiMode: llmwikirpg

## RPG directories
- wiki/sources/
- wiki/world/
- wiki/characters/
- wiki/player/
- wiki/locations/
- wiki/factions/
- wiki/items/
- wiki/plot-arcs/
- wiki/events/
- wiki/current-scene/
- wiki/relationships/
- wiki/memory/
`

const RPG_PURPOSE = `# Purpose

This runtime wiki tracks setting facts, player state, scenes, relationships, and turn-relevant memory for an RPG campaign.
`

const RPG_INDEX = `# Index

## Sources

## World

## Characters

## Locations

## Relationships
`

const BASE_INITIAL_WIKI = {
  ".llm-wiki/project.json": RPG_PROJECT_META,
  "purpose.md": RPG_PURPOSE,
  "schema.md": RPG_SCHEMA,
  "wiki/index.md": RPG_INDEX,
  "wiki/overview.md": "# Overview\n",
}

export const ingestScenarios: IngestScenario[] = [
  {
    name: "basic-rpg-source",
    description:
      "Stage 2 emits RPG world, location, and source pages. No legacy directories or reviews should be created.",
    initialWiki: BASE_INITIAL_WIKI,
    source: {
      path: "raw/sources/moonwell-lore.md",
      content: [
        "# Moonwell Lore",
        "",
        "The Moonwell oath binds every harbor bell to the tide calendar.",
        "The Old Bell Tower stores the public tide records used by pilots.",
      ].join("\n"),
    },
    analysisResponse: [
      "## Source Profile",
      "- source_kind: setting_encyclopedia",
      "- dominant_focus: harbor oath and a location",
      "- needed_categories: [world, locations]",
      "- suppressed_categories: [current-scene, player]",
      "- event_extraction_mode: none",
      "",
      "## Candidate Objects",
      "- Name: Moonwell oath",
      "  - object_type: world_fact",
      "  - suggested_route: wiki/world/",
      "  - action: create",
      "  - evidence_summary: The oath binds bells to tide records.",
      "  - brief_inference: This is stable setting knowledge.",
      "  - confidence: high",
      "  - uncertainty: none",
      "- Name: Old Bell Tower",
      "  - object_type: location",
      "  - suggested_route: wiki/locations/",
      "  - action: create",
      "  - evidence_summary: It stores public tide records.",
      "  - brief_inference: This is a reusable campaign location.",
      "  - confidence: high",
      "  - uncertainty: none",
    ].join("\n"),
    generationResponse: [
      "---FILE: wiki/world/supernatural_presence.md---",
      "---",
      'type: "world"',
      'title: "Moonwell Oath"',
      'sources: ["raw/sources/moonwell-lore.md"]',
      "tags: []",
      "related: []",
      "---",
      "",
      "# Moonwell Oath",
      "",
      "## Runtime Capsule",
      "- 约束：harbor bells and tide calendar affect player action timing and risk.",
      "",
      "The Moonwell oath binds harbor bells to the tide calendar.",
      "---END FILE---",
      "",
      "---FILE: wiki/locations/old-bell-tower.md---",
      "---",
      'type: "locations"',
      'title: "Old Bell Tower"',
      'sources: ["raw/sources/moonwell-lore.md"]',
      "tags: []",
      "related: [moonwell-oath]",
      "---",
      "",
      "# Old Bell Tower",
      "",
      "## Runtime Capsule",
      "- 线索：public tide records provide an actionable investigation hook for players.",
      "",
      "The Old Bell Tower stores public tide records used by pilots.",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/moonwell-lore.md---",
      "---",
      'type: "source"',
      'title: "Source: moonwell-lore.md"',
      'sources: ["raw/sources/moonwell-lore.md"]',
      "---",
      "",
      "# Source: moonwell-lore.md",
      "",
      "Source notes for the Moonwell oath and Old Bell Tower.",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/world/supernatural_presence.md",
        "wiki/locations/old-bell-tower.md",
        "wiki/sources/moonwell-lore.md",
      ],
      fileContains: {
        "wiki/world/supernatural_presence.md": ["Moonwell oath binds harbor bells"],
        "wiki/locations/old-bell-tower.md": ["public tide records"],
        "wiki/sources/moonwell-lore.md": ["moonwell-lore.md"],
      },
      reviewsCreated: [],
    },
  },
  {
    name: "generates-review-items",
    description:
      "Stage 2 emits a source page plus REVIEW blocks. Reviews should still appear in the review store.",
    initialWiki: BASE_INITIAL_WIKI,
    source: {
      path: "raw/sources/amber-guild-note.md",
      content: "The Amber Guild appears in a rumor, but its agenda is unclear.",
    },
    analysisResponse: [
      "## Source Profile",
      "- source_kind: mixed",
      "- dominant_focus: unclear faction rumor",
      "- needed_categories: []",
      "- suppressed_categories: [factions]",
      "- event_extraction_mode: none",
      "",
      "## Candidate Objects",
      "- Name: Amber Guild",
      "  - object_type: faction",
      "  - suggested_route: wiki/factions/",
      "  - action: ignore",
      "  - evidence_summary: Only a rumor names the faction.",
      "  - brief_inference: Evidence is too thin for a canonical page.",
      "  - confidence: low",
      "  - uncertainty: agenda unknown",
    ].join("\n"),
    generationResponse: [
      "---FILE: wiki/sources/amber-guild-note.md---",
      "---",
      'type: "source"',
      'title: "Source: amber-guild-note.md"',
      'sources: ["raw/sources/amber-guild-note.md"]',
      "---",
      "",
      "# Source: amber-guild-note.md",
      "",
      "A rumor mentions the Amber Guild, but does not establish its agenda.",
      "---END FILE---",
      "",
      "---REVIEW: missing-page | Amber Guild evidence---",
      "The Amber Guild may need a faction page once stronger evidence exists.",
      "OPTIONS: Create Page | Skip",
      "PAGES: wiki/sources/amber-guild-note.md",
      "---END REVIEW---",
      "",
      "---REVIEW: suggestion | Track faction rumors---",
      "Consider a memory note for unresolved faction rumors.",
      "---END REVIEW---",
    ].join("\n"),
    expected: {
      writtenPaths: ["wiki/sources/amber-guild-note.md"],
      reviewsCreated: [
        { type: "missing-page", titleContains: "Amber Guild" },
        { type: "suggestion", titleContains: "faction rumors" },
      ],
    },
  },
  {
    name: "references-existing-rpg-pages",
    description:
      "Generated relationship pages can link to existing RPG character pages without using legacy concepts.",
    initialWiki: {
      ...BASE_INITIAL_WIKI,
      "wiki/characters/mira-vale.md": [
        "---",
        'type: "characters"',
        'title: "Mira Vale"',
        "---",
        "",
        "# Mira Vale",
        "",
        "A pilot who watches the tide calendar closely.",
      ].join("\n"),
    },
    source: {
      path: "raw/sources/mira-trust.md",
      content: "Mira Vale trusts the player after they returned the lantern key.",
    },
    analysisResponse: [
      "## Source Profile",
      "- source_kind: plot_character_analysis",
      "- dominant_focus: relationship state",
      "- needed_categories: [relationships]",
      "- suppressed_categories: [current-scene]",
      "- event_extraction_mode: none",
      "",
      "## Candidate Objects",
      "- Name: Player and Mira trust",
      "  - object_type: relationship",
      "  - suggested_route: wiki/relationships/",
      "  - action: create",
      "  - evidence_summary: Mira trusts the player after the lantern key was returned.",
      "  - brief_inference: This is relationship tension/state.",
      "  - confidence: high",
      "  - uncertainty: none",
    ].join("\n"),
    generationResponse: [
      "---FILE: wiki/relationships/player-mira-trust.md---",
      "---",
      'type: "relationships"',
      'title: "Player and Mira Trust"',
      'sources: ["raw/sources/mira-trust.md"]',
      "tags: []",
      "related: [mira-vale]",
      "---",
      "",
      "# Player and Mira Trust",
      "",
      "## Runtime Capsule",
      "- 信任状态：Mira's trust changes available choices and relationship tension.",
      "",
      "[[Mira Vale]] trusts the player because the lantern key was returned.",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/mira-trust.md---",
      "---",
      'type: "source"',
      'title: "Source: mira-trust.md"',
      'sources: ["raw/sources/mira-trust.md"]',
      "---",
      "",
      "# Source: mira-trust.md",
      "",
      "Relationship source for [[Mira Vale]].",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/relationships/player-mira-trust.md",
        "wiki/sources/mira-trust.md",
      ],
      fileContains: {
        "wiki/relationships/player-mira-trust.md": ["[[Mira Vale]]"],
      },
      reviewsCreated: [],
    },
  },
  {
    name: "rejects-legacy-file-blocks",
    description:
      "If a model response still emits legacy llm_wiki FILE blocks, the writer refuses them and only keeps RPG source output.",
    initialWiki: BASE_INITIAL_WIKI,
    source: {
      path: "raw/sources/legacy-noise.md",
      content: "This source should not produce entities, concepts, or queries in RPG-only mode.",
    },
    analysisResponse: [
      "## Source Profile",
      "- source_kind: mixed",
      "- dominant_focus: legacy routing regression",
      "- needed_categories: []",
      "- suppressed_categories: []",
      "- event_extraction_mode: none",
      "",
      "## Candidate Objects",
      "- Name: legacy noise",
      "  - object_type: wiki_noise",
      "  - suggested_route: ignore",
      "  - action: ignore",
      "  - evidence_summary: Regression fixture.",
      "  - brief_inference: Legacy output should be rejected.",
      "  - confidence: high",
      "  - uncertainty: none",
    ].join("\n"),
    generationResponse: [
      "---FILE: wiki/entities/old-entity.md---",
      "---",
      'type: "entity"',
      'title: "Old Entity"',
      "---",
      "",
      "# Old Entity",
      "",
      "This must not be written.",
      "---END FILE---",
      "",
      "---FILE: wiki/concepts/old-concept.md---",
      "---",
      'type: "concept"',
      'title: "Old Concept"',
      "---",
      "",
      "# Old Concept",
      "",
      "This must not be written.",
      "---END FILE---",
      "",
      "---FILE: wiki/queries/old-query.md---",
      "---",
      'type: "query"',
      'title: "Old Query"',
      "---",
      "",
      "# Old Query",
      "",
      "This must not be written.",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/legacy-noise.md---",
      "---",
      'type: "source"',
      'title: "Source: legacy-noise.md"',
      'sources: ["raw/sources/legacy-noise.md"]',
      "---",
      "",
      "# Source: legacy-noise.md",
      "",
      "Legacy routing regression fixture.",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: ["wiki/sources/legacy-noise.md"],
      fileContains: {
        "wiki/sources/legacy-noise.md": ["Legacy routing regression fixture"],
      },
      reviewsCreated: [
        { type: "suggestion", titleContains: "legacy path rejected" },
      ],
    },
  },
]
