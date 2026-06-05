# Implementation Log

## 2026-06-05 - v0.2 push-preparation validation

### Stage

Release/push preparation only; not a new implementation stage.

### Changed files

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `src/lib/ingest-queue.integration.test.ts`
- `src/lib/ingest-source-path-collision.test.ts`

### Summary

- Confirmed the current worktree is carrying the llmWikiRPG v0.2 extraction-quality and RPG-only convergence changes on top of the earlier v0.1/RPG category baseline.
- Kept the upstream application package version unchanged at `0.4.16`; `v0.2` is the llmWikiRPG migration/evaluation milestone recorded in the RPG docs.
- Hardened one source-summary path assertion so Windows and normalized forward-slash paths compare consistently.
- Hardened ingest-queue integration-test reads so assertions wait for valid JSON while the background processor rewrites the queue file from pending to processing.

### Validation

- `npm.cmd run typecheck` passes.
- `npm.cmd run test:mocks` passes: 95 test files, 1281 tests.

### Scope notes

- No production behavior was changed in this final validation pass.
- `.codex/config.toml` is an empty local file and was not included in the planned push.

## 2026-06-05 - Docs archive cleanup

### Stage

Documentation organization only; not a new implementation stage.

### Changed files

- `AGENTS.md`
- `docs/archive/`
- `docs/archive/README.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Moved completed and historical docs out of the top-level `docs/` directory into `docs/archive/`.
- Archived old Stage 00-12 planning/report files, completed v0.2 task/automation docs, mode-switch reports, category mapping/analysis docs, smoke/evaluation reports, and RPG-only refactor handoffs.
- Kept active top-level docs focused on current state/logs, final architecture, next architecture steps, usage, RPG schema, dynamic update strategy, and the v0.2 extraction-evaluation plan.
- Added `docs/archive/README.md` to explain what was archived and which top-level docs remain active.
- Updated the current-state next recommendation so future work points to `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` instead of completed historical plans.
- Updated `AGENTS.md` core design document references to point at the current final architecture, next-steps roadmap, and RPG schema while noting that historical docs are archived.

### Validation

- Documentation organization only; no tests were run.

### Scope notes

- No documents were deleted.
- No production code was modified.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Next architecture steps document

### Stage

Architecture planning documentation only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a Chinese roadmap document for the next architecture implementation steps.
- Recorded the recommendation that the next implementation target should be read-only RPG Runtime Context Compiler v0.
- Broke later work into incremental stages: turn model, narration prompt builder, play panel, state extraction/staging, runtime write policy, outline-impact detection/regeneration, and relationship/tension derivation.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Final architecture diagram edge cleanup

### Stage

Architecture target clarification only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Changed the runtime diagram so `TurnRecord` is built from `SubmittedAction` plus the narration output, rather than from the runtime controller directly.
- Removed the redundant dashed `TurnResult` options edge because `TurnResult --> UI` already covers narrative plus next-action options.
- Represented multi-pass compression as an internal loop on `Context Compiler` instead of a separate pipeline node.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Final architecture diagram cleanup

### Stage

Architecture target clarification only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Reworked the runtime Mermaid diagram to remove ambiguous direct edges from UI/action into state extraction.
- Split the diagram into setup/import and one-runtime-turn subgraphs.
- Clarified that UI submits a selected option or freeform text to the runtime agent, and only the completed action+narrative turn record is passed to state extraction.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Final architecture turn-flow revision

### Stage

Architecture target clarification only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Revised the final architecture diagram so runtime play starts from a chosen/freeform player action, compiles wiki context, iteratively compresses it into a compact story-generation brief, then sends that brief to the narration generator.
- Clarified that the runtime writeback unit is only the completed `(player action, generated narrative)` pair; generated next-action options are non-canon possibilities and must not pollute wiki state.
- Added outline-impact detection and conservative outline regeneration when accepted play state significantly changes the existing plot outline.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No stage plan was created.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Final architecture target clarification

### Stage

Architecture target clarification only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a final target architecture document for llmWikiRPG.
- Defined the end-state system as a Markdown-backed RPG runtime with separate ingest, relationship/tension derivation, manual context, runtime agent, context compiler, write-policy guard, runtime overlays, and per-turn action options.
- Recorded the main directional changes still needed from the current codebase, especially separating wiki QA chat from RPG play runtime and protecting immutable canon pages from runtime writes.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No stage plan was created.
- No `git commit` or `git push` was performed.

## 2026-06-05 13:26 - RPG Stage 1 glossary and boundary merge

### Stage

Post-v0.2 prompt refinement follow-up: merge the former Stage 1 routing-boundary emphasis into the corresponding `Object type glossary` entries.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Merged `player_character`, `current_scene_state`, `discrete_event`, `plot_arc`, `relationship`, `character_trait_or_trivia`, `wiki_noise`, `location`, and `faction` boundary warnings into their glossary definitions.
- Replaced the old per-type `Routing boundaries` block with a smaller `Routing discipline` block for the general one-best-route rule.
- Strengthened prompt tests to assert that the key boundary warnings are present in the glossary and that the old `Routing boundaries:` heading is gone.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 30 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No legacy `entities`, `concepts`, or `sources` behavior was removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 13:24 - RPG Stage 1 object-type glossary

### Stage

Post-v0.2 prompt refinement: add schema-derived one-line `object_type` definitions to Stage 1 analysis without restoring the old all-in-one directory contract.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added an `Object type glossary` immediately after the Stage 1 allowed `object_type` enum.
- Kept each glossary entry to one line and derived the wording from the existing RPG schema categories.
- Preserved the Stage 1 / Stage 2 split: Stage 1 now has lightweight semantic anchors, while detailed page contracts still live in Stage 2 focused guidance.
- Added prompt coverage for `world_fact`, `location`, `faction`, and `item` glossary text.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 30 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No legacy `entities`, `concepts`, or `sources` behavior was removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 12:25 - Post-v0.2 current-scene marker gate hardening

### Stage

Post-v0.2 current-scene marker gate hardening: replace live/current-scene heuristic admission with the explicit `[RPG-LIVE]` input marker.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/rpg-dynamic-update.ts`
- `src/lib/rpg-extraction-validation.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-dynamic-update.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/lib/rpg-smoke.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Prompt changes: Stage 1 now includes `live_runtime_input`, `live_input_marker: [RPG-LIVE] | none`, and explicit rules that `current-scene` plus `live_scene_allowed: true` require the exact `[RPG-LIVE]` marker.
- Stage 2 guidance now parses `live_scene_allowed` and filters `current-scene` out of focused contracts unless it is explicitly `true`; blocked focused guidance emits a REVIEW note.
- Writer validation now allows `wiki/current-scene/` writes only when `context.sourceText` contains `[RPG-LIVE]`; unmarked `Current scene:`, `session`, `turn`, `scene`, `GM:`, and `Player:` signals are diagnostic hints only.
- Docs now record the marker gate in schema, dynamic update strategy, usage workflow, v0.2 evaluation plan, implementation summary, and current-state handoff.

### Validation

- `npx vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/ingest.scenarios.test.ts` could not run through PowerShell because `npx.ps1` is blocked by the local execution policy.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/ingest.scenarios.test.ts` passed.
  - 3 test files passed.
  - 53 tests passed.
- `npm.cmd run typecheck` passed.
- Additional related coverage: `npx.cmd vitest run src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 2 test files passed.
  - 9 tests passed.
- Follow-up helper cleanup check: `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 30 tests passed.

### Scope notes

- Legacy `entities`, `concepts`, and `sources` behavior was not removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 11:55 - RPG prompt function comments and Chinese translations

### Stage

Comment/documentation pass only: annotate the RPG prompt source files and add Chinese translation comments under English prompt strings.

### Changed files

- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added readable function comments to the RPG page-guidance prompt helpers, including Source Profile parsing, category validation, category contract generation, and character-page contract construction.
- Added Chinese translation comments immediately under English prompt strings in `src/lib/prompts/rpg-page-guidance.ts`.
- Replaced mojibake comments in `src/lib/prompts/rpg-ingest.ts` with readable Chinese comments.
- Added Chinese translation comments immediately under English prompt strings in `src/lib/prompts/rpg-ingest.ts`.
- Kept emitted prompt strings and prompt-builder behavior unchanged.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts` passed.
  - 2 test files passed.
  - 42 tests passed.
- Fixed-string scans for representative mojibake markers in the two edited prompt files found no matches.

### Scope notes

- No prompt behavior, schema, writer/storage logic, or tests were intentionally changed.
- No `git commit` or `git push` was performed.

## 2026-06-05 11:40 - RPG Stage 1 Source Profile driven Stage 2 trimming

### Stage

Post-Phase-5 prompt trimming follow-up: make RPG Stage 2 focused directory contracts depend only on Stage 1 analysis `## Source Profile`.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a required RPG Stage 1 `## Source Profile` structure with `source_kind`, `dominant_focus`, `needed_categories`, `suppressed_categories`, `live_scene_allowed`, and `event_extraction_mode`.
- Reworked RPG Stage 2 focused guidance so `needed_categories` from Stage 1 is the only category-selection input.
- Removed the previous focused-category inference path from schema, purpose, source filename, source summary path, `object_type`, and `suggested_route`.
- Kept `sources/` summary generation, `wiki/index.md`, `wiki/log.md`, and `wiki/overview.md` under the minimal RPG generation contract rather than `needed_categories`.
- Changed missing/invalid Source Profile behavior to stay on the minimal RPG contract and instruct the model to add a REVIEW note for missing focused category selection.
- Updated `autoIngest()` to pass Stage 1 `analysis` into `buildGenerationPrompt()`.
- Updated prompt and pipeline tests to verify Source Profile-driven trimming, whitelist/dedupe/max-4 handling, no path/schema fallback, and Stage 1 analysis propagation into Stage 2 prompt construction.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts` passed.
  - 5 test files passed.
  - 58 tests passed.

### Scope notes

- Writer/storage behavior was not changed; existing `current-scene` overwrite, `events` append, and merge-class RPG directory behavior remains covered by the retained tests.
- Legacy/default prompt behavior and legacy `entities`, `concepts`, `sources`, and `queries` behavior were not removed.
- No `git commit` or `git push` was performed.

## 2026-06-04 22:40 - RPG page guidance helper comments

### Stage

Prompt-comment documentation pass only: explain focused RPG page guidance helpers and the directory-inference flow.

### Changed files

- `src/lib/prompts/rpg-page-guidance.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added Chinese inline comments for helper calls inside `buildFocusedRpgPageGuidance()`, `inferRpgGuidanceCategories()`, `buildRpgCategoryGuidance()`, and `categoryContract()`.
- Clarified the two-pass inference structure: explicit path/schema signals first, then auxiliary `suggested_route` / `object_type` signals only when path routing is not decisive.
- Clarified focused contract expansion through `buildRpgCategoryGuidance()`, schema lookup through `getRpgWikiSchemaEntry()`, directory contract selection through `categoryContract()`, and the character-card contract for `characters/`.

### Validation

- `npm.cmd run typecheck` passed.

### Scope notes

- No runtime behavior, prompt wording, inference logic, schema, tests, or writer code was changed.
- No `git commit` or `git push` was performed.

## 2026-06-04 22:30 - RPG generation prompt helper comments

### Stage

Prompt-comment documentation pass only: explain the helper prompt builders referenced by `buildRpgGenerationPrompt()`.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added Chinese inline comments inside `buildRpgGenerationPrompt()` for each referenced prompt/helper function.
- Documented the helper sources and roles: shared ingest language/source/frontmatter/review/output rules, RPG page guidance minimum/focused contracts, domain-specific guidance, and source summary path derivation.
- Kept the prompt text, helper call order, parser protocol, and generation behavior unchanged.

### Validation

- `npm.cmd run typecheck` passed.

### Scope notes

- No runtime behavior, tests, schema, writer logic, or prompt wording was changed.
- No `git commit` or `git push` was performed.

## 2026-06-04 20:05 - RPG-only refactor Phase 5 final regression and handoff

### Stage

Phase 5 only: execute final regression, verify RPG boundary samples, update final documents, and generate the Phase 5 handoff.

### Changed files

- `src/lib/rpg-smoke.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_5_HANDOFF.md`

### Summary

- Read the required Phase 5 inputs: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `PHASE_0_HANDOFF.md`, `PHASE_1_HANDOFF.md`, `PHASE_2_HANDOFF.md`, `PHASE_3_HANDOFF.md`, `PHASE_4_HANDOFF.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Ran the requested final regression commands. The first targeted Vitest run exposed the known smoke mismatch from earlier handoffs: the mocked smoke output wrote `wiki/events/timeline.md`, and extraction lint correctly raised a review item because `timeline`/route-like event pages may belong in `plot-arcs`.
- Updated the smoke fixture instead of weakening validation: the sample now writes `wiki/events/canal-gate-incident.md` as a discrete event page, keeps route/storyline concerns in `wiki/plot-arcs/`, and avoids route/timeline wording inside the event body.
- Kept the smoke test's clean-review assertion and added explicit verification that the character page does not absorb the separate `locations`, `factions`, or `items` facts.
- Confirmed existing scenario/validation coverage still checks canon characters do not become `player`, ending/static-route material does not become `current-scene`, trope/trivia noise does not become standalone `concepts`, and clean canon-cast output produces `characters`, `relationships`, `locations`, and `factions` without stray `player` or trope-concept pages.
- Updated current-state documentation and generated the final Phase 5 handoff.

### Validation

- Initial `npm.cmd run typecheck` passed.
- Initial targeted Vitest run failed only in `src/lib/rpg-smoke.test.ts` because the mock `wiki/events/timeline.md` output triggered one expected extraction-lint review item while the smoke test still expected zero.
- Final `npm.cmd run typecheck` passed.
- Final `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts` passed.
  - 8 test files passed.
  - 74 tests passed.

### Scope notes

- No plan-external feature work was added.
- No prompt or writer production code was changed in Phase 5.
- The smoke fixture was corrected to align with the stricter `events` versus `plot-arcs` boundary; validation/lint behavior was not relaxed.
- No `git commit` or `git push` was performed.

### Next

- Stop at Phase 5. The RPG-only refactor plan is complete through its final planned phase.
- Do not continue into a new phase from this window.

## 2026-06-04 20:00 - RPG-only refactor Phase 4 RPG-first / Legacy Default convergence

### Stage

Phase 4 only: evaluate default mode, converge mode branches, and align interactive ingest writes with the RPG writer semantics used by auto ingest.

### Changed files

- `src/lib/wiki-mode.ts`
- `src/lib/project-mode.ts`
- `src/lib/ingest.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/components/chat/chat-panel.tsx`
- `src/lib/wiki-mode.test.ts`
- `src/lib/project-mode.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_4_HANDOFF.md`

### Summary

- Read the required Phase 4 inputs: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `PHASE_0_HANDOFF.md`, `PHASE_1_HANDOFF.md`, `PHASE_2_HANDOFF.md`, `PHASE_3_HANDOFF.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Decided to retain `default` mode as an explicit Legacy Default compatibility mode rather than remove it. New projects are now RPG-first by default through `DEFAULT_PROJECT_MODE = "llmwikirpg"`, while `default` remains selectable and metadata-detectable.
- Added `isRpgWikiMode()` and used it in ingest prompt dispatch and chat retrieval priority checks so RPG/default branches have a named predicate instead of repeated string checks.
- Updated the create-project flow and `createProject()` default parameter to use `DEFAULT_PROJECT_MODE`.
- Reworked `executeIngestWrites()` so the interactive/manual write path detects wiki mode and delegates generated FILE blocks to `writeFileBlocks()`.
- Manual writes now share `autoIngest()` RPG behavior for canonical `wiki/current-scene/scene_state.md`, append/overwrite/merge strategies, dynamic validation, extraction lint review items, and parsed REVIEW blocks.
- Kept Phase 1-3 prompt design intact and did not run Phase 5 final regression work.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 5 test files passed.
  - 38 tests passed.

### Scope notes

- Default prompt + RPG patch remains gone from the exported prompt builders due to Phase 1-3; Phase 4 did not reintroduce that structure.
- Legacy `entities`, `concepts`, `sources`, custom schema routing, and explicit `wikiMode: default` behavior remain available.
- No `git commit` or `git push` was performed.

### Next

- Stop this window at Phase 4.
- Phase 5, if requested, must run in a fresh window and should use the Phase 4 handoff as an input. Do not treat this Phase 4 validation run as the final regression phase.

## 2026-06-04 19:50 - RPG-only refactor Phase 3 RPG generation prompt directory-contract splitting

### Stage

Phase 3 only: make the RPG Stage 2 generation prompt inject page guidance by minimum necessary directory contract.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/domain-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_3_HANDOFF.md`

### Summary

- Read the required Phase 3 inputs: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `docs/refactor-handoffs/PHASE_0_HANDOFF.md`, `docs/refactor-handoffs/PHASE_1_HANDOFF.md`, `docs/refactor-handoffs/PHASE_2_HANDOFF.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Replaced the all-in-one RPG generation guidance in `src/lib/prompts/rpg-ingest.ts` with a minimum RPG generation contract plus focused page guidance.
- Added `src/lib/prompts/rpg-page-guidance.ts` to infer a single target RPG directory from explicit path/schema signals first, then from auxiliary `object_type` / `suggested_route` only when path/schema is not decisive.
- Kept the character-card contract available only for `wiki/characters/` focused guidance.
- Added short contracts for `player`, `current-scene`, `events`, `plot-arcs`, `relationships`, and short target-specific contracts for `locations`, `factions`, and `items`.
- Added `src/lib/prompts/domain-guidance.ts` so domain-specific guidance is injected independently and only when domain markers are detected.
- Updated prompt tests to assert minimum-only fallback, character-only character-card injection, short directory contracts, auxiliary object-type routing, and independent domain guidance.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts` passed.
  - 2 test files passed.
  - 39 tests passed.

### Scope notes

- Default mode was retained.
- Phase 4 was not executed: no `wikiMode` / mode convergence, writer alignment, UI, retrieval, or manual-write behavior was changed.
- Phase 5 was not executed: no final broad regression pass was performed.
- The known broader `src/lib/rpg-smoke.test.ts` review-item baseline mismatch from Phase 0 was not run or fixed in this phase.

### Next

- Stop this window at Phase 3.
- Start Phase 4 only in a fresh Codex window after reading the plan plus `PHASE_0_HANDOFF.md`, `PHASE_1_HANDOFF.md`, `PHASE_2_HANDOFF.md`, and `PHASE_3_HANDOFF.md`.

## 2026-06-04 19:45 - RPG-only refactor Phase 2 RPG analysis prompt slimming

### Stage

Phase 2 only: make the RPG Stage 1 analysis prompt a pure analysis contract and add prompt pollution tests.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_2_HANDOFF.md`

### Summary

- Read the required Phase 2 inputs: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `docs/refactor-handoffs/PHASE_0_HANDOFF.md`, `docs/refactor-handoffs/PHASE_1_HANDOFF.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Removed the character-card analysis helper from RPG Stage 1 analysis.
- Rewrote `buildRpgExtractionAnalysisGuidance()` so Stage 1 only asks for candidate object classification, `object_type`, `suggested_route`, `action`, evidence summary, brief inference, confidence, uncertainty, ignored noise, merge targets, and open questions.
- Removed domain-specific examples from the RPG Stage 1 analysis prompt.
- Updated `src/lib/ingest.prompt.test.ts` so RPG analysis is tested for required analysis-contract markers and for absence of default prompt sections, character-page contract terms, and domain-specific example tokens.
- Kept default mode intact and did not perform Phase 3 generation prompt directory-contract splitting.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 22 tests passed.

### Scope notes

- Phase 3 was not executed: RPG generation still carries the pre-existing all-in-one directory guidance and character-page contract until the next phase.
- No writer, UI, retrieval, schema, dynamic-update, or default-mode behavior was intentionally changed.
- `src/lib/prompts/domain-guidance.ts` still does not exist in this tree; Phase 2 did not need a new domain injection file because the cleanup was limited to removing domain-specific examples from Stage 1 analysis.

### Next

- Stop this window at Phase 2.
- Start Phase 3 only in a fresh Codex window after reading the plan plus `PHASE_0_HANDOFF.md`, `PHASE_1_HANDOFF.md`, and `PHASE_2_HANDOFF.md`.

## 2026-06-04 19:20 - RPG-only refactor Phase 1 prompt dispatcher separation

### Stage

Phase 1 only: split default and RPG prompt dispatcher paths while preserving the exported `buildAnalysisPrompt` and `buildGenerationPrompt` interfaces.

### Changed files

- `src/lib/ingest.ts`
- `src/lib/prompts/shared-ingest.ts`
- `src/lib/prompts/default-ingest.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_1_HANDOFF.md`

### Summary

- Read the required Phase 1 inputs: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `docs/refactor-handoffs/PHASE_0_HANDOFF.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Added `src/lib/prompts/shared-ingest.ts` for shared language, source, frontmatter, review, and FILE/REVIEW output-format rules.
- Added `src/lib/prompts/default-ingest.ts` for the legacy/default analysis and generation prompts.
- Added `src/lib/prompts/rpg-ingest.ts` for independent RPG analysis and generation prompts.
- Replaced the large prompt-builder block in `src/lib/ingest.ts` with mode dispatchers that preserve the external `buildAnalysisPrompt` and `buildGenerationPrompt` signatures.
- Updated prompt tests so RPG analysis is checked for RPG structure and for absence of default analysis headings, and RPG generation is checked for absence of the default `## What to generate` entity/concept generation list.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts` passed.
  - 3 test files passed.
  - 29 tests passed.

### Scope notes

- Default mode was retained.
- Phase 2 was not executed: RPG analysis still retains the existing character-card/domain-heavy guidance for later cleanup.
- Phase 3 was not executed: RPG generation still uses the existing all-in-one RPG directory guidance rather than path/schema-minimal injection.
- Writer, UI, retrieval, schema, and dynamic-update behavior were not intentionally changed in this phase.

### Next

- Stop this window at Phase 1.
- Start Phase 2 only in a fresh Codex window after reading the plan plus `PHASE_0_HANDOFF.md` and `PHASE_1_HANDOFF.md`.

## 2026-06-04 19:10 - RPG-only refactor Phase 0 baseline confirmation

### Stage

Phase 0 only: baseline confirmation for the RPG-only refactor plan, with no business-code, prompt-logic, or test-expectation changes.

### Changed files

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/refactor-handoffs/PHASE_0_HANDOFF.md`
- `docs/refactor-handoffs/PHASE_0_STAGE_1_ANALYSIS_PROMPT_SAMPLE.md`
- `docs/refactor-handoffs/PHASE_0_STAGE_2_GENERATION_PROMPT_SAMPLE.md`

### Summary

- Read the required controlling documents before execution: `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `AGENTS.md`.
- Ran the current typecheck and targeted RPG test bundle exactly as the Phase 0 baseline commands.
- Exported current RPG-mode Stage 1 and Stage 2 prompt outputs by calling the existing exported builders from `src/lib/ingest.ts` without modifying prompt logic.
- Recorded the current prompt, writer, smoke, and review-item baseline issues for the next phase.
- Created the Phase 0 handoff document under `docs/refactor-handoffs/`.

### Baseline results

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts` did not fully pass.
  - 6 test files passed.
  - 52 tests passed.
  - 1 test failed in `src/lib/rpg-smoke.test.ts`.

### Prompt baseline

- Stage 1 RPG analysis prompt sample: `docs/refactor-handoffs/PHASE_0_STAGE_1_ANALYSIS_PROMPT_SAMPLE.md`.
- Stage 2 RPG generation prompt sample: `docs/refactor-handoffs/PHASE_0_STAGE_2_GENERATION_PROMPT_SAMPLE.md`.
- Stage 1 prompt length: 10,428 characters.
- Stage 2 prompt length: 28,512 characters.
- Stage 1 still contains default analysis headings, Stage 2 character-card terms, and domain/example tokens such as `Fate`, `UBW`, `HF`, `Fuyuki`, and `Heaven's Feel`.
- Stage 2 still contains a large all-in-one RPG directory routing block and character-card/domain/example terms.

### Failure notes

- `src/lib/rpg-smoke.test.ts` fails at the final `useReviewStore.getState().items` length assertion.
- The current smoke fixture generates `wiki/events/timeline.md`; RPG extraction lint treats route/timeline-like event pages as suspicious and adds one review item, while the smoke test still expects zero review items.

### Scope notes

- This pass intentionally did not modify `src/lib/ingest.ts`, prompt logic, business code, tests, or test expectations.
- A temporary prompt-export script was created and deleted during execution; only the generated Markdown baseline artifacts were retained.
- Phase 1, Phase 2, Phase 3, Phase 4, and Phase 5 were not executed.

### Next

- Stop this window at Phase 0.
- Start Phase 1 only in a fresh Codex window after reading `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md` and `docs/refactor-handoffs/PHASE_0_HANDOFF.md`.

## 2026-06-04 18:40 - RPG-only refactor plan hardening

### Stage

Documentation-only follow-up: strengthen the RPG-only refactor plan so later implementation runs can execute phase-by-phase in isolated Codex windows with explicit handoff discipline

### Changed files

- `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Reworked `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md` from a high-level refactor roadmap into a stricter execution contract.
- Made the recommendation and guardrails explicit: do not restart from base `llm_wiki`; preserve current RPG schema/routing/dynamic-write/test assets; treat the real target as removing the `default prompt + RPG patch` structure rather than deleting default mode immediately.
- Added hard phase constraints stating that Phase 1-3 may not remove `default` mode and that only Phase 4 may evaluate hiding, legacy-izing, or removing it.
- Added stronger prompt-architecture rules: `ingest.ts` should stop carrying long RPG prompt text, Stage 1 must stay analysis-only, Stage 2 must inject only the minimum required directory/page guidance, and domain-specific examples such as FSN must stay out of the generic RPG prompt.
- Added prompt-pollution test requirements, including forbidden default-analysis headings, forbidden Stage 2 character-card headings inside the RPG analysis prompt, forbidden Fate/UBW/HF/Fuyuki/Holy Grail tokens, and the required Stage 1 structural markers.
- Added a mandatory execution model of one Phase per fresh Codex window, one required handoff document per Phase under `docs/refactor-handoffs/`, and a directly copyable Codex prompt for each Phase 0 through 5.

### Validation

- No business code or tests were changed in this pass.
- Validation was limited to reviewing the updated plan/document structure for completeness against the requested execution model.

### Scope notes

- This pass intentionally changed planning/state documentation only.
- It did not create `docs/refactor-handoffs/` yet; the plan now specifies that later implementation phases should generate those handoff files as part of execution.

### Next

- Start with Phase 0 exactly as defined in `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`.
- Future execution windows should read the plan plus prior handoff files and must not continue across multiple phases in one window.

## 2026-06-04 18:26 - RPG-only refactor planning pass

### Stage

Planning-only audit: decide whether `llmwikirpg` should keep evolving on the current `rpg-version` branch or restart from base `llm_wiki`, then produce an executable refactor plan without changing production behavior

### Changed files

- `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Audited the current `llmwikirpg` integration surface across ingest, mode detection, schema, dynamic-write validation, extraction lint, project bootstrap, chat retrieval, UI type support, and tests.
- Confirmed that the main architectural debt is concentrated in [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts): RPG analysis is still implemented as default analysis prompt plus appended RPG guidance, RPG generation is still implemented as default generation prompt plus appended RPG directory guidance, and Stage 1 currently leaks `characters/` page-contract concerns that belong in Stage 2.
- Confirmed that several RPG assets are already worth preserving rather than re-implementing from scratch: `src/lib/rpg-categories.ts`, `src/lib/rpg-wiki-schema.ts`, `src/lib/rpg-dynamic-update.ts`, `src/lib/rpg-extraction-validation.ts`, `src/lib/rpg-query-priority.ts`, the RPG project bootstrap layer, and the RPG-focused scenario/smoke regression suites.
- Noted an additional convergence gap outside prompt text: `executeIngestWrites()` still does not share the full RPG storage-strategy / extraction-validation path used by `autoIngest()`, so the manual ingest/write route remains more legacy-shaped than the main RPG auto-ingest pipeline.
- Authored `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md`, which makes a clear recommendation to keep the current `rpg-version` branch and perform an explicit RPG-only convergence refactor instead of returning to base `llm_wiki` and starting over.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts` did not fully pass.
  - 6 test files passed.
  - `src/lib/rpg-smoke.test.ts` failed because the current RPG ingest path now leaves one review item in the store while the smoke expectation still asserts zero.

### Scope notes

- Kept this pass documentation-only as requested; no production code, prompt logic, tests, or runtime behavior were modified.
- Treated the planning result itself as the deliverable, with explicit phase sequencing and acceptance criteria so later Codex runs can execute the refactor incrementally.

### Next

- Use `docs/LLMWIKIRPG_RPG_ONLY_REFACTOR_PLAN.md` as the execution handoff for the next engineering pass.
- The first implementation phase should be baseline capture plus prompt dispatcher separation in `src/lib/ingest.ts`, before any broader mode or writer cleanup.

## 2026-06-04 11:03 - post-v0.2 character-card prompt text cleanup

### Stage

Post-v0.2 cleanup follow-up: remove mojibake and accidental text corruption from the new `characters/` prompt/helper paths

### Changed files

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Cleaned the RPG character-card helper text in `src/lib/ingest.ts`, removing the remaining mojibake / `?` placeholders from current-scene examples, character-trivia guidance, route-boundary examples, and player-vs-character examples.
- Replaced the two corrupted sentence-boundary regexes in `src/lib/ingest.ts` with clean ASCII-safe versions so chunk splitting and overlap trimming no longer depend on broken mojibake punctuation literals.
- Repaired the follow-up text damage introduced during cleanup itself, including malformed prompt bullets such as `--type` and the broken `[[...]]` frontmatter explanation, so the generation prompt is readable again end to end.
- Added focused anti-regression assertions to `src/lib/ingest.prompt.test.ts` to ensure known mojibake markers do not return in either the RPG analysis prompt or the RPG generation prompt.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-dynamic-update.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept this pass limited to prompt-text cleanup, prompt anti-regression coverage, and required state bookkeeping.
- Did not change the character-card contract itself, storage semantics, merge behavior, frontend UI, or schema structure.

### Next

- If more cleanup is needed, the next safe target is documentation-only mojibake that predates this pass; the production prompt and dynamic-update code paths touched here are now clean and typechecked again.

## 2026-06-04 10:18 - post-v0.2 character-card extraction pass 1

### Stage

Post-v0.2 extraction-quality fix: shift `characters/` from encyclopedia-style profiles toward a roleplay-ready character-card contract

### Changed files

- `src/lib/ingest.ts`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-dynamic-update.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/rpg-dynamic-update.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added character-specific Stage 1 analysis guidance in `src/lib/ingest.ts` so RPG-mode analysis now asks for a character operating model instead of a simple encyclopedia summary, including `Character Impression`, `Canon Facts`, `Reasonable Interpretation`, `Psychological Model`, `Behavior Rules`, `Dialogue Style`, `Relationship Dynamics`, `Route and Timeline Variants`, `RP Usage`, and `Evidence and Uncertainty`.
- Added a dedicated Stage 2 `wiki/characters/*.md` page contract in `src/lib/ingest.ts`, keeping `Canon Facts`, `Reasonable Interpretation`, and `RP Usage` explicitly separate and warning against collapsing Fate / UBW / HF / ending states into one fake universal present state.
- Replaced the `characters/` schema entry in `src/lib/rpg-wiki-schema.ts` with a stricter roleplay-ready character-card model built around the task-required fields: `identity`, `roleImpression`, `canonFacts`, `characterModel`, `triggersAndReactions`, `behaviorRules`, `dialogueStyle`, `relationshipDynamics`, `routeAndTimelineVariants`, `rpgUsage`, and `evidenceAndUncertainty`.
- Tightened the `characters/` schema wording so it now explicitly rejects portrayal-irrelevant encyclopedia trivia, route-collapse into one universal current state, and RP-serving interpretation written as hard canon.
- Made `src/lib/rpg-dynamic-update.ts` more conservative for `characters/` merges: it still strips truly dynamic sections such as current state, current goal, recent changes, and temporary interaction state, but it no longer treats long-term roleplay modeling sections as disposable dynamic garbage.
- Rewrote the three focused regression suites so they assert key phrases and structural boundaries rather than brittle long prompt snapshots, while directly locking the new character-card contract and conservative merge behavior.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to prompt/schema/dynamic-update behavior for `characters/`, directly related tests, and required state bookkeeping.
- Did not modify `page-merge.ts`, `rpg-extraction-validation.ts`, `rpg-categories.ts`, `wiki-page-types.ts`, `frontmatter.ts`, or frontend UI files.
- Did not add a new directory such as `wiki/character-cards/`, did not redesign the ingest pipeline, and did not add broader scenario or smoke coverage in this pass.

### Next

- If this character-card direction continues, the next bounded follow-up should protect the heading contract during page merge and add extraction-lint checks for `Canon Facts` versus `Reasonable Interpretation` versus `RP Usage`.
- After that structure protection exists, run a real-model evaluation or broader standalone audit pass to confirm the new contract materially improves `characters/` output quality.

## 2026-06-03 11:39 - v0.2 task 10 documentation closure

### Stage

Post-v1 extraction-quality fix: document the v0.2 evaluation boundary, fix matrix, compatibility scope, and remaining gaps

### Changed files

- `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md` to separate the post-v1 v0.2 extraction-quality work from the earlier Stage 11 smoke-backed evaluation document.
- Recorded explicitly that the v0.1 smoke path proves routing/write semantics, but does not prove real-model semantic classification quality.
- Documented the v0.2 fix matrix so maintainers can see which problems are primarily handled by prompt/schema rules, which are additionally surfaced by lightweight validation, and which still remain detect-only rather than auto-repaired.
- Updated `docs/RPG_WIKI_SCHEMA.md` with a concise v0.2 extraction-quality note so the schema document itself now explains the practical enforcement boundary between generation guidance, write-time gating, and warning-only lint.
- Updated `docs/CURRENT_STATE.md` so task 10 is marked complete and the next-step recommendation now points toward a future real-model evaluation or standalone audit pass instead of more unfinished v0.2 tasks.

### Validation

- `npm.cmd run typecheck` passed.
- `python scripts/run_rpg_v02_tasks.py --dry-run --only 10` passed and regenerated `.agent_runs/rpg_v02/prompts/task_10_prompt.md`.
- `npm.cmd run test:mocks` did not fully pass. It exposed two existing failures outside this doc-only task's edit surface:
  - `src/lib/ingest-source-path-collision.test.ts` currently expects a Windows path with backslashes, but the run produced a slash-normalized path string.
  - `src/lib/rpg-smoke.test.ts` currently expects zero review items, but the current RPG ingest path now leaves one review item in the store.

### Scope notes

- Kept the change limited to documentation and task-state bookkeeping.
- Did not change production routing, validation heuristics, frontend behavior, or legacy/default-mode compatibility logic.
- Preserved the earlier Stage 11 document as a historical record of the smoke-backed evaluation boundary instead of rewriting it into a broader v0.2 summary.

### Next

- Treat the current `docs/RPG_V0_2_TASKS.md` list as complete.
- If extraction quality work continues, define a new post-v0.2 task list centered on real-model evaluation, stronger audit tooling, or selective auto-repair for warning classes.

## 2026-06-03 11:26 - v0.2 task 9 regression coverage

### Stage

Post-v1 extraction-quality fix: add the remaining prompt, validation, and scenario regression coverage for v0.2 routing rules

### Changed files

- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-extraction-validation.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a compact generation-prompt regression guard so one test now checks the four highest-risk v0.2 routing constraints together: `player/` versus `characters/`, discrete `events/` versus route-like `plot-arcs/`, live-only `current-scene/`, and trope/trivia exclusion from `concepts/`.
- Added a canonical validation-fixture regression that combines the task-required warning families in one assertion set: suspicious original-work character material under `wiki/player/`, route/timeline-like `wiki/events/`, trope/community-tag noise under `wiki/concepts/`, and static-source `wiki/current-scene/`.
- Added a clean-routing ingest scenario proving that a canon-cast summary can land in `characters/`, `relationships/`, `locations/`, and `factions/` without creating stray `wiki/player/` pages or trope-like `wiki/concepts/` pages.
- While adding that scenario coverage, normalized several older scenario fixture strings to stable ASCII text so `src/lib/ingest.scenarios.test.ts` continues to parse reliably under the current repository encoding state without changing the intended test semantics.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/ingest.scenarios.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to regression tests plus required stage-state documentation.
- Did not change production RPG routing, validation heuristics, frontend behavior, or legacy/default-mode logic.
- Did not run the full `npm test` suite because this project also contains broader mocked-LLM and real-LLM-facing coverage outside the minimum task-9 regression scope.

### Next

- Continue with v0.2 task 10 from `docs/RPG_V0_2_TASKS.md`.
- Use the new task-9 regression baseline before any further prompt/schema/lint tweaks so future changes do not silently reintroduce `player/`, `events/`, `current-scene/`, or `concepts/` routing regressions.

## 2026-06-03 11:01 - v0.2 task 8 lightweight extraction validation lint

### Stage

Post-v1 extraction-quality fix: add a lightweight extraction validation/lint layer for common RPG misroutes and omissions

### Changed files

- `src/lib/rpg-extraction-validation.ts`
- `src/lib/rpg-extraction-validation.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-extraction-validation.ts` as a dependency-light validation layer for `llmwikirpg` ingest, returning both warning strings and review-store items that tests can assert directly.
- Hooked that validator into the `autoIngest` FILE-block write path in `src/lib/ingest.ts`, so RPG-mode generation now surfaces lightweight lint before write without changing legacy/default-mode behavior.
- Implemented the task-required checks for suspicious canon-character pages under `wiki/player/`, player-facing wording inside `wiki/characters/` when no current PC is established, route/timeline-like `wiki/events/` pages, static-source `wiki/current-scene/` output, trope/community-tag noise inside `wiki/concepts/`, and empty `wiki/locations/` or `wiki/factions/` when the source still contains likely candidates.
- Reused the existing `current-scene` dynamic-write gate as the source-type signal for lint review items, so blocked static-lore snapshots now also leave a human-visible review trace instead of only console output.
- Added focused unit coverage for all six rule families plus an ingest integration assertion proving that lint findings are injected into the existing review store during `autoIngest`.

### Validation

- `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts src/lib/ingest.scenarios.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to RPG-mode ingest validation, focused tests, and required stage-state documentation.
- Did not change frontend UI, legacy/default-mode ingestion behavior, or broader standalone wiki-audit tooling.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with the next unfinished item in `docs/RPG_V0_2_TASKS.md`.
- If later tasks need stronger grading, extend this validator with richer source/entity signals or a standalone evaluation script instead of expanding prompt-only rules further.

## 2026-06-03 10:39 - v0.2 task 7 roleplay-ready character schema

### Stage

Post-v1 extraction-quality fix: expand `characters/` schema so generated character pages are more usable for RPG portrayal

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/rpg-dynamic-update.ts`
- `src/lib/rpg-dynamic-update.test.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Expanded the code-readable `characters/` schema with task-required roleplay sections: core role, personality/behavior pattern, concrete speech style, capabilities and limits, behavior boundaries, multi-state snapshots, other-character interaction patterns, current-PC interaction rules, and source/pending-confirmation notes.
- Kept the existing `player/` versus `characters/` hard boundary intact while strengthening `characters/` guidance around alternate-route and ending-state handling, so True End or late-route states are no longer framed as the only universal present truth.
- Preserved the earlier trope/trivia cleanup by keeping character-facing roleplay sections such as `## 性格与行为模式` and `## 可用于扮演的细节` as the merge target for non-concept character details.
- Extended dynamic-merge heading cleanup for `characters/` so new sections like `## 多状态快照`, `## 与当前PC交互规则`, and `## 来源与待确认` are replaced cleanly on later updates instead of lingering stale state.
- Updated the human-readable RPG schema document and prompt-level regression coverage so the richer character schema is visible both to maintainers and to RPG-mode generation prompts.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-dynamic-update.test.ts src/lib/ingest.prompt.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to `characters/` schema guidance, directly related dynamic-merge headings, focused regression tests, and required stage-state documentation.
- Did not add new UI, write-time lint, or broader extractor validation logic; those remain later-task work.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 8 from `docs/RPG_V0_2_TASKS.md`.
- Use the new roleplay-schema headings as fixtures when adding extraction validation for missing fields or invented roleplay details.

## 2026-06-02 19:45 - v0.2 task 6 secondary extraction for locations and factions

### Stage

Post-v1 extraction-quality fix: add a second-pass prompt sweep so core `locations/` and `factions/` are not missed

### Changed files

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added RPG analysis-prompt guidance that explicitly requires a secondary scan after characters, events, and relationships are identified, so repeated or plot-relevant places and organizations are extracted even when they first appear indirectly.
- Added generation-prompt routing guidance for the same second pass, including the task-required target classes: places, families, organizations, factions, schools, churches, magecraft institutions, and hidden powers.
- Added explicit anti-omission wording: if a core location or organization is identifiable but the source is sparse, the model should still emit a short `wiki/locations/` or `wiki/factions/` page marked as incomplete or source-limited instead of dropping it.
- Added explicit anti-fabrication wording so the second pass does not invent geography, history, membership, or agenda details just to pad thin entries.
- Added the task-required concrete regression examples directly into prompt guidance: `冬木市`, `穗群原学园`, `远坂家`, `间桐家`, `爱因兹贝伦家`, `魔术协会`, and `圣堂教会`.
- Tightened the code-readable and human-readable RPG schema wording for `locations/` and `factions/` so it now matches the new prompt behavior around secondary extraction and short stub allowance.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to RPG prompt/schema wording, focused regression tests, and required stage-state documentation.
- Did not add writer-side validation, frontend UI changes, or broader extraction lint in this task.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 7 from `docs/RPG_V0_2_TASKS.md`.
- Use the new secondary-scan examples as fixtures when expanding regression and lint coverage for location/faction omissions.

## 2026-06-02 19:33 - v0.2 task 5 concepts boundary cleanup

### Stage

Post-v1 extraction-quality fix: restrict RPG `concepts/` usage to reusable setting/mechanism concepts and keep trope noise inside character pages

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Tightened the character schema so trope labels, nickname-like quirks, daily habits, and trivia that mainly describe one character now explicitly belong in that character page instead of a standalone `concepts/` page.
- Added prompt-level `concepts/` boundary guidance for RPG mode: `wiki/concepts/` is now explicitly limited to magic systems, ability mechanisms, world terminology, rule-like concepts, and other reusable setting concepts that multiple characters or events can reference.
- Added explicit anti-noise routing guidance so trope labels, nicknames, community tags, personality labels, and low-value trivia are no longer valid `world_fact` or standalone `concepts/` candidates.
- Added the task-required merge targets for retained trait/trivia material: route it into character-page sections such as `## 性格与行为模式`, `## 特征与缺陷`, `## 日常习惯`, and `## 可用于扮演的细节`.
- Added the required prompt counterexamples directly into RPG guidance: wrong `concepts/贫穷-萌点.md`, wrong `concepts/电气白痴.md`, correct `concepts/虚数属性.md`, correct `concepts/投影魔术.md`, and correct `world/圣杯战争.md`.
- Updated the human-readable RPG schema document so the legacy-compatibility `concepts/` boundary now matches the code/schema prompt guidance.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to RPG schema/prompt wording, focused regression tests, and required stage-state documentation.
- Did not add write-time or post-write `concepts/` validation in this task; that remains later lint work.
- Did not change frontend UI, legacy default-mode routing, or later v0.2 tasks such as location/faction secondary extraction or broader extraction validation.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 6 from `docs/RPG_V0_2_TASKS.md`: add secondary extraction guidance for `locations/` and `factions/`.
- Reuse the new `concepts/` counterexamples as fixtures when task 8 introduces explicit validation/lint for trope/tag noise.

## 2026-06-02 19:24 - v0.2 task 4 current-scene generation gating

### Stage

Post-v1 extraction-quality fix: restrict `current-scene/` writes to explicit live scene input only

### Changed files

- `src/lib/rpg-dynamic-update.ts`
- `src/lib/rpg-dynamic-update.test.ts`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Tightened the schema-level `current-scene/` boundary so it now explicitly accepts only live RPG scene/session inputs such as current session logs, post-action latest state, GM or user-declared current scene, or opening-scene initialization.
- Tightened RPG analysis and generation prompts so `current_scene_state` now lists both the allowed live-input cases and the disallowed static-source cases, including the required explicit current-scene example and the blocked `HF True End` flower-viewing example.
- Extended writer-side RPG validation so `wiki/current-scene/` writes are rejected before hitting disk when the source looks like static encyclopedia, ending-summary, biography, world-lore, or route-summary material.
- Applied that validation to both the main `autoIngest` write path and the manual `executeIngestWrites` path so `current-scene/` gating does not depend on which ingest flow was used.
- Kept the gate intentionally lightweight: live session-like source-path markers such as `session-*` or `turn-*` still allow normal runtime snapshot writes, while static markers like `ending`, `true end`, `years later`, and `赏花场景` block them.

### Validation

- `npx.cmd vitest run src/lib/rpg-dynamic-update.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-smoke.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to RPG schema/prompt wording, writer validation, focused regression tests, and required stage-state documentation.
- Did not change frontend UI, legacy default-mode routing, or later v0.2 tasks such as `concepts/` filtering, location/faction secondary extraction, or broader extraction lint.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 5 from `docs/RPG_V0_2_TASKS.md`: clean up `concepts/` boundaries and route trope/trivia noise back into character pages.
- Reuse the new `current-scene/` validation pattern as the baseline for later task-8 extraction lint so more source-type mistakes can be surfaced automatically.

## 2026-06-02 19:18 - v0.2 task 3 events versus plot-arcs boundary hardening

### Stage

Post-v1 extraction-quality fix: restrict `events/` to discrete events and redirect route-like material to `plot-arcs/`

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Tightened the schema-level `events/` boundary so it now explicitly means discrete confirmed events only, not whole routes, storyline overviews, long timelines, or complete-course summaries.
- Added the required discrete-event minimum payload to schema and prompt guidance: time or relative-time anchor, place, participants, what happened, and consequences or state change.
- Added explicit anti-misrouting rules to RPG analysis and generation prompts: if a candidate looks like a route, storyline, timeline, or complete course, spans many days or years, or contains 5 or more independent sub-events, it must not be emitted as one `wiki/events/` page.
- Clarified the required handling for those multi-event candidates: either store them under `wiki/plot-arcs/` or split them into multiple discrete `wiki/events/` pages.
- Added the task-required regression examples directly into prompt coverage: `Heaven's Feel 路线` must not be treated as one event, while `樱被过继到间桐家` and `柳洞寺决战` are valid `discrete_event` examples.
- Updated the human-facing schema document so the documentation now matches the runtime prompt/schema rules.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to schema text, RPG prompt construction, regression tests, and required stage-state documentation.
- Did not change writer/storage behavior, frontend UI, legacy default-mode routing, or later v0.2 tasks such as `current-scene/` gating, concepts filtering, or extraction lint.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 4 from `docs/RPG_V0_2_TASKS.md`: avoid static encyclopedia text polluting `current-scene/`.
- Reuse the new discrete-event wording as a baseline for later validation/lint work so route-like misroutes can be detected automatically instead of relying only on prompt guidance.

## 2026-06-02 19:12 - v0.2 task 2 object-type-first RPG routing guidance

### Stage

Post-v1 extraction-quality fix: require object-type classification before RPG directory selection

### Changed files

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Updated RPG analysis prompt guidance so candidate objects must be classified into one `object_type` before any wiki directory is chosen.
- Added the required 13-type classification list directly into the RPG analysis and generation prompts: `source`, `world_fact`, `npc_character`, `player_character`, `location`, `faction`, `item`, `plot_arc`, `discrete_event`, `current_scene_state`, `relationship`, `character_trait_or_trivia`, and `wiki_noise`.
- Added explicit routing instructions for those types in generation guidance, including `world_fact -> wiki/world/` versus legacy-compatible `wiki/concepts/` fallback wording, `player_character -> wiki/player/` only under explicit current-PC evidence, `character_trait_or_trivia` merge-into-character behavior, and `wiki_noise` ignore behavior.
- Tightened prompt wording so `current_scene_state` is only valid for runtime scene input or live session-state material, not static lore.
- Added explicit anti-filler guidance: do not invent pages just to populate directories, but still extract clearly or strongly implied places and organizations into `wiki/locations/` and `wiki/factions/`.
- Updated analysis guidance so the model is asked to surface two explicit side lists when relevant: ignored `wiki_noise`, and trait/trivia merged into character pages.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to RPG prompt construction, regression tests, and required stage-state documentation.
- Did not change storage/update behavior, schema data structures, frontend UI, or later v0.2 tasks such as `events/` versus `plot-arcs/` or `current-scene/` gating.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 3 from `docs/RPG_V0_2_TASKS.md`: fix the `events/` versus `plot-arcs/` boundary.
- Reuse the new object-type-first wording as the baseline for later prompt/lint work, especially tasks 3, 4, 5, and 8.

## 2026-06-02 19:30 - v0.2 task 1 player versus characters boundary hardening

### Stage

Post-v1 extraction-quality fix: harden `player/` versus `characters/` classification boundaries

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Tightened the schema-level `player/` boundary so it is only for the current player-created or explicitly declared player character, and explicitly excludes canon/original protagonists, POV roles, and game-controllable characters unless the source says they are the active RPG PC.
- Tightened the schema-level `characters/` boundary so original-work characters default there unless the source explicitly marks them as the current RPG player character.
- Rewrote the `characters.playerRelevance` field description so it now means only the known relationship, attitude, or interaction constraints with the current PC, with an explicit no-invention rule when no current PC exists.
- Updated RPG analysis prompt guidance to call out the hard `player/` versus `characters/` split before generation.
- Updated RPG generation routing guidance with concrete counterexamples required by the task, including `卫宫士郎 -> wiki/player/` as wrong, `卫宫士郎 -> wiki/characters/` as correct, and the `远坂凛` player-relevance misuse example.
- Updated `docs/RPG_WIKI_SCHEMA.md` so the human-facing schema document now matches the stricter runtime/schema rules.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the change limited to schema text, RPG prompt construction, documentation, and focused tests.
- Did not change storage/update behavior, frontend UI, legacy default-mode routing, or later v0.2 tasks.
- Preserved legacy `entities`, `concepts`, and `sources` compatibility.

### Next

- Continue with v0.2 task 2 from `docs/RPG_V0_2_TASKS.md`.
- Reuse the new boundary language as a regression baseline when tightening `events/`, `plot-arcs/`, and `current-scene` later.

## 2026-06-02 19:20 - v0.2 runner per-task Codex window support

### Stage

Post-v1 automation enhancement for window-isolated Codex task execution

### Changed files

- `scripts/run_rpg_v02_tasks.py`
- `docs/RPG_V0_2_AUTOMATION.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Confirmed that the existing runner did not execute task 1 yet; `.agent_runs/rpg_v02/state.json` still marks task 1 as `pending`.
- Confirmed that the runner already generated one prompt per task and launched a fresh agent process per task, but it previously ran the agent inline in the current terminal instead of opening a separate Codex CLI window.
- Added `--agent-launch-mode` with `auto | inline | new-window`.
- Made `auto` select `new-window` on Windows when the resolved agent executable is `codex`, so each task can now run in its own fresh Codex CLI window by default in that environment.
- Added per-task Windows launcher scripts under `.agent_runs/rpg_v02/launchers/` so the runner can open a dedicated PowerShell window, feed that task's generated prompt file into Codex, wait for completion, and still collect stdout/stderr logs plus exit code.
- Updated automation docs and current-state notes to document the new launch behavior and the exact command for executing task 1 in a new Codex window.

### Validation

- `python -m py_compile scripts/run_rpg_v02_tasks.py` passed.
- `python scripts/run_rpg_v02_tasks.py --dry-run` passed and now resolves `Agent launch mode: new-window` for Codex on Windows.
- `python scripts/run_rpg_v02_tasks.py --dry-run --only 1 --agent-command "codex exec" --agent-launch-mode new-window` passed.

### Scope notes

- This change enhances task execution automation only.
- It does not execute task 1 automatically.
- It does not change v0.2 extraction business logic.

### Next

- Validate the enhanced runner with `python -m py_compile scripts/run_rpg_v02_tasks.py`.
- Re-run `python scripts/run_rpg_v02_tasks.py --dry-run` to confirm prompt/state generation still works.
- If validation passes, execute task 1 with `--agent-launch-mode new-window`.

## 2026-06-02 10:10 - v0.2 task automation scaffold

### Stage

Post-v1 automation scaffold for llmWikiRPG v0.2 task execution

### Changed files

- `scripts/run_rpg_v02_tasks.py`
- `docs/RPG_V0_2_AUTOMATION.md`
- `.gitignore`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `scripts/run_rpg_v02_tasks.py` as a cross-platform Python runner for `docs/RPG_V0_2_TASKS.md`.
- Implemented numbered-task parsing from Markdown headings so each task is isolated and sent to a fresh agent process instead of one long session.
- Added prompt generation, state persistence, stdout/stderr capture, per-task summaries, selection by `--only` and `--from/--to`, and `--resume` support.
- Kept execution safe by supporting `--dry-run`, per-task confirmation by default, dirty-working-tree warnings, optional `--require-clean`, and stop-on-failure behavior unless `--continue-on-error` is requested.
- Added `docs/RPG_V0_2_AUTOMATION.md` to document preparation, dry-run, range execution, resume behavior, agent-command switching, and artifact locations.
- Added `.agent_runs/` to `.gitignore` so generated prompts, logs, summaries, and state stay local.
- Updated `docs/CURRENT_STATE.md` to record the new post-v1 automation entrypoint for v0.2 extraction-quality work.

### Validation

- `python -m py_compile scripts/run_rpg_v02_tasks.py` passed.
- `python scripts/run_rpg_v02_tasks.py --dry-run` passed and generated `task_01_prompt.md` through `task_10_prompt.md` under `.agent_runs/rpg_v02/prompts/`.

### Scope notes

- This change only adds automation scaffolding and documentation.
- It does not execute the v0.2 tasks automatically.
- It does not modify v0.2 business logic or the task source document itself.

### Next

- Run `python scripts/run_rpg_v02_tasks.py --dry-run` to verify task parsing and prompt generation.
- After dry-run succeeds, execute an individual task with `--only` or continue with `--resume`.

## 2026-06-02 09:50 - Post-v1 llmWikiRPG mode switch closure

### Stage

Post-v1 mode switch analysis and minimal runtime/bootstrap closure

### Changed files

- `docs/LLMWIKIRPG_MODE_SWITCH_ANALYSIS.md`
- `docs/LLMWIKIRPG_MODE_SWITCH_REPORT.md`
- `src/lib/project-mode.ts`
- `src/lib/project-mode.test.ts`
- `src/commands/fs.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/lib/wiki-mode.ts`
- `src/lib/wiki-mode.test.ts`
- `src/components/chat/chat-panel.tsx`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-smoke.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Performed the requested read-first diagnosis across project bootstrap, mode detection, frontend creation flow, ingest runtime, and RPG registry/schema wiring.
- Confirmed that the repository already had real RPG runtime support in category/schema/prompt/storage layers, but still lacked a first-class project mode switch and still defaulted new projects to legacy `llm_wiki` bootstrap behavior.
- Added `docs/LLMWIKIRPG_MODE_SWITCH_ANALYSIS.md` to record the concrete pre-change diagnosis, including the difference between heuristic RPG support and explicit mode support.
- Added a lightweight mode bootstrap layer in `src/lib/project-mode.ts` with two modes: `default` and `llmwikirpg`.
- Persisted project mode into `.llm-wiki/project.json` through the existing frontend project-creation flow by extending `src/commands/fs.ts`.
- Updated the create-project dialog so new projects can explicitly choose `llmwikirpg` mode; RPG-mode creation now writes RPG schema/purpose/index/overview/log content and creates RPG-first directories including `style`, `rules`, `quests`, and `memory`.
- Updated runtime mode detection so it now prefers explicit project metadata from `.llm-wiki/project.json`, while still accepting old `wikiMode: rpg` markers and directory-shape heuristics for compatibility.
- Corrected the manual ingest chat path to read `schema.md` and `purpose.md` from the real project root instead of probing `wiki/schema.md` and `wiki/purpose.md`.
- Added `docs/LLMWIKIRPG_MODE_SWITCH_REPORT.md` to document how to switch modes, what changed, how to create an `llmwikirpg` project, and what remains incomplete.

### Validation

- `npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts` passed: 4 test files, 29 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Kept the closure intentionally small and did not remove legacy `default` behavior.
- Did not perform a large-scale refactor of Rust-side project bootstrap; the frontend now applies the `llmwikirpg` bootstrap after the existing backend project creation step.
- Preserved compatibility with older explicit markers such as `wikiMode: rpg`.

### Next

- If a later post-v1 phase is defined, the most defensible next cleanup is moving mode-specific bootstrap deeper into a shared backend/bootstrap layer.
- A future iteration can also add a post-creation project-settings UI for changing mode, instead of relying on create-time selection plus `.llm-wiki/project.json` for existing projects.

## 2026-06-02 09:35 - Stage 12 cleanup review

### Stage

Stage 12: Cleanup review

### Changed files

- `docs/LLMWIKIRPG_USAGE.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 12 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_SMOKE_TEST_REPORT.md`, `docs/RPG_EXTRACTION_EVALUATION.md`, and `.codex/stages/12-cleanup-review.md`.
- Added `docs/LLMWIKIRPG_USAGE.md` as the first-version RPG operating guide, covering mode activation, the 11 implemented RPG directories, canonical dynamic-update semantics, compatibility notes, and current implementation limits.
- Added `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md` as the v1 handoff summary, consolidating what is complete, what remains incomplete, and which follow-up directions are most defensible for the next phase.
- Updated `docs/CURRENT_STATE.md` to mark Stage 12 complete, declare the Stage 00 through Stage 12 plan complete at v1 scope, and point future work to the new usage and summary documents.
- Recorded the remaining documentation inconsistency discovered during this cleanup: `docs/ROADMAP.md` still contains stale simplified status markers, so `docs/CURRENT_STATE.md` and `docs/IMPLEMENTATION_LOG.md` remain the authoritative completion record within this stage's allowed edit scope.

### Validation

- Documentation review only; no code or test files were changed in this stage.
- No additional automated tests were run because Stage 12 was limited to naming/documentation cleanup and final handoff notes.

### Scope notes

- Kept Stage 12 within the allowed documentation-only scope.
- Did not refactor production code, rename runtime identifiers, or change legacy compatibility behavior.
- Did not modify `docs/ROADMAP.md` because it was outside the allowed edit list for this stage; the inconsistency was recorded instead.

### Next

- The current Stage 00 through Stage 12 migration plan is complete.
- If work continues, define a new post-v1 phase plan starting from the limits and follow-up directions recorded in `docs/LLMWIKIRPG_IMPLEMENTATION_SUMMARY.md`.

## 2026-06-02 09:23 - Stage 11 RPG extraction evaluation

### Stage

Stage 11: RPG extraction evaluation

### Changed files

- `docs/RPG_EXTRACTION_EVALUATION.md`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 11 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_MAPPING.md`, `docs/RPG_SMOKE_TEST_REPORT.md`, and `.codex/stages/11-rpg-extraction-evaluation.md`.
- Reviewed the Stage 10 smoke-test boundary carefully and recorded the main code/document reality: Stage 10 uses mocked LLM FILE-block output, so it validates routing and storage semantics but does not directly prove real-model extraction quality.
- Added `docs/RPG_EXTRACTION_EVALUATION.md` to document the evaluation scope, concrete findings, the real-model-quality limitation, and the exact minimal Stage 11 fix.
- Identified one smoke-backed prompt/schema ambiguity worth fixing: the smoke flow included a generated `wiki/current-scene/state.md` FILE block that only became canonical because the writer normalized it to `wiki/current-scene/scene_state.md`.
- Tightened `src/lib/ingest.ts` so RPG generation guidance now explicitly tells the model to use the exact first-version snapshot file `wiki/current-scene/scene_state.md` unless a project schema explicitly overrides that file path.
- Tightened `src/lib/rpg-wiki-schema.ts` so the `current-scene` schema granularity is now an exact-file requirement instead of a loose example.
- Updated prompt/schema tests so the Stage 11 fix is locked in.

### Validation

- `npx vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-smoke.test.ts` passed: 3 test files, 25 tests.
- `npm run typecheck` passed.

### Scope notes

- Kept Stage 11 within the allowed scope: evaluation documentation plus minimal prompt/schema tightening.
- Did not add a real-model evaluation harness, browser UI pass, or broader extraction-scoring framework, because those would exceed the evidence and scope available from the Stage 10 mocked smoke setup.
- Did not refactor storage, compatibility, or frontend behavior.

### Next

- Proceed to Stage 12: cleanup review.
- Stage 12 should focus on final naming/doc consistency and a concise implementation summary, while preserving the Stage 11 limitation note that real-model extraction quality still requires a future non-mocked evaluation pass.

## 2026-06-02 09:16 - Stage 10 RPG smoke test

### Stage

Stage 10: RPG smoke test

### Changed files

- `src/lib/rpg-smoke.test.ts`
- `docs/RPG_SMOKE_TEST_REPORT.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 10 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.codex/stages/10-rpg-smoke-test.md`.
- Added `src/lib/rpg-smoke.test.ts` as a focused Stage 10 smoke test using mocked LLM responses but the real ingest pipeline, real filesystem writes, and an explicitly RPG-marked temp project.
- Built a small sequential RPG sample across world setting, character card, and two scene-progress turns so the test covers first-version directory routing plus the two most important live-state storage behaviors.
- Verified representative writes under all first-version RPG directories: `sources`, `world`, `characters`, `player`, `locations`, `factions`, `items`, `plot-arcs`, `events`, `current-scene`, and `relationships`.
- Verified that the smoke scenario did not create legacy `wiki/entities/` or `wiki/concepts/` pages.
- Verified that `current-scene` writes normalize to `wiki/current-scene/scene_state.md` and overwrite prior scene state, while `events/timeline.md` appends later event content instead of replacing earlier entries.
- Verified helper-level display-chain behavior by asserting RPG mode detection, wiki type inference, and RPG retrieval prioritization on the resulting RPG paths.
- Wrote the concrete smoke-test method, scope, and results to `docs/RPG_SMOKE_TEST_REPORT.md`.

### Validation

- `npx vitest run src/lib/rpg-smoke.test.ts` passed: 1 test file, 1 test.
- `npm run typecheck` passed.

### Scope notes

- Kept Stage 10 within test/report scope; no production business logic was changed.
- Kept the smoke test deterministic by mocking the LLM boundary instead of turning Stage 10 into real-model quality evaluation.
- Recorded the main limitation explicitly: browser/manual UI rendering and real-model extraction quality remain for Stage 11 evaluation rather than being overstated here.

### Next

- Proceed to Stage 11: RPG extraction evaluation.
- Stage 11 should use the smoke-test outputs and sample structure to inspect real extraction quality, misroutes, missing fields, and dynamic-state contamination risks.

## 2026-06-02 09:10 - Stage 09 legacy compatibility

### Stage

Stage 09: Legacy compatibility

### Changed files

- `src/lib/wiki-mode.ts`
- `src/lib/wiki-mode.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/components/chat/chat-panel.tsx`
- `src/lib/rpg-query-priority.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 09 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.codex/stages/09-legacy-compatibility.md`.
- Reviewed the current regression surface and identified the main default-mode risk: Stage 05 prompt construction and Stage 08 chat retrieval upgrades were RPG-aware without an explicit project-mode gate.
- Added `src/lib/wiki-mode.ts` as a minimal compatibility layer with `WikiMode = "default" | "rpg"`, supporting both explicit text markers such as `wikiMode: rpg` and conservative inference from schema/index/directory structure.
- Updated `src/lib/ingest.ts` so RPG analysis guidance and RPG directory-routing instructions are only injected when the project is detected as RPG mode, keeping legacy/default ingest prompts on the prior entity/concept/custom-schema path.
- Updated `src/components/chat/chat-panel.tsx` so RPG search-result prioritization and mandatory live-context injection only run in detected RPG projects, preventing non-RPG custom projects that happen to use paths like `wiki/characters/` from being treated as RPG by default.
- Added focused tests for wiki-mode detection and updated prompt tests to cover both default-mode and RPG-mode behavior explicitly.

### Compatibility decisions

- Kept legacy `entities`, `concepts`, `sources`, `queries`, and existing saved-query behavior intact.
- Did not add a persisted project setting, migration step, or UI toggle in this stage; the compatibility layer stays intentionally small by using explicit text markers plus directory/schema inference.
- Kept all previously added RPG registries, schema entries, storage strategies, and frontend affordances in place; Stage 09 only gates when RPG-first behavior activates.
- Kept backend search, project templates, and project skeleton creation unchanged.

### Validation

- `npx vitest run src/lib/wiki-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-query-priority.test.ts` passed: 3 test files, 29 tests.
- `npx vitest run src/lib/ingest.scenarios.test.ts` passed: 1 test file, 8 tests.
- `npm run typecheck` passed.

### Not changed

- No project-template creation flow or Rust project bootstrap logic was changed.
- No storage/update semantics for RPG pages were changed beyond the existing Stage 06 and Stage 07 behavior.
- No frontend tree grouping, reference rendering, or graph-affinity logic was removed.

### Next

- Proceed to Stage 10: RPG smoke test.
- Stage 10 should verify that detected RPG projects route content into the RPG directories while default/legacy scenarios still remain on their existing paths.

## 2026-06-02 09:00 - Stage 08 RPG frontend UI

### Stage

Stage 08: RPG frontend UI

### Changed files

- `src/components/layout/knowledge-tree.tsx`
- `src/lib/wiki-type-style.ts`
- `src/lib/wiki-type-style.test.ts`
- `src/components/chat/chat-panel.tsx`
- `src/components/chat/chat-message.tsx`
- `src/lib/graph-relevance.ts`
- `src/lib/rpg-query-priority.ts`
- `src/lib/rpg-query-priority.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 08 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.codex/stages/08-rpg-frontend-ui.md`.
- Confirmed the backend search command already scans all `wiki/**/*.md`, so Stage 08 focused on frontend grouping, styling, retrieval priority, and navigation rather than changing the backend search surface.
- Updated `src/components/layout/knowledge-tree.tsx` so first-version RPG directories are shown as first-class groups with explicit labels, icons, ordering, and default expansion instead of falling through the generic custom-type bucket.
- Updated `src/lib/wiki-type-style.ts` so RPG pages now get explicit type chips and accent styling in shared frontend surfaces such as the frontmatter panel.
- Added `src/lib/rpg-query-priority.ts` and connected it in `src/components/chat/chat-panel.tsx` so chat retrieval prefers live RPG context pages when available, and injects mandatory snapshot/state pages from `current-scene`, `player`, `events`, and `plot-arcs` before the normal search-result fill.
- Extended `src/lib/graph-relevance.ts` with first-pass RPG type affinities so graph-based expansion is less biased toward the legacy `entity`/`concept` model when RPG pages are linked together.
- Updated `src/components/chat/chat-message.tsx` so reference badges show RPG-aware icons/colors and wiki-link/reference navigation now resolves RPG directories instead of only probing legacy paths.
- Added focused tests for the new retrieval-priority helper and expanded the shared type-style tests to cover RPG categories.

### Compatibility decisions

- Kept legacy `entities`, `concepts`, `sources`, `queries`, `comparisons`, `synthesis`, and related UI groups available; Stage 08 only reorders and augments the frontend rather than removing legacy paths.
- Kept the backend `search_project` command unchanged because it already covers RPG directories recursively.
- Kept the Stage 08 retrieval upgrade intentionally small and frontend-side: no new runtime context compiler, no rules/style retrieval system, and no broad graph/search refactor were introduced.
- Kept raw-source access, delete behavior, and saved-query behavior intact.

### Validation

- `npm run typecheck` passed.
- `npx vitest run src/lib/wiki-type-style.test.ts src/lib/wiki-page-types.test.ts src/lib/rpg-query-priority.test.ts` passed: 3 test files, 21 tests.

### Not changed

- No backend search command, ingest writer, prompt, or storage strategy was changed in this stage.
- No large-scale frontend redesign or new dedicated RPG page layout was introduced; the work stayed within navigation, type styling, and query/retrieval behavior.
- No project template or directory-creation logic was changed.

### Next

- Proceed to Stage 09: legacy compatibility.
- Stage 09 should preserve default-mode behavior explicitly and review whether any new RPG-first frontend/query assumptions need a mode gate or fallback path.

## 2026-06-02 08:45 - Post-Stage 07 state doc correction

### Stage

Documentation consistency correction

### Changed files

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Corrected a stale `docs/CURRENT_STATE.md` note that still said no Codex stage had executed yet after the automation migration.
- Recorded the actual state: Stage 07 has now been executed successfully through `scripts/run-codex-stages.ps1`.
- Made no business-logic changes in this correction.

### Next

- Proceed from the updated state baseline to Stage 08 when ready.

## 2026-06-02 08:42 - Stage 07 RPG dynamic update

### Stage

Stage 07: RPG dynamic update

### Changed files

- `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`
- `src/lib/rpg-dynamic-update.ts`
- `src/lib/rpg-dynamic-update.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 07 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.codex/stages/07-rpg-dynamic-update.md`.
- Added `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md` to define the update boundary between `current-scene`, `events`, `plot-arcs`, `player`, `characters`, and `relationships`.
- Recorded the current code/document difference that Stage 06 already normalized `current-scene` writes to `wiki/current-scene/scene_state.md` even though earlier architecture examples still mention `main.md`.
- Added `src/lib/rpg-dynamic-update.ts` as a minimal Stage 07 helper for writer-boundary RPG dynamic safeguards.
- Added an `events` pollution guard that skips writes when a generated event page contains obvious future-planning headings such as next-step or possible-direction sections, because that content belongs in `plot-arcs`.
- Added pre-merge stale-state cleanup for merge-based RPG dynamic pages so existing `player`, `characters`, `relationships`, and `plot-arcs` pages drop recognized volatile headings before generic page merge runs.
- Updated `buildGenerationPrompt()` in `src/lib/ingest.ts` so the model is explicitly told to keep future-planning sections out of `events` and to fully rewrite dynamic state sections for `player`, `characters`, `relationships`, and `plot-arcs`.
- Added focused tests for the new prompt constraints, the dynamic update helper, and the event pollution guard in the ingest integration path.

### Compatibility decisions

- Kept Stage 06 storage modes intact: `current-scene` still overwrites and `events` still append when accepted.
- Kept legacy `entities`, `concepts`, `sources`, `queries`, and non-RPG merge behavior unchanged.
- Kept the Stage 07 enforcement intentionally small and writer-boundary only instead of introducing a new global runtime/state engine.
- Used heading-based stale-section cleanup for the first pass rather than a larger semantic diff system, because the stage scope allows only minimal code changes.

### Validation

- `npx vitest run src/lib/rpg-dynamic-update.test.ts src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts` passed: 3 test files, 30 tests.
- `npm run typecheck` passed.

### Not changed

- Frontend navigation, grouping, and RPG-focused display priority were not modified.
- Search/retrieval context priority for `current-scene`, `player`, rules/style, and recent events was not modified.
- No runtime context-pack, contradiction engine, or deep cross-page causal reconciliation was added.
- Legacy project template creation remains unchanged.

### Next

- Proceed to Stage 08: RPG frontend UI.
- Stage 08 should expose the RPG directory model clearly in the UI, especially `current-scene`, `events`, `player`, and other first-version RPG categories added in earlier stages.

## 2026-06-02 - Migrate automation scaffold from opencode to Codex

### Stage

Automation scaffold migration only

### Changed files

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`
- `.codex/stages/00-baseline-confirmation.md`
- `.codex/stages/01-category-system-analysis.md`
- `.codex/stages/02-rpg-category-mapping.md`
- `.codex/stages/03-rpg-category-registry.md`
- `.codex/stages/04-rpg-wiki-schema-config.md`
- `.codex/stages/05-rpg-extraction-prompt.md`
- `.codex/stages/06-rpg-backend-storage.md`
- `.codex/stages/07-rpg-dynamic-update.md`
- `.codex/stages/08-rpg-frontend-ui.md`
- `.codex/stages/09-legacy-compatibility.md`
- `.codex/stages/10-rpg-smoke-test.md`
- `.codex/stages/11-rpg-extraction-evaluation.md`
- `.codex/stages/12-cleanup-review.md`
- `scripts/run-codex-stages.ps1`

### Summary

- Switched the default automation platform from opencode to Codex without changing business logic.
- Created `.codex/stages/00` through `.codex/stages/12` as the new default stage prompt set for Codex-driven execution.
- Kept `.opencode/stages/` in place as historical reference instead of deleting it.
- Standardized each Codex stage prompt to require rereading `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, and `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md` before work.
- Added the required guardrails to each Codex stage prompt, including no cross-stage work, no large refactors, no legacy deletion, no auto commit/push, and no dangerous flags such as `--yolo` or `--dangerously-bypass-approvals-and-sandbox`.
- Added `scripts/run-codex-stages.ps1` with `-From`, `-Until`, `-StageDir`, `-CodexCommand`, and `-DryRun` support.
- Centralized Codex CLI invocation inside `Invoke-CodexStage` so future CLI argument changes only need one script edit.
- Updated `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, and the phase-plan table heading so the default workflow now points to Codex.

### Compatibility decisions

- Did not modify RPG extraction, storage, frontend, search, or compatibility business logic.
- Did not delete the legacy `.opencode/stages/` prompts or the old `scripts/run-opencode-stages.ps1`.
- Preserved historical implementation log entries that still mention opencode.

### Validation

- `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -DryRun` passed and listed stages 00 through 12 from `.codex/stages/`.
- No stage prompt was executed in this update.

### Not changed

- No production code paths under `src/` or `src-tauri/` were modified in this automation migration.
- No tests were changed in this automation migration.
- No `git commit` or `git push` was performed.

### Next

- Use `scripts/run-codex-stages.ps1` as the default runner for the next phase.
- Resume implementation at Stage 07: RPG dynamic update.

## 2026-06-01 23:20 - Stage 06 RPG backend storage

### Stage

Stage 06: RPG backend storage

### Changed files

- `src/lib/ingest.ts`
- `src/lib/ingest.scenarios.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 06 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.opencode/stages/06-rpg-backend-storage.md`.
- Confirmed the existing parser and safety gate already allow safe `wiki/<directory>/...` paths, so Stage 06 focused on writer/update semantics rather than path parser changes.
- Added a small writer-side RPG storage strategy resolver in `src/lib/ingest.ts` using the Stage 04 RPG schema update strategies.
- Normalized all writes under `wiki/current-scene/` to `wiki/current-scene/scene_state.md` and made that path overwrite-only, preserving the current-scene snapshot semantics.
- Made RPG `append` categories, including `events` and `sources`, append new markdown body content when the target file already exists, so event timelines are not merged or overwritten.
- Kept RPG `merge` and `cautious-merge` categories on the existing `mergePageContent()` path, preserving frontmatter source merging and legacy content-page behavior.
- Kept legacy `wiki/log.md` append behavior, listing-page overwrite behavior, source-summary canonicalization, and legacy `entities`/`concepts`/`queries` merge behavior intact.
- Expanded the language-guard skip set to include RPG schema directories, matching the existing entity/source allowance for proper nouns and cross-language RPG names.
- Added focused ingest scenario tests for `current-scene` overwrite semantics and `events` append semantics.

### Compatibility decisions

- Did not delete or rename legacy `entities`, `concepts`, `sources`, `queries`, `comparisons`, `synthesis`, or related fallback behavior.
- Did not change the FILE block protocol or project schema routing rules.
- Did not add a project mode switch; Stage 09 remains responsible for broader legacy/RPG compatibility mode decisions.
- Did not change project skeleton/template directory creation. RPG directories are created lazily by the existing writer when RPG pages are emitted.

### Validation

- `npx vitest run src/lib/ingest.scenarios.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/wiki-page-types.test.ts` passed: 3 test files, 20 tests.
- `npm run typecheck` passed.

### Not changed

- Frontend navigation and type styling were not modified.
- Chat retrieval priority and RPG runtime context compilation were not modified.
- Deep dynamic reconciliation was not implemented: Stage 07 still needs explicit handling for stale current state, player/character/relationship merges, relationship-event separation, and event/plot-arc pollution risks.
- Source lifecycle cleanup, delete behavior, embeddings, and graph relevance were not modified.

### Next

- Proceed to Stage 07: RPG dynamic update.
- Stage 07 should document and implement the deeper dynamic update policy for `current-scene`, `events`, `player`, `characters`, `relationships`, and `plot-arcs` beyond the writer-level append/overwrite/merge strategies introduced here.

## 2026-06-01 22:55 - Stage 05 RPG extraction prompt

### Stage

Stage 05: RPG extraction prompt

### Changed files

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 05 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.opencode/stages/05-rpg-extraction-prompt.md`.
- Located the existing extraction prompt construction in `src/lib/ingest.ts`: `buildAnalysisPrompt()` and `buildGenerationPrompt()`.
- Added RPG-aware analysis guidance so Stage 1 analysis distinguishes confirmed facts, speculation, current state, historical events, player state, NPC state, relationship changes, and foreshadowing.
- Added generation-time RPG directory routing guidance generated from `RPG_WIKI_SCHEMA`, including extraction goals, fields, exclusions, update strategies, and granularity for the 11 first-version RPG categories.
- Added explicit dynamic-state prompt rules for `current-scene`, `events`, `plot-arcs`, `player`, `characters`, `relationships`, and `sources`.
- Added focused prompt tests verifying the RPG guidance appears in analysis and generation prompts.

### Compatibility decisions

- Kept the existing `---FILE` / `---REVIEW` output protocol unchanged.
- Kept project schema routing authoritative and retained legacy `wiki/entities/` and `wiki/concepts/` fallback guidance when no more specific schema/RPG route is available.
- Did not delete or rename legacy `entities`, `concepts`, `sources`, `queries`, or other default categories.

### Validation

- `npx vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/wiki-page-types.test.ts` passed: 3 test files, 31 tests.
- `npm run typecheck` passed.

### Not changed

- Parser and path safety logic were not modified.
- Storage/write/update behavior was not modified.
- Project skeleton/template directory creation was not modified.
- Frontend navigation and styling were not modified.
- Dynamic update semantics are only prompt guidance at this stage; backend overwrite/append/merge behavior remains for Stage 06/07.

### Next

- Proceed to Stage 06: RPG backend storage.
- Stage 06 should make generated RPG paths and update strategies concrete in writer/storage behavior while preserving legacy compatibility.

## 2026-06-01 22:35 - Stage 04 RPG wiki schema config

### Stage

Stage 04: RPG wiki schema config

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a code-readable RPG wiki schema config for the 11 first-version RPG categories.
- Kept category label/path metadata derived from `src/lib/rpg-categories.ts` instead of duplicating registry definitions.
- Added extraction goals, required and optional fields, exclusions, update strategies, and granularity metadata for RPG categories.
- Documented `style`, `rules`, and `runtime` as deferred or auxiliary schema areas, not first-version category entries.

### Validation

- `npx vitest run src/lib/rpg-wiki-schema.test.ts src/lib/wiki-page-types.test.ts` passed: 2 test files, 13 tests.
- `npm run typecheck` passed.

### Not changed

- Extraction prompt logic was not modified.
- Storage/write/update behavior was not modified.
- Frontend navigation and styling were not modified.
- Project skeleton/template directory creation was not modified.

### Next

- Proceed to Stage 05: RPG extraction prompt.
- Stage 05 should consume the registry/schema in prompt construction without changing writer semantics.

## 2026-06-01 22:25 - Stage 03 RPG category registry

### Stage

Stage 03: RPG category registry

### Changed files

- `src/lib/rpg-categories.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 03 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, `docs/RPG_CATEGORY_MAPPING.md`, and `.opencode/stages/03-rpg-category-registry.md`.
- Confirmed there was no existing single category registry. The closest low-risk integration point was `src/lib/wiki-page-types.ts`, which already owns generation-recognized types and path-based type inference.
- Added `src/lib/rpg-categories.ts` as the first-version RPG category registry with `id`, `label`, `path`, `description`, `dynamic`, `multipleFiles`, and `requireSource` metadata.
- Registered the 11 Stage 03 RPG categories: `sources`, `world`, `characters`, `player`, `locations`, `factions`, `items`, `plot-arcs`, `events`, `current-scene`, and `relationships`.
- Connected the registry to `GENERATION_WIKI_TYPES`, path inference, and `wikiTypeLabel()` so RPG directories are recognized without replacing legacy category behavior.
- Added focused tests for registry contents, lookups, RPG path inference, label lookup, and generation type availability.

### Compatibility decisions

- Legacy `entities`, `concepts`, `sources`, `queries`, `comparisons`, `synthesis`, `findings`, `methodology`, and `thesis` type inference remains in place.
- `wiki/sources/` still infers the legacy `source` type because legacy source-summary and source-lifecycle behavior depends on that singular type. The registry still includes RPG `sources` metadata for later RPG schema/storage stages.
- No project skeleton, prompt, file writer, dynamic update, frontend navigation, graph, or retrieval behavior was changed in this stage.

### Validation

- Initial validation failed because local dependencies were not installed: `tsc` was unavailable and `npx vitest` could not resolve local `vite` packages.
- Ran `npm install` to restore local dependencies for validation. `git status` did not report `package.json` or lockfile modifications afterward.
- `npm run typecheck` passed.
- `npx vitest run src/lib/wiki-page-types.test.ts` passed: 1 test file, 9 tests.

### Not changed

- Extraction prompt logic was not modified.
- Storage/write/update semantics were not modified.
- Frontend navigation and type styling were not modified.
- Project creation templates and default directories were not modified.
- Legacy category behavior was not removed.

### Next

- Proceed to Stage 04: RPG wiki schema config.
- Stage 04 should add code-readable schema details for the 11 core RPG categories and keep it aligned with, but not duplicated against, the Stage 03 category registry.
- Later stages still need to decide how RPG mode handles `wiki/sources/` frontmatter typing versus the plural registry category id.

## 2026-06-01 23:05 - Stage 02 RPG category mapping

### Stage

Stage 02: RPG category mapping

### Changed files

- `docs/RPG_CATEGORY_MAPPING.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 02 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`, and `.opencode/stages/02-rpg-category-mapping.md`.
- Created `docs/RPG_CATEGORY_MAPPING.md` to define the mapping between legacy `llm_wiki` categories and the first-version RPG category set.
- Classified the RPG directories into source tracking, static setting, RPG entities, dynamic state, timeline events, current scene, and relationship network categories.
- Mapped legacy `entities` to `characters`, `locations`, `factions`, and `items` while preserving the legacy directory for compatibility.
- Mapped legacy `concepts` to `world`, `plot-arcs`, and `relationships` while preserving the legacy directory for compatibility.
- Preserved `sources` directly as the source/evidence layer.
- Recorded that `queries` remains a legacy/default saved-answer path with no first-version RPG replacement.
- Defined the first-version boundary for `style`, `rules`, and `runtime`: they remain later schema/runtime extensions and are not required Stage 03 category-registry targets.

### Mapping decisions

- The first-version RPG category targets are the 11 core directories from `AGENTS.md` and the phase plan: `sources`, `world`, `characters`, `player`, `locations`, `factions`, `items`, `plot-arcs`, `events`, `current-scene`, and `relationships`.
- `sources` must remain available and should store provenance/source summaries rather than canonical RPG state.
- `entities` and `concepts` must not be deleted. They are compatibility/default-mode concepts that RPG mode specializes into concrete directories.
- `events` is only for confirmed, already-happened events. Future plans, speculation, and foreshadowing belong in `plot-arcs`.
- `current-scene` is a snapshot category and should be overwritten or replaced in later update logic rather than appended as history.
- `style`, `rules`, and `runtime` are important schema areas but are not first-version category-mapping targets in this stage.

### Not changed

- Business logic was not modified.
- Extraction logic was not modified.
- Storage logic was not modified.
- Frontend logic was not modified.
- Schema/config code was not modified.
- Tests were not modified.

### Next

- Proceed to Stage 03: RPG category registry.
- Stage 03 should introduce a registry for the 11 core RPG directories while keeping legacy type inference and existing directories compatible.
- Stage 04 should convert the 11 core schema definitions into code-readable configuration and keep `style`, `rules`, and `runtime` documented as deferred or auxiliary schema areas unless the phase plan is explicitly expanded.

## 2026-06-01 22:35 - Stage 01 category system analysis

### Stage

Stage 01: Category system analysis

### Changed files

- `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 01 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, and `.opencode/stages/01-category-system-analysis.md`.
- Located legacy category definition entry points in `src-tauri/src/commands/project.rs`, `src/lib/templates.ts`, and `src/lib/wiki-page-types.ts`.
- Located extraction prompt entry points in `src/lib/ingest.ts`, including `buildAnalysisPrompt()`, `buildGenerationPrompt()`, long-source chunk prompts, and review suggestion prompts.
- Located LLM output parsing and write entry points in `parseFileBlocks()`, `isSafeIngestPath()`, `writeFileBlocks()`, source summary fallback logic, and related merge/write behavior.
- Located frontend reading and display entry points in `App`, `AppLayout`, `KnowledgeTree`, `PreviewPanel`, `WikiReader`, `FrontmatterPanel`, and wiki type style helpers.
- Located query, retrieval, graph, and saved-answer entry points in `ChatPanel`, `searchWiki()`, backend `search_project`, `graph-relevance.ts`, `wiki-graph.ts`, and `SaveToWikiButton`.
- Wrote the detailed analysis to `docs/RPG_CATEGORY_SYSTEM_ANALYSIS.md`.

### Findings

- There is no single existing category registry. Category assumptions are distributed across templates, prompts, type inference, UI grouping/styling, retrieval affinity, source lifecycle helpers, and tests.
- `queries` is also a major legacy category and save target, even though the Stage 01 keyword list focused more on `entities`, `concepts`, `sources`, `comparisons`, `synthesis`, `findings`, `methodology`, and `thesis`.
- The ingest parser and safety gate are already broadly directory-agnostic because they allow safe paths under `wiki/`.
- The generation prompt already prefers schema-defined custom directories before falling back to `wiki/entities/` and `wiki/concepts/`.
- Current dynamic write behavior is not RPG-aware: regular content pages are merged, `wiki/log.md` is appended, and listing pages are overwritten. There is not yet special overwrite/append/merge behavior for `current-scene`, `events`, `player`, `characters`, or `relationships`.
- Backend search already scans all `wiki/**/*.md`, but RPG mode still needs mandatory context priority for current scene, player state, style/rules, and recent events.

### Not changed

- Business logic was not modified.
- Extraction logic was not modified.
- Storage logic was not modified.
- Frontend logic was not modified.
- Schema/config code was not modified.
- Tests were not modified.

### Next

- Proceed to Stage 02: RPG category mapping.
- Resolve whether `style/`, `rules/`, and `runtime/` are first-version category targets or later runtime/schema extensions, because `AGENTS.md` emphasizes 11 core target directories while `RPG_WIKI_SCHEMA.md` and the architecture plan also include these additional directories.
- Include `queries` explicitly in the legacy mapping and compatibility strategy.

## 2026-06-01 22:05 - Stage 00 baseline confirmation

### Stage

Stage 00: Baseline confirmation

### Changed files

- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Read the required Stage 00 documents: `AGENTS.md`, `docs/ROADMAP.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/LLMWIKIRPG_IMPLEMENTATION_PHASE_PLAN.md`, `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, and `.opencode/stages/00-baseline-confirmation.md`.
- Confirmed the core RPG design documents exist and are usable.
- Confirmed the architecture document's named core code files exist in the current tree, including project creation, ingest, chat, search, filesystem, template, graph relevance, context budget, and project mutex modules.
- Confirmed business logic migration has not started in Stage 00 and no extraction, storage, frontend, or schema code was modified.

### Baseline differences and risks recorded

- Legacy `entities`, `concepts`, and `sources` assumptions remain present in the current implementation, including project skeleton creation, wiki page type inference, tests, source/reference helpers, and backend search/project tests.
- `AGENTS.md` lists the 11 core RPG target directories, while `docs/RPG_WIKI_SCHEMA.md` and `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md` also define `style/`, `rules/`, and `runtime/`. This should be resolved or explicitly mapped in Stage 01/02 before implementation stages.
- The previous automated Stage 00 runner attempt reached the opencode subprocess but timed out after 120 seconds; this Stage 00 confirmation was completed manually in the current session.

### Not changed

- Business logic was not modified.
- Extraction logic was not modified.
- Storage logic was not modified.
- Frontend logic was not modified.
- Schema/config code was not modified.

### Next

- Proceed to Stage 01: category system analysis.
- If the automated runner times out again, execute `.opencode/stages/01-category-system-analysis.md` manually and keep updating `docs/CURRENT_STATE.md` plus `docs/IMPLEMENTATION_LOG.md` after the stage.

## 2026-06-01 21:37 - Fix single-stage runner range

### Stage

Automation scaffold fix

### Changed files

- `scripts/run-opencode-stages.ps1`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Wrapped the stage file pipeline in an array expression so a single matched stage still supports `.Count` under strict mode.
- Kept the completed stage collection array-shaped when adding entries.
- Re-ran `powershell -ExecutionPolicy Bypass -File scripts/run-opencode-stages.ps1 -From 0 -Until 0`; the original `.Count` error is fixed and the script reaches the Stage 00 opencode subprocess.

### Follow-up

- The verification run timed out after 120 seconds while Stage 00 was running in opencode. Re-run with a longer timeout or check whether opencode is waiting for interactive input.

## 2026-06-01 21:25 - Bootstrap automation scaffold

### Stage

Automation scaffold only

### Changed files

- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `.opencode/stages/00-baseline-confirmation.md`
- `.opencode/stages/01-category-system-analysis.md`
- `.opencode/stages/02-rpg-category-mapping.md`
- `.opencode/stages/03-rpg-category-registry.md`
- `.opencode/stages/04-rpg-wiki-schema-config.md`
- `.opencode/stages/05-rpg-extraction-prompt.md`
- `.opencode/stages/06-rpg-backend-storage.md`
- `.opencode/stages/07-rpg-dynamic-update.md`
- `.opencode/stages/08-rpg-frontend-ui.md`
- `.opencode/stages/09-legacy-compatibility.md`
- `.opencode/stages/10-rpg-smoke-test.md`
- `.opencode/stages/11-rpg-extraction-evaluation.md`
- `.opencode/stages/12-cleanup-review.md`
- `scripts/run-opencode-stages.ps1`

### Summary

- Created the cross-stage automation scaffold for llmWikiRPG migration.
- Added stage prompts that run one phase per fresh opencode process.
- Added state and roadmap documents for context handoff between stages.
- Added a PowerShell runner with stage range, dry run, failure stop, and resume support.

### Not changed

- Business logic was not modified.
- Extraction logic was not modified.
- Storage logic was not modified.
- Frontend logic was not modified.
- Schema code was not modified.

### Next

- Run `scripts/run-opencode-stages.ps1` with the desired stage range.
