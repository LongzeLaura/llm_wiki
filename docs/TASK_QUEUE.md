# Task Queue

Last updated: 2026-06-01

## Done

- `Phase 0`: read-only repository analysis completed and captured in `docs/ARCHITECTURE_OVERVIEW.md`, `docs/EXTRACTION_PIPELINE_MAP.md`, and `docs/CATEGORY_SYSTEM_ANALYSIS.md`.
- `Phase 1`: chemical ontology design completed and captured in `docs/CHEMICAL_ONTOLOGY.md`.
- `Phase 2 - Category Registry Design`: completed and captured in `docs/CATEGORY_REGISTRY_DESIGN.md`.
- `Phase 3 - Category Registry Implementation`: completed with a runtime registry module, legacy and chemical profiles, registry-backed wiki type inference, and chemical style support.
- `Phase 4 - Extraction Prompt Adaptation`: completed with schema/profile-aware prompt routing in `src/lib/ingest.ts`, chemical four-layer extraction wording, and focused prompt compatibility tests.
- `Phase 5 - Backend Storage Adaptation`: completed with registered category type canonicalization on save/reload paths, merge-safe frontmatter normalization, and no markdown storage migration.
- `Phase 6 - Frontend Category UI`: completed with registry-backed tree grouping, graph colors and labels, chemical cited-reference badges, and activity-row type icons for chemical pages.
- `Phase 7 - Smoke Test Chemical Papers`: completed with a tracked chemical sample, a tracked ingest smoke fixture, and `docs/SMOKE_TEST_CHEMICAL.md`.
- `Phase 8 - Cleanup And Review`: completed with a small registry-backed chat reference lookup cleanup, status-document alignment, and explicit remaining-risk notes.
- `Phase 9 - Chemical Semantic Repair`: completed with a shared four-layer semantic field contract, stricter chemical prompt constraints, write-boundary chemical field normalization, a dedicated validator plus dry-run repair suggestions, and validator-backed semantic smoke coverage.
- `Automation Scaffold`: phase 2 to phase 8 execution framework created in `docs/`, `.codex/stages/`, and `scripts/run-codex-stages.ps1`.
- `Execution Draft Alignment`: repository-aligned semantic-repair execution draft added in `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md`, and outdated toolchain-blocked status text corrected in status documents.

## In Progress

- None at the moment.

## Pending

- `Post-phase-8 follow-up: bootstrap and maintenance review`
  Goal: inspect untouched legacy-first surfaces such as `src-tauri/src/commands/project.rs`, `src/components/review/review-view.tsx`, and dedup flows before any wider chemical-mode rollout.
- `Post-phase-8 follow-up: manual chemical UI verification`
  Goal: rerun the tracked chemical smoke path in the app UI and inspect richer chemical fields in the knowledge tree and graph after semantic repair work lands.

## Blocked

- None at the moment.

## Queue Rules

- Only move a task to `In Progress` when that specific stage starts running.
- Move a task to `Done` only after code or docs, tests or smoke checks, and status documents are all updated.
- Use `Blocked` only when progress truly requires human input or an external dependency.
