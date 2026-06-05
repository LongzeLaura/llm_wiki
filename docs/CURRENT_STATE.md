# Current State

## Project Status

- v0.2 push-preparation validation complete: `npm.cmd run typecheck` passes and `npm.cmd run test:mocks` passes with 95 test files / 1281 tests. Two Windows test-stability fixes were added for normalized source-summary path assertions and ingest-queue JSON reads during background processing writes.
- Documentation cleanup complete: historical stage plans, completed task docs, old reports, and refactor handoffs were moved from `docs/` into `docs/archive/`, with `docs/archive/README.md` documenting what remains active at the top level; `AGENTS.md` now points to the current final architecture / next-steps docs instead of archived stage plans.
- Added `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` in Chinese to record the recommended next architecture implementation path: start with read-only RPG Runtime Context Compiler v0, then add turn models, narration prompts, RPG play UI, state extraction/staging, runtime write policy, outline-impact detection/regeneration, and relationship/tension derivation.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` runtime diagram cleaned up further: `TurnRecord` now receives `SubmittedAction` plus narration output, the redundant non-persisted options edge was removed, and multi-pass compression is represented as an internal `Context Compiler` loop.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` runtime diagram simplified again: ambiguous direct edges from UI/action into state extraction were removed, and the diagram now shows a single runtime-orchestrated turn where UI submits player action, runtime compiles/compresses context, narration returns narrative plus options, and only the completed action+narrative turn record enters state extraction.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` turn-flow diagram and runtime-agent section revised: a play turn now centers on player action plus wiki context, multi-pass context compression into a compact story-generation brief, narration plus next-action options, writeback of only the completed action+narrative pair, explicit exclusion of unchosen options from wiki state, and plot-outline impact detection/regeneration for major divergences.
- Final architecture target clarified in `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`: llmWikiRPG should converge on a Markdown-backed RPG runtime with separate ingest, relationship/tension derivation, manual context, runtime context compilation, controlled dynamic writeback, and per-turn action options. This is a target architecture document, not a new executable stage plan.
- RPG Stage 1 object-type glossary pass complete: `src/lib/prompts/rpg-ingest.ts` now gives each allowed `object_type` a one-line schema-derived definition, with the former high-risk routing boundaries merged into the relevant glossary entries so `world_fact`, `location`, `faction`, `item`, dynamic-state types, and noise/merge types have lightweight semantic anchors before Stage 1 chooses `needed_categories`.
- Post-v0.2 current-scene marker gate hardening complete: Stage 1, Stage 2, writer validation, focused tests, and docs now require explicit `[RPG-LIVE]` source input before `wiki/current-scene/scene_state.md` can be generated or updated.
- RPG prompt source comment pass complete: `src/lib/prompts/rpg-page-guidance.ts` and `src/lib/prompts/rpg-ingest.ts` now have readable function comments plus Chinese translation comments immediately under English prompt strings, without changing emitted prompt text.
- RPG Stage 1 driven prompt trimming is complete: Stage 1 analysis now requires a structured `## Source Profile`, and RPG Stage 2 focused directory contracts are selected only from `needed_categories` in that profile.
- `src/lib/prompts/rpg-page-guidance.ts` no longer infers RPG focused categories from `schema.md`, `purpose.md`, `sourceFileName`, `sourceSummaryPath`, `object_type`, or `suggested_route`; missing/invalid Source Profile now leaves Stage 2 on the minimal RPG generation contract and asks for a REVIEW note.
- `autoIngest()` now passes the Stage 1 `analysis` into `buildGenerationPrompt()`, so RPG Stage 2 system prompt construction can trim schema/contract guidance from the actual Stage 1 Source Profile.
- Prompt-comment documentation pass complete: `src/lib/prompts/rpg-ingest.ts` now has Chinese inline comments inside `buildRpgGenerationPrompt()` explaining the source and role of each referenced prompt helper used to assemble the RPG Stage 2 generation prompt.
- RPG page-guidance comment pass complete: `src/lib/prompts/rpg-page-guidance.ts` now annotates the helper calls inside `buildFocusedRpgPageGuidance()`, `inferRpgGuidanceCategories()`, `buildRpgCategoryGuidance()`, and `categoryContract()` so the two-pass directory inference and focused contract expansion are easier to follow.
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
- A separate v0.2 task runner now exists at `scripts/run_rpg_v02_tasks.py` for post-v1 extraction-quality work driven by `docs/RPG_V0_2_TASKS.md`.
- The v0.2 task runner writes prompts, logs, summaries, and state under `.agent_runs/rpg_v02/`, supports dry-run/range/resume execution, and defaults to one fresh agent process per task.
- On Windows, the v0.2 task runner can now open a fresh Codex CLI window per task via `--agent-launch-mode new-window`, and `auto` selects that mode for Codex by default.
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
- Post-v1 automation documentation now includes `docs/RPG_V0_2_AUTOMATION.md` for running the v0.2 task list incrementally.
- A dedicated planning pass now exists at `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`; it audits the current `rpg-version` code and recommends keeping the current branch while performing an explicit RPG-only convergence refactor instead of returning to raw `llm_wiki` and starting over.
- The RPG-only refactor plan was strengthened from a general roadmap into a phase-locked execution document. Its earlier path/schema-driven Stage 2 guidance idea has since been superseded by the completed Source Profile-driven trimming pass.
- v0.2 task 1 is complete: `player/` and `characters/` now have an explicit hard boundary in `src/lib/rpg-wiki-schema.ts`, RPG analysis/generation prompts, `docs/RPG_WIKI_SCHEMA.md`, and focused regression tests.
- v0.2 task 2 is complete: RPG analysis/generation prompts now require object-type-first classification before directory routing, explicitly define the 13 candidate `object_type` values, require analysis output to surface ignored `wiki_noise` plus trait/trivia merged into character pages, and reinforce that clear or strongly implied places/organizations should still produce `locations/` or `factions/` entries without inventing filler pages.
- v0.2 task 3 is complete: `events/` is now explicitly restricted to discrete events in schema, prompt, and docs; route/storyline/timeline/complete-course candidates are redirected to `plot-arcs/` or must be split into multiple `events/` pages, and regression coverage now includes `Heaven's Feel 路线`, `樱被过继到间桐家`, and `柳洞寺决战`.
- v0.2 task 4 is complete: `current-scene/scene_state.md` is now limited to explicit live scene/session inputs in schema, prompt, and writer validation; static encyclopedia or ending-style material is rejected before write, and regression coverage now includes both the blocked `HF True End` flower-viewing case and the allowed explicit Fuyuki church-gate scene case.
- v0.2 task 5 is complete: RPG schema and prompts now restrict `concepts/` to reusable mechanism/terminology content, explicitly reject trope/tag/trivia noise such as `贫穷-萌点` or `电气白痴`, and direct that material into character-page roleplay sections instead; regression coverage now includes the required `concepts/` and `world/` counterexamples.
- v0.2 task 6 is complete: RPG analysis and generation prompts now require a secondary extraction pass for repeated or plot-relevant `locations/` and `factions/` after characters, events, and relationships are identified, including families, schools, churches, magical institutions, and hidden powers; sparse-but-core places or organizations may now be emitted as short source-limited stubs instead of being omitted.
- v0.2 task 7 is complete: the `characters/` schema now requires roleplay-ready sections for core role, personality/behavior, concrete speech style, capabilities and limits, behavior boundaries, multi-state snapshots, other-character interaction patterns, current-PC interaction rules, story hooks, and source/pending-confirmation notes; merge cleanup coverage now recognizes the new dynamic character headings.
- v0.2 task 8 is complete: `autoIngest` in `llmwikirpg` mode now runs a lightweight extraction-lint pass over generated FILE blocks before write, surfacing warnings plus review items for suspicious `player/` canon-character misroutes, `characters/` player-wording misuse without a current PC, route/timeline-like `events/`, static-source `current-scene/`, trope/tag-like `concepts/`, and obviously missing `locations/` or `factions/` when the source still contains likely candidates.
- v0.2 task 9 is complete: regression coverage now explicitly locks the v0.2 prompt/validation/scenario fixes together, including a consolidated generation-prompt guardrail test, canonical validation fixtures for suspicious `player/`, route-like `events/`, trope-like `concepts/`, and static-source `current-scene/`, plus a clean-routing scenario that produces `characters/`, `relationships/`, `locations/`, and `factions/` without stray `player/` or trope-concept pages.
- v0.2 task 10 is complete: documentation now explicitly separates what the v0.1 smoke path proved from what v0.2 actually fixes, adds `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md`, and records which extraction-quality problems are constrained by prompt/schema, which are only surfaced by lightweight validation, and which still require a later real-model evaluation pass.
- Post-v0.2 character-card extraction pass 1 is complete: `characters/` prompt/schema guidance now favors a roleplay-ready character-card contract centered on `Character Impression`, `Canon Facts`, `Reasonable Interpretation`, `Psychological Model`, `Behavior Rules`, `Dialogue Style`, `Relationship Dynamics`, `Route and Timeline Variants`, `RP Usage`, and `Evidence and Uncertainty`, while dynamic merge cleanup now preserves those long-term modeling sections instead of stripping them as transient state.
- Post-v0.2 character-card extraction prompt cleanup is complete: `src/lib/ingest.ts` no longer carries the character-card helper mojibake left in the previous pass, the affected RPG prompt examples are back to clean readable text, and focused prompt tests now assert that known mojibake markers do not reappear.
- RPG-only refactor Phase 0 baseline confirmation is complete. This pass changed documentation/baseline artifacts only, exported current Stage 1 and Stage 2 RPG prompt samples under `docs/refactor-handoffs/`, and generated `docs/refactor-handoffs/PHASE_0_HANDOFF.md`.
- RPG-only refactor Phase 1 prompt dispatcher separation is complete. `buildAnalysisPrompt` and `buildGenerationPrompt` keep their external signatures in `src/lib/ingest.ts`, but now dispatch to independent default and RPG prompt modules under `src/lib/prompts/`; RPG analysis no longer builds the default analysis prompt first, and RPG generation no longer builds the default generation prompt first.
- RPG-only refactor Phase 2 RPG analysis prompt slimming is complete. Stage 1 RPG analysis is now a pure candidate-object analysis contract with `object_type`, `suggested_route`, `action`, evidence, inference, confidence, uncertainty, ignored noise, merge targets, and open questions; prompt pollution tests now assert that default headings, character-page contract terms, and domain-specific example tokens do not appear in the RPG analysis prompt.
- RPG-only refactor Phase 3 RPG generation prompt directory-contract splitting is complete, and the later Source Profile-driven trimming pass has replaced its earlier path/schema/object-type category inference. Stage 2 now starts from a minimum generation contract and injects focused page guidance only from Stage 1 `needed_categories`.
- RPG-only refactor Phase 4 RPG-first / Legacy Default convergence is complete. Default mode is retained only as an explicit legacy compatibility mode, new project creation now defaults to `llmwikirpg`, `wikiMode` branch checks use a named RPG predicate, and `executeIngestWrites()` now reuses the same writer path as `autoIngest()` for RPG storage strategies, dynamic validation, extraction lint, and review item surfacing.
- RPG-only refactor Phase 5 final regression is complete. The final targeted RPG regression bundle passes, and the smoke fixture now uses a clean discrete `events/` sample instead of a route/timeline-like event page while still verifying character, player, location, faction, item, event, current-scene, relationship, source-summary, mode-detection, retrieval-priority, and no-stray-legacy-page behavior.

## Current Stage

- v0.2 push-preparation validation complete: typecheck and mock regression tests are green; test-only path/queue-read stability fixes are included.
- Post-v0.2 current-scene marker gate hardening complete: `current-scene` no longer opens from semantic live-session heuristics alone; it requires `[RPG-LIVE]`.
- RPG prompt source comment pass complete: no behavior change; the two RPG prompt modules now document function intent and provide Chinese comments for English prompt text.
- RPG Stage 1 driven prompt trimming complete: `Source Profile.needed_categories` is now the sole focused-contract selection input for RPG Stage 2.
- Prompt-comment documentation pass complete: no behavior change; `buildRpgGenerationPrompt()` helper references are now annotated in Chinese.
- RPG page-guidance comment pass complete: no behavior change; focused page guidance and directory-inference helper references are now annotated in Chinese.
- Stage 12 complete: cleanup review.
- The current 00 through 12 phase plan has no remaining executable stage.
- Post-v1 v0.2 task 1 complete: `player/` versus `characters/` boundary hardening.
- Post-v1 v0.2 task 2 complete: require object-type-first routing before RPG directory selection.
- Post-v1 v0.2 task 3 complete: `events/` versus `plot-arcs/` boundary hardening.
- Post-v1 v0.2 task 4 complete: `current-scene/` generation gating for live scene input only.
- Post-v1 v0.2 task 5 complete: `concepts/` boundary hardening against trope/tag/trivia noise.
- Post-v1 v0.2 task 6 complete: secondary extraction pressure for `locations/` and `factions/`.
- Post-v1 v0.2 task 7 complete: expand `characters/` schema for RPG portrayal and route-aware state snapshots.
- Post-v1 v0.2 task 8 complete: add lightweight extraction validation/lint for common RPG misroutes and omissions.
- Post-v1 v0.2 task 9 complete: expand regression coverage for prompt, validation, and clean-routing ingest scenarios.
- Post-v1 v0.2 task 10 complete: document the v0.2 evaluation boundary, fix matrix, and remaining extraction-quality gaps.
- Post-v0.2 character-card extraction pass 1 complete: characters now target a stricter roleplay-ready character-card contract and conservative dynamic merge cleanup.
- Planning follow-up complete: RPG-only refactor decision and phased plan authored in `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`.
- RPG-only refactor Phase 0 complete: baseline typecheck/test results, prompt samples, known prompt/writer/smoke/review issues, and handoff document captured without modifying business code.
- RPG-only refactor Phase 1 complete: prompt builders split into default/RPG module paths, `src/lib/ingest.ts` now acts as a dispatcher for the exported prompt builder interfaces, and prompt tests cover the absence of default top-level analysis/generation structures in RPG prompts.
- RPG-only refactor Phase 2 complete: RPG Stage 1 analysis prompt is analysis-only and no longer carries default analysis sections, character-page writing contract terms, or Fate/UBW/HF/Fuyuki/Holy Grail/Heaven's Feel examples.
- RPG-only refactor Phase 3 complete, with a later follow-up now applied: RPG Stage 2 generation no longer defaults to all-in-one directory guidance, and focused directory contracts are injected only from Stage 1 Source Profile `needed_categories`.
- RPG-only refactor Phase 4 complete: new project mode defaults are RPG-first, `default` is explicitly legacy, and manual ingest writes share the RPG writer semantics used by `autoIngest()`.
- RPG-only refactor Phase 5 complete: final regression and sample verification passed; `docs/refactor-handoffs/PHASE_5_HANDOFF.md` records the closing state.

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
- v0.2 task 1: Harden `player/` and `characters/` boundaries.
- v0.2 task 2: Add object-type-first RPG extraction routing guidance.
- v0.2 task 3: Fix `events/` versus `plot-arcs/` boundary.
- v0.2 task 4: Restrict `current-scene/` generation to explicit live scene input.
- v0.2 task 5: Clean up `concepts/` boundaries and redirect trope noise back into character pages.
- v0.2 task 6: Add secondary extraction guidance for `locations/` and `factions/`.
- v0.2 task 7: Enhance `characters/` schema for RPG portrayal.
- v0.2 task 8: Add lightweight extraction validation/lint.
- v0.2 task 9: Add regression coverage for prompt, validation, and scenario routing.
- v0.2 task 10: Document the v0.2 extraction-evaluation boundary and remaining gaps.
- Post-v0.2 character-card extraction pass 1: reshape `characters/` around a character-card contract and preserve long-term portrayal sections during merge.
- RPG-only refactor Phase 0: baseline confirmation and handoff generation.
- RPG-only refactor Phase 1: prompt dispatcher separation and handoff generation.
- RPG-only refactor Phase 2: RPG analysis prompt slimming and pollution-test hardening.
- RPG-only refactor Phase 3: RPG generation prompt directory-contract splitting and handoff generation.
- RPG-only refactor Phase 4: RPG-first / Legacy Default convergence and handoff generation.
- RPG-only refactor Phase 5: final regression, smoke sample cleanup, documentation update, and handoff generation.

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
- Stage 07 plus v0.2 task 4 originally used heuristic live-session/source markers for `current-scene`; post-v0.2 marker hardening now requires explicit `[RPG-LIVE]` source input before `wiki/current-scene/scene_state.md` can be written. Lightweight writer diagnostics still use static-source and runtime-looking markers to explain rejected writes.
- Stage 05 plus v0.2 task 5 now make `concepts/` boundaries much stricter in RPG prompt/schema guidance, and v0.2 task 8 adds a lightweight writer-side extraction lint for trope/tag noise, but it remains heuristic rather than a full semantic classifier.
- Stage 05 prompt/schema plus v0.2 task 6 now push harder on `locations/` and `factions/`, and v0.2 task 8 adds a lightweight omission check when obvious candidates exist while both directories remain empty, but that check still relies on shallow name-pattern heuristics instead of entity-level source understanding.
- Stage 04 schema plus v0.2 task 7 now define richer roleplay-oriented `characters/` sections, but there is still no extractor-side validator that checks those sections were actually emitted or that unsupported speech/boundary details were not invented; that remains later lint work.
- The new character-card contract is stronger than the older task-7 character section list, but page-merge structure protection and extraction-lint validation still do not verify that generated `characters/` pages actually keep the preferred heading set or maintain a clean `Canon Facts` versus `Reasonable Interpretation` versus `RP Usage` split.
- v0.2 task 8 extraction lint is intentionally lightweight: it runs only in `llmwikirpg` `autoIngest`, works from generated FILE blocks plus shallow source-text cues, and does not yet provide a standalone whole-project evaluation script or broader offline wiki audit.
- v0.2 task 9 improves regression safety around prompt text, validation fixtures, and clean-routing scenarios, but those tests still run against mocked LLM outputs rather than a real-model evaluation harness.
- v0.2 task 10 documents the current fix matrix more clearly, but it does not change the underlying limitation: most v0.2 semantic checks still rely on prompt/schema guidance plus lightweight heuristics rather than automatic repair or benchmarked real-model grading.
- Project skeleton/template directory creation is still legacy-oriented; RPG directories are created lazily by the existing file writer when pages are emitted.
- Search still scans all `wiki/**/*.md`; Stage 08 added a first-pass frontend retrieval priority for `current-scene`, `player`, `events`, and `plot-arcs`, but deeper RPG runtime context assembly and any future `rules` or `style` retrieval policy are still not implemented.
- Stage 09 intentionally uses a lightweight compatibility heuristic plus optional `wikiMode` text markers in `schema.md`/`purpose.md` rather than a persisted project setting or UI toggle. Mixed-mode/custom projects that reuse RPG directory names without being RPG-oriented still depend on that heuristic until a later stage adds a first-class mode setting.
- Stage 10 smoke coverage is intentionally deterministic and mocked at the LLM boundary. Stage 11 documented this limitation explicitly; real-model extraction quality, misclassification rates, field completeness, and browser-level UI behavior are still not proven by the current automated coverage.
- Stage 11 fixed the one smoke-backed prompt/schema ambiguity around `current-scene` filename selection, but it did not add a real-model evaluation harness or broader semantic grading system.
- The pre-refactor audit found that `src/lib/ingest.ts` used a default-prompt-plus-RPG-patch structure and that `executeIngestWrites()` did not share the full RPG storage/validation path used by `autoIngest()`. Phase 1-3 removed the prompt splice, and Phase 4 aligned the manual writer path with `writeFileBlocks()`.
- Final Phase 5 validation is green for the targeted RPG bundle: `npm.cmd run typecheck` passes, and the requested Vitest command passes with 8 test files and 74 tests. The earlier `src/lib/rpg-smoke.test.ts` review-item mismatch was resolved by replacing the mock `wiki/events/timeline.md` output with a discrete `wiki/events/canal-gate-incident.md` event sample rather than weakening extraction lint.
- Phase 0 prompt export confirms the current RPG Stage 1 analysis prompt is 10,428 characters and still includes default analysis headings (`## Key Entities`, `## Key Concepts`, `Main Arguments & Findings`, `Recommendations`), Stage 2 character-card terms (`Character Impression`, `Psychological Model`, `Dialogue Style`, `RP Usage`), and domain/example tokens (`Fate`, `UBW`, `HF`, `Fuyuki`, `Heaven's Feel`).
- Phase 0 prompt export confirms the current RPG Stage 2 generation prompt is 28,512 characters and includes the all-in-one RPG directory routing block plus character-card terms and domain/example tokens. This is a baseline issue only; Phase 0 intentionally did not change prompt logic.
- Phase 1 removes the `default prompt + RPG patch` construction path for the exported prompt builders, but it intentionally does not perform the later Phase 2/Phase 3 semantic cleanup: RPG analysis still carries the existing character-card/domain-heavy RPG guidance, and RPG generation still carries all-in-one RPG directory guidance.
- Phase 2 removes the remaining character-card/domain-heavy guidance from RPG Stage 1 analysis only.
- Phase 3 removed the pre-existing all-in-one RPG generation directory guidance. The later Source Profile-driven trimming pass now makes Stage 1 `needed_categories` the only input for focused RPG directory contract expansion; missing/invalid profiles fall back to the minimum RPG generation contract.
- Phase 4 confirms that `default` remains available as Legacy Default for existing llm_wiki-style projects and explicit opt-in use, but no longer represents the product default for new projects. Manual ingest writes now run through `writeFileBlocks()`, so RPG mode no longer bypasses canonical `current-scene`, `events` append, RPG merge cleanup, extraction validation, or lint review item behavior.
- Phase 0 smoke baseline confirms the lone failing review item is caused by the mocked `wiki/events/timeline.md` output being flagged as route/timeline-like by RPG extraction lint while `src/lib/rpg-smoke.test.ts` still expects zero review items.
- Phase 5 resolves that smoke mismatch within test scope: the smoke path now verifies append behavior through a discrete canal-gate incident event page, keeps route/storyline concerns in `plot-arcs`, and adds an assertion that the character page does not absorb the separate location, faction, or item facts.
- `docs/ROADMAP.md` still contains a simplified stage-status table with stale `Pending` markers for later stages; within the current allowed Stage 12 scope, the authoritative completion record is `docs/CURRENT_STATE.md` plus `docs/IMPLEMENTATION_LOG.md`.

## Last Executed Stage

- RPG-only refactor Phase 5: final regression testing, smoke sample verification, documentation update, and handoff generation.

## Next Stage Recommendation

- Use `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` as the target architecture.
- Use `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` as the next implementation roadmap.
- The next recommended implementation target is read-only RPG Runtime Context Compiler v0.
- Use `docs/LLMWIKIRPG_USAGE.md` as the first-version operating guide for RPG-mode projects.
- Use `docs/RPG_WIKI_SCHEMA.md` and `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md` as current schema/update-policy references.
- Use `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md` only when returning to extraction-quality evaluation work.
- Historical stage plans, completed task lists, old reports, and refactor handoffs now live under `docs/archive/`.
