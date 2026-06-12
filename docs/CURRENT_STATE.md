# Current State

## 2026-06-12 - Runtime Review Fixes

- Fixed Recall Selector validation so selected item visibility / knowledge scopes must match the retrieval index entry, selected sections must match their section scope boundary, returned recall budgets cannot exceed the local input budget, selected item / section counts are capped by the input budget, and `fullPage` is rejected when `input.recallPolicy.allowFullPageRead` is false.
- Fixed World Tick input building so `wiki/events/*.md` pages remain pre-action history constraints in `preActionRefs` but are no longer converted into `ongoingEvents`. First-version `ongoingEvents` now come from `preActionSnapshot.pendingReactions`.
- Fixed `runtime_update_apply` stage-pending handling so structured RuntimeUpdateProposalResult audit fields (`skippedDeltas`, `outlineRevisionReviewItems`, `journalEntries`, `pacingUpdateProposal`, and `proposalGroups`) are preserved as review / warning audit output while ordinary pending updates still come only from `proposedWikiUpdates`.
- Updated mock tests to use structured RuntimeUpdateProposalResult JSON instead of legacy `rpg-wiki-update` fenced blocks, and initialized `ingest-source-path-collision` fixtures with explicit `.llm-wiki/project.json` and `wikiMode: llmwikirpg`.
- Added `.codegraph/` and `.codex/config.toml` to `.gitignore` as local agent artifacts; user files were not deleted.
- Validation passed: `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/ingest-source-path-collision.test.ts` (4 files, 40 tests); `npm.cmd run typecheck`; `npm.cmd run test:mocks` (127 files, 1654 tests).
- No legacy/default fallback, git commit, or git push was added.

## 2026-06-12 - Final Architecture Runtime Diagram Sync

- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` to reflect the current implemented runtime architecture after the context compiler removal.
- Verified the current source before editing: `src/lib/rpg-runtime/context-compiler.ts` and `src/lib/rpg-runtime/runtime-agent.ts` are absent; `src/lib/rpg-runtime/index.ts` no longer exports `compileRpgContext()` or `runRpgRuntimePreview()`; `runRpgTurn()` now uses module-specific input builders and handoffs through action resolver, world tick, recall selector, outline brief, optional story outline regenerator, narration generator, and runtime update proposal.
- Replaced the old architecture diagram's centralized Context Compiler / CompactStoryBrief path with the actual module-specific runtime chain and `.llm-wiki/runtime` metadata / pending-review path.
- Cleaned stale final-architecture wording that described a remaining `legacy_compact_brief_builder`; the active architecture now records that the main runtime path does not keep a centralized total brief.
- Validation was documentation-focused: `rg --encoding utf-8` checks were run for `legacy_context_compiler`, `legacy_compact`, `CompactStoryBrief`, `context_compiler`, `Context Compiler`, `上下文编译器`, `compileRpgContext`, and `runRpgRuntimePreview` across the final architecture doc and relevant runtime source. The final architecture doc no longer contains the removed compiler / compact-brief names; the only source-side `context_compiler` residue found is the inactive stage type union entry in `src/lib/rpg-interactions/registry.ts`.
- Documentation-only update; no source code, runtime behavior, schema constants, tests, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stage G

- Completed `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` stage G only.
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts` so formal `runRpgTurn()` no longer calls `runRpgRuntimePreview()` or `compileRpgContext()` at any point in the turn. The flow now remains `submittedAction -> buildActionResolverInputFromWiki() -> action_resolver -> buildWorldTickInputFromWiki() -> world_tick -> buildPostActionWorkingState() -> buildRecallSelectorInputFromTurnStateAndWiki() -> recall_selector -> createRecallSelectorHandoff() -> buildOutlineBriefInputFromTurnStateAndWiki() -> outline_brief -> optional story_outline_regenerator -> buildNarrationGeneratorInputFromHandoffs() -> narration_generator -> turnRecord`.
- Removed `RunRpgTurnResult.brief` and the old `buildActionResolverInputFromBrief()`, `buildWorldTickInputFromBrief()`, and `buildNarrationGeneratorInputFromTurnState({ brief })` helpers from `turn-orchestrator.ts`.
- Updated `src/lib/rpg-runtime/runtime-controller.ts` so `RunRpgRuntimeTurnFlowResult` no longer exposes `brief`; runtime update proposal still builds from `turn.turnRecord`.
- Removed shared preview/compiler types from `src/lib/rpg-runtime/types.ts` and stopped exporting preview/compiler from `src/lib/rpg-runtime/index.ts`.
- Deleted `src/lib/rpg-runtime/context-compiler.ts` and `src/lib/rpg-runtime/runtime-agent.ts`; the legacy preview/context compiler is not retained as a debug helper.
- Updated `src/lib/rpg-runtime/recall-selector-handoff.ts` so the lightweight turn-state retrieval helper no longer accepts or indexes a compact brief.
- Updated tests to remove `result.brief` assertions and to prove the formal turn/controller result surface no longer contains a brief. `src/lib/rpg-runtime.test.ts` now checks the removed preview/compiler entry points are absent from the public runtime API.
- Validation passed: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-runtime-update-proposal.test.ts` (7 files, 102 tests); `npm.cmd run typecheck`; `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` (1 file, 15 tests).
- Validation grep passed with no matches: `rg --encoding utf-8 "runRpgRuntimePreview\\(|compileRpgContext\\(|CompactStoryBrief|buildActionResolverInputFromBrief\\(|buildWorldTickInputFromBrief\\(|buildNarrationGeneratorInputFromTurnState\\(" src/lib/rpg-runtime src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts`.
- Not done in this stage: no `runtime_update_proposal` split; no `wiki/runtime/`; no legacy/default compatibility or fallback; no pending/review/apply bypass; no runtime update proposal rewrite from single narration text; no git commit or push.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages E-F

- Completed `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` stages E and F only.
- Added `src/lib/rpg-runtime/outline-brief-input-builder.ts` with `buildOutlineBriefInputFromTurnStateAndWiki()`. It builds `OutlineBriefCompilerInput` from turn state, recall handoff, controlled `wiki/outlines/main.md` slices, controlled `wiki/outlines/progress.md` slices, `wiki/plot-arcs/*.md`, `wiki/plot-arcs/runtime/*.md`, `wiki/relationships/runtime/*.md`, and fixed `wiki/rules/*.md`.
- Updated `src/lib/rpg-runtime/outline-brief-handoff.ts` so `relationships/runtime` can contribute relationship tension fuel to `plotArcTensionFuel`.
- Added `src/lib/rpg-runtime/narration-input-builder.ts` with `buildNarrationGeneratorInputFromHandoffs()`. It builds `NarrationGeneratorInput` from handoffs plus dedicated reads of `wiki/style/narration.md`, `wiki/style/dialogue.md`, `wiki/style/forbidden.md`, `wiki/memory/player-preferences.md`, fixed `wiki/rules/*.md`, and `wiki/player/known_information.md`.
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts` so `runRpgTurn()` now reaches `action_resolver`, `world_tick`, `recall_selector`, `outline_brief`, and `narration_generator` without using `CompactStoryBrief`, `runRpgRuntimePreview()`, or `compileRpgContext()` as input.
- `runRpgRuntimePreview()` / `legacy_context_compiler_v0` is now called only after narration generation, solely to preserve the temporary `RunRpgTurnResult.brief` / runtime controller result surface until stage G.
- `buildOutlineBriefCompilerInputFromTurnState()` and `buildNarrationGeneratorInputFromTurnState({ brief })` remain as legacy helper / classification compatibility code for now, but are not production `runRpgTurn()` dependencies.
- Added focused coverage in `src/lib/rpg-outline-brief.test.ts` for direct wiki-built Outline Brief input, including turn state, recall handoff, controlled outline/progress slices, plot-arc base/runtime fuel, relationship runtime fuel, hard constraints, known references, and runtime refs.
- Added focused coverage in `src/lib/rpg-narration-generator.test.ts` for direct wiki-built Narration input, including handoffs, style bundle, forbidden constraints, player knowledge boundary, references, and runtime refs.
- Added orchestrator coverage proving outline brief and narration run before the legacy preview by mutating fixture wiki files inside the narration adapter and confirming only the later legacy brief sees the mutation.
- Validation passed: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-story-outline-regenerator.test.ts` (6 files, 83 tests); `npm.cmd run typecheck`.
- Not done in this stage: no `runtime_update_proposal`拆分；no stage G final deletion; no full `CompactStoryBrief` / `compileRpgContext()` / `runRpgRuntimePreview()` deletion; no `wiki/runtime/`; no legacy/default compatibility or fallback; no git commit or push.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages C-D

- Completed `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` stages C and D only.
- Added `src/lib/rpg-runtime/world-tick-input-builder.ts` with `buildWorldTickInputFromWiki()`. It builds `WorldTickInput` from `ActionResolution`, the action resolver `preActionSnapshot`, `wiki/current-scene/scene_state.md`, recent `wiki/events/*.md`, `relationships/runtime`, `plot-arcs/runtime`, `quests`, affected `characters/locations/factions/items` base + runtime overlays, `wiki/outlines/progress.md`, and fixed `wiki/rules/*.md`.
- Added `src/lib/rpg-runtime/recall-selector-input-builder.ts` with `buildRecallSelectorInputFromTurnStateAndWiki()`. It builds `RecallSelectorInput` and retrieval index from `PostActionWorkingState`, `ActionResolution`, `WorldTickResult`, `WorldTickVisibleSelection`, current scene, affected paths, relevant events, source provenance refs, related base/runtime overlays, quests, and outline progress.
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts` so `runRpgTurn()` now reaches `action_resolver`, `world_tick`, and `recall_selector` without going through `CompactStoryBrief`, `runRpgRuntimePreview()`, or `compileRpgContext()`.
- `runRpgRuntimePreview()` / `legacy_context_compiler_v0` is now called only after `recall_selector` and `createRecallSelectorHandoff()`. It remains temporarily for not-yet-migrated downstream legacy brief consumers, especially narration style/forbidden helpers and the temporary `RunRpgTurnResult.brief` surface.
- `buildWorldTickInputFromBrief()` and `buildRecallSelectorInputFromTurnState({ brief })` remain as old helper definitions / legacy tests for now, but are not production `runRpgTurn()` dependencies.
- Added focused coverage in `src/lib/rpg-world-tick-contract.test.ts` for direct wiki-built `WorldTickInput`, including action resolution, pre-action scene, current-scene clocks / pending reactions / pacing, event history constraints, relationships/runtime, plot-arcs/runtime, quests, affected runtime overlays, outline progress, rules constraints, and references.
- Added focused coverage in `src/lib/rpg-recall-selector-handoff.test.ts` for wiki-built recall selector input and retrieval index, including current scene, affected paths, relevant events, source provenance refs, relevant base/runtime overlays, quests, and outline progress.
- Added orchestrator coverage proving `world_tick` and `recall_selector` run before the legacy preview by mutating fixture wiki files inside the recall adapter and confirming only the later legacy brief sees the mutation.
- Validation passed: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts` (7 files, 73 tests); `npm.cmd run typecheck`.
- Not done in this stage: no `outline_brief`, `narration_generator`, `runtime_update_proposal`, or final `CompactStoryBrief` deletion; no `wiki/runtime/`; no legacy/default compatibility or fallback; no git commit or push.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages A-B

- Completed `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` stages A and B only.
- Updated `docs/RPG_WIKI_SCHEMA.md` so the directory matrix and phase/module information-flow matrix no longer list `context_compiler` as a target runtime module. The current old implementation is named `legacy_context_compiler_v0` / `legacy_compact_brief_builder` and documented as a removable transition layer, not a future `Context Compiler v1`.
- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` so the target runtime flow starts with an action resolver-specific input builder, and so future work is framed as module-specific input builders / runtime handoff readers rather than a centralized context compiler.
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` was not updated because that current-path file is absent in this worktree; only `docs/archive/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` exists.
- Added `src/lib/rpg-runtime/wiki-readers.ts` to hold small reusable deterministic wiki reader helpers: safe slot reads, markdown directory reads, base/runtime overlay grouping, token scoring, section-aware excerpts, references, and compaction.
- Added `src/lib/rpg-runtime/action-resolver-input-builder.ts` with `buildActionResolverInputFromWiki()`. It builds `ActionResolverInput` directly from `wiki/current-scene/scene_state.md`, fixed `wiki/player/*.md`, fixed `wiki/rules/*.md`, relevant `characters/locations/items/factions` base + runtime overlay pages, `wiki/quests/*.md`, and references.
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts` so `runRpgTurn()` calls `buildActionResolverInputFromWiki()` and `action_resolver` before any `runRpgRuntimePreview()` / `compileRpgContext()` path.
- Downstream modules still temporarily receive `preview.brief` after action resolution. This is recorded in code warnings as a TODO for `legacy_context_compiler_v0`; `RunRpgTurnResult.brief` remains for the not-yet-migrated downstream flow.
- `buildActionResolverInputFromBrief()` is no longer called from `src/lib`; it remains only as a legacy helper definition for now.
- Added focused coverage in `src/lib/rpg-action-resolver.test.ts` for building `ActionResolverInput` from real wiki fixture files, including current scene, player state, abilities, inventory, goals, known information, rules, entity/runtime overlay excerpts, quests, and references.
- Added focused coverage in `src/lib/rpg-turn-orchestrator.test.ts` proving action resolver input is built before the post-action legacy preview path.
- Validation passed: `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts` (3 files, 45 tests); `npm.cmd run typecheck`.
- Not done in this stage: no `world_tick`, `recall_selector`, `outline_brief`, `narration_generator`, or `runtime_update_proposal` input-builder removal; no full `CompactStoryBrief` deletion; no `wiki/runtime/`; no legacy/default compatibility or fallback; no git commit or push.

## 2026-06-12 - Runtime Context Compiler Removal Plan

- Added `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` to document the plan for removing the centralized `compileRpgContext() -> CompactStoryBrief` dependency from the formal runtime turn flow.
- The plan records that the current implementation still truly uses `compileRpgContext()` via `runRpgRuntimePreview()` and `runRpgTurn()`, but that this v0 total-brief layer conflicts with the target runtime architecture.
- The target architecture has `action_resolver`, `world_tick`, `recall_selector`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, and `runtime_update_proposal` consume their own module-specific input builders / handoffs instead of a shared `CompactStoryBrief`.
- Clarified that `story_outline_regenerator` does not directly consume `CompactStoryBrief`, but remains indirectly affected while `outline_brief` and its upstream handoff chain still derive from the old total-brief path.
- The plan breaks the removal into staged work from documentation cleanup through action resolver, world tick, recall, outline brief, narration, and final `CompactStoryBrief` deletion.
- This was documentation-only. No source code, runtime behavior, schema constants, UI behavior, writer/apply behavior, tests, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Schema Phase Information Flow Matrix

- Added a separate `阶段 / 模块信息流矩阵` table to `docs/RPG_WIKI_SCHEMA.md` after the directory read/write matrix.
- The new table describes each phase/module's information inputs, outputs, and boundaries; section/file/field granularity is folded directly into the input and output columns instead of living in a standalone column.
- Covered `source_ingest`, `control_doc_import`, `campaign_setup_import`, `manual_or_review`, `post_ingest_derivation`, `context_compiler`, `recall_selector`, `action_resolver`, `world_tick`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, `runtime_update_proposal`, and `runtime_update_apply`.
- Section-level examples now name concrete landing areas inside input/output flow descriptions, such as character `## 核心定位` / `## 当前状态`, outline `## Runtime Capsule` / `## Act Structure`, current-scene active clocks / pending reactions / pacing state, player fixed slots, event confirmed-happened fields, runtime overlay state, non-wiki handoff outputs, and proposal metadata.
- This was documentation-only. No source code, runtime behavior, schema constants, UI behavior, writer/apply behavior, tests, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Schema Directory Read/Write Matrix Cleanup

- Updated `docs/RPG_WIKI_SCHEMA.md` to replace the old runtime type / LLM-step contract block with a directory-level phase read/write matrix.
- The new matrix names which phases may modify each persistent `wiki/` directory and which runtime modules may read it, including `context_compiler`, `recall_selector`, `action_resolver`, `world_tick`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, `runtime_update_proposal`, and `runtime_update_apply`.
- Removed `Runtime Schema Spine / 运行时共享契约` from the schema document because runtime-only field enums, JSON contracts, and LLM-step type shapes belong in runtime / interaction docs or code types, not in the directory schema.
- Reconfirmed that runtime intermediate artifacts, turn records, runtime journals, pending metadata, and `.llm-wiki/runtime/` are not ordinary `wiki/runtime/` pages and cannot be ordinary ingest targets.
- This was documentation-only. No source code, runtime behavior, schema constants, UI behavior, writer/apply behavior, tests, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Fixed World Slot Directory Contract

- Converted `wiki/world/` from an open ordinary-ingest directory into a fixed five-slot directory contract.
- Fixed world slots are now `wiki/world/basic_overview.md`, `wiki/world/history.md`, `wiki/world/common_sense.md`, `wiki/world/supernatural_presence.md`, and `wiki/world/social_structure.md`.
- `RPG_SCHEMA_SLOTS` now includes the five world slots with `owner: source_ingest`, `importPolicy: ordinary_ingest`, and merge write policy; fixed slot count is now 22.
- Ordinary Source Ingest target policy now allows only the five fixed world slot paths under `wiki/world/`; arbitrary targets like `wiki/world/tide-laws.md` are rejected.
- New llmWikiRPG project creation now writes starter files for the five fixed world slots, and project-mode schema text documents that `world/` is fixed-slot, not free-form.
- Source-ingest prompt guidance, extraction validation messages, fixtures, and tests were updated to route world material into fixed slots.
- Updated `docs/RPG_WIKI_SCHEMA.md` so the import/apply contract, fixed slot table, and `world/` directory section describe the fixed slot model.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-interactions.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx` (8 files, 149 tests); `npm.cmd run typecheck`; `cargo test create_project_writes` from `src-tauri` (2 tests, with existing warnings only).
- No `git commit` or `git push` was performed.

## 2026-06-11 - Campaign Setup Player Subslot Import Options

- Added deterministic campaign setup import targets for the four fixed player subslots: `player_abilities`, `player_inventory`, `player_goals`, and `player_known_information`.
- The campaign setup UI now exposes Player Abilities, Player Inventory, Player Goals, and Player Known Information alongside Player Profile, Current Scene, Prologue Event, Main Quest, Quest, and Player Relationship.
- New subslot imports write directly to `wiki/player/abilities.md`, `wiki/player/inventory.md`, `wiki/player/goals.md`, and `wiki/player/known_information.md` with merge policy and campaign bootstrap metadata.
- `Player Profile` remains scoped to `wiki/player/player.md`; it still does not automatically split one full profile into the four subslot files.
- `campaign_setup_import` still does not use an LLM by default; this change only adds explicit, user-selectable deterministic import targets.
- Validation passed: `npx.cmd vitest run src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-import/ui-import-options.test.ts src/lib/rpg-interactions.test.ts` (3 files, 64 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Campaign Setup Starter Schema Guidance

- Expanded new-project starter templates for the campaign setup-facing fixed slots so blank pages explain what users should import instead of showing only sparse `Runtime Capsule` comments.
- `wiki/player/player.md` now includes a visible `Campaign Setup Import Shape`, recommended player-profile headings, fixed player slot mapping, and boundaries for NPC profiles, rules, and GM-only future plans.
- `wiki/player/abilities.md`, `wiki/player/inventory.md`, `wiki/player/goals.md`, and `wiki/player/known_information.md` now include recommended source headings and `Do Not Put Here` boundaries.
- `wiki/current-scene/scene_state.md` now explains the opening-scene source shape, overwrite-only snapshot semantics, and what must stay in events, outlines/plot-arcs, characters, memory, or rules instead.
- The import pipeline was not changed: `campaign_setup_import` remains deterministic and does not ask an LLM to split or rewrite imported files by default.
- Added Rust coverage for new-project starter guidance content.
- Validation passed: `cargo test create_project_writes` from `src-tauri`; `npm.cmd run typecheck`; `cargo fmt` completed with the existing path canonicalization warning.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Knowledge Tree Campaign Setup Type Grouping Fix

- Fixed a UI-only Knowledge Tree grouping bug where campaign setup pages with quoted YAML frontmatter such as `type: "player"` or `type: "current-scene"` were displayed under quoted pseudo-folders like `"player"` instead of the canonical RPG groups.
- `KnowledgeTree` now reuses the existing YAML frontmatter parser instead of regex-reading raw `type:` values, so quoted YAML strings are unquoted before grouping.
- Added Knowledge Tree type aliases for deterministic campaign setup content types: `event -> events`, `quest -> quests`, and `relationship -> relationships`.
- This does not change campaign setup write paths or disk layout; `campaign_setup_import` still writes `wiki/player/player.md`, `wiki/current-scene/scene_state.md`, `wiki/events/prologue.md`, `wiki/quests/*.md`, and `wiki/relationships/*.md`.
- Validation passed: `npx.cmd vitest run src/components/layout/knowledge-tree.test.ts src/lib/wiki-page-types.test.ts src/lib/rpg-import/campaign-setup-import.test.ts` (3 files, 21 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Final Architecture Diagram Status Labels

- Updated the architecture diagram in `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` to explicitly mark implemented / connected / not connected / missing areas.
- Added a status legend and node-level labels for Campaign Setup, Control Doc import, Source Ingest, Merge, Runtime turn flow, Story Outline Regenerator, Relationship/Tension Deriver, Context Compiler v1 boundary work, and Project Audit / Evaluation.
- The diagram now marks Story Outline Regenerator as code-present but not wired into the default UI path, Relationship/Tension Deriver as implemented but not connected to the product loop, Context Compiler v1 boundaries as needing refinement, and Project Audit / real-model long-turn evaluation as not implemented.
- This was documentation-only. No source code, runtime behavior, tests, schema constants, UI behavior, writer/apply behavior, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Final Architecture Diagram Expanded

- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` architecture diagram so it no longer shows only setup + runtime.
- The diagram now includes Campaign Setup, Control Doc import, Source Ingest, Merge / wiki write layer, Runtime turn flow, shared Review / pending queue, Markdown RPG Wiki, runtime persistence/audit state, and search/graph/vector retrieval.
- Clarified in the diagram that `SubmittedAction` is inside the runtime turn loop, while accepted review/apply writes feed back into Markdown Wiki and then into later context compilation.
- This was documentation-only. No source code, runtime behavior, tests, schema constants, UI behavior, writer/apply behavior, or git state was changed.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Runtime Update Proposal Structured JSON Cleanup

- Completed a small runtime update proposal cleanup that removes the old fenced `rpg-wiki-update` compatibility fallback from `runtimeUpdateInteractionSpec.parseOutput()`.
- Runtime Update Proposal now accepts only structured `RuntimeUpdateProposalResult` JSON (bare JSON or fenced JSON handled by the structured JSON parser). Empty output is no longer a no-op; it fails JSON parsing / validation.
- `RuntimeUpdateInteractionResult` no longer exposes a parser-level `proposedUpdates` alias. The canonical proposal field is `proposedWikiUpdates`, and JSON containing the old `proposedUpdates` alias is rejected.
- `runtimeUpdateInteractionSpec.buildPrompt()` and `parseOutput()` now require a complete `RuntimeUpdateProposalInput`; the turn-record handoff builder remains centralized in `src/lib/rpg-runtime/runtime-update-proposal-handoff.ts`.
- `runRpgRuntimeTurnFlow()` derives validation, pending updates, journal persistence, and the outer `RunRpgRuntimeTurnFlowResult.proposedUpdates` field from `runtimeUpdateProposal.proposedWikiUpdates`. The outer `proposedUpdates` field remains only as controller result surface, not as a parser alias.
- `runtime_update_apply` was minimally adjusted to call the proposal parser with `buildRuntimeUpdateProposalInputFromTurnRecord()` when staging from structured proposal text; pending/apply/write policy core behavior was not removed or refactored.
- Validation passed: `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts` (3 files, 81 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Validator + Orchestrator Stage

- Completed **RPG Runtime LLM 6 / Runtime Update Proposal 阶段 4：Validator + Pending Staging** and **阶段 5：Orchestrator 接入**.
- Strengthened `validateRuntimeUpdateProposalResult()` so structured `RuntimeUpdateProposalResult` validation now checks source-delta support for `lineTarget`, `visibility`, `knowledgeScope`, `happenedStatus`, affected target paths, `pacingUpdateProposal.sourceDeltaIds`, and `proposalGroups` update / skipped / source references.
- `wiki/events/*.md` proposals now require `confirmed_happened` source deltas, not only a confirmed top-level update flag.
- `wiki/player/known_information.md` proposals now require PC-known or PC-misunderstanding source deltas and reject `parallelLineText` / `user_visible_pc_unknown` / user-only material as automatic PC knowledge.
- Runtime overlay proposals now require at least one source delta whose `affectedPaths` names the target overlay path.
- Added deterministic `buildRuntimeUpdateProposalInputFromTurnRecord()` in `src/lib/rpg-runtime/runtime-update-proposal-handoff.ts`; `runRpgRuntimeTurnFlow()` now builds `RuntimeUpdateProposalInput` before calling `runtime_update_proposal`.
- The main runtime flow now carries structured proposal audit data in controller result and runtime journal summary: `skippedDeltas`, `proposalGroups`, `pacingUpdateProposal`, `outlineRevisionReviewItems`, proposal journal entries, and warnings.
- Ordinary pending updates still come only from validated `proposedWikiUpdates`; `SkippedRuntimeDelta` and `outlineRevisionReviewItems` do not enter ordinary pending updates or ordinary apply.
- Superseded by the structured JSON cleanup above: runtime update proposal parsing no longer accepts old fenced `rpg-wiki-update` output or empty-output no-ops.
- Validation passed: `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (6 files, 124 tests); `npm.cmd run typecheck`; UTF-8 `rg` boundary check for `buildRuntimeUpdateProposalInputFromTurnRecord|RuntimeUpdateProposalInput|RuntimeUpdateProposalResult|runtime_update_proposal|sourceDeltas|proposalGroups|SkippedRuntimeDelta|outlineRevisionReviewItems|wiki/outlines/main.md|user_visible_pc_unknown|attempted_not_confirmed`.
- Still not changed: writer/apply behavior, UI, `RPG_SCHEMA_SLOTS`, ordinary `wiki/runtime` category, automatic `wiki/outlines/main.md` write, automatic apply, git commit, or git push.

## 2026-06-11 - LLM 6 Runtime Update Proposal Types + Interaction Contract Stage

- Completed **RPG Runtime LLM 6 / Runtime Update Proposal 阶段 2：Runtime Types + JSON Contract** and **阶段 3：Interaction Spec 改造** only.
- Added runtime-only LLM 6 types in `src/lib/rpg-runtime/types.ts`: `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, `RuntimeProposedWikiUpdate`, `RuntimeUpdateSourceDelta`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, `ProposalGroup`, `OutlineRevisionReviewItem`, minimal `RuntimeUpdateConsistencyValidation`, and allowed target / write policy / review policy helper shapes.
- Added `src/lib/rpg-interactions/runtime/runtime-update-proposal-validation.ts` for bare JSON and fenced JSON parsing plus structure/boundary validation. The validator checks required result fields, ordinary update metadata, source deltas, target policy, confirmed-event boundaries, PC knowledge boundaries, and outline-revision separation; it does not create pending updates or apply writes.
- Upgraded `runtimeUpdateInteractionSpec` to `runtime_update_proposal`. The prompt now prioritizes structured fact sources: `PostActionWorkingState`, `ActionResolution`, `WorldTickResult`, `WorldTickVisibleSelection`, `TurnNarration`, consistency validation, recall handoff, and outline handoff. `generatedNarrative` / `playerFacingText` are evidence/display material, not the only fact source.
- Prompt boundaries now state that `parallelLineText` / `user_visible_pc_unknown` cannot automatically update `wiki/player/known_information.md`, `nextActionOptions` are candidate future actions, `attempted_not_confirmed` cannot enter confirmed `events`, and `outlineRevisionProposal` can only become independent `outlineRevisionReviewItems`.
- Added structured fixture and LLM proposal adapters that run through `runtimeUpdateInteractionSpec.buildPrompt()` and `parseOutput()`. Existing raw-string runtime update adapter remains available for the current controller path.
- Registered/exported `runtime_update_proposal` and added focused tests in `src/lib/rpg-runtime-update-proposal.test.ts`; updated `src/lib/rpg-interactions.test.ts` for the new kind and prompt contract.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to mark LLM 6 stages 2 and 3 `[已完成]`; stages 4 and 5 remain `[待实现]`.
- Validation passed: `npm.cmd run typecheck`; `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts`.
- Still not implemented or changed: runtime update validator / pending staging / apply strengthening, `runRpgTurn` / `runRpgRuntimeTurnFlow` orchestrator integration, writer/apply behavior, UI, `RPG_SCHEMA_SLOTS`, ordinary `wiki/runtime` category, ordinary wiki/runtime category registry, automatic `wiki/outlines/main.md` write, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Schema Guidance Stage

- Completed **RPG Runtime LLM 6 / Runtime Update Proposal 阶段 1：Schema Guidance** only.
- Updated `docs/RPG_WIKI_SCHEMA.md` with Runtime Update Proposal guidance for `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, enhanced `ProposedWikiUpdate`, `sourceDeltas`, `lineTarget`, `visibility`, `knowledgeScope`, `happenedStatus`, `confidence`, `validationHints`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, `ProposalGroup`, and `OutlineRevisionReviewItem`.
- Clarified that structured turn deltas and source deltas should be the primary fact boundary; `generatedNarrative` and `playerFacingText` are evidence/display material, not the only fact source.
- Clarified that `parallelLineText` / `user_visible_pc_unknown` cannot automatically enter PC knowledge, `nextActionOptions` are not facts, and `attempted_not_confirmed` cannot enter confirmed `events`.
- Clarified that `outlineRevisionProposal` can only become an independent review item, cannot mix into ordinary `ProposedWikiUpdate`, and cannot auto-write `wiki/outlines/main.md`.
- Clarified that fenced markdown update blocks may remain as compatibility/manual staging protocol but should not be the new main runtime flow's only protocol.
- Added code-readable guidance constants and getters in `src/lib/rpg-wiki-schema.ts`, including `RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA`, `RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA`, `RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS`, `RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS`, `RPG_SKIPPED_RUNTIME_DELTA_FIELDS`, `RPG_PACING_UPDATE_PROPOSAL_FIELDS`, `RPG_PROPOSAL_GROUP_FIELDS`, `RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA`, and `RPG_RUNTIME_UPDATE_PROPOSAL_GUIDANCE`.
- Updated `src/lib/rpg-wiki-schema.test.ts` with focused LLM 6 schema tests for machine readability, structured fact sources, PC knowledge boundaries, confirmed-events boundaries, skipped delta / pacing / group / outline review item guidance, fenced block compatibility, unchanged `RPG_SCHEMA_SLOTS`, and no ordinary `wiki/runtime` category.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to mark only LLM 6 stage 1 `[已完成]`; stages 2-5 remain `[待实现]`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` (1 file, 29 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "RuntimeUpdateProposalInput|RuntimeUpdateProposalResult|RPG_RUNTIME_UPDATE_PROPOSAL|SkippedRuntimeDelta|PacingUpdateProposal|ProposalGroup|OutlineRevisionReviewItem" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- Still not implemented or changed: runtime types, JSON parser / validator, interaction spec behavior, `runtime-update-interaction.ts` prompt/parser behavior, `state-extractor.ts` `ProposedWikiUpdate` implementation, runtime update validator / pending staging / apply behavior, orchestrator接入, writer/apply, UI, ordinary `wiki/runtime` category or registry entry, `RPG_SCHEMA_SLOTS`, and legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Implementation Plan Note

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to add a dedicated **LLM 6：Runtime Update Proposal** phased implementation tracking plan.
- Confirmed the next runtime step can start after LLM 5 cleanup, but should proceed in small stages rather than changing writer/apply/UI in one pass.
- Recorded that the existing LLM 6 path already has `runtimeUpdateInteractionSpec`, `ProposedWikiUpdate`, fenced markdown block parsing, deterministic validator, pending staging, and journal recording; the next work should upgrade that path instead of replacing the whole review/apply pipeline.
- Split the planned work into five `[待实现]` stages: Schema Guidance, Runtime Types + JSON Contract, Interaction Spec 改造, Validator + Pending Staging, and Orchestrator 接入.
- Reconfirmed key boundaries: structured turn deltas should replace `submittedAction + generatedNarrative + references` as the primary fact source; `outlineRevisionProposal` remains an independent review item; old fenced block parsing may remain as compatibility/manual staging; no ordinary `wiki/runtime` category should be added.
- This was documentation-only. No source code, runtime behavior, schema implementation, writer/apply behavior, UI, tests, git commit, or git push was changed.

## 2026-06-11 - Narration Generator Cleanup Pass

- Completed a small cleanup pass after **LLM 5 Narration Generator 第 3 阶段**.
- Audited `RpgNarrationAdapter`, `createLlmRpgNarrationAdapter`, `createFixtureNarrationAdapter`, `buildRpgNarrationPrompt`, `narrationInteractionSpec`, `RpgNarrationPrompt`, and `generateTurn`: current source production paths (`runRpgTurn`, runtime controller, and RPG panel plumbing) use `RpgNarrationGeneratorAdapter` / `createLlmRpgNarrationGeneratorAdapter` and the `narration_generator` contract.
- Removed the old `narration` interaction contract files from `src/lib/rpg-interactions/runtime/`: old prompt builder, old fixture adapter, and old LLM adapter. Removed the old prompt/adapter-focused tests.
- Removed the old `narration` registry entry and runtime barrel exports; `narration_generator` is now the only registered runtime narration LLM contract.
- Kept `RpgTurnResult` as a transitional UI / Runtime Update Proposal shape, but centralized `TurnNarration -> RpgTurnResult` in `createTurnResultFromTurnNarration()` in `src/lib/rpg-runtime/turn-model.ts`.
- `generatedNarrative` still derives from `turnNarration.playerFacingText`; `parallelLineText` remains non-PC knowledge, `tensionBrief` remains runtime/review handoff, and unchosen `nextActionOptions` remain candidate future actions only.
- Reduced narration test fixture duplication by reusing shared `sampleTurnNarration()` from `src/lib/rpg-runtime-test-fixtures.ts` in narration generator tests.
- Did not modify wiki writer/apply behavior.
- Did not change UI display or controls.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not enter Runtime Update Proposal / LLM 6 redesign.
- Did not auto-write wiki or auto-apply pending updates.
- Validation passed: `npm.cmd run typecheck`; `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (7 files, 123 tests); `rg --encoding utf-8 "RpgNarrationAdapter|createLlmRpgNarrationAdapter|createFixtureNarrationAdapter|buildRpgNarrationPrompt|narrationInteractionSpec|RpgNarrationPrompt|generateTurn|RpgNarrationGeneratorAdapter|createLlmRpgNarrationGeneratorAdapter|narration_generator|turnNarration|generatedNarrative" src/lib src/components docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Orchestrator Handoff Stage

- Completed **RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 3 阶段：Orchestrator 接入 + Turn Record Handoff**，仅覆盖 LLM 5 checklist 第 3 点。
- `runRpgTurn` now uses the new `narration_generator` contract / `RpgNarrationGeneratorAdapter` and produces validated `TurnNarration`.
- Added deterministic `NarrationGeneratorInput` handoff construction from current-turn structures only: `PostActionWorkingState`, `ActionResolution`, `WorldTickResult`, `WorldTickVisibleSelection`, `RecallSelection`, deterministic `recalledMaterials`, `OutlineAwareNarrationBrief`, optional `provisionalOutlinePatch.narrationHandoff`, style / forbidden / player-knowledge boundaries, refs, and runtime refs.
- Non-Step 14.5 turns do not pass provisional handoff and require `narrationMeta.usedProvisionalPatch === false`; Step 14.5 turns pass only `provisionalOutlinePatch.narrationHandoff` as hard constraint and require `usedProvisionalPatch === true` plus `respectedMustNotReveal === true`.
- `RpgTurnRecord`, `RunRpgTurnResult`, `RunRpgRuntimeTurnFlowResult`, and runtime turn journal entries now save `turnNarration`, including `playerFacingText`, `parallelLineText`, `displayPolicy`, `tensionBrief`, `narrationMeta`, enhanced `nextActionOptions`, and `references`.
- `generatedNarrative` remains only as a conservative transition/display field derived from `turnNarration.playerFacingText`; `parallelLineText` is not PC knowledge, `tensionBrief` is runtime/review handoff, and unchosen enhanced options are not stored as happened facts.
- `outlineRevisionProposal` remains independent review/audit data only and is not passed to Narration as fact material, not turned into ordinary runtime update, and not auto-written to `wiki/outlines/main.md`.
- Did not modify wiki writer/apply behavior.
- Did not change UI display or controls.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not enter Runtime Update Proposal / LLM 6 redesign.
- Validation passed: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (7 files, 126 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "TurnNarration|NarrationGeneratorInput|narration_generator|turnNarration|playerFacingText|parallelLineText|tensionBrief|displayPolicy|narrationMeta|provisionalOutlinePatch.narrationHandoff|outlineRevisionProposal" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Runtime Types + Interaction Contract Stage

- Completed **RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 2 阶段：Runtime Types + Interaction Contract**，仅覆盖 LLM 5 checklist 第 2 点。
- Added runtime-only LLM 5 types in `src/lib/rpg-runtime/types.ts`, including `NarrationGeneratorInput`, `TurnNarration`, `NarrationDisplayPolicy`, `TensionBrief`, `NarrationMeta`, runtime narration action options, source refs, reveal/style/forbidden/player-knowledge boundaries, pacing compliance, and provisional patch usage meta.
- Added independent `narration_generator` contract under `src/lib/rpg-interactions/runtime/`: interaction spec, prompt builder, bare/fenced JSON parser, deterministic validator, fixture adapter, and LLM streaming adapter.
- Registered and exported the new contract as a contract-layer interaction only. Existing `narration` / `RpgTurnResult` flow remains unchanged.
- Added focused tests in `src/lib/rpg-narration-generator.test.ts` and updated registry expectations in `src/lib/rpg-interactions.test.ts`. Tests cover runtime type construction, prompt boundaries, parser behavior, validator accept/reject cases, adapters through parser + validator, registry/export exposure, and unchanged forbidden areas.
- Explicitly not connected to `runRpgTurn`; LLM 5 第 3 阶段 Orchestrator 接入 + Turn Record Handoff remains `[待实现]`.
- Did not modify wiki writer/apply behavior or UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not enter Runtime Update Proposal / LLM 6 redesign and did not auto-write wiki or apply pending updates.
- Validation passed: `npx.cmd vitest run src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (3 files, 86 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "NarrationGeneratorInput|TurnNarration|NarrationDisplayPolicy|TensionBrief|NarrationMeta|provisionalOutlinePatch.narrationHandoff|outlineRevisionProposal|parallelLineText|playerFacingText" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Schema Guidance Stage

- Completed **RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 1 阶段：Schema Guidance**，仅覆盖 LLM 5 checklist 第 1 点。
- Updated `docs/RPG_WIKI_SCHEMA.md` with LLM 5 schema guidance for `TurnNarration`, `playerFacingText`, `parallelLineText`, `tensionBrief`, `NarrationDisplayPolicy`, `NarrationMeta`, enhanced `RpgActionOption`, `NarrationGeneratorInput`, `styleBundle`, `forbiddenForNarration`, `playerKnowledgeBoundary`, pacing compliance, and `provisionalOutlinePatch.narrationHandoff` priority.
- Added code-readable guidance in `src/lib/rpg-wiki-schema.ts`: `RPG_NARRATION_OUTPUT_SCHEMA`, `RPG_TENSION_BRIEF_FIELDS`, `RPG_NARRATION_META_FIELDS`, `RPG_ACTION_OPTION_RUNTIME_FIELDS`, `RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY`, `RPG_NARRATION_STYLE_HANDOFF_POLICY`, aggregate guidance, and getter functions.
- Updated `src/lib/rpg-wiki-schema.test.ts` to confirm Narration guidance is readable, includes core TurnNarration / tension / meta / action-option fields, preserves player knowledge and style handoff boundaries, keeps `provisionalOutlinePatch.narrationHandoff` above ordinary brief without rewriting working state, and keeps `outlineRevisionProposal` out of Narration fact material.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to mark only LLM 5 checklist item 1 `[已完成]`; checklist items 2 and 3 remain `[待实现]`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` (1 file, 28 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "RPG_NARRATION_OUTPUT_SCHEMA|RPG_TENSION_BRIEF_FIELDS|RPG_NARRATION_META_FIELDS|RPG_ACTION_OPTION_RUNTIME_FIELDS|RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY|RPG_NARRATION_STYLE_HANDOFF_POLICY|TurnNarration|NarrationMeta|TensionBrief" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- Still not implemented or changed: runtime types, Narration interaction contract, parser / validator / adapters, `RpgTurnResult`, `runRpgTurn`, wiki writer/apply, UI, Runtime Update Proposal / LLM 6, `RPG_SCHEMA_SLOTS`, ordinary `wiki/runtime` category, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Three-stage Plan Note

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to add a three-stage execution plan for **RPG Runtime LLM 5 / Narration Generator**.
- The plan splits LLM 5 into:
  1. Schema Guidance stage for `docs/RPG_WIKI_SCHEMA.md`, code-readable schema guidance, and focused schema tests.
  2. Runtime Types + Interaction Contract stage for `NarrationGeneratorInput`, `TurnNarration`, parser / validator / adapters, registry / exports, and focused contract tests.
  3. Orchestrator 接入 + Turn Record Handoff stage for wiring `TurnNarration` into `runRpgTurn` and saving runtime/review handoff fields.
- Reconfirmed the boundary that `provisionalOutlinePatch.narrationHandoff` must be a hard Narration constraint when Step 14.5 ran, while `outlineRevisionProposal` must not become Narration fact material, ordinary runtime update, or an automatic `wiki/outlines/main.md` write.
- Reconfirmed that the LLM 5 plan should not enter Runtime Update Proposal / LLM 6 redesign, wiki writer/apply changes, UI changes, ordinary `wiki/runtime` category work, or `RPG_SCHEMA_SLOTS` changes unless a later stage explicitly requests them.
- This was documentation-only. No source code, runtime behavior, tests, schema implementation, writer/apply behavior, UI, git commit, or git push was changed.

## 2026-06-11 - Story Outline Regenerator Orchestrator Conditional Call Stage

- Completed **RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 3 阶段：Orchestrator 条件调用阶段**，仅覆盖 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` checklist 第 5 点。
- Added deterministic `buildStoryOutlineRegeneratorInputFromTurnState()` in `src/lib/rpg-runtime/story-outline-regenerator-handoff.ts`; it builds the Step 14.5 input only from the current turn's `outlineBriefInput`, impact report/request, working state, recalled materials, outline slices, plot-arc tension fuel, visibility/hard constraints, runtime refs, and known refs. It does not read extra files or guess wiki facts.
- `runRpgTurn` now accepts optional `storyOutlineRegeneratorAdapter` and calls Story Outline Regenerator only when `outlineImpactReport.impactLevel === "major_rewrite_required"`, `requiresRegeneration === true`, a `regenerationRequest` exists, and the adapter exists.
- Successful regenerator output is routed through `storyOutlineRegeneratorInteractionSpec.buildPrompt(...)`, adapter call, and `storyOutlineRegeneratorInteractionSpec.parseOutput(...)` validation before Narration. Invalid output aborts the turn before Narration can produce polluted results.
- Narration receives only `provisionalOutlinePatch.narrationHandoff` as `provisionalNarrationHandoff` hard constraints. `outlineRevisionProposal` is not passed to Narration as fact material.
- `RunRpgTurnResult`, `RpgTurnRecord`, `RunRpgRuntimeTurnFlowResult`, and runtime turn journal entries now save optional `provisionalOutlinePatch`, `outlineRevisionProposal`, and `regenerationSafetyReport` under runtime/review audit boundaries.
- `outlineRevisionProposal` remains independent review/pending audit data only: it is not inserted into ordinary `ProposedWikiUpdate`, `runtimeWikiUpdate`, `proposedUpdates`, or `pendingUpdates`, and no code writes or applies `wiki/outlines/main.md`.
- Major impact without adapter or without `regenerationRequest` keeps an audit warning; successful invocation replaces the previous "not triggered in this stage" warning with run/audit warnings.
- Updated focused tests for non-major no-call, major call with adapter, major missing adapter/request warnings, call order through `storyOutlineRegenerator -> narration`, Narration handoff delivery, turn record / runtime journal audit persistence, parser+validator enforcement, invalid output abort behavior, no wiki writes, no ordinary runtime update pollution, unchanged `RPG_SCHEMA_SLOTS`, and no ordinary `wiki/runtime` category.
- Validation passed: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-model.test.ts` (7 files, 130 tests); `npm.cmd run typecheck`.
- Still not implemented or changed: Narration Generator three-line schema redesign, Runtime Update Proposal redesign, wiki writer/apply behavior, UI display/control changes, ordinary `wiki/runtime` category, `RPG_SCHEMA_SLOTS`, or automatic `wiki/outlines/main.md` writes.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Runtime Contract Stage

- Completed **RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 2 阶段：Runtime 类型 + Interaction Contract 阶段**，仅覆盖 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` checklist 第 3、4 点。
- Added runtime/review handoff types in `src/lib/rpg-runtime/types.ts`: `StoryOutlineRegeneratorInput`, `ProvisionalOutlinePatch`, `ProvisionalNarrationHandoff`, `OutlineRevisionProposal`, `RegenerationSafetyReport`, plus the output wrapper and narrow boundary helper types.
- Added `outline_regeneration` interaction implementation under `src/lib/rpg-interactions/runtime/`: prompt builder, bare/fenced JSON parser, deterministic validator, fixture adapter, and LLM streaming adapter.
- Registered and exported the new interaction as `outline_regeneration` / `runtime_story_outline_regenerator`; it is implemented as a contract layer only and remains disconnected from `runRpgTurn`.
- Validator rejects wiki writes, player-facing prose / `nextActionOptions`, ordinary runtime update / `ProposedWikiUpdate` pollution, direct `wiki/outlines/main.md` modification, future plans written into `events`, confirmed fact rewrites, forbidden reveal leakage, hidden / GM-only / parallel-line / `user_visible_pc_unknown` PC-knowledge leaks, unsafe safety reports, out-of-bound refs, invalid top-level shape, persistent provisional patches, and non-`outlineRevision` proposal review kind.
- Added `src/lib/rpg-story-outline-regenerator.test.ts` and updated `src/lib/rpg-interactions.test.ts` for registry expectations. Tests confirm runtime types are constructable, prompt boundaries are explicit, parser supports bare/fenced JSON, adapters run parser + validator, `RPG_SCHEMA_SLOTS` remains unchanged, no ordinary `wiki/runtime` category was added, and `runRpgTurn` is not wired to Story Outline Regenerator.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to mark only checklist items 3 and 4 complete; checklist item 5 orchestrator conditional call remains `[待实现]`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (3 files, 90 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "StoryOutlineRegeneratorInput|ProvisionalOutlinePatch|ProvisionalNarrationHandoff|OutlineRevisionProposal|RegenerationSafetyReport" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md`.
- Still not implemented or triggered: orchestrator conditional call, `runRpgTurn` main-flow changes, real generation in a runtime turn, Narration Generator changes, Runtime Update Proposal changes, wiki writer/apply behavior, UI changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Schema Stage

- Completed **RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 1 阶段：Schema 阶段**，仅覆盖 line1250 的第 1、2 点。
- Updated `docs/RPG_WIKI_SCHEMA.md` with the Step 14.5 schema boundary for `ProvisionalOutlinePatch`, `OutlineRevisionProposal`, `OutlineRevisionReviewPolicy`, and `RegenerationSafetyReport`.
- Documented that `provisionalOutlinePatch` is same-turn only, is not persisted to `wiki/`, does not modify `wiki/outlines/main.md`, and that `provisionalOutlinePatch.narrationHandoff` is a hard constraint for Step 15 Narration.
- Documented that `outlineRevisionProposal` is an independent review/pending item, not ordinary `ProposedWikiUpdate`, cannot be mixed into ordinary runtime update, and cannot automatically write `wiki/outlines/main.md`.
- Reconfirmed `wiki/outlines/main.md` remains `manual_or_review_only`; `wiki/outlines/progress.md` may record major divergence, invalidated beats, provisional patch adoption, and pending proposal refs without turning future revisions into facts.
- Reconfirmed `wiki/plot-arcs/runtime` can record post-divergence pressure, conflict, and branch state, but cannot replace `outlineRevisionProposal`.
- Added code-readable schema guidance in `src/lib/rpg-wiki-schema.ts`: `RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA`, `RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA`, `RPG_OUTLINE_REVISION_REVIEW_POLICY`, `RPG_REGENERATION_SAFETY_FIELDS`, aggregate guidance, and getters.
- Added focused assertions in `src/lib/rpg-wiki-schema.test.ts` confirming the new guidance is machine-readable, contains the core fields/boundaries, keeps provisional patches non-persistent, keeps outline revision proposals independent review/pending, and does not add ordinary wiki/runtime categories or change `RPG_SCHEMA_SLOTS`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` (1 file, 27 tests); `npm.cmd run typecheck`; `rg --encoding utf-8 "ProvisionalOutlinePatch|OutlineRevisionProposal|OutlineRevisionReviewPolicy|RegenerationSafetyReport" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts`.
- Still not implemented: runtime types, interaction spec / parser / validator / adapters, orchestrator conditional call, real generation of `provisionalOutlinePatch` / `outlineRevisionProposal`, Narration Generator changes, Runtime Update Proposal changes, wiki writer/apply behavior, UI changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Implementation Order Note

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to make the Step 14.5 / Story Outline Regenerator implementation order explicit as a task-progress checklist.
- The checklist records the intended small-step order: first update `docs/RPG_WIKI_SCHEMA.md`, then add code-readable guidance in `src/lib/rpg-wiki-schema.ts`, then add runtime types, then add interaction spec / parser / validator / adapters / focused tests, and only then connect the orchestrator conditional call.
- Reconfirmed the boundary: Step 14.5 should only run when LLM 4 reports `impactLevel: "major_rewrite_required"` and `requiresRegeneration: true`; `provisionalOutlinePatch` is same-turn narration hard constraint only, while `outlineRevisionProposal` is an independent review/pending item and must not auto-write `outlines/main.md`.
- This was documentation-only. No source code, schema implementation, tests, runtime behavior, LLM calls, UI, `RPG_SCHEMA_SLOTS`, git commit, or git push were changed.

## 2026-06-11 - LLM 4 Outline-aware Brief Handoff Cleanup

- Completed a small cleanup pass around the previous **LLM 4 / Step 14 second substage: Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff**.
- Reviewed `src/lib/rpg-runtime/outline-brief-handoff.ts` path classification helpers. Recall handoff helpers focus on safe deterministic reads / section boundaries, and schema guidance is descriptive rather than a runtime classifier, so the outline / plot-arc / hard-constraint / reveal-forbidden checks remain local to the LLM 4 handoff. Added a short implementation comment documenting that boundary instead of introducing a shared util.
- Added `sampleTurnRecordRuntimeParts()` to `src/lib/rpg-runtime-test-fixtures.ts` and reused it in focused turn-record / runtime-journal fixtures to reduce repeated `outlineAwareNarrationBrief`, `outlineImpactReport`, and `regenerationRequest` setup while keeping test-specific turn results and update samples explicit.
- Added a small runtime prompt boundary constants module for LLM 4 handoff text and reused it from Narration, Runtime Update Proposal, and Outline Brief prompts.
- Clarified in the `RegenerationRequest` runtime type comment and prompt boundary text that `regenerationRequest` is audit/control handoff only, not `outlineRevisionProposal`, not `provisionalOutlinePatch`, not a wiki write, and not permission to revise `wiki/outlines/main.md`.
- Still not implemented or triggered: Story Outline Regenerator / Step 14.5, any outline regeneration adapter, `provisionalOutlinePatch`, `outlineRevisionProposal`, Narration Generator three-line redesign, Runtime Update Proposal parser / target rules / apply / pending refactor, wiki writer / apply behavior changes, UI display/control changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts` (6 files, 101 tests); `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` (1 file, 15 tests); `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts` (3 files, 27 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Outline-aware Brief Compiler Orchestrator + Narration Brief Handoff

- Completed **LLM 4 / Step 14 second substage: Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff**.
- `runRpgTurn` now runs `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> outlineBriefCompiler -> narration -> turnRecord`.
- Added the local `buildOutlineBriefCompilerInputFromTurnState()` handoff layer in `src/lib/rpg-runtime/outline-brief-handoff.ts`.
- The first-version handoff derives `outlineSlices`, `plotArcTensionFuel`, `hardConstraints`, `visibilityBoundaries`, `runtimeRefs`, and `knownReferences` only from `PostActionWorkingState`, `RecallSelection`, deterministic `recalledMaterials`, World Tick state, and runtime refs; it does not read extra files.
- `runRpgTurn` now accepts injectable `outlineBriefCompilerAdapter`, calls existing `outline_brief` after deterministic recall handoff and before Narration, validates the output, and records major-regeneration impact as warning/audit only.
- `RpgTurnRecord` and runtime journal entries now persist `outlineAwareNarrationBrief`, `outlineImpactReport`, and optional `regenerationRequest` under the existing `.llm-wiki/runtime/` boundary.
- Narration prompt now receives `OutlineAwareNarrationBrief`, `outlineImpactReport`, and optional `regenerationRequest`; it states that Narration must obey the filtered brief, must not directly read complete `outlines/main.md`, must not leak GM-only / hidden / parallelLine-only / `user_visible_pc_unknown` material into PC knowledge, must keep `parallelLineBrief.grantsPcKnowledge: false`, and must treat `tensionBriefInput` as tension input rather than player prose or happened events.
- Runtime Update Proposal prompt now states that LLM 4 handoff is journal/audit/control handoff only: `outlineAwareNarrationBrief`, `outlineImpactReport`, and `regenerationRequest` are not accepted wiki facts, cannot be directly converted into ordinary wiki updates, and `regenerationRequest` is not `outlineRevisionProposal`.
- RPG runtime panel now creates and passes the LLM Outline Brief adapter into the existing flow without adding UI controls or display changes.
- `runtime_update_apply` turn-record handling now preserves the LLM 4 handoff fields.
- Still not implemented or triggered: Story Outline Regenerator / Step 14.5, `provisionalOutlinePatch`, `outlineRevisionProposal`, Narration Generator three-line redesign, Runtime Update Proposal redesign, wiki writer / apply changes, UI display changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (7 files, 127 tests); `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` (1 file, 15 tests); `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts` (3 files, 27 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Outline-aware Brief Compiler Contract + Interaction

- Completed **LLM 4 / Step 14 first substage: Outline-aware Brief Compiler Contract + Interaction + Validator + Tests**.
- Added minimal schema guidance for Outline-aware Brief Compiler: stable outline beat / reveal / branch condition ids, dependency / invalidation / line target / reveal policy semantics, outline impact rubric (`none`, `minor`, `branch`, `major_rewrite_required`), line-specific brief boundaries, and `tensionLine` / plot-arc fuel semantics.
- Added code-readable schema guidance and getters in `src/lib/rpg-wiki-schema.ts` without changing `RPG_SCHEMA_SLOTS` and without adding an ordinary `wiki/runtime` category.
- Added LLM 4 runtime-only contracts in `src/lib/rpg-runtime/types.ts`: `OutlineBriefCompilerInput`, `OutlineSlice`, `OutlineAwareNarrationBrief`, `OutlineImpactReport`, `RegenerationRequest`, and supporting ref / reveal policy / pacing / tension / forbidden-boundary types.
- Added `outline_brief` runtime interaction files: prompt/spec/parser, deterministic validator, fixture adapter, and LLM adapter.
- The prompt states LLM 4 is the Outline-aware Brief Compiler + Outline Impact Detector, treats `recalledMaterials` as filtered handoff rather than full outline authority, outputs only strict JSON, and forbids player prose, `nextActionOptions`, wiki writes, runtime update proposals, outline revision/provisional patch output, Story Outline Regenerator execution, direct file reads, and mutation of upstream runtime objects.
- The validator accepts bare and fenced JSON, checks required top-level output, validates `impactLevel`, enforces regeneration consistency, rejects forbidden pollution fields, rejects player-facing PC knowledge leakage, requires `parallelLineBrief.grantsPcKnowledge: false`, and rejects unknown recalled-material / runtime ref paths or sectionIds.
- Registered `outline_brief` as an implemented interaction with stage `runtime_outline_brief_compiler`; runtime exports now expose the new spec, parser/validator, and adapters.
- Added focused tests in `src/lib/rpg-outline-brief.test.ts` and updated registry/schema tests.
- Still not connected to `runRpgTurn`; the current turn flow remains `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> narration -> turnRecord`.
- Still not implemented: Story Outline Regenerator / Step 14.5, Narration Generator three-line redesign, Runtime Update Proposal redesign, wiki writer / apply / UI changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (3 files, 92 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Recall Selector Orchestrator + Deterministic Handoff

- Continued the interrupted **Recall Selector Orchestrator 接入 + Deterministic File-read Allowlist** stage and completed the missing cleanup.
- `runRpgTurn` now runs `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> narration -> turnRecord`.
- Added the runtime Recall Selector handoff layer in `src/lib/rpg-runtime/recall-selector-handoff.ts`: it builds a lightweight `RetrievalIndexEntry[]` from schema slots, compact brief references, post-action working state references, Action Resolution references, World Tick references, visible selection / working-state affected paths, and runtime overlay paths without embedding full file bodies.
- The first-version retrieval index uses stable synthetic section IDs where source metadata lacks section anchors and records warnings for that limitation.
- Deterministic local recall reading now only reads paths selected by `RecallSelection.selectedItems`, verifies the path exists in the retrieval index, verifies selected `sectionId` membership, honors path and section exclusions, enforces project-root / safe `wiki/` path boundaries, rejects traversal / absolute / hidden / ordinary `wiki/runtime` paths, and caps `wiki/outlines/main.md` so the full outline is not handed to Narration.
- Added `RecalledMaterial`, `RecalledMaterialSection`, and `RecallSelectorHandoff` runtime handoff types. `RecallSelection` remains the allowlist plan; `recalledMaterials` is the deterministic local read result.
- `RpgTurnRecord` and runtime journal entries now persist `recallSelection` and `recalledMaterials` under the existing `.llm-wiki/runtime/` boundary.
- Narration prompt now includes only minimal recall-handoff boundary language: recalled materials are filtered handoff, not full outline authority; GM-only / parallelLine / user-visible-PC-unknown material must not become PC knowledge; recall handoff is not wiki writes and does not perform Outline-aware Brief work.
- Runtime Update Proposal prompt and turn-record parsing preserve the boundary that unreviewed `RecallSelection` / `recalledMaterials` are journal/audit/filter handoff, not accepted wiki fact sources.
- Fixed the interrupted stage finish work: `runtime_update_apply` now preserves the new turn record recall fields; related test fixtures now construct complete turn records; the handoff reader now treats section-level exclusions separately from whole-path exclusions; synthetic section warnings are de-duplicated per path.
- Still not implemented: Outline-aware Brief Compiler / LLM 4, Story Outline Regenerator, Narration Generator three-line redesign, Runtime Update Proposal redesign, wiki writer / apply / UI changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (8 files, 132 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Recall Selector Contract + Interaction

- Completed the requested **Recall Selector Contract + Interaction + Validator + Tests** stage for LLM 3 / Step 13.
- Added Recall Selector runtime contracts in `src/lib/rpg-runtime/types.ts`: `RecallSelectorInput`, `RetrievalIndexEntry`, `RecallableSection`, `RecallSelection`, `RecallSelectedItem`, `RecallExclusion`, `RecallBudget`, and `RecallPolicy`. `RecallSelectorInput` consumes `PostActionWorkingState` and can carry the already-produced action resolution, World Tick result, visible selection, pacing state, gap state, retrieval index, budget, and policy.
- Added `recall_selector` interaction files under `src/lib/rpg-interactions/runtime/`: prompt/spec/parser, deterministic validator, fixture adapter, and LLM adapter.
- The Recall Selector prompt now states that recall is based on post-action `PostActionWorkingState`, not old `current-scene` coarse recall; it may output only a recall plan / allowlist and must not read files, generate narration, write wiki, generate update proposals, or produce LLM 4 / outline impact / outline regeneration outputs.
- `validateRecallSelection()` checks required fields, retrieval-index path membership, stable `sectionId` membership under `RetrievalIndexEntry.availableSections`, legal `lineTarget`, `readMode`, priority, visibility and knowledge scopes, valid exclusions, and the `parallelLine` / `user_visible_pc_unknown` versus PC knowledge boundary.
- The validator recursively rejects pollution fields including narration, player-facing text, parallel-line text, next action options, wiki writes, update proposals, pending updates, recalled full text, outline brief, outline impact report, outline revision/proposal, provisional outline patch, and regeneration request.
- Registered `recall_selector` in `RpgInteractionKind` and the RPG interaction registry with stage `runtime_recall_selector`; runtime exports now expose the Recall Selector interaction, validator, and adapters.
- Added `src/lib/rpg-recall-selector.test.ts` and updated `src/lib/rpg-interactions.test.ts` for the new registry entry.
- This stage still did not connect Recall Selector to `runRpgTurn`, did not implement deterministic file-read allowlist, did not implement recalledMaterials reading, did not implement Outline-aware Brief Compiler / LLM 4, did not implement Story Outline Regenerator, did not implement Narration Generator three-line redesign, did not implement Runtime Update Proposal redesign, did not modify wiki writer / apply / UI, did not add an ordinary `wiki/runtime` category, and did not modify `RPG_SCHEMA_SLOTS`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (3 files, 90 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Orchestrator + Working State Handoff

- Completed the requested local handoff stage after World Tick integration, without entering Recall Selector.
- `runRpgTurn` now runs `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> narration -> turnRecord`.
- Added local Step 11-12 support in `src/lib/rpg-runtime/world-tick-working-state.ts`: visible selection chooses PC-visible / PC-inferred action and world deltas, user-visible PC-unknown parallel lens candidates, and tension / pacing / gap candidates; working state merges action resolution, World Tick result, visible selection, time state, campaign delta, pacing state, gap state, runtime delta refs, references, and warnings.
- `RpgTurnRecord` and runtime turn journal entries now save `worldTickResult`, `visibleSelection`, and `postActionWorkingState` under the existing `.llm-wiki/runtime/` journal boundary.
- Narration prompt now consumes the structured working state / visible selection as hard constraints, including: follow `PostActionWorkingState`, do not alter `WorldTickResult`, do not turn `parallelLine` / `user_visible_pc_unknown` into PC knowledge, do not invent new World Tick events, and do not write wiki.
- Runtime Update Proposal remains first-version scoped to `submittedAction + generatedNarrative + references`; prompt text now records that `worldTickResult`, `visibleSelection`, and `postActionWorkingState` are journal/audit data and must not be directly converted into wiki writes.
- RPG runtime panel now creates and passes the LLM World Tick adapter into the existing turn flow without UI display changes.
- Added `src/lib/rpg-world-tick-working-state.test.ts` and updated orchestrator, turn model, persistence, controller, interactions, panel, state extractor, write policy, runtime-update-apply, and fixture tests around the new record contract.
- This stage still did not implement Recall Selector / LLM 3, Outline-aware Brief Compiler / LLM 4, Story Outline Regenerator, Narration Generator three-line redesign, Runtime Update Proposal redesign, wiki writer/apply changes, UI display changes, an ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (9 files, 124 tests); `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` (1 file, 15 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Interaction + Validator Contract

- Completed the requested **World Tick Schema + Contract** follow-up items 3 and 4 from `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`.
- Added the `world_tick` runtime interaction spec, prompt builder, bare/fenced JSON parser, fixture adapter, LLM adapter, and deterministic validator under `src/lib/rpg-interactions/runtime/`.
- The World Tick prompt now states that `ActionResolution.playerActionDelta` is the canonical player-action-only delta; World Tick consumes it as-is, must not reinterpret or re-adjudicate the player action, must not derive canonical player facts from `directResults`, and only advances the resolved `timeDelta` interval.
- The prompt forbids wiki writes, player-facing narration, `nextActionOptions`, Recall Selector output, outline revision/regeneration output, and requires strict `WorldTickResult` JSON only.
- `validateWorldTickResult()` now checks required top-level fields, the three `worldDeltas` lines, clock updates, settled ongoing events, information broadcast, reaction queue, pacing update, gap state, runtime delta refs, references, and warnings.
- The validator checks every delta-like object for `narrativeLine`, `visibility.visibilityScope`, `visibility.knowledgeScope`, `happenedStatus`, `affectedPaths`, and `runtimeDeltaRefs`, and recursively rejects wiki write, narration, next-action, outline revision, and Recall Selector pollution fields.
- Registered `world_tick` in `RpgInteractionKind` and the RPG interaction registry with stage `runtime_world_tick`; runtime exports now expose the World Tick interaction, validator, and adapters.
- Added `src/lib/rpg-world-tick-interaction.test.ts` covering prompt boundaries, bare/fenced JSON parsing, missing required fields, missing delta metadata, forbidden pollution, fixture adapter, LLM adapter streaming/parse behavior, registry exposure, canonical `playerActionDelta`, and the parallel-line display versus PC knowledge boundary.
- This stage still did not connect World Tick to `runRpgTurn`, did not write turn records or runtime journal entries, did not implement working-state merge, Recall Selector, Outline Brief, Narration three-line redesign, Runtime Update Proposal redesign, wiki writer/apply changes, UI changes, ordinary `wiki/runtime` category, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (4 files, 87 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Schema + Types Contract 前半阶段

- Completed the **World Tick Schema + Types Contract 前半阶段** requested after the Action Resolver orchestrator integration.
- `docs/RPG_WIKI_SCHEMA.md` now has a dedicated World Tick semantic boundary section covering clock/countdown, ongoing event, information broadcast, reaction queue, visibility meta, pacing state, and gap signal.
- The schema text now states that World Tick directly consumes `ActionResolution.playerActionDelta` as the canonical player-action-only delta, does not re-adjudicate player success, does not derive player facts from `directResults`, does not write wiki, does not generate player-facing narration, and does not generate `nextActionOptions`.
- `src/lib/rpg-wiki-schema.ts` now exposes code-readable World Tick guidance and field getter functions for visibility meta, clock updates, ongoing event settlements, information broadcast, reaction queue, pacing state, and gap signals.
- `src/lib/rpg-runtime/types.ts` now defines `WorldTickInput`, `WorldTickResult`, `WorldTickVisibilityMeta`, clock update, settled ongoing event, information broadcast, reaction queue, pacing update, and gap state contracts. `WorldTickInput` directly carries `actionResolution`, `playerActionDelta: ActionResolution["playerActionDelta"]`, and `timeDelta: ActionResolution["timeDelta"]`.
- Added `src/lib/rpg-world-tick-contract.test.ts` to validate representative `WorldTickInput` / `WorldTickResult` fixtures with TypeScript `satisfies`, including visibility / knowledge / happenedStatus / affectedPaths / runtimeDeltaRefs metadata.
- Updated `src/lib/rpg-wiki-schema.test.ts` to cover the new World Tick guidance and confirm that no ordinary `runtime` category was added to `RPG_WIKI_SCHEMA`.
- This stage did not implement World Tick interaction, parser, validator, adapter, prompt, orchestrator wiring, working-state merge, Recall Selector, Outline Brief, Narration changes, Runtime Update Proposal changes, wiki write/apply behavior, UI, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-action-resolver.test.ts` (2 files, 41 tests); `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts` (1 file, 2 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Action Resolver Orchestrator Integration + Tests

- Completed the **Orchestrator 接入小阶段** and **测试小阶段** from `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`.
- `runRpgTurn` now runs `preview -> actionResolver -> narration -> turnRecord`; it builds a minimal `ActionResolverInput` from the existing `CompactStoryBrief` / preview data and does not add a new file-read or recall flow.
- `ActionResolution` is now passed to the Narration Generator prompt as a hard adjudication constraint. The prompt says not to rewrite `ActionResolution.eventDraft.status`, not to turn `attempted_not_confirmed` into confirmed happened narration, and to stay within resolver-approved feasibility, costs, obstacles, direct results, uncertainty, `timeDelta`, and `progressPotential`.
- `RpgTurnRecord` now stores `actionResolution`; record references merge narration references with `actionResolution.references[].path` and still clean legacy paths.
- Runtime turn journal entries now store `actionResolution` at the journal boundary and still write only under `.llm-wiki/runtime/`, not `wiki/`.
- Runtime Update Proposal remains first-version scoped to `submittedAction + generatedNarrative + references`; prompt text now explicitly warns that journal/audit `actionResolution` must not be used as a confirmed factual source and that `attempted_not_confirmed` event drafts must not become confirmed events.
- The RPG runtime panel now creates and passes the LLM Action Resolver adapter into the existing turn flow without changing UI.
- Added a small test fixture helper for valid `ActionResolution` samples and updated orchestrator, turn model, controller, persistence, interaction, panel, state extractor, write policy, and runtime-update-apply tests around the new record contract.
- This stage did not implement World Tick + Reaction, Recall Selector, Outline-aware Brief Compiler, a large Narration Generator redesign, a large Runtime Update Proposal redesign, wiki writer/apply changes, project skeleton changes, UI changes, or `RPG_SCHEMA_SLOTS` changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts` (5 files, 49 tests); `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` (2 files, 73 tests); extra related validation `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-import/runtime-update-apply.test.ts` (4 files, 42 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Action Resolver Contract + Interaction

- Completed the **Action Resolver Contract** small stage and **Action Resolver Interaction** small stage from `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`.
- Added code-level Action Resolver runtime contracts in `src/lib/rpg-runtime/types.ts`, including `ActionResolverInput`, `PreActionSnapshot`, `ActionResolution`, `PlayerActionDelta`, event draft status handling, `timeDelta`, `progressPotential`, player-action-only deltas, references, warnings, and `RuntimeDeltaRef` linkage.
- Added `ACTION_RESOLVER_DEFAULT_EVENT_STATUS = "attempted_not_confirmed"` so ordinary player actions remain attempts unless explicitly confirmed by action text or the frozen pre-action snapshot.
- Added Action Resolver interaction files under `src/lib/rpg-interactions/runtime/`: prompt/spec/parser, validator, fixture adapter, and LLM adapter.
- Registered the new `action_resolver` interaction kind in the RPG interaction registry and runtime exports without connecting it to `runRpgTurn`.
- Added focused Action Resolver tests in `src/lib/rpg-action-resolver.test.ts` and updated the shared interaction registry test for the new implemented kind.
- Parser / validator coverage now rejects missing `timeDelta`, missing `progressPotential`, illegal `eventDraft.status`, unsafe `confirmed_happened` action attempts, mixed feasibility/cost/obstacle/direct-result fields, wiki write proposal pollution, player-facing narration pollution, and World Tick / Reaction pollution.
- Prompt/spec coverage confirms the prompt states that the player action is an attempt, uses `attempted_not_confirmed`, separates feasibility / cost / obstacle / direct result, and forbids world tick, wiki write, and player-facing narration.
- This stage did not modify `runRpgTurn`, the runtime orchestrator, Narration Generator prompt, Runtime Update Proposal prompt, World Tick + Reaction, Recall Selector, Outline-aware Brief Compiler, runtime prompt wiring, wiki writer/apply logic, UI, project skeleton, or `RPG_SCHEMA_SLOTS`.
- Validation passed: `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-interactions.test.ts` (2 files, 65 tests); `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` (1 file, 24 tests); `npm.cmd run typecheck`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Schema Spine

- Completed the Schema Spine small stage from `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`.
- Updated `docs/RPG_WIKI_SCHEMA.md` to define the Runtime Schema Spine / 运行时共享契约 and to clarify that ordinary `wiki/` is separate from turn record / runtime journal / `.llm-wiki/runtime/` intermediate metadata.
- Rewrote the old ordinary `runtime/` wiki directory description so runtime context, turn records, unresolved runtime metadata, pending updates, and journals are no longer recommended as `wiki/runtime/` pages.
- Added code-readable shared runtime schema guidance in `src/lib/rpg-wiki-schema.ts`, including `NarrativeLine`, `UsePurpose`, visibility / knowledge scopes, `HappenedStatus`, `RuntimeDeltaRef`, `RecallableSection`, outline impact levels, review item kinds, persistence boundaries, and Action Resolver fixed slot semantics.
- Updated `src/lib/rpg-wiki-schema.test.ts` to verify that `RPG_WIKI_SCHEMA` still has no runtime category and that the new runtime spine values, fields, fixed slot semantics, and `.llm-wiki/runtime/` boundary are exposed.
- Clarified Action Resolver prerequisites for `wiki/current-scene/scene_state.md`, `wiki/player/known_information.md`, `wiki/outlines/progress.md`, and `wiki/rules/`.
- This stage did not implement Action Resolver interaction, orchestrator integration, World Tick, runtime prompts, new LLM calls, or UI changes.
- Validation passed: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts`; `npm.cmd run typecheck`; requested UTF-8 `rg` checks for new constants and old runtime path residue.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Recallable Section Semantics

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to make stable section identity a hard requirement for future schema changes.
- Recorded that any new runtime-facing wiki block intended for retrieval must define stable `sectionId` and controlled `sectionRole`; natural-language markdown headings are only display headings or aliases.
- Added a suggested `RecallableSection` shape with `sectionId`, `sectionRole`, `heading`, `aliases`, `lineTargets`, visibility / temporal / authority metadata, `readModes`, and `summaryPolicy`.
- Clarified that `RetrievalIndexEntry.availableSections` should be `RecallableSection[]`, and that `RecallSelection.selectedItems.sections` and `RecallExclusion.sections` should reference `sectionId` rather than current markdown headings.
- Clarified that `OutlineSlice.section` should also prefer the selected `RecallableSection.sectionId`, keeping markdown headings only as human-facing labels when needed.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Schema Implementation Strategy

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` with an explicit implementation strategy for schema work: build a minimal shared runtime schema spine first, then advance module by module.
- Recorded that the next implementation should not attempt a full 6 / 7 LLM schema rewrite up front, and should not let each module invent overlapping base fields independently.
- Defined the shared spine scope: narrative/use-purpose lines, visibility and knowledge scopes, happened status, runtime delta refs, time/pacing/clock basics, gap/outline impact boundaries, and the `wiki/` versus `.llm-wiki/runtime/` persistence boundary.
- Recorded Action Resolver as the first module to implement after the shared spine because it is the fact entrance for later World Tick, Narration, and Runtime Update Proposal stages.
- Added a five-step follow-up plan: Schema Spine, Action Resolver Contract, Action Resolver Interaction, Orchestrator integration, and focused tests.
- Clarified that the first Action Resolver integration should move the runtime flow from `preview -> narration -> turnRecord -> update proposal` to `preview -> actionResolution -> narration -> turnRecord -> update proposal`, without introducing World Tick yet.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime TensionLine Authority Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to elevate `tensionLine` from a per-turn tension observation into a long-running emotional / dramatic tension outline parallel to `playerVisibleLine` and `parallelLine`.
- Reframed `plot-arcs/` and `plot-arcs/runtime/` as a tension fuel / plot material layer rather than the long-term story-structure authority: they now provide foreshadowing, unresolved conflicts, pressure sources, clock candidates, branch/reveal material, and possible tension moves that `tensionLine` can consume.
- Proposed `wiki/outlines/tension-line.md` as the preferred persistent control slot for the emotional / dramatic tension outline, with `wiki/outlines/progress.md#Tension Line Progress` as a first-version transitional location if a new fixed slot is deferred.
- Updated the shared schema guidance, LLM 2 World Tick plan, LLM 3 Recall Selector plan, LLM 4 Outline-aware Brief Compiler plan, LLM 5 Narration Generator plan, LLM 6 Runtime Update Proposal plan, and the 19-step flow language to carry `tensionLineOutline`, `plotArcTensionFuel`, and `tensionLineUpdateCandidate`.
- Clarified writeback boundaries: relationship facts go to `relationships/runtime`, plot pressure material goes to `plot-arcs/runtime`, and long-term tension direction goes to the tensionLine slot through proposal / pending / review / apply.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Shared Schema Conflict Unification

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` with a shared runtime schema unification section before the per-LLM schema plans.
- Unified the soft-conflict concepts across the 7 schema-planning rounds: persistence priority, `NarrativeLine` versus `UsePurpose`, visibility and knowledge fields, `HappenedStatus`, `RuntimeDeltaRef`, clock/pacing persistence, gap versus outline impact levels, outline progress versus plot-arc runtime boundaries, outline revision review item separation, tension writeback boundaries, and next-action option non-fact status.
- Clarified that current-scene only stores the next-turn clock/pacing snapshot, long-lived clock authority belongs in the relevant runtime overlay, and per-turn clock/pacing deltas remain in `WorldTickResult` / `workingState` / turn journal until proposal/apply.
- Clarified that `outlineRevisionProposal` is not a normal `ProposedWikiUpdate`; LLM 6 may package it as an independent `outlineRevision` review item, but ordinary runtime update must not write `outlines/main.md`.
- Recorded the preferred code-readable follow-up direction: add shared guidance/types such as `RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE`, visibility fields, runtime delta refs, clock fields, outline impact levels, and review item kinds before implementing individual interaction specs.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Update Proposal Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the LLM 6 / Runtime Update Proposal schema plan.
- Documented that LLM 6 should consume the validated `workingState`, `ActionResolution`, `WorldTickResult`, `RecallSelection`, outline/narration briefs, optional provisional outline patch and outline revision proposal, `TurnNarration`, consistency validation, display policy, write policy, and review policy.
- Recorded that Runtime Update Proposal should evolve from extracting updates out of `submittedAction + generatedNarrative + references` into generating reviewable proposal packages from structured runtime deltas.
- Identified schema gaps around source delta references, line/visibility/knowledge metadata, pacing and clock update proposals, outline revision review items, skipped delta/no-op reporting, proposal grouping, and JSON-first proposal output.
- Proposed `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, enhanced `ProposedWikiUpdate`, `OutlineRevisionReviewItem`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, and `ProposalGroup` shapes, plus an implementation order from schema docs to code-readable guidance, structured parser updates, and stronger local validation.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Narration Generator Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the LLM 5 / Narration Generator schema plan.
- Documented that LLM 5 should consume `workingState`, `OutlineAwareNarrationBrief`, optional `ProvisionalOutlinePatch.narrationHandoff`, `ActionResolution`, `WorldTickResult`, selected visible content, selected parallel lens, reaction queue, pacing directive, campaign delta requirement, reveal policy, style bundle, forbidden narration constraints, and output contract.
- Recorded that the current single `narrative`-oriented `RpgTurnResult` is too narrow and should become a three-line, verifiable `TurnNarration` structure with `playerFacingText`, `parallelLineText`, `tensionBrief`, `nextActionOptions`, `displayPolicy`, `narrationMeta`, and references.
- Identified schema gaps around narration handoff priority, player knowledge boundary, structured tension brief, pacing compliance, enhanced next action option metadata, and style/runtime handoff boundaries.
- Proposed `NarrationGeneratorInput`, `TurnNarration`, `NarrationDisplayPolicy`, `TensionBrief`, `NarrationMeta`, and enhanced `RpgActionOption` shapes, plus an implementation order from schema docs to code-readable guidance, narration output type changes, and later update proposal consumption.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Story Outline Regenerator Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the conditional LLM +1 / Story Outline Regenerator schema plan.
- Documented that the conditional regenerator should only run after `major_rewrite_required`, consume `workingState`, outline slices, outline progress, `OutlineImpactReport`, `RegenerationRequest`, confirmed/immutable facts, preservation constraints, visibility boundaries, reveal policy, and review policy.
- Recorded the required dual-track output: `ProvisionalOutlinePatch` for same-turn non-persistent hard narration constraints, and `OutlineRevisionProposal` as an independent review/pending item that cannot silently update `outlines/main.md`.
- Identified schema gaps around provisional patch structure, outline revision proposal structure, immutable facts, outline revision review boundary, progress/proposal separation, reveal/theme preservation, and narration handoff constraints.
- Proposed `StoryOutlineRegeneratorInput`, `ProvisionalOutlinePatch`, `ProvisionalNarrationHandoff`, `OutlineRevisionProposal`, and `RegenerationSafetyReport` shapes, plus an implementation order from schema docs to code-readable guidance, interaction spec, and separate review handling.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Outline Brief Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the LLM 4 / Outline-aware Brief Compiler + Outline Impact Detector schema plan.
- Documented that LLM 4 should consume `workingState`, `ActionResolution`, `WorldTickResult`, `RecallSelection`, recalled materials, pacing state, gap state, reaction queue, visibility boundaries, outline slices, plot arc runtime state, rules, style constraints, and forbidden contradictions.
- Recorded that LLM 4 should output a filtered narration brief plus `OutlineImpactReport`, and when required a `RegenerationRequest`, rather than player-facing prose or direct outline writes.
- Identified schema gaps around machine-readable outline beat/reveal/branch ids, outline impact rubric, line-specific brief structure, reveal policy, plot-arc/runtime-to-outline linkage, dependency/contradiction fields, and narration handoff boundaries.
- Proposed `OutlineBriefCompilerInput`, `OutlineSlice`, `OutlineAwareNarrationBrief`, `OutlineImpactReport`, and `RegenerationRequest` shapes, plus an implementation order from outline schema docs to code-readable guidance, interaction spec, and filtered handoff to narration.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Recall Selector Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the LLM 3 / Recall Selector schema plan.
- Documented that LLM 3 should consume the action-after `workingState`, `ActionResolution`, `WorldTickResult`, selected visible content, selected parallel lens, pacing state, gap state, outline position, a lightweight retrieval index, recall budget, and recall policy.
- Recorded that LLM 3 should output a recall plan / allowlist, not player-facing prose or direct file contents; actual path and section reads remain local and constrained by safety policy.
- Identified schema gaps around mandatory `Runtime Capsule`, page-level recall metadata, section-level recall, three-line recall boundaries, negative recall / exclusions, and working-state anchor fields.
- Proposed `RecallSelectorInput`, `RetrievalIndexEntry`, `RecallSelection`, `RecallLineTarget`, and `RecallExclusion` shapes, plus an implementation order from schema docs to code-readable guidance, interaction spec, and local allowlisted reads.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime World Tick Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` under `Schema 改造计划记录` with the LLM 2 / World Tick + Reaction schema plan.
- Documented that LLM 2 should consume `ActionResolution`, `playerActionDelta`, pacing state, active clocks, ongoing events, relationship pressure, plot arc runtime state, outline position, gap signals, and visibility boundaries, then output structured world deltas instead of player-facing prose or direct wiki updates.
- Recorded the current schema gaps for active clocks/countdowns, ongoing events, information broadcast, reaction queue, three-line delta visibility metadata, and pacing debt persistence.
- Proposed stronger required semantics for `wiki/current-scene/scene_state.md`, `plot-arcs/runtime`, `relationships/runtime`, `characters/runtime`, `factions/runtime`, `locations/runtime`, `items/runtime`, and `player/known_information.md`.
- Added suggested `WorldTickInput`, `WorldTickResult`, and `WorldTickVisibilityMeta` shapes, plus an implementation order: update schema docs, add code-readable schema guidance, add World Tick interaction/types, then persist `WorldTickResult` in runtime records for working-state merge.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Action Resolver Schema Plan

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` with a new `Schema 改造计划记录` section for recording per-LLM schema requirements during turn-flow discussion.
- Added the LLM 1 / Action Resolver schema plan: current schema can support only rough action parsing and needs stronger pre-action snapshot, active clock/countdown, pacing, visibility, adjacent beat, and structured action-resolution contracts.
- Documented that `runtime/` should not become a normal wiki category for this purpose; short-lived Action Resolver outputs should live in turn records / runtime journal, while persistent facts remain behind pending/review/apply.
- Proposed stronger required semantics for `wiki/current-scene/scene_state.md`, `wiki/player/known_information.md`, `wiki/outlines/progress.md`, `rules/`, and runtime overlays before implementing Action Resolver itself.
- Recorded suggested `ActionResolverInput` and `ActionResolution` shapes plus an implementation order: update schema docs, add code-readable schema guidance, add Action Resolver interaction spec, then persist `ActionResolution` in runtime records.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Outline Gap Event Update

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` so gaps between key outline beats are treated as elastic runtime periods rather than empty or automatically low-impact filler.
- Added `gapState` with `betweenBeats`, `gapMode`, `gapEvent`, `gapImpactLevel`, and `affectedFutureBeats`.
- Clarified that gap events may change the future outline if they are causally grounded in player action, character motivation, location conditions, active clocks, parallel-line movement, relationship pressure, or pacing pressure.
- Documented that outline revision is not permission before a gap event happens; the event is first settled as runtime fact, then Outline Impact Detector and optional step 14.5 adapt the future outline.
- Updated steps 1, 5, 7, 8, 12-18 so adjacent key beats, branch conditions, gap detection, gap event settlement, validation, writeback, outline progress, and accepted fact priority are explicit.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Pacing Anti-Stagnation Update

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to explicitly prevent RPG runtime stagnation where many dialogue turns advance only tiny amounts of in-world time.
- Added a `timeDelta` / `campaignDelta` / `pacingIntent` / `stagnationRisk` / `pacingDebt` / `activeClocks` pacing model.
- Clarified that one turn is not one minute: elapsed in-world time must be derived from the submitted action, scene needs, active clocks, and pacing policy.
- Added the default rule that formal turns should produce at least one campaign delta unless the player or GM explicitly requests pause, waiting, recap, casual talk, or deliberately slow interaction.
- Updated the 19-step flow so action resolution, world tick, recall, brief compilation, narration, validation, runtime update proposal, and apply all preserve pacing and clock boundaries.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Three-Line Narration Update

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` to formalize a three-line narration model: `playerVisibleLine`, `parallelLine`, and `tensionLine`.
- Defined `parallelLine` as player-invisible/offscreen narration that is generated by default and controlled by `displayPolicy.showParallelLine` for UI display.
- Clarified that showing the parallel line to the real user/GM does not make it player-character knowledge and must not automatically update `player/known_information.md`.
- Updated the runtime flow language for World Tick, Recall Selector, Outline-aware Brief Compiler, Narration Generator, consistency validation, and Runtime Update Proposal so lane ownership, visibility, knowledge source, and writeback boundaries remain explicit.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime Outline Impact Branch Update

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` so the 19-step runtime flow now includes Outline Impact Detector inside step 14 as part of the outline-aware brief compiler.
- Added conditional step 14.5 for Story Outline Regenerator. Regular turns remain minimum 6 LLM interactions; major outline-divergence turns add one conditional LLM interaction before narration.
- Documented the split between `provisionalOutlinePatch` and `outlineRevisionProposal`: the patch is a same-turn hard constraint for narration, while the revision proposal is a separate review/pending item and cannot silently overwrite `wiki/outlines/main.md`.
- Updated steps 15-17 so narration must follow the provisional patch, consistency validation gates patch compliance before player-visible output and writeback proposal, and any outline revision remains separate from ordinary runtime updates.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-10 - RPG Runtime 19-Step Flow Draft

- Added `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` as a detailed discussion draft for a 19-step RPG Runtime turn flow using the minimum 6 LLM interactions.
- The draft separates local snapshot/context/merge/review/apply work from the six model-facing stages: Action Resolver, World Tick + Reaction, Recall Selector, Brief Compiler, Narration Generator, and Runtime Update Proposal.
- It records the key sequencing principle under discussion: action parsing uses only minimal pre-action context, total recall happens after an action-after working state exists, and persistent wiki writes remain behind proposal / pending / review / apply.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-09 - Context Compiler Setting Availability Reframing

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md` to document how Context Compiler replaces traditional AI roleplay's full-setting injection.
- Added the `setting availability system` concept: narration should receive the current turn's world slice through fixed hard context, capsule indexes, relevant recall, director / advancement brief, source path references, and post-turn runtime writeback, rather than receiving all setting material.
- Clarified the always-on context set: submitted action, current-scene, fixed player slots, active quests, core/relevant rules, forbidden style / hard gates / explicit control blocks, player preferences, and recent reliable turn records or capsules.
- Added capsule-first reading guidance for runtime-facing wiki pages, including the recommended `Runtime Capsule` shape and the rule that full sections should be read only when the player action directly touches their details.
- Added narration knowledge-boundary rules: narration can freely write prose and pacing, but should treat the brief, source paths, fixed hard context, forbidden assumptions, and plot advancement fields as its knowledge boundary; it must not invent unstated world facts, NPC knowledge, location state, item powers, or happened events.
- Added `knowledgeBoundary` fields to the proposed second-pass brief shape: `alwaysOnContext`, `recalledSettingSlice`, `capsuleOnlyPaths`, `expandedSectionPaths`, `sourcePathPolicy`, and `doNotInvent`.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-09 - Context Compiler Plot Advancement Reframing

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md` and the Stage 6.17 summary in `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` to incorporate the latest design reflection: Context Compiler is not just a context summarizer, but the runtime layer that converts recalled memory, current state, and future outline into per-turn plot advancement pressure.
- Reframed the two LLM interactions: the first pass remains Recall Selector / Memory Routing, while the second pass is now `Outline-aware Plot Advancement Brief Compiler`, responsible for director judgment and a concrete campaign delta rather than ordinary synthesis.
- Added the principle that every formal narration turn should produce at least one campaign delta, with `micro`, `medium`, and `strong` advancement strengths. The default v1 pacing policy requires at least micro advancement, prefers medium pressure after several low-progress turns, and reserves strong advancement for justified player action / state / outline conditions.
- Added `plotAdvancement` output guidance with `pacingIntent`, `advancementStrength`, `thisTurnMustChange`, `beatToApproach`, `pressureMove`, `revealPolicy`, `doNotResolveYet`, and `playerAgencyRule`.
- Clarified that the second pass must not prewrite player-facing narrative, full NPC dialogue, next action options, or secondhand style summaries; it must instead tell narration what should change, what pressure should surface, what should remain hidden, and how to avoid railroading while still advancing the world.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-09 - Context Compiler v1 Plan Alignment

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md` before implementation so it reflects the completed RPG LLM interaction consolidation and RPG import modularization work.
- Context Compiler v1 is now documented as a fixed two-LLM-interaction flow for every formal narration turn: Recall Selector / Memory Routing followed by Outline-aware Context Brief Compiler. It no longer describes normal 1-call downgrade or 3-call upgrade modes; deterministic v0 fallback remains only for LLM failure.
- Replaced the obsolete `wiki/plot-arcs/main-outline.md` reference with the current fixed outline slots: `wiki/outlines/main.md` and `wiki/outlines/progress.md`, plus active `plot-arcs/*.md` and `plot-arcs/runtime/*.md`.
- Clarified outline guidance extraction through schema sections: main outline supplies premise, act structure, intended/delayed reveals, branch conditions, and must-not-contradict constraints; outline progress supplies current stage, completed/diverged beats, and next useful beats; plot arcs supply dramatic question, current pressure, conflicts, and runtime beat changes.
- Reworked the control-material boundary: rules slots may inform Context Compiler reasoning; `style_narration` / `style_dialogue` should pass through to Narration instead of being rewritten as secondhand style summaries; `style_forbidden`, `memory_player_preferences`, `{{setvar::...}}`, forbidden words, and hard gates remain high-priority control material; other memory slots are auxiliary and not more authoritative than concrete fact/state directories.
- Updated `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` Stage 6.17 summary to match the revised detailed plan and current `src/lib/rpg-interactions/` directory layout for future context-compiler interaction specs.
- This was documentation-only. No source code, tests, runtime behavior, import behavior, LLM calls, git commit, or git push were performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 4-5

- Completed Phase 4-5 of `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`: import mode model/contract boundaries are now queryable from `src/lib/rpg-interactions/`, and old RPG prompt islands were rechecked.
- Moved `controlDocCanonicalizationInteractionSpec` from the old top-level `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts` into `src/lib/rpg-interactions/control-doc/canonicalization-interaction.ts`; the old top-level file was deleted with no long-lived wrapper.
- Added `src/lib/rpg-interactions/control-doc/import-contract.ts` and `src/lib/rpg-interactions/control-doc/index.ts`. The contract owns the supported slots `main_outline`, `outline_progress`, `rules_core`, and `style_narration`, plus target paths, write policies, review policies, and canonicalization notes.
- Added `src/lib/rpg-interactions/campaign-setup/setup-contract.ts` and `src/lib/rpg-interactions/campaign-setup/index.ts`. The contract owns the supported slots `player_main`, `current_scene`, `events_prologue`, `main_quest`, `quest`, and `player_relationship`; dynamic `questName` / `relationshipName` path resolution; write/review policies; future-pressure filtering; ability-like input review notes; and the `current_scene` explicit bootstrap boundary.
- Follow-up cleanup moved the remaining source-ingest shared prompt/protocol helper from `src/lib/prompts/shared-ingest.ts` to `src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts`; `src/lib/prompts/` no longer contains prompt helpers for the current RPG interaction path.
- Updated `src/lib/rpg-import/control-doc-import.ts` and `src/lib/rpg-import/campaign-setup-import.ts` to consume deterministic contract data from the relevant `rpg-interactions` subdirectory barrels while retaining file reads/writes, safe path checks, manual confirmation, and review item generation in `rpg-import/`.
- Updated `src/lib/rpg-interactions/registry.ts`: `control_doc_canonicalization` remains stage `control_doc_import` but is now `usesLlm: false` with notes clarifying deterministic faithful canonicalization; added implemented deterministic kind `campaign_setup_import_contract` for stage `campaign_setup_import`; kept `campaign_setup_generation` planned rather than inventing current LLM behavior.
- Updated `src/lib/rpg-interactions.test.ts` to cover deterministic import contracts, registry `usesLlm` boundaries, old top-level control-doc file absence, old `src/lib/prompts/shared-ingest.ts` absence, and the campaign setup import guard against redefining future-pressure / supported-slot constants.
- Import behavior remains deterministic. No real LLM call path was added, no import write strategy was changed, and no legacy/default compatibility layer was introduced.
- Phase 4-5 validation on 2026-06-09 is green: `rg --encoding utf-8 "control-doc-canonicalization-interaction" src` returned no results; `rg --encoding utf-8 "prompts/shared-ingest|src/lib/prompts/shared-ingest|shared-ingest.ts" src` only finds the guarded absence assertion in `rpg-interactions.test.ts`; the requested broad prompt scan places real prompt/protocol text under `src/lib/rpg-interactions/`, while `Runtime Capsule` remains in deterministic lint/merge/signals/distiller helpers and tests as expected; both requested Vitest bundles passed (`5 files / 88 tests` and `4 files / 72 tests`), the follow-up source-ingest contract bundle passed (`2 files / 84 tests`); `npm.cmd run typecheck` passed.
- No real LLM tests, git commit, or git push were performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 3

- Completed Phase 3 of `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`: runtime prompt contracts, adapters, runtime update validation, and target policy are organized under `src/lib/rpg-interactions/runtime/`.
- Added `src/lib/rpg-interactions/runtime/index.ts` and exported it through `src/lib/rpg-interactions/index.ts`.
- Moved runtime interaction files into `src/lib/rpg-interactions/runtime/`: `narration-interaction.ts`, `runtime-update-interaction.ts`, `runtime-update-adapter.ts`, `llm-runtime-update-adapter.ts`, `runtime-update-validation.ts`, and `wiki-update-policy.ts`.
- Moved narration adapter contracts from `src/lib/rpg-runtime/` into `src/lib/rpg-interactions/runtime/`: `narration-adapter.ts` and `llm-narration-adapter.ts`.
- Deleted the old `src/lib/rpg-runtime/narration-prompts.ts` wrapper. `buildRpgNarrationPrompt()` now lives in `src/lib/rpg-interactions/runtime/narration-interaction.ts` and is exported from the runtime interaction barrel.
- Added `src/lib/rpg-interactions/runtime/runtime-update-protocol.ts` so the `rpg-wiki-update` fenced protocol marker is owned by the interaction runtime boundary; `src/lib/rpg-runtime/state-extractor.ts` consumes that helper while staying in runtime state extraction.
- Updated runtime consumers and tests to import narration/update contracts from `src/lib/rpg-interactions/runtime`: `turn-orchestrator.ts`, `runtime-controller.ts`, `state-extractor.ts`, `write-policy.ts`, `src/lib/rpg-import/runtime-update-apply.ts`, `src/components/rpg/rpg-runtime-panel.tsx`, and focused runtime tests.
- Updated `src/lib/rpg-runtime/index.ts` so it no longer exports narration prompt or LLM adapter contracts; it keeps runtime state, orchestration, persistence, write policy, controller, and runtime preview exports.
- Updated `src/lib/rpg-interactions.test.ts` guardrails so old runtime wrapper/adapter files must be absent and real runtime prompt text must not live under `src/lib/rpg-runtime/`.
- Phase 3 validation on 2026-06-09 is green: `rg --encoding utf-8 "narration-prompts|rpg-runtime/llm-narration-adapter|rpg-runtime/narration-adapter" src` returned no results; the prompt/protocol scan places narration/update prompt text and the `rpg-wiki-update` protocol marker under `src/lib/rpg-interactions/runtime/`, while `Runtime Capsule` also remains in deterministic lint/merge/validation helpers and tests as heading/policy checks; `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-update-validation.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed with 7 files / 114 tests; `npm.cmd run typecheck` passed.
- No real LLM tests, git commit, or git push were performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 2

- Completed Phase 2 of `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`: page merge LLM prompt and RPG merge policy are now under `src/lib/rpg-interactions/merge/`.
- Moved the old top-level `src/lib/rpg-merge-policy.ts` implementation to `src/lib/rpg-interactions/merge/merge-policy.ts`; no long-lived wrapper was kept at the old path.
- Added `src/lib/rpg-interactions/merge/page-merge-interaction.ts` with `PageMergeInteractionInput` and `pageMergeInteractionSpec`. The spec uses kind `page_merge`, builds the existing RPG merge system prompt plus the former page merge user message from `ingest.ts`, and returns raw complete-file output from `parseOutput()`.
- Added `src/lib/rpg-interactions/merge/index.ts` and exported merge contracts from `src/lib/rpg-interactions/index.ts`.
- Added `page_merge` to `RpgInteractionKind` and registered `pageMergeInteractionSpec` in `src/lib/rpg-interactions/registry.ts` with stage `page_merge` and `usesLlm: true`.
- Updated merge imports in `src/lib/page-merge.ts`, `src/lib/rpg-section-merge.ts`, `src/lib/rpg-merge-lint.ts`, `src/lib/rpg-merge-review.ts`, merge tests, and `src/lib/ingest.ts`.
- `src/lib/page-merge.ts` still owns deterministic safety boundaries: frontmatter union, locked fields, body shrink threshold policy, section merge, semantic lint, fallback, and backup.
- `src/lib/ingest.ts` now calls `pageMergeInteractionSpec.buildPrompt({ existingContent, incomingContent, pagePath, sourceFileName })`; its merge adapter only streams `systemPrompt` and `userPrompt` through `streamChat()`.
- Updated `src/lib/rpg-interactions.test.ts` guardrails so the old top-level merge policy file must be absent and old imports must not reappear.
- Phase 2 validation on 2026-06-09 is green: `rg --encoding utf-8 "rpg-merge-policy" src` returned no results; `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-review.test.ts` passed with 6 files / 110 tests; `npm.cmd run typecheck` passed.
- No merge prompt semantics, page safety behavior, real LLM tests, git commit, or git push were performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 0-1

- Completed Phase 0 + Phase 1 of `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`.
- Added `src/lib/rpg-interactions/registry.ts` and exported it from `src/lib/rpg-interactions/index.ts`. The implemented registry entries are `source_ingest_analysis`, `source_ingest_generation`, `control_doc_canonicalization`, `narration`, and `runtime_state_update`.
- Actual-code difference recorded: `RpgInteractionKind` still contains future kinds (`campaign_setup_generation`, `relationship_derivation`, `outline_impact`, `outline_regeneration`). They are explicitly listed as planned, not registered as implemented prompt behavior.
- Baseline search found that source ingest interaction specs already existed as thin wrappers, but the real Stage 1 / Stage 2 prompt bodies still lived in `src/lib/prompts/rpg-ingest.ts` and `src/lib/prompts/rpg-page-guidance.ts`; long-source chunk prompt bodies lived in `src/lib/ingest.ts`.
- Baseline import search also showed `src/lib/prompts/domain-guidance.ts` was only imported by the RPG ingest prompt, so it was moved with source ingest.
- Moved source-ingest contracts into `src/lib/rpg-interactions/source-ingest/`: `analysis-interaction.ts`, `generation-interaction.ts`, `page-guidance-contract.ts`, `chunk-analysis-interaction.ts`, `domain-guidance.ts`, and `index.ts`.
- Deleted the old source-ingest prompt files: `src/lib/prompts/rpg-ingest.ts`, `src/lib/prompts/rpg-page-guidance.ts`, and `src/lib/prompts/domain-guidance.ts`. `src/lib/prompts/` now only contains shared ingest prompt helpers.
- `src/lib/ingest.ts` now calls source-ingest interaction specs and chunk prompt builders from `src/lib/rpg-interactions/source-ingest/`; it keeps orchestration, token budget, chunk splitting, LLM calls, checkpoint/write logic, and short prompt-builder wrappers that delegate through the interaction specs.
- Added registry and legacy-location guardrails in `src/lib/rpg-interactions.test.ts`. Prompt-focused tests in `src/lib/ingest.prompt.test.ts` now import real prompt builders from `src/lib/rpg-interactions/source-ingest`.
- Acceptance searches confirmed no real source-ingest prompt implementation remains in `src/lib/prompts` or `src/lib/ingest.ts`, and no old RPG prompt imports remain under `src`.
- Remaining old RPG LLM prompt island for the next phase: `src/lib/rpg-merge-policy.ts` should be moved under the Phase 2 merge interaction boundary.
- Validation on 2026-06-09 is green: `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts` passed with 2 files / 81 tests; `npx.cmd vitest run src/lib/ingest.scenarios.test.ts src/lib/rpg-ingest-signals.test.ts` passed with 2 files / 28 tests; `npm.cmd run typecheck` passed.
- No product behavior, prompt semantics, FILE/REVIEW protocol, autoIngest write behavior, git commit, or git push was changed intentionally in this consolidation pass.

## 2026-06-09 - RPG LLM Interaction Consolidation Plan

- Evaluated the current developer-facing RPG prompt / LLM interaction layout and confirmed the reported problem is real and high priority.
- Added `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` as a concrete phased plan for moving RPG prompt builders, output protocols, target policies, parsers, validation, adapters, and interaction tests into `src/lib/rpg-interactions/`.
- Key finding: `src/lib/rpg-interactions/` already contains the right skeleton (`RpgInteractionSpec`, narration interaction, runtime update interaction, target policy, runtime update validation), but source ingest prompts still live under `src/lib/prompts/`, long-source chunk prompts still live in `src/lib/ingest.ts`, and page merge prompt policy still lives in `src/lib/rpg-merge-policy.ts`.
- Recommendation recorded: before adding new model-facing stages such as Context Compiler v1, relationship derivation integration, or outline impact detection, first complete RPG LLM interaction consolidation v1 so future model contracts do not continue to scatter.
- No code migration, tests, LLM calls, git commit, or git push were performed in this documentation-only planning pass.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 5-6 Partial

- Phase 5 completed the suspended RPG prototype module review.
- Deleted the isolated deterministic merge evaluation island: `src/lib/rpg-merge-evaluation.ts` and `src/lib/rpg-merge-evaluation.test.ts`. Before deletion it was only referenced by its own test and historical/design documentation; after deletion `rg --encoding utf-8 "rpg-merge-evaluation|evaluateRpgMergeSample|RpgMergeRegressionSample" src` returned no results.
- Kept `src/lib/rpg-merge-review.ts` and `src/lib/rpg-post-ingest-distiller.ts` with their focused tests. They remain RPG-only, review-controlled compression/distill proposal services and are not legacy llm_wiki compatibility code. This phase did not wire them into UI/runtime paths or add new product behavior.
- Kept `src/lib/rpg-relationship-tension-deriver.ts` and its focused test. It remains an RPG-only proposal/review service for future relationship/tension derivation and is not legacy llm_wiki compatibility code. This phase did not wire it into ordinary ingest, runtime apply, UI, or Tauri commands.
- Phase 6 removed current opencode automation files `opencode.json` and `scripts/run-opencode-stages.ps1`.
- `scripts/run_rpg_v02_tasks.py` was kept because current docs still reference it as a Codex-capable v0.2 task runner; its `opencode` agent preset was removed, and its generated prompt now follows the current RPG-only boundary instead of asking for legacy llm_wiki compatibility.
- `.codex/stages/` was confirmed complete for stages `00` through `12`; `scripts/run-codex-stages.ps1` remains the default staged automation entrypoint.
- `.opencode/` was confirmed to contain only historical stage prompts plus local dependency remnants (`node_modules`, package files). A path-checked recursive deletion was attempted twice, but the approval service returned 503 both times, so `.opencode/` still remains pending deletion. No workaround deletion was attempted after the rejection.
- Validation on 2026-06-09: `npm.cmd run typecheck` passed; `python -m py_compile scripts/run_rpg_v02_tasks.py` passed; `npx.cmd vitest run src/lib/rpg-merge-review.test.ts src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-relationship-tension-deriver.test.ts` passed with 3 files / 22 tests; `npx.cmd vitest run src/lib/rpg-merge-review.test.ts src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-relationship-tension-deriver.test.ts src/i18n/i18n-parity.test.ts` passed with 4 files / 27 tests.
- `npm.cmd run test:mocks` was attempted and failed with 2 files / 11 failing tests: `src/lib/ingest-source-path-collision.test.ts` now hits the existing RPG-only project-mode rejection for legacy fixtures, and `src/lib/rpg-state-extractor.test.ts` still expects base `wiki/relationships/*.md` runtime updates while current policy rejects that path. These failures were not introduced by the Phase 5-6 file deletions or opencode cleanup.
- No `git commit` or `git push` was performed.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 3-4

- Completed requested redundancy cleanup Phase 3-4 for the RPG-only project.
- Phase 3 removed the old vector v1 per-page API and migration surface: frontend `vector_legacy_row_count` / `vector_drop_legacy` invokes, Embedding settings legacy index prompt/drop action, related i18n keys, Tauri v1 command registration, v1 vectorstore command functions, and v1/legacy migration tests were removed.
- Current embedding behavior keeps the chunk v2 vector commands: `vector_upsert_chunks`, `vector_search_chunks`, `vector_delete_page`, and `vector_count_chunks`.
- Phase 4 removed the `legacy_narration_block` runtime fallback. `runRpgRuntimeTurnFlow()` now requires a dedicated runtime update interaction adapter and always creates proposed/pending updates from `runtimeUpdateInteractionSpec.parseOutput()` with `proposalSource: "interaction"`.
- `extractRpgStateUpdates()` was intentionally kept as the interaction output parser used by `src/lib/rpg-interactions/runtime-update-interaction.ts`.
- Explicitly preserved the requested RPG-only legacy directory guards, including existing `entities` / `concepts` filtering, rejection, and hiding behavior. RPG prototype modules such as `rpg-merge-review`, `rpg-post-ingest-distiller`, and `rpg-relationship-tension-deriver` were not deleted.
- Validation on 2026-06-09: `npm.cmd run typecheck` passed; `npx.cmd vitest run src/lib/embedding.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-interactions.test.ts src/i18n/i18n-parity.test.ts` passed with 6 files / 146 tests.
- `cargo check` was attempted under `src-tauri` and failed before crate checking because `lance-encoding v4.0.0` could not find a local `protoc` binary. The failure was a local toolchain prerequisite issue, not a Rust compile error reached from this cleanup.
- No `git commit` or `git push` was performed.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 1-2

- Completed requested redundancy cleanup Phase 1-2 for the RPG-only project.
- Phase 1 removed the old unreachable UI / tool islands: `src/components/layout/chat-bar.tsx`, unused `src/components/ui/resizable.tsx`, unused `src/components/ui/separator.tsx`, `src/lib/source-delete-decision.ts` plus its test, `src/lib/enrich-wikilinks.ts` plus its tests, and the now-only-enrich scenario helper.
- Removed `chatExpanded`, `setChatExpanded`, the `chatExpanded: false` initial state, and the setter implementation from `src/stores/wiki-store.ts`.
- Removed `react-resizable-panels` from `package.json` and `package-lock.json` through `npm.cmd uninstall react-resizable-panels`.
- Phase 2 removed the old `wiki/entities` / `wiki/concepts` duplicate-cleanup background chain: `src/lib/dedup.ts`, `src/lib/dedup-runner.ts`, `src/lib/dedup-queue.ts`, `src/lib/dedup-storage.ts`, and their focused tests.
- Removed dedup queue restore from `src/App.tsx` and dedup queue pause/load handling from `src/lib/reset-project-state.ts`; ingest queue restore/pause, graph cache, project file sync, and scheduled import reset behavior were preserved.
- Updated `src/components/settings/sections/maintenance-section.tsx`, `src/i18n/en.json`, and `src/i18n/zh.json` so Maintenance is RPG-only and no longer includes `settings.sections.maintenance.dedup`.
- Removed enrich-wikilinks-only scenario typing/materialization leftovers from `src/test-helpers/scenarios/types.ts` and `src/test-helpers/scenarios/materialize.ts`.
- Explicitly preserved the requested RPG-only legacy guards and deferred/prototype areas in Phase 1-2: legacy directory guards in runtime/context/ingest/knowledge-tree paths were not removed; the old narration-block runtime fallback and vector v1 migration/settings UI were deferred to Phase 3-4; RPG prototype modules such as `rpg-merge-review`, `rpg-post-ingest-distiller`, and `rpg-relationship-tension-deriver` were not deleted.
- Confirmation searches were clean for removed product references and package dependency. The only `Detect duplicate entities / concepts` residual is in `src/lib/changelog.ts`, which was intentionally allowed as historical changelog text and is not a product entry.
- Validation on 2026-06-09 is green: `npm.cmd run typecheck` passed; `npx.cmd vitest run src/lib/source-lifecycle-delete.test.ts src/lib/wiki-page-delete.test.ts src/lib/project-mode.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/i18n/i18n-parity.test.ts` passed with 6 files / 45 tests.
- `rg --encoding utf-8 "react-resizable-panels" package.json package-lock.json` returned no results after dependency removal.
- No `git commit` or `git push` was performed.

## 2026-06-09 - RPG Import Modularization Stage H Unified UI Entry

- Completed Stage H for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added `src/lib/rpg-import/ui-import-options.ts` as the UI semantic mapping layer for file import choices.
- The default UI option remains ordinary source material and maps to `source_ingest`; the unified file import UI does not expose `runtime_update_apply`.
- Control Doc UI choices are limited to the currently supported slots: `main_outline`, `outline_progress`, `rules_core`, and `style_narration`.
- Campaign Setup UI choices are limited to the currently supported slots: `player_main`, `current_scene`, `events_prologue`, `main_quest`, `quest`, and `player_relationship`.
- Optional quest and relationship names are mapped into `options.questName` and `options.relationshipName`.
- `current_scene` requires an explicit bootstrap checkbox before `options.explicitBootstrap` is sent; unchecked imports stay in the framework's review/skipped boundary.
- Control document overwrite requires an explicit checkbox before `options.manualConfirm` is sent; unchecked high-risk control documents are not silently replaced.
- Added `src/components/sources/rpg-import-dialog.tsx` and wired `src/components/sources/sources-view.tsx` so the primary Sources import button opens the unified "Import to RPG Project" dialog.
- Ordinary source file import still uses the existing `importSourceFiles()` behavior and supports multiple files; source folder import remains a separate ordinary folder import button.
- Control Doc and Campaign Setup imports are single-file in this v0 UI and call `runRpgImport({ mode, projectPath, sourcePath, sourceFileName, targetSlot, options })`.
- The dialog displays grouped `warnings`, `reviewItems`, `writtenPaths`, and `skipped` results after import.
- Dedicated import review items are also converted into ReviewStore `confirm` items with open-related-page and skip actions, so the Review panel can show them.
- Added `importSourceFilesWithReport()` in `src/lib/source-lifecycle.ts` so the new dialog can display ordinary import skipped paths while preserving the existing `importSourceFiles()` `string[]` return contract.
- Added i18n strings under `sources.rpgImport` in `src/i18n/zh.json` and `src/i18n/en.json`.
- Added focused coverage in `src/lib/rpg-import/ui-import-options.test.ts`.
- Validation on 2026-06-09 is green: `npx.cmd vitest run src/lib/rpg-import/ui-import-options.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/i18n/i18n-parity.test.ts` passed with 4 files / 37 tests; `npm.cmd run typecheck` passed.
- Dev server foreground start was verified with `npm.cmd run dev -- --host 127.0.0.1`; Vite reported `http://127.0.0.1:1420/`. Browser verification was limited because the Browser runtime listed no available `iab` browser instance, and non-sandbox background server startup was not approved.
- Scope intentionally not done: no Runtime Update Apply / Play panel behavior change, no runtime apply file-import UI exposure, no source tree row ingest semantic change, no legacy/default compatibility or migration path, no real LLM call, and no `git commit` / `git push`.

## 2026-06-09 - RPG Import Modularization Stage G Runtime Update Apply Framework Integration

- Completed Stage G for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added `runtime_update_apply` to the RPG import framework via `src/lib/rpg-import/runtime-update-apply.ts`, registered it in `registry.ts`, and exported it from `index.ts`.
- `runRpgImport({ mode: "runtime_update_apply", ... })` now supports `options.operation: "stage_pending"` for review/pending staging without wiki writes.
- `stage_pending` accepts direct `options.proposedUpdates`, or runtime update fenced output in `sourceText` with `options.turnRecord`; if only `options.turnRecord` is supplied, its generated narrative can be parsed through the same runtime update output parser.
- Direct `ProposedWikiUpdate[]` inputs are first checked against the existing runtime target policy before `validateRpgRuntimeUpdateProposals()` creates pending updates, so direct adapter callers cannot bypass the fenced parser's path boundary.
- Validation-rejected updates do not enter `pendingUpdates`; accepted updates are staged with `createPendingRpgUpdates()` and remain status `pending`.
- `runRpgImport({ mode: "runtime_update_apply", options: { operation: "apply_pending", pendingUpdates } })` now delegates to the existing `applyRpgPendingUpdates()` implementation.
- `apply_pending` only writes updates whose status is `accepted` and whose target/strategy still passes runtime write policy; `writtenPaths` is derived from the actual `applyResult.appliedUpdates` target paths.
- Runtime write semantics remain owned by the existing validator / pending / apply boundary: `current-scene` overwrite, `events` append/create, fixed player slots / quests / `outlines/progress.md` / runtime overlays merge.
- Runtime relationship and plot-arc changes remain limited to `wiki/relationships/runtime/*.md` and `wiki/plot-arcs/runtime/*.md`; base relationship/plot-arc pages, `outlines/main.md`, `rules`, `style`, `sources`, and `world` are rejected or skipped.
- Historical note: Stage G did not change `runRpgRuntimeTurnFlow()` behavior. Redundancy Cleanup Phase 4 later removed the old narration-block transition path while preserving the no auto accept/reject/apply boundary.
- Added focused coverage in `src/lib/rpg-import/runtime-update-apply.test.ts` for registration, fenced block staging, validation rejection, forbidden target rejection/skipping, runtime overlay merge apply, accepted-only apply, `writtenPaths` accuracy, current-scene overwrite, events append/create, and merge semantics.
- Validation on 2026-06-09 is green: `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime.test.ts` passed with 6 files / 100 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage H UI, no runtime controller/narration behavior change, no ordinary `source_ingest` / `control_doc_import` / `campaign_setup_import` semantic change, no legacy/default compatibility or migration path, no automatic accept/reject/apply, and no `git commit` / `git push`.

## 2026-06-08 - RPG Import Modularization Stage F Campaign Setup Import v0

- Completed Stage F for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added `campaign_setup_import` to the RPG import framework via `src/lib/rpg-import/campaign-setup-import.ts`, registered it in `registry.ts`, and exported it from `index.ts`.
- `runRpgImport({ mode: "campaign_setup_import", ... })` now requires `targetSlot` plus `sourceText` or `sourcePath`; when both inputs are present, `sourceText` is used while source path/file provenance is still recorded.
- Stage F supported slots are `player_main`, `current_scene`, `events_prologue`, `main_quest`, `quest`, and `player_relationship`.
- Fixed target paths are enforced for v0 required slots: `player_main -> wiki/player/player.md` and `current_scene -> wiki/current-scene/scene_state.md`.
- Optional slots write only the scoped setup targets: `events_prologue -> wiki/events/prologue.md`, `main_quest -> wiki/quests/main.md`, `quest -> wiki/quests/<safe-name>.md`, and `player_relationship -> wiki/relationships/player-<safe-name>.md`.
- `current_scene` writes are skipped unless `options.explicitBootstrap === true` or `options.manualConfirm === true`; raw source provenance is still saved when skipped.
- `events_prologue` filters non-happened guidance / future pressure out of the canonical event page and skips the event target if no already-happened prologue facts remain.
- Canonical campaign setup files include frontmatter metadata for slot id, import mode, source file name/path, source anchor, raw import path, imported timestamp, write policy, review policy, canonicalization policy, source origin, source-text priority, and explicit bootstrap state.
- Raw source anchors are saved under `wiki/sources/imports/<safe-source-name>--campaign_setup--<slot>.md`; target setup files point back through `source_import_path` and `source_anchor`.
- `player_main` only writes/merges `wiki/player/player.md`; Stage F does not create arbitrary `wiki/player/*.md`, does not split abilities into `wiki/rules/`, and returns warnings/review items for ability/skill/limit/availability content that should be reviewed for `wiki/player/abilities.md`.
- Actual-code difference recorded: Stage F implements the optional `events_prologue`, `main_quest` / `quest`, and `player_relationship` slots because they were low-risk fixed-path extensions, but it does not implement the full fixed player slot set such as abilities/inventory/goals/known information.
- Validation on 2026-06-08 is green: `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed with 5 files / 92 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage G/H implementation, no Runtime Update Apply framework integration, no UI change, no ordinary source ingest rewrite, no runtime controller change, no campaign setup LLM interaction, no legacy/default fallback or migration path, and no `git commit` / `git push`.

## 2026-06-08 - RPG Import Modularization Stage E Control Doc Import v0

- Completed Stage E for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added `control_doc_import` to the RPG import framework via `src/lib/rpg-import/control-doc-import.ts`, registered it in `registry.ts`, and exported it from `index.ts`.
- `runRpgImport({ mode: "control_doc_import", ... })` now requires `targetSlot` and accepts only `main_outline`, `outline_progress`, `rules_core`, and `style_narration`.
- Supported target paths are fixed: `main_outline -> wiki/outlines/main.md`, `outline_progress -> wiki/outlines/progress.md`, `rules_core -> wiki/rules/core.md`, and `style_narration -> wiki/style/narration.md`.
- Inputs may come from `sourceText` or `sourcePath`; when both are present, `sourceText` is used while source path/file provenance is still recorded.
- Canonical control files include frontmatter metadata for slot id, import mode, source file name/path, source anchor, raw import path, imported timestamp, write policy, review policy, canonicalization policy, source origin, and source-text priority.
- Raw source anchors are saved as separate provenance files under `wiki/sources/imports/<safe-source-name>--<slot>.md`; target control files point back to those files through `source_import_path` and `source_anchor`.
- Canonicalization is deterministic and faithful: it normalizes frontmatter/sections and preserves the full source text, including hard gates, `{{setvar::...}}`, forbidden words, and explicit user control blocks.
- Existing meaningful control files are not silently overwritten unless the caller provides `options.manualConfirm` or `options.allowOverwrite`; empty/new template-like control files can be initialized.
- Actual-code difference recorded: `outline_progress` remains a runtime-owned merge slot in `RPG_SCHEMA_SLOTS`, but Stage E permits `control_doc_import` to initialize it as empty/opening progress without changing Runtime Update Apply behavior.
- Added `controlDocCanonicalizationInteractionSpec` as a prompt/parse contract for future model-backed canonicalization; Stage E does not call an LLM.
- Validation on 2026-06-08 is green: `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed with 4 files / 80 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage F/G/H implementation, no campaign setup import, no runtime update framework integration, no UI change, no ordinary source ingest rewrite, no real LLM call, no writes to `wiki/current-scene/`, no writes to `wiki/events/`, and no `git commit` / `git push`.

## 2026-06-08 - RPG Import Modularization Stage D3.5 Redundancy Audit / Cleanup Gate

- Completed Stage D3.5 for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added `docs/RPG_IMPORT_REDUNDANCY_AUDIT_D3_5.md` with `keep` / `merge` / `delete` / `defer` findings for D/D1/D2/D2.5/D3 code, prompt, schema, policy, tests, and docs.
- Kept `src/lib/rpg-import/` as the current import framework skeleton for later E/F/G expansion; it still only registers `source_ingest` and wraps `autoIngest()` without changing ordinary ingest behavior.
- Low-risk cleanup applied in `src/lib/rpg-wiki-schema.ts`: removed the unreachable concrete Source Ingest forbidden runtime target entries for `characters/runtime`, `locations/runtime`, `factions/runtime`, `items/runtime`, `relationships/runtime`, and `plot-arcs/runtime`, because the earlier `wiki/*/runtime/**` rule already matches them via `getRpgSourceIngestForbiddenTarget()`.
- Low-risk prompt cleanup applied in `src/lib/ingest.ts`: removed a duplicate hand-written forbidden `targetPath` sentence from the long-source chunk prompt; `buildSourceIngestTargetPolicyGuidance()` is now the single Source Ingest target-policy rendering path there.
- Updated `src/lib/ingest.prompt.test.ts` so the long-source prompt test asserts the authoritative `## Source Ingest Target Policy` and `wiki/*/runtime/**` rule instead of the removed hand-written sentence.
- Defer findings recorded at the time: do not remove the controller narration-block transition fallback before Stage G; do not collapse runtime interaction forbidden examples, fixed-slot test fixtures, or legacy/default rejection tests without a dedicated follow-up. Redundancy Cleanup Phase 4 later removed that transition fallback.
- Updated `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` to mark only D3.5 as completed; Stage E/F/G/H goals, numbering, acceptance criteria, and order were not changed.
- Validation on 2026-06-08 is green: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts` passed with 3 files / 98 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage E/F/G/H implementation, no new import mode, no Runtime Update Apply framework integration, no UI change, no real LLM call, no destructive cleanup, and no `git commit` / `git push`.

## 2026-06-08 - RPG Import Modularization Stage D3 Overlay Resolver / Context Read Contract

- Completed Stage D3 for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Context Compiler now reads `relationships/` and `plot-arcs/` through the same base + runtime overlay grouping path already used by `characters/`, `locations/`, `factions/`, and `items`.
- Extended `readRelevantOverlayGroups()` so `relationships` and `plot-arcs` can group stable base pages with same-slug or `overlayBaseSlug()`-mapped `runtime/*.md` overlays.
- `brief.relationshipTensions` now uses relationship overlay groups via `formatGroupEntry()`, and `brief.activePlotPressure` now uses plot arc overlay groups via `formatGroupEntry()`.
- `references` now include both matched base pages and matched runtime overlay pages for relationship and plot arc groups.
- Actual-code difference recorded before implementation: `relationships` and `plot-arcs` were not unread; they were already recursively included by `readMarkdownDir()`, but `runtime/` pages were ranked as independent ordinary pages instead of being combined with their base page as overlay groups.
- Overlay resolver remains read-only. It does not write wiki files, call pending/apply, or change Runtime Update Apply target/write strategy. Runtime overlay file contents may still be merge-updated by Runtime Update Apply, but overlay remains the Context Compiler read-layer model.
- Updated focused tests in `src/lib/rpg-runtime.test.ts` for relationship and plot arc base + runtime overlay grouping, unrelated page filtering, base/runtime references, and read-only preview/context compile behavior.
- Validation on 2026-06-08 is green: `npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-wiki-schema.test.ts` passed with 2 files / 30 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage E/F/G implementation, no import framework expansion, no Runtime Update Apply write-policy change, no UI change, no real LLM call, and no `git commit` / `git push`.

## 2026-06-08 - RPG Import Modularization Stage D2.5 Mode-scoped Prompt / Schema Contract Cleanup

- Completed Stage D2.5 for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added a code-readable ordinary Source Ingest target policy in `src/lib/rpg-wiki-schema.ts` via `RPG_SOURCE_INGEST_TARGET_POLICY`, `getRpgSourceIngestTargetPolicy()`, `getRpgSourceIngestForbiddenTarget()`, and `isRpgSourceIngestAllowedTarget()`.
- Ordinary Source Ingest allowed targets are now limited to `wiki/sources/`, `wiki/world/`, `wiki/characters/`, fixed `wiki/player/` slots for explicitly declared current-PC material, `wiki/locations/`, `wiki/factions/`, `wiki/items/`, `wiki/plot-arcs/`, `wiki/events/`, `wiki/relationships/`, plus structural `wiki/index.md`, `wiki/overview.md`, and `wiki/log.md`.
- Ordinary Source Ingest now treats `wiki/rules/`, `wiki/style/`, `wiki/memory/`, `wiki/outlines/`, `wiki/current-scene/`, `wiki/*/runtime/`, and `wiki/quests/` as forbidden or review-only other-mode targets.
- Source Ingest prompt guidance now renders the target policy and boundary guidance as a source-ingest boundary, not a broad writable schema. Control documents recommend `control_doc_import`; campaign bootstrap/player setup/current-scene bootstrap recommends `campaign_setup_import`; completed turns/current-scene/runtime overlays recommend `runtime_update_apply`.
- Long-source RP Runtime Signals prompt no longer encourages forbidden `targetPath` values, and signal normalization clears forbidden or unsupported Source Ingest target paths before Stage 2 can use them.
- Ordinary ingest writer/review behavior now skips forbidden or unsupported Source Ingest FILE blocks and creates warnings plus review items instead of writing them. This includes rules/style/memory/outlines/current-scene/runtime overlays/quests and arbitrary `wiki/player/*.md` outside fixed player slots.
- Runtime Update Apply D2 prompt/validator behavior was intentionally left unchanged.
- Actual-code differences recorded before implementation: Stage 1 already excluded `quests`, `rules`, `style`, and `current-scene` from `needed_categories`, and Stage 2 focused guidance already excluded those contracts; remaining leaks were in the minimal contract, shared boundary rendering, long-source signal target guidance, structured signal propagation, writer/review wording, and lack of a central source-ingest target policy.
- Updated focused tests in `src/lib/ingest.prompt.test.ts`, `src/lib/rpg-ingest-signals.test.ts`, `src/lib/ingest.scenarios.test.ts`, `src/lib/rpg-extraction-validation.test.ts`, and `src/lib/rpg-wiki-schema.test.ts`.
- Validation on 2026-06-08 is green: `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-wiki-schema.test.ts` passed with 6 files / 142 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage D3 overlay resolver / context read contract, no `control_doc_import`, no `campaign_setup_import`, no `runtime_update_apply` framework integration, no E/F/G complete import mode implementation, no UI change, no real LLM call, and no `git commit` / `git push`.

## 2026-06-07 - RPG Import Modularization Stage D2 Runtime Cross-directory Sync Contract

- Completed Stage D2 for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added code-readable runtime cross-directory sync guidance in `src/lib/rpg-wiki-schema.ts` via `RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE` and `getRpgRuntimeCrossDirectorySyncGuidance()`.
- Runtime update target policy now allows `wiki/current-scene/scene_state.md` overwrite, `wiki/events/*.md` append, fixed player slot merge, `wiki/quests/*.md` merge, `wiki/outlines/progress.md` merge, and runtime overlays under `characters/runtime`, `locations/runtime`, `factions/runtime`, `items/runtime`, `relationships/runtime`, and `plot-arcs/runtime`.
- Runtime update target policy no longer allows arbitrary `wiki/player/*.md`, base `wiki/relationships/*.md`, or base `wiki/plot-arcs/*.md` as runtime update targets.
- Runtime update prompt now includes a cross-directory sync contract: long-term changes visible in current-scene should be paired with the corresponding runtime overlay or dynamic directory update, while missing companion updates remain deterministic validator warnings/review signals rather than auto-generated proposals.
- Runtime update validation now adds aggregate warning-only sync checks across the full proposal batch, including missing character/location/faction/item/relationship/plot-arc/outline sync from current-scene and inventory/items-runtime companion warnings.
- Updated focused tests in `src/lib/rpg-wiki-schema.test.ts`, `src/lib/rpg-interactions.test.ts`, `src/lib/rpg-runtime-update-validation.test.ts`, `src/lib/rpg-write-policy.test.ts`, and `src/lib/rpg-runtime-controller.test.ts`.
- Actual-code differences recorded before implementation: runtime target policy still allowed base `relationships/*.md` and base `plot-arcs/*.md`; player runtime targets were still arbitrary `wiki/player/*.md`; runtime validation was single-update only and did not provide cross-proposal missing-sync warnings.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-runtime-controller.test.ts` passed with 6 files / 112 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage D3 overlay resolver / context read contract, no automatic creation of missing companion `ProposedWikiUpdate`s, no `control_doc_import` / `campaign_setup_import` / `runtime_update_apply` framework integration, no UI change, no real LLM call, and no `git commit` / `git push`.

## 2026-06-07 - RPG Import Modularization Stage D1 Directory Boundary Prompt / Schema Constraints

- Completed Stage D1 for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added code-readable D1 directory boundary guidance in `src/lib/rpg-wiki-schema.ts` via `RPG_DIRECTORY_BOUNDARY_GUIDANCE` and `getRpgDirectoryBoundaryGuidance()`.
- The boundary guidance now explicitly covers `quests` vs `wiki/player/goals.md` vs `plot-arcs`, `rules` vs `world`, global `style` vs character/relationship voice, `characters` vs `relationships`, and `items` vs `wiki/player/inventory.md`.
- Source Ingest prompt guidance now includes the D1 boundary contract in Stage 1 analysis, Stage 2 generation, focused page guidance, and long-source chunk/signal flows.
- Runtime update target descriptions and runtime update prompt text now narrow `player/goals.md`, `quests`, `plot-arcs`, `relationships`, and `items/runtime` semantics so quests are not "any goal" and plot-arcs are not player TODO/checklists.
- Added/updated focused tests in `src/lib/rpg-wiki-schema.test.ts`, `src/lib/ingest.prompt.test.ts`, `src/lib/rpg-ingest-signals.test.ts`, and `src/lib/rpg-interactions.test.ts`.
- Actual-code differences recorded before implementation: the current category registry still treats `quests`, `rules`, and `style` as auxiliary/manual/runtime directories rather than Source Profile focused categories, so D1 was implemented as reusable boundary guidance and prompt/policy constraints without opening new ordinary Source Ingest category behavior.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts` passed with 4 files / 100 tests; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage D2 runtime cross-directory sync, no Stage D3 overlay resolver, no `control_doc_import` or `campaign_setup_import`, no new import mode, no UI change, no real LLM call, and no `git commit` / `git push`.

## 2026-06-07 - RPG Import Modularization Stage D Schema Slots and New Project Templates

- Completed Stage D for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Added code-readable fixed schema slots in `src/lib/rpg-wiki-schema.ts`: `RpgSchemaSlot`, `RPG_SCHEMA_SLOTS`, lookup helpers, required-slot and owner filters, `RPG_FIXED_PLAYER_SLOT_PATHS`, and `isFixedPlayerSlotPath()`.
- `RPG_SCHEMA_SLOTS` now mirrors the fixed slot contract in `docs/RPG_WIKI_SCHEMA.md`: outlines, rules, style, memory, current scene, and the five fixed player files are all required for new projects.
- New project bootstrap now creates `wiki/outlines/`, `wiki/relationships/runtime/`, and `wiki/plot-arcs/runtime/`, plus all fixed slot template files under outlines, rules, style, memory, current-scene, and player.
- The built-in project schema text in `src-tauri/src/commands/project.rs` and the frontend bootstrap schema copy in `src/lib/project-mode.ts` now document fixed slots, manual_or_review_only control files, review-bounded outline progress merge, and the fixed player slot set.
- Context Compiler now includes `outlines` in allowed runtime reads, reads `current_scene` through the schema slot helper, reads player state only from fixed player slots, and warns when required slots are missing.
- Context Compiler reads rules/style/memory fixed slots first, then keeps existing same-directory markdown reads as additional same-layer material without treating missing fixed files as a legacy fallback.
- `CompactStoryBrief` now has `outlineNotes: string[]`; narration prompt rendering includes a separate `## Outline Notes` section so future outline guidance is not mixed into `events` or `hardFacts`.
- Added/updated focused tests for schema slots, fixed player slots, missing-slot warnings, outline notes, narration prompt rendering, frontend bootstrap schema text, and Rust project bootstrap slot creation.
- Actual-code differences recorded before implementation: `src/lib/rpg-wiki-schema.ts` previously only described directory-level schema; `src/lib/rpg-runtime/context-compiler.ts` previously scanned arbitrary `wiki/player/*.md`; `src-tauri/src/commands/project.rs` already created some RPG auxiliary directories but did not create fixed slot template files or the new outlines/relationship-runtime/plot-runtime directories.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts` passed with 3 files / 29 tests; `npx.cmd vitest run src/lib/project-mode.test.ts` passed with 1 file / 3 tests; `cargo test --manifest-path src-tauri/Cargo.toml project` passed with 3 tests and only pre-existing snake_case warnings in `src/proxy.rs`; `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage D1/D2/D3 prompt-boundary expansion, runtime cross-directory sync contract implementation, or overlay resolver rewrite; no control_doc_import, campaign_setup_import, runtime_update_apply framework implementation; no legacy/default migration, fallback, old path compatibility, or arbitrary player-file compatibility; no real LLM call; no `git commit` or `git push`.

## 2026-06-07 - RPG Import Modularization Stage C Interaction Spec Migration

- Completed Stage C for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`.
- Extended `RpgInteractionKind` with `source_ingest_analysis`, `source_ingest_generation`, `control_doc_canonicalization`, `campaign_setup_generation`, `narration`, `runtime_state_update`, `relationship_derivation`, `outline_impact`, and `outline_regeneration`.
- Added `src/lib/rpg-interactions/source-ingest-analysis-interaction.ts` and `src/lib/rpg-interactions/source-ingest-generation-interaction.ts`.
- Exported the new source ingest interaction specs from `src/lib/rpg-interactions/index.ts`.
- RPG source ingest Stage 1 analysis and Stage 2 generation prompts are now built through `sourceIngestAnalysisInteractionSpec.buildPrompt()` and `sourceIngestGenerationInteractionSpec.buildPrompt()` inside `autoIngestImpl()`.
- `src/lib/ingest.ts` still exports `autoIngest()`, `buildAnalysisPrompt()`, and `buildGenerationPrompt()` as the current ordinary source ingest entry points; the prompt wrapper functions remain available and still wrap the RPG prompt builders.
- Added focused tests in `src/lib/rpg-interactions.test.ts` for source ingest interaction kind values, prompt equivalence with existing ingest prompt builders, key user-prompt text, parse passthrough behavior, and no wiki file read/write side effects.
- Actual-code differences recorded before implementation: `RpgInteractionKind` previously only listed runtime/narration-oriented kinds, and source ingest analysis/generation user prompts were still built inline in `autoIngestImpl()` rather than in `src/lib/rpg-interactions/`.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` passed with 4 files / 87 tests, and `npm.cmd run typecheck` passed.
- Scope intentionally not done: no `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` implementation; no writer, queue, UI, ordinary ingest semantic, LLM parameter, error-handling, review, pending, or apply behavior change; no legacy/default import fallback, migration path, or old-project compatibility layer; no real LLM call; no `git commit` or `git push`.

## 2026-06-07 - RPG Import Modularization Stage B Import Framework Skeleton

- Completed Stage B for `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` with a new `src/lib/rpg-import/` skeleton.
- Added shared import framework types for `RpgImportMode`, `RpgImportRequest`, `RpgImportResult`, and `RpgImportModeSpec`.
- Added a small registry and `runRpgImport()` pipeline entry; only `source_ingest` is registered in this stage.
- Wrapped the existing ordinary `autoIngest()` as `source_ingest` without changing `autoIngest()` itself, queue/UI behavior, prompt construction, writer behavior, runtime update apply, or ordinary ingest semantics.
- `source_ingest` currently requires `sourcePath` and `llmConfig`, passes through `projectPath`, `signal`, and `folderContext`, does not swallow exceptions, and returns `writtenPaths` exactly from `autoIngest()` with empty `reviewItems`, `warnings`, and `skipped`.
- Added `src/lib/rpg-import/source-ingest.test.ts` proving wrapper/direct `autoIngest()` equivalence for written paths, written file contents, and REVIEW block semantic fields (`type`, `title`, `description`, `affectedPages`, `searchQueries`), plus required-field errors.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` passed, and `npm.cmd run typecheck` passed.
- Scope intentionally not done: no `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` implementation; no `sourceText` temporary-file import; no queue/UI/prompt/writer/runtime apply changes; no real LLM call; no `git commit` or `git push`.

## 2026-06-07 - RPG Import Modularization Stage A Contract Freeze

- Completed documentation-only Stage A for the RPG Import Modularization Plan.
- Updated `docs/RPG_WIKI_SCHEMA.md` with the frozen import/apply mode contract for `source_ingest`, `control_doc_import`, `campaign_setup_import`, and `runtime_update_apply`, including semantics, allowed target paths, forbidden paths, forbidden behaviors, and write strategy boundaries.
- Added the fixed schema slot table covering outlines, rules, style, memory, current-scene, and the fixed player file set; the contract now treats missing fixed slots as new-project structure warnings rather than legacy fallback scenarios.
- Clarified fixed player files, `outlines/main.md` versus `outlines/progress.md`, and base/runtime overlay boundaries for characters, locations, factions, items, relationships, and plot-arcs.
- Updated `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` Stage 6.17a so Runtime Context Schema Contract explicitly depends on the fixed slot contract and remains documentation-only for this stage.
- Documentation-only change; no runtime code, ordinary ingest behavior, UI, tests, real LLM call, `git commit`, or `git push` was performed.

## 2026-06-07 - Memory Directory Context Compiler Boundary

- Updated `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` to define `wiki/memory/` as the Context Compiler's long-term helper and triage buffer.
- The plan now states that `memory/` is not the primary fact source and must not replace concrete directories such as `events/`, `quests/`, `outlines/progress.md`, `relationships/runtime/`, `plot-arcs/runtime/`, `current-scene/`, `rules/`, or `style/`.
- Clarified the three fixed memory files: `player-preferences.md` for player preferences and safety/experience boundaries, `long-term.md` for cross-scene helper summaries, and `session-notes.md` for recent notes or material waiting to be sorted.
- Documentation-only change; no runtime code, ingest behavior, UI behavior, tests, real LLM call, `git commit`, or `git push` was performed.

## 2026-06-07 - Outline Progress and Relationship/Plot Runtime Overlay Plan

- Updated `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` so Control Doc Import fixed slots now include `wiki/outlines/progress.md` alongside `wiki/outlines/main.md`.
- The plan keeps `wiki/outlines/main.md` as the low-frequency author/GM outline and uses `wiki/outlines/progress.md` for runtime-reviewed progress relative to the outline; no fixed `revision-proposal.md` file is introduced.
- Runtime Update Apply target paths now use `wiki/relationships/runtime/*.md` and `wiki/plot-arcs/runtime/*.md` instead of writing directly to base `wiki/relationships/*.md` or `wiki/plot-arcs/*.md`.
- Added an explicit overlay vs merge definition: overlay is the base + runtime file layering/read model, while merge is a write strategy for updating one target file.
- Added Stage D3 for overlay resolver / context read contract work, so Context Compiler can read base relationship/plot-arc pages and layer runtime overlays on top.
- Documentation-only change; no runtime code, ingest behavior, UI behavior, tests, real LLM call, `git commit`, or `git push` was performed.

## 2026-06-07 - Import Plan Directory Boundary Refinement

- Updated `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` to refine several directory conflicts beyond the `outlines` / `plot-arcs` split.
- The plan now treats `wiki/player/` as a fixed file set: `player.md`, `abilities.md`, `inventory.md`, `goals.md`, and `known_information.md`; import/runtime may merge those files but should not create or delete arbitrary player files.
- Player abilities and skills now stay in `wiki/player/abilities.md` instead of being routed to `rules/`.
- Added explicit boundaries for `quests/` vs `player/goals.md` vs `plot-arcs/`, `memory/` authority levels, `rules/` vs `world/`, global `style/` vs character-specific voice, `current-scene/` vs runtime overlays, `characters/` vs `relationships/`, and `items/` vs `player/inventory.md`.
- Added follow-up stages D1 and D2 for prompt/schema boundary constraints and runtime cross-directory sync contracts.
- Documentation-only change; no runtime code, ingest behavior, UI behavior, tests, real LLM call, `git commit`, or `git push` was performed.

## 2026-06-07 - Outline Directory Schema Decision

- Chose the clean schema split for campaign outlines: author/GM-side future planning now belongs in `wiki/outlines/`, with the fixed main outline slot at `wiki/outlines/main.md`.
- `wiki/plot-arcs/` is narrowed to runtime plot-arc state: unresolved conflicts, pressure, foreshadowing, blockers, possible developments, and advancement conditions.
- Updated the agent guide to state that this is a new `llmWikiRPG` project with no old projects to migrate; future design and implementation should not default to legacy/default compatibility, migration, fallback, or old-path preservation unless explicitly requested.
- Updated architecture/import/schema planning documents to treat `outlines` as a control-layer directory and to block runtime writes to it.
- Documentation-only change; no runtime code, ingest behavior, UI behavior, tests, real LLM call, `git commit`, or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Plan

- Added `docs/RPG_IMPORT_MODULARIZATION_PLAN.md` as the dedicated planning document for modularizing RPG import/ingest flows.
- The plan separates four modes: `source_ingest`, `control_doc_import`, `campaign_setup_import`, and `runtime_update_apply`.
- The plan recommends a new `src/lib/rpg-import/` framework for import orchestration, while keeping `src/lib/rpg-interactions/` focused on LLM prompt/parse specs.
- The plan records schema slot needs for fixed runtime/control files such as `wiki/outlines/main.md`, `wiki/rules/core.md`, `wiki/style/narration.md`, `wiki/memory/player-preferences.md`, `wiki/current-scene/scene_state.md`, and `wiki/player/player.md`.
- Documentation-only change; no runtime code was changed, no ingest behavior was changed, and no real LLM call was made.

## 2026-06-07 - Context Compiler Redesign Plan Document

- Added `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md` as the dedicated detailed design for Context Compiler v1.
- The plan records the recommended default two-LLM Context Compiler flow: local candidate preparation, Recall Selector / Memory Routing, local selected-material reads, and Outline-aware Context Brief Compiler before narration generation.
- The plan also records when to downgrade to one interaction, when to enable an optional third retrieval-repair / pre-narration outline-impact probe, what each round consumes and emits, how outline guidance enters the brief, and how long-running campaigns should rely on layered capsules.
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` Stage 6.17 was shortened into a roadmap summary that points to the new detailed plan while preserving the runtime boundaries: no narration generation, no pending updates, no wiki writes, no formal outline revision inside Context Compiler.
- Documentation-only change; no runtime code was changed and no real LLM call was made.

## 2026-06-07 - Context Compiler v1 Planning Refinement

- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` now defines Stage 6.17 `Context Compiler v1` as a multi-pass LLM-assisted context compilation chain instead of only a deterministic retrieval/budgeting upgrade.
- The revised Stage 6.17 plan requires at least two LLM interactions: a recall/synthesis pass over recent completed turns plus wiki retrieval results, followed by a narration-brief pass that produces a short prompt/brief for the next narration generator stage.
- The plan also records an optional retrieval-planning LLM pass before wiki retrieval, while keeping deterministic path allowlist validation and runtime directory boundaries authoritative.
- No runtime code was changed, no real LLM call was made, and no wiki writes, pending updates, narration generation, relationship derivation, outline impact detection, or outline regeneration were implemented.
- Stage 6.16 has already been covered by the existing section-aware/runtime write merge alignment work recorded below; following the current architecture roadmap, the next implementation target is Stage 6.17.

## 2026-06-07 - Runtime Update Validation v1

- Stage 6.15 is complete. Runtime update proposal generation still uses a single runtime update interaction; no second LLM validation call, retry loop, or validator-to-LLM feedback path was added.
- Added a pure TypeScript path-aware validator at `src/lib/rpg-interactions/runtime-update-validation.ts`. It validates `ProposedWikiUpdate[]` before pending staging and returns accepted updates, rejected updates, warning/reject issues, and warning strings.
- `runRpgRuntimeTurnFlow()` now validates generated runtime update proposals before calling `createPendingRpgUpdates()`. Only accepted updates enter the pending queue; rejected proposals remain visible through controller warnings and validation summary data.
- Warning-only proposals may still enter pending, but their warnings stay in the controller result and the runtime turn journal.
- Runtime turn journal entries now include a `runtimeUpdateValidation` audit summary with accepted update ids, rejected update summaries, and warning-only issues so refresh/reopen does not erase validation audit context from turn history.
- Validator rules cover the Stage 6.15 path-aware boundaries: `events` rejects future plans, candidate/unchosen actions, next actions, possible futures, and foreshadowing pollution; `current-scene` rejects long-term lore, full character cards, event logs, complete timelines, and overlong snapshots; `plot-arcs` allows unresolved/possible future pressure but rejects possible futures inside confirmed facts; `relationships` rejects full biography/profile/card material; `player`, `quests`, and runtime overlays warn or reject obvious candidate-action/stable-page pollution.
- Runtime update prompt/contract now explicitly asks the single generation pass to self-check directory semantics and states that rejected proposals will be skipped by deterministic local lint rather than repaired by another LLM call.
- Runtime write boundaries remain unchanged: no automatic accept, reject, apply, wiki write, write-policy permission change, ordinary ingest change, relationship deriver wiring, outline impact/regeneration, or context compiler change was added.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts` passed, and `npm.cmd run typecheck` passed.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Ordinary Ingest / Runtime Current-Scene Boundary Cleanup

- Ordinary RPG ingest no longer uses the former live-input marker gate. The RPG Stage 1 Source Profile no longer contains live marker fields, and `needed_categories` no longer allows `current-scene`.
- RPG Stage 2 focused page guidance no longer expands a `current-scene` contract. If ordinary source material describes a scene, it must route to non-current-scene directories such as `events`, `plot-arcs`, `locations`, `characters`, `relationships`, `player`, `world`, or `sources`.
- Ordinary ingest writer validation now blocks all `wiki/current-scene/` FILE blocks and turns them into warnings/review signals instead of normalizing or writing `wiki/current-scene/scene_state.md`.
- Runtime write policy remains unchanged: accepted pending updates may still overwrite `wiki/current-scene/scene_state.md` through `applyRpgPendingUpdates()` and the RPG Play/Runtime apply path.
- Long-source structured ingest signals no longer emit live marker fields or infer `current-scene` as a Stage 2 category.
- Validation on 2026-06-07 is green: the targeted ingest/prompt/validation/write-policy/runtime-panel Vitest bundle passed, the dynamic-update/signal/smoke/schema bundle passed, and `npm.cmd run typecheck` passed.
- Marker cleanup check for the former live marker, live profile fields, and old current-scene object type now reports only historical archive files under `docs/archive/`.
- Scope intentionally not done: no Stage 6.15/6.16/6.17 implementation, no runtime proposal content requirement change beyond removing ordinary ingest marker assumptions, no real LLM call, no `git commit`, and no `git push`.

## 2026-06-07 - Runtime Apply Refresh + UI Reliability v0

- Stage 6.14 is complete. Manual apply of accepted RPG runtime updates now refreshes runtime-facing UI state after the write-policy boundary returns.
- `RpgRuntimePanel` now computes applied affected paths from `applyRpgPendingUpdates()` results. When `wiki/current-scene/scene_state.md` is actually applied with `overwrite`, the panel rereads the canonical current-scene file and replaces the displayed scene snapshot.
- Apply refresh now reuses the existing project file state entry points: the default refresh reloads the project file tree with `listDirectory(projectPath)`, calls `setFileTree()`, and bumps `dataVersion`, so file tree consumers plus graph/search retrieval caches have the same invalidation signal used by ingest/delete/review flows.
- `RpgRuntimePanel` exposes a narrow `onProjectFilesChanged?: (affectedPaths: string[]) => void | Promise<void>` prop for callers that want to reuse an outer reload path; without it the panel uses the existing store refresh path.
- `PendingRpgUpdatesPanel` now displays affected paths alongside applied updates, skipped updates, and warnings in the last apply result.
- Pending queue semantics remain unchanged: pending and rejected updates are retained, accepted skipped updates remain in the persisted queue, and only successfully applied update ids are removed.
- Runtime write boundaries remain unchanged: the UI still applies only user-accepted updates through `applyRpgPendingUpdates()`, does not auto-accept, does not auto-apply restored accepted updates, does not bypass write policy, and does not write wiki files directly.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-write-policy.test.ts` passed, and `npm.cmd run typecheck` passed.
- Scope intentionally not done: no Stage 6.15/6.16/6.17 work, no relationship deriver wiring, no outline impact detection, no outline regeneration, no real LLM call, no ingest main-flow change, no `git commit`, and no `git push`.

## 2026-06-07 - RPG Merge Evaluation + Review-Controlled Distill

- Fifth and sixth RPG merge prompt redesign stages are complete. The work uses fixed deterministic mock regression samples only; no real LLM call was made.
- Added 5 fixed RPG merge regression samples covering character biography/trivia regression, relationship duplicate-profile regression, plot-arc Possible Futures separation, event future/unchosen-option contamination, and player stale Current State replacement.
- Added a pure merge review service that routes high-risk merge candidates into existing-compatible `suggestion` review items instead of treating them as accepted content. High-risk reasons include merge lint reject issues, base stable-page runtime-state contamination, excessive body shrink, and significant section deletion risk.
- Added review-controlled post-merge distill proposal handling for overlong runtime-facing pages. Proposals are generated for eligible long character/location/event/plot-arc/relationship pages, but original content is not automatically compressed or overwritten.
- Added an accepted-only distill apply helper. Pending or rejected proposals produce no compressed candidate; source pages and manual-control `style` / `rules` / `memory` pages are not runtime-distilled.
- Tightened plot-arc lint so possible future language inside `Confirmed Facts` is rejected, while normal `Confirmed Facts` plus separate `Possible Futures` remains valid. Fixed section printing so append-dedupe sections remain separated by real Markdown heading breaks.
- Runtime write boundaries remain unchanged: `wiki/current-scene/scene_state.md` is overwrite-only, `wiki/events/` is append/create-only, and stable/base/source/manual-control runtime writes remain blocked.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-merge-evaluation.test.ts`, `npx.cmd vitest run src/lib/rpg-merge-review.test.ts`, `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts`, and `npm.cmd run typecheck` all passed.
- Scope intentionally not done: no UI rewrite, no review persistence rewrite, no real-model evaluation by default, no automatic compression writeback, no runtime write-policy loosening, no `git commit`, and no `git push`.

## 2026-06-07 - Runtime Write Merge Alignment

- Runtime Write Merge alignment has been completed. Accepted runtime `merge` updates now use `mergeRpgSections()` instead of conservative append-style concatenation.
- Section-aware runtime merge applies to `wiki/player/`, `wiki/quests/`, `wiki/relationships/`, `wiki/plot-arcs/`, and all runtime overlays under `wiki/characters/runtime/`, `wiki/locations/runtime/`, `wiki/factions/runtime/`, and `wiki/items/runtime/`.
- `Current State` replacement now prevents stale runtime state, quest progress, relationship state, and overlay state from remaining beside newer accepted updates. `Evidence and Uncertainty`, `Confirmed Facts`, and plot-arc `Possible Futures` keep append-dedupe semantics.
- Runtime-facing low-value sections such as trivia, release metadata, voice actor notes, production notes, fan tags, full biography / character profile material, and their Chinese equivalents are not restored from old runtime-facing pages during runtime merge.
- Boundary behavior is unchanged: `wiki/current-scene/scene_state.md` remains overwrite-only, `wiki/events/` remains append/create-only, and stable/base/source/manual-control paths remain blocked by runtime write policy.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-write-policy.test.ts`, `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts`, and `npm.cmd run typecheck` all passed.
- Scope intentionally not done: no runtime controller changes, no UI changes, no context compiler changes, no relationship deriver changes, no outline changes, no post-ingest distiller, no real LLM call, no automatic commit, and no push.

## 2026-06-07 - Section-aware Merge v0

- Section-aware Merge v0 has been completed. `src/lib/rpg-section-merge.ts` now provides a pure, lightweight Markdown section post-processor for accepted LLM merge candidates, recognizing `##` and `###` headings while preserving frontmatter unchanged.
- `mergePageContent()` now runs `mergeRpgSections()` after frontmatter parsing and policy-aware body shrink checks, before RPG merge lint and deterministic locked-field / array-union / updated-stamp post-processing.
- v0 strategies cover `Runtime Capsule` restoration from incoming/existing content when omitted by the LLM, `Current State` replacement for runtime-state / relationships / current-scene pages, append-dedupe merging for `Evidence and Uncertainty` and `Confirmed Facts`, and plot-arc `Possible Futures` append-dedupe without promoting future material into confirmed facts.
- `wiki/events/` `Possible Futures` sections are not repaired or moved by section merge, so RPG merge lint can still reject contaminated event pages and fall back through the existing safety path.
- Runtime-facing non-source pages do not restore deleted low-value sections such as trivia, release metadata, voice actor, production notes, fan tags, or their Chinese equivalents; `wiki/sources/` remains evidence-layer material and is not affected by low-value section dropping.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, and `npm.cmd run typecheck` all passed.
- Scope intentionally not done: no runtime controller changes, no runtime write policy alignment, no UI changes, no context compiler changes, no relationship deriver changes, no outline changes, no post-ingest distiller, no real LLM call, no automatic commit, and no push.

## 2026-06-07 - RPG Merge Lint v0

- RPG Merge Lint v0 has been completed. `src/lib/rpg-merge-lint.ts` now provides a pure, lightweight post-LLM merge lint boundary with `warning` and `reject` issues plus `shouldReject`; it does not rewrite or compress page bodies.
- `mergePageContent()` now runs `lintRpgMergedPage()` after frontmatter parsing and policy-aware body shrink checks, before deterministic locked-field / array-union / updated-stamp post-processing.
- Reject lint results are logged with `console.warn`, trigger the existing backup hook, and fall back to the deterministic array-merged incoming content. Warning-only results are logged and the LLM merge output is still accepted.
- v0 rules cover missing `## Runtime Capsule` warnings for non-source runtime-facing pages, with `wiki/sources/` plus manual-control `wiki/style/`, `wiki/rules/`, and `wiki/memory/` excluded from the capsule requirement.
- v0 reject rules catch `wiki/events/` contamination by future possibilities, next-step suggestions, optional or unchosen actions, and foreshadowing; `wiki/plot-arcs/` possible futures written as confirmed happened facts; and `wiki/current-scene/` pages that accumulate long history, full profiles, or complete timelines.
- v0 also warns when base `wiki/characters/*.md`, `wiki/locations/*.md`, `wiki/factions/*.md`, or `wiki/items/*.md` contain obvious runtime-only current-state language that belongs in runtime overlays.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, and `npm.cmd run typecheck` all passed.
- Scope intentionally not done: no runtime controller changes, no runtime write policy changes, no UI changes, no context compiler changes, no relationship deriver changes, no outline changes, no section-aware merge, no post-ingest distiller, no real LLM call, no automatic body rewrite, and no `git commit` / `git push`.

## 2026-06-07 - RPG Merge Policy v0

- RPG Merge Policy v0 has been completed and re-validated in the current workspace. Page merge calls now receive `MergeContext` with `sourceFileName`, `pagePath`, and `signal`, so the production merger can choose behavior from the target RPG wiki path.
- `src/lib/rpg-merge-policy.ts` provides path-aware policies for source evidence, stable operating model, runtime state, relationship tension, plot pressure, event history, current-scene snapshot, manual-control, and generic RPG fallback pages.
- `buildPageMerger()` now uses `buildRpgMergeSystemPrompt(context.pagePath)`. The old encyclopedia-style requirement to preserve every factual claim is not used as the merge contract; the system prompt instead prioritizes RPG runtime utility, stale-state replacement, future-as-fact prevention, and stable/runtime layer separation.
- `mergePageContent()` keeps deterministic safety behavior: frontmatter array union, locked `type` / `title` / `created`, updated stamp, no-frontmatter fallback, LLM failure fallback, and backup hook handling. Body shrink rejection is now policy-aware: generic/unknown and source/event/manual paths remain conservative, while runtime, relationship, plot-pressure, current-scene, and stable operating model pages allow appropriate compression.
- Validation on 2026-06-07 is green: `npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts`, and `npm.cmd run typecheck` all passed.
- Scope intentionally not done: no runtime controller changes, no runtime write policy changes, no UI changes, no context compiler changes, no relationship deriver changes, no outline changes, no post-ingest distiller implementation, no real LLM call, and no `git commit` / `git push`.

## Project Status

- RPG Runtime-Oriented Ingest `Relationship/Tension Deriver v0` sixth stage is implemented as a pure proposal-only TypeScript service. `src/lib/rpg-relationship-tension-deriver.ts` now derives reviewable relationship and plot-pressure proposals from RPG pages, structured ingest signals, and source notes without wiring into ingest writes or runtime apply paths.
- The deriver reads `characters`, `events`, `plot-arcs`, `relationships`, `sources` evidence, optional `RpgIngestSignal[]`, and optional source notes; it proposes trust, tension, secret, misunderstanding, dependency, and conflict-pressure changes with participants, evidence summaries, rationale, player triggers, unresolved boundaries, confidence, warnings, and proposal markdown.
- Relationship proposals target merge-style review patches under `wiki/relationships/` when participants are sufficient, plot-pressure proposals target `wiki/plot-arcs/`, and insufficient participant/evidence cases become `review_only` proposals with warnings instead of fabricated relationship pages.
- All derivation conclusions are `inferred_for_play` or `uncertain`; direct evidence and source notes remain evidence summaries in proposal markdown and are not promoted into canon facts. Proposal markdown explicitly states `REVIEW / proposal-only` and warns against automatic overwrite, append, merge, apply, or canon writes.
- Added `src/lib/rpg-relationship-tension-deriver.test.ts` covering character behavior plus event consequences, secrets/misunderstandings as inferred_for_play, direct evidence as evidence-only, relationship merge patches without full character introductions, plot-arc conflict pressure boundaries, source notes/signals as evidence, review-only warnings for insufficient participants, and REVIEW/proposal-only markdown boundaries.
- Sixth-stage validation is green: `npx.cmd vitest run src/lib/rpg-relationship-tension-deriver.test.ts` passes with 1 file / 8 tests; `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts` passes with 3 files / 31 tests; `npm.cmd run typecheck` passes.
- This stage deliberately did not connect the deriver to the ordinary ingest automatic write path, did not silently write `wiki/relationships/` or `wiki/plot-arcs/`, did not write canon facts, did not modify runtime controller, UI, Tauri command, or write policy, did not add real LLM calls, and did not execute `git commit` or `git push`.
- RPG Runtime-Oriented Ingest `Context Capsule Retrieval v0` fifth stage is implemented in the read-only runtime context compiler. `compileRpgContext()` now formats non-source wiki pages through section-aware runtime extraction before they enter `CompactStoryBrief`, prioritizing `Runtime Capsule` and category-specific runtime sections instead of defaulting to compacted whole-page encyclopedia text.
- The context compiler now parses basic `##` / `###` Markdown sections and applies per-directory priorities: character behavior/dialogue/relationship levers, location scene hooks/interactables/risks/clues/sensory anchors, relationship tension/triggers/unresolved questions/progression conditions, plot pressure/triggers/unresolved questions/progression conditions, event consequences/state changes/fallout, and runtime-useful player/world/faction/item/quest/memory/style/rule sections.
- `wiki/sources/` remains reference-only: source pages are still added to `brief.references` but their bodies are not read into `hardFacts` or prompt body fields. `current-scene` stays a high-priority current snapshot, and player pages are now compacted through player-runtime section priorities before fallback.
- Runtime section extraction keeps the existing `stripUnchosenActionOptions()` sanitation path, preserves base page plus `runtime/` overlay composition, and only falls back to compact whole-page content when no runtime-facing section exists.
- Added focused runtime tests for character Runtime Capsule / Behavior Rules / Dialogue Style / Relationship Levers over Canon/Evidence poison text, location scene affordances over long history, relationship tension/triggers/progression over background encyclopedia text, source reference-only behavior, high-priority current scene/player/relationship content, and unchosen action-option stripping.
- Fifth-stage validation is green: `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passes with 1 file / 8 tests; `npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-controller.test.ts` passes with 3 files / 29 tests; `npm.cmd run typecheck` passes.
- This stage deliberately did not change ingest write flow, runtime write policy, runtime controller semantics, UI, real LLM calls, wiki file contents, automatic compression/rewrite behavior, Post-Ingest Distiller apply behavior, Relationship/Tension Deriver, or git commit/push behavior.
- RPG Runtime-Oriented Ingest `Post-Ingest Distiller v0` fourth stage is implemented as a pure internal TypeScript service. `src/lib/rpg-post-ingest-distiller.ts` adds `distillRpgWikiPage()`, `distillRpgWikiPages()`, and `createRpgDistillReviewItems()` without wiring any filesystem write, review apply, UI, runtime controller, or Tauri command path.
- The distiller recognizes `wiki/<category>/...` for `characters`, `locations`, `events`, `plot-arcs`, and `relationships`, skips `wiki/sources/` as evidence-layer material with a warning, and leaves unsupported categories as skipped proposals rather than inventing behavior or touching legacy `entities` / `concepts` / `sources` code.
- Distill proposals now include `targetPath`, `category`, `originalLength`, `hasRuntimeCapsule`, `candidateRuntimeCapsule`, `roleplaySignals`, `keepSections`, `compressSections`, `moveToEvidenceSections`, `needsHumanConfirmation`, `proposalMarkdown`, and `warnings`. The generated proposal markdown explicitly lists recommended keep/compress/evidence/human-confirmation sections plus a candidate `Runtime Capsule` and a safety line that it is REVIEW/proposal-only.
- v0 heuristics detect runtime-facing material for character portrayal/dialogue/boundaries, location scene affordances, confirmed event consequences, plot pressure/progression conditions, and relationship trust/tension/secrets/triggers. They mark low-value metadata/trivia, long biography, route/timeline recap, duplicate evidence, event future plans/foreshadowing, and plot-arc future-as-fact wording for compression, evidence routing, or human confirmation.
- Added `src/lib/rpg-post-ingest-distiller.test.ts` with sample output coverage for `characters`, `locations`, `events`, `plot-arcs`, and `relationships`, plus pure no-writeback verification and review item generation with affected page and Inspect/Dismiss options.
- Fourth-stage validation is green: `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts` passes with 1 file / 7 tests; `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts` passes with 2 files / 24 tests; `npm.cmd run typecheck` passes.
- This stage deliberately did not silently write back original wiki pages, did not write `.llm-wiki/review.json`, did not auto accept/reject/apply review proposals, did not implement Context Capsule Retrieval, did not implement Relationship/Tension Deriver, did not modify runtime controller, UI, Tauri commands, or real file writing behavior, and did not execute `git commit` or `git push`.
- `docs/RPG_MERGE_PROMPT_REDESIGN.md` now includes a copy-ready opencode execution prompt for the first implementation stage, `RPG Merge Policy v0`, plus a brief six-stage follow-up roadmap covering merge lint, section-aware merge, runtime write merge alignment, real-model evaluation, and review-controlled compression. This was a documentation handoff update only; no production code changed in this pass.
- RPG Merge Policy v0 is implemented. Page merging now receives path-aware merge context (`sourceFileName`, `pagePath`, `signal`) and builds the production merge system prompt from `src/lib/rpg-merge-policy.ts` instead of the old single encyclopedia-style prompt.
- The new merge policy registry selects RPG merge semantics by path: source evidence, stable operating model, runtime state, relationship tension, plot pressure, event history, current-scene snapshot, manual-control, or generic RPG fallback. The prompt now explicitly rejects preserving every factual claim as the top priority and instead applies RPG runtime utility, stale-state replacement, future-as-fact prevention, and stable/runtime layer separation.
- `mergePageContent()` now applies path-specific body shrink thresholds. Relationship, plot-pressure, runtime-state, and current-scene pages can accept stronger compression when the LLM removes encyclopedia noise or replaces stale state, while generic/unknown paths keep the older conservative 70% threshold.
- Added `docs/RPG_MERGE_PROMPT_REDESIGN.md` to document the problem, merge-policy grouping, prompt fragments, implementation plan, and acceptance criteria for RPG-oriented entry merging.
- RPG Merge Policy v0 validation is green: `npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passes with 2 files / 18 tests; `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passes with 4 files / 52 tests; `npm.cmd run typecheck` passes.
- RPG Runtime-Oriented Ingest `Long Source Signal Extraction v0` third stage is implemented. Long-source chunk analysis now asks for fenced `## RP Runtime Signals JSON`, parses chunk output into `RpgIngestSignal[]`, normalizes unsafe or malformed signals, stores checkpoint v2 signal state, globally deduplicates/merges signals, and builds a `## Structured RP Runtime Signals` context before Stage 2 generation.
- Added `src/lib/rpg-ingest-signals.ts` as the pure signal boundary. The minimal signal contract includes `kind`, optional `targetPath`, `summary`, `rpUse`, `evidence`, `utilityScore`, `confidence`, and `canonStatus`, with optional `sourceChunkId`, `targetObject`, `dedupeKey`, and `warnings`. Supported kinds are `portrayal_rule`, `dialogue_style`, `behavior_boundary`, `scene_affordance`, `relationship_tension`, `plot_pressure`, `world_constraint`, `action_hook`, `state_change`, `style_rule`, and `noise`.
- Signal normalization now clamps `utilityScore` to 0-5, defaults invalid `confidence` to `low`, defaults invalid `canonStatus` to `uncertain`, converts invalid kinds to `noise`, caps noise at utility 0-1, downgrades non-noise signals missing summary or evidence to noise, and clears unsafe or legacy `targetPath` values instead of passing them to Stage 2.
- Long-source signal aggregation now merges duplicate signals by `kind + targetPath/targetObject + normalized summary`, combines short `evidence` / `rpUse` without unbounded growth, keeps the highest utility score and confidence, and merges canon status conservatively so mixed `uncertain` / `inferred_for_play` material is not promoted to `canon`.
- Long-source Stage 2 context now separates utility buckets: 3-5 signals are the only structured core material for non-source runtime-facing pages, 4-5 signals are marked as `Runtime Capsule` priority, 2 signals go to REVIEW or `Evidence and Uncertainty`, and 0-1 signals stay source-only / ignored noise. The context also emits a generated `## Source Profile` so focused Stage 2 guidance can still activate for long sources.
- Stage 2 RPG page guidance now treats `## Structured RP Runtime Signals` as the authoritative long-source gate when present, forbids utility 0-1 signals from generating non-source pages, limits utility 2 signals to review/evidence unless a 3-5 signal supports the same target, requires 4-5 signals to be prioritized in `Runtime Capsule`, and explicitly prevents long route/course recaps from becoming one long `wiki/events/` page.
- Third-stage validation is green: `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts` passes with 1 file / 9 tests; `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passes with 1 file / 33 tests; `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts` passes with 2 files / 16 tests; `npm.cmd run typecheck` passes.
- This stage deliberately did not implement Post-Ingest Distiller, Context Capsule Retrieval, Relationship/Tension Deriver, automatic accept/reject/apply review behavior, automatic page rewriting/compression, writer strategy changes beyond long-source analysis context, runtime controller/UI changes, or `git commit` / `git push`. The real LLM long-source path was not manually exercised; coverage is through pure-function tests, prompt-contract tests, existing smoke/lint tests, and typecheck.
- RPG Runtime-Oriented Ingest Quality Lint v0 second stage is implemented. `validateRpgExtraction()` now turns the Stage 1 prompt contract into post-generation warning/review signals for runtime-facing RPG pages without rewriting, compressing, accepting/rejecting, applying, or blocking source-summary writes.
- Runtime-facing non-source RPG pages now get lint coverage for missing `## Runtime Capsule`, weak capsule text with no action/constraint/tension/state/portrayal signal, page and capsule soft-budget overflow, and low-value encyclopedia noise such as release/version/platform data, voice actor metadata, fan tags, trivia, birthdays, blood type, height, or weight when no RP utility signal is present.
- Dynamic RPG semantic lint is stronger: `wiki/events/` still catches route/timeline-like pages and now also flags future/unresolved plot material; `wiki/plot-arcs/` flags possible futures written as confirmed facts; `wiki/current-scene/` ordinary-ingest violations now produce both warning and review signals while the runtime writer boundary remains unchanged.
- Source/evidence pages under `wiki/sources/` and listing/structural pages such as `index.md`, `overview.md`, and `log.md` are excluded from runtime-facing capsule and encyclopedia-noise lint so source summaries can retain evidence material.
- Stage 2 validation is green: `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts` passes with 1 file / 15 tests; `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts` passes with 3 files / 46 tests; `npm.cmd run typecheck` passes.
- This stage deliberately did not implement Long Source Signal Extraction, Post-Ingest Distiller, Context Capsule Retrieval, Relationship/Tension Deriver, automatic page rewriting/compression, automatic accept/reject/apply behavior, writer strategy changes, runtime controller changes, UI changes, or real LLM call path changes.
- RPG Runtime-Oriented Ingest Prompt Contract v0 first stage is implemented. Stage 1 RPG analysis now asks for source-level runtime utility focus, noise ratio, recommended ingest mode, per-candidate `runtime_utility`, `runtime_use`, `canon_status`, and a natural-language `RP Runtime Signals` section for Stage 2 context.
- RPG Stage 2 prompt guidance is now runtime-oriented for non-source pages: `Runtime Capsule` is required near the top of every eligible non-source RPG page, soft page budgets are included, Stage 1 `runtime_utility` / `utility_score` acts as a generation gate, and world/locations/factions/items/events/plot-arcs/relationships/player/current-scene contracts have been rewritten toward runtime constraints, hooks, pressure, state, and playable scene use.
- The characters page contract has been compressed into a runtime-first structure: `Runtime Capsule`, `Canon Facts`, `Psychological Model`, `Behavior Rules`, `Dialogue Style`, `Relationship Levers`, and `Evidence and Uncertainty`. The old biography-heavy heading set is no longer the recommended structure.
- Runtime-oriented ingest prompt stage validation is green: `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passes with 1 file / 30 tests; `npx.cmd vitest run src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts` passes with 2 files / 9 tests; `npm.cmd run typecheck` passes.
- This stage deliberately changed only prompt / prompt helper text and prompt assertions. It did not implement long-source signal parsing/merging, post-ingest distiller, quality lint, context compiler retrieval, Relationship/Tension Deriver, writer/parser/runtime controller/UI changes, or real LLM call path changes.
- Earlier planning work rewrote `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md` 的第一阶段计划段为可直接复制到新 Codex 窗口执行的 `RPG Runtime-Oriented Ingest Prompt Contract v0` prompt；该 prompt contract 现已在本阶段源码中执行。
- Stage 6.13 `Runtime Persistence v0` is implemented. Runtime metadata now lives under `.llm-wiki/runtime/` with `turn-records.jsonl`, `pending-updates.json`, and `apply-results.jsonl`; it is internal audit/recovery data and is not written into `wiki/` as canon.
- Stage 6.13 adds `src/lib/rpg-runtime/runtime-persistence.ts` for safe path creation, pending queue load/save, turn journal append, apply journal append, and runtime snapshot restore. Missing metadata returns an empty queue, corrupt pending JSON returns a warning plus an empty queue, and writes stay under `projectPath/.llm-wiki/runtime/`.
- Stage 6.13 wires optional controller turn journaling into `runRpgRuntimeTurnFlow()` without making pure/controller tests write files by default. As of Redundancy Cleanup Phase 4, journal entries use the interaction proposal source only.
- Stage 6.13 wires the RPG runtime UI to restore pending updates on startup, save newly produced pending queues, persist accept/reject state changes, save the remaining queue after apply, and append apply results. Apply still goes only through `applyRpgPendingUpdates()`; restored accepted updates are not auto-applied, and pending/rejected updates are not passed to apply.
- Stage 6.13 validation is green: `npx.cmd vitest run src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx` passes with 7 files / 61 tests; `npx.cmd vitest run src/lib/project-mode.test.ts src/lib/wiki-page-types.test.ts src/lib/wiki-type-style.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-interactions.test.ts` passes with 6 files / 65 tests; `npm.cmd run typecheck` passes.
- `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md` 的“后续阶段”已从简略清单扩充为第二至第六阶段的小步计划，覆盖 Ingest Quality Lint、Long Source Signal Extraction、Post-Ingest Distiller、Context Capsule Retrieval、Relationship/Tension Deriver 的目标、建议改动、验收边界，并保持第一阶段 prompt 改动计划不变。
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` 的 Ingest 层已更新为 runtime-oriented ingest 架构：静态来源导入应先抽取 RP 信号、进行 utility 评分，再生成带 `Runtime Capsule` 的短运行条目，并通过 quality lint / post-ingest distiller 控制长页和百科漂移。
- Stage 6.12 `Runtime Contract Alignment v0` is implemented. `wiki/quests/` is now explicitly defined as an objective tracking / runtime merge directory for goals, tasks, blockers, completion state, and accepted runtime objective changes.
- Stage 6.12 aligns `wiki/quests/` across bootstrap, turn references, context compiler, narration prompt, runtime update target policy, state extractor, write policy, UI type/display, and docs. `CompactStoryBrief` now includes `activeQuests`, and context compiler v0 reads `wiki/quests/*.md` into that field and references.
- Stage 6.12 keeps the write boundary strict: runtime update/write policy allows `wiki/quests/*.md` only with `merge`; `overwrite` and `append` fail, and `style`, `rules`, `sources`, `memory`, stable/base pages, and legacy directories remain rejected.
- Stage 6.12 validation is green: `npx.cmd vitest run src/lib/project-mode.test.ts src/lib/wiki-page-types.test.ts src/lib/wiki-type-style.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passes with 10 files / 102 tests; `npx.cmd vitest run src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts` passes with 2 files / 16 tests; `npm.cmd run typecheck` passes.
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` now routes future implementation from Stage 6.14 `Runtime Apply Refresh + UI Reliability v0` through runtime update validation, section-aware merge, Context Compiler v1, relationship/tension derivation, outline impact detection, outline regeneration, and project audit/evaluation.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` now treats the Stage 1-6.12 runtime loop, pending review/apply UI, interaction boundaries, write policy, and quests contract alignment as existing capabilities, and reframes remaining work around runtime stability and later derivation/outline/audit systems.
- `docs/LLMWIKIRPG_USAGE.md` now reflects the RPG-only `wikiMode: llmwikirpg` product boundary and removes the outdated current-limit note about quests alignment.
- Stage 6.11 `RPG LLM Interaction Boundary Consolidation v0` is implemented. `src/lib/rpg-interactions/` now owns the narration prompt/parse contract via `narrationInteractionSpec`, with `kind: "narration"`, prompt construction moved from the old runtime prompt builder, and JSON extraction plus `validateRpgTurnResult()` validation consolidated behind the interaction parse boundary.
- Stage 6.11 keeps the old narration import path compatible: `src/lib/rpg-runtime/narration-prompts.ts` remains as a thin wrapper exporting `buildRpgNarrationPrompt()` and the existing prompt types while delegating to `narrationInteractionSpec.buildPrompt()`.
- Stage 6.11 refactors `createLlmRpgNarrationAdapter()` so the adapter still owns the real `streamChat()` call but no longer owns the main JSON extraction/validation logic; it now parses model output through the narration interaction boundary.
- Stage 6.11 adds `src/lib/rpg-interactions/llm-runtime-update-adapter.ts` with `createLlmRpgRuntimeUpdateInteractionAdapter()`. The adapter streams a runtime update interaction prompt to the configured LLM and returns raw text only; it does not parse proposals, write wiki files, accept/reject pending updates, or call `applyRpgPendingUpdates()`.
- Stage 6.11 wires the RPG runtime UI default submit path to a dedicated runtime update interaction adapter. `RpgRuntimePanelDependencies` now includes `createUpdateInteractionAdapter`, and `submitRpgRuntimePanelAction()` creates both narration and update interaction adapters before calling `runRpgRuntimeTurnFlow({ updateInteractionAdapter })`.
- Stage 6.11 originally preserved a controller transition fallback when no update interaction adapter was injected. Redundancy Cleanup Phase 4 later made the dedicated runtime update interaction adapter required for `runRpgRuntimeTurnFlow()`.
- Stage 6.11 deliberately does not implement Stage 7 outline impact detection, Stage 8 outline regeneration, Stage 9 relationship/tension derivation, new wiki write paths, ingest changes, automatic pending accept/reject, automatic pending apply, or any automatic call to `applyRpgPendingUpdates()`.
- Stage 6.11 validation is green: `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passes with 5 files / 66 tests; `npm.cmd run typecheck` passes.
- Stage 6.10 `Runtime Update Interaction Controller Integration v0` is implemented. `runRpgRuntimeTurnFlow()` now accepts an optional injected runtime update interaction adapter and, when present, builds a prompt with `runtimeUpdateInteractionSpec.buildPrompt({ turnRecord })`, asks the adapter for raw update-proposal output, parses it with `runtimeUpdateInteractionSpec.parseOutput()`, and stages the resulting `ProposedWikiUpdate[]` through `createPendingRpgUpdates()`.
- Stage 6.10 keeps narration and update proposals separated for adapter-driven callers: narration can return only player-visible story and next action options, while the dedicated runtime update interaction can still produce proposed/pending wiki updates from the completed `RpgTurnRecord`.
- Stage 6.10 preserves the legacy transition path when no update interaction adapter is injected: the controller still calls `extractRpgStateUpdates({ turnRecord })` against `turnRecord.generatedNarrative`, so existing fenced-block narration callers remain compatible until the old path is removed in a later stage.
- Stage 6.10 adds `src/lib/rpg-interactions/runtime-update-adapter.ts` with `RpgRuntimeUpdateInteractionAdapter` and `createFixtureRuntimeUpdateInteractionAdapter()`. Tests use only fixture adapters; no real LLM is called.
- Stage 6.10 deliberately does not call `applyRpgPendingUpdates()`, does not auto-accept or auto-reject pending updates, does not write wiki files, does not modify UI or ingest, and does not implement outline impact detection, outline regeneration, or relationship/tension derivation.
- Stage 6.10 validation is green: `npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts` passes with 7 files / 65 tests; `npm.cmd run typecheck` passes.
- Stage 6.9 `RPG Interaction Contract v0` is implemented under `src/lib/rpg-interactions/`. It adds the generic `RpgInteractionSpec<TInput, TOutput>` contract plus the first `runtime_state_update` interaction spec for building a dedicated state-update proposal prompt from a completed `RpgTurnRecord`.
- Stage 6.9 now documents runtime update proposal generation as separate from narration: narration remains responsible for player-visible story and future action options, while `runtimeUpdateInteractionSpec` is the later integration point for producing `ProposedWikiUpdate[]` from `submittedAction + generatedNarrative + references`.
- Stage 6.9 extracts shared runtime update target policy into `src/lib/rpg-interactions/wiki-update-policy.ts`. `getRpgRuntimeUpdateTargetRules()` and `validateRpgRuntimeUpdateTarget()` define the allowed current-scene, events, player, relationships, plot-arcs, and runtime overlay paths and are reused by the existing state extractor and runtime write policy.
- Stage 6.9 deliberately does not call a real LLM, does not automatically attach the interaction spec to `runRpgRuntimeTurnFlow()`, does not call `applyRpgPendingUpdates()`, does not write wiki files, does not modify UI, and does not implement Stage 7-9 outline or relationship systems.
- Stage 6.9 validation is green: `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts` passes with 7 files / 60 tests; `npm.cmd run typecheck` passes.
- Stage 6.8 `Pending RPG Updates Review + Apply UI v0` is implemented. A new `src/components/rpg/pending-rpg-updates-panel.tsx` review component displays each pending update's `targetPath`, `strategy`, `status`, `reason`, `content`, and `references`, with explicit per-update accept/reject controls and a manual `Apply accepted` action.
- Stage 6.8 is wired into `RpgRuntimePanel` beside the RPG play surface. The runtime panel now keeps pending review state locally, uses the existing in-memory `acceptPendingRpgUpdate()` / `rejectPendingRpgUpdate()` helpers, and never auto-accepts or auto-applies updates produced by `runRpgRuntimeTurnFlow()`.
- Stage 6.8 writeback still goes only through `applyRpgPendingUpdates()`, injected as the panel's `applyPendingUpdates` dependency. The panel sends only `status: "accepted"` updates to that boundary, leaves `pending` / `rejected` updates out of apply, removes applied updates from the local review list, and preserves skipped updates with visible skip reasons and the latest applied/skipped/warning result.
- Stage 6.8 deliberately does not implement outline impact detection, outline regeneration, relationship/tension derivation, automatic wiki rewrites, or any Stage 7-9 behavior. Stable/manual/base/legacy path protection remains owned by the Stage 6 write policy.
- Stage 6.8 validation is green: `npx.cmd vitest run src/components/rpg/pending-rpg-updates-panel.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/rpg-play-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 13 files / 82 tests; `npm.cmd run typecheck` passes.
- Stage 6.7 `RPG Play Panel App Integration v0` is implemented. A new container component `src/components/rpg/rpg-runtime-panel.tsx` now reads `wiki/current-scene/scene_state.md`, renders the existing dumb `RpgPlayPanel`, constructs the real `createLlmRpgNarrationAdapter()`, and submits player actions through `runRpgRuntimeTurnFlow()`.
- Stage 6.7 is wired into the main app as a dedicated `Play` view via `src/components/layout/icon-sidebar.tsx`, `src/components/layout/content-area.tsx`, and the `activeView` store union. The entry is available in the llmWikiRPG app shell without replacing existing wiki/chat/source/search/graph/lint/review/settings views.
- Stage 6.7 updates the UI after a turn with `turnResult.narrative` and `turnResult.nextActionOptions`, displays runtime warnings, runtime errors, and a read-only pending update count/path summary. Missing `wiki/current-scene/scene_state.md` is shown as a warning/empty state instead of crashing.
- Stage 6.7 deliberately does not call `applyRpgPendingUpdates()`, does not accept/reject pending updates, does not implement pending update review UI, and does not write wiki files.
- Stage 6.7 validation is green: `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/rpg-play-panel.test.tsx src/lib/rpg-play-panel-state.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts` passes with 12 files / 76 tests; `npx.cmd vitest run src/i18n/i18n-parity.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passes with 2 files / 15 tests; `npm.cmd run typecheck` passes.
- Stage 6.7 also confirmed `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort false` reaches Vite ready state in foreground. The in-app Browser plugin was unavailable in this session (`iab` not available), so browser-level verification was not completed.
- Stage 6.6 `Runtime Turn Controller + Pending Output` is implemented under `src/lib/rpg-runtime/runtime-controller.ts`. `runRpgRuntimeTurnFlow()` now composes the existing `runRpgTurn() -> extractRpgStateUpdates() -> createPendingRpgUpdates()` chain into one reusable runtime controller.
- Stage 6.6 returns the compact story brief, validated `RpgTurnResult`, completed `RpgTurnRecord`, extracted `ProposedWikiUpdate[]`, staged `PendingRpgUpdate[]`, and merged warnings from both the turn orchestrator and state extractor.
- Stage 6.6 keeps all staged updates at `status: "pending"` by default. It does not call `acceptPendingRpgUpdate()`, `rejectPendingRpgUpdate()`, or `applyRpgPendingUpdates()`, does not write wiki files, does not attach to UI, and does not call a real LLM in tests.
- Stage 6.6 validation is green: `npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 10 files / 62 tests; `npm.cmd run typecheck` passes.
- Stage 6.5 `Real RPG Narration Adapter v0` is implemented under `src/lib/rpg-runtime/llm-narration-adapter.ts`. `createLlmRpgNarrationAdapter()` adapts an `RpgNarrationPrompt` to the existing project LLM path by calling `streamChat()` with a system message from `prompt.systemPrompt` and a user message from `prompt.userPrompt`.
- Stage 6.5 collects streamed tokens into a complete model output, extracts an `RpgTurnResult` JSON object from pure JSON, markdown fenced JSON, or short prose-wrapped JSON, parses it, and then delegates structural validation to the existing `validateRpgTurnResult()` boundary.
- Stage 6.5 surfaces clear errors for empty LLM output, missing JSON object, JSON parse failure, LLM streaming failure, and malformed `RpgTurnResult` validation failures. It forwards the provided `AbortSignal` to `streamChat()` and does not add a separate provider implementation.
- Stage 6.5 remains narration-only: it does not write wiki files, extract pending updates, call `applyRpgPendingUpdates()`, attach to the RPG Play Panel, reuse normal wiki QA chat, or implement Stage 7-9 behavior.
- Stage 6.5 validation is green: `npx.cmd vitest run src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 9 files / 56 tests; `npm.cmd run typecheck` passes.
- Stage 6 `Runtime Write Policy` is implemented as an explicit write boundary under `src/lib/rpg-runtime/write-policy.ts`. `applyRpgPendingUpdates()` applies only `PendingRpgUpdate.status === "accepted"` updates and returns applied/skipped/warning summaries.
- Stage 6 revalidates path and strategy at write time instead of trusting Stage 5: `wiki/current-scene/scene_state.md` requires `overwrite`, direct `wiki/events/*.md` pages require `append`, and direct `wiki/player/*.md`, `wiki/relationships/*.md`, `wiki/plot-arcs/*.md`, plus `characters` / `locations` / `factions` / `items` `runtime/*.md` overlays require `merge`.
- Stage 6 skips `pending` and `rejected` updates without writing. It also skips and warns on stable/manual paths (`world`, `style`, `rules`, `sources`), base `characters` / `locations` / `factions` / `items` pages, legacy paths, strategy/path mismatches, and paths outside the allowed runtime write targets.
- Stage 6 constrains actual filesystem writes to `projectPath/wiki/...`, creates parent directories before writing, overwrites current-scene snapshots, appends/creates event files, and implements first-pass merge as conservative section append.
- Stage 6 remains independent: it is not wired into `runRpgTurn()`, the RPG Play Panel, ingest, real LLM calls, relationship derivation, or outline impact/regeneration.
- Stage 6 validation is green: `npx.cmd vitest run src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 8 files / 47 tests; `npm.cmd run typecheck` passes.
- Stage 5 `State Update Extractor + Pending Updates` is implemented as a pure in-memory boundary under `src/lib/rpg-runtime/`. `extractRpgStateUpdates()` now converts explicit `rpg-wiki-update` blocks in a completed `RpgTurnRecord.generatedNarrative` into reviewable `ProposedWikiUpdate[]`.
- Stage 5 proposed updates are limited to runtime-safe targets: `wiki/current-scene/scene_state.md` with `overwrite`, direct `wiki/events/*.md` pages with `append`, direct `wiki/player/*.md`, `wiki/relationships/*.md`, `wiki/plot-arcs/*.md`, and `characters` / `locations` / `factions` / `items` `runtime/*.md` overlays with `merge`.
- Stage 5 filters legacy paths, stable/manual paths (`world`, `style`, `rules`), and base `characters` / `locations` / `factions` / `items` pages from proposed runtime updates, recording warnings instead of writing or applying changes.
- Stage 5 adds `createPendingRpgUpdates()`, `acceptPendingRpgUpdate()`, and `rejectPendingRpgUpdate()` as in-memory staging helpers. Pending updates default to `status: "pending"` and accept/reject only changes the selected update status.
- Stage 5 validation is green: `npx.cmd vitest run src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 7 files / 38 tests; `npm.cmd run typecheck` passes.
- Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter` is implemented as a thin single-turn vertical slice under `src/lib/rpg-runtime/`. `runRpgTurn()` now connects `SubmittedAction -> CompactStoryBrief -> RpgNarrationPrompt -> RpgTurnResult -> RpgTurnRecord` without writing wiki files or generating pending updates.
- Stage 4.5 adds an injectable `RpgNarrationAdapter`, `createFixtureNarrationAdapter()`, and `validateRpgTurnResult()`. Adapter output is rejected unless it has a non-empty `narrative`, 3 to 5 valid `nextActionOptions`, string-array `references`, allowed option `intent` / `riskLevel`, and string-array `likelyAffectedPaths`.
- Stage 4.5 reuses the existing RPG reference cleaning/filtering boundary for validated turn results and completed turn records, so legacy reference paths remain filtered out and unchosen `nextActionOptions` still do not enter `RpgTurnRecord`.
- Stage 4.5 validation is green: `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passes with 5 files / 27 tests; `npm.cmd run typecheck` passes.
- Final schema overlay contract is now implemented across bootstrap schema text, RPG category/schema wording, and focused tests. New llmWikiRPG bootstraps create `wiki/characters/runtime`, `wiki/locations/runtime`, `wiki/factions/runtime`, and `wiki/items/runtime` as runtime overlay subdirectories.
- The final schema contract now distinguishes stable base pages from runtime overlays: `characters`, `locations`, `factions`, and `items` keep source-supported base material, while play-time/current campaign changes are documented for the corresponding `runtime/` overlay paths.
- This schema-overlay stage intentionally did not implement runtime write APIs, pending updates, a state extractor, a relationship derivation engine, or outline regeneration.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` and `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` have been recalibrated after the schema overlay work: the next recommended stage is now Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter`, a thin playable turn slice that connects the first four runtime skeleton stages before Stage 5 pending-update extraction.
- Stage 4 `RPG Play Panel v0` is implemented as an independent UI/component boundary under `src/components/rpg/`, separate from normal wiki QA chat. It exposes `RpgPlayPanel`, `CurrentScenePanel`, `ActionOptionsPanel`, and `TurnNarrativePanel` from `src/components/rpg/index.ts`.
- Stage 4 adds pure play-panel state helpers in `src/lib/rpg-runtime/play-panel-state.ts`, exported from `src/lib/rpg-runtime`. The helpers model current scene, last narrative, future candidate action options, freeform action text, selected option id, and submitted action without reading or writing wiki files.
- Stage 4 action submission semantics are locked: selecting a candidate option creates `SubmittedAction` with `source: "selected_option"` and `selectedOptionId`, while freeform input creates `SubmittedAction` with `source: "freeform"` and no `selectedOptionId`.
- Stage 4 keeps `nextActionOptions` in a future-candidate semantic bucket. Unselected options are not modeled as completed facts, completed turn records, pending wiki updates, current-scene overwrites, event appends, relationship updates, or any other wiki writeback.
- Stage 4 validation is green: `npx.cmd vitest run src/lib/rpg-play-panel-state.test.ts src/components/rpg/rpg-play-panel.test.tsx` passes with 2 files / 10 tests; Stage 3, Stage 2, and Stage 1 targeted regressions still pass; `npm.cmd run typecheck` passes.
- Stage 3 `Narration Prompt Builder` is implemented as a pure prompt construction layer in `src/lib/rpg-runtime/narration-prompts.ts`. It builds `{ systemPrompt, userPrompt }` from an existing `CompactStoryBrief`, uses `brief.submittedAction` as the only submitted player action, and does not call an LLM, read wiki files, write wiki files, extract state, or change UI.
- The Stage 3 prompt explicitly requests an `RpgTurnResult`-compatible JSON shape with `narrative`, `nextActionOptions`, and `references`; requires 3 to 5 `nextActionOptions`; lists the `RpgActionOption` fields; and lists the allowed action intents and risk levels.
- The Stage 3 prompt locks the non-canon boundary for unchosen options: generated `nextActionOptions` are candidate future actions only, cannot be written into the narrative as completed outcomes, and cannot be used by later state extraction as facts. Later extraction may only use `SubmittedAction + generated narrative`.
- Stage 3 validation is green: `npx.cmd vitest run src/lib/rpg-narration-prompts.test.ts` passes with 7 tests, `npx.cmd vitest run src/lib/rpg-turn-model.test.ts` still passes with 4 tests, `npx.cmd vitest run src/lib/rpg-runtime.test.ts` still passes with 5 tests, and `npm.cmd run typecheck` passes.
- Stage 2 `RPG Turn Model` is implemented as a pure, read-only model layer in `src/lib/rpg-runtime/turn-model.ts`. The module defines independent RPG turn/action-option types and `createRpgTurnRecord()`, exported from `src/lib/rpg-runtime`, without reusing normal chat message types.
- `createRpgTurnRecord()` builds records only from `SubmittedAction + generatedNarrative + references`. It copies `turnResult.narrative` into `generatedNarrative`, cleans references deterministically, and deliberately excludes `nextActionOptions` so unchosen player-facing options cannot become completed-turn facts.
- Stage 2 validation is green: `npx.cmd vitest run src/lib/rpg-turn-model.test.ts` passes with 4 tests, `npx.cmd vitest run src/lib/rpg-runtime.test.ts` still passes with 5 tests, and `npm.cmd run typecheck` passes.
- Stage 1 `RPG Runtime Agent v0` is implemented as an independent read-only module under `src/lib/rpg-runtime/`. The runtime entry `runRpgRuntimePreview()` accepts `SubmittedAction`, validates `wikiMode === "llmwikirpg"`, calls the internal Context Compiler v0, and returns `RpgRuntimePreviewResult` with `CompactStoryBrief` plus warnings. It does not use normal wiki QA chat, does not generate narration or action options, does not extract state, and does not write wiki files.
- Context Compiler v0 now reads only RPG runtime allowed directories, with fixed `wiki/current-scene/scene_state.md`, `wiki/player/`, recent/relevant `events`, `plot-arcs`, and `relationships`, action-related `characters`/`locations`/`factions`/`items`, high-priority `style`/`rules`/`memory`, and `sources` as reference paths only. It ignores legacy directories and strips unchosen next-action option sections before content enters the brief. Base pages plus `runtime/` overlays are combined by deterministic append.
- Stage 1 validation is green: `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passes with 5 tests, and `npm.cmd run typecheck` passes.
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` has been revised after re-reading the final runtime architecture: the next implementation target is now read-only `RPG Runtime Agent v0`, with `Context Compiler v0` as its first internal capability, rather than an isolated context compiler module. The first stage should create a dedicated runtime entry that accepts `SubmittedAction`, compiles a `CompactStoryBrief`, ignores legacy directories and unchosen options, and performs no narration, extraction, or wiki writeback.
- Rust warning cleanup pass complete for the Tauri backend: removed the unused Windows `CommandExt` import in Codex CLI spawning, made clip-server restart counting meaningful instead of resetting before use, replaced irrefutable DOCX table `if let` patterns with direct destructuring, and removed unused DOCX fallback parser state. Local verification: `rustfmt --edition 2021 --check` passes for the touched Rust files; `cargo check --no-default-features` is still blocked before project source checking because `protoc` is not installed for `lance-encoding`.
- RPG-only hard cutover is now implemented. `ProjectMode` / `WikiMode` accept only `llmwikirpg`; `default` / legacy llm_wiki projects are rejected instead of migrated; new project creation builds an RPG skeleton directly; default prompt/template branches were removed; ingest writeback rejects legacy FILE blocks under `wiki/entities/`, `wiki/concepts/`, `wiki/queries/`, `wiki/comparisons/`, `wiki/synthesis/`, `wiki/methodology/`, `wiki/findings/`, and `wiki/thesis/`; user-initiated saved answers now go to `wiki/memory/`; legacy UI grouping and the old entity/concept maintenance entry point are hidden.
- Branding/docs have been updated toward llmWikiRPG: package metadata, Tauri product/window title, README files, visible app title strings, and the Rust quit prompt now use llmWikiRPG wording. `.llm-wiki/` remains the internal app metadata directory.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` and `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` have been rewritten for the post-cutover RPG-only product boundary. They now treat legacy/default llm_wiki support as removed, keep `wiki/sources/` as the RPG evidence layer, define the valid runtime wiki directories, and frame the next architecture work around a read-only RPG Runtime Agent v0 instead of mode migration or an isolated context compiler.
- Current validation for the RPG-only hard cutover: `npm.cmd run typecheck` passes, and the requested targeted Vitest bundle passes with 10 test files / 96 tests. `cargo check` was attempted but stopped in dependency build because `protoc` is not installed for `lance-encoding`; no Rust source error was reached.
- v0.2 push-preparation validation complete: `npm.cmd run typecheck` passes and `npm.cmd run test:mocks` passes with 95 test files / 1281 tests. Two Windows test-stability fixes were added for normalized source-summary path assertions and ingest-queue JSON reads during background processing writes.
- Documentation cleanup complete: historical stage plans, completed task docs, old reports, and refactor handoffs were moved from `docs/` into `docs/archive/`, with `docs/archive/README.md` documenting what remains active at the top level; `AGENTS.md` now points to the current final architecture / next-steps docs instead of archived stage plans.
- Added `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` in Chinese to record the recommended next architecture implementation path: start with read-only RPG Runtime Agent v0, including Context Compiler v0 as its first internal capability, then add turn models, narration prompts, RPG play UI, state extraction/staging, runtime write policy, outline-impact detection/regeneration, and relationship/tension derivation.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` runtime diagram cleaned up further: `TurnRecord` now receives `SubmittedAction` plus narration output, the redundant non-persisted options edge was removed, and multi-pass compression is represented as an internal `Context Compiler` loop.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` runtime diagram simplified again: ambiguous direct edges from UI/action into state extraction were removed, and the diagram now shows a single runtime-orchestrated turn where UI submits player action, runtime compiles/compresses context, narration returns narrative plus options, and only the completed action+narrative turn record enters state extraction.
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` turn-flow diagram and runtime-agent section revised: a play turn now centers on player action plus wiki context, multi-pass context compression into a compact story-generation brief, narration plus next-action options, writeback of only the completed action+narrative pair, explicit exclusion of unchosen options from wiki state, and plot-outline impact detection/regeneration for major divergences.
- Final architecture target clarified in `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`: llmWikiRPG should converge on a Markdown-backed RPG runtime with separate ingest, relationship/tension derivation, manual context, runtime context compilation, controlled dynamic writeback, and per-turn action options. This is a target architecture document, not a new executable stage plan.
- RPG Stage 1 object-type glossary pass complete: `src/lib/prompts/rpg-ingest.ts` now gives each allowed `object_type` a one-line schema-derived definition, with the former high-risk routing boundaries merged into the relevant glossary entries so `world_fact`, `location`, `faction`, `item`, dynamic-state types, and noise/merge types have lightweight semantic anchors before Stage 1 chooses `needed_categories`.
- Historical note: post-v0.2 current-scene marker gate hardening previously required an explicit live marker before `wiki/current-scene/scene_state.md` could be generated or updated by ingest; this has now been superseded by the ordinary-ingest block above.
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

- Documentation note: final architecture now treats ingest as a lossy RPG runtime compiler rather than a source-to-encyclopedia generator. This pass changed documentation only and did not modify ingest implementation.
- Current next implementation target: Stage 6.14 `Runtime Apply Refresh + UI Reliability v0`, focused on refreshing current-scene, file tree, graph, and related UI state after accepted updates are manually applied.
- Stage 6.13 Runtime Persistence v0 is complete: `.llm-wiki/runtime/` now stores turn journals, pending review queue state, and manual apply journals without entering `wiki/` canon.
- Stage 6.12 Runtime Contract Alignment v0 is complete: `wiki/quests/` is objective tracking / runtime merge, context compiler reads quest pages into `activeQuests`, shared update/write policy accepts only `wiki/quests/*.md` with `merge`, and UI/type/bootstrap/docs are aligned.
- Stage 6.11 RPG LLM Interaction Boundary Consolidation v0 is complete: narration prompt/parse contract now lives in `src/lib/rpg-interactions/`, runtime update has a real LLM adapter that returns raw proposal text, and the RPG runtime UI default path injects the dedicated update interaction adapter into `runRpgRuntimeTurnFlow()`.
- Not implemented in Stage 6.11: Stage 7 outline impact detector, Stage 8 outline regeneration, Stage 9 relationship/tension derivation, ingest changes, new wiki write paths, automatic pending accept/reject, or automatic pending apply.
- Stage 4.5 Runtime Turn Orchestrator + Narration Adapter is complete: the dedicated orchestrator, replaceable narration adapter boundary, fixture adapter, result validator, export path, and focused tests are implemented.
- Not implemented in Stage 4.5: runtime write API, pending updates, state extractor, relationship deriver, outline impact/regeneration, real LLM network calls, normal wiki QA chat reuse, or automatic wiki writes.
- Final architecture schema overlay contract is complete: bootstrap `schema.md`, RPG category descriptions, code-readable RPG wiki schema entries, and focused tests now record runtime overlay paths and base-versus-overlay write boundaries.
- Newly documented/created runtime overlay subdirectories are `wiki/characters/runtime`, `wiki/locations/runtime`, `wiki/factions/runtime`, and `wiki/items/runtime`.
- Not implemented in this stage: runtime write API, pending updates, state extractor, relationship derivation engine, and outline regeneration.
- Architecture roadmap recalibration complete: instead of continuing directly to Stage 5, the next implementation target is Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter`, so the existing runtime preview, turn model, narration prompt builder, and play panel become one testable turn flow before state extraction is added.
- Stage 4 RPG Play Panel v0 is complete: the dedicated RPG play components, component export path, pure play-panel state helpers, submitted-action construction helpers, and focused tests are implemented.
- Stage 3 Narration Prompt Builder is complete: the dedicated prompt builder types, pure `buildRpgNarrationPrompt()` helper, export path, and focused tests are implemented.
- Stage 2 RPG Turn Model is complete: the dedicated turn model types, action option shape, turn result shape, completed turn record shape, reference-cleaning helper, and focused tests are implemented.
- Stage 1 RPG Runtime Agent v0 is complete: the dedicated runtime preview entry and internal read-only context compiler are implemented and covered by focused tests.
- v0.2 push-preparation validation complete: typecheck and mock regression tests are green; test-only path/queue-read stability fixes are included.
- Historical note: post-v0.2 current-scene marker gate hardening previously required an explicit live marker; this has now been superseded by the ordinary-ingest block above.
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

- Stage 6.15: Runtime Update Validation v1.
- Stage 6.14: Runtime Apply Refresh + UI Reliability v0.
- RPG Runtime-Oriented Relationship/Tension Deriver v0.
- RPG Runtime-Oriented Context Capsule Retrieval v0.
- RPG Runtime-Oriented Post-Ingest Distiller v0.
- RPG Runtime-Oriented Long Source Signal Extraction v0.
- RPG Runtime-Oriented Ingest Quality Lint v0.
- RPG Runtime-Oriented Ingest Prompt Contract v0.
- Stage 6.13: Runtime Persistence v0.
- Stage 6.12: Runtime Contract Alignment v0.
- Stage 6.11: RPG LLM Interaction Boundary Consolidation v0.
- Stage 6.10: Runtime Update Interaction Controller Integration v0.
- Stage 6.9: RPG Interaction Contract v0.
- Stage 6.8: Pending RPG Updates Review + Apply UI v0.
- Stage 6.7: RPG Play Panel App Integration v0.
- Stage 6.6: Runtime Turn Controller + Pending Output.
- Stage 6.5: Real RPG Narration Adapter v0.
- Stage 6: Runtime Write Policy.
- Stage 5: State Update Extractor + Pending Updates.
- Stage 4.5: Runtime Turn Orchestrator + Narration Adapter.
- Stage 4: RPG Play Panel v0.
- Stage 3: Narration Prompt Builder.
- Stage 2: RPG Turn Model.
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

- The current product path is RPG-only, but some unexposed legacy helper modules and tests remain in the repository (for example old dedup/search/delete fixtures). They are no longer wired into new project creation, prompt generation, ingest writeback, or visible RPG UI, but broad full-suite cleanup remains a separate follow-up.
- Rust verification currently requires a local `protoc` binary because the dependency `lance-encoding` runs a protobuf build script during `cargo check`.
- Rust backend project creation now creates the RPG skeleton directly. Future cleanup can still consolidate duplicated frontend/backend bootstrap text, but the old legacy-skeleton-then-overwrite path is removed.
- Auxiliary `style`, `rules`, `quests`, and `memory` folders are now created for `llmwikirpg` projects. Stage 6.12 has aligned `quests` with runtime objective tracking and merge-only write policy; `style`, `rules`, and `memory` remain manual or explicit-user-action controlled.
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
- Stage 07 plus v0.2 task 4 originally used heuristic live-session/source markers for `current-scene`; later marker hardening has now been superseded. Ordinary ingest no longer writes `wiki/current-scene/scene_state.md`; lightweight writer diagnostics still use static-source markers to explain rejected writes.
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

- Stage 6.15 `Runtime Update Validation v1`: single-pass runtime update proposals now pass through deterministic path-aware validation before pending staging; rejected proposals are skipped from pending and recorded in warnings/journal audit data.

## Next Stage Recommendation

- New recommendation from the 2026-06-09 interaction-consolidation assessment: run `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` before adding additional model-facing features. This should consolidate RPG prompt builders, output protocols, parsers, target policies, validation, and adapters under `src/lib/rpg-interactions/` so Context Compiler v1 and later derivation/outline stages do not add more prompt islands.
- For the runtime-oriented ingest quality track in `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md`, the listed work is now complete through `Relationship/Tension Deriver v0`; choose a new follow-up track or evaluation pass before further implementation.
- Use `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md` as the target architecture.
- Use `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` as the next implementation roadmap.
- With Stage 6.16 runtime merge semantics covered by the existing section-aware/runtime write merge alignment work, the next architecture stage in `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` is Stage 6.17 `Context Compiler v1`, unless a separate evaluation or documentation pass is chosen first.
- Use `docs/LLMWIKIRPG_USAGE.md` as the first-version operating guide for RPG-mode projects.
- Use `docs/RPG_WIKI_SCHEMA.md` and `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md` as current schema/update-policy references.
- Use `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md` only when returning to extraction-quality evaluation work.
- Historical stage plans, completed task lists, old reports, and refactor handoffs now live under `docs/archive/`.
