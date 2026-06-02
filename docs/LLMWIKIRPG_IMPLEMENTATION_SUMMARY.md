# llmWikiRPG Implementation Summary

## Status

The Stage 00 through Stage 12 migration plan is complete at first-version scope.

This repository now contains a bounded llmWikiRPG adaptation of the original `llm_wiki` flow. The implementation is intentionally incremental: it extends category recognition, schema guidance, prompt construction, storage behavior, frontend grouping, and compatibility gates without deleting the legacy knowledge-base path.

## What Is Complete In V1

- RPG category registry for the 11 first-version directories.
- Code-readable RPG schema configuration aligned with those directories.
- RPG-aware ingest prompt guidance and directory-routing rules.
- Writer-side storage behavior for overwrite, append, and merge-oriented RPG categories.
- First-pass dynamic update protection for `current-scene`, `events`, `player`, `characters`, `relationships`, and `plot-arcs`.
- Frontend tree grouping, type styling, and RPG-aware chat retrieval priority.
- Lightweight `wikiMode` compatibility gate so default projects keep legacy behavior.
- Deterministic smoke coverage for RPG routing and the most important live-state storage semantics.
- A bounded extraction-quality review with one evidence-backed prompt/schema refinement for canonical `current-scene` output.
- First-version usage and handoff documentation suitable for future isolated stage execution.

## V1 Capability Boundary

The current version can take RPG-oriented source material, route it into the intended RPG wiki directories, preserve key dynamic-state update distinctions, and surface those pages through the existing query and browsing chain.

It does not yet attempt to be a full RPG runtime engine or a fully validated autonomous narrative state manager.

## What Is Intentionally Not Complete

- No first-class persisted project setting or UI toggle for `wikiMode`.
- No project-template/bootstrap flow that pre-creates the RPG directory structure.
- No real-model extraction evaluation harness or quantitative grading loop.
- No browser-level/manual UI validation recorded in the migration docs.
- No first-class implementation for `style`, `rules`, or `runtime` as active production category targets.
- No deeper contradiction engine, causal consistency checker, or multi-page runtime context compiler.
- No stronger semantic resolver for difficult boundaries such as `player` versus `characters` or `events` versus `plot-arcs`.

## Documentation Notes

- `docs/CURRENT_STATE.md` and `docs/IMPLEMENTATION_LOG.md` are the authoritative handoff records between stages.
- `docs/ROADMAP.md` still contains a simplified status table with stale `Pending` markers for later stages. That inconsistency was recorded during Stage 12 rather than edited, because the stage scope only allowed README/usage/summary/state/log updates.

## Recommended Next Phase

If a new phase plan is created after v1, the highest-value next steps are:

1. Add a first-class persisted RPG/default mode setting and reduce heuristic mode detection.
2. Run a real-model extraction evaluation on representative RPG corpora and document concrete misroutes or missing-field patterns.
3. Add project-template support for RPG directory creation and starter docs.
4. Decide whether `style`, `rules`, and `runtime` should remain documentation-only or become implemented retrieval/runtime surfaces.
5. Strengthen dynamic-state reconciliation beyond the current heading-based and writer-boundary safeguards.
