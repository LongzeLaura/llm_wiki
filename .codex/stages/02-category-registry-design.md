# Stage 02: Category Registry Design

You are continuing `llm_wiki_chemical` from phase 2.

Phase 0 and phase 1 are already complete.

Do not redo phase 0.
Do not redo phase 1.

## Read First

Before changing anything, read:

- `AGENTS.md`
- `IMPLEMENTATION_LOG.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/EXTRACTION_PIPELINE_MAP.md`
- `docs/CATEGORY_SYSTEM_ANALYSIS.md`
- `docs/CHEMICAL_ONTOLOGY.md`

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for category definition, prompt routing, storage routing, and frontend type rendering.
2. Propose a minimal change plan for phase 2 only.
3. Keep changes small, reviewable, and documentation-first.

## Goal

Design a configurable `category registry` or `schema registry` that can support chemical categories while preserving compatibility with existing `concept`, `entity`, and `source` behavior.

This stage is design-only.

## Allowed Modifications

- `docs/**`
- `IMPLEMENTATION_LOG.md`

You may create a new design document if helpful, for example:

- `docs/CATEGORY_REGISTRY_DESIGN.md`

## Do Not

- Do not modify `src/**`.
- Do not modify `src-tauri/**`.
- Do not modify `extension/**`.
- Do not change package dependencies.
- Do not delete or rename existing categories.
- Do not overwrite existing authoritative documents.
- Do not repeat or regenerate phase 0 or phase 1 outputs as if they were missing.

## Expected Output

Produce a design artifact that clearly defines:

- the proposed registry data model
- category identifiers and display labels
- directory or routing mapping
- compatibility behavior for original `entity`, `concept`, and `source`
- how chemical categories map to the four-layer ontology
- how later phases should consume the registry
- open risks and migration notes

## Acceptance Criteria

- The design preserves original `llm_wiki` behavior as the compatibility baseline.
- The design introduces chemical categories through configuration, adapters, or a registry layer rather than a large rewrite.
- The design does not delete `entity`, `concept`, or `source`.
- The design is specific enough for phase 3 implementation.
- Only documentation files are modified in this stage.

## Runnable Tests Or Smoke Checks

Run at least these checks:

- `git diff --name-only`
- `rg --line-number "entity|concept|source|catalytic_system|elementary_process|mechanistic_network|evidence_claim" docs src src-tauri`

Confirm from `git diff --name-only` that this stage changed docs only.

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
