# Category Registry Design

Last updated: 2026-05-31

## Scope

This document is the phase 2 design artifact for `llm_wiki_chemical`.

It defines a minimal category-registry design that:

- preserves the original `llm_wiki` category behavior as the compatibility baseline
- introduces chemical categories through a registry and profile layer
- stays incremental and implementation-ready for phase 3
- does not require a large rewrite

This phase is documentation only. No runtime files are changed here.

## Relevant Existing Code Path

The current category system is distributed across four places:

### 1. Category definition

- `src/lib/templates.ts`
  Defines the base schema table, frontmatter `type` list, index guidance, and generic entity/concept/source language.
- `src-tauri/src/commands/project.rs`
  Creates the default project directories `wiki/entities`, `wiki/concepts`, `wiki/sources`, `wiki/queries`, `wiki/comparisons`, and `wiki/synthesis`, and writes the default `schema.md`.
- `src/lib/wiki-page-types.ts`
  Hardcodes runtime known types and directory-to-type inference.

### 2. Prompt routing

- `src/lib/ingest.ts`
  `buildAnalysisPrompt()` still uses `## Key Entities` and `## Key Concepts`.
- `src/lib/ingest.ts`
  `buildGenerationPrompt()` already allows schema-defined directories, but still falls back explicitly to `wiki/entities/` and `wiki/concepts/`.

### 3. Storage routing

- `src/lib/ingest.ts`
  `writeFileBlocks()` writes generated files under the paths produced by the prompt.
- `src/lib/ingest.ts`
  Source summary fallback still assumes `wiki/sources/<slug>.md`.
- `src/lib/wiki-page-resolver.ts` and `src/lib/wiki-page-delete.ts`
  Still contain explicit `wiki/sources/` assumptions for source-summary behavior.

### 4. Frontend type rendering

- `src/lib/wiki-type-style.ts`
  Hardcodes chip labels, icons, and colors by type.
- `src/components/layout/knowledge-tree.tsx`
  Hardcodes group labels, ordering, and initial expanded types.
- `src/components/graph/graph-view.tsx`
  Hardcodes node colors and translated labels by type.

## Design Goal

Introduce one authoritative registry model so later phases can stop duplicating category metadata across:

- schema text
- prompt wording
- directory routing
- type inference
- UI labels and colors

The design must preserve the original project behavior unless a project explicitly opts into chemical category behavior.

## Non-Goals

This design does not:

- delete `entity`, `concept`, or `source`
- require immediate migration of existing projects
- require Rust and TypeScript to become fully dynamic in the same phase
- redesign delete, resolver, or embedding logic in this document

## Proposed Registry Structure

Use two layers:

1. `CategoryDefinition`
2. `CategoryProfile`

This keeps the system small:

- the definition describes what a category is
- the profile describes which categories are active for a project and how strongly they should be used

## Proposed Data Model

### `CategoryDefinition`

Each category should have a single canonical record with at least the following fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable canonical identifier used in code and frontmatter, for example `entity` or `catalytic_system`. |
| `display_label` | Singular display label, for example `Entity` or `Catalytic System`. |
| `display_label_plural` | Group label for tree sections and headings. |
| `directory` | Canonical storage directory under `wiki/`. |
| `legacy_aliases` | Optional aliases for backward compatibility in path inference or schema migration. |
| `kind` | One of `legacy_core`, `chemical_core`, or `auxiliary`. |
| `ontology_layer` | One of `none`, `catalytic_system`, `elementary_process`, `mechanistic_network`, `evidence_claim`, or `provenance`. |
| `prompt_role` | Short routing role such as `named_thing`, `abstract_concept`, `provenance`, `system`, `process`, `mechanism`, `evidence`, or `auxiliary`. |
| `default_enabled_in_legacy` | Whether the category is active in the baseline original profile. |
| `default_enabled_in_chemical` | Whether the category is active in the chemical profile. |
| `compatibility_status` | One of `primary`, `supported`, or `compatibility_only`. |
| `ui_order` | Stable ordering value for knowledge tree and filters. |
| `style_key` | Key used by UI style maps. In phase 3 this can equal `id`. |

### `CategoryProfile`

Each project mode should resolve to a profile with at least:

| Field | Purpose |
| --- | --- |
| `id` | Stable profile id, for example `legacy-default` or `chemical-default`. |
| `label` | Human-readable profile label. |
| `active_category_ids` | Ordered list of categories active for this profile. |
| `primary_extraction_ids` | Categories the ingest prompts should emphasize first. |
| `primary_display_ids` | Categories that should appear first in the tree and graph legends. |
| `fallback_generation_ids` | Compatibility fallback categories used when schema routing is missing or ambiguous. |
| `source_summary_category_id` | Category id for source-summary pages. Initially this stays `source`. |
| `preserve_legacy_routes` | Boolean guard for keeping `wiki/entities`, `wiki/concepts`, and `wiki/sources` valid even in chemical mode. |

## Canonical Category Catalog

The registry should define the following categories in phase 3.

### Compatibility baseline categories

| Id | Label | Directory | Kind | Ontology Layer | Status in chemical profile |
| --- | --- | --- | --- | --- | --- |
| `entity` | Entity | `wiki/entities/` | `legacy_core` | `none` | `compatibility_only` |
| `concept` | Concept | `wiki/concepts/` | `legacy_core` | `none` | `compatibility_only` |
| `source` | Source | `wiki/sources/` | `legacy_core` | `provenance` | `primary` |

### Chemical core categories

| Id | Label | Directory | Kind | Ontology Layer | Compatibility note |
| --- | --- | --- | --- | --- | --- |
| `catalytic_system` | Catalytic System | `wiki/catalytic-systems/` | `chemical_core` | `catalytic_system` | Chemical replacement target for many legacy `entity` and some `concept` pages. |
| `elementary_process` | Elementary Process | `wiki/elementary-processes/` | `chemical_core` | `elementary_process` | Chemical replacement target for process-like legacy `entity` or concrete `concept` pages. |
| `mechanistic_network` | Mechanistic Network | `wiki/mechanistic-networks/` | `chemical_core` | `mechanistic_network` | Chemical replacement target for pathway or mechanism claims. |
| `evidence_claim` | Evidence Claim | `wiki/evidence-claims/` | `chemical_core` | `evidence_claim` | Claim-centered evidence category; depends on `source` for provenance. |

### Existing auxiliary categories

| Id | Label | Directory | Kind | Ontology Layer |
| --- | --- | --- | --- | --- |
| `overview` | Overview | `wiki/` | `auxiliary` | `none` |
| `query` | Query | `wiki/queries/` | `auxiliary` | `none` |
| `comparison` | Comparison | `wiki/comparisons/` | `auxiliary` | `none` |
| `synthesis` | Synthesis | `wiki/synthesis/` | `auxiliary` | `none` |
| `finding` | Finding | `wiki/findings/` | `auxiliary` | `none` |
| `thesis` | Thesis | `wiki/thesis/` | `auxiliary` | `none` |
| `methodology` | Methodology | `wiki/methodology/` | `auxiliary` | `none` |

## Recommended Profiles

### Profile 1: `legacy-default`

Purpose:

- preserve current `llm_wiki` behavior
- remain the fallback when no chemical profile is selected

Recommended active categories:

- `overview`
- `source`
- `entity`
- `concept`
- `query`
- `comparison`
- `synthesis`
- `finding`
- `thesis`
- `methodology`

Recommended primary extraction categories:

- `source`
- `entity`
- `concept`

Recommended fallback generation categories:

- `entity`
- `concept`
- `source`

### Profile 2: `chemical-default`

Purpose:

- make chemical categories first-class without deleting the legacy categories
- preserve source-traceability behavior

Recommended active categories:

- `overview`
- `source`
- `catalytic_system`
- `elementary_process`
- `mechanistic_network`
- `evidence_claim`
- `query`
- `comparison`
- `synthesis`
- `finding`
- `thesis`
- `methodology`
- `entity`
- `concept`

Recommended primary extraction categories:

- `source`
- `catalytic_system`
- `elementary_process`
- `mechanistic_network`
- `evidence_claim`

Recommended fallback generation categories:

- `catalytic_system`
- `elementary_process`
- `mechanistic_network`
- `evidence_claim`
- `entity`
- `concept`

Recommended compatibility policy:

- `entity` and `concept` stay registered and valid
- `source` remains the source-summary and provenance category
- chemical categories are preferred for new routing, labeling, and prompting

## Directory and Routing Rules

### Canonical routing

Registry routing should be canonical by `id -> directory`.

Recommended directory mapping:

- `entity -> wiki/entities/`
- `concept -> wiki/concepts/`
- `source -> wiki/sources/`
- `catalytic_system -> wiki/catalytic-systems/`
- `elementary_process -> wiki/elementary-processes/`
- `mechanistic_network -> wiki/mechanistic-networks/`
- `evidence_claim -> wiki/evidence-claims/`

### Path inference

`inferWikiTypeFromPath()` should eventually read registry entries rather than a hardcoded list.

Recommended inference priority:

1. exact canonical directory match from the active profile
2. exact legacy compatibility directory match
3. existing special case for `overview.md`
4. fallback custom-directory inference for unknown future categories

### Source-summary behavior

For incremental safety, keep:

- source-summary pages under `wiki/sources/`
- source provenance semantics under `type: source`

in both `legacy-default` and `chemical-default`.

Reason:

- `src/lib/ingest.ts` fallback summary creation still assumes `source`
- `src/lib/wiki-page-resolver.ts` and `src/lib/wiki-page-delete.ts` contain source-summary-specific behavior
- preserving `source` avoids a larger migration in phase 3

## Compatibility Behavior

### Baseline rule

Original `llm_wiki` behavior remains the default baseline until a project opts into the chemical profile.

### Legacy categories remain valid

The registry must continue to recognize:

- `entity`
- `concept`
- `source`

even when the chemical profile is active.

### Chemical profile behavior

When a project uses `chemical-default`:

- prompt generation should prefer the four chemical categories
- UI grouping should show the chemical categories before `entity` and `concept`
- storage routing should accept chemical directories
- old `entity` and `concept` pages remain readable, editable, and renderable

### No destructive migration in phase 3

Do not:

- rename existing directories
- rewrite old frontmatter automatically
- move existing files on disk

Compatibility should be additive.

## Mapping to the Four-Layer Ontology

### Direct mapping

| Category Id | Ontology Layer | Meaning |
| --- | --- | --- |
| `catalytic_system` | `catalytic_system` | Species, catalyst, site, framework, environment, and conditions. |
| `elementary_process` | `elementary_process` | Elementary steps, transport events, deactivation steps, regeneration steps. |
| `mechanistic_network` | `mechanistic_network` | Pathways, cycles, competing routes, and network-level mechanism claims. |
| `evidence_claim` | `evidence_claim` | Claim-centered evidence and validation statements. |

### Compatibility interpretation for legacy categories

| Legacy Category | Chemical interpretation |
| --- | --- |
| `entity` | May map to any of the first three ontology layers depending on semantics; treat it as ambiguous compatibility data. |
| `concept` | May map to any of the first three ontology layers or remain abstract explanatory metadata; treat it as ambiguous compatibility data. |
| `source` | Maps to provenance and traceability, not one of the four chemical content layers. |

Recommended adapter rule for later phases:

- do not force a legacy page into a chemical layer without prompt or curation support
- do allow new chemical extraction output to target chemical categories directly

## How Later Phases Should Consume the Registry

### Phase 3: registry implementation

Implement one small authoritative TypeScript module, for example:

- `src/lib/category-registry.ts`

Phase 3 should centralize:

- category definitions
- the `legacy-default` profile
- the `chemical-default` profile
- helper lookups by id and directory

Phase 3 should then update these minimal consumers first:

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`

This gives immediate value without changing extraction yet.

### Phase 4: prompt adaptation

`src/lib/ingest.ts` should stop hardcoding `Key Entities` and `Key Concepts` as universal extraction headings.

Instead, prompt builders should read:

- `primary_extraction_ids`
- each category's `prompt_role`

Recommended behavior:

- `legacy-default` keeps the current generic framing
- `chemical-default` uses four-layer chemical framing
- generation continues to honor schema-defined folders when present

### Phase 5: storage adaptation

Storage-related code should use the registry for:

- directory inference
- type validation
- category ordering in index updates

Important limitation for minimal change:

- keep `source` routing unchanged first
- allow chemical directories to be created lazily when generated pages are written
- postpone any full project-bootstrap Rust refactor unless it is required

### Phase 6: frontend category UI

Frontend rendering should use registry metadata for:

- labels
- plural labels
- icon/style lookup key
- ordering
- graph legend labels

The immediate hardcoded consumers to replace are:

- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/lib/wiki-type-style.ts`

## Recommended Minimal Implementation Order

To keep later work reviewable, use this order:

1. Implement the registry and profiles in TypeScript.
2. Switch wiki type inference and UI labels/styles to the registry.
3. Adapt prompt routing to the active profile.
4. Allow chemical directories to participate in storage writes and index grouping.
5. Revisit project creation templates and optional chemical project bootstrap.

This order preserves the current baseline while adding one compatibility layer at a time.

## Migration Notes

### Existing projects

Existing projects should remain on `legacy-default` unless explicitly opted into chemical behavior.

### New chemical projects

A later phase may add a chemical template or explicit project setting that selects `chemical-default`.

Until that exists, the safest default is:

- registry present in code
- legacy profile as default
- chemical categories available but not forced

### Schema interaction

The current code already treats `schema.md` as authoritative for generation routing.

Recommended direction:

- keep the registry as the runtime authority for known categories
- let `schema.md` select or refine category usage
- do not make free-form `schema.md` text the only source of truth for UI metadata

In other words:

- registry = authoritative machine-readable metadata
- schema = project-facing expression of that metadata and local routing rules

## Open Risks

1. `source` remains a special category with stronger behavioral assumptions than the other categories.
2. `entity` and `concept` are semantically ambiguous, so compatibility mapping will remain lossy until prompt adaptation and curation improve.
3. The Rust project bootstrap currently creates only legacy directories, so chemical directories may initially need lazy creation during writes.
4. Multiple UI surfaces use separate hardcoded style maps today; missing one consumer in phase 3 or phase 6 could create inconsistent labels.
5. Existing delete and resolver paths may need follow-up review if later phases ever attempt to make non-`source` provenance summaries first-class.

## Phase 2 Output Summary

This design defines:

- a registry data model
- canonical ids and display labels
- directory routing rules
- compatibility behavior for `entity`, `concept`, and `source`
- mapping from chemical categories to the four-layer ontology
- a minimal consumption plan for phases 3 through 6
- migration notes and open risks

It is intentionally specific enough to guide implementation while keeping the next phase incremental.
