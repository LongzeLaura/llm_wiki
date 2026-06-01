# Current State

Last updated: 2026-06-01

## Summary

`llm_wiki_chemical` has completed phase 9 chemical semantic repair work on top of the existing phase 0 through phase 8 baseline.

The phase 9 pass added a shared four-layer chemical semantic field contract, tighter chemical prompt constraints, write-boundary placeholder normalization for chemical pages, a dedicated validator with dry-run repair suggestions, and stronger smoke coverage that validates semantic completeness instead of category routing alone.

As of 2026-06-01, runnable local validation is no longer blocked by missing Node tool binaries. The current practical caveat is narrower: direct `npm` calls from PowerShell still hit the local `npm.ps1` execution-policy restriction, so repository validation commands should be run via `cmd /c npm ...` or `npm.cmd ...`.

The repository now has:

- the original phase 0 analysis documents
- the phase 1 chemical ontology baseline
- the phase 2 category registry design artifact
- the phase 3 runtime category registry implementation
- the phase 4 prompt-profile adaptation
- the phase 5 storage-path and frontmatter-type normalization layer
- the phase 6 registry-aware frontend category presentation updates
- the phase 7 chemical smoke-test fixture, sample input, and reproducible report
- the phase 8 chat-reference lookup cleanup and review summary
- the phase 9 chemical semantic contract, validator, dry-run repair report path, and semantic smoke coverage
- the automation scaffold for later phases

Phase 5 kept markdown files as the default store, preserved the existing FILE/REVIEW contract and source-summary behavior, and made the save/reload path normalize registered chemical category types without forcing a repository migration.

## Completed Work

### Phase 0: Read-only analysis

Completed reference documents:

- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/EXTRACTION_PIPELINE_MAP.md`
- `docs/CATEGORY_SYSTEM_ANALYSIS.md`

### Phase 1: Chemical design baseline

Completed reference document:

- `docs/CHEMICAL_ONTOLOGY.md`

### Phase 2: Category registry design

Completed reference document:

- `docs/CATEGORY_REGISTRY_DESIGN.md`

### Phase 3: Category registry implementation

Completed runtime and support artifacts:

- `src/lib/category-registry.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`
- `src/lib/category-registry.test.ts`
- `docs/CATEGORY_REGISTRY_USAGE.md`

### Phase 4: Extraction prompt adaptation

Completed runtime and support artifacts:

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`

### Phase 5: Backend storage adaptation

Completed runtime and support artifacts:

- `src/lib/category-registry.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/sources-merge.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest.ts`
- `src/lib/category-registry.test.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/sources-merge.test.ts`

### Phase 6: Frontend category UI

Completed runtime and support artifacts:

- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`
- `src/lib/wiki-type-style.test.ts`

### Phase 7: Chemical smoke-test record

Completed smoke-test artifacts:

- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `docs/samples/zeolite-mto-smoke-paper.md`
- `docs/SMOKE_TEST_CHEMICAL.md`

### Phase 8: Cleanup and review

Completed cleanup and review artifacts:

- `src/components/chat/chat-message.tsx`
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`

### Phase 9: Chemical semantic repair

Completed runtime, script, and support artifacts:

- `src/lib/chemical-semantic-contract.json`
- `src/lib/chemical-semantic-contract.ts`
- `src/lib/chemical-semantic-contract.test.ts`
- `src/lib/chemical-semantic-validator.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `scripts/chemical-semantic-validator.mjs`

### Automation scaffold for phase 2+

Completed framework artifacts:

- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `.codex/stages/02-category-registry-design.md`
- `.codex/stages/03-category-registry-implementation.md`
- `.codex/stages/04-extraction-prompt-adaptation.md`
- `.codex/stages/05-backend-storage-adaptation.md`
- `.codex/stages/06-frontend-category-ui.md`
- `.codex/stages/07-smoke-test-chemical-papers.md`
- `.codex/stages/08-cleanup-and-review.md`
- `scripts/run-codex-stages.ps1`
- `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md`

## Current Technical Baseline

The current baseline from phase 0 and phase 1 is:

- the runtime now has an explicit registry for category metadata and profile definitions
- legacy behavior still defaults to `entity`, `concept`, and `source`
- the project should preserve original `llm_wiki` behavior while adding chemical behavior through configuration, adapters, or registry layers
- the four-layer chemical ontology is the target semantic model for later phases:
  - `catalytic_system`
  - `elementary_process`
  - `mechanistic_network`
  - `evidence_claim`
- the category architecture is now a registry-plus-profile model:
  - `legacy-default` preserves current `entity` / `concept` / `source` behavior
  - `chemical-default` adds chemistry-native categories while keeping legacy compatibility

Implemented phase 3 behavior:

- `wiki-page-types.ts` now infers types from registry-defined legacy and chemical directories
- `wiki-page-types.ts` still exposes the legacy-first default generation type list for compatibility, while `ingest.ts` now overrides prompt wording and known types by resolved prompt profile
- `wiki-type-style.ts` now uses registry labels and provides chemical category chip styles
- chemical directories such as `wiki/catalytic-systems/` and `wiki/evidence-claims/` are runtime-recognized without requiring file migration

Implemented phase 4 behavior:

- `ingest.ts` now resolves a prompt profile from schema/registry cues and keeps legacy mode as the fallback
- stage 1 analysis prompts now switch between legacy `Key Entities` / `Key Concepts` framing and four-layer chemical ontology framing
- long-source chunk analysis prompts now use the same profile-aware framing
- stage 2 generation prompts now prefer chemical category wording and known types when the schema indicates chemical mode
- FILE/REVIEW parser expectations, source-summary path fallback, and downstream write behavior remain unchanged

Implemented phase 5 behavior:

- registered legacy and chemical category aliases now resolve to canonical ids during read-time metadata lookup
- ingest save paths now normalize registered `type:` values before writing, so pages stored under chemical folders persist canonical frontmatter types such as `catalytic_system` and `evidence_claim`
- the same normalization runs after page merges, which prevents older non-canonical registered types from persisting indefinitely once a page is rewritten
- custom schema-defined page types remain untouched, and markdown storage remains the authoritative store
- source summary routing stays anchored to `wiki/sources/` for compatibility and no global migration is performed

Implemented phase 6 behavior:

- knowledge-tree grouping now reads icon, plural label, accent color, and ordering from the registry-backed wiki type style layer instead of a local hardcoded type map
- chemical categories such as `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim` now expand by default alongside the legacy core groups in the knowledge tree
- graph node colors now use registry-backed style metadata for known legacy and chemical categories while preserving hashed fallback colors for custom unknown types
- graph type labels and legend/filter ordering now fall back to registry labels for chemical categories without removing existing translation-backed labels for legacy categories
- cited-reference badges in chat now inherit icons and accent colors from the shared wiki type style layer for chemical page types
- activity panel file rows now show registry-backed icons and labels for written chemical pages instead of degrading to generic file icons

Implemented phase 8 behavior:

- chat cited-reference lookup and rendered wiki-link existence checks now reuse a shared registry-backed candidate-path helper instead of repeating a legacy-only folder list
- chemical pages under registered directories such as `wiki/catalytic-systems/` and `wiki/evidence-claims/` can now be discovered from chat-side fallback lookups, not only from tree/graph views
- roadmap, current-state, and task-queue documents now agree on the staged phase 2 through phase 8 baseline and the narrower follow-up scope for phase 9+

Implemented phase 9 behavior:

- the repository now has one lightweight source of truth for minimum semantic field requirements for `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim`
- `ingest.ts` now uses that contract in two places:
  - chemical-mode prompts explicitly require the contract fields, anti-misclassification rules, and exact fallback placeholders such as `unknown`, `not_specified`, and `[]`
  - the write boundary now auto-fills missing contract fields only for registered chemical page types, leaving legacy pages unchanged
- the tracked chemical ingest scenario now includes concrete four-layer semantic fields such as `system_type`, `process_scope`, `network_nodes`, `network_edges`, `relation_type`, and `target_layer`
- the new validator script `scripts/chemical-semantic-validator.mjs` scans `wiki/`, identifies chemical pages by type or directory, writes a markdown report to `docs/chemical-semantic-validation-report.md`, and can add dry-run repair suggestions with `--dry-run-repair`
- smoke coverage now validates semantic completeness by running the dedicated validator against the tracked chemical scenario output instead of checking routing alone

## Main Files Likely To Matter Next

Based on the existing analysis documents and the completed phase 9 semantic repair pass, the next follow-up work will likely inspect:

- `src-tauri/src/commands/project.rs`
- `src/components/review/review-view.tsx`
- `src/lib/dedup.ts`
- `src/lib/dedup-runner.ts`
- `docs/SMOKE_TEST_CHEMICAL.md`
- representative chemistry project fixtures or sample source inputs

## What Has Not Happened Yet

- Rust project bootstrap still initializes only the legacy default wiki directories and schema text.
- A live manual UI verification of richer chemical semantic fields in the knowledge tree and graph has still not been run in this workspace.
- Some untouched legacy-first surfaces outside the phase 8 edit scope still remain, especially review-item routing and maintenance/dedup UX copy.

## Next Recommended Step

Use the completed phase 9 baseline to review the remaining untouched legacy-first surfaces before broader chemical-mode rollout.

The highest-value next steps are now:

- inspect `src-tauri/src/commands/project.rs` and related bootstrap flow so Rust-side project creation is no longer legacy-first
- review `src/components/review/review-view.tsx`, `src/lib/dedup.ts`, and `src/lib/dedup-runner.ts` for remaining legacy-only assumptions
- run a manual in-app chemical UI verification pass against the richer semantic fields now that validator-backed smoke coverage exists

## Guardrails For Next Stages

- Do not redo phase 0.
- Do not redo phase 1.
- Do not overwrite existing authoritative docs.
- Do not perform large rewrites unless explicitly requested.
- Do not delete original extraction categories unless explicitly requested.
- Prefer schema-driven or registry-driven design.
