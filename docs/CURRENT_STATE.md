# Current State

## Project Status

- Post-v1 mode-switch closure is complete: the project now has a first-class `default` / `llmwikirpg` mode bootstrap layer in addition to the older heuristic detector.
- New projects can explicitly choose `llmwikirpg` mode from the create-project flow, and mode metadata is persisted in `.llm-wiki/project.json`.
- Runtime mode detection now prefers persisted project metadata and still falls back to explicit `wikiMode:` markers plus RPG-directory heuristics for compatibility.
- The manual ingest chat path now reads `schema.md` and `purpose.md` from the project root, matching the real project layout instead of probing nonexistent `wiki/schema.md` and `wiki/purpose.md`.
- New `llmwikirpg` projects now bootstrap RPG-oriented schema/index/overview/log files plus RPG directories, including auxiliary `style`, `rules`, `quests`, and `memory` folders.
- `docs/LLMWIKIRPG_MODE_SWITCH_ANALYSIS.md` and `docs/LLMWIKIRPG_MODE_SWITCH_REPORT.md` now document the diagnosis, minimum-closure changes, switch method, and remaining risks.
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` exists and defines stages 0 through 12.
- The current automation platform has been switched from opencode to Codex.
- Stage prompts are now located in `.codex/stages/`.
- The default stage runner is `scripts/run-codex-stages.ps1`.
- If `.opencode/stages/` exists, it is retained as historical reference only and is no longer the default execution directory.
- Stage 00 baseline confirmation was previously executed manually from the legacy `.opencode/stages/00-baseline-confirmation.md`.
- Stage 01 category system analysis was previously executed manually from the legacy `.opencode/stages/01-category-system-analysis.md`.
- Stage 02 RPG category mapping was previously executed manually from the legacy `.opencode/stages/02-rpg-category-mapping.md`.
- Stage 03 RPG category registry was previously executed manually from the legacy `.opencode/stages/03-rpg-category-registry.md`.
- Stage 04 RPG wiki schema config was previously executed manually from the legacy `.opencode/stages/04-rpg-wiki-schema-config.md`.
- Stage 05 RPG extraction prompt was previously executed manually from the legacy `.opencode/stages/05-rpg-extraction-prompt.md`.
- Stage 06 RPG backend storage was previously executed manually from the legacy `.opencode/stages/06-rpg-backend-storage.md`.
- Core design documents are present and readable: `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, and `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`.
- The architecture document's named core code files were found in the current tree, including project creation, ingest, chat, search, filesystem, template, graph relevance, context budget, and project mutex modules.
- Business logic migration has started in the minimal Stage 03 through Stage 06 scopes by adding an RPG category registry, type-recognition integration, code-readable RPG wiki schema config, RPG-aware extraction prompt guidance, and RPG storage update strategies.
- Frontend logic was intentionally left unchanged in Stage 00 through Stage 07 while registry, schema, prompt, storage, and dynamic update behavior were introduced first.
- Stage 01 produced `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, locating legacy category definition, prompt, parsing, writing, frontend display, search, graph, and query-save entry points.
- Stage 02 produced `docs/RPG_CATEGORY_MAPPING.md`, mapping legacy categories to the first-version RPG category model and defining the first-version boundary for `style`, `rules`, and `runtime`.
- Stage 03 added `src/lib/rpg-categories.ts` with first-version RPG category metadata and connected it to `src/lib/wiki-page-types.ts` so RPG directories are recognized as wiki types.
- Stage 04 added `src/lib/rpg-wiki-schema.ts` with code-readable extraction goals, field definitions, exclusions, update strategies, and granularity for the 11 first-version RPG categories. The schema derives labels and paths from the Stage 03 registry to avoid duplicate category metadata.
- Stage 05 updated `src/lib/ingest.ts` prompt construction so analysis prompts call out RPG semantic distinctions and generation prompts inject the Stage 04 RPG schema directory guidance plus dynamic-state rules.
- Stage 06 updated `src/lib/ingest.ts` write handling so RPG schema directories use explicit storage strategies: `current-scene` is normalized to `wiki/current-scene/scene_state.md` and overwritten, `events` and `sources` append, and merge/cautious-merge RPG directories continue through existing page merge behavior.
- Stage 07 added `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md` and tightened dynamic RPG update behavior at the writer boundary: `events` now reject obvious future-planning sections, and merge-based `player`, `characters`, `relationships`, and `plot-arcs` updates strip stale dynamic sections from the existing page before merge so current state is replaced instead of silently lingering.
- Stage 08 updated the frontend knowledge tree, type styling, chat retrieval, and chat reference navigation so first-version RPG directories are visible as first-class UI groups, RPG page chips/icons are styled explicitly, and chat queries now prioritize live RPG context pages such as `current-scene`, `player`, `events`, and `plot-arcs` when those directories exist.
- Stage 09 added `src/lib/wiki-mode.ts` as a minimal compatibility layer. Ingest prompts and chat retrieval now enable RPG-first behavior only when the project is explicitly marked or inferably RPG-shaped, so legacy/default projects keep their prior entity/concept/query behavior unless they opt into RPG mode.
- Stage 10 added `src/lib/rpg-smoke.test.ts` and `docs/RPG_SMOKE_TEST_REPORT.md`, using a mocked-LLM but real-filesystem smoke scenario to verify that sample RPG material is routed into the first-version RPG directories, `current-scene` snapshots overwrite correctly, `events` append correctly, and frontend-side RPG mode/type helpers recognize the resulting pages.
- Stage 11 added `docs/RPG_EXTRACTION_EVALUATION.md` and performed a bounded extraction-quality review against the Stage 10 smoke artifacts. The stage documented that Stage 10 validates routing/storage semantics rather than real-model extraction quality, then applied the minimal prompt/schema fix directly supported by the smoke output: first-version `current-scene` generation now explicitly requires the canonical file `wiki/current-scene/scene_state.md` instead of leaving alternate filenames ambiguous.
- Stage 12 added `docs/LLMWIKIRPG_USAGE.md` and `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md`, consolidating first-version naming, usage guidance, capability boundaries, and post-v1 iteration directions without changing production code.
- `.codex/stages/00` through `.codex/stages/12` now exist as the default Codex stage prompts for future execution.
- `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -DryRun` has been validated successfully and lists stages 00 through 12 without executing any stage.
- The Stage 00 through Stage 12 migration plan is now complete at v1 scope, and the documentation handoff is sufficient for a later fresh-stage continuation without depending on prior chat context.

## Current Stage

- Stage 12 complete: cleanup review.
- The current 00 through 12 phase plan has no remaining executable stage.

## Completed Stages

- Codex automation scaffold created and synchronized with current documentation.
- Stage 00: Baseline confirmation.
- Stage 01: Category system analysis.
- Stage 02: RPG category mapping.
- Stage 03: RPG category registry.
- Stage 04: RPG wiki schema config.
- Stage 05: RPG extraction prompt.
- Stage 06: RPG backend storage.
- Stage 07: RPG dynamic update.
- Stage 08: RPG frontend UI.
- Stage 09: Legacy compatibility.
- Stage 10: RPG smoke test.
- Stage 11: RPG extraction evaluation.
- Stage 12: Cleanup review.

## Incomplete Stages

- None within the current Stage 00 through Stage 12 plan.

## Known Risks

- Rust backend project creation still boots a legacy skeleton first; the frontend `llmwikirpg` bootstrap then overwrites the mode-sensitive files and adds RPG directories. This is intentionally minimal, but a future deeper cleanup could move mode bootstrap into a shared backend layer.
- Auxiliary `style`, `rules`, `quests`, and `memory` folders are now created for `llmwikirpg` projects, but the first-version extraction registry and storage semantics still formally cover the 11 core RPG categories only.
- Existing projects that do not explicitly set `.llm-wiki/project.json` `mode` still depend on the compatibility fallback (`wikiMode:` markers or directory-shape heuristics) until they are updated.
- The previous opencode-based automated runner reached the subprocess but timed out after 120 seconds during an earlier Stage 00 attempt; the Codex runner is now active, its dry-run path has been validated, and Stage 07 has been executed successfully through `scripts/run-codex-stages.ps1`.
- Actual code structure may differ from the phase plan; stage agents must record differences before changing code.
- The current codebase still contains legacy `entities`, `concepts`, and `sources` assumptions in project creation, page typing, tests, source/reference helpers, and backend search/project tests.
- Stage 02 resolved the first-version mapping boundary: the 11 core directories from `AGENTS.md` and the phase plan are the v1 category targets; `style`, `rules`, and `runtime` remain later schema/runtime extensions, with stable rule-like content allowed under `world` until a dedicated `rules` category is introduced.
- Legacy `entities`, `concepts`, and `sources` behavior must not be deleted during RPG migration.
- Dynamic RPG state requires careful separation of `current-scene`, `events`, `player`, `characters`, and `relationships`.
- Stage 01 found no single category registry. Category assumptions are distributed across `src-tauri/src/commands/project.rs`, `src/lib/templates.ts`, `src/lib/wiki-page-types.ts`, `src/lib/ingest.ts`, `src/components/layout/knowledge-tree.tsx`, `src/lib/wiki-type-style.ts`, `src/components/chat/chat-panel.tsx`, `src/components/chat/chat-message.tsx`, `src/lib/graph-relevance.ts`, and tests.
- Stage 01 found that `queries` is also a major legacy category and save target, although the Stage 01 keyword list emphasized `entities`, `concepts`, `sources`, `comparisons`, `synthesis`, `findings`, `methodology`, and `thesis`.
- Stage 02 maps `queries` as a preserved legacy/default saved-answer behavior with no first-version RPG replacement.
- Stage 03 intentionally kept legacy `source` type inference for `wiki/sources/` even though the RPG registry contains a `sources` category. This preserves existing source-summary behavior and avoids changing source lifecycle assumptions in that stage.
- Stage 04 intentionally did not add `style`, `rules`, or `runtime` as first-version schema entries because Stage 02 scoped them as deferred or auxiliary areas outside the 11 core RPG categories.
- Stage 05 consumes the RPG schema config in prompt construction, but does not change project directory creation or frontend behavior.
- Stage 07 covers first-pass dynamic reconciliation at the writer boundary, but it is still intentionally minimal: future-planning detection for `events` is heading-based, dynamic-section cleanup depends on recognizable page headings, and no deeper contradiction engine or runtime context compiler exists yet.
- Project skeleton/template directory creation is still legacy-oriented; RPG directories are created lazily by the existing file writer when pages are emitted.
- Search still scans all `wiki/**/*.md`; Stage 08 added a first-pass frontend retrieval priority for `current-scene`, `player`, `events`, and `plot-arcs`, but deeper RPG runtime context assembly and any future `rules` or `style` retrieval policy are still not implemented.
- Stage 09 intentionally uses a lightweight compatibility heuristic plus optional `wikiMode` text markers in `schema.md`/`purpose.md` rather than a persisted project setting or UI toggle. Mixed-mode/custom projects that reuse RPG directory names without being RPG-oriented still depend on that heuristic until a later stage adds a first-class mode setting.
- Stage 10 smoke coverage is intentionally deterministic and mocked at the LLM boundary. Stage 11 documented this limitation explicitly; real-model extraction quality, misclassification rates, field completeness, and browser-level UI behavior are still not proven by the current automated coverage.
- Stage 11 fixed the one smoke-backed prompt/schema ambiguity around `current-scene` filename selection, but it did not add a real-model evaluation harness or broader semantic grading system.
- `docs/ROADMAP.md` still contains a simplified stage-status table with stale `Pending` markers for later stages; within the current allowed Stage 12 scope, the authoritative completion record is `docs/CURRENT_STATE.md` plus `docs/IMPLEMENTATION_LOG.md`.

## Last Executed Stage

- Stage 12: Cleanup review.

## Next Stage Recommendation

- There is no remaining stage in the current Stage 00 through Stage 12 plan.
- Use `docs/LLMWIKIRPG_USAGE.md` as the first-version operating guide for RPG-mode projects.
- Use `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md` as the handoff summary before defining any new post-v1 phase plan.
