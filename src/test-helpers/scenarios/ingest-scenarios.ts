import type { IngestScenario } from "./types"

/**
 * Ingest scenarios drive autoIngest end-to-end. Two LLM responses per
 * scenario (stage 1 analysis, stage 2 generation with FILE + REVIEW blocks).
 *
 * FILE block format (what stage 2 must emit to write a wiki file):
 *   ---FILE: wiki/path/to/page.md---
 *   (file content, usually with YAML frontmatter)
 *   ---END FILE---
 *
 * REVIEW block format (what stage 2 emits to inject a review item):
 *   ---REVIEW: missing-page | Short title---
 *   Description.
 *   OPTIONS: Approve | Skip
 *   PAGES: page1.md, page2.md
 *   ---END REVIEW---
 *
 * Stage 2 may emit arbitrary prose around blocks — the parser only
 * cares about the delimited blocks.
 */

const BASIC_PURPOSE = `# Purpose

This wiki tracks deep-learning research concepts.
`

const BASIC_INDEX = `# Index

## Concepts
- [[attention]]
`

const BASIC_SCHEMA = `# Schema

## wiki/sources/
Each ingested source has a summary page here.

## wiki/concepts/
Each concept gets its own page.
`

export const ingestScenarios: IngestScenario[] = [
  // 1. basic-new-source — new concept wiki page + source summary, no reviews
  {
    name: "basic-new-source",
    description:
      "Stage 2 emits a single concept page + a source summary page. No " +
      "REVIEW blocks. The runner must see both files on disk and zero " +
      "reviews in the store.",
    initialWiki: {
      "purpose.md": BASIC_PURPOSE,
      "schema.md": BASIC_SCHEMA,
      "wiki/index.md": BASIC_INDEX,
    },
    source: {
      path: "raw/sources/rope-paper.md",
      content: [
        "# Rotary Position Embedding",
        "",
        "Rotary Position Embedding (RoPE) encodes positional information by",
        "rotating pairs of dimensions in query and key vectors. It naturally",
        "supports variable-length contexts and is now standard in LLMs.",
      ].join("\n"),
    },
    analysisResponse: [
      "## Key Concepts",
      "- Rotary Position Embedding (RoPE): rotates pairs of dimensions",
      "",
      "## Main Arguments",
      "- RoPE naturally supports variable-length contexts",
      "",
      "## Recommendations",
      "- Create wiki/concepts/rope.md",
      "- Create wiki/sources/rope-paper.md",
    ].join("\n"),
    generationResponse: [
      "I'll create one concept page and the source summary.",
      "",
      "---FILE: wiki/concepts/rope.md---",
      "---",
      "title: Rotary Position Embedding",
      "tags: [positional-encoding]",
      "sources: [rope-paper.md]",
      "---",
      "",
      "# Rotary Position Embedding",
      "",
      "RoPE rotates pairs of dimensions in [[attention]] queries and keys",
      "to encode absolute position while preserving relative-position invariance.",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/rope-paper.md---",
      "---",
      "title: \"Source: rope-paper.md\"",
      "sources: [rope-paper.md]",
      "---",
      "",
      "# Source: rope-paper.md",
      "",
      "Paper introducing [[Rotary Position Embedding]].",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/concepts/rope.md",
        "wiki/sources/rope-paper.md",
      ],
      fileContains: {
        "wiki/concepts/rope.md": [
          "title: Rotary Position Embedding",
          "[[attention]]",
        ],
        "wiki/sources/rope-paper.md": ["rope-paper.md"],
      },
      reviewsCreated: [],
    },
  },

  // 2. generates-review-items — REVIEW blocks in generation become store items
  {
    name: "generates-review-items",
    description:
      "Stage 2 emits one FILE and two REVIEW blocks (missing-page + " +
      "suggestion). Both reviews must appear in the store after ingest.",
    initialWiki: {
      "purpose.md": BASIC_PURPOSE,
      "schema.md": BASIC_SCHEMA,
      "wiki/index.md": BASIC_INDEX,
    },
    source: {
      path: "raw/sources/flash-attention.md",
      content:
        "# FlashAttention\n\nFlashAttention is an IO-aware exact attention algorithm.\n",
    },
    analysisResponse: "## Key Concepts\n- FlashAttention\n",
    generationResponse: [
      "---FILE: wiki/sources/flash-attention.md---",
      "---",
      "title: \"Source: flash-attention.md\"",
      "sources: [flash-attention.md]",
      "---",
      "",
      "# Source: flash-attention.md",
      "",
      "FlashAttention is mentioned here.",
      "---END FILE---",
      "",
      "---REVIEW: missing-page | FlashAttention---",
      "The source introduces FlashAttention but no dedicated page exists.",
      "OPTIONS: Create page | Skip",
      "PAGES: wiki/sources/flash-attention.md",
      "---END REVIEW---",
      "",
      "---REVIEW: suggestion | Add IO-aware algorithms survey---",
      "Consider a survey page grouping IO-aware attention variants.",
      "---END REVIEW---",
    ].join("\n"),
    expected: {
      writtenPaths: ["wiki/sources/flash-attention.md"],
      reviewsCreated: [
        { type: "missing-page", titleContains: "FlashAttention" },
        { type: "suggestion", titleContains: "IO-aware" },
      ],
    },
  },

  // 3. references-existing-wikilinks — generated pages link to existing pages
  {
    name: "references-existing-wikilinks",
    description:
      "The generated wiki page must include [[attention]] — linking back " +
      "to a page that already exists in the wiki. Runner asserts substring.",
    initialWiki: {
      "purpose.md": BASIC_PURPOSE,
      "schema.md": BASIC_SCHEMA,
      "wiki/index.md": BASIC_INDEX,
      "wiki/attention.md":
        "---\ntitle: Attention\n---\n\n# Attention\n\nThe attention mechanism.\n",
    },
    source: {
      path: "raw/sources/multi-head.md",
      content: "# Multi-Head Attention\n\nParallel attention heads.\n",
    },
    analysisResponse:
      "## Connections to Existing Wiki\n" +
      "- Multi-head attention is a variant of attention — existing [[attention]] page should be linked.\n",
    generationResponse: [
      "---FILE: wiki/concepts/multi-head-attention.md---",
      "---",
      "title: Multi-Head Attention",
      "---",
      "",
      "# Multi-Head Attention",
      "",
      "Multi-head [[attention]] runs several attention layers in parallel.",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/multi-head.md---",
      "---",
      "title: \"Source: multi-head.md\"",
      "---",
      "",
      "# Source: multi-head.md",
      "",
      "Source for multi-head [[attention]].",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/concepts/multi-head-attention.md",
        "wiki/sources/multi-head.md",
      ],
      fileContains: {
        "wiki/concepts/multi-head-attention.md": ["[[attention]]"],
      },
    },
  },

  // 4. chinese-source — Chinese content flows through to Chinese wiki pages
  {
    name: "chinese-source",
    description:
      "Chinese-language source document; LLM responses in Chinese. " +
      "UTF-8 round-trip through file write must be clean.",
    initialWiki: {
      "purpose.md": "# 用途\n\n深度学习研究笔记。\n",
      "schema.md": BASIC_SCHEMA,
      "wiki/index.md": "# 索引\n\n- [[注意力机制]]\n",
    },
    source: {
      path: "raw/sources/transformer-survey.md",
      content: "# Transformer 综述\n\nTransformer 是一种基于注意力机制的神经网络架构。\n",
    },
    analysisResponse: "## 核心概念\n- Transformer：基于注意力机制的架构\n",
    generationResponse: [
      "---FILE: wiki/concepts/transformer.md---",
      "---",
      "title: Transformer",
      "---",
      "",
      "# Transformer",
      "",
      "Transformer 是一种基于 [[注意力机制]] 的神经网络架构。",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/transformer-survey.md---",
      "---",
      "title: \"Source: transformer-survey.md\"",
      "---",
      "",
      "# Source: transformer-survey.md",
      "",
      "关于 [[Transformer]] 的综述。",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/concepts/transformer.md",
        "wiki/sources/transformer-survey.md",
      ],
      fileContains: {
        "wiki/concepts/transformer.md": [
          "title: Transformer",
          "[[注意力机制]]",
        ],
      },
    },
  },

  // 5. chemical-zeolite-mto-smoke - chemical profile routes to four-layer pages
  {
    name: "chemical-zeolite-mto-smoke",
    description:
      "Chemical-profile source covering methanol-to-olefins over H-ZSM-5. " +
      "Stage 2 emits catalytic-system, elementary-process, mechanistic-network, " +
      "evidence-claim, source-summary, index, log, and overview pages.",
    initialWiki: {
      "purpose.md": [
        "# Purpose",
        "",
        "This wiki tracks catalytic chemistry papers, especially zeolite reaction mechanisms.",
      ].join("\n"),
      "schema.md": [
        "# Schema",
        "",
        "Project mode: chemical",
        "Category profile: chemical-default",
        "",
        "## wiki/sources/",
        "Use for source summary and provenance pages.",
        "",
        "## wiki/catalytic-systems/",
        "Use for catalytic systems, species, catalyst materials, frameworks, sites, and conditions.",
        "",
        "## wiki/elementary-processes/",
        "Use for elementary reaction, transport, deactivation, and regeneration events.",
        "",
        "## wiki/mechanistic-networks/",
        "Use for pathways, cycles, competing routes, and mechanism-level claims.",
        "",
        "## wiki/evidence-claims/",
        "Use for evidence that supports, challenges, or limits chemical claims.",
      ].join("\n"),
      "wiki/index.md": [
        "# Index",
        "",
        "## Sources",
        "",
        "## Catalytic Systems",
        "",
        "## Elementary Processes",
        "",
        "## Mechanistic Networks",
        "",
        "## Evidence Claims",
      ].join("\n"),
      "wiki/overview.md": [
        "# Overview",
        "",
        "This wiki collects catalytic chemistry notes and source summaries.",
      ].join("\n"),
    },
    source: {
      path: "raw/sources/zeolite-mto-smoke-paper.md",
      content: [
        "# Methanol-to-Olefins Over H-ZSM-5: Mechanistic Smoke Sample",
        "",
        "## Abstract",
        "",
        "Methanol conversion over H-ZSM-5 was studied under methanol-to-olefins conditions.",
        "Bronsted acid sites located in MFI straight channels stabilize surface methoxy species.",
        "Short contact times favor an olefin-cycle route, while longer times increase aromatic-cycle contributions.",
        "13C isotope-labeling experiments indicate that retained hydrocarbon species contribute to light-olefin formation.",
        "DFT calculations show a lower methylation barrier in straight channels than in channel intersections.",
      ].join("\n"),
    },
    analysisResponse: [
      "## Catalytic Systems",
      "- H-ZSM-5 under methanol-to-olefins conditions; MFI framework; Bronsted acid sites in straight channels.",
      "",
      "## Elementary Processes",
      "- Surface methoxy formation by methanol dehydration on Bronsted acid sites.",
      "- Methylation in straight channels.",
      "",
      "## Mechanistic Networks",
      "- Dual-cycle methanol-to-olefins mechanism with olefin-cycle dominance at short contact times.",
      "",
      "## Evidence & Validation",
      "- 13C isotope labeling supports retained hydrocarbon participation in light-olefin formation.",
      "- DFT methylation barriers support channel-dependent pathway preference.",
      "",
      "## Recommendations",
      "- Create chemical pages in catalytic-systems, elementary-processes, mechanistic-networks, and evidence-claims.",
      "- Create a source summary and update index/log/overview.",
    ].join("\n"),
    generationResponse: [
      "---FILE: wiki/catalytic-systems/h-zsm-5-mfi-mto.md---",
      "---",
      "type: catalytic_system",
      "title: H-ZSM-5 Methanol-to-Olefins System",
      "created: 2026-05-31",
      "updated: 2026-05-31",
      "tags: [zeolite, mto, mfi]",
      "related: [surface-methoxy-formation, dual-cycle-mto, isotope-labeling-retained-hydrocarbons]",
      'sources: ["zeolite-mto-smoke-paper.md"]',
      "system_type: zeolite_catalyst_system",
      "role: catalyst_system",
      "catalyst_material: H-ZSM-5",
      "active_site_type: Bronsted_acid_site",
      "reaction_conditions: methanol_to_olefins_short_vs_long_contact_time",
      "---",
      "",
      "# H-ZSM-5 Methanol-to-Olefins System",
      "",
      "This catalytic system describes methanol conversion over H-ZSM-5 with Bronsted acid sites in MFI straight channels.",
      "It provides the system context for [[surface-methoxy-formation]] and the [[dual-cycle-mto]] interpretation.",
      "---END FILE---",
      "",
      "---FILE: wiki/elementary-processes/surface-methoxy-formation.md---",
      "---",
      "type: elementary_process",
      "title: Surface Methoxy Formation",
      "created: 2026-05-31",
      "updated: 2026-05-31",
      "tags: [methoxy, dehydration]",
      "related: [h-zsm-5-mfi-mto, dual-cycle-mto]",
      'sources: ["zeolite-mto-smoke-paper.md"]',
      "process_type: methanol_dehydration",
      "participants: [methanol, surface_methoxy_species, bronsted_acid_site]",
      "location_context: mfi_straight_channel",
      "process_scope: chemical_step",
      "role_in_mechanism: initiation_step",
      "---",
      "",
      "# Surface Methoxy Formation",
      "",
      "Methanol dehydration on Bronsted acid sites forms surface methoxy species in the [[h-zsm-5-mfi-mto]] system.",
      "The process is treated as an initiation step in [[dual-cycle-mto]].",
      "---END FILE---",
      "",
      "---FILE: wiki/mechanistic-networks/dual-cycle-mto.md---",
      "---",
      "type: mechanistic_network",
      "title: Dual-Cycle MTO Network",
      "created: 2026-05-31",
      "updated: 2026-05-31",
      "tags: [mechanism, olefin-cycle, aromatic-cycle]",
      "related: [h-zsm-5-mfi-mto, surface-methoxy-formation, isotope-labeling-retained-hydrocarbons]",
      'sources: ["zeolite-mto-smoke-paper.md"]',
      "mechanism_type: dual_cycle_mechanism",
      "network_nodes: [surface_methoxy_species, olefin_cycle, aromatic_cycle]",
      "network_edges: [surface_methoxy_formation, methylation, cycle_competition]",
      "competing_pathways: [olefin_cycle, aromatic_cycle]",
      "control_step: methylation_in_straight_channels",
      "---",
      "",
      "# Dual-Cycle MTO Network",
      "",
      "The mechanism links [[surface-methoxy-formation]] to competing olefin and aromatic cycles in [[h-zsm-5-mfi-mto]].",
      "Short contact times favor the olefin cycle, while longer times increase aromatic-cycle contributions.",
      "---END FILE---",
      "",
      "---FILE: wiki/evidence-claims/isotope-labeling-retained-hydrocarbons.md---",
      "---",
      "type: evidence_claim",
      "title: Isotope Labeling Supports Retained Hydrocarbon Participation",
      "created: 2026-05-31",
      "updated: 2026-05-31",
      "tags: [evidence, isotope-labeling, dft]",
      "related: [dual-cycle-mto, h-zsm-5-mfi-mto]",
      'sources: ["zeolite-mto-smoke-paper.md"]',
      "claim: retained_hydrocarbon_species_contribute_to_light_olefin_formation",
      "evidence_type: isotope_labeling",
      "relation_type: supports",
      "target_layer: mechanistic_network",
      "target_page: dual-cycle-mto",
      "evidence_summary: isotope_labeling_and_dft_support_retained_hydrocarbon_participation",
      "---",
      "",
      "# Isotope Labeling Supports Retained Hydrocarbon Participation",
      "",
      "13C isotope labeling supports the claim that retained hydrocarbon species participate in [[dual-cycle-mto]].",
      "The paper also reports DFT evidence that methylation barriers are lower in MFI straight channels of [[h-zsm-5-mfi-mto]].",
      "---END FILE---",
      "",
      "---FILE: wiki/sources/zeolite-mto-smoke-paper.md---",
      "---",
      "type: source",
      "title: \"Source: zeolite-mto-smoke-paper.md\"",
      "created: 2026-05-31",
      "updated: 2026-05-31",
      "tags: [source, zeolite]",
      "related: [h-zsm-5-mfi-mto, surface-methoxy-formation, dual-cycle-mto, isotope-labeling-retained-hydrocarbons]",
      'sources: ["zeolite-mto-smoke-paper.md"]',
      "---",
      "",
      "# Source: zeolite-mto-smoke-paper.md",
      "",
      "Smoke-test summary for a chemical paper covering [[h-zsm-5-mfi-mto]], [[surface-methoxy-formation]], and [[dual-cycle-mto]].",
      "---END FILE---",
      "",
      "---FILE: wiki/index.md---",
      "# Index",
      "",
      "## Sources",
      "- [[zeolite-mto-smoke-paper]]",
      "",
      "## Catalytic Systems",
      "- [[h-zsm-5-mfi-mto]]",
      "",
      "## Elementary Processes",
      "- [[surface-methoxy-formation]]",
      "",
      "## Mechanistic Networks",
      "- [[dual-cycle-mto]]",
      "",
      "## Evidence Claims",
      "- [[isotope-labeling-retained-hydrocarbons]]",
      "---END FILE---",
      "",
      "---FILE: wiki/log.md---",
      "## [2026-05-31] ingest | zeolite-mto-smoke-paper.md",
      "",
      "- Added chemical smoke-test pages for H-ZSM-5 methanol-to-olefins.",
      "---END FILE---",
      "",
      "---FILE: wiki/overview.md---",
      "# Overview",
      "",
      "This wiki tracks catalytic chemistry papers and their linked system, process, mechanism, and evidence pages.",
      "It now includes a methanol-to-olefins smoke-test source centered on H-ZSM-5, surface methoxy formation, a dual-cycle mechanism, and supporting isotope-labeling evidence.",
      "---END FILE---",
    ].join("\n"),
    expected: {
      writtenPaths: [
        "wiki/catalytic-systems/h-zsm-5-mfi-mto.md",
        "wiki/elementary-processes/surface-methoxy-formation.md",
        "wiki/mechanistic-networks/dual-cycle-mto.md",
        "wiki/evidence-claims/isotope-labeling-retained-hydrocarbons.md",
        "wiki/sources/zeolite-mto-smoke-paper.md",
        "wiki/index.md",
        "wiki/log.md",
        "wiki/overview.md",
      ],
      fileContains: {
        "wiki/catalytic-systems/h-zsm-5-mfi-mto.md": [
          "type: catalytic_system",
          "system_type: zeolite_catalyst_system",
          "[[surface-methoxy-formation]]",
        ],
        "wiki/elementary-processes/surface-methoxy-formation.md": [
          "type: elementary_process",
          "process_scope: chemical_step",
          "[[dual-cycle-mto]]",
        ],
        "wiki/mechanistic-networks/dual-cycle-mto.md": [
          "type: mechanistic_network",
          "network_nodes: [surface_methoxy_species, olefin_cycle, aromatic_cycle]",
          "olefin cycle",
        ],
        "wiki/evidence-claims/isotope-labeling-retained-hydrocarbons.md": [
          "type: evidence_claim",
          "relation_type: supports",
          "13C isotope labeling",
        ],
        "wiki/sources/zeolite-mto-smoke-paper.md": [
          'sources: ["zeolite-mto-smoke-paper.md"]',
          "[[h-zsm-5-mfi-mto]]",
        ],
      },
      reviewsCreated: [],
    },
  },
]
