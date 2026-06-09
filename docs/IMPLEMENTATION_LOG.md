# Implementation Log

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 4-5

### Stage

`RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` Phase 4-5: Import Mode Contract Alignment and Remove Old Prompt Islands.

### Changed files

- Added `src/lib/rpg-interactions/control-doc/canonicalization-interaction.ts`
- Added `src/lib/rpg-interactions/control-doc/import-contract.ts`
- Added `src/lib/rpg-interactions/control-doc/index.ts`
- Added `src/lib/rpg-interactions/campaign-setup/setup-contract.ts`
- Added `src/lib/rpg-interactions/campaign-setup/index.ts`
- Moved `src/lib/prompts/shared-ingest.ts` to `src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts`
- Deleted `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/chunk-analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/generation-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/index.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `src/lib/rpg-import/control-doc-import.ts`
- Updated `src/lib/rpg-import/campaign-setup-import.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`

### Summary

- Moved the control-doc canonicalization interaction spec under `src/lib/rpg-interactions/control-doc/` and removed the old top-level file without a wrapper.
- Added `control-doc/import-contract.ts` as the deterministic control document import contract source for supported slots, target paths, write policies, review policies, and canonicalization notes.
- Added `campaign-setup/setup-contract.ts` as the deterministic campaign setup import contract source for supported slots, dynamic target path resolution, write policies, review policies, canonicalization/bootstrap notes, future-pressure filtering, ability-like input review, and current-scene explicit bootstrap rules.
- Rewired `src/lib/rpg-import/control-doc-import.ts` and `src/lib/rpg-import/campaign-setup-import.ts` so contract data comes from `rpg-interactions/control-doc` and `rpg-interactions/campaign-setup`; import modules still own source reading, raw source anchor writing, safe wiki path checks, manual confirmation, target file writes, and review item generation.
- Added `campaign_setup_import_contract` to `RpgInteractionKind` and the interaction registry as an implemented deterministic contract for stage `campaign_setup_import`.
- Marked registry `control_doc_canonicalization` as `usesLlm: false`; its prompt spec remains only as a model contract boundary / future optional entrypoint, not the current default import behavior.
- Moved the remaining source-ingest shared prompt/protocol helper into `src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts`, so FILE/REVIEW output-format, frontmatter, source-file, and language-rule helpers live under the interaction boundary.
- Strengthened `src/lib/rpg-interactions.test.ts` so implemented deterministic import contracts are covered and old import/prompt islands cannot quietly return.

### Actual differences / baseline notes

- The plan called this import-mode work model-related rather than LLM behavior. The implementation follows that: no import path now calls an LLM, and `campaign_setup_generation` remains a planned future kind.
- `src/lib/rpg-import/ui-import-options.ts` still defines UI option exposure order, but the supported slot contracts used by import behavior now live under `src/lib/rpg-interactions/`.
- The original Phase 4-5 implementation treated `src/lib/prompts/shared-ingest.ts` as the plan's allowed shared-helper exception. Follow-up review found it still contained RPG-specific REVIEW wording, so it was moved into the source-ingest interaction contract boundary and the old path is now guarded absent.
- The broad scan still finds `Runtime Capsule` in deterministic helpers such as `rpg-merge-lint.ts`, `rpg-section-merge.ts`, `rpg-extraction-validation.ts`, `rpg-ingest-signals.ts`, `rpg-post-ingest-distiller.ts`, and tests. These are heading/policy/lint/distill checks, not duplicate prompt builders.

### Validation

- `rg --encoding utf-8 "control-doc-canonicalization-interaction" src` returned no results.
- `rg --encoding utf-8 "prompts/shared-ingest|src/lib/prompts/shared-ingest|shared-ingest.ts" src` only finds the guarded absence assertion in `src/lib/rpg-interactions.test.ts`.
- `rg --encoding utf-8 "You are an RPG|llmWikiRPG narration runtime|RPG wiki extraction|rpg-wiki-update|Runtime Capsule" src/lib` shows source ingest / narration / runtime update prompt/protocol text under `src/lib/rpg-interactions/`; `Runtime Capsule` also appears in deterministic non-prompt helpers and tests as noted above.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-import/ui-import-options.test.ts` passed: 5 files, 88 tests.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-update-validation.test.ts` passed: 4 files, 72 tests.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts` passed after the shared-ingest move: 2 files, 84 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change import mode behavior, target write behavior, manual confirmation behavior, raw source anchor behavior, safe path behavior, or review item generation.
- Did not connect real LLM import behavior.
- Did not add legacy/default compatibility, migration, fallback, or old-path preservation behavior.
- No `git commit` or `git push` was performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 3

### Stage

`RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` Phase 3: Runtime Interaction Cleanup.

### Changed files

- Added `src/lib/rpg-interactions/runtime/index.ts`
- Added `src/lib/rpg-interactions/runtime/runtime-update-protocol.ts`
- Moved `src/lib/rpg-interactions/narration-interaction.ts` to `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Moved `src/lib/rpg-interactions/runtime-update-interaction.ts` to `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Moved `src/lib/rpg-interactions/runtime-update-adapter.ts` to `src/lib/rpg-interactions/runtime/runtime-update-adapter.ts`
- Moved `src/lib/rpg-interactions/llm-runtime-update-adapter.ts` to `src/lib/rpg-interactions/runtime/llm-runtime-update-adapter.ts`
- Moved `src/lib/rpg-interactions/runtime-update-validation.ts` to `src/lib/rpg-interactions/runtime/runtime-update-validation.ts`
- Moved `src/lib/rpg-interactions/wiki-update-policy.ts` to `src/lib/rpg-interactions/runtime/wiki-update-policy.ts`
- Moved `src/lib/rpg-runtime/narration-adapter.ts` to `src/lib/rpg-interactions/runtime/narration-adapter.ts`
- Moved `src/lib/rpg-runtime/llm-narration-adapter.ts` to `src/lib/rpg-interactions/runtime/llm-narration-adapter.ts`
- Deleted `src/lib/rpg-runtime/narration-prompts.ts`
- Updated `src/lib/rpg-interactions/index.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/state-extractor.ts`
- Updated `src/lib/rpg-runtime/write-policy.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `src/lib/rpg-narration-prompts.test.ts`
- Updated `src/lib/rpg-llm-narration-adapter.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Created `src/lib/rpg-interactions/runtime/` as the runtime interaction contract boundary.
- Moved narration prompt construction, narration parse/validation usage, fixture narration adapter, LLM narration adapter, runtime update prompt construction, runtime update adapter, runtime update validation, target policy, and runtime update protocol marker into that boundary.
- Kept `src/lib/rpg-runtime/` focused on runtime state extraction, orchestration, persistence, write policy, controller, and runtime preview.
- Removed the old `src/lib/rpg-runtime/narration-prompts.ts` wrapper completely; `buildRpgNarrationPrompt()` is now exported from `src/lib/rpg-interactions/runtime`.
- Updated controller, orchestrator, UI, import framework, and focused tests to consume runtime prompt/adapter/validation contracts from `rpg-interactions/runtime`.
- Updated runtime guardrails so the old prompt/adapter paths cannot quietly return.

### Actual differences / baseline notes

- `src/lib/rpg-runtime/state-extractor.ts` remains in runtime because Phase 3 explicitly scoped it as a runtime state extraction file. To keep the output protocol marker in the interaction boundary, it now imports the `rpg-wiki-update` regex factory from `src/lib/rpg-interactions/runtime/runtime-update-protocol.ts`.
- The broad prompt scan still finds `Runtime Capsule` in deterministic lint, merge, extraction-validation, distiller, and test files. These are heading/policy checks rather than runtime prompt wrappers; runtime narration/update prompt text is no longer under `src/lib/rpg-runtime/`.

### Validation

- `rg --encoding utf-8 "narration-prompts|rpg-runtime/llm-narration-adapter|rpg-runtime/narration-adapter" src` returned no results.
- `rg --encoding utf-8 "llmWikiRPG narration runtime|rpg-wiki-update|Runtime Capsule" src/lib` shows runtime narration/update prompt/protocol entries under `src/lib/rpg-interactions/runtime/`; `Runtime Capsule` also appears in deterministic non-prompt helpers and tests as noted above.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-update-validation.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed: 7 files, 114 tests.
- `npm.cmd run typecheck` passed.
- After the runtime barrel changes, the Phase 2 merge bundle was re-run and passed: `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-review.test.ts` passed with 6 files / 111 tests.

### Scope notes

- Did not change narration prompt semantics, runtime update prompt semantics, pending/apply behavior, write policy behavior, or UI behavior.
- Did not move general runtime state, persistence, controller, or write policy responsibilities into `rpg-interactions`.
- Did not run real LLM tests.
- No `git commit` or `git push` was performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 2

### Stage

`RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` Phase 2: Page Merge Interaction Consolidation.

### Changed files

- Added `src/lib/rpg-interactions/merge/page-merge-interaction.ts`
- Added `src/lib/rpg-interactions/merge/index.ts`
- Moved `src/lib/rpg-merge-policy.ts` to `src/lib/rpg-interactions/merge/merge-policy.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Updated `src/lib/rpg-interactions/index.ts`
- Updated `src/lib/ingest.ts`
- Updated `src/lib/page-merge.ts`
- Updated `src/lib/rpg-section-merge.ts`
- Updated `src/lib/rpg-merge-lint.ts`
- Updated `src/lib/rpg-merge-review.ts`
- Updated `src/lib/rpg-merge-policy.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Moved the RPG merge policy and merge system prompt into `src/lib/rpg-interactions/merge/merge-policy.ts`.
- Added `PageMergeInteractionInput` and `pageMergeInteractionSpec` under `src/lib/rpg-interactions/merge/page-merge-interaction.ts`.
- Registered the new interaction kind `page_merge` in the interaction registry with stage `page_merge` and `usesLlm: true`.
- Rewired `src/lib/ingest.ts` so `buildPageMerger()` delegates prompt construction to `pageMergeInteractionSpec.buildPrompt()` and only handles `streamChat()` collection.
- Preserved `src/lib/page-merge.ts` as the deterministic safety boundary for frontmatter union, locked fields, shrink checks, section merge, lint, fallback, and backup.
- Updated merge modules and tests to import the merge policy from `src/lib/rpg-interactions/merge`.
- Strengthened interaction guardrails so the old top-level merge policy path is absent and old imports do not return.

### Validation

- `rg --encoding utf-8 "rpg-merge-policy" src` returned no results.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-review.test.ts` passed: 6 files, 110 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not move page-merge deterministic safety logic into the interaction spec.
- Did not change merge prompt semantics, body shrink thresholds, section merge behavior, lint behavior, fallback behavior, or backup behavior.
- Did not run real LLM tests.
- No `git commit` or `git push` was performed.

## 2026-06-09 - RPG LLM Interaction Consolidation Phase 0-1

### Stage

`RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md` Phase 0 + Phase 1: registry / guardrail setup and source ingest interaction consolidation.

### Changed files

- Added `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-interactions/source-ingest/analysis-interaction.ts`
- Added `src/lib/rpg-interactions/source-ingest/generation-interaction.ts`
- Added `src/lib/rpg-interactions/source-ingest/page-guidance-contract.ts`
- Added `src/lib/rpg-interactions/source-ingest/chunk-analysis-interaction.ts`
- Added `src/lib/rpg-interactions/source-ingest/domain-guidance.ts`
- Added `src/lib/rpg-interactions/source-ingest/index.ts`
- Updated `src/lib/rpg-interactions/index.ts`
- Updated `src/lib/ingest.ts`
- Updated `src/lib/ingest.prompt.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Deleted `src/lib/prompts/rpg-ingest.ts`
- Deleted `src/lib/prompts/rpg-page-guidance.ts`
- Deleted `src/lib/prompts/domain-guidance.ts`
- Deleted old thin wrappers `src/lib/rpg-interactions/source-ingest-analysis-interaction.ts` and `src/lib/rpg-interactions/source-ingest-generation-interaction.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the RPG interaction registry for currently implemented model interactions: source ingest analysis, source ingest generation, control doc canonicalization, narration, and runtime state update.
- Kept future `RpgInteractionKind` values out of the implemented registry and listed them as planned instead of inventing prompt behavior for them.
- Moved the real source ingest Stage 1 analysis prompt into `src/lib/rpg-interactions/source-ingest/analysis-interaction.ts`.
- Moved the real source ingest Stage 2 generation prompt into `src/lib/rpg-interactions/source-ingest/generation-interaction.ts`.
- Moved focused page guidance, minimal generation contract, source ingest target policy guidance, and directory boundary guidance into `src/lib/rpg-interactions/source-ingest/page-guidance-contract.ts`.
- Moved long-source chunk analysis system/user prompt builders into `src/lib/rpg-interactions/source-ingest/chunk-analysis-interaction.ts`.
- Moved domain-specific RPG generation guidance into `src/lib/rpg-interactions/source-ingest/domain-guidance.ts`, because the baseline import scan showed it only served RPG source ingest generation.
- Rewired `src/lib/ingest.ts` to call source-ingest interaction specs and chunk prompt builders from the new directory while keeping ingest orchestration, token budget, chunk split/checkpointing, LLM calls, FILE/REVIEW parsing, and write behavior in place.
- Updated prompt and interaction tests so real source-ingest prompt assertions import from `src/lib/rpg-interactions/source-ingest`.
- Added guardrails that assert implemented registry coverage and confirm the old source-ingest prompt islands are gone after Phase 1.

### Actual differences / baseline notes

- Initial baseline search found existing `sourceIngestAnalysisInteractionSpec` and `sourceIngestGenerationInteractionSpec`, but they were thin wrappers importing real prompt builders from `src/lib/prompts/rpg-ingest.ts`.
- Initial baseline search found long-source chunk prompt builders directly in `src/lib/ingest.ts`.
- The user-provided double-quoted PowerShell `rg` import search is syntactically fragile in this shell; the equivalent single-quoted command showed the only old import result was `src/lib/prompts/rpg-ingest.ts` importing `src/lib/prompts/domain-guidance.ts`.
- `src/lib/rpg-merge-policy.ts` was intentionally not moved in this pass and remains the explicit Phase 2 merge interaction consolidation target.
- `src/lib/prompts/` now contains only `shared-ingest.ts`; the deleted RPG prompt files are not kept as long-lived wrappers.

### Validation

- Acceptance search passed with no results: `rg --encoding utf-8 "buildRpgAnalysisPrompt|buildRpgGenerationPrompt|buildFocusedRpgPageGuidance" src/lib/prompts src/lib/ingest.ts`.
- Acceptance search passed with no results: `rg --encoding utf-8 "You are an RPG wiki extraction analyst|RPG Wiki Generation Contract|RP Runtime Signals JSON" src/lib/prompts src/lib/ingest.ts`.
- Acceptance search passed with no results: `rg --encoding utf-8 '@/lib/prompts/rpg-ingest|@/lib/prompts/rpg-page-guidance|prompts/domain-guidance' src`.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts` passed: 2 files, 81 tests.
- `npx.cmd vitest run src/lib/ingest.scenarios.test.ts src/lib/rpg-ingest-signals.test.ts` passed: 2 files, 28 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change source ingest prompt semantics, output language rules, Source Profile category selection logic, FILE/REVIEW protocol, autoIngest write behavior, parser behavior, or merge policy behavior.
- Did not move `src/lib/rpg-merge-policy.ts`; it remains the next known old RPG LLM prompt location for Phase 2.
- Did not add legacy/default compatibility, migration, fallback, old-path preservation behavior, real LLM calls, `git commit`, or `git push`.

## 2026-06-09 - RPG LLM Interaction Consolidation Plan

### Stage

架构评估与计划：评估 RPG prompt / LLM interaction 分散问题，并制定迁移到 `src/lib/rpg-interactions/` 的阶段方案。

### Changed files

- `docs/RPG_LLM_INTERACTION_CONSOLIDATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Confirmed that the current prompt sprawl is a real blocker for continued llmWikiRPG development, because source ingest, chunk analysis, page merge, narration, runtime update, control doc canonicalization, and future context/derivation/outline stages all depend on model-facing contracts.
- Recorded that `src/lib/rpg-interactions/` already has the right foundation through `RpgInteractionSpec`, narration interaction, runtime update interaction, runtime target policy, and validation.
- Recorded the main remaining prompt islands: `src/lib/prompts/rpg-ingest.ts`, `src/lib/prompts/rpg-page-guidance.ts`, RPG chunk prompts in `src/lib/ingest.ts`, and merge prompt policy in `src/lib/rpg-merge-policy.ts`.
- Added a phased consolidation plan covering registry/guardrails, source ingest prompt migration, page merge interaction migration, runtime wrapper cleanup, import mode contract alignment, and old prompt island removal.
- Recommended running this consolidation before adding more model-facing features such as Context Compiler v1, relationship derivation integration, or outline impact detection.

### Scope notes

- Documentation-only planning pass.
- Did not move or edit source code.
- Did not change runtime, ingest, merge, import, UI, or write-policy behavior.
- Did not add legacy/default compatibility, migration, fallback, or old-path preservation behavior.
- No `git commit` or `git push` was performed.

### Validation

- No tests were run because this pass only added and updated documentation.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 5-6 Partial

### Stage

冗余清理 Phase 5-6：处理悬空 RPG 原型模块，并清理历史 opencode 自动化残留。Phase 5 已完成；Phase 6 的 `.opencode/` 目录删除因审批服务 503 暂未完成。

### Changed files

- Deleted `src/lib/rpg-merge-evaluation.ts`
- Deleted `src/lib/rpg-merge-evaluation.test.ts`
- Deleted `opencode.json`
- Deleted `scripts/run-opencode-stages.ps1`
- `scripts/run_rpg_v02_tasks.py`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Removed `rpg-merge-evaluation` because the reference scan showed it was a deterministic evaluation helper only used by its own focused test, not a product runtime/review service.
- Kept `rpg-merge-review` and `rpg-post-ingest-distiller` because docs and code identify them as review-controlled RPG merge/distill proposal services. They remain source-only services with focused tests and no UI/runtime wiring added in this phase.
- Kept `rpg-relationship-tension-deriver` because docs and code identify relationship/tension derivation as a later RPG runtime/import capability. It remains proposal/review-only with focused tests and no ordinary ingest/runtime/UI wiring added in this phase.
- Removed the historical opencode root config and staged opencode PowerShell runner.
- Kept `scripts/run_rpg_v02_tasks.py` as a Codex-capable v0.2 task runner, removed the `opencode` preset, and updated the generated task prompt so it follows the current RPG-only project boundary.
- Confirmed `.codex/stages/` contains stage prompts `00` through `12` and preserved `scripts/run-codex-stages.ps1` as the current default stage runner.

### Scope notes

- The retained RPG services are not legacy llm_wiki compatibility code and were not connected to product entrypoints in this cleanup pass.
- No RPG-only legacy directory guards, `extractRpgStateUpdates()`, chunk v2 vector code, runtime update interaction adapter path, `.codex/stages/`, or `scripts/run-codex-stages.ps1` were removed.
- `.opencode/` was verified as historical prompts plus local dependency remnants, but recursive deletion was blocked twice by the approval service returning 503 after the path-checked delete command was submitted. No workaround deletion was attempted after rejection, so `.opencode/` remains pending deletion.
- The working tree already contained many unrelated modified and untracked files before this phase; those were not reverted.
- No `git commit` or `git push` was performed.

### Validation

- `rg --encoding utf-8 "rpg-merge-evaluation|evaluateRpgMergeSample|RpgMergeRegressionSample" src` returned no results after deletion.
- `rg --encoding utf-8 "opencode" scripts/run_rpg_v02_tasks.py` returned no results after removing the opencode preset.
- `Test-Path opencode.json` returned `False`.
- `Test-Path scripts/run-opencode-stages.ps1` returned `False`.
- `Test-Path .opencode` returned `True` because directory deletion is pending approval/retry after the 503 rejection.
- `npm.cmd run typecheck` passed.
- `python -m py_compile scripts/run_rpg_v02_tasks.py` passed.
- `npx.cmd vitest run src/lib/rpg-merge-review.test.ts src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-relationship-tension-deriver.test.ts` passed: 3 files, 22 tests.
- `npx.cmd vitest run src/lib/rpg-merge-review.test.ts src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-relationship-tension-deriver.test.ts src/i18n/i18n-parity.test.ts` passed: 4 files, 27 tests.
- `npm.cmd run test:mocks` was attempted and failed: 118 files ran, 116 passed, 2 failed, with 1515 passed tests and 11 failed tests. The failures are in `src/lib/ingest-source-path-collision.test.ts` legacy project fixtures now rejected by RPG-only mode, and `src/lib/rpg-state-extractor.test.ts` expectations for base `wiki/relationships/*.md` runtime updates while current policy rejects that path.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 3-4

### Stage

冗余清理 Phase 3-4：移除旧 vector v1 per-page migration/API/UI，并移除 runtime controller 的 `legacy_narration_block` fallback。

### Changed files

- `src/lib/embedding.ts`
- `src/lib/embedding.test.ts`
- `src/components/settings/sections/embedding-section.tsx`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/vectorstore.rs`
- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-runtime/runtime-persistence.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `src/components/rpg/rpg-runtime-panel.tsx`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`

### Summary

- Removed frontend legacy vector migration helpers and invokes for `vector_legacy_row_count` and `vector_drop_legacy`.
- Removed the Embedding settings legacy index prompt, legacy drop action/status, and matching English/Chinese i18n keys.
- Removed Tauri registrations and Rust command implementations for the old vector v1 per-page API and legacy row count/drop migration commands.
- Preserved the chunk v2 vector commands and tests: `vector_upsert_chunks`, `vector_search_chunks`, `vector_delete_page`, and `vector_count_chunks`.
- Removed the `legacy_narration_block` runtime fallback. `RunRpgRuntimeTurnFlowInput.updateInteractionAdapter` is now required, and `runRpgRuntimeTurnFlow()` always uses the dedicated runtime update interaction path.
- Runtime turn journal proposal source is now fixed to `interaction`.
- Kept `extractRpgStateUpdates()` because `runtimeUpdateInteractionSpec.parseOutput()` still uses it as the fenced interaction output parser.

### Scope notes

- Preserved RPG-only legacy directory guards such as `entities` / `concepts` filtering, rejection, and hiding logic.
- Did not delete RPG prototype modules such as `rpg-merge-review`, `rpg-post-ingest-distiller`, or `rpg-relationship-tension-deriver`.
- Did not change pending review/apply semantics: controller still creates proposed/pending updates only and does not accept, reject, apply, or write wiki files.
- The working tree already contained many unrelated modified and untracked files before this phase; those were not reverted.
- No `git commit` or `git push` was performed.

### Validation

- `rg --encoding utf-8 "vector_legacy_row_count|vector_drop_legacy|getLegacyVectorRowCount|dropLegacyVectorTable" src/lib/embedding.ts src/lib/embedding.test.ts` returned no results.
- `rg --encoding utf-8 "legacyPromptTitle|legacyPromptBody|dropLegacy|Legacy per-page index|旧版.*索引" src` returned no results.
- `rg --encoding utf-8 "vector_upsert\\b|vector_search\\b|vector_delete\\b|vector_count\\b|vector_legacy_row_count|vector_drop_legacy" src-tauri/src/lib.rs` returned no results.
- `rg --encoding utf-8 "legacy_narration_block|updateInteractionAdapter\\?" src/lib/rpg-runtime src/lib/rpg-interactions src/components/rpg` returned no results.
- `extractRpgStateUpdates()` remains intentionally referenced by `src/lib/rpg-interactions/runtime-update-interaction.ts` as the interaction output parser.
- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/embedding.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-interactions.test.ts src/i18n/i18n-parity.test.ts` passed: 6 files, 146 tests.
- `cargo check` was attempted in `src-tauri` and failed before crate checking because `lance-encoding v4.0.0` could not find `protoc`. This is the known local protobuf compiler prerequisite, not a cleanup compile error reached by Cargo.

## 2026-06-09 - llmWikiRPG Redundancy Cleanup Phase 1-2

### Stage

冗余清理 Phase 1-2：删除入口不可达的旧 UI / 工具代码，并移除旧 `entities/concepts` dedup 后台链路。

### Changed files

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/stores/wiki-store.ts`
- `src/lib/reset-project-state.ts`
- `src/components/settings/sections/maintenance-section.tsx`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src/test-helpers/scenarios/types.ts`
- `src/test-helpers/scenarios/materialize.ts`
- Deleted `src/components/layout/chat-bar.tsx`
- Deleted `src/components/ui/resizable.tsx`
- Deleted `src/components/ui/separator.tsx`
- Deleted `src/lib/source-delete-decision.ts`
- Deleted `src/lib/source-delete-decision.test.ts`
- Deleted `src/lib/enrich-wikilinks.ts`
- Deleted `src/lib/enrich-wikilinks.test.ts`
- Deleted `src/lib/enrich-wikilinks.scenarios.test.ts`
- Deleted `src/lib/enrich-wikilinks.real-llm.test.ts`
- Deleted `src/test-helpers/scenarios/enrich-scenarios.ts`
- Deleted `src/lib/dedup.ts`
- Deleted `src/lib/dedup.test.ts`
- Deleted `src/lib/dedup-runner.ts`
- Deleted `src/lib/dedup-queue.ts`
- Deleted `src/lib/dedup-queue.test.ts`
- Deleted `src/lib/dedup-storage.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Removed the old folded chat bar and its stale Zustand state (`chatExpanded`, `setChatExpanded`, initial value, and setter).
- Removed unused resizable/separator UI wrappers and uninstalled `react-resizable-panels`; `@base-ui/react` was preserved.
- Removed the `source-delete-decision` test island; product deletion logic remains in `src/lib/source-lifecycle.ts`.
- Removed the `enrich-wikilinks` island, its tests, and the scenario helper that was only used by those tests.
- Removed the old `wiki/entities` / `wiki/concepts` duplicate cleanup modules, queue, storage helper, runner, and tests.
- Removed dedup queue restore from project open and dedup queue pause/load handling from project reset.
- Preserved ingest queue restore/pause, graph cache reset, project file sync stop, and scheduled import stop/reset behavior.
- Cleaned Maintenance UI/i18n copy to RPG-only wording and removed `settings.sections.maintenance.dedup`.
- Removed enrich-only test-helper type/materialization leftovers so cleanup confirmation searches do not retain dead test references.

### Scope notes

- Did not remove RPG-only legacy guards in `src/lib/rpg-runtime/context-compiler.ts`, `src/lib/rpg-runtime/turn-model.ts`, `src/lib/rpg-ingest-signals.ts`, `src/components/layout/knowledge-tree.tsx`, or `src/lib/ingest.ts`.
- Did not remove the old narration-block runtime fallback in Phase 1-2; Phase 4 later removed it.
- Did not change vector v1 migration or settings UI in Phase 1-2; Phase 3 later removed it.
- Did not delete RPG prototype modules such as `rpg-merge-review`, `rpg-post-ingest-distiller`, or `rpg-relationship-tension-deriver`.
- `src/lib/changelog.ts` still contains historical changelog text mentioning duplicate entities / concepts; this was intentionally retained as non-product history per the cleanup request.
- The working tree already contained many unrelated modified and untracked files before this phase; those were not reverted.
- No `git commit` or `git push` was performed.

### Validation

- `npm.cmd uninstall react-resizable-panels` passed and removed the dependency from `package.json` and `package-lock.json`.
- `rg --encoding utf-8 "chatExpanded|setChatExpanded|ChatBar|chat-bar" src` returned no results.
- `rg --encoding utf-8 "react-resizable-panels|ResizablePanel|ResizableHandle|components/ui/separator" src package.json package-lock.json` returned no results.
- `rg --encoding utf-8 "source-delete-decision|decidePageFate" src` returned no results.
- `rg --encoding utf-8 "enrich-wikilinks|enrichWithWikilinks|enrich-scenarios" src` returned no results.
- `rg --encoding utf-8 "dedup-queue|dedup pauseQueue|Dedup Queue" src/App.tsx src/lib/reset-project-state.ts` returned no results.
- `rg --encoding utf-8 "dedup-runner|dedup-storage|dedup-queue|extractEntitySummary|detectDuplicateGroups|mergeDuplicateGroup|runDuplicateDetection|enqueueMerge|loadNotDuplicates|addNotDuplicate" src` returned no results.
- `rg --encoding utf-8 "settings.sections.maintenance.dedup|Detect duplicate entities|duplicate entities / concepts|notDuplicates|queueDescription" src` only returned the allowed historical `src/lib/changelog.ts` entry.
- `rg --encoding utf-8 "react-resizable-panels" package.json package-lock.json` returned no results.
- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/source-lifecycle-delete.test.ts src/lib/wiki-page-delete.test.ts src/lib/project-mode.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/i18n/i18n-parity.test.ts` passed: 6 test files, 45 tests.

## 2026-06-09 - RPG Import Modularization Stage H Unified UI Entry

### Stage

RPG Import Modularization Plan 阶段 H：统一 UI 入口。

### Changed files

- `src/lib/rpg-import/ui-import-options.ts`
- `src/lib/rpg-import/ui-import-options.test.ts`
- `src/components/sources/rpg-import-dialog.tsx`
- `src/components/sources/sources-view.tsx`
- `src/lib/source-lifecycle.ts`
- `src/i18n/zh.json`
- `src/i18n/en.json`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a pure UI mapping layer for RPG import semantics.
- The default UI semantic remains ordinary source material and maps to `source_ingest`.
- The UI option list exposes only the Stage E Control Doc slots currently implemented by the framework: `main_outline`, `outline_progress`, `rules_core`, and `style_narration`.
- The UI option list exposes only the Stage F Campaign Setup slots currently implemented by the framework: `player_main`, `current_scene`, `events_prologue`, `main_quest`, `quest`, and `player_relationship`.
- The file import UI intentionally does not expose `runtime_update_apply`; runtime apply remains owned by Play/Pending UI.
- Added mapping for optional quest and relationship names into `options.questName` and `options.relationshipName`.
- Added explicit current-scene bootstrap mapping into `options.explicitBootstrap`; unchecked current-scene imports do not pass bootstrap or manual-confirm options.
- Added explicit control document overwrite mapping into `options.manualConfirm`; unchecked control document imports keep the framework's review/manual-confirm skip behavior for meaningful existing files.
- Added the unified `RpgImportDialog` for Sources.
- Ordinary source material in the dialog supports multi-file selection and continues to call the existing source lifecycle import path.
- Control Doc and Campaign Setup dialog modes are single-file v0 flows and call `runRpgImport({ mode, projectPath, sourcePath, sourceFileName, targetSlot, options })`.
- The dialog displays grouped `warnings`, `reviewItems`, `writtenPaths`, and `skipped` results after each import.
- Dedicated import review items are converted to ReviewStore `confirm` items with open-related-page and skip actions, making them visible in the Review panel.
- Updated `SourcesView` so the primary import button opens the unified "Import to RPG Project" dialog.
- Preserved the ordinary source folder import button.
- Preserved the per-source-tree-row "Ingest" button as ordinary source ingest queue behavior.
- Added `importSourceFilesWithReport()` so the dialog can show skipped ordinary source paths while preserving the existing `importSourceFiles()` return shape for existing callers.
- Added matching Chinese and English i18n strings under `sources.rpgImport`.

### Actual code / plan differences recorded

- Ordinary source import still reports copied `raw/sources` paths as `writtenPaths`, because the existing ordinary import path copies files and queues ingest rather than synchronously returning generated wiki page paths.
- The dialog maps Control Doc overwrite confirmation to `manualConfirm` only. It does not also set `allowOverwrite`, because Stage E treats either flag as sufficient and one explicit flag keeps the UI contract narrower.
- `current_scene` confirmation maps to `explicitBootstrap` only. It does not set `manualConfirm`, so the current-scene bootstrap checkbox remains semantically distinct from control document overwrite.
- Browser visual verification could not be completed in this environment: Vite foreground startup succeeded and reported `http://127.0.0.1:1420/`, but the Browser runtime exposed no available `iab` instance, and non-sandbox background server startup was not approved.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/ui-import-options.test.ts` passed: 1 test file, 6 tests.
- `npx.cmd vitest run src/lib/rpg-import/ui-import-options.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/i18n/i18n-parity.test.ts` passed: 4 test files, 37 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run dev -- --host 127.0.0.1` reached Vite ready state in foreground and reported `http://127.0.0.1:1420/`.

### Scope notes

- Did not change Runtime Update Apply / Play panel / Pending Review behavior.
- Did not expose `runtime_update_apply` as a file import option.
- Did not change Control Doc Import or Campaign Setup Import write semantics.
- Did not change ordinary per-row source ingest behavior.
- Did not add legacy/default compatibility, migration, fallback, or old-path preservation behavior.
- Did not call a real LLM.
- Browser screenshot/click verification was not completed because no Browser instance was available in this session.
- No `git commit` or `git push` was performed.

## 2026-06-09 - RPG Import Modularization Stage G Runtime Update Apply Framework Integration

### Stage

RPG Import Modularization Plan 阶段 G：Runtime Update Apply 接入统一框架。

### Changed files

- `src/lib/rpg-import/runtime-update-apply.ts`
- `src/lib/rpg-import/registry.ts`
- `src/lib/rpg-import/index.ts`
- `src/lib/rpg-import/runtime-update-apply.test.ts`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Implemented `runRuntimeUpdateApplyImport()` as the `runtime_update_apply` mode runner in the RPG import framework.
- Registered `runtime_update_apply` alongside `source_ingest`, `control_doc_import`, and `campaign_setup_import`, so `runRpgImport()` can resolve it through the existing registry/pipeline.
- Added `RuntimeUpdateApplyResult extends RpgImportResult` with `operation`, `proposedUpdates`, `pendingUpdates`, `runtimeUpdateValidation`, and optional `applyResult`.
- Added the safe staging operation `options.operation: "stage_pending"`; omitted operation also defaults to `stage_pending`.
- `stage_pending` can parse runtime update fenced output from `sourceText` using `runtimeUpdateInteractionSpec.parseOutput(sourceText, { turnRecord })`.
- `stage_pending` can also stage direct `options.proposedUpdates` and parse `options.turnRecord.generatedNarrative` when no separate `sourceText` is supplied.
- Direct `ProposedWikiUpdate[]` inputs are checked with the existing `validateRpgRuntimeUpdateTarget()` target policy before content validation, preventing direct callers from bypassing runtime path restrictions.
- Accepted proposals are passed to the existing `validateRpgRuntimeUpdateProposals()` and then staged with `createPendingRpgUpdates()`.
- Validation-rejected updates are reported in `runtimeUpdateValidation`, `warnings`, `reviewItems`, and `skipped`; they do not enter `pendingUpdates`.
- Added the apply operation `options.operation: "apply_pending"` with required `options.pendingUpdates`.
- `apply_pending` delegates to the existing `applyRpgPendingUpdates()` and derives `writtenPaths` from `applyResult.appliedUpdates`, so only actually applied target paths are reported as written.
- Preserved existing write semantics through the apply boundary: `current-scene` overwrite, `events` append/create, fixed player slots / quests / `outlines/progress.md` / runtime overlays merge.
- Preserved runtime target boundaries: relationship deltas can merge only under `wiki/relationships/runtime/*.md`, plot-arc runtime changes can merge only under `wiki/plot-arcs/runtime/*.md`, and base/stable/source/manual-control paths remain rejected or skipped.

### Actual code / plan differences recorded

- The adapter adds an explicit target-policy precheck for direct `options.proposedUpdates` because those objects do not pass through the fenced block parser in `extractRpgStateUpdates()`.
- `options.operation` defaults to `stage_pending` when omitted, because staging is read-only and avoids accidental writes; `apply_pending` must still be explicitly requested.
- The implementation does not add a new persistence layer for pending updates. It returns pending/review data to the caller and reuses the existing pending/apply APIs.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts` passed: 1 test file, 7 tests.
- `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime.test.ts` passed: 6 test files, 100 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage H UI.
- Did not change `runRpgRuntimeTurnFlow()`, runtime controller behavior, narration behavior, or the existing "do not automatically accept/reject/apply pending updates" behavior.
- Did not remove the old narration-block transition path during Stage G; Redundancy Cleanup Phase 4 later removed it.
- Did not change ordinary `source_ingest`, `control_doc_import`, or `campaign_setup_import` semantics.
- Did not add legacy/default compatibility, migration, fallback, or old-path preservation behavior.
- Did not automatically accept, reject, or apply pending updates during `stage_pending`.
- No `git commit` or `git push` was performed.

## 2026-06-08 - RPG Import Modularization Stage F Campaign Setup Import v0

### Stage

RPG Import Modularization Plan 阶段 F：Campaign Setup Import v0。

### Changed files

- `src/lib/rpg-import/campaign-setup-import.ts`
- `src/lib/rpg-import/registry.ts`
- `src/lib/rpg-import/index.ts`
- `src/lib/rpg-import/campaign-setup-import.test.ts`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Implemented `runCampaignSetupImport()` as the first `campaign_setup_import` mode runner in the RPG import framework.
- Registered `campaign_setup_import` alongside `source_ingest` and `control_doc_import`, so `runRpgImport({ mode: "campaign_setup_import", ... })` resolves through the existing registry/pipeline.
- Required `targetSlot`, rejected unsupported slots before writing anything, and required either `sourceText` or `sourcePath`.
- Gave `sourceText` precedence over `sourcePath` when both are supplied, while still recording `source_path` and `source_file_name`.
- Added Stage F target slots: `player_main`, `current_scene`, `events_prologue`, `main_quest`, `quest`, and `player_relationship`.
- Enforced fixed required-slot paths: `player_main -> wiki/player/player.md` and `current_scene -> wiki/current-scene/scene_state.md`.
- Enforced optional scoped paths: `events_prologue -> wiki/events/prologue.md`, `main_quest -> wiki/quests/main.md`, `quest -> wiki/quests/<safe-name>.md`, and `player_relationship -> wiki/relationships/player-<safe-name>.md`.
- Wrote raw source provenance to `wiki/sources/imports/<safe-source-name>--campaign_setup--<slot>.md`.
- Wrote canonical campaign setup documents with frontmatter metadata for import mode, slot id, source filename/path/anchor/import path, timestamp, write policy, review policy, canonicalization policy, source origin, source-text priority, campaign bootstrap marker, and explicit bootstrap marker.
- Added explicit current-scene bootstrap semantics: `current_scene` is skipped unless `options.explicitBootstrap === true` or `options.manualConfirm === true`; the raw source anchor is still saved for traceability.
- Kept `player_main` fixed to `wiki/player/player.md`; no arbitrary `wiki/player/*.md` file can be generated by Stage F.
- Added warnings/review items when source text appears to contain player abilities, skills, limits, costs, or availability so callers can review `wiki/player/abilities.md`; Stage F does not route those details to `wiki/rules/`.
- Filtered non-happened guidance / future pressure from canonical target files and especially from `wiki/events/prologue.md`; raw anchors preserve the full original source text.
- Made `events_prologue` skip the event target if no already-happened prologue facts remain after filtering.
- Added merge/append behavior for meaningful existing setup files within Stage F scope: fixed player/quest/relationship slots merge a new setup section, while prologue appends already-happened setup facts.

### Actual code / plan differences recorded

- Stage F v0 implemented the optional `events_prologue`, `main_quest` / `quest`, and `player_relationship` slots because they are fixed or safe-name constrained and covered by focused tests.
- Stage F did not implement the full fixed player slot set (`player_abilities`, `player_inventory`, `player_goals`, `player_known_information`). Ability-like source content currently returns warnings/review items for the next step rather than writing `wiki/player/abilities.md`.
- The implementation uses deterministic local canonicalization only. It does not add or call a `campaign_setup_generation` interaction spec or any LLM.
- Future pressure is not auto-routed to `wiki/plot-arcs/`; Stage F only prevents it from polluting current-scene/events/quest/player/relationship targets and reports review guidance.
- `current_scene` uses the explicit bootstrap/manual-confirm boundary requested in this stage and does not share Runtime Update Apply's completed-turn pending/apply path.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 5 test files, 92 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage G or H.
- Did not expose Runtime Update Apply through the import framework.
- Did not change Runtime Update Apply write policy, pending staging, apply behavior, context compiler behavior, or runtime controller behavior.
- Did not modify ordinary Source Ingest behavior.
- Did not change UI.
- Did not call a real LLM.
- Did not add legacy/default fallback, migration, or compatibility paths.
- No `git commit` or `git push` was performed.

## 2026-06-08 - RPG Import Modularization Stage E Control Doc Import v0

### Stage

RPG Import Modularization Plan 阶段 E：Control Doc Import v0。

### Changed files

- `src/lib/rpg-import/control-doc-import.ts`
- `src/lib/rpg-import/registry.ts`
- `src/lib/rpg-import/index.ts`
- `src/lib/rpg-import/control-doc-import.test.ts`
- `src/lib/rpg-interactions/control-doc-canonicalization-interaction.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/rpg-interactions.test.ts`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Implemented `runControlDocImport()` as the first `control_doc_import` mode runner in the RPG import framework.
- Registered `control_doc_import` alongside `source_ingest`, so `runRpgImport({ mode: "control_doc_import", ... })` resolves through the existing registry/pipeline.
- Added the first four Stage E target slots only: `main_outline`, `outline_progress`, `rules_core`, and `style_narration`.
- Mapped those slots to fixed schema paths: `wiki/outlines/main.md`, `wiki/outlines/progress.md`, `wiki/rules/core.md`, and `wiki/style/narration.md`.
- Required `targetSlot`, rejected unsupported slots before writing anything, and required either `sourceText` or `sourcePath`.
- Gave `sourceText` precedence over `sourcePath` when both are supplied, while still recording `source_path` and `source_file_name`.
- Wrote raw source provenance to `wiki/sources/imports/<safe-source-name>--<slot>.md`.
- Wrote canonical control documents with frontmatter metadata for import mode, slot id, source filename/path/anchor/import path, timestamp, write policy, review policy, canonicalization policy, source origin, and source-text priority.
- Preserved the complete normalized source text in the canonical control document and in the raw source anchor file, protecting hard gates, `{{setvar::...}}`, forbidden terms, and explicit user control blocks from lossy extraction.
- Added manual-confirm/review semantics: meaningful existing control files are skipped unless `options.manualConfirm` or `options.allowOverwrite` is explicitly set; raw anchor files are still saved for traceability.
- Added `controlDocCanonicalizationInteractionSpec` as the interaction-layer prompt/parse contract for later model-backed canonicalization without connecting Stage E to a real LLM.

### Actual code / plan differences recorded

- `outline_progress` is still defined in `RPG_SCHEMA_SLOTS` as owner `runtime`, import policy `runtime_apply`, write policy `merge`.
- Stage E nevertheless permits `control_doc_import` to initialize `outline_progress` with empty/opening progress, because the stage specifically requests that slot. This does not change Runtime Update Apply, pending review, or runtime merge behavior.
- The implementation chose the separate raw source anchor file strategy under `wiki/sources/imports/` instead of embedding the whole raw source only inside the target file. Target files keep `source_import_path` and `source_anchor` pointers.
- Canonicalization is deterministic/local in this stage. It does not call the new interaction spec or any LLM.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-import/control-doc-import.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 4 test files, 80 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage F, G, or H.
- Did not implement campaign setup import.
- Did not expose Runtime Update Apply through the import framework.
- Did not change Runtime Update Apply write policy, pending staging, apply behavior, context compiler behavior, or UI.
- Did not modify ordinary Source Ingest behavior.
- Did not call a real LLM.
- Did not write `wiki/current-scene/`.
- Did not write `wiki/events/` or convert future outline material into history.
- No `git commit` or `git push` was performed.

## 2026-06-08 - RPG Import Modularization Stage D3.5 Redundancy Audit / Cleanup Gate

### Stage

RPG Import Modularization Plan 阶段 D3.5：Redundancy Audit / Cleanup Gate。

### Changed files

- `docs/RPG_IMPORT_REDUNDANCY_AUDIT_D3_5.md`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`

### Summary

- Created the D3.5 audit record with `keep` / `merge` / `delete` / `defer` classifications.
- Confirmed `src/lib/rpg-import/` is a keep item: the framework skeleton currently registers only `source_ingest`, wraps `autoIngest()`, and remains the intended Stage E/F/G expansion point.
- Confirmed ordinary Source Ingest still runs through `autoIngest()` / existing prompt wrapper exports; D3.5 did not change writer, queue, UI, or LLM interaction flow.
- Removed unreachable concrete Source Ingest forbidden target entries for the six runtime overlay directories because `wiki/*/runtime/**` already matches them before those entries can be reached.
- Removed a duplicate hand-written forbidden target sentence from `buildChunkAnalysisSystemPrompt()` and kept `buildSourceIngestTargetPolicyGuidance()` as the prompt's authority for Source Ingest allowed/forbidden targets.
- Updated the focused prompt test to assert `## Source Ingest Target Policy`, `wiki/*/runtime/**`, and `wiki/current-scene/**` instead of the removed duplicate sentence.
- Updated the modularization plan to mark only D3.5 completed and to record the audit/cleanup results.

### Evidence

- `getRpgSourceIngestForbiddenTarget()` uses `Array.find()` over `RPG_SOURCE_INGEST_TARGET_POLICY.forbiddenTargets`.
- `sourceIngestPathPatternMatches()` matches `wiki/*/runtime/**` against any `wiki/<category>/runtime/...` path, so later concrete runtime forbidden entries were unreachable.
- After deletion, `rg "character runtime overlays record|location runtime overlays record|faction runtime overlays record|item runtime overlays record|relationship runtime overlays record|plot-arc runtime overlays record" src/lib` found no remaining source references.
- The runtime overlay recommendation behavior remains covered by `src/lib/rpg-wiki-schema.test.ts` through `getRpgSourceIngestForbiddenTarget("wiki/characters/runtime/rin.md")` and `getRpgSourceIngestForbiddenTarget("wiki/locations/runtime/harbor.md")`.

### Defer notes

- Did not remove `runRpgRuntimeTurnFlow()`'s old narration-block transition fallback during the D3.5 audit. Redundancy Cleanup Phase 4 later removed it and updated controller/journal tests to use explicit interaction adapters.
- Did not collapse all runtime prompt forbidden examples into `wiki-update-policy.ts`; this has drift risk but would touch Stage G behavior and prompt contracts.
- Did not extract common fixed-slot test fixtures from runtime tests; some tests intentionally omit fixed slots to assert missing-slot warnings.
- Did not delete legacy/default rejection tests or helpers; current tests mostly verify those paths are rejected or not used by new llmWikiRPG projects.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts` passed: 3 test files, 98 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage E, F, G, or H.
- Did not add `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` framework behavior.
- Did not change UI.
- Did not call a real LLM.
- Did not perform destructive cleanup.
- No `git commit` or `git push` was performed.

## 2026-06-08 - RPG Import Modularization Stage D3 Overlay Resolver / Context Read Contract

### Stage

RPG Import Modularization Plan 阶段 D3：Overlay Resolver / Context Read Contract。

### Changed files

- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-runtime.test.ts`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Extended Context Compiler overlay grouping so `readRelevantOverlayGroups()` accepts `relationships` and `plot-arcs` in addition to `characters`, `locations`, `factions`, and `items`.
- Switched relationship context from independent `rankedPages()` output to `relationshipGroups.map(formatGroupEntry)`, preserving base-before-overlay ordering inside each group.
- Switched plot arc context from independent `rankedPages()` output to `plotArcGroups.map(formatGroupEntry)`, preserving base-before-overlay ordering inside each group.
- Updated reference marking so matched relationship and plot arc overlay groups add both base paths and runtime overlay paths to `brief.references`.
- Kept overlay resolver read-only: it only reads, groups, ranks, and formats context pages.
- Kept Runtime Update Apply write boundaries unchanged; runtime relationship and plot-arc changes still belong under `relationships/runtime/*.md` and `plot-arcs/runtime/*.md` through pending/review/apply.
- Added focused coverage proving same-slug relationship and plot arc base/runtime pages enter the brief together, unrelated base/runtime pages are filtered by action relevance, references include both layers, and preview/context compile does not modify wiki files.

### Actual code / plan differences recorded

- Before D3, `relationships` and `plot-arcs` were already read recursively by `readMarkdownDir()`, so their `runtime/*.md` files could appear in context.
- The mismatch was that those runtime files were treated as ordinary independent markdown pages by `rankedPages()` rather than grouped with their stable base pages using `overlayBaseSlug()` and `compareBaseBeforeOverlay()`.
- Existing `runtimeSectionPatternsFor()` already had relationship and plot-arc section patterns, so D3 reused the existing content selection behavior instead of adding new prompt/schema surfaces.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 2 test files, 30 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage E, F, or G.
- Did not add `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` import framework behavior.
- Did not change Runtime Update Apply write policy, pending staging, review, or apply behavior.
- Did not change UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-08 - RPG Import Modularization Stage D2.5 Mode-scoped Prompt / Schema Contract Cleanup

### Stage

RPG Import Modularization Plan 阶段 D2.5：Mode-scoped Prompt / Schema Contract Cleanup。

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/rpg-ingest-signals.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-extraction-validation.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-ingest-signals.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/lib/rpg-extraction-validation.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RPG_SOURCE_INGEST_TARGET_POLICY` as the code-readable D2.5 target policy for ordinary Source Ingest.
- Added helper APIs for Source Ingest target decisions: `getRpgSourceIngestTargetPolicy()`, `getRpgSourceIngestForbiddenTarget()`, and `isRpgSourceIngestAllowedTarget()`.
- Limited ordinary Source Ingest write targets to source/base directories: `sources`, `world`, `characters`, fixed `player` slots, `locations`, `factions`, `items`, `plot-arcs`, `events`, `relationships`, plus structural `index.md`, `overview.md`, and `log.md`.
- Marked these as forbidden or review-only for ordinary Source Ingest: `rules`, `style`, `memory`, `outlines`, `current-scene`, any `wiki/*/runtime/` overlay, and `quests`.
- Reworked `buildMinimalRpgGenerationContract()` and `buildRpgDirectoryBoundaryGuidance()` so Source Ingest sees other-mode paths as boundaries/review targets, not writable contracts.
- Updated Stage 1 RPG analysis guidance to recommend `control_doc_import` for control documents, `campaign_setup_import` for opening scene / player bootstrap material, and `runtime_update_apply` for completed-turn or runtime overlay writeback material.
- Updated long-source chunk prompt guidance so `targetPath` examples and instructions only point at ordinary Source Ingest targets and explicitly forbid other-mode target paths.
- Updated structured long-source signal normalization to clear forbidden/unsupported Source Ingest target paths and keep those signals review-only before they can influence Stage 2 focused category selection.
- Updated ordinary ingest writer behavior so forbidden/unsupported Source Ingest FILE blocks are skipped with warnings and review items instead of being written.
- Updated extraction validation with equivalent source-ingest boundary review items for reusable validation paths.

### Actual code / plan differences recorded

- Before this stage, Stage 1 already excluded `quests`, `rules`, `style`, and `current-scene` from `needed_categories`.
- Before this stage, Stage 2 focused guidance already avoided expanding those directory contracts from `needed_categories`.
- The remaining mismatch was that the minimal generation contract, directory-boundary renderer, long-source signal prompt, structured signal propagation, writer/review text, and writer acceptance path still exposed or tolerated other-mode targets.
- D2.5 therefore centralized the ordinary Source Ingest target policy and reused it from prompt, signal normalization, validation, and writer checks instead of implementing new import modes.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 6 test files, 142 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage D3 overlay resolver / context read contract.
- Did not implement `control_doc_import`.
- Did not implement `campaign_setup_import`.
- Did not integrate `runtime_update_apply` into the import framework.
- Did not implement E/F/G complete import modes.
- Did not change Runtime Update Apply D2 prompt/validator behavior.
- Did not change UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage D2 Runtime Cross-directory Sync Contract

### Stage

RPG Import Modularization Plan 阶段 D2：Runtime Cross-directory Sync Contract。

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-interactions/wiki-update-policy.ts`
- `src/lib/rpg-interactions/runtime-update-interaction.ts`
- `src/lib/rpg-interactions/runtime-update-validation.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/rpg-interactions.test.ts`
- `src/lib/rpg-runtime-update-validation.test.ts`
- `src/lib/rpg-write-policy.test.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RPG_RUNTIME_CROSS_DIRECTORY_SYNC_GUIDANCE` and `getRpgRuntimeCrossDirectorySyncGuidance()` as code-readable D2 sync metadata.
- Documented current-scene as an overwrite-only latest-moment snapshot and required persistent state visible there to be paired with matching runtime overlay or dynamic directory proposal.
- Split player inventory and item runtime semantics: player holdings/quantity/equipment/consumption belong in `wiki/player/inventory.md`, while object-level state belongs in `wiki/items/runtime/*.md`.
- Tightened runtime target policy to fixed player slots, `wiki/outlines/progress.md`, `wiki/relationships/runtime/*.md`, and `wiki/plot-arcs/runtime/*.md`.
- Removed runtime target allowance for arbitrary `wiki/player/*.md`, base `wiki/relationships/*.md`, and base `wiki/plot-arcs/*.md`.
- Added runtime prompt text for the cross-directory sync contract and explicit forbidden runtime targets including base relationship/plot-arc pages, `outlines/main.md`, style/rules/sources/world, and base entity pages.
- Added aggregate validator warnings after per-update validation. These warnings flag missing companion runtime sync for current-scene long-term changes, inventory object-state changes without item runtime updates, and item runtime player-holding changes without inventory updates.
- Kept validator behavior warning-only for sync gaps; it does not create or repair `ProposedWikiUpdate`s.
- Updated write-policy tests so relationship and plot-arc runtime writes use `relationships/runtime` and `plot-arcs/runtime`, while base relationship/plot-arc pages are rejected.

### Actual code / plan differences recorded

- Before this stage, runtime target policy still allowed base `wiki/relationships/*.md` and base `wiki/plot-arcs/*.md`.
- Before this stage, runtime target policy allowed arbitrary `wiki/player/*.md`; D2 narrowed this to the fixed player slot set from the schema contract.
- Before this stage, runtime validation only inspected each proposal independently; D2 added batch-level missing-sync warnings without adding an automatic repair layer.
- Runtime controller tests needed their fixture to create Stage D fixed schema slots so D2-focused assertions were not obscured by project-structure warnings.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-runtime-controller.test.ts` passed: 6 test files, 112 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage D3 overlay resolver / context read contract.
- Did not auto-create missing companion `ProposedWikiUpdate`s.
- Did not implement `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` as import framework modes.
- Did not change UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage D1 Directory Boundary Prompt / Schema Constraints

### Stage

RPG Import Modularization Plan 阶段 D1：目录边界 Prompt / Schema 约束。

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-ingest-signals.ts`
- `src/lib/rpg-interactions/wiki-update-policy.ts`
- `src/lib/rpg-interactions/runtime-update-interaction.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/rpg-ingest-signals.test.ts`
- `src/lib/rpg-interactions.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RPG_DIRECTORY_BOUNDARY_GUIDANCE` and `getRpgDirectoryBoundaryGuidance()` as code-readable D1 semantic boundary metadata.
- Covered these boundary pairs explicitly:
  - `wiki/player/goals.md` vs `wiki/quests/*.md` vs `wiki/plot-arcs/*.md`.
  - `wiki/rules/` vs `wiki/world/`.
  - global `wiki/style/` vs character-specific voice in `characters/` or relationship-driven tone in `relationships/`.
  - `wiki/characters/` vs `wiki/relationships/`.
  - `wiki/items/` vs `wiki/player/inventory.md`.
- Added prompt rendering for the code-readable boundary guidance through `buildRpgDirectoryBoundaryGuidance()`.
- Injected the D1 boundary guidance into ordinary Source Ingest Stage 1 analysis and Stage 2 generation prompts.
- Updated focused page contracts for `player`, `plot-arcs`, `relationships`, `items`, `world`, and `characters` to call out the new boundaries where those contracts are selected.
- Updated long-source chunk analysis and structured signal context guidance so chunk-derived Stage 2 profiles do not route subjective goals, plot pressure, player TODO/checklists, rules/control mechanics, world background, style rules, or character voice into the wrong directory.
- Tightened runtime target-rule descriptions and runtime update prompt text for `player/goals.md`, `quests`, `plot-arcs`, `relationships`, and `items/runtime` without adding D2 cross-directory sync behavior.
- Added tests proving the schema boundary metadata exists, Source Ingest prompts include the D1 boundary text, structured signal context carries the same boundary rules, and runtime update policy no longer describes quests/plot-arcs/player goals too broadly.

### Actual code / plan differences recorded

- `quests`, `rules`, and `style` are present in runtime/manual project directories and write policies, but they are not part of the current ordinary Source Profile focused-category whitelist.
- To keep Stage D1 small and avoid opening new ordinary Source Ingest behavior, this stage added reusable boundary guidance and prompt/policy constraints rather than adding new `RPG_CATEGORIES` entries or implementing new import modes.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-ingest-signals.test.ts` passed: 4 test files, 100 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage D2 runtime cross-directory sync.
- Did not implement Stage D3 overlay resolver.
- Did not implement `control_doc_import`, `campaign_setup_import`, `runtime_update_apply`, or any other new import mode behavior.
- Did not change UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage D Schema Slots and New Project Templates

### Stage

RPG Import Modularization Plan 阶段 D：Schema Slots 与新项目模板。

### Changed files

- `src/lib/rpg-wiki-schema.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/rpg-runtime/types.ts`
- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-interactions/narration-interaction.ts`
- `src/lib/rpg-runtime.test.ts`
- `src/lib/rpg-narration-prompts.test.ts`
- `src/lib/rpg-interactions.test.ts`
- `src/lib/rpg-llm-narration-adapter.test.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `src-tauri/src/commands/project.rs`
- `src/lib/project-mode.ts`
- `src/lib/project-mode.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the code-readable `RpgSchemaSlot` contract and fixed `RPG_SCHEMA_SLOTS` table.
- Added helper APIs: `getRpgSchemaSlot()`, `getRpgSchemaSlotByPath()`, `getRequiredRpgSchemaSlots()`, `getRpgSchemaSlotsByOwner()`, `RPG_FIXED_PLAYER_SLOT_PATHS`, and `isFixedPlayerSlotPath()`.
- Covered the fixed slot table in `src/lib/rpg-wiki-schema.test.ts`, including total count, exact paths, required flags, owner lookup, fixed player path set, manual_or_review_only control files, and `outline_progress` as runtime/merge.
- Updated Context Compiler to read `current_scene` through the slot helper and to report missing required slots as project-structure warnings.
- Updated Context Compiler player-state reads to use only the five fixed player slots: `player_main`, `player_abilities`, `player_inventory`, `player_goals`, and `player_known_information`.
- Kept arbitrary `wiki/player/*.md` out of runtime player state; missing fixed player slots now produce warnings instead of being bypassed by scanning other player files.
- Added `outlines` to allowed runtime reads and added `outlineNotes` to `CompactStoryBrief`, populated from `main_outline` and `outline_progress`.
- Rendered `## Outline Notes` separately in the narration interaction prompt so outline guidance does not become `events` or `hardFacts`.
- Updated rules/style/memory reads to load fixed slot files first and then keep same-directory markdown as supplemental material.
- Updated Rust project bootstrap to create `wiki/outlines/`, `wiki/relationships/runtime/`, `wiki/plot-arcs/runtime/`, and all required fixed slot template files.
- Updated the built-in schema text in Rust and the frontend project bootstrap schema copy to document fixed slots, manual_or_review_only control files, review-bounded outline progress merge, and the fixed player slot rule.
- Added a Rust unit test proving `create_project_impl()` creates the new runtime directories and all fixed slot files.

### Actual code / plan differences recorded

- Before this stage, `src/lib/rpg-wiki-schema.ts` had directory-level schema entries but no code-readable fixed slot table.
- Before this stage, `src/lib/rpg-runtime/context-compiler.ts` read arbitrary markdown under `wiki/player/` for player state.
- Before this stage, `src-tauri/src/commands/project.rs` created several RPG directories but not the fixed schema slot template files, `wiki/outlines/`, `wiki/relationships/runtime/`, or `wiki/plot-arcs/runtime/`.
- The frontend create-project flow rewrites `schema.md` from `src/lib/project-mode.ts` after the Tauri project command returns, so the frontend bootstrap schema copy was synchronized to avoid overwriting the Stage D Rust schema text with stale content.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts` passed: 3 test files, 29 tests.
- `npx.cmd vitest run src/lib/project-mode.test.ts` passed: 1 test file, 3 tests.
- `cargo test --manifest-path src-tauri/Cargo.toml project` passed: 3 tests; Cargo emitted only pre-existing non-snake-case warnings in `src/proxy.rs`.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Stage D1 prompt-boundary expansion.
- Did not implement Stage D2 runtime cross-directory sync.
- Did not implement Stage D3 overlay resolver / broader context read rewrite.
- Did not implement `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply` as new import framework modes.
- Did not add legacy/default migration, fallback, old path compatibility, or compatibility reads for missing fixed slots.
- Did not change runtime write policy to broaden write permissions.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage C Interaction Spec Migration

### Stage

RPG Import Modularization Plan 阶段 C：Interaction Spec 迁移。

### Changed files

- `src/lib/rpg-interactions/interaction-spec.ts`
- `src/lib/rpg-interactions/source-ingest-analysis-interaction.ts`
- `src/lib/rpg-interactions/source-ingest-generation-interaction.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-interactions.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Extended `RpgInteractionKind` to include the planned source ingest, control document, campaign setup, narration, runtime update, relationship derivation, outline impact, and outline regeneration interaction kinds.
- Added `sourceIngestAnalysisInteractionSpec` with `kind: "source_ingest_analysis"`.
- Added `sourceIngestGenerationInteractionSpec` with `kind: "source_ingest_generation"`.
- The analysis spec reuses `buildRpgAnalysisPrompt(...)` for the system prompt and preserves the existing `Analyze this source document` user prompt shape, including `**File:**` and optional `**Folder context:**`.
- The generation spec reuses `buildRpgGenerationPrompt(...)` for the system prompt and preserves the existing Stage 1 / Source Context FILE/REVIEW user prompt shape.
- `parseOutput()` is intentionally a thin passthrough for both source ingest specs; the specs do not read files, write files, call the LLM, parse FILE blocks, or touch the writer.
- Exported the new specs from `src/lib/rpg-interactions/index.ts`.
- Updated `autoIngestImpl()` so the Stage 1 analysis and Stage 2 generation `streamChat()` calls now receive prompts from the source ingest interaction specs.
- Kept `autoIngest()`, `buildAnalysisPrompt()`, and `buildGenerationPrompt()` available in `src/lib/ingest.ts` for the current ordinary source ingest entry path.

### Actual code / plan differences recorded

- Before this stage, `RpgInteractionKind` only contained `narration`, `runtime_state_update`, `relationship_derivation`, `outline_impact`, and `outline_regeneration`.
- Before this stage, source ingest analysis/generation user prompts were inline in `autoIngestImpl()` rather than owned by `src/lib/rpg-interactions/`.
- Stage B's `src/lib/rpg-import/source-ingest.ts` remains a thin `autoIngest()` wrapper; this stage did not expand it into additional import modes.

### Validation

- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` passed: 4 test files, 87 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement `control_doc_import`, `campaign_setup_import`, or `runtime_update_apply`.
- Did not change writer behavior, queue behavior, UI behavior, review/pending/apply behavior, LLM parameters, activity state handling, signal handling, or ordinary source ingest semantics.
- Did not add a legacy/default import fallback, migration path, compatibility layer, or old-path preservation.
- Did not call a real LLM; tests mock the LLM boundary.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage B Import Framework Skeleton

### Stage

RPG Import Modularization Plan 阶段 B：Import Framework 骨架。

### Changed files

- `src/lib/rpg-import/types.ts`
- `src/lib/rpg-import/source-ingest.ts`
- `src/lib/rpg-import/registry.ts`
- `src/lib/rpg-import/pipeline.ts`
- `src/lib/rpg-import/index.ts`
- `src/lib/rpg-import/source-ingest.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the initial `src/lib/rpg-import/` skeleton.
- Defined `RpgImportMode`, `RpgImportRequest`, `RpgImportResult`, and `RpgImportModeSpec`.
- Added a small registry with `getRpgImportModeSpec()` and `listRpgImportModeSpecs()`.
- Added `runRpgImport()` as the pipeline entry that dispatches through the registry and throws a clear error for unregistered modes.
- Registered only `source_ingest` for this stage.
- Implemented `source_ingest` as a thin wrapper around the existing `autoIngest()`: it requires `sourcePath` and `llmConfig`, passes through `projectPath`, `signal`, and `folderContext`, does not swallow errors, and returns `autoIngest()`'s `writtenPaths` unchanged with empty `reviewItems`, `warnings`, and `skipped`.
- Added focused Vitest coverage comparing direct `autoIngest()` with `runRpgImport({ mode: "source_ingest" })` across two equivalent temp projects, including written paths, file contents, and review item semantic fields from the generation REVIEW block.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/source-ingest.test.ts src/lib/ingest.scenarios.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Ordinary ingest behavior was not changed.
- `autoIngest()` body was not modified.
- Queue, UI, prompt construction, writer behavior, and runtime update apply were not modified.
- `control_doc_import`, `campaign_setup_import`, and `runtime_update_apply` remain type-level mode names only; their behavior was not implemented.
- No `sourceText` temporary-file import path was introduced.
- No legacy/default compatibility, migration, or fallback design was added.
- No real LLM was called; tests mock `streamChat`.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Stage A Contract Freeze

### Stage

RPG Import Modularization Plan 阶段 A：文档与契约冻结。

### Changed files

- `docs/RPG_WIKI_SCHEMA.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated `Import Mode 与固定 Schema Slot 契约` section to `docs/RPG_WIKI_SCHEMA.md`.
- Froze the four mode names and boundaries: `source_ingest`, `control_doc_import`, `campaign_setup_import`, and `runtime_update_apply`.
- Documented each mode's semantics, typical inputs, allowed target paths, forbidden paths / behaviors, and write strategy boundaries.
- Added a fixed schema slot table for `main_outline`, `outline_progress`, `rules_*`, `style_*`, `memory_*`, `current_scene`, and the fixed `player_*` files.
- Fixed schema-path conflicts in the schema document:
  - `player/profile.md` is now `player/player.md`.
  - `style/narrative_style.md`, `style/dialogue_style.md`, and `style/forbidden_patterns.md` are now `style/narration.md`, `style/dialogue.md`, and `style/forbidden.md`.
  - `outlines/` now explicitly includes both `main.md` and `progress.md`.
- Clarified fixed player files, `outlines/main.md` versus `outlines/progress.md`, and base/runtime overlay boundaries.
- Updated Stage 6.17a in `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` so the Runtime Context Schema Contract explicitly depends on the fixed slot contract and remains documentation-only in this stage.

### Validation

- Documentation-only check; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not add UI.
- Did not add `src/lib/rpg-import/`.
- Did not add or modify tests.
- Did not call a real LLM.
- Did not design migration, compatibility fallback, or old-path preservation for legacy/default projects.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Memory Directory Context Compiler Boundary

### Stage

Planning/documentation update for the memory directory contract.

### Changed files

- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Redefined `wiki/memory/` as the Context Compiler's long-term helper and triage buffer.
- Clarified that `memory/` is not the primary fact source and should not replace concrete directories such as `events/`, `quests/`, `outlines/progress.md`, `relationships/runtime/`, `plot-arcs/runtime/`, `current-scene/`, `rules/`, or `style/`.
- Clarified the fixed memory files:
  - `player-preferences.md` for player preferences, safety boundaries, and long-term experience requirements.
  - `long-term.md` for cross-scene helper summaries that do not yet fit a more concrete directory.
  - `session-notes.md` for recent session notes, manual notes, and material waiting to be sorted.
- Updated the UI/import wording from "long-term memory" to "context memory" where appropriate.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not implement schema slots, validators, prompt changes, UI changes, or write-policy code.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Outline Progress and Relationship/Plot Runtime Overlay Plan

### Stage

Planning/documentation update for outline progress and base/runtime overlay semantics.

### Changed files

- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `wiki/outlines/progress.md` as a fixed outline progress slot.
- Kept `wiki/outlines/main.md` as the low-frequency author/GM outline, modified only through manual/review or a dedicated outline revision flow after impact detection.
- Explicitly did not add a fixed `wiki/outlines/revision-proposal.md`; outline revision proposals remain review/pending data until a later mechanism decides whether they need a file.
- Updated Runtime Update Apply target paths so relationship and plot-arc runtime changes go to `wiki/relationships/runtime/*.md` and `wiki/plot-arcs/runtime/*.md`.
- Clarified that base `wiki/relationships/*.md` and base `wiki/plot-arcs/*.md` store initial/stable relationship and plot-arc structures.
- Added the overlay vs merge distinction: overlay is the base + runtime layering/read model, while merge is the write strategy used inside a single file, including runtime overlay files.
- Added Stage D3 for the overlay resolver / context read contract.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not implement schema slots, overlay resolver, validators, prompt changes, UI changes, or write-policy code.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Import Plan Directory Boundary Refinement

### Stage

Planning/documentation update for the RPG import modularization contract.

### Changed files

- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Refined the import plan's directory semantics beyond the `outlines` / `plot-arcs` split.
- Locked `wiki/player/` to a fixed file set: `player.md`, `abilities.md`, `inventory.md`, `goals.md`, and `known_information.md`.
- Clarified that player abilities, skills, limits, and current availability belong in `wiki/player/abilities.md`, not `rules/`.
- Added explicit semantic boundaries for `quests/` vs `player/goals.md` vs `plot-arcs/`.
- Explained `memory/` authority levels: `player-preferences.md` as preference/control-like material, `long-term.md` as confirmed long-term memory, and `session-notes.md` as session notes rather than hard control or event history.
- Added prompt/schema boundary requirements for `rules/` vs `world/`, global `style/` vs character-specific voice, `characters/` vs `relationships/`, and `items/` vs `player/inventory.md`.
- Added runtime cross-directory sync guidance: `current-scene` remains an immediate snapshot, while persistent character/location/faction/item changes should produce runtime overlay updates.
- Added Stage D1 and D2 to the plan for boundary prompt/schema constraints and runtime cross-directory sync contracts.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not implement schema slots, validators, prompt changes, UI changes, or write-policy code.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Outline Directory Schema Decision

### Stage

Planning/documentation update for the RPG wiki schema and import contract.

### Changed files

- `AGENTS.md`
- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Adopted the separate `wiki/outlines/` directory for author/GM-side campaign outlines.
- Moved the fixed `main_outline` slot from `wiki/plot-arcs/main-outline.md` to `wiki/outlines/main.md`.
- Clarified that `wiki/plot-arcs/` stores runtime plot-arc state: unresolved conflict, pressure, foreshadowing, blockers, possible developments, and advancement conditions.
- Updated the agent guide so future planning and implementation should not default to old-project compatibility, migration, fallback, or old-path preservation. The project is treated as a new `llmWikiRPG` product unless the user explicitly asks otherwise.
- Updated runtime/write-boundary documentation so runtime updates cannot write `wiki/outlines/`.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not implement schema slots, bootstrap templates, import modes, UI, or write-policy code.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Import Modularization Plan

### Stage

Planning/documentation update for future RPG import modularization.

### Changed files

- `docs/RPG_IMPORT_MODULARIZATION_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated solution document for modularizing RPG import and ingest flows.
- Defined four separate modes instead of one enlarged ingest path: `source_ingest`, `control_doc_import`, `campaign_setup_import`, and `runtime_update_apply`.
- Documented why control documents such as style, rules, memory, and main outline should use a fidelity-preserving canonicalization path instead of ordinary source ingest.
- Documented why player setup and initial scene material need a separate campaign setup path that can explicitly bootstrap `wiki/current-scene/scene_state.md`.
- Proposed a future `src/lib/rpg-import/` framework for mode registry, pipeline orchestration, target policy, validation, review, and result reporting.
- Proposed keeping `src/lib/rpg-interactions/` as the LLM interaction spec layer for prompt construction and output parsing.
- Recorded a phased roadmap from documentation/schema contract through framework skeleton, interaction migration, schema slots, control document import, campaign setup import, runtime apply alignment, and a unified UI entry.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not change ordinary ingest behavior.
- Did not implement new import modes, schema slots, UI, write policies, or LLM interactions.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Context Compiler Redesign Plan Document

### Stage

Planning/documentation update for Stage 6.17: Context Compiler v1.

### Changed files

- `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated detailed Context Compiler v1 redesign plan.
- Documented the default two-LLM Context Compiler flow: Recall Selector / Memory Routing followed by Outline-aware Context Brief Compiler.
- Documented inputs, outputs, budgets, fallback behavior, optional one-round downgrade, optional third-round retrieval repair / pre-narration outline impact probe, and long-campaign capsule strategy.
- Shortened Stage 6.17 in `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` so the roadmap contains the execution summary and points to the detailed design file.
- Preserved the Context Compiler boundary: no narration generation, no next action options, no pending updates, no wiki writes, and no formal outline revision inside Context Compiler.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not call a real LLM.
- Did not implement Context Compiler v1, narration generation, runtime update extraction, pending updates, wiki writes, relationship derivation, outline impact detection, or outline regeneration.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Context Compiler v1 Planning Refinement

### Stage

Planning/documentation update for Stage 6.17: Context Compiler v1.

### Changed files

- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Expanded Stage 6.17 from a simple retrieval/budgeting upgrade into a multi-pass LLM-assisted context compilation plan.
- Required at least two LLM interactions: a recall/synthesis pass over recent completed turns plus deterministic wiki retrieval results, and a narration-brief pass that produces a short prompt/brief for the next narration generator.
- Added an optional retrieval-planning pass before wiki retrieval, with local path allowlist validation remaining authoritative.
- Added suggested interfaces, implementation locations, scope exclusions, deterministic fallback requirements, and fixture-test expectations.
- Updated current-state guidance so the next architecture implementation target is Stage 6.17, because Stage 6.16 is already covered by the existing section-aware/runtime write merge alignment work.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not change runtime code.
- Did not call a real LLM.
- Did not generate narration, next action options, wiki updates, pending updates, or wiki writes.
- Did not implement relationship derivation, outline impact detection, or outline regeneration.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Runtime Update Validation v1

### Stage

Stage 6.15: Runtime Update Validation v1.

### Changed files

- `src/lib/rpg-interactions/runtime-update-validation.ts`
- `src/lib/rpg-interactions/runtime-update-interaction.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-runtime/runtime-persistence.ts`
- `src/lib/rpg-runtime-update-validation.test.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `src/lib/rpg-interactions.test.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a pure path-aware runtime update validator for `ProposedWikiUpdate[]`.
- The validator returns accepted updates, rejected updates, warning/reject issues, and warning strings without reading or writing wiki files.
- Covered Stage 6.15 semantic boundaries for `events`, `current-scene`, `plot-arcs`, `relationships`, `player`, `quests`, and runtime overlay paths.
- Wired validation into `runRpgRuntimeTurnFlow()` immediately before `createPendingRpgUpdates()`, so only accepted proposals become user-reviewable pending updates.
- Preserved rejected proposal audit data through controller warnings and `runtimeUpdateValidation` summary data in the runtime turn journal.
- Preserved warning-only proposals in pending while keeping their warning issues visible in controller result and journal data.
- Strengthened the runtime update interaction prompt/contract to require single-pass directory self-checking and to explicitly state there is no second LLM validation round.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not add a second LLM review, retry loop, or validator-feedback-to-LLM path.
- Did not automatically accept, reject, apply, or write wiki files.
- Did not modify `applyRpgPendingUpdates()` write permissions.
- Did not implement Stage 6.16 section-aware merge, Stage 6.17 context compiler, relationship deriver, outline impact, or outline regeneration.
- Did not modify ordinary ingest main flow.
- Did not delete legacy `entities`, `concepts`, or `sources` functionality.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Ordinary Ingest / Runtime Current-Scene Boundary Cleanup

### Stage

Boundary cleanup after Stage 6.14; this is not Stage 6.15/6.16/6.17 implementation.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-dynamic-update.ts`
- `src/lib/rpg-extraction-validation.ts`
- `src/lib/rpg-ingest-signals.ts`
- related focused tests
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_DYNAMIC_UPDATE_STRATEGY.md`
- `docs/RPG_EXTRACTION_EVALUATION_V0_2_PLAN.md`
- `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md`

### Summary

- Removed the former ordinary-ingest live marker mechanism from RPG Stage 1 and Stage 2 prompt contracts.
- Removed `current-scene` from ordinary ingest `needed_categories` and focused page guidance.
- Updated ordinary ingest writer validation so `wiki/current-scene/` FILE blocks are blocked with warning/review signals instead of being normalized or written.
- Updated long-source structured signal context so it no longer emits live marker fields or infers `current-scene` for Stage 2.
- Preserved RPG Play/Runtime writeback: `applyRpgPendingUpdates()` and runtime UI apply flow still allow accepted pending updates to overwrite `wiki/current-scene/scene_state.md`.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-extraction-validation.test.ts src/lib/rpg-write-policy.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed.
- `npx.cmd vitest run src/lib/rpg-dynamic-update.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-wiki-schema.test.ts` passed.
- `npm.cmd run typecheck` passed.
- A cleanup search for the former live marker, live profile fields, and old current-scene object type now reports only historical files under `docs/archive/`.

### Scope notes

- Did not implement Stage 6.15, Stage 6.16, or Stage 6.17.
- Did not remove runtime write policy, `PendingRpgUpdatesPanel`, or `RpgRuntimePanel`.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Runtime Apply Refresh + UI Reliability v0

### Stage

Stage 6.14: Runtime Apply Refresh + UI Reliability v0.

### Changed files

- `src/components/rpg/rpg-runtime-panel.tsx`
- `src/components/rpg/pending-rpg-updates-panel.tsx`
- `src/components/rpg/index.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `src/components/rpg/pending-rpg-updates-panel.test.tsx`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/LLMWIKIRPG_USAGE.md`

### Summary

- Added applied-path calculation for RPG runtime apply results in `RpgRuntimePanel`.
- After manual apply, the panel now reloads project files through the existing store path: `listDirectory(projectPath)`, `setFileTree()`, and `bumpDataVersion()`. This reuses the same file-tree/data-version refresh signal used by existing ingest, review, delete, and sync flows.
- Added a narrow `onProjectFilesChanged?: (affectedPaths: string[]) => void | Promise<void>` panel prop so a caller can reuse an outer reload callback while still receiving the affected paths.
- When the apply result contains an actually applied `wiki/current-scene/scene_state.md` overwrite, the runtime panel rereads that file with the existing `loadRpgCurrentScene()` path and updates the displayed current scene.
- Extended the last apply result UI to show affected paths in addition to applied updates, skipped updates, and warnings.
- Preserved Stage 6.13 pending persistence behavior: pending and rejected updates remain, accepted skipped updates remain accepted in the queue, and only successfully applied updates are removed.

### Validation

- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-write-policy.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change `applyRpgPendingUpdates()` write-policy permissions or target validation.
- Did not add automatic accept, automatic apply, or direct UI wiki writes.
- Did not implement Stage 6.15, Stage 6.16, or Stage 6.17.
- Did not wire relationship derivation, outline impact detection, outline regeneration, or any real LLM call.
- Did not change ingest main flow.
- No legacy `entities`, `concepts`, or `sources` functionality was deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Merge Evaluation + Review-Controlled Distill

### Stage

Fifth and sixth RPG merge prompt redesign stages: deterministic merge evaluation samples plus review queue / user-controlled compression.

### Changed files

- `src/lib/rpg-merge-evaluation.ts`
- `src/lib/rpg-merge-evaluation.test.ts`
- `src/lib/rpg-merge-review.ts`
- `src/lib/rpg-merge-review.test.ts`
- `src/lib/rpg-merge-lint.ts`
- `src/lib/rpg-merge-lint.test.ts`
- `src/lib/rpg-section-merge.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/RPG_MERGE_PROMPT_REDESIGN.md`

### Summary

- Added a pure deterministic RPG merge evaluation helper and 5 fixed mock regression samples.
- Covered character pages staying as NPC operating models instead of biography/trivia sinks, relationship pages preserving playable tension without duplicate character profiles, plot-arcs keeping Possible Futures out of Confirmed Facts, events rejecting future/unchosen-option contamination, and player Current State replacing stale state.
- Added a pure RPG merge review service that evaluates an already merged candidate through section merge, RPG merge lint, body-shrink checks, and section-deletion checks, then returns an existing-compatible `suggestion` review item for high-risk outputs instead of accepted content.
- Added review-controlled distill proposal handling for overlong runtime-facing character/location/event/plot-arc/relationship pages, reusing `distillRpgWikiPage()` and `createRpgDistillReviewItems()`.
- Added an accepted-only distill apply helper that can generate a compressed candidate only after proposal acceptance; pending and rejected proposals do not apply.
- Kept manual-control `wiki/style/`, `wiki/rules/`, `wiki/memory/` and source `wiki/sources/` pages outside automatic runtime distill.
- Tightened plot-arc lint for possible future language inside `Confirmed Facts` while preserving normal separate `Possible Futures` behavior.
- Fixed section-aware merge printing so append-dedupe section bodies are followed by Markdown heading breaks before the next section.

### Validation

- `npx.cmd vitest run src/lib/rpg-merge-evaluation.test.ts` passed.
- `npx.cmd vitest run src/lib/rpg-merge-review.test.ts` passed.
- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Used fixed mock regression samples only; no real LLM call was made.
- No automatic compression writeback was added; overlong pages produce review/proposal data only.
- No UI rewrite, review persistence rewrite, runtime controller change, or runtime write-policy loosening was added.
- `current-scene` overwrite, `events` append/create, and stable/base/source/manual-control blocked runtime write boundaries remain unchanged.
- No legacy files or user files were deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Runtime Write Merge Alignment

### Stage

Fourth RPG merge prompt redesign stage: Runtime Write Merge alignment.

### Changed files

- `src/lib/rpg-runtime/write-policy.ts`
- `src/lib/rpg-write-policy.test.ts`
- `src/lib/rpg-section-merge.ts`
- `src/lib/rpg-section-merge.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/RPG_MERGE_PROMPT_REDESIGN.md`

### Summary

- Updated accepted runtime `merge` writes to call `mergeRpgSections()` instead of appending the new runtime update to the end of the existing file.
- Added minimal runtime-write options to `mergeRpgSections()` so deterministic runtime merge can preserve existing frontmatter, existing pre-section heading text, and useful untouched sections while still replacing touched runtime-state sections.
- Kept `Current State` replacement semantics for runtime-state, relationship, and overlay pages so stale player state, quest progress, relationship state, and current overlay state do not remain beside newer accepted updates.
- Kept append-dedupe behavior for `Evidence and Uncertainty`, `Confirmed Facts`, and plot-arc `Possible Futures`; possible futures remain in `Possible Futures` and are not promoted into confirmed facts.
- Expanded runtime-facing low-value section filtering to cover full biography / character profile material and Chinese equivalents, preventing old runtime-facing biography noise from flowing back into relationship and runtime pages.
- Preserved runtime write boundaries: `current-scene` still overwrites, `events` still appends or creates, and stable/base/source/manual-control paths remain blocked by `validateRpgRuntimeUpdateTarget()`.
- Added focused tests for player state replacement, quest objective progress replacement, relationship tension/evidence merge without biography restoration, plot-arc possible futures separation, all four runtime overlay path families, current-scene overwrite, events append/create, blocked paths, and low-value section suppression.

### Validation

- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-write-policy.test.ts` passed.
- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts src/lib/rpg-write-policy.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No runtime controller, UI, context compiler, relationship deriver, or outline module was modified.
- No post-ingest distiller was implemented.
- No real LLM call was made.
- No `wiki/current-scene/` or `wiki/events/` strategy semantics were changed.
- No stable/base/source/manual-control runtime write permissions were loosened.
- No legacy files or user files were deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - Section-aware Merge v0

### Stage

Third RPG merge prompt redesign stage: Section-aware Merge v0.

### Changed files

- `src/lib/rpg-section-merge.ts`
- `src/lib/rpg-section-merge.test.ts`
- `src/lib/page-merge.ts`
- `src/lib/page-merge.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/RPG_MERGE_PROMPT_REDESIGN.md`

### Summary

- Added `src/lib/rpg-section-merge.ts` as a pure section-aware post-processor for already accepted LLM merge candidates.
- Exported `RpgSectionMergeStrategy`, `RpgSectionMergeResult`, `RpgSectionMergeContext`, and `mergeRpgSections()`.
- Implemented a lightweight Markdown section parser that recognizes `##` and `###` headings, normalizes heading names by case and whitespace, and preserves YAML frontmatter as emitted by the LLM.
- Added strategy handling for `Runtime Capsule`, `Current State`, `Evidence and Uncertainty`, `Confirmed Facts`, `Possible Futures`, and low-value runtime-facing sections.
- Restored an existing/incoming `Runtime Capsule` when the LLM omitted one, without generating a new capsule.
- Replaced stale `Current State` on runtime-state, relationships, and current-scene pages by preferring LLM state then incoming state, without preserving stale existing state beside it.
- Merged `Evidence and Uncertainty`, `Confirmed Facts`, and plot-arc `Possible Futures` with append-dedupe bullet behavior while keeping possible futures out of confirmed facts.
- Preserved event-page `Possible Futures` contamination for RPG merge lint to reject/fallback instead of silently repairing it.
- Prevented deleted low-value sections from flowing back into runtime-facing non-source pages while leaving `wiki/sources/` evidence pages outside that low-value drop behavior.
- Integrated section-aware merge into `mergePageContent()` after frontmatter parsing and body shrink sanity checks, before RPG merge lint and deterministic frontmatter post-processing.
- Added focused pure tests and page-merge integration tests for capsule restoration, stale current-state replacement, append-dedupe behavior, plot-arc/event boundaries, low-value section behavior, and existing fallback safety paths.

### Validation

- `npx.cmd vitest run src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No runtime controller, runtime write policy, UI, context compiler, relationship deriver, or outline module was modified.
- No post-ingest distiller was implemented.
- No runtime write merge alignment was implemented.
- No real LLM call was made.
- No legacy files or user files were deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Merge Lint v0

### Stage

Second RPG merge prompt redesign stage: RPG Merge Lint v0.

### Changed files

- `src/lib/rpg-merge-lint.ts`
- `src/lib/rpg-merge-lint.test.ts`
- `src/lib/page-merge.ts`
- `src/lib/page-merge.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-merge-lint.ts` as a pure semantic lint layer for merged RPG pages.
- Exported `RpgMergeLintSeverity`, `RpgMergeLintIssue`, `RpgMergeLintResult`, `RpgMergeLintContext`, and `lintRpgMergedPage()`.
- Added warning-only detection for non-source runtime-facing pages that lack `## Runtime Capsule`, excluding `wiki/sources/` and manual-control `wiki/style/`, `wiki/rules/`, and `wiki/memory/`.
- Added reject detection for `wiki/events/` pages containing future possibilities, next-step suggestions, optional or unchosen actions, and foreshadowing language.
- Added reject detection for `wiki/plot-arcs/` pages that combine possible-future language with confirmed-happened language.
- Added warning detection for base `wiki/characters/*.md`, `wiki/locations/*.md`, `wiki/factions/*.md`, and `wiki/items/*.md` pages that contain obvious runtime-only current-state wording.
- Added reject detection for `wiki/current-scene/` pages that look like accumulated history, full profiles, complete timelines, or route recaps.
- Integrated the lint into `mergePageContent()` after frontmatter parsing and policy-aware body shrink checks, before deterministic locked-field, array-union, and updated-stamp post-processing.
- Reject lint results now use the existing fallback contract: log warning details, run the backup hook, and write array-merged incoming content. Warning-only lint results are logged but still accept the LLM merge output.
- Added focused tests for the pure lint rules and page-merge integration paths for reject fallback and warning acceptance.

### Validation

- `npx.cmd vitest run src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 3 test files passed.
  - 41 tests passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-merge-lint.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 5 test files passed.
  - 75 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No automatic rewrite, compression, section-aware merge, or post-ingest distiller behavior was added.
- No review queue persistence or ingest main-flow semantics were changed.
- No runtime controller, runtime write policy, UI, context compiler, relationship deriver, or outline module was modified.
- No real LLM call was made.
- No legacy files or user files were deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Merge Policy v0

### Stage

First RPG merge prompt redesign stage: RPG Merge Policy v0.

### Changed files

- `src/lib/rpg-merge-policy.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest.ts`
- `src/lib/page-merge.test.ts`
- `src/lib/rpg-merge-policy.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Confirmed the page merge function receives a `MergeContext` containing `sourceFileName`, `pagePath`, and `signal`.
- Confirmed `mergePageContent()` passes the target `pagePath` to the injected merger and uses `getRpgMergePolicy(opts.pagePath).bodyShrinkThreshold` for body shrink sanity checks.
- Confirmed `buildPageMerger()` builds its system prompt through `buildRpgMergeSystemPrompt(context.pagePath)` and forwards `context.signal` to `streamChat()`.
- Confirmed the merge prompt is RPG runtime-oriented instead of encyclopedia-oriented: it prioritizes NPC portrayal, player choices, relationship tension, scene hooks, state consequences, action constraints, rules/hard setting, atmosphere/style, and future pacing, while rejecting low-value trivia and future-as-fact drift.
- Confirmed deterministic merge safety is preserved: array-field union, locked frontmatter fields, updated stamp, no-frontmatter rejection, LLM failure fallback, and backup hook behavior.
- Expanded `src/lib/rpg-merge-policy.test.ts` with path classification coverage for sources, stable base pages, runtime pages, events, current-scene, manual-control pages, and generic fallback behavior.

### Validation

- `npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 2 test files passed.
  - 30 tests passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 4 test files passed.
  - 64 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No runtime controller, runtime write policy, UI, context compiler, relationship deriver, or outline module was modified.
- No post-ingest distiller was implemented or wired.
- No real LLM call was made.
- No legacy files or user files were deleted.
- No `git commit` or `git push` was performed.

## 2026-06-07 - RPG Runtime-Oriented Relationship/Tension Deriver v0

### Stage

Sixth runtime-oriented ingest stage: Relationship/Tension Deriver v0.

### Changed files

- `src/lib/rpg-relationship-tension-deriver.ts`
- `src/lib/rpg-relationship-tension-deriver.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-relationship-tension-deriver.ts` as a pure TypeScript proposal service for implicit RPG relationship and plot-pressure derivation.
- Added `deriveRpgRelationshipTensions()` to read wiki pages, optional `RpgIngestSignal[]`, and optional source notes, then produce proposal-only derivations for trust, tension, secret, misunderstanding, dependency, and conflict pressure.
- Added `createRpgRelationshipDeriverReviewItems()` so proposals can be converted into existing `suggestion` review items with Inspect/Dismiss options, without writing review storage by itself.
- Proposal output includes `targetPath`, `targetKind`, `derivationKind`, `participants`, `canonStatus`, `confidence`, `evidence`, `rationale`, `playerTriggers`, `unresolvedBoundaries`, `mergePatchMarkdown` for relationship targets, `proposalMarkdown`, and `warnings`.
- Relationship proposals use merge-style deltas focused on trust, pressure, triggers, evidence, and boundaries instead of repeating full character introductions.
- Plot-arc proposals focus on unresolved conflict pressure, escalation conditions, and cannot-resolve-early boundaries, and explicitly avoid writing possible futures as completed events.
- Insufficient participant or evidence cases produce warnings and review-only proposals instead of fabricating relationship pages.
- Direct evidence, source notes, and canon-marked structured signals are retained as evidence summaries; derivation conclusions are not promoted to canon facts.
- Added focused tests for character behavior plus event consequences, secret/misunderstanding inference boundaries, evidence-only direct facts, merge proposal shape, plot-arc conflict pressure boundaries, source notes/signals as evidence, review-only insufficient-participant behavior, and REVIEW/proposal-only markdown boundaries.

### Validation

- `npx.cmd vitest run src/lib/rpg-relationship-tension-deriver.test.ts` passed.
  - 1 test file passed.
  - 8 tests passed.
- `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 3 test files passed.
  - 31 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- The deriver was not connected to the ordinary ingest automatic write path.
- No silent writes to `wiki/relationships/` or `wiki/plot-arcs/` were added.
- No canon facts were written.
- No runtime controller, UI, Tauri command, or write policy was modified.
- No real LLM calls were added.
- No review accept/reject/apply behavior was added.
- No legacy `entities`, `concepts`, or `sources` functionality was deleted.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Runtime-Oriented Context Capsule Retrieval v0

### Stage

Fifth runtime-oriented ingest stage: Context Capsule Retrieval v0.

### Changed files

- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-runtime.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Updated the read-only RPG runtime context compiler so non-source wiki pages are formatted through runtime section extraction before entering `CompactStoryBrief` fields.
- Added lightweight Markdown `##` / `###` section parsing inside `src/lib/rpg-runtime/context-compiler.ts`, without introducing a new parser module or changing ingest/write behavior.
- Prioritized `Runtime Capsule` for non-source pages, then category-specific runtime sections such as character `Behavior Rules`, `Dialogue Style`, `Relationship Levers`; location `Scene Hooks`, `Interactables`, `Risks`, `Clues`, `Sensory Anchors`; relationship / plot-arc tension, triggers, unresolved questions, and progression conditions; event consequences, state changes, and fallout; and runtime-useful player/world/faction/item/quest/memory/style/rule sections.
- Kept `wiki/sources/` reference-only. Source pages are still included in references but their page bodies do not enter `hardFacts`, page groups, or narration prompt body fields.
- Preserved high-priority `current-scene` snapshot handling and kept player pages high-priority while selecting player runtime/current-state sections before fallback.
- Preserved base page plus `runtime/` overlay composition by applying runtime section extraction to each page before group compaction.
- Preserved `stripUnchosenActionOptions()` sanitation so unselected `Next Action Options` do not enter serialized briefs.
- Added fallback behavior: if no runtime-facing sections exist, the compiler falls back to the existing compact whole-page behavior within `MAX_ENTRY_CHARS`.
- Added focused tests covering character runtime sections over Canon/Evidence poison text, location scene affordances over long history poison text, relationship tension/triggers/progression over background poison text, source reference-only behavior, current-scene/player/relationship priority, overlay composition, and unchosen option stripping.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passed.
  - 1 test file passed.
  - 8 tests passed.
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-runtime-controller.test.ts` passed.
  - 3 test files passed.
  - 29 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No ingest write flow was changed.
- No runtime write policy was changed.
- No wiki files were written, compressed, rewritten, or auto-distilled.
- No automatic review apply/accept/reject behavior was added.
- No real LLM calls were added.
- No UI behavior was changed.
- No Relationship/Tension Deriver was implemented.
- Existing legacy protections and source reference-only behavior were preserved.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Runtime-Oriented Post-Ingest Distiller v0

### Stage

Fourth runtime-oriented ingest stage: Post-Ingest Distiller v0.

### Changed files

- `src/lib/rpg-post-ingest-distiller.ts`
- `src/lib/rpg-post-ingest-distiller.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-post-ingest-distiller.ts` as a pure internal TypeScript service for existing long RPG wiki pages.
- Added `distillRpgWikiPage()` for single-page proposals, `distillRpgWikiPages()` for batch proposal generation, and `createRpgDistillReviewItems()` for review/proposal items that contain affected pages and Inspect/Dismiss options.
- Implemented path-based category recognition for `wiki/characters/`, `wiki/locations/`, `wiki/events/`, `wiki/plot-arcs/`, and `wiki/relationships/`.
- Kept `wiki/sources/` out of runtime-facing distill and returns a skipped proposal with a warning because sources are the evidence layer.
- Proposal results include `targetPath`, `category`, `originalLength`, `hasRuntimeCapsule`, `candidateRuntimeCapsule`, `roleplaySignals`, `keepSections`, `compressSections`, `moveToEvidenceSections`, `needsHumanConfirmation`, `proposalMarkdown`, and `warnings`.
- The generated proposal markdown explicitly lists recommended keep, recommended compress, move to sources/evidence, needs human confirmation, candidate Runtime Capsule, roleplay signals, and warnings.
- Added deterministic v0 section heuristics for long biography, route/timeline recap, duplicate evidence, low-value encyclopedia metadata/trivia, event future plans/foreshadowing, and plot-arc future-as-fact wording.
- Added runtime-facing keep heuristics for character portrayal/dialogue/boundaries, location affordances/dangers/clues/sensory anchors, confirmed event consequences, plot pressure/progression conditions, and relationship trust/tension/secrets/change triggers.
- Added focused unit tests covering all five required categories, no-writeback purity, and review item generation.

### Validation

- `npx.cmd vitest run src/lib/rpg-post-ingest-distiller.test.ts` passed.
  - 1 test file passed.
  - 7 tests passed.
- `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 2 test files passed.
  - 24 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No original wiki page was silently written back, overwritten, deleted, or compressed in place.
- No `.llm-wiki/review.json` write was added.
- No automatic review accept/reject/apply behavior was added.
- No Context Capsule Retrieval was implemented.
- No Relationship/Tension Deriver was implemented.
- No runtime controller, UI, Tauri command, or real filesystem write behavior was modified.
- Existing legacy `entities` / `concepts` / `sources` functionality was not deleted.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Merge Prompt Redesign Execution Handoff

### Stage

Documentation handoff for RPG merge prompt redesign follow-up execution.

### Changed files

- `docs/RPG_MERGE_PROMPT_REDESIGN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Appended a copy-ready opencode execution prompt for the first implementation stage, `RPG Merge Policy v0`.
- The prompt includes required reading, strict scope boundaries, concrete code steps, policy classification rules, prompt requirements, sanity-check changes, tests, validation commands, documentation updates, and acceptance criteria.
- Added a brief follow-up roadmap for merge lint, section-aware merge, runtime write merge alignment, real-model evaluation, and review-controlled compression.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- No production code was modified in this pass.
- No merge policy, prompt helper, page-merge behavior, runtime write policy, UI, or real LLM path changed in this pass.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Merge Policy v0

### Stage

RPG-oriented entry merge prompt and policy implementation.

### Changed files

- `src/lib/rpg-merge-policy.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest.ts`
- `src/lib/page-merge.test.ts`
- `src/lib/rpg-merge-policy.test.ts`
- `docs/RPG_MERGE_PROMPT_REDESIGN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-merge-policy.ts` as the path-aware merge policy registry for llmWikiRPG pages.
- The registry classifies merge targets into source evidence, stable operating model, runtime state, relationship tension, plot pressure, event history, current-scene snapshot, manual-control, or generic RPG fallback policies.
- Replaced the production merge system prompt's old encyclopedia contract with a shared RPG runtime utility gate plus category-specific prompt fragments.
- The new prompt explicitly rejects preserving every factual claim as the top priority, asks the model to keep only runtime-useful source-supported material, prevents future-as-fact drift, and separates stable base pages from runtime overlay/current-state pages.
- Updated `MergeFn` to receive a `MergeContext` containing `sourceFileName`, `pagePath`, and `signal`, allowing prompt construction and sanity checks to depend on the target path.
- Updated `mergePageContent()` to pass merge context into the injected merger while preserving deterministic array-field union, locked frontmatter fields, fallback behavior, backup behavior, and `updated` stamping.
- Made body-shrink sanity checks path-aware: runtime-state, relationship-tension, plot-pressure, current-scene, and stable operating model policies allow stronger compression than the old 70% threshold, while generic/unknown paths stay conservative.
- Added unit coverage for merge context propagation, RPG compression acceptance for relationship pages, policy classification, runtime overlay classification, stable base character classification, conservative generic fallback, and prompt regression away from the old `Preserves every factual claim` wording.

### Validation

- `npx.cmd vitest run src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 2 test files passed.
  - 18 tests passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/page-merge.test.ts src/lib/rpg-merge-policy.test.ts` passed.
  - 4 test files passed.
  - 52 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No real LLM merge call was manually exercised.
- No runtime write policy, pending update, UI, context compiler, relationship/tension derivation, outline, or apply behavior was changed.
- No automatic page rewriting/compression pass was added outside the existing LLM merge path.
- No legacy/default project support was reintroduced.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Runtime-Oriented Long Source Signal Extraction v0

### Stage

Third runtime-oriented ingest stage: Long Source Signal Extraction v0.

### Changed files

- `src/lib/rpg-ingest-signals.ts`
- `src/lib/rpg-ingest-signals.test.ts`
- `src/lib/ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RpgIngestSignal` as a pure long-source signal boundary with required fields `kind`, optional `targetPath`, `summary`, `rpUse`, `evidence`, `utilityScore`, `confidence`, and `canonStatus`; optional internal fields include `sourceChunkId`, `targetObject`, `dedupeKey`, and `warnings`.
- Added parser support for fenced `## RP Runtime Signals JSON` chunk output. The parser accepts a JSON array or `{ signals: [...] }`, then normalizes each object before it can reach long-source consolidation.
- Added normalizer safety behavior: invalid signal kinds become `noise`, utility scores are clamped to 0-5, invalid confidence defaults to `low`, invalid canon status defaults to `uncertain`, unsafe or legacy target paths are cleared, non-noise signals missing summary or evidence are downgraded to `noise`, and `noise` signals are capped at utility 0-1.
- Added global signal dedupe/merge by `kind + targetPath/targetObject + normalized summary`. Duplicate signals merge short evidence and RP-use snippets without unbounded growth, keep the highest utility score and confidence, and merge canon status conservatively so uncertain or inferred material is not promoted to canon.
- Extended the long-source chunk system/user prompts to require exactly three sections: `## Chunk Analysis`, fenced `## RP Runtime Signals JSON`, and `## Updated Global Digest`. The prompt includes the 0-5 utility scoring rules and explicitly redirects long route/course material toward `plot-arcs` unless there is a confirmed discrete already-happened event for `events`.
- Updated `analyzeLongSourceInChunks()` to parse each chunk's structured signals, merge them into a checkpointed accumulator, and include `## Structured RP Runtime Signals` in both the precomputed Stage 1 analysis and long-source `sourceContext` before Stage 2 generation.
- Upgraded long-source checkpoints to version 2 with a `signals` array. Older checkpoints without signals are treated as incompatible and safely ignored so the long-source analysis can be regenerated with structured signals instead of resuming without them.
- The structured long-source context now emits a generated `## Source Profile` from high-utility signals so focused Stage 2 page contracts can still activate when long sources bypass the normal single-pass Stage 1 analysis.
- Added signal bucket routing in the consolidated context: utilityScore 3-5 signals are core non-source page material, 4-5 signals are marked as Runtime Capsule priority, utilityScore 2 signals go to REVIEW or Evidence and Uncertainty, and utilityScore 0-1 signals are kept as source-only / ignored noise.
- Strengthened Stage 2 RPG page guidance so `## Structured RP Runtime Signals` is the authoritative long-source generation gate when present, low-scored structured signals cannot generate non-source pages, long plot/course recaps cannot become one long `wiki/events/` page, confirmed discrete events are the only event-page basis, and unresolved conflicts / foreshadowing / possible developments / progression conditions go to `wiki/plot-arcs/` or REVIEW.
- Added focused tests for normalizer behavior, utility clamping, enum defaults, unsafe target path clearing, weak signal downgrade, dedupe/merge caps, conservative canon-status merge, structured context score buckets, long plot recap routing, high-noise metadata handling, chunk prompt requirements, and Stage 2 structured-signal gating.

### Validation

- `npx.cmd vitest run src/lib/rpg-ingest-signals.test.ts` passed.
  - 1 test file passed.
  - 9 tests passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 33 tests passed.
- `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts src/lib/rpg-smoke.test.ts` passed.
  - 2 test files passed.
  - 16 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No Post-Ingest Distiller was implemented.
- No Context Capsule Retrieval was implemented.
- No Relationship/Tension Deriver was implemented.
- No automatic accept/reject/apply review behavior was implemented.
- No automatic page rewriting or compression was implemented.
- No runtime controller or UI behavior was changed for this stage.
- No real LLM long-source run was manually verified; this stage is covered by pure-function tests, prompt contract tests, existing RPG lint/smoke tests, and typecheck.
- Existing legacy `entities` / `concepts` / `sources` code was not deleted.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Runtime-Oriented Ingest Quality Lint v0

### Stage

RPG Runtime-Oriented Ingest Quality Lint v0

### Changed files

- `src/lib/rpg-extraction-validation.ts`
- `src/lib/rpg-extraction-validation.test.ts`
- `src/lib/rpg-smoke.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added lightweight RPG runtime-facing path helpers to skip `wiki/sources/` and structural listing pages while checking non-source RPG pages under world, characters, player, locations, factions, items, plot-arcs, events, current-scene, relationships, style, rules, quests, and memory.
- Added `## Runtime Capsule` presence lint and weak-capsule lint using v0 action hook, constraint/risk, tension/relationship pressure, state-impact, and portrayal/style/atmosphere keyword groups.
- Added runtime-facing soft-budget lint for directory page bodies plus an 800-character Runtime Capsule soft budget. Over-budget pages only create warning/review signals and recommend compression to Runtime Capsule + key evidence.
- Added low-value encyclopedia-noise lint for release/version/platform, voice actor/production metadata, fan tags, trivia, and character profile trivia when the runtime-facing body lacks RP utility signals. Evidence/source-like sections are ignored for this check.
- Strengthened dynamic semantic checks: `wiki/events/` now flags future plans, possible development, foreshadowing, player-choice suggestions, and progression conditions; `wiki/plot-arcs/` flags possible futures written as confirmed facts; current-scene static-source violations now also surface warnings in addition to review items.
- Added review item de-duplication inside `validateRpgExtraction()` with a local `title + affectedPages` key so multiple checks do not push repeated identical review items.
- Added unit coverage for missing capsule, weak capsule, soft budget overflow, low-value encyclopedia noise, event future/unresolved material, plot-arc future-as-fact wording, current-scene warning visibility, and source-page non-regression. Updated the smoke scenario assertion to expect runtime lint review items from historical mock outputs that intentionally lack the new Runtime Capsule contract.

### Validation

- `npx.cmd vitest run src/lib/rpg-extraction-validation.test.ts` passed.
  - 1 test file passed.
  - 15 tests passed.
- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 3 test files passed.
  - 46 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- No Long Source Signal Extraction was implemented.
- No Post-Ingest Distiller was implemented.
- No Context Capsule Retrieval was implemented.
- No Relationship/Tension Deriver was implemented.
- No automatic page rewrite or compression was implemented.
- No automatic accept/reject/apply behavior was added.
- No source-summary write blocking was added.
- No writer strategy, runtime controller, UI, prompt, or real LLM call path change was made.
- No `git commit` or `git push` was performed.

## 2026-06-06 - RPG Runtime-Oriented Ingest Prompt Contract v0

### Stage

First runtime-oriented ingest prompt-contract implementation stage.

### Changed files

- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/rpg-page-guidance.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Enhanced RPG Stage 1 Source Profile with runtime utility focus, noise ratio, and recommended ingest mode so high-noise sources can be routed toward source-only or review-first handling.
- Added per-candidate `runtime_utility`, `runtime_use`, and `canon_status` fields, plus explicit 0-5 runtime scoring rules and a hard gate against creating/updating non-source pages from candidates below 3 except as evidence, merge targets, or REVIEW notes.
- Added a natural-language `## RP Runtime Signals` section for Stage 1 output, covering portrayal, dialogue, behavior boundary, scene affordance, relationship tension, plot pressure, world constraint, action hook, state change, style rule, and noise signals for Stage 2 context.
- Updated Stage 2 generation guidance so non-source RPG pages should include `## Runtime Capsule`, use actionable source-grounded bullets, filter low-value encyclopedia metadata/trivia, and follow soft runtime page budgets.
- Rewrote directory contracts toward runtime components: world constraints, location scene cards, faction pressure sources, item runtime functions, confirmed events, unresolved plot arcs, relationship levers, PC-facing player state, and the then-current gated current-scene snapshot design.
- Compressed the character page contract into a runtime-first operation model with `Runtime Capsule`, `Canon Facts`, `Psychological Model`, `Behavior Rules`, `Dialogue Style`, `Relationship Levers`, and `Evidence and Uncertainty`.
- Updated focused prompt assertions for the new runtime contract wording.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts` passed.
  - 1 test file passed.
  - 30 tests passed.
- `npx.cmd vitest run src/lib/rpg-smoke.test.ts src/lib/rpg-extraction-validation.test.ts` passed.
  - 2 test files passed.
  - 9 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Prompt/helper layer only.
- No long-source chunk signal merge was implemented.
- No post-ingest distiller was implemented.
- No ingest quality lint was implemented.
- No context compiler retrieval change was implemented.
- No Relationship/Tension Deriver was implemented.
- No writer, parser, runtime controller, UI, or real LLM call path was changed.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Runtime-Oriented Ingest Phase 1 Codex Prompt Rewrite

### Stage

Planning/documentation update for the first runtime-oriented ingest prompt-contract phase.

### Changed files

- `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Rewrote the first-stage plan in `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md` into a direct Codex execution prompt that can be copied into a fresh Codex window.
- Added required reading, strict scope boundaries, eight concrete implementation steps, suggested validation commands, acceptance criteria, and required documentation updates for the future execution window.
- Kept the following-stage roadmap after the first-stage prompt intact.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- No production code was modified.
- The first-stage prompt-contract implementation was not executed in this pass.
- No ingest prompt, parser, writer, lint, distiller, context compiler, or deriver behavior was changed.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.13 Runtime Persistence v0

### Stage

Stage 6.13: Runtime Persistence v0.

### Changed files

- `src/lib/rpg-runtime/runtime-persistence.ts`
- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/components/rpg/rpg-runtime-panel.tsx`
- `src/components/rpg/index.ts`
- `src/lib/rpg-runtime-persistence.test.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `src/lib/rpg-runtime/runtime-persistence.ts` as the Stage 6.13 runtime metadata boundary.
- Runtime persistence writes only under `projectPath/.llm-wiki/runtime/`: `turn-records.jsonl`, `pending-updates.json`, and `apply-results.jsonl`.
- Added safe pending queue restore behavior: missing files return an empty queue, corrupt pending JSON returns an empty queue plus warnings, and invalid pending entries are skipped with warnings.
- Added stable JSONL append helpers for turn and apply journals.
- Extended `runRpgRuntimeTurnFlow()` with optional runtime persistence injection. As of Redundancy Cleanup Phase 4, completed turn journal entries use only the interaction proposal source.
- Preserved controller boundaries: it still does not accept, reject, apply, or write wiki files.
- Updated `RpgRuntimePanel` dependencies and helpers so the UI restores pending updates on startup, saves new pending queues after turns, persists accept/reject status changes, saves the remaining queue after apply, and appends apply result journal entries.
- Preserved review/apply semantics: restored accepted updates are not auto-applied, pending/rejected updates are not passed to apply, and apply still goes only through `applyRpgPendingUpdates()`.
- Updated usage/current-state/roadmap docs to mark Stage 6.13 complete and keep Stage 6.14 apply-refresh work as the next stage.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx` passed.
  - 7 test files passed.
  - 61 tests passed.
- `npx.cmd vitest run src/lib/project-mode.test.ts src/lib/wiki-page-types.test.ts src/lib/wiki-type-style.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-interactions.test.ts` passed.
  - 6 test files passed.
  - 65 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.13 does not implement apply-after-write current-scene, file-tree, graph, or UI refresh.
- Stage 6.13 does not implement runtime update semantic validation v1.
- Stage 6.13 does not implement section-aware merge.
- Stage 6.13 does not implement Context Compiler v1.
- Stage 6.13 does not implement relationship/tension derivation.
- Stage 6.13 does not implement outline impact detection or outline regeneration.
- Stage 6.13 does not call a real LLM.
- Stage 6.13 does not modify ingest flow.
- Stage 6.13 does not change `wiki/quests/` Stage 6.12 semantics.
- Stage 6.13 does not reintroduce legacy/default support.
- Runtime journal metadata is not wiki canon; applied wiki updates still use wiki files as the source of truth.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Runtime-Oriented Ingest Follow-up Stage Plan Expansion

### Stage

Planning/documentation update for the follow-up stages after the first runtime-oriented ingest prompt pass.

### Changed files

- `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Expanded the post-first-stage plan from a brief five-item list into concrete Stage 2-6 follow-up plans.
- Added goals, suggested changes, validation criteria, and safety boundaries for Ingest Quality Lint, Long Source Signal Extraction, Post-Ingest Distiller, Context Capsule Retrieval, and Relationship/Tension Deriver.
- Kept the existing first-stage plan for `src/lib/prompts/rpg-ingest.ts` and `src/lib/prompts/rpg-page-guidance.ts` unchanged.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- No production code was modified.
- No ingest prompt, parser, writer, lint, distiller, context compiler, or deriver behavior was changed in this pass.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Final Architecture Runtime-Oriented Ingest Alignment

### Stage

Planning/documentation update for the final architecture ingest layer.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced the old Ingest layer description with a runtime-oriented ingest architecture aligned with `docs/RPG_RUNTIME_ORIENTED_INGEST_PLAN.md`.
- Reframed ingest as a lossy RPG runtime compiler rather than an ordinary encyclopedia generator.
- Added the three-layer ingest model: source evidence layer, RP signal layer, and runtime page layer.
- Added RP utility scoring, `Runtime Capsule` as the ingest/runtime contract, directory-specific runtime goals, source-type routing guidance, and future quality lint / post-ingest distiller notes.
- Preserved the existing static/live write boundary: ordinary static ingest still must not update live `current-scene/`, and legacy FILE block paths remain forbidden.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- No production code was modified.
- No ingest prompt, parser, writer, lint, distiller, or context compiler behavior was changed in this pass.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.12 Runtime Contract Alignment v0

### Stage

Stage 6.12: Runtime Contract Alignment v0.

### Changed files

- `src/lib/rpg-runtime/types.ts`
- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-interactions/wiki-update-policy.ts`
- `src/lib/rpg-interactions/narration-interaction.ts`
- `src/lib/project-mode.ts`
- `src-tauri/src/commands/project.rs`
- `src/lib/project-mode.test.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/wiki-type-style.test.ts`
- `src/lib/rpg-runtime.test.ts`
- `src/lib/rpg-turn-model.test.ts`
- `src/lib/rpg-interactions.test.ts`
- `src/lib/rpg-write-policy.test.ts`
- `src/lib/rpg-state-extractor.test.ts`
- `src/lib/rpg-narration-prompts.test.ts`
- `src/lib/rpg-llm-narration-adapter.test.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Defined `wiki/quests/` as the Stage 6.12 objective tracking directory for goals, tasks, blockers, completion state, and accepted runtime objective changes.
- Added `activeQuests` to `CompactStoryBrief`.
- Added `quests` to the context compiler allowed RPG runtime directories and fixed-read compilation path. Context Compiler v0 now reads `wiki/quests/*.md`, strips unchosen action-option sections, formats quest pages into `brief.activeQuests`, and includes quest pages in `brief.references`.
- Added `wiki/quests/*.md | merge` to the shared runtime update target policy in `src/lib/rpg-interactions/wiki-update-policy.ts`.
- Kept extractor and write policy aligned through the shared target policy: `validateRpgRuntimeUpdateTarget("wiki/quests/main.md", "merge")` passes, while quests with `overwrite` or `append` fail.
- Confirmed stable/manual/base/legacy protections remain in force: `wiki/style/`, `wiki/rules/`, `wiki/sources/`, `wiki/memory/`, base `characters` / `locations` / `factions` / `items`, and legacy directories still fail runtime update/write validation.
- Added `Active Quests` to the narration prompt so objective tracking notes from `CompactStoryBrief.activeQuests` reach narration generation.
- Confirmed `cleanRpgReferences()` allows quest references and continues filtering legacy `entities` / `concepts` / `queries` references.
- Confirmed UI/type/display handling already recognizes quests and added focused recognition/style coverage without redesigning UI or adding runtime panels.
- Aligned frontend and Rust bootstrap schema wording so `wiki/quests/` is described as objective tracking with manual/runtime merge semantics.
- Updated architecture, usage, current-state, and roadmap docs so quests are no longer listed as an unresolved runtime contract gap and Stage 6.13 `Runtime Persistence v0` is the next architecture stage.

### Validation

- `npx.cmd vitest run src/lib/project-mode.test.ts src/lib/wiki-page-types.test.ts src/lib/wiki-type-style.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed.
  - 10 test files passed.
  - 102 tests passed.
- `npx.cmd vitest run src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts` passed.
  - 2 test files passed.
  - 16 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.12 does not implement runtime persistence.
- Stage 6.12 does not implement apply-after-write UI refresh.
- Stage 6.12 does not implement runtime update semantic validation v1.
- Stage 6.12 does not implement section-aware merge.
- Stage 6.12 does not implement Context Compiler v1.
- Stage 6.12 does not implement relationship derivation, outline impact detection, or outline regeneration.
- Stage 6.12 does not call a real LLM.
- Stage 6.12 does not modify ingest flow.
- Stage 6.12 does not reintroduce legacy/default support.
- Unchosen `nextActionOptions` remain excluded from completed turn records, proposed updates, pending updates, write policy input, and quest brief content.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Runtime Roadmap Recalibration After Stage 6.11

### Stage

Planning/documentation update after reviewing the current Stage 6.11 implementation state.

### Changed files

- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_USAGE.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Reframed future implementation so the next target is Stage 6.12 `Runtime Contract Alignment v0`, rather than jumping directly to outline impact detection.
- Added a new future sequence: runtime contract alignment, runtime persistence, apply-refresh UI reliability, runtime update semantic validation, section-aware merge, Context Compiler v1, relationship/tension derivation, outline impact detection, outline regeneration, and project audit/evaluation.
- Preserved the completed Stage 1-6.11 implementation records and updated only future-direction sections.
- Updated the final architecture gap list so the Stage 1-6.11 runtime loop, pending review/apply UI, interaction boundaries, and write policy are treated as existing capabilities.
- Updated usage notes to reflect the current RPG-only `wikiMode: llmwikirpg` boundary and the remaining runtime stability limits.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- No production code was modified.
- No completed Stage 1-6.11 implementation record was rewritten.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.11 RPG LLM Interaction Boundary Consolidation v0

### Stage

Stage 6.11: RPG LLM Interaction Boundary Consolidation v0.

### Changed files

- `src/lib/rpg-interactions/interaction-spec.ts`
- `src/lib/rpg-interactions/narration-interaction.ts`
- `src/lib/rpg-interactions/llm-runtime-update-adapter.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/rpg-runtime/narration-prompts.ts`
- `src/lib/rpg-runtime/narration-adapter.ts`
- `src/lib/rpg-runtime/llm-narration-adapter.ts`
- `src/lib/rpg-runtime/turn-orchestrator.ts`
- `src/components/rpg/rpg-runtime-panel.tsx`
- `src/lib/rpg-interactions.test.ts`
- `src/lib/rpg-narration-prompts.test.ts`
- `src/lib/rpg-llm-narration-adapter.test.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Extended `RpgInteractionKind` with `"narration"`.
- Added `narrationInteractionSpec` under `src/lib/rpg-interactions/`, moving the RPG narration prompt contract into the interaction layer.
- Added narration parse support that extracts fenced JSON, generic fenced JSON, bare JSON, and prose-wrapped JSON, then validates through `validateRpgTurnResult()`.
- Kept `src/lib/rpg-runtime/narration-prompts.ts` as a compatibility wrapper exporting the existing `buildRpgNarrationPrompt()` API while delegating to `narrationInteractionSpec.buildPrompt()`.
- Refactored `createLlmRpgNarrationAdapter()` so it still owns `streamChat()` but delegates output parsing to the narration interaction boundary instead of carrying the JSON extraction/validation logic itself.
- Added `createLlmRpgRuntimeUpdateInteractionAdapter()` under `src/lib/rpg-interactions/`. It streams an `RpgInteractionPrompt` to the configured LLM and returns raw text only.
- Exported the new narration interaction and runtime update LLM adapter from `src/lib/rpg-interactions/index.ts`.
- Updated `RpgRuntimePanelDependencies` with `createUpdateInteractionAdapter` and wired `submitRpgRuntimePanelAction()` to create both narration and runtime update interaction adapters before calling `runRpgRuntimeTurnFlow({ updateInteractionAdapter })`.
- Preserved the controller's narration-block extraction fallback during Stage 6.11 while making the UI default path use the dedicated runtime update interaction. Redundancy Cleanup Phase 4 later removed that fallback and made the adapter required.
- Added/updated tests for narration interaction kind, narration prompt boundary rules, fenced and bare JSON parsing, invalid `RpgTurnResult` rejection, runtime update LLM adapter raw streaming, LLM narration adapter parse delegation, controller adapter-priority behavior, and UI update-adapter injection.

### Validation

- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed.
  - 5 test files passed.
  - 66 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.11 does not implement Stage 7 outline impact detection.
- Stage 6.11 does not implement Stage 8 outline regeneration.
- Stage 6.11 does not implement Stage 9 relationship/tension derivation.
- Stage 6.11 does not add wiki write paths.
- Stage 6.11 does not modify ingest.
- Stage 6.11 does not automatically accept or reject pending updates.
- Stage 6.11 does not call `applyRpgPendingUpdates()` automatically.
- Stage 6.11 does not remove the legacy controller fallback for narration `rpg-wiki-update` blocks.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.10 Runtime Update Interaction Controller Integration v0

### Stage

Stage 6.10: Runtime Update Interaction Controller Integration v0.

### Changed files

- `src/lib/rpg-interactions/runtime-update-adapter.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-interactions.test.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RpgRuntimeUpdateInteractionAdapter` as the injectable adapter boundary for runtime update proposal generation.
- Added `createFixtureRuntimeUpdateInteractionAdapter()` so tests can provide deterministic raw interaction output without calling a real LLM.
- Exported the new adapter type/helper from `src/lib/rpg-interactions`.
- Extended `RunRpgRuntimeTurnFlowInput` with optional `updateInteractionAdapter` at the time; Redundancy Cleanup Phase 4 later made it required.
- Updated `runRpgRuntimeTurnFlow()` so adapter-driven callers first complete the existing `runRpgTurn()` path, then build a runtime update prompt from the completed `RpgTurnRecord`, call `updateInteractionAdapter.generateUpdateProposal(prompt)`, parse the raw output with `runtimeUpdateInteractionSpec.parseOutput()`, and stage the resulting proposed updates with `createPendingRpgUpdates()`.
- Preserved the transition path when no update interaction adapter was injected at the time. Redundancy Cleanup Phase 4 later removed that path; `extractRpgStateUpdates()` remains as the interaction output parser.
- Kept controller warnings merged from turn orchestration plus update interaction parse warnings.
- Added tests proving injected interaction output wins over narration update blocks, interaction output can create pending updates even when narration has no `rpg-wiki-update` block, invalid interaction targets become warnings with no proposed update, and the update prompt does not include unchosen `nextActionOptions` text.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts` passed.
  - 7 test files passed.
  - 65 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.10 does not call a real LLM.
- Stage 6.10 does not write wiki files.
- Stage 6.10 does not call `applyRpgPendingUpdates()`.
- Stage 6.10 does not automatically accept or reject pending updates.
- Stage 6.10 does not modify UI.
- Stage 6.10 does not modify ingest.
- Stage 6.10 does not implement outline impact detection, outline regeneration, relationship/tension derivation, or any Stage 7-9 behavior.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.9 RPG Interaction Contract v0

### Stage

Stage 6.9: RPG Interaction Contract v0.

### Changed files

- `src/lib/rpg-interactions/interaction-spec.ts`
- `src/lib/rpg-interactions/runtime-update-interaction.ts`
- `src/lib/rpg-interactions/wiki-update-policy.ts`
- `src/lib/rpg-interactions/index.ts`
- `src/lib/rpg-runtime/state-extractor.ts`
- `src/lib/rpg-runtime/write-policy.ts`
- `src/lib/rpg-interactions.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the generic `RpgInteractionSpec<TInput, TOutput>` contract with `kind`, `buildPrompt()`, and `parseOutput()` to describe future RPG interaction flows.
- Added `runtimeUpdateInteractionSpec` as the first concrete interaction, focused on runtime state update proposals from a completed `RpgTurnRecord`.
- The runtime update prompt explicitly limits facts to `submittedAction + generatedNarrative + references`, excludes unchosen `nextActionOptions`, and tells the model it may only propose updates rather than claim wiki writes.
- The prompt lists the allowed runtime target rules and keeps the first-version `rpg-wiki-update` fenced-block protocol.
- Added shared runtime update target policy helpers: `getRpgRuntimeUpdateTargetRules()` and `validateRpgRuntimeUpdateTarget()`.
- Reused the shared target policy from both the existing `extractRpgStateUpdates()` path and `applyRpgPendingUpdates()` write policy, keeping deterministic validation aligned.
- Added focused tests for allowed and rejected runtime targets, prompt contents, parseOutput conversion to `ProposedWikiUpdate[]`, invalid path warnings, and read/write-free helper behavior.

### Validation

- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-narration-prompts.test.ts` passed.
  - 7 test files passed.
  - 60 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.9 does not call a real LLM.
- Stage 6.9 does not automatically connect `runtimeUpdateInteractionSpec` to `runRpgRuntimeTurnFlow()`.
- Stage 6.9 does not modify UI.
- Stage 6.9 does not call `applyRpgPendingUpdates()`.
- Stage 6.9 does not write wiki files.
- Stage 6.9 does not implement relationship derivation, outline impact detection, outline regeneration, or other Stage 7-9 behavior.
- Existing runtime controller behavior is intentionally preserved for this stage.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.8 Pending RPG Updates Review + Apply UI v0

### Stage

Stage 6.8: Pending RPG Updates Review + Apply UI v0.

### Changed files

- `src/components/rpg/pending-rpg-updates-panel.tsx`
- `src/components/rpg/index.ts`
- `src/components/rpg/rpg-runtime-panel.tsx`
- `src/components/rpg/pending-rpg-updates-panel.test.tsx`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `PendingRpgUpdatesPanel` as the Stage 6.8 review surface for staged RPG wiki updates.
- The review panel renders each update's `targetPath`, `strategy`, `status`, `reason`, `content`, and `references`.
- Added explicit per-update accept/reject controls. These only call the existing in-memory status helpers through `RpgRuntimePanel` state and do not write wiki files.
- Added a manual `Apply accepted` action that is enabled only when at least one local pending update has `status: "accepted"`.
- Wired the review panel into `RpgRuntimePanel` beside the existing `RpgPlayPanel`, without replacing the runtime turn flow or normal app views.
- Added `applyRpgRuntimePanelAcceptedUpdates()` as the testable UI apply helper. It filters to accepted updates, calls the injected `applyPendingUpdates` dependency, removes applied updates locally, and keeps skipped/pending/rejected updates visible.
- Kept `applyRpgPendingUpdates()` as the only writeback boundary. The UI does not directly write files and still relies on Stage 6 write policy to reject stable/manual/base/legacy paths.
- Displayed the latest apply result with applied updates, skipped updates, and warnings.
- Reset stale apply results when a new runtime turn produces a fresh `pendingUpdates` list.

### Validation

- `npx.cmd vitest run src/components/rpg/pending-rpg-updates-panel.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx` passed.
  - 2 test files passed.
  - 16 tests passed.
- `npx.cmd vitest run src/components/rpg/pending-rpg-updates-panel.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/rpg-play-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 13 test files passed.
  - 82 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.8 does not automatically accept pending updates.
- Stage 6.8 does not automatically apply pending updates.
- Stage 6.8 does not write pending or rejected updates to wiki.
- Stage 6.8 does not bypass `applyRpgPendingUpdates()`.
- Stage 6.8 does not allow UI editing of stable/manual/base/legacy paths.
- Stage 6.8 does not extract facts from `nextActionOptions`.
- Stage 6.8 does not implement outline impact detection, outline regeneration, relationship/tension derivation, or Stage 7-9 behavior.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.7 RPG Play Panel App Integration v0

### Stage

Stage 6.7: RPG Play Panel App Integration v0.

### Changed files

- `src/components/rpg/rpg-runtime-panel.tsx`
- `src/components/rpg/index.ts`
- `src/components/rpg/rpg-runtime-panel.test.tsx`
- `src/components/layout/content-area.tsx`
- `src/components/layout/icon-sidebar.tsx`
- `src/stores/wiki-store.ts`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RpgRuntimePanel` as the app-level container for the existing dumb `RpgPlayPanel`.
- Added `loadRpgCurrentScene()` to read `wiki/current-scene/scene_state.md` and return a clear warning when it is missing.
- Added `submitRpgRuntimePanelAction()` as the testable submit boundary that constructs `createLlmRpgNarrationAdapter()` and calls `runRpgRuntimeTurnFlow()`.
- Updated the panel state after a completed turn with `turnResult.narrative` and `turnResult.nextActionOptions`.
- Displayed loading/disabled state, runtime warnings, runtime errors, and a read-only pending update count/path summary.
- Exported the new runtime panel and helper types from `src/components/rpg/index.ts`.
- Added a dedicated `play` app view and sidebar button so llmWikiRPG users can open the RPG Runtime panel without reusing the normal wiki QA chat.
- Kept existing wiki/chat/source/search/graph/lint/review/settings views intact.
- Recorded that `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` still points to Stage 7 while this product stage needs the pending-review bridge next.

### Validation

- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/rpg-play-panel.test.tsx src/lib/rpg-play-panel-state.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts` passed.
  - 12 test files passed.
  - 76 tests passed.
- `npx.cmd vitest run src/i18n/i18n-parity.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed.
  - 2 test files passed.
  - 15 tests passed.
- `npm.cmd run typecheck` passed.
- `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort false` reached Vite ready state in foreground. Browser-level verification was not completed because the in-app Browser plugin reported that `iab` was unavailable in this session.

### Scope notes

- Stage 6.7 does not call `applyRpgPendingUpdates()`.
- Stage 6.7 does not automatically accept or reject pending updates.
- Stage 6.7 does not implement pending update review/apply buttons.
- Stage 6.7 does not write wiki files.
- Stage 6.7 does not implement outline impact detection/regeneration, relationship derivation, or Stage 7-9 behavior.
- Normal wiki QA chat was not reused as the RPG runtime surface.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.6 Runtime Turn Controller + Pending Output

### Stage

Stage 6.6: Runtime Turn Controller + Pending Output.

### Changed files

- `src/lib/rpg-runtime/runtime-controller.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-runtime-controller.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `runRpgRuntimeTurnFlow()` as the dedicated Stage 6.6 controller.
- Added Stage 6.6 input/result types: `RunRpgRuntimeTurnFlowInput` and `RunRpgRuntimeTurnFlowResult`.
- Reused the existing `runRpgTurn()` boundary instead of duplicating context compilation, prompt construction, narration validation, or turn-record creation.
- Passed the completed `RpgTurnRecord` from `runRpgTurn()` into `extractRpgStateUpdates()`.
- Passed extracted `ProposedWikiUpdate[]` into `createPendingRpgUpdates()`.
- Returned `brief`, `turnResult`, `turnRecord`, `proposedUpdates`, `pendingUpdates`, and merged warnings from turn orchestration plus extraction.
- Kept all new pending updates at default `status: "pending"`.
- Exported the controller helper and types from `src/lib/rpg-runtime`.
- Added focused tests for the full fixture-adapter flow, fenced `rpg-wiki-update` extraction, pending default status, merged warnings, malformed adapter output propagation, read-only behavior, and the absence of automatic accept/reject/apply calls.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts` passed.
  - 1 test file passed.
  - 6 tests passed.
- `npx.cmd vitest run src/lib/rpg-runtime-controller.test.ts src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 10 test files passed.
  - 62 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.6 does not write wiki files.
- Stage 6.6 does not call `acceptPendingRpgUpdate()`, `rejectPendingRpgUpdate()`, or `applyRpgPendingUpdates()`.
- Stage 6.6 does not attach to the RPG Play Panel or UI.
- Stage 6.6 does not call a real LLM in tests; the controller remains adapter-driven.
- Stage 6.6 does not implement outline impact detection/regeneration, relationship derivation, or ingest-flow changes.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6.5 Real RPG Narration Adapter v0

### Stage

Stage 6.5: Real RPG Narration Adapter v0.

### Changed files

- `src/lib/rpg-runtime/llm-narration-adapter.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-llm-narration-adapter.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `createLlmRpgNarrationAdapter()` as the first real LLM-backed `RpgNarrationAdapter`.
- Added Stage 6.5 input/options types: `CreateLlmRpgNarrationAdapterInput` and `LlmRpgNarrationAdapterOptions`.
- Reused the existing `streamChat()` path instead of adding provider-specific RPG LLM logic.
- Converted `RpgNarrationPrompt` into LLM messages with `prompt.systemPrompt` as the system message and `prompt.userPrompt` as the user message.
- Forwarded the provided `AbortSignal` and optional `RequestOverrides` to `streamChat()`.
- Collected streamed tokens into one final output string.
- Parsed `RpgTurnResult` JSON from pure JSON output, markdown fenced JSON blocks, and short prose-wrapped JSON object output.
- Delegated final shape and field validation to the existing `validateRpgTurnResult()` helper.
- Added clear error messages for empty output, missing JSON object, JSON parse failure, LLM streaming error, and malformed `RpgTurnResult` validation failure.
- Exported the Stage 6.5 adapter helper and types from `src/lib/rpg-runtime`.
- Added focused tests that mock `streamChat()` and verify prompt-to-message conversion, supported output shapes, error paths, validation reuse, and streaming error handling.

### Validation

- `npx.cmd vitest run src/lib/rpg-llm-narration-adapter.test.ts` passed.
  - 1 test file passed.
  - 9 tests passed.
- `npx.cmd vitest run src/lib/rpg-llm-narration-adapter.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 9 test files passed.
  - 56 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6.5 does not write wiki files.
- Stage 6.5 does not extract pending updates.
- Stage 6.5 does not call `applyRpgPendingUpdates()`.
- Stage 6.5 does not attach to `runRpgTurn()` by default; it only provides an injectable adapter implementation.
- Stage 6.5 does not attach to the RPG Play Panel or UI.
- Stage 6.5 does not implement outline impact detection/regeneration, relationship derivation, or ingest-flow changes.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 6 Runtime Write Policy

### Stage

Stage 6: Runtime Write Policy.

### Changed files

- `src/lib/rpg-runtime/write-policy.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-write-policy.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `applyRpgPendingUpdates()` as the dedicated Stage 6 runtime write boundary.
- Added Stage 6 result types: `ApplyRpgPendingUpdatesInput`, `AppliedRpgUpdate`, `SkippedRpgUpdate`, and `ApplyRpgPendingUpdatesResult`.
- Applied only `PendingRpgUpdate.status === "accepted"` updates. `pending` and `rejected` updates are returned as skipped and do not write files.
- Revalidated every accepted update at write time: `wiki/current-scene/scene_state.md` requires `overwrite`, direct `wiki/events/*.md` pages require `append`, and direct `wiki/player/*.md`, `wiki/relationships/*.md`, `wiki/plot-arcs/*.md`, plus `characters` / `locations` / `factions` / `items` `runtime/*.md` overlays require `merge`.
- Rejected stable/manual paths (`world`, `style`, `rules`, `sources`), base `characters` / `locations` / `factions` / `items` pages, legacy paths, strategy/path mismatches, and targets outside the runtime write allowlist with skipped results and warnings.
- Constrained actual writes to `projectPath/wiki/...` using resolved filesystem paths, and created parent directories before writing.
- Implemented first-pass write behavior: current-scene overwrite, event append/create, and conservative append-style merge for dynamic pages and runtime overlays.
- Exported the Stage 6 types and helper from `src/lib/rpg-runtime`.
- Added focused tests for accepted current-scene overwrite, event append/create, dynamic merge paths, pending/rejected no-write behavior, legacy/stable/base path rejection, strategy/path mismatch rejection, path escape rejection, and nextActionOptions non-contamination through the accepted pending update flow.

### Validation

- `npx.cmd vitest run src/lib/rpg-write-policy.test.ts` passed.
  - 1 test file passed.
  - 9 tests passed.
- `npx.cmd vitest run src/lib/rpg-write-policy.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 8 test files passed.
  - 47 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 6 does not automatically attach to `runRpgTurn()`.
- Stage 6 does not automatically attach to the RPG Play Panel or UI.
- Stage 6 does not automatically accept pending updates.
- Stage 6 does not call a real LLM.
- Stage 6 does not implement a relationship deriver, outline impact detection, outline regeneration, or ingest-flow changes.
- Stage 6 does not extract or write facts from `RpgTurnResult.nextActionOptions`; it only consumes explicit pending updates.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 5 State Update Extractor + Pending Updates

### Stage

Stage 5: State Update Extractor + Pending Updates.

### Changed files

- `src/lib/rpg-runtime/state-extractor.ts`
- `src/lib/rpg-runtime/update-staging.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-state-extractor.test.ts`
- `src/lib/rpg-update-staging.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `extractRpgStateUpdates()` as a pure in-memory extractor from completed `RpgTurnRecord` to `ProposedWikiUpdate[]`.
- Added Stage 5 types: `RpgUpdateStrategy`, `ProposedWikiUpdate`, `ExtractRpgStateUpdatesInput`, `ExtractRpgStateUpdatesResult`, `PendingRpgUpdateStatus`, and `PendingRpgUpdate`.
- Used explicit fenced `rpg-wiki-update` blocks inside `turnRecord.generatedNarrative` as the deterministic extraction input. The extractor does not accept `RpgTurnResult`, does not see `nextActionOptions`, and does not read wiki files.
- Added runtime update path gating: `wiki/current-scene/scene_state.md` requires `overwrite`; direct `wiki/events/*.md` pages require `append`; direct `wiki/player/*.md`, `wiki/relationships/*.md`, `wiki/plot-arcs/*.md`, and `characters` / `locations` / `factions` / `items` `runtime/*.md` overlays require `merge`.
- Filtered legacy paths, stable/manual paths (`world`, `style`, `rules`), and base `characters` / `locations` / `factions` / `items` pages from proposed runtime updates with warnings.
- Added `createPendingRpgUpdates()`, `acceptPendingRpgUpdate()`, and `rejectPendingRpgUpdate()` for in-memory pending update staging. New pending updates default to `status: "pending"`; accept/reject only changes the selected update status.
- Exported the Stage 5 types and helpers from `src/lib/rpg-runtime`.
- Added focused tests for proposed update extraction, unchosen option exclusion, allowed strategy/path combinations, legacy/base/stable path filtering, pending default status, accept/reject behavior, and no wiki file reads/writes in Stage 5 helpers.

### Validation

- `npx.cmd vitest run src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts` passed.
  - 2 test files passed.
  - 11 tests passed.
- `npx.cmd vitest run src/lib/rpg-state-extractor.test.ts src/lib/rpg-update-staging.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 7 test files passed.
  - 38 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 5 does not implement a runtime write API.
- Stage 5 does not apply pending updates or write wiki files.
- Stage 5 does not call a real LLM or reuse normal wiki QA chat.
- Stage 5 does not implement relationship derivation, outline impact detection, outline regeneration, or ingest-flow changes.
- Unchosen `nextActionOptions` remain excluded because the extractor only accepts completed `RpgTurnRecord` data.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Stage 4.5 Runtime Turn Orchestrator + Narration Adapter

### Stage

Stage 4.5: Runtime Turn Orchestrator + Narration Adapter.

### Changed files

- `src/lib/rpg-runtime/turn-orchestrator.ts`
- `src/lib/rpg-runtime/narration-adapter.ts`
- `src/lib/rpg-runtime/turn-model.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-turn-orchestrator.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated single-turn orchestrator entry, `runRpgTurn()`, that calls the existing read-only runtime preview/context compiler, builds an RPG narration prompt, invokes an injected narration adapter, validates the returned `RpgTurnResult`, and creates a completed `RpgTurnRecord`.
- Added the replaceable `RpgNarrationAdapter` boundary and `createFixtureNarrationAdapter()` for deterministic tests and later model integration.
- Added `validateRpgTurnResult()` to reject malformed adapter output: missing/empty narrative, option counts outside 3 to 5, invalid option shape, invalid `intent` / `riskLevel`, invalid `likelyAffectedPaths`, and non-array `references`.
- Reused the existing RPG reference cleaning/filtering rules for validated turn results and completed records, preserving the legacy path filter.
- Exported the Stage 4.5 types and helpers from `src/lib/rpg-runtime`.
- Added focused tests for the full `SubmittedAction -> CompactStoryBrief -> RpgNarrationPrompt -> RpgTurnResult -> RpgTurnRecord` flow, current-scene/player/character runtime-overlay context inclusion, malformed output rejection, unchosen option exclusion from completed records, and read-only/no-pending-update behavior.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts` was run first and initially failed because the test expected raw fixture reference order while validation now cleans and sorts references. The test assertion was corrected to expect the validated reference order.
- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-prompts.test.ts src/lib/rpg-play-panel-state.test.ts` passed.
  - 5 test files passed.
  - 27 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 4.5 remains read-only after context compilation: no runtime write API, no pending updates, no state extractor, no relationship deriver, no outline impact/regeneration, and no wiki writes.
- No real LLM network call was added; narration remains adapter-driven and fixture-testable.
- Normal wiki QA chat was not reused as RPG runtime.
- Unchosen `nextActionOptions` remain future candidates only and are excluded from `RpgTurnRecord`.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Architecture roadmap recalibration after schema overlay

### Stage

Planning/documentation update after the final schema overlay contract.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Updated the final architecture runtime directory list to include `wiki/characters/runtime/`, `wiki/locations/runtime/`, `wiki/factions/runtime/`, and `wiki/items/runtime/`.
- Recorded that the final schema overlay contract has landed in bootstrap/category/schema/test coverage, while runtime write APIs and pending updates remain unimplemented.
- Reframed the remaining architecture work so the next step is not another isolated skeleton module.
- Added Stage 4.5 `Runtime Turn Orchestrator + Narration Adapter` as the next recommended implementation target: a thin single-turn flow connecting context compilation, narration prompt construction, model/fixture adapter output, `RpgTurnResult` validation, and `RpgTurnRecord` creation.
- Moved Stage 5 `State Update Extractor + Pending Updates` to follow Stage 4.5, so pending updates are extracted from a real completed turn record instead of another disconnected fixture-only seam.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- Did not implement Stage 4.5 runtime orchestration.
- Did not implement real model calls, runtime write APIs, pending updates, state extraction, relationship derivation, or outline regeneration.
- No `git commit` or `git push` was performed.

## 2026-06-06 - Final schema overlay contract

### Stage

Final architecture schema contract: base pages plus runtime overlays.

### Changed files

- `src/lib/project-mode.ts`
- `src-tauri/src/commands/project.rs`
- `src/lib/rpg-categories.ts`
- `src/lib/rpg-wiki-schema.ts`
- `src/lib/project-mode.test.ts`
- `src/lib/rpg-wiki-schema.test.ts`
- `src/lib/wiki-page-types.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `wiki/characters/runtime`, `wiki/locations/runtime`, `wiki/factions/runtime`, and `wiki/items/runtime` to llmWikiRPG bootstrap directory creation.
- Rewrote the bootstrap schema contract around `llmwikirpg` only, rejected legacy llm_wiki directories, runtime wiki directory write policies, overlay resolution, dynamic update rules, and frontmatter examples.
- Updated `characters`, `locations`, `factions`, and `items` category/schema wording so static ingest writes stable source-supported base pages while runtime/current campaign changes belong in matching `runtime/` overlays.
- Kept the 11 core RPG extraction categories unchanged; overlay directories are not new extraction category ids.
- Added focused tests for overlay bootstrap directories, schema text boundaries, stable category runtime-overlay wording, unchanged schema/category counts, and runtime subdirectory path inference.

### Validation

- `npx.cmd vitest run src/lib/project-mode.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/wiki-page-types.test.ts src/lib/rpg-runtime.test.ts` passed.
  - 4 test files passed.
  - 25 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement runtime write APIs, pending updates, relationship derivation, state extraction, or outline regeneration.
- Did not change the FILE block protocol.
- Did not delete legacy directories or user files.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Stage 4 RPG Play Panel v0

### Stage

Stage 4: RPG Play Panel v0.

### Changed files

- `src/components/rpg/rpg-play-panel.tsx`
- `src/components/rpg/current-scene-panel.tsx`
- `src/components/rpg/action-options-panel.tsx`
- `src/components/rpg/turn-narrative-panel.tsx`
- `src/components/rpg/index.ts`
- `src/components/rpg/rpg-play-panel.test.tsx`
- `src/lib/rpg-runtime/play-panel-state.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-play-panel-state.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added independent RPG play UI components under `src/components/rpg/`, separate from normal wiki QA chat.
- Added `RpgPlayPanel` to show the current scene, last narrative, future candidate action options, freeform action input, selected option state, and the most recently submitted action.
- Added `CurrentScenePanel`, `TurnNarrativePanel`, and `ActionOptionsPanel` as focused display components.
- Added `src/components/rpg/index.ts` so Stage 4 components can be imported from `src/components/rpg`.
- Added pure play-panel state helpers in `src/lib/rpg-runtime/play-panel-state.ts`, exported from `src/lib/rpg-runtime`.
- Selecting a candidate option constructs `SubmittedAction` with `id`, `text` from `option.playerFacingText`, `source: "selected_option"`, and `selectedOptionId`.
- Submitting freeform input constructs `SubmittedAction` with `id`, trimmed `text`, `source: "freeform"`, and no `selectedOptionId`.
- `nextActionOptions` are displayed and modeled as future candidate actions only. The Stage 4 semantic helper keeps them out of completed narrative, submitted-action records for unselected options, pending wiki updates, and any wiki writeback concept.

### Validation

- `npx.cmd vitest run src/lib/rpg-play-panel-state.test.ts src/components/rpg/rpg-play-panel.test.tsx` passed.
  - 2 test files passed.
  - 10 tests passed.
- `npx.cmd vitest run src/lib/rpg-narration-prompts.test.ts` passed.
  - 1 test file passed.
  - 7 tests passed.
- `npx.cmd vitest run src/lib/rpg-turn-model.test.ts` passed.
  - 1 test file passed.
  - 4 tests passed.
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passed.
  - 1 test file passed.
  - 5 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 4 remains fully read-only: no real LLM calls, no automatic wiki updates, no state extraction, no pending updates, and no wiki writeback.
- Stage 4 does not overwrite `current-scene`, append `events`, update `relationships`, or modify any wiki files.
- Stage 4 does not delete or alter legacy `entities`, `concepts`, or `sources` behavior.
- The UI does not reuse the normal wiki QA chat panel as the RPG runtime main interface.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Stage 3 Narration Prompt Builder

### Stage

Stage 3: Narration Prompt Builder.

### Changed files

- `src/lib/rpg-runtime/narration-prompts.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-narration-prompts.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added independent RPG narration prompt types under the dedicated runtime module: `BuildRpgNarrationPromptInput` and `RpgNarrationPrompt`.
- Added pure `buildRpgNarrationPrompt()`, which accepts a `CompactStoryBrief` and returns `{ systemPrompt, userPrompt }` for a future narration LLM call.
- The prompt uses `brief.submittedAction` as the only submitted action for the turn and includes the compact brief fields: current scene, player state, hard facts, active constraints, present characters, relationship tensions, plot pressure, relevant locations/factions/items, style/rules/memory notes, forbidden contradictions, and references.
- The prompt requests strict `RpgTurnResult`-compatible JSON with `narrative`, `nextActionOptions`, and `references`.
- The prompt requires 3 to 5 `nextActionOptions`, lists the required `RpgActionOption` fields, and enumerates allowed `intent` and `riskLevel` values.
- The prompt explicitly states that unchosen `nextActionOptions` are candidate future actions, not completed facts; they must not be written into `narrative` as happened outcomes, and later state extraction must not extract facts from them.
- Exported the Stage 3 types and helper from `src/lib/rpg-runtime`.

### Validation

- `npx.cmd vitest run src/lib/rpg-narration-prompts.test.ts` passed.
  - 1 test file passed.
  - 7 tests passed.
- `npx.cmd vitest run src/lib/rpg-turn-model.test.ts` passed.
  - 1 test file passed.
  - 4 tests passed.
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passed.
  - 1 test file passed.
  - 5 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 3 remains fully read-only: no LLM calls, no real narration generation, no state extraction, no wiki writeback, and no UI changes.
- The prompt builder does not reuse normal wiki QA chat prompts.
- No wiki files were created or changed by the helper; read-only behavior is covered by the new prompt test.
- No legacy `entities`, `concepts`, or `sources` behavior was removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Stage 2 RPG Turn Model

### Stage

Stage 2: RPG Turn Model.

### Changed files

- `src/lib/rpg-runtime/turn-model.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-turn-model.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added independent RPG turn model types under the dedicated runtime module: `RpgActionIntent`, `RpgRiskLevel`, `RpgActionOption`, `RpgTurnResult`, `RpgTurnRecord`, and `CreateRpgTurnRecordInput`.
- Added pure `createRpgTurnRecord()`, which builds a completed record only from `SubmittedAction`, `turnResult.narrative`, and cleaned references.
- Deliberately excludes `turnResult.nextActionOptions` from `RpgTurnRecord`, so unchosen options and their `playerFacingText` cannot be serialized as completed facts.
- Cleans references by trimming empty strings, normalizing backslashes to `/`, collapsing duplicate slashes, removing duplicate paths, stable sorting, keeping only allowed RPG wiki reference directories, and filtering legacy directories.
- Exported the Stage 2 types and helper from `src/lib/rpg-runtime`.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-model.test.ts` passed.
  - 1 test file passed.
  - 4 tests passed.
- `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passed.
  - 1 test file passed.
  - 5 tests passed.
- `npm.cmd run typecheck` passed.

### Scope notes

- Stage 2 remains fully read-only: no LLM calls, no narration generation, no state extraction, no wiki writeback, and no UI changes.
- No normal chat message type was reused as an RPG turn record.
- No legacy `entities`, `concepts`, or `sources` behavior was removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Stage 1 RPG Runtime Agent v0

### Stage

Stage 1: RPG Runtime Agent v0 (read-only).

### Changed files

- `src/lib/rpg-runtime/types.ts`
- `src/lib/rpg-runtime/context-compiler.ts`
- `src/lib/rpg-runtime/runtime-agent.ts`
- `src/lib/rpg-runtime/index.ts`
- `src/lib/rpg-runtime.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added an independent RPG runtime module separate from normal wiki QA chat.
- Added `SubmittedAction`, `CompileRpgContextInput`, `RunRpgRuntimePreviewInput`, `CompactStoryBrief`, and `RpgRuntimePreviewResult`.
- Added `runRpgRuntimePreview()`, which validates `wikiMode === "llmwikirpg"`, calls the internal context compiler, and returns `{ submittedAction, brief, warnings }`.
- Added read-only Context Compiler v0 that compiles deterministic brief context from RPG runtime allowed directories only.
- Fixed `current-scene` reads to `wiki/current-scene/scene_state.md` and emits a warning when it is missing.
- Reads `player/`, high-priority `style/`, `rules/`, and `memory`, plus relevant `events`, `plot-arcs`, `relationships`, and action-matched `characters`, `locations`, `factions`, and `items`.
- Keeps `wiki/sources/` as reference paths only, not hard facts.
- Ignores legacy directories: `entities`, `concepts`, `queries`, `comparisons`, `synthesis`, `methodology`, `findings`, and `thesis`.
- Strips unchosen next-action option sections before wiki content enters the brief.
- Supports base page plus runtime overlay reads, such as `wiki/characters/rin.md` with `wiki/characters/runtime/rin.md`, using deterministic append.
- Uses stable sorting, relevance scoring, and truncation without LLM compression.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime.test.ts` passed.
  - 1 test file passed.
  - 5 tests passed.
- `npm.cmd run typecheck` passed.
- A parallel validation attempt that included `npx.cmd vitest run src/lib/rpg-runtime.test.ts` failed before running tests because Vitest resolved the suite from the sandbox wrapper cwd (`C:/Users/CodexSandboxOffline/.codex/.sandbox/...`). The same Vitest command was rerun by itself from the project workdir and passed as recorded above.

### Scope notes

- Stage 1 remains fully read-only: no narration generation, no action option generation, no state extraction, and no wiki writeback.
- No legacy directory behavior was removed.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Revise next architecture target to Runtime Agent v0

### Stage

Architecture planning documentation only; not a new implementation stage.

### Changed files

- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Re-read the final runtime architecture around the `PlayTurn` flow and revised the next-step roadmap so the first implementation target is read-only RPG Runtime Agent v0.
- Repositioned Context Compiler v0 as the first internal capability of the Runtime Agent rather than an isolated module.
- Added the recommended stage-1 boundary: accept `SubmittedAction`, compile `CompactStoryBrief`, ignore legacy directories and unchosen options, and perform no narration, state extraction, or wiki writeback.
- Updated the recommended execution order and acceptance criteria to start from a dedicated runtime entry separated from normal wiki QA chat.

### Validation

- Documentation-only change; no tests were run.

### Scope notes

- No production code was modified.
- No `git commit` or `git push` was performed.

## 2026-06-05 - Rust warning cleanup

### Stage

Backend maintenance / warning cleanup.

### Changed files

- `src-tauri/src/commands/codex_cli.rs`
- `src-tauri/src/clip_server.rs`
- `src-tauri/src/commands/fs.rs`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Removed the unused Windows `CommandExt` import from Codex CLI console suppression.
- Stopped resetting `restart_count` immediately after a successful clip-server bind, so the existing max-restart guard can actually count server-loop exits.
- Replaced irrefutable DOCX table `if let` patterns with direct `let` destructuring.
- Removed unused DOCX fallback XML parser variables and assignments.

### Validation

- `rustfmt --edition 2021 --check src\commands\codex_cli.rs src\clip_server.rs src\commands\fs.rs` passes.
- `cargo check --no-default-features --color never` was attempted from `src-tauri/`, but dependency build stopped because `protoc` is not installed for `lance-encoding`; no project Rust source error was reached.

## 2026-06-05 - RPG-only hard cutover

### Stage

Mode removal / product hard cutover.

### Changed files

- `src/lib/project-mode.ts`
- `src/lib/wiki-mode.ts`
- `src/commands/fs.ts`
- `src-tauri/src/commands/project.rs`
- `src/lib/ingest.ts`
- `src/lib/prompts/rpg-ingest.ts`
- `src/lib/prompts/shared-ingest.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/review/review-view.tsx`
- `src/components/layout/knowledge-tree.tsx`
- `src/components/layout/activity-panel.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/settings/sections/maintenance-section.tsx`
- `src/lib/deep-research.ts`
- `src/lib/graph-relevance.ts`
- `src/lib/wiki-graph.ts`
- `src/lib/rpg-extraction-validation.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`
- targeted mode/prompt/RPG tests
- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `README.md`
- `README_CN.md`
- `README_JA.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Collapsed project/wiki mode handling to `llmwikirpg` only and made `default` / legacy llm_wiki metadata reject opening instead of falling back or migrating.
- Changed project creation so frontend and Rust backend create RPG projects directly, with RPG directories and RPG metadata/schema markers.
- Removed default prompt/template branches and made analysis/generation prompt builders call the RPG prompt builders directly.
- Added write-boundary rejection for legacy FILE blocks under `entities`, `concepts`, `queries`, `comparisons`, `synthesis`, `methodology`, `findings`, and `thesis`; rejected legacy writes also create review items explaining the failure.
- Converted user saved chat/review/research output away from `wiki/queries/` and into `wiki/memory/`, without follow-up legacy query auto-ingest.
- Hid legacy directories from visible wiki UI grouping and removed the exposed duplicate entity/concept maintenance tool from settings.
- Updated visible branding and README docs to llmWikiRPG while keeping `.llm-wiki/` as the internal metadata directory.

### Validation

- `npm.cmd run typecheck` passes.
- Targeted Vitest bundle passes: `ingest.prompt.test.ts`, `ingest.scenarios.test.ts`, `rpg-smoke.test.ts`, `rpg-wiki-schema.test.ts`, `rpg-dynamic-update.test.ts`, `rpg-extraction-validation.test.ts`, `project-mode.test.ts`, `wiki-mode.test.ts`, `wiki-page-types.test.ts`, and `wiki-type-style.test.ts` pass with 10 files / 96 tests.
- `cargo check` was attempted from `src-tauri/`, but dependency build stopped because `protoc` is not installed for `lance-encoding`; no project Rust source error was reached.

### Notes

- Existing user files in legacy directories are not deleted automatically.
- Some old helper modules and tests still contain legacy fixtures but are no longer product paths for new/opened RPG projects.

## 2026-06-05 - Update RPG-only architecture docs

### Stage

Documentation alignment after mode removal.

### Changed files

- `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Rewrote the final architecture document around the RPG-only product boundary: only `llmwikirpg` projects are valid, legacy/default projects are rejected, legacy llm_wiki directories are not product capabilities, and `wiki/sources/` is retained as the RPG evidence layer.
- Updated the final architecture sections for project validation, runtime wiki directories, ingest behavior, relationship/tension derivation, runtime write policy, module boundaries, acceptance criteria, and non-goals.
- Rewrote the next architecture steps document so follow-up implementation starts from the post-cutover state and targets RPG Runtime Context Compiler v0, not mode migration or compatibility cleanup.
- Added explicit next-step safeguards that runtime context compilation and runtime writeback must ignore/reject legacy directories even if old files exist on disk.

### Validation

- Searched both architecture docs for stale compatibility claims such as retaining legacy default mode or treating `entities`/`concepts`/`queries` as live product paths; remaining references describe removed/rejected legacy behavior only.

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

- Merged player-character, former current-scene-state, discrete-event, plot-arc, relationship, character-trait/trivia, wiki-noise, location, and faction boundary warnings into their glossary definitions.
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

Post-v0.2 current-scene marker gate hardening: replaced live/current-scene heuristic admission with an explicit input marker. This historical design has now been superseded by the ordinary-ingest block.

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

- Prompt changes at that historical point added live-input profile fields and explicit rules for a marker-gated `current-scene` path.
- Stage 2 guidance at that historical point parsed a live-scene flag and filtered `current-scene` out of focused contracts unless it was explicitly enabled; this is now superseded by the ordinary-ingest block.
- Writer validation at that historical point allowed `wiki/current-scene/` writes only when the source contained the old marker; this is now superseded by the ordinary-ingest block.
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

- Added a required RPG Stage 1 `## Source Profile` structure with `source_kind`, `dominant_focus`, `needed_categories`, `suppressed_categories`, and `event_extraction_mode`; a former live-scene flag from that era is no longer part of the current prompt contract.
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
- Tightened RPG analysis and generation prompts so the then-current scene-state type listed both the allowed live-input cases and the disallowed static-source cases, including the required explicit current-scene example and the blocked `HF True End` flower-viewing example.
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
- Added the required classification list directly into the RPG analysis and generation prompts, including the then-current scene-state type alongside source, world, character, location, faction, item, plot, event, relationship, trait/trivia, and noise types.
- Added explicit routing instructions for those types in generation guidance, including `world_fact -> wiki/world/` versus legacy-compatible `wiki/concepts/` fallback wording, `player_character -> wiki/player/` only under explicit current-PC evidence, `character_trait_or_trivia` merge-into-character behavior, and `wiki_noise` ignore behavior.
- Tightened prompt wording so the then-current scene-state type was only valid for runtime scene input or live session-state material, not static lore.
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
