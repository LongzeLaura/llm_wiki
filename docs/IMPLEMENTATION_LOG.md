# Implementation Log

## 2026-06-15 - Agent Runtime Prompt / Compiler Alignment Rule

### Stage

Documented a standing agent rule for runtime prompt/compiler alignment after repeated hidden failures from prompt schemas drifting away from local compilers.

### Changed files

- `AGENTS.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated `Runtime Prompt / Compiler Alignment` section to `AGENTS.md`.
- Required any runtime-flow change to audit prompt text, LLM draft schema, parser, compiler, validator, and debug trace handoff together.
- Required prompt schemas to expand critical nested fields instead of relying on abstract aliases such as `DraftX[]`, `object`, or `lightweight draft`.
- Required prompt text to use compiler-recognized field names and explicitly avoid natural-language aliases when the compiler only accepts a fixed field such as `summary`.
- Required prompt text not to ask the model to output canonical fields that local compilers forbid; locally derived fields should stay derived, and missing evidence should become skip/review-only rather than a fabricated ordinary update.
- Required focused prompt/contract regression tests when changing high-risk runtime fields such as nested arrays, source refs, happened status, actor knowledge, reveal metadata, and target-path policy.

### Validation

- Documentation-only change; no runtime tests were run.

### Scope notes

- Did not modify runtime code, compiler behavior, validator behavior, write/apply policy, provider behavior, or any legacy/default compatibility path.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Update Proposal Prompt Slimming

### Stage

Targeted final-step slimming for `runtime_update_proposal` after a real debug trace showed the provider emitted reasoning-only output on an oversized final prompt.

### Changed files

- Slimmed prompt handoff only: `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated focused contract tests: `src/lib/rpg-runtime-update-proposal.test.ts`
- Rebuilt runtime worker bundle: `dist-runtime/rpg-runtime-worker.mjs`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a prompt-only `buildRuntimeUpdatePromptSources()` compaction layer for LLM 6.
- Kept `RuntimeUpdateProposalInput` complete for local draft compilation, source-delta derivation, actor-knowledge metadata, pacing compilation, and strict validation.
- Replaced the full `runtime-update-proposal-structured-current-turn-sources` JSON with compact source cards for working state, action resolution, world tick, recall, outline handoff, narration, and consistency validation.
- Removed redundant nested `postActionWorkingState.actionResolution`, `postActionWorkingState.worldTickResult`, and `postActionWorkingState.visibleSelection` from the model-facing prompt.
- Removed `turnNarration.nextActionOptions` details from the model-facing prompt and retained only `nextActionOptionCount`, because next action options are possible future choices and not writable facts.
- Recalled material sections now expose metadata, knowledge-claim summaries, and short excerpts instead of full section content.
- Audited the final prompt for the earlier World Tick-style failure mode. The `RuntimeUpdateProposalDraft` output schema now remains concrete rather than `DraftX[]`-style abstract aliases, and reveal-progress guidance tells the model to use `skippedDeltas` / `review_only` when compact input lacks reveal metadata instead of proposing ordinary updates that cannot pass canonical validation.
- Added regression coverage to prevent the final prompt from re-expanding full nested canonical objects or next-action details.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-runtime-update-proposal.test.ts --exclude='**/*.real-llm.test.ts'` passed: 1 file, 29 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not relax Runtime Update Proposal parsing, draft compilation, canonical validation, target policy, actor knowledge checks, reveal gates, persistence boundary, pending staging, apply/write policy, or path containment.
- Did not add provider fallback, retry-on-provider-failure, legacy/default compatibility, old-path preservation, schema field invention, or silent parser fallback.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Repair Retry All LLM Stages

### Stage

Extended the explicit soft semantic repair retry option from Action Resolver to every runtime LLM stage, and added a default-off debug UI switch.

### Changed files

- Shared repair prompt / schema plumbing: `src/lib/rpg-interactions/runtime/soft-semantic-repair-retry.ts`, runtime interaction schema exports under `src/lib/rpg-interactions/runtime/`
- Adapter interfaces and LLM adapters: Action / World Tick / Recall / Outline / Story Outline / Narration / Runtime Update adapter files under `src/lib/rpg-interactions/runtime/`
- Runtime flow integration: `src/lib/rpg-runtime/turn-orchestrator.ts`, `src/lib/rpg-runtime/runtime-controller.ts`
- Debug UI and option pass-through: `src/components/rpg/rpg-runtime-debug-console.tsx`, `src/components/rpg/rpg-runtime-panel.tsx`
- Focused tests: `src/lib/rpg-soft-semantic-repair-retry.test.ts`, `src/lib/rpg-runtime-controller.test.ts`, `src/components/rpg/rpg-runtime-debug-console.test.tsx`, `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a shared `parseSoftSemanticRawOutputWithOptionalRepairRetry()` helper that records the initial failure, builds a short repair-only prompt, reruns the stage parser/compiler/validator, and writes repair retry state into the existing debug trace fields.
- Extended repair retry to Action Resolver, World Tick, Recall Selector, Outline Brief, Story Outline Regenerator, Narration Generator, and Runtime Update Proposal.
- Made repair prompt safety instructions stage-specific. Runtime Update Proposal repair is allowed to repair draft JSON but is explicitly forbidden from creating pending updates, applying updates, writing files, or claiming persistence.
- Added repair raw-output methods to every LLM adapter, using `temperature: 0` / `max_tokens: 1800` by default and supporting `repairRequestOverrides`.
- Unified Recall Selector, Outline Brief, Story Outline Regenerator, and Runtime Update Proposal JSON parsing with `parseSoftSemanticJsonOutput()` so local JSON recovery reports are visible in trace.
- Added a default-off “修复重试” checkbox in the RPG debug console. Runtime panel passes `{ enabled: true, maxAttempts: 1 }` only when that switch is enabled.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-soft-semantic-repair-retry.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx --exclude='**/*.real-llm.test.ts'` passed: 5 files, 64 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not enable repair retry by default.
- Did not connect repair retry to `runtime_update_validation`, `pending_update_persistence`, apply-pending, or write policy.
- Did not relax target path policy, actor knowledge checks, reveal gates, canonical validators, persistence gates, pending eligibility, or path containment.
- Did not add enum repair, schema field invention, legacy/default fallback, old-path compatibility, or silent parser fallback.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Draft Prompt Schema Hardening

### Stage

Targeted prompt/contract hardening after real runtime trace analysis found World Tick field-name drift (`settlementSummary` instead of required `summary`).

### Changed files

- Hardened World Tick draft prompt schema: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Hardened Runtime Update Proposal draft prompt schema: `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Hardened Outline Brief affected-ref prompt schema: `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Added prompt regression assertions: `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-runtime-update-proposal.test.ts`, `src/lib/rpg-outline-brief.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Expanded the model-facing `WorldTickDraft` contract so nested draft item shapes are explicit instead of only named as `DraftWorldDelta[]`, `DraftSettledOngoingEvent[]`, and similar abstract aliases.
- Explicitly told World Tick to use `summary` for all delta-like entries and not use natural-language aliases such as `settlementSummary`, `broadcastSummary`, `reactionSummary`, `description`, or `text`.
- Expanded `RuntimeUpdateProposalDraft.pacingUpdateProposal` from `null or lightweight pacing draft` into the concrete fields required by the local compiler.
- Expanded `RuntimeUpdateProposalDraft.skippedDeltas[].sourceRef` from `object` into the concrete lightweight source ref shape with required `reason`.
- Expanded `OutlineBriefDraft.outlineImpactReport.affected` so narrative lines and stable-ref arrays have explicit item shapes.
- Added prompt regression assertions for the hardened contract text.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 122 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not change runtime compiler or validator behavior.
- Did not add fallback aliases, schema field completion, enum repair, repair retry expansion, provider-native structured output, legacy/default compatibility, old-path preservation, or silent parser fallback.
- Did not modify Runtime Update Validation, Pending Persistence, Apply/write policy, target policy, actor knowledge checks, reveal gates, canonical validators, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 6

### Stage

Implemented Phase 6 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: prompt and schema slimming follow-up for soft semantic runtime stages.

### Changed files

- Slimmed Action Resolver draft contract/compiler: `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts`, `src/lib/rpg-interactions/runtime/action-resolver-draft-compiler.ts`
- Slimmed World Tick prompt and draft reference/warning contract: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Slimmed Narration Generator draft prompt requirements: `src/lib/rpg-interactions/runtime/narration-generator-interaction.ts`
- Updated contract matrix classification: `src/lib/rpg-runtime/contract-classification.ts`
- Added / updated focused tests: `src/lib/rpg-action-resolver-draft-compiler.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-narration-draft-compiler.test.ts`, `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-narration-generator.test.ts`, `src/lib/rpg-interactions.test.ts`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/RPG_RUNTIME_FORMATTING_AUDIT_AND_CONTRACT_MATRIX_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced Action Resolver model-facing `references` / structured `warnings` envelopes with `referencePaths?: string[]` and `warnings?: string[]`; the compiler now creates canonical references and structured warnings locally.
- Marked Action Resolver string-array fields in `parsedIntent`, `eventDraft`, and `playerActionDelta` as output-only-when-useful in the prompt; omitted arrays remain normal optional draft protocol and do not create loose recovery warnings.
- Added `buildWorldTickActionBrief()` and changed World Tick prompt assembly to pass that compact brief instead of full `ActionResolution` plus separate player delta/time delta sections.
- Removed `tickId`, reference envelope, and warning envelope from the World Tick model-facing draft contract; local compilation now owns those canonical fields.
- Made Narration prompt requirements lighter: `narrationSelfReport`, tension signal arrays, and `nextActionOptions[].likelyAffectedPaths` are optional/derivable and defaulted by the compiler when omitted.
- Updated runtime contract classification to match the new lightweight draft fields and derivable metadata responsibilities.
- Added prompt budget/schema regression coverage to guard against reintroducing full canonical handoffs or old envelopes into soft semantic prompts.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-compact-prompt.test.ts src/lib/rpg-runtime-formatting-audit.test.ts --exclude='**/*.real-llm.test.ts'` passed: 5 files, 43 tests.
- `npm.cmd exec -- vitest run src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-compact-prompt.test.ts src/lib/rpg-runtime-formatting-audit.test.ts src/lib/rpg-action-resolver.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-contract-classification.test.ts --exclude='**/*.real-llm.test.ts'` passed: 9 files, 129 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not expand repair retry to World Tick or Narration Generator.
- Did not add provider-native structured output, fallback, enum correction, schema field completion, or legacy/default compatibility.
- Did not modify Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply/write policy, target policy, actor knowledge checks, reveal gates, canonical validators, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 5

### Stage

Implemented Phase 5 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: trace, metrics, and developer visibility for soft format recovery.

### Changed files

- Extended structured trace fields: `src/lib/rpg-runtime/debug-trace.ts`
- Recorded recovery events from runtime flow: `src/lib/rpg-runtime/turn-orchestrator.ts`
- Added recovery summaries and aggregate metrics: `src/lib/rpg-runtime/formatting-audit.ts`
- Updated debug console display: `src/components/rpg/rpg-runtime-debug-console.tsx`
- Added / updated focused tests: `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-runtime-debug-trace-export.test.ts`, `src/lib/rpg-runtime-formatting-audit.test.ts`, `src/components/rpg/rpg-runtime-debug-console.test.tsx`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `formatRecoveryApplied`, `localRepairOperations`, `looseCoercions`, `repairRetryAttempted`, `repairRetrySucceeded`, and `repairRetryFailureSummary` to `RpgRuntimeDebugStep`.
- Added trace store methods to record local JSON recovery, loose draft coercions, and repair retry results while preserving existing raw output, validation sections, and warning strings.
- Updated the turn orchestrator so `JSON 提取与本地修复`, `loose_draft_coercion`, and repair retry summary sections also populate the new structured fields.
- Extended formatting audit rows with per-step `formatRecovery` and added `formatRecoveryMetrics` grouped by `stepId`.
- Updated the RPG debug console to show compact recovery summaries only when recovery exists, with expandable details for local repair operations, loose coercions, and repair retry status.
- Kept trace export redaction behavior intact while preserving the new recovery fields.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-debug-trace-export.test.ts src/lib/rpg-runtime-formatting-audit.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx --exclude='**/*.real-llm.test.ts'` passed: 4 files, 29 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not expand repair retry to World Tick or Narration Generator.
- Did not add new soft recovery behavior, fallback, enum correction, schema field completion, or legacy/default compatibility.
- Did not modify Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply/write policy, target policy, actor knowledge checks, reveal gates, canonical validators, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 4

### Stage

Implemented Phase 4 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: preserve the canonical validation boundary after soft format recovery.

### Changed files

- Tightened World Tick draft parsing: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Updated boundary policy wording: `src/lib/rpg-runtime/validation-boundary.ts`
- Added / updated focused tests: `src/lib/rpg-action-resolver-draft-compiler.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-narration-draft-compiler.test.ts`, `src/lib/rpg-runtime-validation-boundary.test.ts`, `src/lib/rpg-runtime-contract-classification.test.ts`, `src/lib/rpg-runtime-persistence-boundary.test.ts`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Changed `parseRpgWorldTickOutput(output, input)` so prompted World Tick output is treated as `WorldTickDraft` and compiled before `validateWorldTickResult()`; raw canonical `WorldTickResult` validation remains only for the no-input local fixture/canonical path.
- Kept Action Resolver and Narration Generator on the existing draft compiler then strict canonical validator path.
- Added tests proving loose draft recovery does not repair invalid happened/status/intent/risk enums, forbidden safety keys, or player-facing knowledge leaks.
- Extended validation-boundary policy notes to document the ordered layers: JSON extraction/local repair, loose draft coercion, optional repair-only retry, draft compiler, canonical validation, then hard persistence gates.
- Added persistence boundary coverage proving rejected targets and unsafe player knowledge claims are excluded before `createPendingRpgUpdates()`.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-validation-boundary.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-persistence-boundary.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'` passed: 7 files, 65 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not expand repair retry to World Tick or Narration Generator.
- Did not add soft JSON repair, loose draft coercion, repair retry, fallback, or legacy/default compatibility to Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply, or write policy.
- Did not relax target path policy, actor knowledge checks, reveal gates, happened-status checks, pending eligibility, apply/write containment, or canonical validators.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 3

### Stage

Implemented Phase 3 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: one-shot repair-only retry for Action Resolver soft semantic output, behind an explicit runtime option.

### Changed files

- Added shared repair prompt builder: `src/lib/rpg-interactions/runtime/soft-semantic-repair-retry.ts`
- Exported helper: `src/lib/rpg-interactions/runtime/index.ts`
- Updated Action Resolver prompt/schema and adapter: `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts`, `src/lib/rpg-interactions/runtime/action-resolver-adapter.ts`, `src/lib/rpg-interactions/runtime/llm-action-resolver-adapter.ts`
- Updated runtime option plumbing and trace retry path: `src/lib/rpg-runtime/turn-orchestrator.ts`, `src/lib/rpg-runtime/runtime-controller.ts`, `src/lib/rpg-runtime/runtime-controller-client.ts`, `src/lib/rpg-runtime/node-worker/run-turn-worker.ts`, `src-tauri/src/commands/rpg_runtime.rs`
- Added / updated focused tests: `src/lib/rpg-soft-semantic-repair-retry.test.ts`, `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-runtime/runtime-controller-client.test.ts`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `buildSoftSemanticRepairRetryPrompt()` for short repair-only prompts that include failed output, precise failure summary, optional JSON parse report, the minimal draft schema, and JSON-only repair instructions.
- Extracted `ACTION_RESOLUTION_DRAFT_SCHEMA_PROMPT_LINES` so the normal Action Resolver prompt and repair prompt share the same draft schema.
- Added optional `repairActionResolutionRawOutput()` to `RpgActionResolverAdapter`; the LLM adapter reuses `streamChat` and defaults repair calls to `temperature: 0` / `max_tokens: 1800`, with `repairRequestOverrides` available.
- Added `softSemanticRepairRetry` option through runtime turn, controller, client, Node worker, and Tauri command input. The option defaults off.
- Wired Action Resolver raw-output debug parsing so explicitly enabled repair retry can run once after mechanical format failures only, then reruns the same local parser / draft compiler / canonical validator path.
- Debug trace now records the initial repair-eligible failure, repair raw output, and repair summary; successful repair adds `repair_retry_succeeded: action_resolver`.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-soft-semantic-repair-retry.test.ts src/lib/rpg-action-resolver.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-soft-semantic-json.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 47 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.
- `cargo check --manifest-path src-tauri\Cargo.toml` was attempted and still fails in the existing local environment because `lance-encoding` cannot find `protoc`.

### Scope notes

- Did not enable repair retry by default.
- Did not add repair retry to World Tick, Narration Generator, Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply, or any persistence/write boundary.
- Did not repair invalid semantic enums, missing required semantic fields, forbidden safety keys, forbidden persistence claims, forbidden write targets, provider failures, or input assembly failures.
- Did not add legacy/default compatibility, old-path preservation, full prompt rerun fallback, silent parser fallback, schema key completion, or enum correction.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 2

### Stage

Implemented Phase 2 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: auditable local JSON extraction and conservative repair for soft semantic runtime outputs.

### Changed files

- Added shared JSON recovery helper: `src/lib/rpg-interactions/runtime/soft-semantic-json.ts`
- Exported helper: `src/lib/rpg-interactions/runtime/index.ts`
- Updated soft semantic parsers: `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts`, `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`, `src/lib/rpg-interactions/runtime/narration-generator-interaction.ts`
- Updated trace recording: `src/lib/rpg-runtime/turn-orchestrator.ts`
- Added / updated focused tests: `src/lib/rpg-soft-semantic-json.test.ts`, `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-narration-generator.test.ts`, `src/lib/rpg-runtime-debug-trace.test.ts`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `parseSoftSemanticJsonOutput()` with a structured report and `SoftSemanticJsonParseError` for `json_extract_failed` / `malformed_json` mechanical format failures.
- Consolidated Action Resolver, World Tick, and Narration Generator JSON extraction around the shared helper while preserving existing `interactionSpec.parseOutput(output, input)` call shape.
- Added optional `onJsonParseReport` collectors to the three public parser functions so raw-output debug paths can record parse/recovery reports without changing adapter interfaces.
- Local repair is intentionally narrow: markdown fence removal, surrounding prose trim, trailing comma removal, delimiter-position smart quote normalization, and raw newline escaping inside JSON strings.
- The repair helper does not synthesize fields, add missing commas, modify enums, relax validators, rewrite safety keys, or touch persistence/write boundaries.
- `runRpgTurn()` now records a `JSON 提取与本地修复` validation section for raw soft semantic output and emits `json_format_recovery` warnings when local repair changes the text.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-soft-semantic-json.test.ts src/lib/rpg-action-resolver.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'` passed: 5 files, 71 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not implement Phase 3 repair-only LLM retry, retry fallback, missing-comma guessing, schema key completion, enum correction, or silent parser fallback.
- Did not connect local JSON repair to Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply, legacy/default compatibility, or old-path preservation.
- Did not relax canonical validators, target policy, actor knowledge, reveal gate, write policy, pending eligibility, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 1

### Stage

Implemented Phase 1 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: loose draft normalization for low-risk soft semantic array fields.

### Changed files

- Extended shared soft draft helpers: `src/lib/rpg-interactions/runtime/soft-draft-protocol.ts`
- Updated draft compilers: `src/lib/rpg-interactions/runtime/action-resolver-draft-compiler.ts`, `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`, `src/lib/rpg-interactions/runtime/narration-generator-draft-compiler.ts`
- Updated trace classification: `src/lib/rpg-runtime/debug-trace.ts`
- Updated focused tests: `src/lib/rpg-action-resolver-draft-compiler.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-narration-draft-compiler.test.ts`, `src/lib/rpg-runtime-debug-trace.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added shared `readStringArrayLoose()` and `readArrayLoose()` helpers plus `SoftDraftLooseCoercion` warning formatters.
- Action Resolver now compiles `parsedIntent` explicitly and accepts low-risk loose array shapes for listed draft string-array fields, including `playerActionDelta.notes: string -> string[]`.
- World Tick now accepts `null -> []` for optional draft arrays, trims string arrays, and wraps single `warnings` / `references` objects when unambiguous.
- Narration Generator now accepts loose warning/tension-signal/path arrays while keeping player-facing leak checks and action option canonical validation intact.
- Accepted loose forms are surfaced as `loose_draft_coercion` warnings, which the existing turn orchestrator records in debug trace step warnings.
- Narrowed debug trace phase inference so `parsedIntent` field names are no longer misclassified as parse failures.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 41 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not implement JSON local repair, repair-only retry, broken JSON parser fallback, retry fallback, legacy/default compatibility, old-path preservation, or silent validator relaxation.
- Did not relax Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply/write policy, actor knowledge, reveal gate, target policy, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Soft Format Recovery Phase 0

### Stage

Implemented Phase 0 from `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`: baseline audit, failure taxonomy, trace labeling, and real-trace-derived regression fixtures only.

### Changed files

- Updated trace classification: `src/lib/rpg-runtime/debug-trace.ts`
- Updated trace error sections: `src/lib/rpg-runtime/turn-orchestrator.ts`, `src/lib/rpg-runtime/runtime-controller.ts`
- Updated audit/category metadata: `src/lib/rpg-runtime/contract-classification.ts`, `src/lib/rpg-runtime/formatting-audit.ts`
- Updated focused tests: `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-runtime-contract-classification.test.ts`, `src/lib/rpg-runtime-formatting-audit.test.ts`, `src/lib/rpg-action-resolver-draft-compiler.test.ts`
- Updated docs: `docs/RPG_RUNTIME_SOFT_FORMAT_RECOVERY_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Recorded the current soft semantic parse/compile/validate paths for Action Resolver, World Tick, and Narration Generator.
- Added optional `origin`, `kind`, and `category` fields to `RpgRuntimeDebugError` while preserving the existing `phase` field for old trace compatibility.
- Added failure classifications for JSON extraction failure, malformed JSON, loose scalar array, loose single-object array, null optional field, forbidden safety key, semantic contract failures, safety failures, and persistence boundary failures.
- Updated orchestrator and controller error sections so debug trace JSON includes `phase / origin / kind / category / message`.
- Added a sanitized regression fixture based on the real `playerActionDelta.notes: string` trace shape. It still fails, but the trace now classifies it as `loose_scalar_array / mechanical_format`.
- Updated formatting audit to use the new error metadata and distinguish mechanical format failures from draft validation and canonical validation failures.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-formatting-audit.test.ts src/lib/rpg-action-resolver-draft-compiler.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 23 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not implement loose draft normalization, JSON local repair, repair-only retry, parser fallback, retry fallback, legacy/default compatibility, old-path preservation, or silent validator relaxation.
- Did not relax Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply/write policy, actor knowledge, reveal gate, target policy, or path containment.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Runtime Update Validation Trace Fix

### Stage

Implemented a focused Runtime Update Validation fix from the first completed real loop trace: reduce false positives without weakening persistence boundaries.

### Changed files

- Updated runtime validation: `src/lib/rpg-interactions/runtime/runtime-update-validation.ts`
- Updated focused tests: `src/lib/rpg-runtime-update-validation.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Investigated `rpg-runtime-trace-rpg-action-1-mqeie0jp.json`; the rejected character runtime update was a false positive caused by the status sentence “玩家未采取后续行动”, not actual candidate-action storage.
- Added a negated-action-status strip before candidate-action pollution matching so “not yet taken a follow-up action” can remain accepted state while future/candidate action wording is still rejected.
- Narrowed current-scene sync heuristics so ordinary scene wording like “观测装备”, “尚未触发关键揭示”, and “已完成目视检查” no longer triggers inventory, plot-arc, or outline-progress missing-sync warnings.
- Confirmed the `synthetic.whole` recall messages are still first-version retrieval index warnings for pages without stable section metadata; this change did not alter recall indexing.

### Validation

- `npm.cmd exec -- vitest run src/lib/rpg-runtime-update-validation.test.ts` passed: 1 file, 17 tests.
- `npx vitest ...` was attempted first and blocked by the local PowerShell execution policy, so verification used `npm.cmd exec`.

### Scope notes

- Did not relax runtime target policy, actor knowledge checks, reveal gate checks, pending persistence, apply/write policy, or unsafe path containment.
- Did not add legacy/default compatibility, old-path preservation, parser repair, retry repair, silent fallback, or automatic update synthesis.
- No `git commit` or `git push` was performed.

## 2026-06-15 - RPG Recall Selector Draft Compiler

### Stage

Implemented a focused Recall Selector slimming pass: LLM output is now a minimal `RecallSelectionDraft`, compiled locally into canonical `RecallSelection`.

### Changed files

- Added draft compiler: `src/lib/rpg-interactions/runtime/recall-selector-draft-compiler.ts`
- Added draft types: `src/lib/rpg-runtime/types.ts`
- Updated Recall Selector prompt/parser/exports: `src/lib/rpg-interactions/runtime/recall-selector-interaction.ts`, `src/lib/rpg-interactions/runtime/index.ts`
- Updated focused tests: `src/lib/rpg-recall-selector.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- The model-facing contract now asks only for allowlist selection fields: path, read mode, priority, reason, expected use, stable section ids, and concrete exclusions.
- The compiler derives `selectionId`, `sourceWorkingStateId`, line target, visibility scope, knowledge scope, recall budget, recall policy, canonical selected sections, and empty warnings before running strict `validateRecallSelection()`.
- Draft outputs containing protocol/budget/policy/warning/boundary fields, write proposals, narration, recalled material content, or outline-regeneration output now hard fail instead of being stripped or repaired.
- Downstream runtime interfaces remain canonical: adapters still return `RecallSelection`, and recall handoff / Outline Brief / Narration / Runtime Update Proposal continue to consume canonical selection data.

### Validation

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 53 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not add broken-JSON repair, retry repair, silent parser fallback, legacy/default compatibility, migration fallback, old-path preservation, or automatic recall fallback.
- Did not relax Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply, target policy, actor knowledge, reveal gate, or write-path containment.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Soft Draft Derivable Field Containment

### Stage

Implemented a focused non-writeback runtime fix for B-class derivable protocol fields across World Tick, Action Resolver, Outline Brief, Narration Generator, and Story Outline Regenerator.

### Changed files

- Added shared soft draft helper: `src/lib/rpg-interactions/runtime/soft-draft-protocol.ts`
- Updated soft semantic draft compilers/prompts: Action Resolver, World Tick, Outline Brief, Narration Generator, Story Outline Regenerator runtime interaction files.
- Updated focused tests: `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-action-resolver-draft-compiler.test.ts`, `src/lib/rpg-outline-brief.test.ts`, `src/lib/rpg-narration-draft-compiler.test.ts`, `src/lib/rpg-story-outline-regenerator.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- World Tick no longer exposes old canonical `RuntimeDeltaRef`, `WorldTickVisibilityMeta`, or `WorldTickDeltaBase` output contracts in the prompt. Draft output must focus on semantic fields; local compiler generates canonical runtime refs and visibility.
- The trace shape `runtimeDeltaRefs: ["player-action-delta-rpg-action-1"]` is now accepted in World Tick draft parsing without leaking a string into canonical validation.
- Action Resolver and Narration Generator now strip model-authored derivable protocol fields such as IDs, runtime refs, narration metadata, option protocol, and source refs, then generate canonical values locally while preserving hard failures for unsafe write/prose pollution.
- Outline Brief now derives `briefId` locally and strips full reference envelope metadata from draft refs. Unknown refs and GM-only player-facing refs remain hard failures.
- Story Outline Regenerator now has a raw-output draft compiler. It derives patch/proposal/handoff IDs, non-persistence/review boundaries, runtime refs, and visibility/outline refs from input while still requiring key semantic fields and safety conclusion.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-action-resolver.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-story-outline-regenerator.test.ts --exclude='**/*.real-llm.test.ts'` passed: 5 files, 89 tests.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not relax Runtime Update Proposal, Runtime Update Validation, Pending Persistence, Apply, target policy, actor knowledge, reveal gate, or write-path containment.
- Did not add legacy/default compatibility, old-path preservation, broken-JSON repair, retry repair, parser fallback, automatic writeback, or persistence fallback.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Outline Brief Plot-arc Fuel Deterministic Compiler

### Stage

Implemented a focused runtime fix for the Outline Brief failure found in `rpg-runtime-trace-rpg-action-1-mqdu55xh.json`: remove model-authored `plotArcFuelRefs` and derive canonical plot-arc fuel references locally from `sourceFuelIds`.

### Changed files

- Updated Outline Brief draft compiler: `src/lib/rpg-interactions/runtime/outline-brief-draft-compiler.ts`
- Updated Outline Brief prompt contract: `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Updated focused tests: `src/lib/rpg-outline-brief.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `OutlineBriefDraft.tensionBriefInput` no longer accepts `plotArcFuelRefs`.
- The prompt now tells the LLM to select plot-arc fuel only via `tensionLineUpdateCandidate.sourceFuelIds`, copied from the `Plot-arc 张力燃料` `fuelId` values.
- The compiler resolves selected fuel ids against `input.plotArcTensionFuel`, dedupes ids while preserving order, and emits canonical `plotArcFuel` references with deterministic `path`, `sectionId`, `stableId`, `lineTarget`, `usePurpose`, `visibilityScope`, and `knowledgeScope`.
- Unknown fuel ids hard fail with a `sourceFuelIds[index]` error. Legacy `plotArcFuelRefs` is now a forbidden draft key and hard fails instead of being ignored or repaired.
- If a tension candidate omits `sourceFuelIds`, the compiler keeps the previous default of using all `input.plotArcTensionFuel`; if no tension candidate exists, it emits no plot-arc fuel.

### Validation

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts --exclude='**/*.real-llm.test.ts'` passed: 1 file, 24 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not change recall/input-builder plot-arc fuel collection.
- Did not add legacy/default compatibility, migration fallback, old-path preservation, path guessing, filesystem lookup, parser repair, retry repair, broken-JSON sanitizer, or silent protocol fallback.
- Did not relax canonical validators or wiki write/pending/apply policy.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Persistence Boundary Consolidation

### Stage

Implemented Phase G from `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md`: consolidate hard persistence acceptance around Runtime Update Proposal, deterministic validation, pending staging, and final apply/write policy.

### Changed files

- Added shared persistence gate: `src/lib/rpg-runtime/persistence-boundary.ts`
- Exported persistence boundary helpers: `src/lib/rpg-runtime/index.ts`
- Wired controller validation/staging through the shared gate: `src/lib/rpg-runtime/runtime-controller.ts`
- Added persistence boundary summary to turn journal/shared persistence types: `src/lib/rpg-runtime/runtime-persistence-shared.ts`, `src/lib/rpg-runtime/runtime-persistence.ts`, `src/lib/rpg-runtime/runtime-persistence-client.ts`
- Reused the same gate from import staging: `src/lib/rpg-import/runtime-update-apply.ts`
- Clarified hard boundary policy notes: `src/lib/rpg-runtime/validation-boundary.ts`, `src/lib/rpg-runtime/contract-classification.ts`
- Added / updated focused tests: `src/lib/rpg-runtime-persistence-boundary.test.ts`, `src/lib/rpg-runtime-controller.test.ts`, `src/lib/rpg-runtime-validation-boundary.test.ts`, `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated docs: `docs/RPG_RUNTIME_FORMATTING_AUDIT_AND_CONTRACT_MATRIX_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `validateRpgRuntimePersistenceBoundary()` now combines runtime target policy, runtime update validation, warning/rejection aggregation, pending eligibility ids, and review-only audit item tracking.
- `summarizeRpgRuntimePersistenceBoundary()` records proposal count, accepted/rejected/pending counts, pending eligible ids, rejected issue codes, warning issue codes, and review-only audit ids for debug trace and journal use.
- `runRpgRuntimeTurnFlow()` now stages pending updates only from persistence-gate accepted updates. Soft semantic handoffs, skipped deltas, outline revision reviews, pacing proposals, journal entries, and proposal groups remain audit/review material and are not promoted into pending updates.
- `runtime_update_apply stage_pending` now uses the same shared gate as the controller instead of duplicating target-policy and validation composition.
- `apply_pending` remains the final filesystem write gate and still applies only accepted pending updates after rechecking target policy and project wiki path containment.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-persistence-boundary.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-runtime-write-policy-client.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime-validation-boundary.test.ts --exclude='**/*.real-llm.test.ts'` passed: 8 files, 91 tests.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not relax canonical validators, Runtime Update Proposal validation, Runtime Update Validation, Pending Update Persistence, wiki writeback, or pending/apply policy.
- Did not add legacy/default compatibility, migration fallback, old-path preservation, old full-canonical prompt fallback, parser repair, retry repair, broken-JSON sanitizer, or silent protocol fallback.
- Runtime Update Proposal remains the only LLM-facing ordinary wiki write-intent stage; final acceptance stays deterministic.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Compact Handoff + Stage Compiler Slimming

### Stage

Implemented Phase E and Phase F from `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md`: compact semantic handoff for non-writeback downstream LLM prompts plus draft/compiler slimming for Action Resolver and Narration Generator.

### Changed files

- Added turn handoff builder: `src/lib/rpg-runtime/turn-semantic-handoff.ts`
- Added handoff types and exports: `src/lib/rpg-runtime/types.ts`, `src/lib/rpg-runtime/index.ts`
- Wired turn/controller/journal/persistence handoff state: `src/lib/rpg-runtime/turn-orchestrator.ts`, `src/lib/rpg-runtime/turn-model.ts`, `src/lib/rpg-runtime/runtime-controller.ts`, `src/lib/rpg-runtime/runtime-persistence-shared.ts`
- Replaced downstream prompt expansion with compact handoff: `src/lib/rpg-runtime/recall-selector-input-builder.ts`, `src/lib/rpg-runtime/recall-selector-handoff.ts`, `src/lib/rpg-runtime/outline-brief-handoff.ts`, `src/lib/rpg-runtime/outline-brief-input-builder.ts`, `src/lib/rpg-runtime/narration-input-builder.ts`, runtime interaction prompt files for recall, outline brief, narration, and story outline regeneration
- Added Action Resolver draft compiler: `src/lib/rpg-interactions/runtime/action-resolver-draft-compiler.ts`
- Added Narration Generator draft compiler: `src/lib/rpg-interactions/runtime/narration-generator-draft-compiler.ts`
- Updated runtime adapters/exports/fixtures/tests to use draft parsing and compiled canonical outputs
- Added focused tests: `src/lib/rpg-turn-semantic-handoff.test.ts`, `src/lib/rpg-runtime-compact-prompt.test.ts`, `src/lib/rpg-action-resolver-draft-compiler.test.ts`, `src/lib/rpg-narration-draft-compiler.test.ts`
- Updated docs: `docs/RPG_RUNTIME_FORMATTING_AUDIT_AND_CONTRACT_MATRIX_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `TurnSemanticHandoff` now carries submitted action, action outcome, time advance, confirmed / attempted-or-blocked / ongoing / possible-future separation, PC-visible / PC-inferred / user-visible-PC-unknown / GM-only-control boundaries, risk and pressure signals, open questions, candidate paths, capped reference allowlist, and warnings.
- Handoff builders cap semantic list lengths, reference allowlist size, warning count, summary length, and serialized prompt size. Reference paths are deduped before prompt handoff.
- `runRpgTurn()` builds the compact handoff after World Tick / working-state construction and passes it through result, turn record, controller journal, and debug trace while preserving full canonical objects for local audit, compilers, validators, Runtime Update Proposal, and persistence validation.
- Recall Selector, Outline Brief, Narration Generator, and triggered Story Outline Regenerator no longer prompt-expand full canonical `ActionResolution`, `WorldTickResult`, or `PostActionWorkingState`; they consume compact handoff plus their bounded stage-specific materials.
- Outline Brief retains its existing draft/compiler flow, but its prompt now caps outline/control slices, plot-arc fuel, hard constraints, and known references.
- `ActionResolutionDraft` is the model-facing Action Resolver contract. The compiler derives IDs, runtime delta refs, reference envelopes, default arrays, and canonical structure, then calls strict `validateActionResolution()`. It preserves `attempted_not_confirmed` and does not silently promote attempts to confirmed events.
- `TurnNarrationDraft` is the model-facing Narration Generator contract. The compiler derives narration metadata, display defaults, player-knowledge-boundary metadata, source refs, option IDs, option-only future status, references, and canonical structure, then calls strict `validateTurnNarration()`.
- Story Outline Regenerator compiler redesign remains deferred; this pass only ensures prompt input uses compact handoff plus outline-specific control materials.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-semantic-handoff.test.ts src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-compact-prompt.test.ts --exclude='**/*.real-llm.test.ts'` passed: 4 files, 6 tests.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts --exclude='**/*.real-llm.test.ts'` passed: 12 files, 212 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not relax canonical validators, Runtime Update Proposal validation, Runtime Update Validation, Pending Update Persistence, wiki writeback, or pending/apply policy.
- Did not add legacy/default compatibility, migration fallback, old-path preservation, old full-canonical prompt fallback, parser repair, retry repair, broken-JSON sanitizer, or silent protocol fallback.
- Full canonical objects remain local controller/audit/writeback data; compact semantic handoff is prompt input only and is never promoted directly into accepted wiki facts.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Soft/Hard Boundary + World Tick Containment

### Stage

Implemented Phase C and Phase D from `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md`: explicit soft/hard validation boundary policy plus first World Tick contract containment pass.

### Changed files

- Added validation boundary helper: `src/lib/rpg-runtime/validation-boundary.ts`
- Exported validation boundary helpers: `src/lib/rpg-runtime/index.ts`
- Contained World Tick draft optional-by-design arrays: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Added compact World Tick semantic handoff: `src/lib/rpg-runtime/world-tick-working-state.ts`
- Recorded semantic handoff in debug trace: `src/lib/rpg-runtime/turn-orchestrator.ts`
- Added / updated focused tests: `src/lib/rpg-runtime-validation-boundary.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-world-tick-working-state.test.ts`
- Updated docs: `docs/RPG_RUNTIME_FORMATTING_AUDIT_AND_CONTRACT_MATRIX_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `getRpgRuntimeValidationBoundaryPolicies()` and `getRpgRuntimeValidationBoundaryPolicy(stepId)` now derive boundary policy from the existing Phase B contract matrix.
- Soft semantic stages now have an explicit policy where semantic/safety errors interrupt, while `derivable_protocol_omitted` is compiler/warning input rather than a hard persistence acceptance path.
- Runtime Update Proposal, Runtime Update Validation, and Pending Update Persistence are explicitly marked as hard/deterministic persistence boundaries.
- World Tick draft string arrays now treat missing arrays, empty arrays, and blank-only arrays as undeclared draft protocol. For `affectedPaths`, this means the compiler derives deterministic non-empty paths before canonical validation.
- Canonical `WorldTickResult` validation remains strict. Without prompt input, missing or empty canonical `affectedPaths` still fail.
- Added `WorldTickSemanticHandoff` to summarize action outcome, confirmed / ongoing / possible-future material, PC-visible material, user-visible PC-unknown signals, tension/gap/pacing information, candidate paths, and warnings.
- The orchestrator records the semantic handoff in World Tick debug trace but still keeps the full canonical `WorldTickResult` and `PostActionWorkingState`; downstream prompt replacement remains Phase E.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-validation-boundary.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'` passed: 7 files, 54 tests.

### Scope notes

- Did not relax canonical validators, add fallback, parser repair, retry repair, sanitizer behavior, legacy/default compatibility, or old-path preservation.
- Did not change wiki writeback, pending/apply policy, persistence behavior, LLM provider transports, or runtime stage order.
- Did not perform Phase E compact semantic prompt replacement; full canonical objects may still be consumed by downstream builders.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Formatting Audit + Contract Matrix

### Stage

Implemented Phase A and Phase B from `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md` as an observation/classification layer.

### Changed files

- Added formatting audit helper: `src/lib/rpg-runtime/formatting-audit.ts`
- Added runtime contract matrix: `src/lib/rpg-runtime/contract-classification.ts`
- Exported new runtime helpers: `src/lib/rpg-runtime/index.ts`
- Added focused tests: `src/lib/rpg-runtime-formatting-audit.test.ts`, `src/lib/rpg-runtime-contract-classification.test.ts`
- Added implementation note: `docs/RPG_RUNTIME_FORMATTING_AUDIT_AND_CONTRACT_MATRIX_PLAN.md`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `buildRuntimeFormattingAuditReport()` now turns existing debug traces into a `runtimeFormattingAudit` table with per-step input / prompt / raw output / parsed output / validation / handoff char totals, top prompt sections, top input assembly contributors, and failure frontier classification.
- Real pending steps after a failed step are marked `blocked_by_previous_failure`; pre-run unknown real steps remain `unknown_real_model_cost`; synthetic full-flow rows are labelled `synthetic` and are explicitly not real model behavior or cost data.
- Added failure frontier categories for input assembly, provider/transport, parse, draft validation, compiler, canonical validation, write safety, persistence, and unknown failures.
- Added a typed contract classification matrix for Action Resolver, World Tick, Recall Selector, Outline Brief, Story Outline Regenerator, Narration Generator, Runtime Update Proposal, Runtime Update Validation, and Pending Persistence.
- The matrix records field categories `semantic_required`, `semantic_optional`, `derivable_protocol`, `dangerous_forbidden`, and `persistence_hard_boundary`, plus stable error category names such as `missing_semantic_field`, `unsafe_knowledge_boundary`, `unknown_reference`, `derivable_protocol_omitted`, and `forbidden_persistence_claim`.
- World Tick `affectedPaths`, runtime refs, source ids, visibility envelopes, time basis, reference metadata, IDs, and default arrays are classified as `derivable_protocol` for later containment work.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-formatting-audit.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts --exclude='**/*.real-llm.test.ts'` passed: 5 files, 47 tests.

### Scope notes

- Observation/classification only: did not change runtime prompts, parser behavior, compiler behavior, validator strictness, orchestrator stage order, wiki writeback, pending/apply policy, persistence behavior, fallback behavior, parser repair, retry repair, sanitizer behavior, legacy/default compatibility, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Formatting Reduction Assessment

### Stage

Documented a higher-level runtime architecture assessment focused on reducing unnecessary formatting and canonical validation in non-persistence runtime stages.

### Changed files

- Added assessment: `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Recorded the latest World Tick `affectedPaths: []` failure as a symptom of over-strict intermediate runtime protocol boundaries rather than just a single field bug.
- Classified runtime formatting into necessary safety protocol, locally derivable engineering protocol, and intermediate semantic protocol.
- Recommended concentrating hard validation at the real wiki persistence boundary: Runtime Update Proposal, deterministic pending validation, apply, and write policy.
- Recommended using soft semantic contracts for non-writeback stages such as Action Resolver, World Tick, Outline Brief, and Narration, with deterministic compilers filling IDs, references, visibility envelopes, runtime refs, default arrays, and affected paths.
- Recommended compact semantic handoff packets between stages instead of repeatedly feeding full canonical runtime objects back into prompts.
- Expanded the follow-up roadmap into Phase A-G so the proposed protocol strategy has concrete deliverables: failure-frontier audit, contract classification matrix, soft/hard validation boundary design, World Tick containment, compact semantic handoff, stage-specific compiler slimming, and persistence boundary consolidation.

### Validation

- Documentation-only change; no code tests were run.

### Scope notes

- Did not modify runtime code, prompts, parsers, compilers, validators, orchestration, wiki writeback, pending/apply boundaries, fallback behavior, parser repair, sanitizer behavior, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Outline/Update Draft Compiler Phase 1/2

### Stage

Implemented Phase 1 and Phase 2 of `docs/RPG_RUNTIME_DRAFT_COMPILER_REFACTOR_PLAN.md`: Outline Brief and Runtime Update Proposal now use lightweight LLM drafts compiled locally into existing canonical runtime handoff types.

### Changed files

- Added Outline Brief draft compiler: `src/lib/rpg-interactions/runtime/outline-brief-draft-compiler.ts`
- Added Runtime Update Proposal draft compiler: `src/lib/rpg-interactions/runtime/runtime-update-draft-compiler.ts`
- Updated draft prompt/parser exports: `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`, `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`, `src/lib/rpg-interactions/runtime/index.ts`
- Updated runtime trace/orchestration boundaries: `src/lib/rpg-runtime/turn-orchestrator.ts`, `src/lib/rpg-runtime/runtime-controller.ts`
- Preserved canonical staging/import boundary: `src/lib/rpg-import/runtime-update-apply.ts`, `src/lib/rpg-interactions/runtime/runtime-update-adapter.ts`
- Updated focused regressions: `src/lib/rpg-outline-brief.test.ts`, `src/lib/rpg-runtime-update-proposal.test.ts`, `src/lib/rpg-runtime-controller.test.ts`, `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-turn-orchestrator.test.ts`, `src/lib/rpg-interactions.test.ts`, `src/lib/rpg-import/runtime-update-apply.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/RPG_RUNTIME_DRAFT_COMPILER_REFACTOR_PLAN.md`

### Summary

- `OutlineBriefDraft` is now the model-facing output for Outline Brief. The compiler derives `sourceWorkingStateId`, full `OutlineBriefReference` envelopes, report IDs, fixed PC knowledge boundaries, parallel-line non-grant behavior, and major-rewrite-only regeneration requests before calling `validateOutlineBriefCompilerOutput()`.
- `RuntimeUpdateProposalDraft` is now the model-facing output for Runtime Update Proposal. The compiler derives stable proposal/group/skip IDs, source deltas from current turn handoff data, visibility, actor knowledge metadata, reveal gates, validation hints, pacing/update review structures, and canonical summaries before calling `validateRuntimeUpdateProposalResult()`.
- Draft validators reject canonical-only keys such as model-written `sourceDeltas`, actor knowledge envelopes, validation hints, canonical report/proposal IDs, and other fields that must be derived locally.
- Outline Brief and Runtime Update prompts now describe lightweight draft contracts instead of asking the model to handwrite full canonical protocol envelopes.
- Debug trace now records raw draft, parsed draft, compiled canonical summaries, and canonical validation results for both converted stages.
- Pending import/staging remains canonical-only: already accepted proposal JSON still goes through canonical parsing/validation, while raw LLM output goes through the draft compiler path.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-import/runtime-update-apply.test.ts --exclude='**/*.real-llm.test.ts'` passed: 7 files, 140 tests.
- `npm.cmd run test:mocks` passed: 138 files, 1738 tests.
- Earlier `npm test -- ...` was not usable in this PowerShell environment because `npm.ps1` is blocked by execution policy; using `npm.cmd` works.

### Scope notes

- Did not relax canonical validators or pending-stage runtime update validation.
- Did not add legacy/default compatibility, migration fallback, old-path preservation, parser repair, retry repair, broken-JSON sanitizer, or silent protocol fallback.
- Compilers use the legal draft plus current-stage handoff inputs; they do not read the filesystem.
- Remaining cleanup candidate: extract shared reference/visibility policy helpers so Outline Brief compiler and validators do not duplicate small boundary checks.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Phase 0 Contract Audit Baseline

### Stage

Completed Phase 0 of the runtime draft/compiler refactor plan: contract audit plus trace baseline, written back into the existing refactor plan document for later phases.

### Changed files

- Updated audit plan/results: `docs/RPG_RUNTIME_DRAFT_COMPILER_REFACTOR_PLAN.md`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added an inline `Phase 0 Audit Result - 2026-06-14` section to `docs/RPG_RUNTIME_DRAFT_COMPILER_REFACTOR_PLAN.md`.
- Audited `action_resolver`, `world_tick`, `recall_selector`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, and `runtime_update_proposal`.
- Recorded each stage's current output contract, parser/validator boundary, trace coverage, field classification, failure mode, and draft/compiler suitability.
- Parsed the available real debug trace `rpg-runtime-trace-rpg-action-1-mqder6fw.json` as an old-contract baseline: `action_resolver` succeeded with 37,559 prompt chars and 3,868 raw output chars; `world_tick` failed at validation with 67,581 prompt chars, 4,687 raw output chars, and `Invalid WorldTickResult.clockUpdates: must be an array.`; later stages stayed pending.
- Confirmed the Phase 0 direction: `world_tick` is already draft/compiler; `recall_selector` remains allowlist + deterministic reader; `outline_brief` is Phase 1; `runtime_update_proposal` is Phase 2; `narration_generator`, `story_outline_regenerator`, and `action_resolver` should only receive scoped/local compiler treatment later.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-story-outline-regenerator.test.ts` passed: 7 files, 130 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Documentation-only implementation: no runtime code, prompts, parsers, validators, orchestrator flow, wiki writeback, pending/review/apply flow, UI, Rust worker, or LLM adapters were changed.
- Did not add fallback, parser repair, validator relaxation/defaulting, legacy/default compatibility, migration path, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Draft/Compiler Refactor Plan

### Stage

Documented a follow-up plan for applying the World Tick `Draft -> local compiler -> strict canonical validator` pattern to other RPG runtime LLM stages.

### Changed files

- Added plan: `docs/RPG_RUNTIME_DRAFT_COMPILER_REFACTOR_PLAN.md`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Recorded why World Tick's draft/compiler architecture should not be treated as a one-off: several later stages still ask the model to produce canonical protocol envelopes that can be derived locally.
- Explained why the earlier recall slimming does not automatically shrink Outline Brief: recall slimming reduces wiki正文和召回噪声, while Outline Brief still expands turn state, recalled materials, outline slices, runtime refs, known references, and canonical `OutlineBriefReference` output requirements.
- Prioritized Outline Brief as Phase 1 because the latest real trace failed on missing mechanical `OutlineBriefReference` fields such as `lineTarget`, `usePurpose`, `visibilityScope`, and `knowledgeScope`.
- Prioritized Runtime Update Proposal as Phase 2 because source deltas, actor knowledge, visibility, reveal gates, validation hints, and review boundaries are heavy deterministic metadata.
- Kept the plan strict: compilers are deterministic protocol builders from legal drafts, not fallback repair, parser sanitizers, legacy compatibility, or validator relaxation.

### Validation

- Documentation-only change; no code tests were run.

### Scope notes

- Did not modify runtime code, prompts, validators, orchestrator flow, wiki writeback, pending persistence, UI, legacy/default compatibility, fallback behavior, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Recall Slimming + WorldTickDraft Contract

### Stage

Implemented the Stage 13-15 runtime slimming plan: reduce noisy retrieval before World Tick, switch World Tick model output to a lightweight draft contract compiled locally into canonical `WorldTickResult`, and validate the failure mode against the real debug trace.

### Changed files

- Added Codex stage prompts: `.codex/stages/13-runtime-recall-slimming.md`, `.codex/stages/14-runtime-output-draft-contract.md`, `.codex/stages/15-runtime-e2e-evaluation.md`
- Slimmed runtime recall scoring and query anchors: `src/lib/rpg-runtime/wiki-readers.ts`, `src/lib/rpg-runtime/action-resolver-input-builder.ts`, `src/lib/rpg-runtime/world-tick-input-builder.ts`, `src/lib/rpg-runtime/recall-selector-input-builder.ts`
- Added World Tick draft compiler path: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Added / updated regression tests: `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-world-tick-contract.test.ts`, `src/lib/rpg-recall-selector-handoff.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- `rankedPages()` now drops zero-score pages. Tokenization splits hyphen / underscore slugs, while page scoring uses exact token-set matches rather than substring search, preventing weak matches such as unrelated runtime ids or poison text from entering prompts.
- Added runtime protocol words (`action`, `resolution`, `world`, `tick`, `delta`, `recall`, `quest`, `rule`, etc.) to stop words so directory / stage names do not become recall anchors.
- Action Resolver and World Tick query text now prefers the submitted action, current location, present entities, interactables, dangers, clocks, pending reactions, affected paths, explicit refs, and action/world delta summaries instead of full `currentScene.content`.
- World Tick no longer auto-includes every relationship / plot-arc runtime overlay; Recall Selector no longer auto-includes every `/runtime/` page. Relevant overlays must be affected or positively ranked.
- World Tick prompts now ask the model for `WorldTickDraft`. `compileWorldTickDraftOutput()` fills deterministic IDs, empty arrays, visibility presets, generated `runtimeDeltaRefs`, `timeDeltaBasis`, pacing defaults, and gap defaults, then still calls `validateWorldTickResult()`.
- The parser still accepts already-canonical `WorldTickResult` JSON. If canonical validation fails and prompt input is available, it attempts draft compilation; if that compilation fails, the error reports both canonical and draft failures.
- Real debug trace check confirmed the prior direct failure was `Invalid WorldTickResult.clockUpdates: must be an array.` and that the old prompt was heavily polluted by unrelated Fate character/item/faction material.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-world-tick-interaction.test.ts` passed: 4 files, 46 tests.
- `npx.cmd vitest run @tests` with all `src/lib/rpg-*.test.ts` files passed: 39 files, 457 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; existing Vite 8 `inlineDynamicImports` deprecation warning remains.
- Read-only trace evaluation of `C:\Users\Administrator\Documents\Works\Chem\test1\rpgtest7\.llm-wiki\runtime\debug-traces\rpg-runtime-trace-rpg-action-1-mqder6fw.json` found Action Resolver prompt around 37.6k chars, World Tick prompt around 67.6k chars, approximately 455 Fate/Saber/宝具-related matches, and failure at World Tick validation before Recall Selector could run.

### Scope notes

- Did not loosen validators, add silent defaulting inside validators, add retry repair, parser sanitizer, legacy/default compatibility, old-path preservation, or fallback swallowing.
- Did not change runtime stage order, wiki writeback, pending persistence, UI, Rust worker protocol, or LLM provider transports.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Story/Narration Prompt Contract Expansion

### Stage

Expanded the remaining high-risk runtime output prompt contracts for Story Outline Regenerator and Narration Generator so they match the current strict validators instead of relying on abstract type placeholders.

### Changed files

- Updated Story Outline Regenerator output contract: `src/lib/rpg-interactions/runtime/story-outline-regenerator-interaction.ts`
- Updated Narration Generator output contract: `src/lib/rpg-interactions/runtime/narration-generator-interaction.ts`
- Added focused prompt/underspecified-output regression tests: `src/lib/rpg-story-outline-regenerator.test.ts`, `src/lib/rpg-narration-generator.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced naked placeholders such as `ProvisionalOutlinePatch`, `OutlineRevisionProposal`, `RegenerationSafetyReport`, `TensionBrief`, `NarrationDisplayPolicy`, `NarrationMeta`, and `RuntimeNarrationActionOption[]` with expanded JSON fields accepted by their validators.
- Included fixed boundary booleans in the prompt contracts, such as non-persistence flags, safety report flags, `runtimeReviewHandoff: true`, `ordinaryEventFact: false`, `showTensionBriefToPlayer: false`, and `styleRemainedNonFact: true`.
- Added regression coverage that rejects legacy / underspecified output shapes instead of auto-repairing them.
- Kept validators strict and did not add legacy field mapping, default filling, parser repair, retry, fallback, sanitizer, or old `default` compatibility.

### Validation

- `npx.cmd vitest run src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts` passed: 3 files, 73 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed; existing Vite 8 `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not change runtime stage order, TypeScript output types, validator semantics, orchestration, narration flow, runtime update proposal, wiki writeback, or pending persistence.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Outline Brief Prompt Contract Fix

### Stage

Aligned the LLM 4 Outline Brief prompt output contract with the current strict `OutlineBriefCompilerOutput` validator after a runtime debug trace showed legacy-shaped output failing on `outlineAwareNarrationBrief.playerFacingBrief.summary`.

### Changed files

- Updated Outline Brief prompt contract: `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Added focused prompt/legacy-shape regression tests: `src/lib/rpg-outline-brief.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced abstract return-contract placeholders such as `PlayerFacingBrief`, `ParallelLineBrief`, and `TensionBriefInput` with expanded JSON fields accepted by the current validator.
- Added required `outlineImpactReport.reportId` to the prompt contract.
- Added regression coverage that rejects the legacy trace shape instead of auto-repairing it.
- Kept `outline-brief-validation.ts` strict and did not add legacy field mapping, default filling, parser repair, retry, fallback, or old `default` compatibility.

### Validation

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts` passed: 2 files, 67 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build:runtime` passed; existing Vite 8 `inlineDynamicImports` deprecation warning remains.

### Scope notes

- Did not change runtime stage order, `OutlineBriefCompilerOutput` type semantics, narration generation, runtime update proposal, wiki writeback, or pending persistence.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime HTTP Backstop Timer Cleanup

### Stage

Fixed the HTTP/API `streamChat()` backstop timer leak that could keep the Node RPG runtime worker alive for 30 minutes after an LLM interaction had already failed and emitted a debug trace.

### Changed files

- Updated HTTP timeout cleanup: `src/lib/llm-client.ts`
- Added focused timer lifecycle regression tests: `src/lib/llm-client.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Moved the 30-minute backstop `timeoutId` to `streamChat()` HTTP branch scope and added a single cleanup path.
- Cleans the timer and removes the external abort listener on successful SSE completion, HTTP error, empty response body, fetch/network error, stream reader error, reasoning-only diagnostic, caller abort, and real request timeout.
- Preserved the existing real timeout behavior and message: `Request timed out after 30 min...`.
- Left the RPG runtime worker protocol, Rust `rpg_runtime_run_turn` timeout, CLI provider branches, and Runtime Panel UI structure unchanged.
- Runtime business errors such as Action Resolver parse failures can now let the worker process exit promptly so the frontend `invoke()` can settle and the panel can leave “正在执行回合……” through its existing catch path.

### Validation

- `npx.cmd vitest run src/lib/llm-client.test.ts` passed: 1 file, 12 tests.
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime/runtime-controller-client.test.ts src/lib/rpg-runtime/node-worker/run-turn-worker.test.ts` passed: 3 files, 23 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change Action Resolver prompt size, JSON parsing, repair, retry, or fallback behavior.
- Did not add legacy/default compatibility, old-path preservation, protocol auto-fix behavior, or migration fallback.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Debug Trace Realtime Bridge

### Stage

Implemented the realtime debug trace bridge for backend RPG runtime turns. The Node worker now streams trace snapshots to Rust over stderr, Rust forwards them as per-run Tauri events, and the frontend debug store updates while the turn is still running.

### Changed files

- Updated debug trace store and frontend wrapper: `src/lib/rpg-runtime/debug-trace.ts`, `src/lib/rpg-runtime/runtime-controller-client.ts`
- Updated worker event output and tests: `src/lib/rpg-runtime/node-worker/run-turn-worker.ts`, `src/lib/rpg-runtime/node-worker/run-turn-worker.test.ts`
- Updated Rust stderr event forwarding and parser tests: `src-tauri/src/commands/rpg_runtime.rs`
- Updated focused debug trace/client tests: `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-runtime/runtime-controller-client.test.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `RpgRuntimeDebugTraceSink.importState()` so the frontend can import complete `{ currentTrace, lastTrace }` snapshots rather than treating worker traces only as completed traces.
- Updated `runRpgRuntimeTurnFlowClient()` to create a per-turn `runId`, subscribe to `rpg-runtime:{runId}:trace` before invoking `rpg_runtime_run_turn`, and import each trace event into the frontend debug store.
- Updated the Node worker to emit `__RPG_RUNTIME_TRACE_EVENT__{...}` JSONL messages on stderr for each trace store publish. Each event carries `{ runId, sequence, state }`.
- Changed the worker stdout response shape to `{ ok: true, result } | { ok: false, error }`; complete debug traces are no longer returned through stdout.
- Updated the Rust command to read worker stderr line-by-line, forward prefixed trace events with `app.emit`, keep ordinary stderr as diagnostics, and preserve the single-object stdout parser.
- The existing Debug Console export behavior now works for both running `currentTrace` snapshots and completed `lastTrace` snapshots because the frontend store is updated in realtime.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime/runtime-controller-client.test.ts src/lib/rpg-runtime/node-worker/run-turn-worker.test.ts` passed: 10 files, 144 tests.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; Vite 8 still emits the existing `inlineDynamicImports` deprecation warning.
- `npx.cmd vite build` passed; existing chunk-size and ineffective dynamic import warnings remain unrelated.
- `cargo test parse_worker` passed: 7 Rust tests. Existing Rust warnings in `proxy.rs` remain unrelated.

### Scope notes

- Did not move runtime logic back to the frontend.
- Did not rewrite RPG runtime logic in Rust.
- Did not add `default` / legacy compatibility, migration fallback, parser sanitizer, retry repair, protocol auto-fix behavior, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-14 - RPG Runtime Flow Backend Worker Phase 1

### Stage

Implemented the requested “Tauri command + Node runtime worker” boundary for RPG runtime turns. The frontend now calls a backend command; the Node worker reuses the existing TypeScript `runRpgRuntimeTurnFlow` instead of rewriting runtime prompts, validators, adapters, traces, or persistence in Rust.

### Changed files

- Added frontend command wrapper: `src/lib/rpg-runtime/runtime-controller-client.ts`
- Updated runtime panel default submission path: `src/components/rpg/rpg-runtime-panel.tsx`
- Added worker entry and worker tests: `src/lib/rpg-runtime/node-worker/run-turn-worker.ts`, `src/lib/rpg-runtime/node-worker/run-turn-worker.test.ts`
- Added Node-side fs adapter for runtime bundling: `src/commands/fs-node.ts`
- Added runtime bundle config and scripts: `vite.runtime.config.ts`, `package.json`, `tsconfig.node.json`, `.gitignore`
- Added Rust command and registration: `src-tauri/src/commands/rpg_runtime.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`
- Updated Tauri resource/build config: `src-tauri/tauri.conf.json`, `src-tauri/tauri.windows.conf.json`, `src-tauri/tauri.linux.conf.json`, `src-tauri/tauri.macos.conf.json`
- Added / updated focused tests: `src/lib/rpg-runtime/runtime-controller-client.test.ts`, `src/components/rpg/rpg-runtime-panel.test.tsx`, `src/lib/rpg-outline-brief.test.ts`
- Updated browser-reachable runtime apply import and fixtures: `src/lib/rpg-import/runtime-update-apply.ts`, `src/lib/rpg-import/runtime-update-apply.test.ts`, `src/test-helpers/fs-temp.ts`
- Updated docs: `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `runRpgRuntimeTurnFlowClient()` as the browser-facing wrapper around `invoke("rpg_runtime_run_turn", { projectPath, llmConfig, submittedAction })`.
- Changed `RpgRuntimePanel` so the default `runTurnFlow` dependency uses the Tauri command wrapper. The panel no longer constructs frontend LLM adapters or directly calls `runRpgRuntimeTurnFlow` during turn submission.
- Moved turn-time pending update persistence into the worker path. The panel still handles review/apply-time queue state and apply journal persistence.
- Added `run-turn-worker.ts`, which validates input, creates the existing LLM runtime adapters, creates a debug trace store, calls the existing TypeScript runtime flow, saves pending updates, appends turn journal entries through Node-side persistence, and returns one JSON response containing either `{ ok: true, result, debugTrace }` or `{ ok: false, error, debugTrace }`.
- Added explicit first-phase provider boundary: HTTP/API providers continue through the shared LLM client path; `claude-code` and `codex-cli` return a structured unsupported-provider error until a Node-native CLI transport or backend CLI command is added.
- Added Rust command `rpg_runtime_run_turn`, which resolves a fixed worker path, resolves Node from `LLMWIKIRPG_NODE` or `PATH`, writes one JSON stdin payload, reads stdout/stderr, applies a 30-minute timeout with kill-on-drop, rejects non-object or polluted stdout, and returns the worker JSON to the frontend.
- Added a Node-target Vite bundle to produce `dist-runtime/rpg-runtime-worker.mjs`, with the worker included in Tauri bundle resources and built before Tauri dev/build.
- Added `RpgRuntimeDebugTraceSink.importTrace()` so the frontend debug console can display the complete worker-returned trace after the turn completes.
- Switched `runtime-update-apply` to the browser-safe `write-policy-client` path and updated its test fixtures to include current actor-knowledge source metadata, removing the remaining frontend build `node:fs/promises` / `node:path` externalization warning from this area.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime/runtime-controller-client.test.ts src/lib/rpg-runtime/node-worker/run-turn-worker.test.ts` passed: 10 files, 143 tests.
- `npm.cmd run build:runtime` passed and produced `dist-runtime/rpg-runtime-worker.mjs`; Vite 8 still emits the `inlineDynamicImports` deprecation warning.
- `npx.cmd vite build` passed; the earlier frontend `node:fs/promises` / `node:path` externalization warnings from `src/lib/rpg-runtime/write-policy.ts` no longer appear.
- `cargo test parse_worker_stdout` passed: 4 tests. Existing Rust warnings in `proxy.rs` remain unrelated.

### Scope notes

- Did not rewrite RPG runtime logic in Rust.
- Did not add live step progress events; debug trace is returned once at completion in this phase.
- Did not support `claude-code` / `codex-cli` in the Node worker yet.
- Did not add legacy/default compatibility, old-path preservation, migration fallback, parser sanitizer, retry repair, or protocol auto-fix behavior.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Narration Lens Semantic Narrowing Phase 5

### Stage

Executed `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md` Phase 5 - Narration Lens 输出重命名或语义收窄, using direction 1: keep current protocol field names and narrow their semantics.

### Changed files

- Updated shared schema guidance: `src/lib/rpg-wiki-schema.ts`
- Updated runtime prompt boundaries: `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`, `src/lib/rpg-interactions/runtime/recall-selector-interaction.ts`, `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated focused tests: `src/lib/rpg-wiki-schema.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-recall-selector.test.ts`, `src/lib/rpg-runtime-update-proposal.test.ts`
- Updated docs: `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Kept `playerVisibleLine`, `parallelLine`, and `tensionLine` as the current JSON protocol fields.
- Clarified in code-readable schema guidance that the three values are current-turn runtime / narration lens targets, not outline ownership, not equal story axes, and not a requirement to advance three lines in parallel.
- Documented the narrowed meanings: `playerVisibleLine` is PC-visible / PC-inferred current lens, `parallelLine` is user-visible PC-unknown lens, and `tensionLine` is relationship / emotion / foreshadowing / pacing pressure signal.
- Updated World Tick prompt language so `worldDeltas` are classified by this-turn lens buckets, and low-information turns may keep `playerVisibleLine` narrow while `parallelLine` / `tensionLine` arrays are empty or audit-only.
- Updated Recall Selector and Runtime Update Proposal prompts so `lineTarget` is a narration lens target / fallback rather than outline ownership; writeback authority remains controlled by visibility, knowledge scope, actor claims, happened status, and target path.
- Added regression assertions for the narrowed semantics while preserving existing PC knowledge and tension handoff boundaries.

### Validation

- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 7 files, 125 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not rename `playerVisibleLine`, `parallelLine`, or `tensionLine`.
- Did not add `pcSceneLens`, `userDramaticLens`, or `tensionPressureLens`.
- Did not change runtime JSON shape, persistence structure, UI display fields, wiki write strategy, pending/apply behavior, parser sanitizer, protocol repair, retry fallback, legacy/default compatibility, migration path, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Actor Knowledge + Runtime Writeback Boundary Phase 3/4

### Stage

Executed `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md` Phase 3 - Actor Knowledge 元数据引入 and Phase 4 - Runtime Update Proposal 写回边界重整.

### Changed files

- Updated public schema/runtime contracts: `src/lib/rpg-wiki-schema.ts`, `src/lib/rpg-runtime/types.ts`, `src/lib/rpg-runtime/index.ts`
- Added actor metadata validators and safe default derivation: `src/lib/rpg-runtime/actor-knowledge.ts`
- Updated runtime handoff builders/readers: `src/lib/rpg-runtime/recall-selector-handoff.ts`, `src/lib/rpg-runtime/outline-brief-input-builder.ts`, `src/lib/rpg-runtime/outline-brief-handoff.ts`, `src/lib/rpg-runtime/narration-input-builder.ts`
- Updated runtime prompt/validation boundaries: `src/lib/rpg-interactions/runtime/recall-selector-validation.ts`, `src/lib/rpg-interactions/runtime/outline-brief-validation.ts`, `src/lib/rpg-interactions/runtime/narration-generator-validation.ts`, `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`, `src/lib/rpg-interactions/runtime/runtime-update-proposal-validation.ts`, `src/lib/rpg-interactions/runtime/runtime-update-validation.ts`
- Updated focused tests: `src/lib/rpg-actor-knowledge.test.ts`, `src/lib/rpg-recall-selector.test.ts`, `src/lib/rpg-recall-selector-handoff.test.ts`, `src/lib/rpg-outline-brief.test.ts`, `src/lib/rpg-narration-generator.test.ts`, `src/lib/rpg-runtime-update-proposal.test.ts`, `src/lib/rpg-runtime-update-validation.test.ts`, `src/lib/rpg-interactions.test.ts`, `src/lib/rpg-wiki-schema.test.ts`, `src/lib/rpg-runtime-controller.test.ts`
- Updated docs: `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md`, `docs/RPG_WIKI_SCHEMA.md`, `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`, `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added actor-level knowledge primitives (`RpgKnowledgeActorRef`, `RpgBeliefState`, `RpgRevealState`) and runtime envelopes (`RpgKnowledgeClaim`, `RpgRevealGateRef`).
- Extended Recall / Outline Brief / Narration / Runtime Update Proposal handoff structs so actor metadata can survive the full runtime chain.
- Added strict validators for actor refs, belief states, reveal states, knowledge claims, and reveal gate refs. Contradictory holder/non-holder data is rejected instead of repaired.
- Restricted safe default claim derivation to unambiguous paths only: player known information, outlines, character runtime overlays, and faction runtime overlays. Relationship, plot-arc, event, and other ambiguous files require explicit actor metadata from the source delta.
- Updated Recall Selector, Outline Brief, and Narration validation so `npc_known` cannot assert actor knowledge without a concrete `npc:<id>`, `faction:<id>`, or `group:<id>` holder.
- Updated Runtime Update Proposal prompt and parser validation so every `sourceDeltas[]` entry must carry `knowledgeClaims` and `revealGateRefs`, with `revealState` required for reveal progress writes.
- Hardened Runtime Update Proposal writeback boundaries for PC knowledge, NPC runtime knowledge, relationship information gaps, reveal progress, confirmed events, and `wiki/outlines/main.md`.
- Mirrored the actor-boundary checks in deterministic `validateRpgRuntimeUpdateProposals()` so rejected proposals never enter pending staging.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-actor-knowledge.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime-controller.test.ts` passed: 10 files, 200 tests.

### Scope notes

- Did not add default / legacy compatibility, old-path preservation, migration behavior, parser sanitizer, protocol repair, retry fallback, or auto-generated actor metadata for ambiguous files.
- Did not auto-write `wiki/outlines/main.md`; ordinary runtime proposals remain forbidden there and outline changes stay in independent review items.
- Did not rename `playerVisibleLine`, `parallelLine`, or `tensionLine`; they remain current narration lens protocol fields.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Outline Knowledge Boundary Phase 1/2

### Stage

Executed `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md` Phase 1 - Schema 文档对齐 and Phase 2 - Outline Brief 输入模型重整.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- Updated `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `src/lib/rpg-runtime/types.ts`
- Updated `src/lib/rpg-runtime/outline-brief-input-builder.ts`
- Updated `src/lib/rpg-runtime/outline-brief-handoff.ts`
- Updated `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/outline-brief-validation.ts`
- Updated `src/lib/rpg-outline-brief.test.ts`
- Updated `src/lib/rpg-wiki-schema.ts`

### Summary

- Documented that `playerVisibleLine`, `parallelLine`, and `tensionLine` are per-turn narration lens outputs, not equal outline axes or synchronized story lines.
- Documented the directory boundaries for GM truth, PC knowledge, NPC knowledge, relationship information gaps, reveal progress, plot pressure, events, and current-scene.
- Clarified that `outlines/main.md` is GM Truth / Control Layer, while `outlines/progress.md` records current stage, reveal progress, active reveal gates, current information boundary, and next useful beats.
- Added optional `outlineControl` metadata to `RecalledMaterial` and `OutlineSlice`, with `controlKind`, `gmSummary`, `playerSafeSummary`, `actorKnowledgeRefs`, `revealGateRefs`, `mustNotRevealTo`, and `boundaryNote`.
- Changed controlled outline material assembly so `outlines/main.md` / `outlines/progress.md` slices are classified as GM control, reveal gate, branch condition, hard constraint, or progress marker before receiving a narration lens fallback.
- Updated `buildOutlineSlices()` to emit outline control metadata and derive reveal / branch refs and reveal policies from outline control semantics.
- Updated the Outline Brief prompt so `outlineSlices` are treated as GM control / reveal gate / progress marker slices, and `lineTarget` is explicitly described as a narration lens fallback rather than outline ownership.
- Strengthened Outline Brief validation so delayed or GM-only outline slices marked as forbidden to PC cannot enter `playerFacingBrief.allowedKnowledge`, even if the model outputs `pc_visible` / `pc_known`.
- Added regression coverage for delayed reveal leakage, outline control metadata, non-`tensionLine` controlled outline lens fallback, and the existing `parallelLineBrief.grantsPcKnowledge: false` boundary.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts` passed: 2 files, 66 tests.
- `npx.cmd vitest run src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-story-outline-regenerator.test.ts` passed: 3 files, 46 tests.
- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 file, 30 tests.

### Scope notes

- Did not implement Phase 3 actor-level knowledge holders, belief-state metadata, or `npc:<id>` holder modeling.
- Did not implement Phase 4 runtime update writeback restructuring.
- Did not rename the three existing line fields; they remain current JSON protocol fields with narrowed narration-lens semantics.
- Did not automatically rewrite user outline content.
- Did not add legacy/default compatibility, migration paths, old-path preservation, protocol repair, sanitizer, or fallback behavior.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Outline Knowledge Boundary Redesign Plan

### Stage

Documentation planning pass requested after reviewing the current outline instance under `C:\Users\Administrator\Documents\Works\Chem\test1\rpgtest7\wiki\outlines` and identifying a design conflict between the original three-line outline concept and the actual need for actor-specific knowledge isolation.

### Changed files

- Added `docs/RPG_OUTLINE_KNOWLEDGE_BOUNDARY_REDESIGN_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Documented the conflict where `playerVisibleLine`, `parallelLine`, and `tensionLine` are currently treated too much like equal outline axes, even though the player character may know almost nothing at campaign start.
- Proposed lowering the three-line model to per-turn narration / brief lens semantics.
- Proposed a four-layer replacement model: GM Truth Layer, Actor Knowledge Layer, Reveal Gate Layer, and Narration Lens Layer.
- Defined target directory responsibilities for `outlines/main.md`, `outlines/progress.md`, `player/known_information.md`, `characters/runtime/*.md`, `relationships/runtime/*.md`, and `plot-arcs/runtime/*.md`.
- Sketched future type concepts for actor references, belief state, reveal state, knowledge claims, reveal gates, and outline control slices.
- Split follow-up work into documentation/schema alignment, Outline Brief input restructuring, actor knowledge metadata, runtime update writeback boundary changes, and eventual narration lens semantic tightening.

### Validation

- Documentation-only change; automated tests were not run.

### Scope notes

- Did not modify runtime code, prompt builders, validators, parser behavior, write policy, pending/apply behavior, UI, or tests.
- Did not add legacy/default compatibility, migration fallback, old-path preservation, or protocol-repair behavior.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG World Tick runtimeDeltaRefs Short Reference Contract Fix

### Stage

Targeted runtime protocol fix requested after the second World Tick turn returned valid top-level `runtimeDeltaRefs` objects but nested delta fields such as `worldDeltas.playerVisibleLine[0].runtimeDeltaRefs`, `reactionQueue[0].runtimeDeltaRefs`, `pacingUpdate.runtimeDeltaRefs`, and `gapState.runtimeDeltaRefs` used string short references like `["ref-1"]`.

### Changed files

- Updated `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/world-tick-validation.ts`
- Updated `src/lib/rpg-world-tick-interaction.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Hardened the World Tick prompt contract so every field named `runtimeDeltaRefs`, at both top-level and nested delta positions, must be a `RuntimeDeltaRef[]` containing complete objects.
- Explicitly forbade `runtimeDeltaRefs: ["ref-1"]`, string IDs, path strings, short references, and alias references to the top-level `runtimeDeltaRefs`.
- Clarified that shared refs must still be fully expanded inside every `delta.runtimeDeltaRefs` occurrence.
- Changed World Tick validation path handling so `validateRuntimeDeltaRef()` receives the full field label from its caller instead of hard-coding `WorldTickResult.runtimeDeltaRefs[index]`.
- Added parser coverage proving nested string short refs are rejected and reported at the true nested path.

### Validation

- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts` passed: 2 files, 16 tests.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts` passed: 1 file, 46 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not relax World Tick validation or add fallback behavior, repair, sanitizer, automatic completion, or string-short-ref-to-object mapping.
- Did not add legacy/default compatibility or old-path preservation.
- Did not change runtime flow, UI, wiki write policy, pending/apply behavior, or runtime JSON type structures.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Runtime wildcard/pathPattern Output Boundary Fix

### Stage

Targeted runtime protocol fix requested after Recall Selector emitted `wiki/sources/*.md` inside `exclusions[].path`, which failed strict retrieval-index validation. The same wildcard/pathPattern misuse boundary was audited across LLM 3, LLM 4, LLM 4.5, and LLM 6.

### Changed files

- Updated `src/lib/rpg-interactions/runtime/recall-selector-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/story-outline-regenerator-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/wiki-update-policy.ts`
- Updated `src/lib/rpg-recall-selector.test.ts`
- Updated `src/lib/rpg-outline-brief.test.ts`
- Updated `src/lib/rpg-story-outline-regenerator.test.ts`
- Updated `src/lib/rpg-runtime-update-proposal.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Hardened Recall Selector prompt so `selectedItems[].path` and `exclusions[].path` must exactly match `retrievalIndex[].path`, and exclusion section ids must come from the matching `RetrievalIndexEntry.availableSections`.
- Clarified that broad category-level “do not recall this class of material” rationale belongs in `warnings`, not `exclusions`, because `exclusions` is only for concrete indexed paths and sections.
- Hardened Outline Brief prompt so references, allowed knowledge, parallel knowledge, plot-arc fuel, source refs, and affected refs must use paths/ids from structured input, known references, or runtime refs.
- Hardened Story Outline Regenerator prompt so outline refs, visibility boundaries, runtime refs, and safety checked refs must use path/id values from structured input.
- Hardened Runtime Update Proposal prompt so `allowedTargets[].pathPattern` is described as a local matching rule rather than a literal `targetPath` value, and actual proposed target paths must be concrete files.
- Added a deterministic `validateRpgRuntimeUpdateTarget()` guard rejecting actual `targetPath` values containing `*` before matching them against allowed path patterns.
- Added regression tests proving wildcard/glob/category/pathPattern values such as `wiki/sources/*.md` and `wiki/events/*.md` remain protocol errors, while concrete event paths such as `wiki/events/scene-001.md` remain valid.

### Validation

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-interactions.test.ts` passed: 5 files, 122 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not relax validators or add parser sanitization, retry repair, automatic deletion of invalid exclusions, fallback behavior, or legacy/default compatibility.
- Did not change runtime JSON type structures, runtime flow, UI, pending/apply behavior, or ordinary wiki write semantics.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG World Tick Output Contract Expansion

### Stage

Targeted runtime prompt contract fix requested after World Tick emitted `knowledgeSourceKind: "inferred_from_action"` and an older/invented `WorldTickResult` shape during the second world-advance turn.

### Changed files

- Updated `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Updated `src/lib/rpg-world-tick-interaction.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Expanded the World Tick prompt from top-level `WorldTickResult` type names into the current validator-backed output contract.
- Added explicit field lists for `WorldTickVisibilityMeta`, output `RuntimeDeltaRef`, `WorldTickDeltaBase`, `WorldTickWorldDelta`, clock updates, settled ongoing events, information broadcasts, reactions, pacing updates, gap state, references, and warnings.
- Listed the allowed runtime enum literals in the prompt, including the `RpgKnowledgeSourceKind` set.
- Clarified that action-derived inference must still use `knowledgeSourceKind: "inferred"` and must not invent a new action-source value.
- Clarified that `WorldTickWorldDelta` must not copy `PlayerActionDelta` fields such as `positionChanges`, `resourceChanges`, `inventoryChanges`, `conditionChanges`, `relationshipSignals`, or `sceneChanges`.
- Clarified that `gapState` is a single `WorldTickGapState` object and output `RuntimeDeltaRef.sourceStage` must be `worldTick`, so the model should not copy Action Resolver refs into World Tick output refs.
- Added prompt regression assertions for the expanded World Tick contract and parser coverage proving invented aliases such as `inferred_from_action` and `happened` remain invalid protocol output.

### Validation

- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts` passed: 2 files, 15 tests.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts` passed: 1 file, 46 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test:mocks` passed: 135 files, 1707 tests.

### Scope notes

- Did not relax World Tick validation or add output sanitization, enum alias normalization, retry repair, or fallback behavior.
- Did not change runtime flow, UI, wiki write policy, pending/apply behavior, debug trace schema, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Runtime JSON Output Contract Audit

### Stage

Targeted runtime prompt contract fix requested after Action Resolver emitted literal `undefined` inside an `ActionResolution` JSON object.

### Changed files

- Updated `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts`
- Updated `src/lib/rpg-action-resolver.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Removed TypeScript-style `| undefined` optional field examples from the Action Resolver output contract.
- Added explicit strict JSON instructions: omit optional keys when absent, never output `undefined`, and do not use `null` for missing ActionResolution fields.
- Aligned Action Resolver prompt field names with the current validator contract for costs, obstacles, direct results, references, and warnings.
- Added legal JSON coverage proving omitted optional `timeJumpSignal`, `confirmationBasis`, and `timeDelta.min/max` still parse successfully.
- Added illegal JSON coverage proving literal `undefined` still fails as a JSON protocol error instead of being repaired.
- Added runtime prompt audit coverage for Action Resolver, World Tick, Recall Selector, Outline Brief, Story Outline Regenerator, Narration Generator, and Runtime Update Proposal actual `systemPrompt + userPrompt` text.
- Kept `Runtime Update Proposal`'s explicit `"pacingUpdateProposal": null` contract covered as the only allowed null example in this audit.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-interactions.test.ts` passed: 2 files, 65 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test:mocks` passed: 135 files, 1706 tests.

### Scope notes

- Did not add parser sanitization, automatic `undefined` replacement, retry repair, or any fallback that would hide malformed JSON.
- Did not change UI, runtime flow, pending/apply behavior, write policy, debug trace schema, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-13 - Runtime Debug Console / Prompt Review Fix

### Stage

Review follow-up for the runtime debug console and Chinese prompt test regression fixes.

### Changed files

- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/components/rpg/rpg-runtime-debug-console.tsx`
- Updated `src/components/rpg/rpg-runtime-debug-console.test.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Synced the remaining prompt regression assertions with the intentional Chinese runtime prompt wording while preserving prompt/debug-section contracts.
- Fixed the Debug Console header export action so it exports the currently displayed trace, including a selected persisted trace.
- Changed completed debug trace persistence bookkeeping so failed saves are not marked as saved and can be retried.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx` passed: 4 files, 53 tests.
- `npm.cmd run test:mocks` passed: 135 files, 1703 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change runtime LLM prompt/output protocols, trace JSON schema, wiki write policy, pending/apply behavior, or legacy/default compatibility.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Runtime 英文提示词中文化

### Stage

按用户给定方案执行 runtime 中文化：覆盖 prompt、runtime debug/UI、warning/error，自然语言翻译且保持协议字面量不变。

### Changed files

- Updated runtime prompt builders under `src/lib/rpg-interactions/runtime/`
- Updated runtime helpers and warnings under `src/lib/rpg-runtime/`
- Updated runtime UI/debug components under `src/components/rpg/`
- Updated focused runtime/prompt tests under `src/lib/*.test.ts` and `src/components/rpg/*.test.tsx`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Translated runtime LLM prompt natural-language text to Chinese while preserving JSON shapes, field names, enum values, step ids, type/interface identifiers, and `wiki/...` paths.
- Translated runtime debug prompt section titles so debug trace display now matches the Chinese prompt wording.
- Translated RPG runtime panel, play/debug console, empty-state, button/label, and runtime warning/error copy to Chinese.
- Kept export filenames, trace JSON top-level keys, step status values, pending/apply persistence payload fields, and other machine-readable runtime contracts unchanged.
- Updated prompt/debug/UI tests that asserted old English strings so they now verify the Chinese runtime wording and unchanged protocol boundaries.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-runtime-persistence.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-play-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx` passed.

### Scope notes

- Did not add legacy/default compatibility, migration fallback, old-path preservation, or new fallback branches.
- Did not change runtime step ids, JSON top-level keys, enum values, target-path policies, parser contracts, or persistence protocols.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Runtime Debug Console Phase 5

### Stage

`docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md` Phase 5 - optional persistence and export for runtime debug traces.

### Changed files

- Added `src/lib/rpg-runtime/debug-trace-export.ts`
- Added `src/lib/rpg-runtime/debug-trace-persistence-client.ts`
- Added `src/lib/rpg-runtime-debug-trace-export.test.ts`
- Added `src/lib/rpg-runtime-debug-trace-persistence-client.test.ts`
- Updated `src/components/rpg/rpg-runtime-debug-console.tsx`
- Updated `src/components/rpg/rpg-runtime-debug-console.test.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `src/components/rpg/index.ts`
- Updated `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added versioned runtime debug trace JSON export with `version: 1`, `exportedAt`, and `trace`.
- Added safe export filenames in the form `rpg-runtime-trace-${safeTraceId}.json`.
- Added recursive redaction for `apiKey`, `authorization`, `headers`, `secret`, `token`, and `password`, while leaving the in-memory trace untouched.
- Added browser-safe debug trace persistence client helpers using `@/commands/fs`: save, load, retention pruning, and clear-saved trace JSON files.
- Fixed the persistence path to `${normalizedProjectPath}/.llm-wiki/runtime/debug-traces/`.
- Updated the Debug Console with an `Export` button, default-off `Persist` checkbox, retention select `5 / 10 / 20`, saved trace summary rows, per-saved-trace view/export, and `Clear Saved`.
- Updated `RpgRuntimePanel` so debug trace persistence/export helpers are injectable for tests and session state holds the persistence policy, persisted traces, selected saved trace, and persistence warnings.
- Persistence remains opt-in. The panel saves each completed `lastTrace` at most once per `traceId` only after the user enables `Persist`.
- Opening the Debug view or changing project path reloads saved traces; load/save/clear failures become warnings and do not interrupt runtime turns.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-runtime-debug-trace-export.test.ts src/lib/rpg-runtime-debug-trace-persistence-client.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx` passed: 5 files, 36 tests.
- `npm.cmd run test:mocks` passed: 135 files, 1702 tests.

### Scope notes

- Did not change runtime behavior, LLM prompt/output protocols, wiki write strategy, pending/review/apply boundaries, provider tokenization, prompt/raw-output truncation, or apply behavior.
- Did not write debug trace data to `wiki/`; saved traces are confined to `.llm-wiki/runtime/debug-traces/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-13 - RPG Runtime Debug Console Phase 3-4

### Stage

`docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md` Phase 3 - structured prompt sections and Phase 4 - output, validation, handoff, and wiki-input trace details.

### Changed files

- Added `src/lib/rpg-interactions/prompt-debug.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/index.ts`
- Updated runtime prompt builders under `src/lib/rpg-interactions/runtime/`: `action-resolver-interaction.ts`, `world-tick-interaction.ts`, `recall-selector-interaction.ts`, `outline-brief-interaction.ts`, `story-outline-regenerator-interaction.ts`, `narration-generator-interaction.ts`, and `runtime-update-interaction.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated focused tests: `src/lib/rpg-runtime-debug-trace.test.ts`, `src/lib/rpg-action-resolver.test.ts`, `src/lib/rpg-world-tick-interaction.test.ts`, `src/lib/rpg-recall-selector.test.ts`, `src/lib/rpg-outline-brief.test.ts`, `src/lib/rpg-narration-generator.test.ts`, `src/lib/rpg-runtime-update-proposal.test.ts`, and `src/lib/rpg-story-outline-regenerator.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md`

### Summary

- Extended `RpgInteractionPrompt` with optional `debugSections`.
- Added interaction-level prompt debug helpers that build final prompt strings and debug sections from the same section source values.
- Added semantic prompt sections for all current runtime LLM interactions, including the optional story outline regenerator, without changing its major-regeneration trigger condition.
- Kept LLM adapter-facing `systemPrompt` and `userPrompt` intact; tests now verify debug sections recompose exactly to those prompt strings.
- Updated orchestrator/controller prompt trace conversion so structured sections become runtime debug sections in order, while older unstructured prompts still use the coarse `System Prompt` / `User Prompt` path.
- Added parsed-output summary sections while preserving full parsed JSON.
- Split validation trace evidence into success, warnings, and parse/validation failure sections.
- Added `Wiki Inputs / Source Paths` sections from existing references, retrieval indexes, recalled materials, known references, style/rules/player-knowledge source refs, and turn-record references without extra file reads.
- Added clearer handoff summaries for world tick, recall selector, outline brief, story outline regenerator, narration generator, runtime update proposal, deterministic runtime update validation, and pending persistence.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-turn-orchestrator.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-action-resolver.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-runtime-update-proposal.test.ts` passed: 11 files, 149 tests.
- `npx.cmd vitest run src/lib/rpg-story-outline-regenerator.test.ts` passed: 1 file, 14 tests.
- First `npm.cmd run test:mocks` attempt had one isolated failure in `src/lib/ingest-queue.integration.test.ts` (`restoreQueue reads back exactly what enqueue wrote`). The file passed when rerun directly.
- Reran `npm.cmd run test:mocks`; it passed: 133 files, 1689 tests.

### Scope notes

- Did not change runtime behavior, LLM output protocols, wiki write strategy, pending/review/apply boundaries, trace persistence policy, or Debug Console persistence.
- Did not write debug trace data to `wiki/` or disk.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Runtime Debug Console Plan Completion Status Sync

### Stage

Documentation follow-up requested by the user: update `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md` to reflect the already-completed Phase 1 / Phase 2 implementation without overwriting later unexecuted phases.

### Changed files

- Updated `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a `当前实施状态` section to the debug console plan.
- Recorded that Phase 1 and Phase 2 have completed their first implementation pass.
- Summarized delivered pieces: browser-safe trace model, memory store, token estimator, `debugTraceSink` runtime wiring, covered first-level runtime stages, Debug Console UI, in-memory-only retention, validation commands, and the browser-verification limitation.
- Added short status notes under the Phase 1 and Phase 2 headings.
- Left Phase 3, Phase 4, and Phase 5 plan content intact and still marked by context as future work.

### Validation

- Documentation-only sync; no automated tests were run.

### Scope notes

- Did not change source code, runtime behavior, prompt structure, wiki write strategy, trace persistence policy, or pending review/apply behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Runtime Debug Trace and Console Phase 1-2

### Stage

`docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md` Phase 1 - Minimal usable live trace and Phase 2 - dedicated Debug Console UI.

### Changed files

- Added `src/lib/rpg-runtime/debug-trace.ts`
- Added `src/lib/rpg-runtime-debug-trace.test.ts`
- Added `src/components/rpg/rpg-runtime-debug-console.tsx`
- Added `src/components/rpg/rpg-runtime-debug-console.test.tsx`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated RPG runtime adapter interfaces under `src/lib/rpg-interactions/runtime/*-adapter.ts`
- Updated LLM RPG runtime adapters under `src/lib/rpg-interactions/runtime/llm-*-adapter.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/components/rpg/index.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a browser-safe debug trace model and in-memory trace store for current/last runtime turn inspection.
- Added `estimatePromptTokens()` using the planned `mixed-char-estimate-v1` formula for debug display only.
- Added optional raw-output methods to RPG runtime adapter interfaces and implemented them in LLM adapters. Existing parsed-object adapter methods remain intact.
- Instrumented the runtime flow around the first-level RPG stages: action resolver, world tick, recall selector, outline brief, optional story outline regenerator, narration generator, runtime update proposal, deterministic runtime update validation, and pending update staging/persistence.
- Nested local input builders and handoffs under their owning stage's `Input Assembly` or `Handoff / Next Input` sections instead of creating top-level builder rows.
- Captured coarse `systemPrompt` and `userPrompt`, raw output, parsed output, validation results/errors, warnings, failure summaries, and timing.
- Added `RpgRuntimeDebugConsole` with default-collapsed step rows and nested sections for input assembly, prompt, raw output, parsed output, validation, warnings, and handoff.
- Added a Play/Debug switch to `RpgRuntimePanel`; the last trace remains in memory after turn completion until the next turn starts or the user clears it.

### Baseline differences recorded

- The plan expected raw output to be available at the orchestrator/adapter boundary, but most existing LLM adapter interfaces returned parsed objects only. The implementation adds optional raw-output methods at the RPG adapter layer rather than moving trace logic into the generic LLM client.
- Pending queue persistence is currently owned by `submitRpgRuntimePanelAction()` after `runRpgRuntimeTurnFlow()` returns. The trace records controller-side pending staging and journal persistence, then appends the panel-side `savePendingUpdates` handoff under `pending_update_persistence`.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-debug-trace.test.ts src/components/rpg/rpg-runtime-debug-console.test.tsx src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-orchestrator.test.ts` passed: 5 test files, 52 tests.
- `npm.cmd run test:mocks` passed: 133 test files, 1688 tests.
- Attempted in-app Browser verification with Vite at `http://127.0.0.1:1420/`, but the Browser runtime was blocked by the Windows sandbox process-creation boundary (`CreateProcessAsUserW` permission failure). No browser-level visual verification was completed.

### Scope notes

- Did not start Phase 3 structured prompt section refactoring.
- Did not add provider-specific tokenizer dependencies.
- Did not write debug trace to `wiki/` or disk.
- Did not change wiki write strategy, runtime output behavior, pending review/apply boundaries, prompts, or parser contracts beyond optional debug raw-output adapter methods.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Runtime Debug Console Plan Chinese Translation

### Stage

Documentation-only translation pass requested by the user.

### Changed files

- Updated `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Translated `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md` from English into Chinese.
- Preserved the original document structure, TypeScript interfaces, formulas, implementation phases, acceptance criteria, testing strategy, and non-goals.
- Kept runtime module names, API/type identifiers, and code snippets in their original technical form to avoid changing the design contract.

### Validation

- Documentation-only update; no automated tests were run.

### Scope notes

- Did not change source code, runtime behavior, UI behavior, schema constants, prompts, or persistence policy.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Runtime Debug Console Plan

### Stage

Documentation-only planning pass requested by the user for runtime debugging before testing runtime gameplay.

### Changed files

- Added `docs/RPG_RUNTIME_DEBUG_CONSOLE_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Documented a dedicated Runtime Debug Console that combines live runtime step status, prompt inspection, raw LLM output, parsed output, validation results, handoff summaries, timings, warnings, and estimated token counts.
- Recorded the current baseline: runtime already has a clear module chain and prompt builders return `systemPrompt` / `userPrompt`, but there is no structured prompt metadata, per-step live trace, or UI for inspecting raw LLM output / parsed validation failures.
- Refined the planned top-level debug module boundary: internal helpers such as `buildActionResolverInputFromWiki()` should be captured as `Input Assembly` sections under their owning runtime stage, not displayed as sibling modules.
- Specified a browser-safe trace data model, prompt debug section model, status lifecycle, and first-version token estimation policy.
- Phased the implementation into minimal live trace, dedicated debug UI, structured prompt sections, output/validation/handoff detail, and optional explicit persistence/export.

### Validation

- Documentation-only update; no automated tests were run.

### Scope notes

- Did not change source code, runtime behavior, schema constants, prompts, parsers, writer/apply behavior, or UI.
- Did not add provider-specific tokenizer dependencies.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Wiki Preview Edit/Done Save Reliability

### Stage

Targeted UI save reliability fix requested by the user: make wiki preview `Edit` -> `Done` persist edits reliably and surface save failures instead of silently logging them.

### Changed files

- Updated `src/components/editor/wiki-editor.tsx`
- Added `src/components/editor/wiki-editor-save.ts`
- Added `src/components/editor/wiki-editor-save.test.ts`
- Updated `src/components/layout/preview-panel.tsx`
- Added `src/components/layout/preview-panel.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Changed the wiki editor save callback type to allow async saves.
- Made `Done` await an immediate save before switching back to read mode; failed saves now keep the editor open and show the error inline.
- Added direct Milkdown state serialization for immediate saves by exposing a live `getMarkdown()` getter from the inner editor to the outer save handler.
- Added `resolveWikiEditorSaveBody()` so the save path prefers live Milkdown markdown and only falls back to the cached body when the editor instance is not ready.
- Switched preview markdown persistence to `writeFileAtomic`, updates `lastLoadedRef` only after a successful write, and syncs `fileContent` after the write succeeds.
- Added preview header save state for saving, saved, and failed writes.
- Added pure save-helper tests covering immediate editor body resolution, no-op detection, successful persistence/sync, and failed persistence without marking content as loaded.

### Validation

- `npx.cmd vitest run src/components/editor/wiki-editor-save.test.ts src/components/layout/preview-panel.test.ts` passed: 2 files, 5 tests.
- `npm.cmd run typecheck` passed.
- Attempted local browser verification by starting Vite at `http://127.0.0.1:1420/`, but in-app browser setup failed because the local sandbox rejected browser-process creation (`CreateProcessAsUserW` permission failure). No browser click-through verification was completed.

### Scope notes

- Did not change RPG runtime write policies, pending update apply behavior, ingestion, schema constants, or LLM prompts.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Runtime Browser-Safe Persistence/Apply

### Stage

Targeted runtime UI warning fix requested by the user: remove browser-reachable `node:path` / `node:fs` imports from the RPG runtime panel default persistence and apply paths.

### Changed files

- Added `src/lib/rpg-runtime/runtime-persistence-shared.ts`
- Added `src/lib/rpg-runtime/runtime-persistence-client.ts`
- Added `src/lib/rpg-runtime/write-policy-shared.ts`
- Added `src/lib/rpg-runtime/write-policy-client.ts`
- Added `src/lib/rpg-runtime-persistence-client.test.ts`
- Added `src/lib/rpg-runtime-write-policy-client.test.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-runtime/write-policy.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `src/components/rpg/pending-rpg-updates-panel.tsx`
- Updated `src/components/rpg/pending-rpg-updates-panel.test.tsx`
- Updated `src/components/rpg/action-options-panel.tsx`
- Updated `src/components/rpg/rpg-play-panel.tsx`
- Updated `src/components/rpg/rpg-play-panel.test.tsx`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Split runtime persistence types and `parsePendingUpdatesPayload()` into a browser-safe shared module.
- Kept the existing Node persistence module for Node/Vitest callers, but made it reuse the shared pending-update parser and shared journal/result types.
- Added a Tauri-command persistence implementation that normalizes `projectPath` by trimming, converting `\` to `/`, removing trailing `/`, and writes runtime metadata to `.llm-wiki/runtime/`.
- Split write-policy types and content formatting/append/merge helpers into a browser-safe shared module.
- Kept the existing Node write policy for Node/import flows, but added a browser-safe client write policy that uses `readFile`, `writeFileAtomic`, `createDirectory`, and `fileExists`.
- Switched the RPG runtime panel default dependencies to `runtime-persistence-client` and `write-policy-client`, while preserving injectable dependencies for tests.
- Updated RPG panel-adjacent component type imports to leaf/shared modules so browser component code no longer depends on the Node-capable runtime barrel for runtime values.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-persistence.test.ts src/components/rpg/rpg-runtime-panel.test.tsx` passed: 2 test files, 23 tests.
- `npx.cmd vitest run src/lib/rpg-runtime-persistence-client.test.ts src/lib/rpg-runtime-write-policy-client.test.ts` passed: 2 test files, 6 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "node:path|node:fs|node:fs/promises" src/components src/lib/rpg-runtime -n` still reports only explicit Node-only runtime modules: `recall-selector-handoff.ts`, `runtime-persistence.ts`, and `write-policy.ts`.
- Component-boundary grep confirms runtime component imports now point to `runtime-persistence-client`, `runtime-persistence-shared`, `write-policy-client`, and `write-policy-shared`; the only `src/components` import of Node `write-policy` is a test mock/injected dependency.
- Started Vite on `http://127.0.0.1:5173/`, but in-app browser setup failed because the local sandbox rejected browser-process creation. The Vite process was stopped afterward.

### Scope notes

- Did not polyfill `node:path`, `node:fs`, or `node:fs/promises`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not change runtime write target allow/deny policy.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Source Ingest Prompt Target Policy Sync

### Stage

Small source-ingest prompt cleanup requested by the user to align `src/lib/rpg-interactions/source-ingest/` with the current RPG schema `source_ingest` write policy.

### Changed files

- Updated `src/lib/rpg-interactions/source-ingest/page-guidance-contract.ts`
- Updated `src/lib/rpg-interactions/source-ingest/analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/chunk-analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/shared-ingest-contract.ts`
- Updated `src/lib/rpg-interactions/source-ingest/generation-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/domain-guidance.ts`
- Updated `src/lib/ingest.prompt.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Kept `buildSourceIngestTargetPolicyGuidance()` as the single authoritative source-ingest target policy renderer.
- Changed Source Ingest target policy prompt text so allowed ordinary / structural FILE targets remain explicit, while forbidden categories are rendered as REVIEW-only material categories with recommended modes instead of forbidden `wiki/.../**` path globs.
- Changed RPG directory boundary guidance so only source_ingest-allowed target semantics are expanded. Other-mode control, live current-scene, quest ledger, and runtime-overlay material is referenced only as REVIEW-only material under the Source Ingest Target Policy.
- Tightened Stage 1 and long-source chunk prompts to use fixed world/player slot wording, route non-source-ingest material to REVIEW, and avoid repeating long forbidden path lists.
- Changed Stage 2 schema injection so project schema can guide naming/format only within Source Ingest Target Policy and cannot reopen forbidden targets.
- Replaced generic generation frontmatter type guidance with a source-ingest-specific allowed type list.
- Retained `domain-guidance.ts` and corrected Fate/stay night current-scene wording so domain scene summaries / route / ending / epilogue material stays in allowed source-ingest targets, while live current-scene is REVIEW for campaign setup or runtime update flows.
- Updated prompt tests to assert forbidden source-ingest path globs are not rendered as directory boundary / FILE target hints and that Stage 2 focused contracts still expand only from Source Profile `needed_categories`.

### Validation

- `npx.cmd vitest run src/lib/ingest.prompt.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 110 tests.

### Scope notes

- Did not change writer hard boundary functions or tests.
- Did not delete `src/lib/rpg-interactions/source-ingest/domain-guidance.ts`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Merge Prompt Schema Boundary Sync

### Stage

Small merge-prompt update requested by the user to align `src/lib/rpg-interactions/merge/` with the current RPG schema slot and runtime overlay contract.

### Changed files

- Updated `src/lib/rpg-interactions/merge/merge-policy.ts`
- Updated `src/lib/rpg-merge-policy.test.ts`
- Updated `src/lib/rpg-section-merge.test.ts`
- Updated `src/lib/page-merge.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added schema-slot lookup and fixed world/player slot awareness to page merge policy.
- Added prompt metadata for target path, merge policy, schema slot, write policy, and category/base-runtime boundary.
- Added specific prompt fragments for fixed world slots, fixed player slots, quests, outline progress, runtime overlays, base relationships, base plot arcs, current scene, and event history.
- Kept arbitrary `wiki/world/<custom>.md` and `wiki/player/<custom>.md` on conservative generic guidance instead of treating them as normal fixed-slot targets.
- Split base relationship / plot-arc prompt boundaries from runtime overlay prompt boundaries.
- Updated tests to remove the old `wiki/player/status.md` runtime-state fixture and cover the new fixed-slot / runtime-overlay prompt behavior.

### Validation

- `npx.cmd vitest run src/lib/rpg-merge-policy.test.ts` passed: 1 file, 33 tests.
- `npx.cmd vitest run src/lib/rpg-merge-policy.test.ts src/lib/rpg-merge-lint.test.ts src/lib/rpg-section-merge.test.ts src/lib/rpg-interactions.test.ts src/lib/page-merge.test.ts` passed: 5 files, 117 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not change `page-merge-interaction.ts` output protocol; merge still asks for a complete markdown file, not JSON.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not modify `docs/RPG_WIKI_SCHEMA.md` in this stage.
- No `git commit` or `git push` was performed.

## 2026-06-12 - RPG Schema Page Section Detail Sync

### Stage

Documentation-only schema clarification requested by the user.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced broad directory-level "需要抽取的信息" lists with concrete page-level section guidance where the schema has fixed wiki pages.
- Clarified `world/` as five fixed pages, `player/` as five fixed pages, `outlines/` as separate `main.md` and `progress.md` contracts, and `style/` / `rules/` as fixed control slots.
- Added recommended section kinds for free-page directories and runtime overlay boundaries, including `characters`, `locations`, `factions`, `items`, `plot-arcs`, `events`, `current-scene`, and `relationships`.

### Validation

- Reviewed the current code-readable schema and project skeleton templates before editing.
- Ran `git diff -- docs\RPG_WIKI_SCHEMA.md` and targeted `rg --encoding utf-8` checks for the updated fixed-slot section names.
- Documentation-only update; no automated tests were run.

### Scope notes

- Did not change source code, runtime behavior, schema constants, prompts, parsers, or writer/apply behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Review Fixes

### Stage

Follow-up fixes for the latest runtime code review findings.

### Changed files

- Updated `.gitignore`
- Updated `src/lib/rpg-interactions/runtime/recall-selector-validation.ts`
- Updated `src/lib/rpg-recall-selector.test.ts`
- Updated `src/lib/rpg-runtime/world-tick-input-builder.ts`
- Updated `src/lib/rpg-world-tick-contract.test.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.test.ts`
- Updated `src/lib/ingest-source-path-collision.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added deterministic Recall Selector guardrails for retrieval-index scope matching, selected section scope matching, selected item / section budget caps, returned recall budget caps, and `allowFullPageRead=false` policy enforcement.
- Removed the historical event-page-to-ongoing-event mapping from World Tick input construction. Recent event pages remain `preActionRefs` history constraints; pending reactions still become `ongoingEvents`.
- Extended runtime update apply resolution so structured proposal audit fields are carried into review items and warnings without becoming ordinary `PendingRpgUpdate` entries.
- Replaced legacy fenced update-block stage-pending tests with structured RuntimeUpdateProposalResult JSON fixtures.
- Initialized source-path collision fixtures with explicit llmWikiRPG project metadata and schema marker, and adjusted RPG-mode test expectations to avoid legacy `wiki/concepts/` output.
- Added `.codegraph/` and `.codex/config.toml` ignore rules for local agent artifacts.

### Validation

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/ingest-source-path-collision.test.ts` passed: 4 test files, 40 tests.
- `npm.cmd run typecheck` passed.
- `npm.cmd run test:mocks` passed: 127 test files, 1654 tests.

### Scope notes

- Did not restore legacy fenced-block parsing or add default/legacy project mode fallback.
- Did not convert outline revision audit material into ordinary pending wiki updates.
- Did not delete local `.codegraph/` or `.codex/config.toml` files.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Final Architecture Runtime Diagram Sync

### Stage

Architecture documentation sync after Runtime Context Compiler Removal Plan Stage G.

### Changed files

- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Checked the current runtime implementation before changing the architecture document.
- Updated the main Mermaid architecture diagram so the runtime turn path no longer contains Context Compiler / CompactStoryBrief and instead shows the implemented module-specific chain: action resolver input builder, action resolver, world tick input builder, world tick, post-action working state, recall selector input builder, recall selector, recall handoff, outline brief input builder, outline brief, optional story outline regenerator, narration input builder, narration generator, turn record, runtime update proposal, validation, pending updates, review/apply, and runtime metadata.
- Updated adjacent final-architecture prose so runtime context is described as module-specific input builders / handoff readers rather than a centralized total brief.
- Removed a stale final-architecture sentence claiming a remaining centralized compact-brief transition path.

### Validation

- `rg --encoding utf-8 -n "legacy_context_compiler|legacy_compact|CompactStoryBrief|context_compiler|Context Compiler|上下文编译器|compileRpgContext|runRpgRuntimePreview" docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md src/lib/rpg-runtime src/lib/rpg-interactions/registry.ts src/components` confirmed the final architecture doc no longer contains the removed compiler / compact-brief names. The only source-side `context_compiler` residue is the inactive type-union value in `src/lib/rpg-interactions/registry.ts`.
- Documentation-only update; no automated test suite was run.

### Scope notes

- Did not change runtime code or behavior.
- Did not add `wiki/runtime/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stage G

### Stage

`docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` 阶段 G：移除 CompactStoryBrief 主流程。

### Changed files

- Updated `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/types.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Deleted `src/lib/rpg-runtime/context-compiler.ts`
- Deleted `src/lib/rpg-runtime/runtime-agent.ts`
- Updated `src/lib/rpg-runtime/recall-selector-handoff.ts`
- Updated `src/lib/rpg-runtime/recall-selector-input-builder.ts`
- Updated `src/lib/rpg-runtime/outline-brief-input-builder.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/lib/rpg-runtime.test.ts`
- Updated `src/lib/rpg-recall-selector-handoff.test.ts`
- Updated `src/lib/rpg-action-resolver.test.ts`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`

### Summary

- Removed the post-narration `runRpgRuntimePreview()` call from `runRpgTurn()`.
- Removed `RunRpgTurnResult.brief` and `RunRpgRuntimeTurnFlowResult.brief`.
- Deleted the old brief-based helper functions from `turn-orchestrator.ts`: `buildActionResolverInputFromBrief()`, `buildWorldTickInputFromBrief()`, and `buildNarrationGeneratorInputFromTurnState({ brief })`.
- Removed preview/compiler types from the shared runtime type surface and stopped exporting `compileRpgContext()` / `runRpgRuntimePreview()` from `src/lib/rpg-runtime/index.ts`.
- Deleted the legacy preview/context compiler implementation files instead of retaining them as debug-only helpers.
- Kept `runtime_update_proposal` scoped to `turn.turnRecord`; no new logic derives wiki facts from a single narration text block.
- Kept the formal module chain on module-specific input builders and handoffs: action resolver, world tick, recall selector, outline brief, optional story outline regenerator, and narration generator.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-runtime-update-proposal.test.ts` passed: 7 test files, 102 tests.
- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` passed: 1 test file, 15 tests.
- `rg --encoding utf-8 "runRpgRuntimePreview\\(|compileRpgContext\\(|CompactStoryBrief|buildActionResolverInputFromBrief\\(|buildWorldTickInputFromBrief\\(|buildNarrationGeneratorInputFromTurnState\\(" src/lib/rpg-runtime src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts` returned no matches.

### Scope notes

- Did not split or redesign `runtime_update_proposal`.
- Did not add `wiki/runtime/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not bypass pending / review / apply boundaries or write wiki state from runtime modules.
- Did not make `runtime_update_proposal` infer facts from a single narration body.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages E-F

### Stage

`docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` 阶段 E：拆出 Outline Brief 输入读取；阶段 F：拆出 Narration 输入和 style / forbidden handoff。

### Changed files

- Updated `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Added `src/lib/rpg-runtime/outline-brief-input-builder.ts`
- Added `src/lib/rpg-runtime/narration-input-builder.ts`
- Updated `src/lib/rpg-runtime/outline-brief-handoff.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-outline-brief.test.ts`
- Updated `src/lib/rpg-narration-generator.test.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `src/lib/rpg-recall-selector.test.ts`

### Summary

- Added `buildOutlineBriefInputFromTurnStateAndWiki()` so `OutlineBriefCompilerInput` is built from post-action turn state, recall handoff, controlled outline/progress slices, plot-arc base/runtime pages, relationship runtime overlays, and fixed rules slots rather than from `CompactStoryBrief`.
- Extended outline tension classification so `wiki/relationships/runtime/*.md` can contribute relationship pressure fuel alongside `wiki/plot-arcs/*.md` and `wiki/plot-arcs/runtime/*.md`.
- Added `buildNarrationGeneratorInputFromHandoffs()` so `NarrationGeneratorInput` is built from structured handoffs plus dedicated reads of style, forbidden, memory/player preferences, rules, and player known-information slots.
- Updated `runRpgTurn()` to call `buildOutlineBriefInputFromTurnStateAndWiki()` before `outline_brief` and `buildNarrationGeneratorInputFromHandoffs()` before `narration_generator`.
- Moved `runRpgRuntimePreview()` to after narration generation. It now exists only to fill the temporary `RunRpgTurnResult.brief` / controller result surface; it no longer provides input to action resolver, world tick, recall selector, outline brief, or narration generator.
- Kept `CompactStoryBrief`, `compileRpgContext()`, `runRpgRuntimePreview()`, `RunRpgTurnResult.brief`, `buildOutlineBriefCompilerInputFromTurnState()`, and `buildNarrationGeneratorInputFromTurnState({ brief })` for stage G cleanup / result-surface compatibility. The old helpers are not production `runRpgTurn()` dependencies.
- Added focused tests proving direct wiki-built outline brief input, direct wiki-built narration input, and orchestrator ordering where outline/narration inputs are captured before the later legacy preview sees a fixture mutation.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-story-outline-regenerator.test.ts` passed: 6 test files, 83 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 -n "buildOutlineBriefCompilerInputFromTurnState\\(|buildNarrationGeneratorInputFromTurnState\\(|runRpgRuntimePreview\\(|CompactStoryBrief|compileRpgContext\\(" src/lib/rpg-runtime/turn-orchestrator.ts src/lib/rpg-runtime/outline-brief-input-builder.ts src/lib/rpg-runtime/narration-input-builder.ts src/lib/rpg-runtime/index.ts` confirms production `runRpgTurn()` uses the new builders, with legacy preview retained only after narration for the temporary `brief` surface.

### Scope notes

- Did not migrate or split `runtime_update_proposal`.
- Did not execute stage G final `CompactStoryBrief` deletion.
- Did not delete `CompactStoryBrief`, `compileRpgContext()`, or `runRpgRuntimePreview()`.
- Did not remove `RunRpgTurnResult.brief`.
- Did not add `wiki/runtime/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not bypass pending / review / apply boundaries or write wiki state from runtime modules.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages C-D

### Stage

`docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` 阶段 C：拆出 World Tick 输入读取；阶段 D：拆出 Recall Selector 输入读取。

### Changed files

- Updated `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Added `src/lib/rpg-runtime/world-tick-input-builder.ts`
- Added `src/lib/rpg-runtime/recall-selector-input-builder.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-world-tick-contract.test.ts`
- Updated `src/lib/rpg-recall-selector-handoff.test.ts`
- Updated `src/lib/rpg-recall-selector.test.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`

### Summary

- Added `buildWorldTickInputFromWiki()` so `WorldTickInput` is built directly from `ActionResolution`, the action resolver `preActionSnapshot`, current scene, recent events, runtime relationship / plot-arc overlays, quests, affected entity overlays, outline progress, and fixed rules slots.
- Added `buildRecallSelectorInputFromTurnStateAndWiki()` so `RecallSelectorInput` and retrieval index are built from post-action turn state plus module-specific wiki reads, not from `CompactStoryBrief`.
- Updated `runRpgTurn()` so `action_resolver`, `world_tick`, and `recall_selector` all run before `runRpgRuntimePreview()` / `legacy_context_compiler_v0`.
- Moved the legacy preview call to after `createRecallSelectorHandoff()`. The remaining brief currently serves downstream not-yet-migrated narration style / forbidden helper logic and the temporary `RunRpgTurnResult.brief` surface.
- Kept old helpers `buildWorldTickInputFromBrief()` and `buildRecallSelectorInputFromTurnState({ brief })` in place for now, but removed them from the production `runRpgTurn()` path.
- Added focused tests proving direct wiki-built World Tick input, direct wiki-built Recall Selector retrieval index, and orchestrator ordering where legacy preview sees a fixture mutation only after recall selector has already run.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts` passed: 7 test files, 73 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 -n "buildWorldTickInputFromBrief\\(|buildRecallSelectorInputFromTurnState\\(|buildWorldTickInputFromWiki\\(|buildRecallSelectorInputFromTurnStateAndWiki\\(|runRpgRuntimePreview\\(" src/lib/rpg-runtime src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-world-tick-contract.test.ts` confirms `runRpgTurn()` calls the new builders before the later `runRpgRuntimePreview()` call; old brief helpers remain only as legacy definitions / tests.

### Scope notes

- Did not migrate `outline_brief`.
- Did not migrate `narration_generator`.
- Did not migrate `runtime_update_proposal`.
- Did not delete the full `CompactStoryBrief` / `compileRpgContext()` / `runRpgRuntimePreview()` transition path.
- Did not add `wiki/runtime/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not bypass pending / review / apply boundaries or write wiki state from runtime modules.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan Stages A-B

### Stage

`docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md` 阶段 A：文档和命名边界修正；阶段 B：拆出 Action Resolver 输入读取。

### Changed files

- Updated `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md`
- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Added `src/lib/rpg-runtime/wiki-readers.ts`
- Added `src/lib/rpg-runtime/action-resolver-input-builder.ts`
- Updated `src/lib/rpg-runtime/context-compiler.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-action-resolver.test.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`

### Summary

- Removed `context_compiler` from the target runtime module descriptions in `docs/RPG_WIKI_SCHEMA.md`. The old `compileRpgContext() -> CompactStoryBrief` implementation is now documented as `legacy_context_compiler_v0` / `legacy_compact_brief_builder`, a transition layer to remove rather than a future `Context Compiler v1`.
- Updated the final architecture document to show `Action Resolver input builder -> action_resolver` as the first runtime LLM path after submitted action. The legacy brief builder is shown only after action resolution for not-yet-migrated downstream modules.
- Extracted deterministic wiki reader helpers into `src/lib/rpg-runtime/wiki-readers.ts`, so small reader utilities can be reused without making new module builders depend on `CompactStoryBrief`.
- Added `buildActionResolverInputFromWiki()` in `src/lib/rpg-runtime/action-resolver-input-builder.ts`. It reads action resolver material directly from current scene, fixed player slots, fixed rules slots, relevant character/location/item/faction base + runtime overlay pages, quests, and references.
- Updated `runRpgTurn()` so action resolver input no longer comes from `preview.brief`. `runRpgRuntimePreview()` now runs only after `action_resolver`, with a warning noting that `legacy_context_compiler_v0` remains temporarily for downstream modules.
- Kept `RunRpgTurnResult.brief` and the old `buildActionResolverInputFromBrief()` helper temporarily. `buildActionResolverInputFromBrief()` has no remaining `src/lib` call site.
- Added focused tests for direct wiki-built action resolver input and for orchestrator ordering around the post-action legacy preview.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts` passed: 3 test files, 45 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 -n "buildActionResolverInputFromBrief\\(" src/lib` shows only the helper definition in `src/lib/rpg-runtime/turn-orchestrator.ts`.
- `rg --encoding utf-8 -n "runRpgRuntimePreview\\(|compileRpgContext\\(|buildActionResolverInputFromWiki\\(" src/lib/rpg-runtime/turn-orchestrator.ts src/lib/rpg-runtime/action-resolver-input-builder.ts src/lib/rpg-runtime/context-compiler.ts` confirms `buildActionResolverInputFromWiki()` is called before the post-action `runRpgRuntimePreview()` call in `runRpgTurn()`.

### Scope notes

- Did not remove the `CompactStoryBrief` dependencies for `world_tick` / `recall_selector` / `outline_brief` / `narration_generator` / `runtime_update_proposal`.
- Did not delete the full `CompactStoryBrief` / `compileRpgContext()` / `runRpgRuntimePreview()` transition path.
- Did not add `wiki/runtime/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not update `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md` because that current-path file is absent in this worktree; only the archived copy exists.
- No `git commit` or `git push` was performed.

## 2026-06-12 - Runtime Context Compiler Removal Plan

### Stage

Documentation-only planning note requested by the user.

### Changed files

- Added `docs/RPG_RUNTIME_CONTEXT_COMPILER_REMOVAL_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Documented the decision that the formal runtime turn flow should not keep the centralized `compileRpgContext() -> CompactStoryBrief` layer.
- Recorded the current implementation reality: `compileRpgContext()` is still truly connected through `runRpgRuntimePreview()` / `runRpgTurn()`, so removal requires staged code work rather than only documentation cleanup.
- Defined the target flow where `action_resolver`, `world_tick`, `recall_selector`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, and `runtime_update_proposal` each consume module-specific input builders / handoffs.
- Clarified that `story_outline_regenerator` is not a direct `CompactStoryBrief` consumer, but is still indirectly affected while `outline_brief` and its upstream inputs are derived from the old total-brief chain.
- Split the removal into staged work: documentation/name cleanup, action resolver input builder, world tick input builder, recall input builder, outline brief input builder, narration handoff builder, and final `CompactStoryBrief` / `compileRpgContext()` removal from the production runtime path.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not change runtime behavior, UI behavior, writer/apply behavior, schema constants, tests, or project compatibility behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Schema Phase Information Flow Matrix

### Stage

Documentation-only schema expansion requested by the user.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a new `阶段 / 模块信息流矩阵` table next to, but separate from, the existing directory read/write matrix.
- Documented per-phase/module inputs, outputs, and boundaries, with section/file/field granularity folded directly into the input and output columns.
- Covered import phases, manual/review edits, post-ingest derivation, context compilation, recall selection, action resolution, world tick, outline brief, story outline regeneration, narration generation, runtime update proposal, and runtime update apply.
- Added section-level examples for character pages, outlines, current-scene snapshots, player fixed slots, events, quests, runtime overlays, rules/style/memory, non-wiki runtime handoffs, and pending proposal metadata.

### Validation

- `rg --encoding utf-8 "阶段 / 模块信息流矩阵|ActionResolution|WorldTickResult|TurnNarration|sourceDeltas|active clocks" docs/RPG_WIKI_SCHEMA.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` was run to confirm the new matrix and key terms are present.
- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not change runtime behavior, UI behavior, writer/apply behavior, schema constants, tests, or project compatibility behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Schema Directory Read/Write Matrix Cleanup

### Stage

Documentation-only schema cleanup requested by the user.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced the old `Runtime Schema Spine / 运行时共享契约` section in `docs/RPG_WIKI_SCHEMA.md` with `阶段读写矩阵`.
- Added directory-level write/read boundaries for persistent `wiki/` paths across import phases, manual/review edits, derivation, and runtime modules.
- Explicitly listed runtime module readers such as `context_compiler`, `recall_selector`, `action_resolver`, `world_tick`, `outline_brief`, `story_outline_regenerator`, `narration_generator`, `runtime_update_proposal`, and `runtime_update_apply`.
- Clarified that runtime-only type contracts, field enums, and JSON schemas should live in runtime / interaction documentation or code types rather than in the directory schema file.
- Reconfirmed that runtime intermediate artifacts, turn records, runtime journals, pending metadata, and `.llm-wiki/runtime/` are not ordinary `wiki/runtime/` pages or ordinary ingest targets.

### Validation

- `rg --encoding utf-8 "Runtime Schema Spine|阶段读写矩阵|action_resolver|world_tick|runtime_update_apply|Runtime Schema" docs/RPG_WIKI_SCHEMA.md` was run to confirm the new matrix is present and the removed heading is gone.
- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not change runtime behavior, UI behavior, writer/apply behavior, schema constants, tests, or project compatibility behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Fixed World Slot Directory Contract

### Stage

Small schema / writer-contract alignment pass to make `wiki/world/` a fixed slot directory.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-categories.ts`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `src/lib/project-mode.ts`
- Updated `src-tauri/src/commands/project.rs`
- Updated `src/lib/ingest.ts`
- Updated `src/lib/rpg-extraction-validation.ts`
- Updated `src/lib/rpg-interactions/source-ingest/analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/chunk-analysis-interaction.ts`
- Updated `src/lib/rpg-interactions/source-ingest/page-guidance-contract.ts`
- Updated focused fixtures/tests that referenced arbitrary `wiki/world/*.md` pages.
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added five fixed world schema slots: `world_basic_overview`, `world_history`, `world_common_sense`, `world_supernatural_presence`, and `world_social_structure`.
- Replaced the open `wiki/world/` ordinary Source Ingest target with exact fixed slot paths.
- Added `RPG_FIXED_WORLD_SLOT_PATHS` and tests proving arbitrary `wiki/world/tide-laws.md` is no longer an allowed Source Ingest target.
- Updated new-project Rust starter templates so all five fixed world files are created.
- Updated project-mode schema text and `docs/RPG_WIKI_SCHEMA.md` to state that extra world subtopics must merge into a fixed slot or route to a more specific directory.
- Updated prompt / validation wording so ordinary Source Ingest no longer suggests free-form `wiki/world/foo.md` pages.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/ingest.prompt.test.ts src/lib/ingest.scenarios.test.ts src/lib/rpg-import/source-ingest.test.ts src/lib/rpg-smoke.test.ts src/lib/rpg-interactions.test.ts src/components/rpg/rpg-runtime-panel.test.tsx src/components/rpg/pending-rpg-updates-panel.test.tsx` passed: 8 files, 149 tests.
- `npm.cmd run typecheck` passed.
- `cargo test create_project_writes` from `src-tauri` passed: 2 tests. Existing warnings remained: path canonicalization warning and two non-snake-case test function warnings in `proxy.rs`.

### Scope notes

- Did not change runtime write targets to allow world writes; runtime update still blocks `wiki/world/`.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- Did not delete existing arbitrary world files from any user project.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Campaign Setup Player Subslot Import Options

### Stage

Small campaign setup UI/schema alignment pass for fixed player subslot imports.

### Changed files

- Updated `src/lib/rpg-interactions/campaign-setup/setup-contract.ts`
- Updated `src/lib/rpg-import/campaign-setup-import.ts`
- Updated `src/lib/rpg-import/ui-import-options.ts`
- Updated `src/i18n/en.json`
- Updated `src/i18n/zh.json`
- Updated `src/lib/rpg-import/campaign-setup-import.test.ts`
- Updated `src/lib/rpg-import/ui-import-options.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added explicit deterministic campaign setup slots for `player_abilities`, `player_inventory`, `player_goals`, and `player_known_information`.
- Exposed the four new slots in the file import UI with English and Chinese labels/descriptions.
- Added canonical campaign setup bodies for each player subslot so each import writes directly to its fixed `wiki/player/*.md` target.
- Kept `player_main` scoped to `wiki/player/player.md`; no automatic profile splitting, LLM routing, or legacy/default compatibility was added.
- Adjusted the ability-like warning so it does not warn about routing to `wiki/player/abilities.md` when the selected target already is `player_abilities`.

### Validation

- `npx.cmd vitest run src/lib/rpg-import/campaign-setup-import.test.ts src/lib/rpg-import/ui-import-options.test.ts src/lib/rpg-interactions.test.ts`
- `npm.cmd run typecheck`

### Scope notes

- Did not change source ingest, control doc import, runtime update apply, writer safety rules, review queue behavior, or LLM behavior.
- Did not add automatic splitting of one Player Profile file into multiple player subslots.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Campaign Setup Starter Schema Guidance

### Stage

Small campaign setup usability improvement for new-project starter pages.

### Changed files

- Updated `src-tauri/src/commands/project.rs`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced sparse campaign setup-facing starter templates with visible schema guidance for `wiki/player/player.md`, the four fixed player subslots, and `wiki/current-scene/scene_state.md`.
- Added recommended import/source headings so users can prepare files that are reviewable without first knowing the full RPG schema.
- Documented fixed player slot boundaries directly in `wiki/player/player.md`.
- Documented that `campaign_setup_import` v0 is deterministic and does not ask an LLM to split player profiles into abilities, inventory, goals, or knowledge automatically.
- Added Rust coverage to assert new projects contain the starter guidance.

### Validation

- `cargo fmt` from `src-tauri`
- `cargo test create_project_writes` from `src-tauri`
- `npm.cmd run typecheck`

### Scope notes

- Did not change campaign setup import target slots, write policies, review behavior, or LLM behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Knowledge Tree Campaign Setup Type Grouping Fix

### Stage

Small UI bug fix for campaign setup imports appearing under quoted pseudo-folders in the Knowledge Tree.

### Changed files

- Updated `src/components/layout/knowledge-tree.tsx`
- Added `src/components/layout/knowledge-tree.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced the Knowledge Tree's regex-only frontmatter `type:` parsing with the shared YAML `parseFrontmatter()` helper.
- Fixed quoted campaign setup frontmatter values such as `type: "player"` and `type: "current-scene"` being grouped as `"player"` / `"current-scene"` in the UI.
- Added UI grouping aliases for campaign setup single-content types: `event -> events`, `quest -> quests`, and `relationship -> relationships`.
- Kept actual campaign setup writer behavior unchanged; disk writes already target the canonical RPG paths.

### Validation

- `npx.cmd vitest run src/components/layout/knowledge-tree.test.ts src/lib/wiki-page-types.test.ts src/lib/rpg-import/campaign-setup-import.test.ts`
- `npm.cmd run typecheck`

### Scope notes

- Did not change campaign setup import contracts, target paths, write policies, review behavior, or LLM behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Final Architecture Diagram Status Labels

### Stage

Documentation-only architecture diagram status-label update requested by the user.

### Changed files

- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a status legend to the architecture diagram.
- Marked key nodes as implemented, connected, v0/needs refinement, code-present but not connected, or missing.
- Explicitly marked Story Outline Regenerator as code-present but not wired into the default UI path.
- Explicitly marked Relationship/Tension Deriver as implemented but not connected to the product loop.
- Explicitly marked Context Compiler v1 boundary work as needing refinement.
- Added Project Audit / Evaluation and real-model long-turn evaluation as not implemented.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not change runtime behavior, UI behavior, writer/apply behavior, schema constants, tests, or project compatibility behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Final Architecture Diagram Expanded

### Stage

Documentation-only architecture diagram update requested by the user.

### Changed files

- Updated `docs/LLMWIKIRPG_FINAL_ARCHITECTURE.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced the old architecture diagram with a broader system diagram covering Campaign Setup, Control Doc import, Source Ingest, Merge / wiki write layer, Runtime turn flow, Review / pending queue, Markdown RPG Wiki, runtime persistence/audit state, and search/graph/vector retrieval.
- Moved `SubmittedAction` inside the runtime turn loop in the diagram.
- Represented the shared review/apply feedback path from import, merge, and runtime updates back into Markdown Wiki.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not change runtime behavior, UI behavior, writer/apply behavior, schema constants, tests, or project compatibility behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Runtime Update Proposal Structured JSON Cleanup

### Stage

Small cleanup for the runtime update proposal boundary. Scope stayed limited to runtime update proposal code, direct parser callers, focused tests, and current state / implementation log docs.

### Changed files

- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-proposal-validation.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-runtime-update-proposal.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Removed the old `rpg-wiki-update` fenced fallback from `runtimeUpdateInteractionSpec.parseOutput()`.
- Removed the empty-output no-op branch; empty runtime update proposal output now fails structured JSON parsing / validation.
- Removed the parser-level `proposedUpdates` alias from `RuntimeUpdateInteractionResult`; `proposedWikiUpdates` is the canonical field.
- Tightened structured JSON validation so any top-level `proposedUpdates` alias is rejected, even when `proposedWikiUpdates` is also present.
- Removed the interaction-layer `{ turnRecord }` convenience builder and now require complete `RuntimeUpdateProposalInput` at `buildPrompt()` / `parseOutput()`. The centralized handoff builder remains `buildRuntimeUpdateProposalInputFromTurnRecord()`.
- Updated `runRpgRuntimeTurnFlow()` so validation, pending staging, journal persistence, and the outer result's `proposedUpdates` are derived from `runtimeUpdateProposal.proposedWikiUpdates`.
- Minimally updated `runtime_update_apply` parser calls to provide structured proposal input while leaving pending/apply/write policy core logic intact.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts` passed: 3 test files, 81 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not delete pending/apply/write policy core logic.
- Did not perform a broad runtime refactor.
- Did not modify UI behavior.
- Did not add legacy/default compatibility, migration fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Validator + Orchestrator Stage

### Stage

RPG Runtime LLM 6 / Runtime Update Proposal 阶段 4：Validator + Pending Staging，以及阶段 5：Orchestrator 接入。本轮只接入 structured proposal 到主 runtime proposal flow；没有进入 writer/apply/UI 改造。

### Changed files

- Updated `src/lib/rpg-interactions/runtime/runtime-update-proposal-validation.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Added `src/lib/rpg-runtime/runtime-update-proposal-handoff.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-runtime-update-proposal.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/lib/rpg-runtime-persistence.test.ts`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Strengthened structured Runtime Update Proposal validation. Events now require `confirmed_happened` source deltas; player known information rejects `parallelLineText`, `user_visible_pc_unknown`, and non-PC-knowledge source deltas; runtime overlays require source-delta `affectedPaths` traceability to the target overlay.
- Added cross-reference checks for `proposalGroups.updateIds`, `proposalGroups.skippedDeltaIds`, `proposalGroups.sourceDeltaIds`, and `pacingUpdateProposal.sourceDeltaIds`.
- Kept `outlineRevisionReviewItems` as independent review material with `ordinaryRuntimeUpdate: false`, `proposedWikiUpdate: false`, and `autoWriteMainOutline: false`.
- Added `buildRuntimeUpdateProposalInputFromTurnRecord()` to construct deterministic `RuntimeUpdateProposalInput` from the completed `RpgTurnRecord`, including current turn structured sources, minimal `consistencyValidation`, allowed targets, write policy, and review policy.
- Updated `runRpgRuntimeTurnFlow()` to call `runtime_update_proposal` with the structured input, then stage only accepted ordinary `proposedWikiUpdates` into pending updates.
- Added runtime proposal audit summary to controller result and turn journal entries, covering proposal journal entries, skipped deltas, pacing proposal, proposal groups, outline review items, and warnings.
- Preserved empty output as a no-op compatibility path and preserved fenced `rpg-wiki-update` blocks as manual / compatibility staging fallback.

### Validation

- `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 6 test files, 124 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "buildRuntimeUpdateProposalInputFromTurnRecord|RuntimeUpdateProposalInput|RuntimeUpdateProposalResult|runtime_update_proposal|sourceDeltas|proposalGroups|SkippedRuntimeDelta|outlineRevisionReviewItems|wiki/outlines/main.md|user_visible_pc_unknown|attempted_not_confirmed" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not modify wiki writer/apply behavior.
- Did not modify UI behavior.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` registry entry.
- Did not auto-write `wiki/outlines/main.md`.
- Did not mix `outlineRevisionProposal` / `outlineRevisionReviewItems` into ordinary `ProposedWikiUpdate`.
- Did not auto-apply pending updates.
- Did not add legacy/default compatibility, fallback, or old-path preservation beyond the existing explicit fenced-block manual compatibility path.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Types + Interaction Contract Stage

### Stage

RPG Runtime LLM 6 / Runtime Update Proposal 阶段 2：Runtime Types + JSON Contract，以及阶段 3：Interaction Spec 改造。本轮只完成 contract-layer 类型、JSON parser / validator、adapter、registry/export、prompt 和聚焦测试；没有进入阶段 4 / 5。

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/llm-runtime-update-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/runtime-update-proposal-validation.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-runtime-update-proposal.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added runtime-only LLM 6 contract types: `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, `RuntimeProposedWikiUpdate`, `RuntimeUpdateSourceDelta`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, `ProposalGroup`, `OutlineRevisionReviewItem`, minimal `RuntimeUpdateConsistencyValidation`, and allowed target / write policy / review policy helper shapes.
- Added JSON parser / validator for `RuntimeUpdateProposalResult`. It supports bare JSON and fenced JSON, validates structure and boundaries first, and does not enter pending staging or apply.
- Validator checks ordinary update target policy via existing runtime target rules, requires source deltas and metadata, rejects non-confirmed event writes, rejects PC-unknown parallel-line material as automatic player knowledge, and keeps outline revision material out of ordinary `proposedWikiUpdates`.
- Upgraded `runtimeUpdateInteractionSpec` to `runtime_update_proposal` and changed the main output contract to structured JSON. Old fenced `rpg-wiki-update` markdown blocks remain a compatibility/manual-staging fallback, not the primary protocol.
- Prompt now prioritizes structured current-turn sources: `PostActionWorkingState`, `ActionResolution`, `WorldTickResult`, `WorldTickVisibleSelection`, `TurnNarration`, `consistencyValidation`, recall handoff, and outline handoff. `generatedNarrative` / `playerFacingText` are evidence/display material only.
- Prompt boundaries now explicitly cover `parallelLineText` / `user_visible_pc_unknown`, `nextActionOptions`, `attempted_not_confirmed`, `possible_future`, independent `outlineRevisionReviewItems`, and required ordinary update metadata.
- Added structured fixture and LLM proposal adapters that run through `runtimeUpdateInteractionSpec.buildPrompt()` and `parseOutput()`, while leaving the existing raw-output adapter available for current controller use.
- Registered/exported `runtime_update_proposal`; focused tests cover parser, validator, adapters, registry/export, prompt boundaries, old fenced fallback, and forbidden cases.
- Marked LLM 6 stages 2 and 3 `[已完成]`; stages 4 and 5 remain `[待实现]`.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 86 tests.

### Scope notes

- Did not modify runtime update validator / pending staging / apply behavior.
- Did not connect structured `RuntimeUpdateProposalResult` to `runRpgTurn` or `runRpgRuntimeTurnFlow`.
- Did not modify writer/apply behavior or UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` registry entry.
- Did not auto-write `wiki/outlines/main.md`.
- Did not mix `outlineRevisionProposal` into ordinary `ProposedWikiUpdate`.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Schema Guidance Stage

### Stage

RPG Runtime LLM 6 / Runtime Update Proposal 阶段 1：Schema Guidance，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` LLM 6 checklist 第 1 点。

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Documented the Runtime Update Proposal input fact-source boundary: structured `PostActionWorkingState`, `ActionResolution`, `WorldTickResult`, recall/outline handoff, `TurnNarration`, `consistencyValidation`, optional provisional/outline proposal audit material, and local allowed target/write/review policy.
- Documented `RuntimeUpdateProposalResult` output boundaries for `proposedWikiUpdates`, `outlineRevisionReviewItems`, `journalEntries`, `skippedDeltas`, `pacingUpdateProposal`, `proposalGroups`, and `warnings`.
- Documented enhanced `ProposedWikiUpdate` fields: `sourceDeltas`, `lineTarget`, `visibility`, `knowledgeScope`, `happenedStatus`, `confidence`, and `validationHints`.
- Clarified that structured turn deltas should be primary, while `generatedNarrative` and `playerFacingText` remain evidence/display material only.
- Clarified hard boundaries: `parallelLineText` / `user_visible_pc_unknown` cannot automatically become PC knowledge; `nextActionOptions` are not facts; `attempted_not_confirmed` cannot enter confirmed `events`; `outlineRevisionProposal` must remain an independent review item and cannot auto-write `wiki/outlines/main.md`.
- Clarified that fenced markdown update blocks may remain for compatibility/manual staging, but should not be the new runtime main flow's only protocol.
- Added code-readable guidance constants and getters in `src/lib/rpg-wiki-schema.ts`: `RPG_RUNTIME_UPDATE_PROPOSAL_INPUT_SCHEMA`, `RPG_RUNTIME_UPDATE_PROPOSAL_RESULT_SCHEMA`, `RPG_PROPOSED_WIKI_UPDATE_RUNTIME_FIELDS`, `RPG_RUNTIME_UPDATE_SOURCE_DELTA_FIELDS`, `RPG_SKIPPED_RUNTIME_DELTA_FIELDS`, `RPG_PACING_UPDATE_PROPOSAL_FIELDS`, `RPG_PROPOSAL_GROUP_FIELDS`, `RPG_OUTLINE_REVISION_REVIEW_ITEM_SCHEMA`, `RPG_RUNTIME_UPDATE_PROPOSAL_GUIDANCE`, and aggregate guidance.
- Added focused schema tests confirming LLM 6 guidance is machine-readable, includes structured fact sources and all requested proposal components, preserves PC knowledge/events/outline boundaries, treats fenced blocks as compatibility/manual staging, keeps `RPG_SCHEMA_SLOTS` unchanged, and adds no ordinary `wiki/runtime` category.
- Marked only LLM 6 stage 1 `[已完成]`; stages 2-5 remain `[待实现]`.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 test file, 29 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "RuntimeUpdateProposalInput|RuntimeUpdateProposalResult|RPG_RUNTIME_UPDATE_PROPOSAL|SkippedRuntimeDelta|PacingUpdateProposal|ProposalGroup|OutlineRevisionReviewItem" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not add runtime types.
- Did not add or change JSON parser / validator behavior.
- Did not change `runtime-update-interaction.ts` prompt/parser behavior.
- Did not change `state-extractor.ts` `ProposedWikiUpdate` implementation.
- Did not change runtime update validator / pending staging / apply behavior.
- Did not connect LLM 6 to `runRpgTurn` or `runRpgRuntimeTurnFlow`.
- Did not modify writer/apply behavior or UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or registry entry.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 6 Runtime Update Proposal Implementation Plan Note

### Stage

Documentation-only planning note for **RPG Runtime LLM 6 / Runtime Update Proposal** phased implementation.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a dedicated LLM 6 phased implementation tracking plan to `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`.
- Recorded that LLM 6 can start after the LLM 5 Narration Generator cleanup, but should upgrade the existing runtime update proposal path in small stages.
- Documented the current starting point: `runtimeUpdateInteractionSpec`, `ProposedWikiUpdate`, fenced markdown update block parsing, deterministic validation, pending staging, and journal recording already exist.
- Split the recommended implementation into five `[待实现]` stages: Schema Guidance, Runtime Types + JSON Contract, Interaction Spec 改造, Validator + Pending Staging, and Orchestrator 接入.
- Reconfirmed boundaries around structured turn deltas, PC knowledge, parallel-line visibility, skipped deltas, pacing proposal, proposal groups, independent outline revision review items, no automatic apply, no `wiki/outlines/main.md` runtime write, and no ordinary `wiki/runtime` category.

### Validation

- Documentation-only change; no automated tests were run.

### Scope notes

- Did not modify source code.
- Did not implement LLM 6 schema guidance, runtime types, JSON parser / validator, adapters, registry exports, orchestrator wiring, writer/apply behavior, or UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Narration Generator Cleanup Pass

### Stage

Small post-LLM 5 cleanup pass for old narration adapter / prompt removal and `RpgTurnResult` transition consolidation.

### Changed files

- Deleted `src/lib/rpg-interactions/runtime/narration-adapter.ts`
- Deleted `src/lib/rpg-interactions/runtime/llm-narration-adapter.ts`
- Deleted `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Deleted `src/lib/rpg-llm-narration-adapter.test.ts`
- Deleted `src/lib/rpg-narration-prompts.test.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `src/lib/rpg-narration-generator.test.ts`
- Updated `src/lib/rpg-turn-model.test.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Audited the old narration symbols and confirmed the current production path uses `RpgNarrationGeneratorAdapter` / `createLlmRpgNarrationGeneratorAdapter` through `runRpgTurn`, runtime controller input plumbing, and the RPG runtime panel.
- Removed the old `narration` / `RpgTurnResult` prompt builder, fixture adapter, LLM adapter, registry entry, runtime barrel exports, and dedicated old prompt/adapter tests.
- Kept `RpgTurnResult` as a transition shape for UI display and Runtime Update Proposal, but moved the `TurnNarration -> RpgTurnResult` mapping into `createTurnResultFromTurnNarration()` in `turn-model.ts`.
- Moved `validateRpgTurnResult()` into `turn-model.ts` so the transition helper owns validation and reference cleaning without keeping the old adapter module alive.
- Updated tests to guard that old runtime narration prompt/adapter files and symbols are absent, while `narration_generator` remains registered and wired.
- Reduced duplicated `TurnNarration` fixture setup by reusing shared `sampleTurnNarration()` in narration generator tests.

### Validation

- `npm.cmd run typecheck` passed.
- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 7 test files, 123 tests.
- `rg --encoding utf-8 "RpgNarrationAdapter|createLlmRpgNarrationAdapter|createFixtureNarrationAdapter|buildRpgNarrationPrompt|narrationInteractionSpec|RpgNarrationPrompt|generateTurn|RpgNarrationGeneratorAdapter|createLlmRpgNarrationGeneratorAdapter|narration_generator|turnNarration|generatedNarrative" src/lib src/components docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not modify Runtime Update Proposal / LLM 6 behavior.
- Did not modify wiki writer/apply behavior.
- Did not modify UI display or controls.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not auto-write wiki or auto-apply pending updates.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Orchestrator Handoff Stage

### Stage

RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 3 阶段：Orchestrator 接入 + Turn Record Handoff，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` LLM 5 checklist 第 3 点。

### Changed files

- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/lib/rpg-runtime-test-fixtures.ts`
- Updated focused runtime, persistence, model, interaction, import/apply, write-policy, state-extractor, and panel tests for the new turn record shape.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Replaced the runtime flow's old narration adapter use point with the new `RpgNarrationGeneratorAdapter` / `narration_generator` contract.
- Added deterministic `buildNarrationGeneratorInputFromTurnState()` for current-turn handoff assembly without reading full `outlines/main.md`.
- `runRpgTurn` now validates `TurnNarration`, derives transitional `RpgTurnResult` from `turnNarration.playerFacingText`, and saves `turnNarration` into turn records and runtime results.
- Runtime controller and journal entries now persist `turnNarration` handoff fields while keeping Runtime Update Proposal on the conservative `generatedNarrative` transition field.
- Step 14.5 handoff behavior is covered: non-provisional turns keep `usedProvisionalPatch: false`; provisional turns pass only `provisionalOutlinePatch.narrationHandoff` and require `usedProvisionalPatch: true` / `respectedMustNotReveal: true`.
- Panel plumbing now creates the LLM narration generator adapter, but UI display/control behavior is unchanged and still reads the derived `turnResult` fields.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 7 test files, 126 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "TurnNarration|NarrationGeneratorInput|narration_generator|turnNarration|playerFacingText|parallelLineText|tensionBrief|displayPolicy|narrationMeta|provisionalOutlinePatch.narrationHandoff|outlineRevisionProposal" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not modify wiki writer/apply behavior.
- Did not change UI display or controls.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category or `wiki/runtime/` path.
- Did not enter Runtime Update Proposal / LLM 6 redesign.
- Did not auto-write wiki or auto-apply pending updates.
- Did not pass `outlineRevisionProposal` to Narration fact material.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Runtime Types + Interaction Contract Stage

### Stage

RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 2 阶段：Runtime Types + Interaction Contract，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` LLM 5 checklist 第 2 点。

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/narration-generator-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/narration-generator-validation.ts`
- Added `src/lib/rpg-interactions/runtime/narration-generator-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-narration-generator-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-narration-generator.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added runtime-only `NarrationGeneratorInput`, `TurnNarration`, `NarrationDisplayPolicy`, `TensionBrief`, `NarrationMeta`, runtime narration action option, source/ref, style bundle, forbidden constraint, player knowledge boundary, pacing compliance, and provisional patch usage types.
- Added independent `narration_generator` interaction spec and prompt contract. This keeps the existing `narration` / `RpgTurnResult` contract available for the current `runRpgTurn` main flow.
- Added bare/fenced JSON parser and deterministic validator for `TurnNarration`.
- Validator rejects missing core fields, invalid player-facing text, malformed `tensionBrief`, malformed options/refs, wiki write/update pollution, `ProposedWikiUpdate`, `outlineRevisionProposal`, `provisionalOutlinePatch`, full outline / `outlines/main.md` payloads, parallel-line PC-knowledge leaks, hidden / `gm_only` / `user_visible_pc_unknown` leaks, provisional handoff contradictions, `respectedMustNotReveal: false`, style-as-fact pollution, and unchosen action options marked as happened facts.
- Added fixture and LLM adapters that both route model/fixture output through the parser and validator.
- Registered and exported `narration_generator` as a contract-layer interaction only, with notes that it is not orchestrator integration.
- Added focused tests for prompt boundaries, parser behavior, validator success/failure paths, adapter validation, registry/export exposure, unchanged `RPG_SCHEMA_SLOTS`, no ordinary `wiki/runtime` category, and no `runRpgTurn` / writer/apply/UI integration.
- Updated LLM 5 checklist item 2 to `[已完成]`; item 3 remains `[待实现]`.

### Validation

- `npx.cmd vitest run src/lib/rpg-narration-generator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 86 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "NarrationGeneratorInput|TurnNarration|NarrationDisplayPolicy|TensionBrief|NarrationMeta|provisionalOutlinePatch.narrationHandoff|outlineRevisionProposal|parallelLineText|playerFacingText" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not connect `TurnNarration` or `narration_generator` to `runRpgTurn`.
- Did not modify the existing `narration` / `RpgTurnResult` main-flow contract.
- Did not modify wiki writer/apply behavior.
- Did not modify UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category.
- Did not enter LLM 5 第 3 阶段 Orchestrator 接入 + Turn Record Handoff.
- Did not enter Runtime Update Proposal / LLM 6 redesign.
- Did not auto-write wiki or auto-apply pending updates.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Schema Guidance Stage

### Stage

RPG Runtime LLM 5 / Narration Generator 三阶段拆分第 1 阶段：Schema Guidance，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` LLM 5 checklist 第 1 点。

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Documented LLM 5 / Narration Generator schema guidance for `TurnNarration`, `playerFacingText`, `parallelLineText`, `tensionBrief`, `NarrationDisplayPolicy`, `NarrationMeta`, enhanced `RpgActionOption`, `NarrationGeneratorInput`, `styleBundle`, `forbiddenForNarration`, `playerKnowledgeBoundary`, and pacing compliance.
- Clarified that `provisionalOutlinePatch.narrationHandoff` has priority over ordinary `OutlineAwareNarrationBrief` when present, but cannot rewrite `PostActionWorkingState`, `WorldTickResult`, or `ActionResolution`.
- Clarified that `outlineRevisionProposal` is not Narration fact material and must not be written as happened facts, player knowledge, narration prose, or ordinary runtime update.
- Clarified that `parallelLineText` may be shown to the real user but does not grant PC knowledge and must not automatically update `wiki/player/known_information.md`.
- Clarified that `tensionBrief` is runtime/review handoff rather than ordinary event fact material, and that style guidance only changes expression, not world facts or plot facts.
- Added code-readable schema guidance constants and getters for narration output, tension brief fields, narration meta fields, enhanced action option runtime fields, knowledge boundary policy, and style handoff policy.
- Added focused schema tests for the new guidance, knowledge/style boundaries, provisional handoff priority, outline proposal exclusion, unchanged `RPG_SCHEMA_SLOTS`, and no ordinary `wiki/runtime` category.
- Marked only LLM 5 checklist item 1 `[已完成]`; checklist items 2 and 3 remain `[待实现]`.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 test file, 28 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "RPG_NARRATION_OUTPUT_SCHEMA|RPG_TENSION_BRIEF_FIELDS|RPG_NARRATION_META_FIELDS|RPG_ACTION_OPTION_RUNTIME_FIELDS|RPG_NARRATION_KNOWLEDGE_BOUNDARY_POLICY|RPG_NARRATION_STYLE_HANDOFF_POLICY|TurnNarration|NarrationMeta|TensionBrief" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed.

### Scope notes

- Did not modify `RpgTurnResult`.
- Did not add runtime Narration types, interaction spec, parser / validator, adapters, registry exports, or prompt contract.
- Did not connect Narration Generator to `runRpgTurn`.
- Did not modify wiki writer/apply behavior.
- Did not modify UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category.
- Did not enter Runtime Update Proposal / LLM 6 redesign.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 5 Narration Generator Three-stage Plan Note

### Stage

Documentation-only planning note for **RPG Runtime LLM 5 / Narration Generator 三阶段拆分**.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added an explicit three-stage execution plan for LLM 5 / Narration Generator:
  1. Schema Guidance stage.
  2. Runtime Types + Interaction Contract stage.
  3. Orchestrator 接入 + Turn Record Handoff stage.
- Added a progress checklist with all three LLM 5 stages marked `[待实现]`.
- Documented that Stage 1 should only update `docs/RPG_WIKI_SCHEMA.md`, `src/lib/rpg-wiki-schema.ts`, and focused schema tests.
- Documented that Stage 2 should add runtime-only types, Narration Generator interaction contract, parser / validator, fixture adapter, LLM adapter, registry / exports, and focused tests without connecting `runRpgTurn`.
- Documented that Stage 3 should connect `TurnNarration` to `runRpgTurn`, pass `provisionalOutlinePatch.narrationHandoff` as hard constraint, and save runtime/review handoff fields without entering Runtime Update Proposal redesign.

### Scope notes

- Did not modify source code.
- Did not implement schema guidance yet.
- Did not modify `RpgTurnResult`, Narration Generator interaction, orchestrator behavior, runtime journal behavior, wiki writer/apply, or UI.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Orchestrator Conditional Call Stage

### Stage

RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 3 阶段：Orchestrator 条件调用阶段，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` checklist 第 5 点。

### Changed files

- Added `src/lib/rpg-runtime/story-outline-regenerator-handoff.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-turn-orchestrator.test.ts`
- Updated `src/lib/rpg-runtime-controller.test.ts`
- Updated `src/lib/rpg-turn-model.test.ts`
- Updated `src/lib/rpg-story-outline-regenerator.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`

### Summary

- Added a deterministic Story Outline Regenerator input builder that derives `confirmedFacts` and `forbiddenReveals` only from current turn runtime refs, hard constraints, outline/reveal policy refs, visibility boundaries, and known refs already present in the LLM 4 handoff.
- Added optional `storyOutlineRegeneratorAdapter` to `runRpgTurn` / runtime controller inputs.
- Wired conditional execution only for `impactLevel: "major_rewrite_required"` + `requiresRegeneration: true` + existing `regenerationRequest` + existing adapter.
- Routed regenerator output through `storyOutlineRegeneratorInteractionSpec.buildPrompt(...)`, adapter call, and spec parser/validator before Narration.
- Passed only `provisionalOutlinePatch.narrationHandoff` to Narration as `provisionalNarrationHandoff` hard constraints.
- Saved `provisionalOutlinePatch`, `outlineRevisionProposal`, and `regenerationSafetyReport` to turn results, turn records, and `.llm-wiki/runtime` journal entries.
- Kept `outlineRevisionProposal` out of ordinary `ProposedWikiUpdate`, `runtimeWikiUpdate`, `proposedUpdates`, and `pendingUpdates`.
- Updated warnings so successful regenerator calls no longer emit the old "not triggered in this stage" warning, while missing adapter/request cases remain audit-visible.

### Validation

- `npx.cmd vitest run src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-turn-model.test.ts` passed: 7 test files, 130 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category.
- Did not modify wiki writer/apply behavior.
- Did not modify UI.
- Did not enter Narration Generator three-line schema redesign.
- Did not enter Runtime Update Proposal redesign.
- Did not auto-accept, apply, or write `outlineRevisionProposal` to `wiki/outlines/main.md`.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Runtime Contract Stage

### Stage

RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 2 阶段：Runtime 类型 + Interaction Contract 阶段，只完成 `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md` checklist 第 3、4 点。

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/story-outline-regenerator-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/story-outline-regenerator-validation.ts`
- Added `src/lib/rpg-interactions/runtime/story-outline-regenerator-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-story-outline-regenerator-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-story-outline-regenerator.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`

### Summary

- Added runtime/review handoff types for `StoryOutlineRegeneratorInput`, `ProvisionalOutlinePatch`, `ProvisionalNarrationHandoff`, `OutlineRevisionProposal`, and `RegenerationSafetyReport`.
- Kept `ProvisionalOutlinePatch` same-turn only, non-persistent, not accepted wiki facts, and not a `wiki/outlines/main.md` modification.
- Kept `ProvisionalNarrationHandoff` as a hard constraint for later Step 15 Narration only; this stage does not modify Narration.
- Kept `OutlineRevisionProposal` as independent review/pending with `reviewItemKind: "outlineRevision"`; it is not ordinary `ProposedWikiUpdate`, not `runtimeWikiUpdate`, and cannot auto-write `wiki/outlines/main.md`.
- Added `outline_regeneration` interaction spec, prompt builder, parser, deterministic validator, fixture adapter, and LLM streaming adapter.
- Registered and exported `outline_regeneration` as implemented under `runtime_story_outline_regenerator`, with notes that it is not connected to `runRpgTurn` in this stage.
- Added focused tests for type construction, prompt boundaries, bare/fenced parser behavior, legal output acceptance, pollution rejection, ref/path boundary checks, adapter validation, registry exposure, unchanged `RPG_SCHEMA_SLOTS`, no ordinary `wiki/runtime` category, and no `runRpgTurn` integration.

### Validation

- `npx.cmd vitest run src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 90 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "StoryOutlineRegeneratorInput|ProvisionalOutlinePatch|ProvisionalNarrationHandoff|OutlineRevisionProposal|RegenerationSafetyReport" src/lib docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md docs/CURRENT_STATE.md docs/IMPLEMENTATION_LOG.md` passed and found the five runtime/review contract names.

### Scope notes

- Did not connect the orchestrator conditional call.
- Did not modify `runRpgTurn` main flow.
- Did not modify Narration Generator, Runtime Update Proposal, wiki writer/apply behavior, or UI.
- Did not generate real runtime `provisionalOutlinePatch` or `outlineRevisionProposal`.
- Did not modify `RPG_SCHEMA_SLOTS`.
- Did not add an ordinary `wiki/runtime` category.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Schema Stage

### Stage

RPG Runtime Step 14.5 / Story Outline Regenerator 三阶段拆分第 1 阶段：Schema 阶段，只完成 line1250 的第 1、2 点。

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the document-level Step 14.5 schema boundary for `ProvisionalOutlinePatch`, `OutlineRevisionProposal`, `OutlineRevisionReviewPolicy`, and `RegenerationSafetyReport`.
- Defined `provisionalOutlinePatch` as same-turn-only, non-persistent, not a `wiki/outlines/main.md` edit, and a hard `narrationHandoff` constraint for Step 15 Narration.
- Defined `outlineRevisionProposal` as an independent review/pending item, not ordinary `ProposedWikiUpdate`, not ordinary runtime update, and never an automatic write to `wiki/outlines/main.md`.
- Reconfirmed that `wiki/outlines/main.md` remains `manual_or_review_only`.
- Reconfirmed that `wiki/outlines/progress.md` may record major divergence, invalidated beats, provisional patch adoption, and pending proposal refs, but must not turn future outline revisions into facts.
- Reconfirmed that `wiki/plot-arcs/runtime` may record post-divergence pressure, conflict, and branch state, but cannot replace `outlineRevisionProposal`.
- Added code-readable schema guidance and getters in `src/lib/rpg-wiki-schema.ts`:
  - `RPG_PROVISIONAL_OUTLINE_PATCH_SCHEMA`
  - `RPG_OUTLINE_REVISION_PROPOSAL_SCHEMA`
  - `RPG_OUTLINE_REVISION_REVIEW_POLICY`
  - `RPG_REGENERATION_SAFETY_FIELDS`
  - aggregate Story Outline Regenerator schema guidance getter.
- Added focused schema tests for machine readability, core fields, non-persistence, independent review/pending boundaries, and unchanged category/slot shape.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 test file, 27 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "ProvisionalOutlinePatch|OutlineRevisionProposal|OutlineRevisionReviewPolicy|RegenerationSafetyReport" docs/RPG_WIKI_SCHEMA.md src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts` passed and found all four schema concept names.

### Scope notes

- Did not implement Story Outline Regenerator runtime types.
- Did not implement interaction spec, parser, validator, adapters, or LLM adapter.
- Did not connect the orchestrator conditional call.
- Did not generate `provisionalOutlinePatch` or `outlineRevisionProposal` in any real flow.
- Did not modify Narration Generator, Runtime Update Proposal, wiki writer/apply behavior, or UI.
- Did not add ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- Did not add legacy/default compatibility, fallback, or old-path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - Story Outline Regenerator Implementation Order Note

### Stage

Documentation-only clarification for the conditional LLM +1 / Step 14.5 implementation order.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a task-progress checklist under the Story Outline Regenerator schema section.
- Recorded the small-step order for the next implementation stage: schema docs first, then code-readable schema guidance, then runtime types, then Story Outline Regenerator interaction spec / parser / validator / adapters / focused tests, and only after that orchestrator conditional integration.
- Clarified that the conditional call should require LLM 4 to output both `impactLevel: "major_rewrite_required"` and `requiresRegeneration: true`.
- Reiterated that `provisionalOutlinePatch` is only a same-turn hard constraint for Narration, while `outlineRevisionProposal` belongs to independent review/pending and must not be mixed into ordinary runtime updates or automatically written to `outlines/main.md`.

### Validation

- Documentation-only change; no source test suite was required.

### Scope notes

- Did not implement Story Outline Regenerator.
- Did not modify `docs/RPG_WIKI_SCHEMA.md` or `src/lib/rpg-wiki-schema.ts`.
- Did not add runtime types, interaction specs, parsers, validators, adapters, tests, or orchestrator integration.
- Did not generate `provisionalOutlinePatch` or `outlineRevisionProposal`.
- Did not modify `RPG_SCHEMA_SLOTS`, wiki writer / apply behavior, UI, or ordinary `wiki/runtime` category behavior.
- No `git commit` or `git push` was performed.

## 2026-06-11 - LLM 4 Outline-aware Brief Handoff Cleanup

### Stage

Cleanup pass after LLM 4 / 第 14 步第二小阶段：Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff. This pass intentionally did not enter Story Outline Regenerator / Step 14.5.

### Changed files

- Updated `src/lib/rpg-runtime/outline-brief-handoff.ts`
- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/llm4-handoff-boundary.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Updated `src/lib/rpg-runtime-test-fixtures.ts`
- Updated `src/lib/rpg-turn-model.test.ts`
- Updated `src/lib/rpg-runtime-persistence.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `src/lib/rpg-state-extractor.test.ts`
- Updated `src/lib/rpg-write-policy.test.ts`
- Updated `src/lib/rpg-import/runtime-update-apply.test.ts`
- Updated `src/components/rpg/rpg-runtime-panel.test.tsx`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Reviewed the LLM 4 handoff path classification helpers in `outline-brief-handoff.ts`.
- Decided not to reuse Recall handoff helpers or schema guidance for outline / plot-arc / hard-constraint / reveal-forbidden classification because those existing helpers serve different boundaries: Recall validates safe deterministic reads and section allowlists, while schema guidance is descriptive. The LLM 4 handoff still needs local classification of already-recalled material into brief compiler inputs.
- Added a short implementation comment documenting that choice instead of introducing a broad shared util.
- Added `sampleTurnRecordRuntimeParts()` as a focused fixture helper for complete turn-record runtime parts: `actionResolution`, `worldTickResult`, `visibleSelection`, `postActionWorkingState`, `recallSelection`, `recalledMaterials`, `outlineAwareNarrationBrief`, `outlineImpactReport`, and optional `regenerationRequest`.
- Reused that fixture in turn-model, persistence, interaction, state-extractor, write-policy, runtime-update-apply, and panel tests where the repeated setup was incidental rather than the subject of the test.
- Added `llm4-handoff-boundary.ts` for small shared prompt boundary strings around LLM 4 handoff fields, audit/control semantics, and Story Outline Regenerator non-triggering.
- Reused those constants in Narration, Runtime Update Proposal, and Outline Brief prompts without changing parser, validator, interaction spec shape, target rules, apply flow, or pending flow.
- Clarified `RegenerationRequest` with a type comment and prompt wording as audit/control handoff only. It remains a record of why a later Story Outline Regenerator might be needed, not `outlineRevisionProposal`, not `provisionalOutlinePatch`, not a wiki write, and not permission to revise `wiki/outlines/main.md`.

### Validation

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts` passed: 6 test files, 101 tests.
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` passed: 1 test file, 15 tests.
- `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts` passed: 3 test files, 27 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement or trigger Story Outline Regenerator / Step 14.5.
- Did not call any outline regeneration adapter.
- Did not generate `provisionalOutlinePatch`.
- Did not generate `outlineRevisionProposal`.
- Did not perform Narration Generator three-line redesign.
- Did not refactor Runtime Update Proposal parsing, target rules, apply, or pending flow.
- Did not modify wiki writer / apply behavior.
- Did not add UI display controls or expose new runtime panel controls.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- Did not add legacy `default` compatibility, fallback, or path preservation.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Outline-aware Brief Compiler Orchestrator + Narration Brief Handoff

### Stage

LLM 4 / 第 14 步第二小阶段：Outline-aware Brief Compiler Orchestrator 接入 + Narration Brief Handoff, without Story Outline Regenerator execution.

### Changed files

- Added `src/lib/rpg-runtime/outline-brief-handoff.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-runtime-test-fixtures.ts`
- Updated focused runtime, interaction, panel, persistence, controller, turn-model, state-extractor, write-policy, runtime-update-apply, and outline-brief tests for the new handoff contract.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Connected the existing `outline_brief` interaction into `runRpgTurn` after deterministic `recalledMaterials` handoff and before Narration.
- Current turn flow is now `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> outlineBriefCompiler -> narration -> turnRecord`.
- Added `buildOutlineBriefCompilerInputFromTurnState()` as a thin local handoff builder. It consumes existing turn structures and deterministic recall output only; it does not read additional wiki files and does not let LLM 4 directly read files.
- First-version input derivation now creates `outlineSlices` from recalled `wiki/outlines/*` material, `plotArcTensionFuel` from recalled `wiki/plot-arcs/*` / `wiki/plot-arcs/runtime/*` material, hard constraints from recalled rules / forbidden style / player preferences / reveal-like outline sections, visibility boundaries, runtime refs, and known references.
- `RunRpgTurnInput` / `RunRpgRuntimeTurnFlowInput` now accept injectable `outlineBriefCompilerAdapter`; the runtime panel creates and passes `createLlmRpgOutlineBriefAdapter` without UI display changes.
- `RpgTurnRecord` now stores `outlineAwareNarrationBrief`, `outlineImpactReport`, and optional `regenerationRequest`; references include the filtered brief / regeneration source refs only as trace references, not accepted facts.
- Runtime journal entries now store the same LLM 4 handoff under `.llm-wiki/runtime/turn-records.jsonl`.
- When `outlineImpactReport.requiresRegeneration === true`, this stage only adds a warning / audit handoff and saves the optional `regenerationRequest`; it does not call any regeneration adapter and does not produce `provisionalOutlinePatch` or `outlineRevisionProposal`.
- Narration prompt now receives the filtered `OutlineAwareNarrationBrief` and audit/control `outlineImpactReport` / `regenerationRequest`. It states that Narration must obey the filtered brief, must not directly read complete `outlines/main.md`, must not leak GM-only / hidden / parallelLine-only / `user_visible_pc_unknown` material into PC knowledge, must keep `parallelLineBrief.grantsPcKnowledge: false`, and must treat `tensionBriefInput` as tension input rather than player prose or confirmed event history.
- Runtime Update Proposal prompt now states that `outlineAwareNarrationBrief`, `outlineImpactReport`, and `regenerationRequest` are journal/audit/control handoff only, not accepted wiki facts, not ordinary wiki update source material, and that `regenerationRequest` is not `outlineRevisionProposal`.
- `runtime_update_apply` turn-record resolution now preserves LLM 4 handoff fields.

### Validation

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 7 test files, 127 tests.
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` passed: 1 test file, 15 tests.
- `npx.cmd vitest run src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts` passed: 3 test files, 27 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement or trigger Story Outline Regenerator / Step 14.5.
- Did not call any outline regeneration adapter.
- Did not generate `provisionalOutlinePatch`.
- Did not generate `outlineRevisionProposal`.
- Did not perform Narration Generator three-line redesign.
- Did not refactor Runtime Update Proposal parsing, target rules, apply, or pending flow.
- Did not modify wiki writer / apply behavior.
- Did not add UI display controls or expose new runtime panel controls.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- Did not treat `recalledMaterials`, `outlineAwareNarrationBrief`, `outlineImpactReport`, or `regenerationRequest` as accepted wiki facts.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Outline-aware Brief Compiler Contract + Interaction

### Stage

LLM 4 / 第 14 步第一小阶段：Outline-aware Brief Compiler Contract + Interaction + Validator + Tests, without orchestrator integration or Story Outline Regenerator execution.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/outline-brief-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/outline-brief-validation.ts`
- Added `src/lib/rpg-interactions/runtime/outline-brief-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-outline-brief-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-outline-brief.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added minimal schema guidance for LLM 4: stable outline beat / reveal / branch condition refs, dependency / invalidation / line target / reveal policy metadata, the `none` / `minor` / `branch` / `major_rewrite_required` impact rubric, line-specific brief boundaries, and `tensionLine` / plot-arc fuel semantics.
- Added code-readable guidance and getters in `src/lib/rpg-wiki-schema.ts` for Outline-aware Brief Compiler guidance, impact rubric fields, brief boundary fields, stable ref fields, and tension fuel fields.
- Added runtime-only type contracts: `OutlineBriefCompilerInput`, `OutlineSlice`, `OutlineAwareNarrationBrief`, `OutlineImpactReport`, `RegenerationRequest`, and supporting stable ref, reveal policy, pacing directive, tension update candidate, forbidden narration boundary, visibility boundary, and hard constraint types.
- Added the `outline_brief` interaction spec with stage `runtime_outline_brief_compiler`.
- The prompt defines LLM 4 as Outline-aware Brief Compiler + Outline Impact Detector and states that `recalledMaterials` are filtered deterministic handoff, not complete outline authority or accepted wiki facts.
- The prompt allows only `outlineAwareNarrationBrief`, `outlineImpactReport`, optional `regenerationRequest`, and `warnings`; it forbids player prose, `nextActionOptions`, wiki writes, runtime update proposal output, outline revision/proposal output, provisional patches, Story Outline Regenerator execution, direct file reads, and mutation of upstream runtime objects.
- Added parser support for bare JSON and fenced JSON.
- Added deterministic validator checks for required top-level structure, required brief/report fields, legal `impactLevel`, regeneration consistency, forbidden pollution fields, player-facing knowledge leaks, `parallelLineBrief.grantsPcKnowledge: false`, and references limited to input recalled-material paths / sectionIds or known runtime refs.
- Added fixture and LLM adapters. The LLM adapter streams model output, then parses and validates through the interaction spec.
- Registered and exported the new runtime interaction without changing existing interaction behavior.
- Added focused tests covering schema guidance, prompt boundaries, filtered handoff language, parse/validate success paths, invalid impact/regeneration/pollution/knowledge/ref cases, adapters, registry exposure, and non-integration with `runRpgTurn`, Story Outline Regenerator, writer/apply/UI, ordinary `wiki/runtime`, and `RPG_SCHEMA_SLOTS`.

### Validation

- `npx.cmd vitest run src/lib/rpg-outline-brief.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 92 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not connect Outline-aware Brief Compiler / LLM 4 to `runRpgTurn`.
- Did not call LLM 4 in the real turn flow.
- Did not implement or trigger Story Outline Regenerator / Step 14.5.
- Did not generate `provisionalOutlinePatch`.
- Did not generate `outlineRevisionProposal`.
- Did not perform Narration Generator three-line redesign.
- Did not refactor Runtime Update Proposal.
- Did not modify wiki writer / apply behavior.
- Did not modify UI.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- Did not treat `recalledMaterials` or outline brief output as accepted wiki facts.
- No `git commit` or `git push` was performed.

## 2026-06-11 - RPG Runtime Recall Selector Orchestrator + Deterministic Handoff

### Stage

Recall Selector Orchestrator 接入 + Deterministic File-read Allowlist, continuing the interrupted partial implementation and completing the stage boundary without entering LLM 4.

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-runtime/recall-selector-handoff.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-runtime-test-fixtures.ts`
- Added `src/lib/rpg-recall-selector-handoff.test.ts`
- Updated focused runtime, interaction, panel, state-extractor, write-policy, persistence, controller, turn-model, orchestrator, and import tests for the new recall handoff contract.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Connected the existing `recall_selector` interaction into `runRpgTurn` after `postActionWorkingState` and before Narration.
- Current turn flow is now `preview -> actionResolver -> worldTick -> visibleSelection -> postActionWorkingState -> recallSelector -> deterministic recalledMaterials handoff -> narration -> turnRecord`.
- Added `buildRecallSelectorInputFromTurnState()` and `buildRetrievalIndexFromTurnState()` to produce a lightweight retrieval index from schema slots, compact brief references, `PostActionWorkingState.references`, Action Resolution references, World Tick references, visible-selection / working-state affected paths, and runtime overlay paths.
- The retrieval index does not include full file bodies. Where section metadata is incomplete, it uses stable synthetic `sectionId` values and records warnings for the first-version limitation.
- Added deterministic local recall reading through `createRecallSelectorHandoff()` / `readRecalledMaterials()`. The reader only reads `RecallSelection.selectedItems`, verifies selected paths are in the retrieval index, verifies selected `sectionId` membership, honors whole-path and section-level exclusions, and enforces safe project-root `wiki/` path boundaries.
- The reader rejects traversal, absolute paths, hidden paths, and ordinary `wiki/runtime` paths; first-version section slicing degrades to controlled excerpts with warnings; `wiki/outlines/main.md` full-page reads are capped so full outline text is not handed to Narration.
- Added `RecalledMaterial`, `RecalledMaterialSection`, and `RecallSelectorHandoff` as minimal runtime handoff types. `RecallSelection` is the allowlist plan; `recalledMaterials` is the deterministic local read result.
- `RpgTurnRecord` and runtime turn journal entries now persist `recallSelection` and `recalledMaterials` under `.llm-wiki/runtime/`.
- Narration prompt received only minimal boundary text for recall handoff: filtered material is not full outline authority, GM-only / parallelLine / user-visible-PC-unknown material must not become PC knowledge, recall handoff is not wiki writes, and this stage does not perform Outline-aware Brief / Outline Impact / Outline Regeneration work.
- Runtime Update Proposal prompt and `runtime_update_apply` turn-record handling preserve the boundary that unreviewed `RecallSelection` / `recalledMaterials` are journal/audit/filter handoff, not accepted wiki fact sources.
- Fixed interrupted-stage gaps: reader type imports now come from code-readable schema exports, `.at()` was removed for current TS target compatibility, section-level exclusions no longer skip the whole path, synthetic section warnings are de-duplicated per path, and older test fixtures now create complete turn records with recall handoff fields.

### Validation

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 8 test files, 132 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Outline-aware Brief Compiler / LLM 4.
- Did not implement Story Outline Regenerator.
- Did not implement Narration Generator three-line redesign.
- Did not refactor Runtime Update Proposal.
- Did not modify wiki writer / apply behavior.
- Did not modify UI.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- Recall Selector LLM still does not read files; only the deterministic local reader reads allowlisted files.
- `recalledMaterials` are not treated as accepted wiki facts or direct wiki write sources.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Recall Selector Contract + Interaction

### Stage

Recall Selector Contract + Interaction + Validator + Tests for LLM 3 / Step 13, without orchestrator or file-read allowlist integration.

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/recall-selector-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/recall-selector-validation.ts`
- Added `src/lib/rpg-interactions/runtime/recall-selector-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-recall-selector-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-recall-selector.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added Recall Selector runtime contracts: `RecallSelectorInput`, `RetrievalIndexEntry`, `RecallableSection`, `RecallSelection`, `RecallSelectedItem`, `RecallExclusion`, `RecallBudget`, and `RecallPolicy`.
- `RecallSelectorInput` consumes the completed `PostActionWorkingState` and may carry `actionResolution`, `worldTickResult`, `visibleSelection`, `pacingState`, `gapState`, `retrievalIndex`, `recallBudget`, and `recallPolicy`.
- Added `recallSelectorInteractionSpec`, `buildRecallSelectorPrompt()`, and `parseRpgRecallSelectionOutput()` for strict `RecallSelection` JSON.
- The parser accepts bare JSON and fenced JSON, then routes through `validateRecallSelection()` with the input retrieval index.
- The prompt locks the LLM 3 boundary: recall is based on post-action `PostActionWorkingState`, not old `current-scene` coarse recall; output is only a recall plan / allowlist; no file reading, narration, wiki write, update proposal, LLM 4 / Outline-aware Brief, Outline Impact, or outline regeneration output is allowed.
- The prompt requires selected items to mark `lineTarget`, visibility / knowledge boundary, priority, reason, and `expectedUse`; selected sections must reference stable `sectionId` values from `RetrievalIndexEntry.availableSections`.
- Added deterministic validation for required fields, retrieval-index path membership, sectionId membership, legal `lineTarget`, legal `readMode`, legal priority, visibility and knowledge scopes, valid exclusions, and the rule that `parallelLine` / `user_visible_pc_unknown` material must not be marked as PC knowledge.
- The validator recursively rejects pollution fields including narration, player-facing text, parallel-line text, next action options, wiki writes, update proposals, pending updates, recalled full text, outline brief, outline impact report, outline revision/proposal, provisional outline patch, and regeneration request.
- Added fixture and LLM Recall Selector adapters. The LLM adapter streams model output and calls the parser / validator; neither adapter reads wiki files.
- Registered `recall_selector` as an implemented RPG interaction kind with stage `runtime_recall_selector`, and exported the interaction, validator, and adapters.
- Added focused tests covering prompt boundaries, bare/fenced parsing, valid selection acceptance, invalid path/section/read mode/line target/priority rejection, missing stable sectionId rejection, PC knowledge leakage rejection, pollution rejection, adapter behavior, registry exposure, `runRpgTurn` non-integration, unchanged `RPG_SCHEMA_SLOTS`, and no ordinary `wiki/runtime` category.

### Validation

- `npx.cmd vitest run src/lib/rpg-recall-selector.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 3 test files, 90 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not connect Recall Selector to `runRpgTurn`.
- Did not implement deterministic file-read allowlist.
- Did not implement recalledMaterials file reading.
- Did not implement Outline-aware Brief Compiler / LLM 4.
- Did not implement Story Outline Regenerator.
- Did not implement Narration Generator three-line redesign.
- Did not implement Runtime Update Proposal redesign.
- Did not modify wiki writer / apply behavior.
- Did not modify UI.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Orchestrator + Working State Handoff

### Stage

World Tick runtime turn-flow integration and local Step 11-12 handoff, without Recall Selector.

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-runtime/world-tick-working-state.ts`
- Updated `src/lib/rpg-runtime/index.ts`
- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Updated `src/lib/rpg-runtime-test-fixtures.ts`
- Added `src/lib/rpg-world-tick-working-state.test.ts`
- Updated focused runtime, interaction, panel, state-extractor, write-policy, and import tests for the new turn-record contract.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Connected `world_tick` into `runRpgTurn` after Action Resolver and before Narration.
- Added `buildWorldTickInputFromBrief()` so World Tick consumes the validated `ActionResolution`, the same `ActionResolution.playerActionDelta` object, and the resolved `timeDelta`, without adding Recall Selector or new file reads.
- Added `WorldTickVisibleSelection`, selected visible delta, parallel lens, tension signal, and `PostActionWorkingState` types.
- Added local Step 11-12 helpers: `selectWorldTickVisibleContent()` and `buildPostActionWorkingState()`.
- Visible selection keeps PC-visible / PC-inferred action and world deltas as current-scene visible candidates, keeps `user_visible_pc_unknown` parallel-line deltas as parallel lens candidates with `grantsPcKnowledge: false`, and carries tension-line / pacing / gap candidates separately.
- Working state merges submitted action, action resolution, World Tick result, visible selection, time state, campaign delta, pacing state, gap state, runtime delta refs, references, and warnings.
- `RpgTurnRecord` now stores `worldTickResult`, `visibleSelection`, and `postActionWorkingState`, and its cleaned references also include World Tick / working-state reference paths.
- Runtime turn journal entries now persist `worldTickResult`, `visibleSelection`, and `postActionWorkingState` under `.llm-wiki/runtime/turn-records.jsonl`.
- Narration prompt now consumes the structured handoff and states that narration must follow `PostActionWorkingState`, must not alter `WorldTickResult`, must not turn parallel-line material into PC knowledge, must not invent new World Tick events, and must not write wiki.
- Runtime Update Proposal prompt now states that World Tick / visible selection / working state are journal/audit data and must not be directly converted into wiki writes; it also keeps the PC knowledge boundary for `parallelLine` / `user_visible_pc_unknown`.
- Runtime controller and RPG runtime panel now accept and pass `worldTickAdapter`; panel wiring creates the LLM World Tick adapter without changing UI.

### Validation

- `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-persistence.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 9 test files, 124 tests.
- `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx` passed: 1 test file, 15 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement Recall Selector / LLM 3.
- Did not implement Outline-aware Brief Compiler / LLM 4.
- Did not implement Story Outline Regenerator.
- Did not implement Narration Generator three-line redesign.
- Did not implement Runtime Update Proposal redesign.
- Did not modify wiki writer / apply behavior.
- Did not add UI display changes.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Interaction + Validator Contract

### Stage

World Tick Schema + Contract items 3 and 4 for the RPG Runtime 19-step interaction flow.

### Changed files

- Added `src/lib/rpg-interactions/runtime/world-tick-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/world-tick-validation.ts`
- Added `src/lib/rpg-interactions/runtime/world-tick-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-world-tick-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-world-tick-interaction.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added `worldTickInteractionSpec`, `buildWorldTickPrompt()`, and `parseRpgWorldTickOutput()` for strict `WorldTickResult` JSON.
- The parser accepts bare JSON and fenced JSON, then routes through `validateWorldTickResult()`.
- The prompt locks the World Tick boundary: consume `ActionResolution.playerActionDelta` as the canonical player-action-only delta, do not reinterpret or re-adjudicate the player action, do not derive canonical player facts from `directResults`, and advance only the resolved `timeDelta` interval.
- The prompt explicitly forbids wiki writes, player-facing narration, `nextActionOptions`, Recall Selector output, and outline revision/regeneration authority.
- Added `validateWorldTickResult()` with structural and boundary checks for required top-level fields, three-line `worldDeltas`, `clockUpdates`, `settledOngoingEvents`, `informationBroadcast`, `reactionQueue`, `pacingUpdate`, `gapState`, `runtimeDeltaRefs`, `references`, and `warnings`.
- The validator checks all delta-like objects for `narrativeLine`, visibility / knowledge metadata, `happenedStatus`, `affectedPaths`, and `runtimeDeltaRefs`.
- The validator recursively rejects output pollution fields for wiki writes, narration, next action options, outline revision/regeneration, and Recall Selector artifacts.
- Added a fixture World Tick adapter and an LLM adapter that uses `streamChat`, collects model output, and parses it through the World Tick interaction parser.
- Registered `world_tick` as an implemented RPG interaction kind with stage `runtime_world_tick`, and exported the World Tick runtime interaction, adapters, and validator.
- Added focused tests covering prompt boundaries, bare/fenced JSON parsing, missing required fields, missing delta metadata, pollution rejection, fixture adapter, LLM adapter streaming/parse behavior, registry exposure, canonical `playerActionDelta`, and the parallel-line display versus PC knowledge boundary.

### Validation

- `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 4 test files, 87 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not connect World Tick to `runRpgTurn`.
- Did not write turn records or runtime journal entries.
- Did not implement working-state merge, visible selection, Recall Selector, Outline-aware Brief Compiler, Narration three-line redesign, or Runtime Update Proposal redesign.
- Did not modify wiki writer / apply behavior or UI.
- Did not add an ordinary `wiki/runtime` category.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Schema + Types Contract 前半阶段

### Stage

World Tick Schema + Types Contract 前半阶段 for the RPG Runtime 19-step interaction flow.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-runtime/types.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Added `src/lib/rpg-world-tick-contract.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a World Tick semantic boundary section to `docs/RPG_WIKI_SCHEMA.md`.
- Documented clock/countdown, ongoing event, information broadcast, reaction queue, visibility meta, pacing state, and gap signal semantics.
- Clarified that World Tick consumes `ActionResolution.playerActionDelta` as the canonical player-action-only delta and must not re-adjudicate player success or derive canonical player facts from `directResults`.
- Clarified that World Tick advances only the resolved `timeDelta` interval and does not write wiki, generate player-facing narration, generate `nextActionOptions`, run Recall Selector, run Outline Brief, or trigger Outline Impact authority.
- Added code-readable World Tick guidance and getter functions in `src/lib/rpg-wiki-schema.ts` for visibility meta, clock update, ongoing event, information broadcast, reaction queue, pacing state, and gap signal fields.
- Added World Tick runtime type contracts in `src/lib/rpg-runtime/types.ts`, including `WorldTickInput`, `WorldTickResult`, `WorldTickVisibilityMeta`, `WorldTickClockUpdate`, `WorldTickSettledOngoingEvent`, `WorldTickInformationBroadcast`, `WorldTickReactionQueueEntry`, `WorldTickPacingUpdate`, and `WorldTickGapState`.
- `WorldTickInput` directly includes `actionResolution`, `playerActionDelta: ActionResolution["playerActionDelta"]`, and `timeDelta: ActionResolution["timeDelta"]`.
- Added a focused World Tick contract test that uses `satisfies` to lock representative input/result fixtures and checks visibility / knowledge / happenedStatus / affectedPaths / runtimeDeltaRefs metadata.
- Extended the schema test to verify the new getter functions and to confirm no ordinary `runtime` category was added.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts src/lib/rpg-action-resolver.test.ts` passed: 2 test files, 41 tests.
- `npx.cmd vitest run src/lib/rpg-world-tick-contract.test.ts` passed: 1 test file, 2 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement World Tick interaction, parser, validator, adapter, or prompt.
- Did not connect World Tick to `runRpgTurn` or any orchestrator path.
- Did not implement working-state merge, Recall Selector, Outline-aware Brief Compiler, Narration Generator changes, Runtime Update Proposal changes, wiki writer/apply behavior, or UI changes.
- Did not add `runtime` to ordinary `RPG_WIKI_SCHEMA` categories.
- Did not add or remove `RPG_SCHEMA_SLOTS`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Action Resolver Orchestrator Integration + Tests

### Stage

Orchestrator 接入小阶段 and 测试小阶段 for the RPG Runtime 19-step interaction flow.

### Changed files

- Updated `src/lib/rpg-runtime/turn-orchestrator.ts`
- Updated `src/lib/rpg-runtime/turn-model.ts`
- Updated `src/lib/rpg-runtime/runtime-controller.ts`
- Updated `src/lib/rpg-runtime/runtime-persistence.ts`
- Updated `src/lib/rpg-interactions/runtime/narration-interaction.ts`
- Updated `src/lib/rpg-interactions/runtime/runtime-update-interaction.ts`
- Updated `src/components/rpg/rpg-runtime-panel.tsx`
- Updated `src/lib/rpg-import/runtime-update-apply.ts`
- Added `src/lib/rpg-runtime-test-fixtures.ts`
- Updated focused tests for orchestrator, turn model, controller, persistence, interactions, panel, state extraction, write policy, and runtime update apply.
- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Connected Action Resolver to the existing runtime turn flow: `runRpgTurn` now performs preview, builds a minimal `ActionResolverInput` from the existing `CompactStoryBrief`, calls the injected `actionResolverAdapter`, then calls Narration Generator with the resulting `ActionResolution`.
- Kept the Action Resolver input deliberately small and local to preview / brief data; no new recall selector, file-read pass, outline compiler, or world tick flow was introduced.
- Added `ActionResolution` to `BuildRpgNarrationPromptInput` and to the narration prompt as an adjudication constraint.
- Strengthened narration prompt boundaries: do not rewrite `ActionResolution.eventDraft.status`, do not promote `attempted_not_confirmed` to confirmed happened narration, and only present resolver-approved direct results, costs, obstacles, uncertainty, feasibility, `timeDelta`, and `progressPotential`.
- Added `actionResolution` to `RpgTurnRecord` and runtime turn journal entries.
- Turn record references now include both narration references and `actionResolution.references[].path`, still normalized and filtered through the existing RPG reference cleaner.
- Kept Runtime Update Proposal as a first-version proposal boundary over `submittedAction + generatedNarrative + references`; the prompt now explicitly states that journal/audit `actionResolution` is not a confirmed factual source and that `attempted_not_confirmed` event drafts must not become confirmed events.
- Wired the runtime panel to create and pass the LLM Action Resolver adapter without changing UI.
- Updated `runtime_update_apply` turn-record validation / cloning for the new `RpgTurnRecord` contract.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-turn-model.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-persistence.test.ts` passed: 5 test files, 49 tests.
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-wiki-schema.test.ts` passed: 2 test files, 73 tests.
- Extra related validation passed: `npx.cmd vitest run src/components/rpg/rpg-runtime-panel.test.tsx src/lib/rpg-state-extractor.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-import/runtime-update-apply.test.ts` passed: 4 test files, 42 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not implement World Tick + Reaction.
- Did not implement Recall Selector.
- Did not implement Outline-aware Brief Compiler.
- Did not perform a large Narration Generator redesign.
- Did not perform a large Runtime Update Proposal redesign or structured writeback expansion.
- Did not change wiki writer / apply behavior beyond synchronizing tests and turn-record validation with existing runtime overlay boundaries.
- Did not change UI, project skeleton, or `RPG_SCHEMA_SLOTS`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Action Resolver Contract + Interaction

### Stage

Action Resolver Contract small stage and Action Resolver Interaction small stage for the RPG Runtime 19-step interaction flow.

### Changed files

- Updated `src/lib/rpg-runtime/types.ts`
- Added `src/lib/rpg-interactions/runtime/action-resolver-interaction.ts`
- Added `src/lib/rpg-interactions/runtime/action-resolver-validation.ts`
- Added `src/lib/rpg-interactions/runtime/action-resolver-adapter.ts`
- Added `src/lib/rpg-interactions/runtime/llm-action-resolver-adapter.ts`
- Updated `src/lib/rpg-interactions/runtime/index.ts`
- Updated `src/lib/rpg-interactions/interaction-spec.ts`
- Updated `src/lib/rpg-interactions/registry.ts`
- Added `src/lib/rpg-action-resolver.test.ts`
- Updated `src/lib/rpg-interactions.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added Action Resolver runtime contracts in `src/lib/rpg-runtime/types.ts`:
  `ActionResolverInput`, `PreActionSnapshot`, `ActionResolution`, `PlayerActionDelta`,
  parsed intent, event draft, feasibility result, costs, obstacles, direct results,
  `timeDelta`, `progressPotential`, references, warnings, and player-action-only runtime delta refs.
- Added `ACTION_RESOLVER_DEFAULT_EVENT_STATUS` with the value `attempted_not_confirmed`.
- Added an Action Resolver interaction spec and prompt that requires strict `ActionResolution` JSON and states the boundary that the player action is an attempt, not automatic success.
- Added parser support for bare JSON and fenced JSON, routed through deterministic validation.
- Added validator checks for required `timeDelta`, non-generic time handling, required `progressPotential`, legal `eventDraft.status`, unsafe `confirmed_happened`, separated feasibility / costs / obstacles / direct results, separated references / warnings, and forbidden wiki write, narration, World Tick, and Reaction output fields.
- Added fixture and LLM adapters that call the Action Resolver interaction and return structured `ActionResolution`.
- Registered `action_resolver` in the RPG interaction registry and runtime exports so later stages can discover it.
- Added focused tests covering contract fixtures, prompt/spec text, parser success, default event status, validator rejection paths, adapter behavior, and the unchanged RPG schema runtime boundary.

### Validation

- `npx.cmd vitest run src/lib/rpg-action-resolver.test.ts src/lib/rpg-interactions.test.ts` passed: 2 test files, 65 tests.
- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 test file, 24 tests.
- `npm.cmd run typecheck` passed.

### Scope notes

- Did not modify `runRpgTurn` or connect Action Resolver to the orchestrator.
- Did not modify the Narration Generator prompt, Runtime Update Proposal prompt, World Tick + Reaction, Recall Selector, Outline-aware Brief Compiler, runtime prompt wiring, wiki writer/apply logic, UI, or project skeleton.
- Did not add or remove `RPG_SCHEMA_SLOTS`; the count remains 17.
- Did not add a runtime ordinary wiki category to `RPG_WIKI_SCHEMA`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Schema Spine

### Stage

Schema Spine small stage for the RPG Runtime 19-step interaction flow.

### Changed files

- Updated `docs/RPG_WIKI_SCHEMA.md`
- Updated `src/lib/rpg-wiki-schema.ts`
- Updated `src/lib/rpg-wiki-schema.test.ts`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a Runtime Schema Spine / 运行时共享契约 section to `docs/RPG_WIKI_SCHEMA.md`.
- Clarified that `runtime/` is not an ordinary extractable wiki category and that per-turn intermediate products belong in turn records, runtime journals, or `.llm-wiki/runtime/` pending runtime metadata, not `wiki/runtime/`.
- Replaced the old ordinary runtime page recommendations with a non-wiki runtime boundary description.
- Defined the ordinary `wiki/` persistence boundary: accepted persistent facts, current snapshots, runtime overlays, and control-layer progress only after proposal / pending / review / apply.
- Recorded writeback boundaries for `events/`, `player/known_information.md`, `current-scene/scene_state.md`, `outlines/progress.md`, `rules/`, and recallable runtime-facing sections.
- Added code-readable shared runtime schema constants, types, and getters in `src/lib/rpg-wiki-schema.ts`, including `NarrativeLine`, `UsePurpose`, visibility and knowledge scopes, `HappenedStatus`, `RuntimeDeltaRef`, `RecallableSection`, `GapImpactCandidate`, `OutlineImpactLevel`, `ReviewItemKind`, persistence boundary guidance, and Action Resolver fixed slot semantics.
- Added tests confirming that `RPG_WIKI_SCHEMA` still does not expose a runtime category, and that the new shared enums, delta fields, recallable section fields, slot semantics, and `.llm-wiki/runtime/` boundary are machine-readable.

### Validation

- `npx.cmd vitest run src/lib/rpg-wiki-schema.test.ts` passed: 1 test file, 24 tests.
- `npm.cmd run typecheck` passed.
- `rg --encoding utf-8 "RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE|RPG_RECALLABLE_SECTION_FIELDS|RPG_ACTION_RESOLVER_SLOT_SEMANTICS|\\.llm-wiki/runtime" src/lib/rpg-wiki-schema.ts src/lib/rpg-wiki-schema.test.ts docs/RPG_WIKI_SCHEMA.md` returned the expected new constant, test, and documentation references.
- `rg --encoding utf-8 "# \`runtime/\`|runtime/context_pack|runtime/turn_log|runtime/unresolved_threads" docs/RPG_WIKI_SCHEMA.md` returned no matches, confirming the old runtime wiki-page recommendations were removed rather than left as ordinary recommended directories.

### Scope notes

- Did not implement Action Resolver interaction, parser, adapter, prompt, orchestrator integration, World Tick, runtime prompt changes, new LLM calls, or UI changes.
- Did not add `runtime` to `RPG_CATEGORIES` or `RPG_WIKI_SCHEMA`.
- Did not change `RPG_SCHEMA_SLOTS` count or add `wiki/outlines/tension-line.md`.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Recallable Section Semantics

### Stage

Documentation refinement for making future RPG Runtime schema changes retrieval-safe at section level.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a hard rule to the schema implementation strategy: every new runtime-facing wiki block intended for retrieval must define stable section semantics.
- Clarified that natural-language markdown headings are display headings or aliases only; machine retrieval must rely on stable `sectionId`, controlled `sectionRole`, read mode, and visibility metadata.
- Added a shared `RecallableSection` shape for `availableSections`, including `sectionId`, `sectionRole`, `heading`, `aliases`, `lineTargets`, visibility / temporal / authority metadata, `readModes`, and `summaryPolicy`.
- Updated the Recall Selector schema plan so `RetrievalIndexEntry.availableSections` is `RecallableSection[]`.
- Clarified that `RecallSelection.selectedItems.sections`, `RecallExclusion.sections`, and `OutlineSlice.section` should reference stable section identity rather than raw markdown headings.
- Strengthened the LLM 3 implementation order so adding natural-language headings without section identity does not count as completed schema work.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the flow document mentions `RecallableSection`, `sectionId`, `sectionRole`, `RPG_RECALLABLE_SECTION_FIELDS`, and the rule that natural-language headings cannot be the only retrieval identity.

### Scope notes

- Did not modify Context Compiler, Recall Selector, or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Schema Implementation Strategy

### Stage

Documentation refinement for deciding how to implement the planned RPG Runtime schema changes.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a `Schema 实施策略：共享骨架 + 模块推进` section to the 19-step runtime flow document.
- Recorded the implementation decision: do not rewrite all 6 / 7 LLM runtime schemas up front, and do not let each module independently invent overlapping base fields.
- Defined the first shared schema spine as the minimum cross-module contract for narrative/use-purpose lines, visibility and knowledge scopes, happened status, runtime delta refs, time / pacing / clock basics, gap / outline impact boundaries, and the `wiki/` versus `.llm-wiki/runtime/` persistence boundary.
- Identified the lingering document conflict where old `docs/RPG_WIKI_SCHEMA.md` still describes ordinary `runtime/` wiki pages, while the new runtime flow treats per-turn intermediate products as turn record / journal / `.llm-wiki/runtime` artifacts.
- Recorded Action Resolver as the first module to implement after the shared spine because it is the fact entrance for later World Tick, Narration, and Runtime Update Proposal stages.
- Added the recommended five-step implementation sequence: Schema Spine, Action Resolver Contract, Action Resolver Interaction, Orchestrator integration, and focused tests.
- Documented the first integration target as `preview -> actionResolution -> narration -> turnRecord -> update proposal`, deferring World Tick until Action Resolver is stable.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the flow document mentions `Schema 实施策略：共享骨架 + 模块推进`, `Schema Spine 小阶段`, `Action Resolver Contract 小阶段`, and `preview -> actionResolution -> narration -> turnRecord -> update proposal`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime TensionLine Authority Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Elevated `tensionLine` from a per-turn tension observation into a long-running emotional / dramatic tension outline that is parallel to `playerVisibleLine` and `parallelLine`.
- Reframed `plot-arcs/` and `plot-arcs/runtime/` as a tension fuel / plot material layer that provides foreshadowing, unresolved conflicts, pressure sources, clock candidates, branch / reveal material, and possible tension moves for `tensionLine`.
- Proposed `wiki/outlines/tension-line.md` as the preferred persistent control slot for the tension outline, with `wiki/outlines/progress.md#Tension Line Progress` as a transitional first-version location if a new fixed slot is deferred.
- Updated shared schema guidance so future code-readable schema should include `RPG_TENSION_LINE_SCHEMA` and `RPG_PLOT_ARC_TENSION_FUEL_FIELDS`.
- Updated the LLM 2-6 schema plans and the 19-step flow language to carry `tensionLineOutline`, `plotArcTensionFuel`, and `tensionLineUpdateCandidate`.
- Clarified writeback boundaries: relationship facts go to `relationships/runtime`, plot pressure material goes to `plot-arcs/runtime`, and long-term tension direction goes to the tensionLine slot through proposal / pending / review / apply.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks confirmed the flow document mentions `wiki/outlines/tension-line.md`, `Tension Line Progress`, `RPG_TENSION_LINE_SCHEMA`, `RPG_PLOT_ARC_TENSION_FUEL_FIELDS`, `plotArcTensionFuel`, and `tensionLineUpdateCandidate`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Shared Schema Conflict Unification

### Stage

Documentation refinement for unifying shared RPG Runtime schema concepts before implementation.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a shared runtime schema unification section before the per-LLM schema plans in the 19-step runtime flow document.
- Made the shared section authoritative over local LLM 1-6 and conditional LLM +1 schema notes when field names overlap.
- Unified `NarrativeLine` and `UsePurpose` so `outlineControl` / `ruleCheck` are not mistaken for narrative lines.
- Unified visibility and knowledge concepts with `VisibilityScope`, `KnowledgeScope`, `KnowledgeSourceKind`, and `knownBy`, including the rule that parallel-line display does not become PC knowledge.
- Unified event status with `HappenedStatus`, and clarified that `events/` only accepts confirmed happened facts and direct consequences.
- Added `RuntimeDeltaRef` as the shared source-delta reference contract for later Runtime Update Proposal generation.
- Clarified clock and pacing persistence: current-scene stores the next-turn snapshot, long-lived clock authority belongs in runtime overlays, and per-turn deltas stay in `WorldTickResult` / `workingState` / turn journal until proposal/apply.
- Unified preliminary `GapImpactCandidate` versus authoritative `OutlineImpactLevel`, where only `major_rewrite_required` from LLM 4 can trigger Story Outline Regenerator.
- Clarified `outlines/progress.md` versus `plot-arcs/runtime` responsibilities, independent `outlineRevision` review items, tension writeback boundaries, and the non-fact status of unselected next action options.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the flow document mentions `RPG_RUNTIME_SHARED_SCHEMA_GUIDANCE`, `RuntimeDeltaRef`, `HappenedStatus`, `OutlineImpactLevel`, `ReviewItemKind`, and the current-scene/runtime overlay clock boundary.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Update Proposal Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the LLM 6 / Runtime Update Proposal schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that LLM 6 should consume the validated `workingState`, `ActionResolution`, `WorldTickResult`, `RecallSelection`, outline/narration briefs, optional provisional outline patch and outline revision proposal, `TurnNarration`, consistency validation, display policy, write policy, and review policy.
- Clarified that Runtime Update Proposal should evolve from extracting updates out of `submittedAction + generatedNarrative + references` into generating reviewable proposal packages from structured runtime deltas.
- Documented current schema gaps: source delta references, line/visibility/knowledge metadata, pacing and clock update proposals, outline revision review items, skipped delta/no-op reporting, proposal grouping, and JSON-first proposal output.
- Proposed stronger writeback semantics for `current-scene`, `events`, `player/known_information.md`, `relationships/runtime`, `plot-arcs/runtime`, `outlines/progress.md`, and protected `outlines/main.md`.
- Added suggested `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, enhanced `ProposedWikiUpdate`, `OutlineRevisionReviewItem`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, and `ProposalGroup` shapes, plus the preferred implementation order from schema docs to code-readable guidance, structured parser updates, and stronger local validation.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `RuntimeUpdateProposalInput`, `RuntimeUpdateProposalResult`, `OutlineRevisionReviewItem`, `SkippedRuntimeDelta`, `PacingUpdateProposal`, and `ProposalGroup`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Narration Generator Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the LLM 5 / Narration Generator schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that LLM 5 should consume `workingState`, `OutlineAwareNarrationBrief`, optional `ProvisionalOutlinePatch.narrationHandoff`, `ActionResolution`, `WorldTickResult`, selected visible content, selected parallel lens, reaction queue, pacing directive, campaign delta requirement, reveal policy, style bundle, forbidden narration constraints, and output contract.
- Clarified that the current single `narrative`-oriented `RpgTurnResult` is too narrow for the planned runtime and should become a three-line, verifiable `TurnNarration` structure.
- Documented current schema gaps: narration handoff priority, player knowledge boundary, structured tension brief, pacing compliance, enhanced next action option metadata, and style/runtime handoff boundaries.
- Proposed stronger semantics for `style/narration.md`, `style/dialogue.md`, `style/forbidden.md`, `player/known_information.md`, `relationships/runtime`, and `current-scene` in relation to narration generation and later writeback.
- Added suggested `NarrationGeneratorInput`, `TurnNarration`, `NarrationDisplayPolicy`, `TensionBrief`, `NarrationMeta`, and enhanced `RpgActionOption` shapes, plus the preferred implementation order from schema docs to code-readable guidance, narration output type changes, and later update proposal consumption.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `NarrationGeneratorInput`, `TurnNarration`, `NarrationDisplayPolicy`, `TensionBrief`, `NarrationMeta`, and enhanced `RpgActionOption`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Story Outline Regenerator Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the conditional LLM +1 / Story Outline Regenerator schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that this conditional interaction only runs after `major_rewrite_required`, and should consume `workingState`, recalled outline slices, outline progress, `OutlineImpactReport`, `RegenerationRequest`, confirmed/immutable facts, preservation constraints, visibility boundaries, reveal policy, and review policy.
- Clarified the required dual-track output: `ProvisionalOutlinePatch` for same-turn non-persistent hard narration constraints, and `OutlineRevisionProposal` as an independent review/pending item that cannot silently update `outlines/main.md`.
- Documented current schema gaps: provisional patch structure, outline revision proposal structure, immutable fact basis, outline revision review boundary, progress/proposal separation, reveal/theme preservation, and narration handoff constraints.
- Proposed stronger semantics for `outlines/main.md`, `outlines/progress.md`, `plot-arcs/runtime`, `.llm-wiki/runtime` audit records, and review/pending separation for outline revision proposals.
- Added suggested `StoryOutlineRegeneratorInput`, `ProvisionalOutlinePatch`, `ProvisionalNarrationHandoff`, `OutlineRevisionProposal`, and `RegenerationSafetyReport` shapes, plus the preferred implementation order from schema docs to code-readable guidance, interaction spec, and separate review handling.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `StoryOutlineRegeneratorInput`, `ProvisionalOutlinePatch`, `ProvisionalNarrationHandoff`, `OutlineRevisionProposal`, and `RegenerationSafetyReport`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Outline Brief Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the LLM 4 / Outline-aware Brief Compiler + Outline Impact Detector schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that LLM 4 should consume `workingState`, `ActionResolution`, `WorldTickResult`, `RecallSelection`, recalled materials, pacing state, gap state, reaction queue, visibility boundaries, outline slices, plot arc runtime state, rules, style constraints, and forbidden contradictions.
- Clarified that LLM 4 outputs a filtered narration brief and `OutlineImpactReport`, plus `RegenerationRequest` when major outline regeneration is required, rather than player-facing prose or direct `outlines/main.md` writes.
- Documented current schema gaps: machine-readable outline beat/reveal/branch ids, outline impact rubric, line-specific brief structure, reveal policy / forbidden reveal fields, plot-arc/runtime-to-outline linkage, dependency/contradiction fields, and narration handoff boundaries.
- Proposed stronger outline/progress/runtime overlay semantics for `outlines/main.md`, `outlines/progress.md`, `plot-arcs/runtime`, and runtime overlays that affect outline validity.
- Added suggested `OutlineBriefCompilerInput`, `OutlineSlice`, `OutlineAwareNarrationBrief`, `OutlineImpactReport`, and `RegenerationRequest` shapes, plus the preferred implementation order from schema docs to code-readable guidance, interaction spec, and filtered handoff to narration.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `OutlineBriefCompilerInput`, `OutlineSlice`, `OutlineAwareNarrationBrief`, `OutlineImpactReport`, and `RegenerationRequest`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Recall Selector Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the LLM 3 / Recall Selector schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that Recall Selector should consume the action-after `workingState`, `ActionResolution`, `WorldTickResult`, selected visible content, selected parallel lens, pacing state, gap state, outline position, lightweight retrieval index, recall budget, and recall policy.
- Clarified that LLM 3 outputs a recall plan / allowlist rather than player-facing prose or raw file contents; local code remains responsible for allowed path and section reads.
- Documented current schema gaps: mandatory `Runtime Capsule`, page-level recall metadata, section-level recall, three-line recall boundaries, negative recall / exclusions, and working-state anchor fields.
- Proposed stronger page/index semantics for runtime-facing wiki pages, including aliases, related entities/locations/factions/items/plot arcs, visibility tags, temporal scope, authority level, last-updated metadata, and available sections.
- Added suggested `RecallSelectorInput`, `RetrievalIndexEntry`, `RecallSelection`, `RecallLineTarget`, and `RecallExclusion` shapes, plus the preferred implementation order from schema docs to code-readable guidance, interaction spec, and local allowlisted reads.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `RecallSelectorInput`, `RetrievalIndexEntry`, `RecallSelection`, `RecallLineTarget`, and `RecallExclusion`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime World Tick Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the LLM 2 / World Tick + Reaction schema plan to the `Schema 改造计划记录` section of the 19-step runtime flow document.
- Recorded that World Tick should consume `ActionResolution`, `playerActionDelta`, pacing state, active clocks, ongoing events, offscreen actors, relationship pressure, plot arc runtime state, outline position, gap signals, and visibility boundaries.
- Clarified that LLM 2 should output structured world deltas, clock updates, settled ongoing events, information broadcast, reaction queue, pacing updates, and gap state, rather than player-facing prose or direct wiki writes.
- Documented current schema gaps: active clocks/countdowns, ongoing events, information broadcast, reaction queue, three-line world-delta visibility metadata, and pacing debt persistence.
- Proposed stronger required semantics for `wiki/current-scene/scene_state.md`, `plot-arcs/runtime`, `relationships/runtime`, `characters/runtime`, `factions/runtime`, `locations/runtime`, `items/runtime`, and `player/known_information.md`.
- Added suggested `WorldTickInput`, `WorldTickResult`, and `WorldTickVisibilityMeta` shapes, plus the preferred implementation order from schema docs to code-readable guidance, interaction spec, and runtime record persistence.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks should confirm the flow document mentions `WorldTickInput`, `WorldTickResult`, `WorldTickVisibilityMeta`, `informationBroadcast`, and `reactionQueue`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Action Resolver Schema Plan

### Stage

Documentation refinement for RPG Runtime turn-flow schema planning.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added a `Schema 改造计划记录` section to the 19-step runtime flow document so future per-LLM schema discussions can be recorded in one place.
- Recorded the LLM 1 / Action Resolver schema gap: current RPG wiki schema can support rough action parsing, but not stable structured action resolution with pre-action snapshots, pacing, clocks, visibility, adjacent beats, and gap signals.
- Clarified that Action Resolver outputs should be runtime interaction objects stored in turn records / journal, not a new ordinary `wiki/runtime/` category and not direct wiki writes.
- Proposed stronger required semantics for `wiki/current-scene/scene_state.md`, `wiki/player/known_information.md`, `wiki/outlines/progress.md`, `rules/`, and runtime overlays.
- Added suggested `ActionResolverInput` and `ActionResolution` shapes, including intent analysis, event draft, feasibility, direct result, pacing, gap signal, references, and warnings.
- Documented the preferred implementation order: update `docs/RPG_WIKI_SCHEMA.md`, add code-readable schema guidance in `src/lib/rpg-wiki-schema.ts`, add Action Resolver interaction/types, then persist `ActionResolution` in runtime records for later LLM stages.

### Validation

- Documentation-only pass; no source code tests were required.
- Text checks confirmed the flow document mentions `Schema 改造计划记录`, `ActionResolverInput`, and `ActionResolution`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Outline Gap Event Update

### Stage

Documentation refinement for RPG Runtime turn-flow discussion.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added explicit handling for gaps between key outline beats as elastic runtime periods rather than empty space or automatically low-impact filler.
- Added `gapState` with `betweenBeats`, `gapMode`, `gapEvent`, `gapImpactLevel`, and `affectedFutureBeats`.
- Clarified that gap events may be branching or major-divergence events when causally grounded in player action, character motivation, location conditions, active clocks, parallel-line movement, relationship pressure, or pacing pressure.
- Documented that outline revision is not permission before a gap event happens: the event is first settled as runtime fact, then Outline Impact Detector and optional step 14.5 adapt the future outline.
- Updated steps 1, 5, 7, 8, 12-18 to include adjacent key beats, branch conditions, Gap / Vacuum Detector responsibilities, gap event settlement, causality validation, writeback separation, outline progress updates, and accepted fact priority over stale outline beats.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the document mentions `gapState`, `gapMode`, `gapEvent`, `gapImpactLevel`, `affectedFutureBeats`, `branching_event`, and `major_divergence_event`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Pacing Anti-Stagnation Update

### Stage

Documentation refinement for RPG Runtime turn-flow discussion.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added an explicit pacing / time advancement policy to prevent RPG runtime stagnation and SillyTavern-style one-minute-per-turn drift.
- Added the pacing state fields `timeDelta`, `campaignDelta`, `pacingIntent`, `stagnationRisk`, `pacingDebt`, and `activeClocks`.
- Clarified that elapsed in-world time is derived from action type and scene context, not from the number of dialogue turns.
- Documented the default requirement that every formal turn should produce at least one `campaignDelta` unless the player or GM explicitly requests pause, waiting, recap, casual talk, or intentionally slow interaction.
- Added `pacingIntent` levels such as `hold`, `micro`, `medium`, `strong`, and `scene_cut`, plus a recommended 2-3 low-progress-turn threshold for increasing pacing pressure.
- Updated steps 1, 5, 7, 8, 10-18 so action resolution, world tick, reaction queues, recall, brief compilation, narration, validation, update proposal, and apply all track time, clocks, pacing debt, and campaign delta.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the document mentions `timeDelta`, `campaignDelta`, `pacingIntent`, `stagnationRisk`, `pacingDebt`, `activeClocks`, and `scene_cut`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Three-Line Narration Update

### Stage

Documentation refinement for RPG Runtime turn-flow discussion.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the three-line narration model to the 19-step runtime flow: `playerVisibleLine`, `parallelLine`, and `tensionLine`.
- Defined `parallelLine` as player-invisible/offscreen narration that is generated by default, while `displayPolicy.showParallelLine` controls whether the real user/GM sees it in the UI.
- Clarified the knowledge boundary: showing `parallelLineText` does not make it player-character knowledge and must not automatically update `player/known_information.md`.
- Updated steps 7-17 so World Tick, reaction queues, recall, outline-aware brief compilation, narration generation, validation, and update proposal all track lane ownership, visibility, knowledge source, and writeback boundaries.
- Kept the existing 19-step structure and the minimum 6 LLM / conditional 7 LLM interaction model unchanged.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the document mentions `playerVisibleLine`, `parallelLine`, `tensionLine`, `parallelLineText`, and `displayPolicy.showParallelLine`.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime Outline Impact Branch Update

### Stage

Documentation refinement for RPG Runtime turn-flow discussion.

### Changed files

- Updated `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added Outline Impact Detector to step 14 as an internal responsibility of the outline-aware brief compiler.
- Added conditional step 14.5 for Story Outline Regenerator, making regular turns stay at minimum 6 LLM interactions while major outline-divergence turns add one conditional LLM interaction before narration.
- Documented the required split between `provisionalOutlinePatch` and `outlineRevisionProposal`.
- Clarified that `provisionalOutlinePatch` is the same-turn hard constraint that Narration Generator must follow, while `outlineRevisionProposal` remains a separate review/pending item and cannot silently overwrite `wiki/outlines/main.md`.
- Updated the narration, consistency-check, runtime-update, and apply steps so patch compliance is gated before player-visible output and before any wiki update proposal proceeds.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the flow now mentions `provisionalOutlinePatch`, `outlineRevisionProposal`, conditional step 14.5, and the major-divergence 7-interaction branch.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-10 - RPG Runtime 19-Step / 6-Interaction Flow Draft

### Stage

Documentation draft for RPG Runtime turn-flow discussion.

### Changed files

- Added `docs/RPG_RUNTIME_TURN_19_STEP_SIX_INTERACTION_FLOW.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Wrote a detailed 19-step RPG Runtime turn flow using the minimum 6 LLM interactions.
- Marked which steps are local and which steps are covered by the six interactions: Action Resolver, World Tick + Reaction, Recall Selector, Brief Compiler, Narration Generator, and Runtime Update Proposal.
- Preserved the sequencing boundary under discussion: minimal pre-action context before action parsing, action-after working state before total recall, and persistent wiki writes only through proposal / pending / review / apply.
- Renamed the document away from the narrower Context Compiler label because the flow also includes action resolution, world tick, narration, runtime update proposal, review, and apply boundaries.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks should confirm the new file contains all six LLM interaction labels and the 0-18 step sequence.

### Scope notes

- Did not modify Context Compiler or RPG Runtime implementation.
- Did not modify runtime prompts, narration prompts, import behavior, schema code, tests, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-09 - Context Compiler Setting Availability Reframing

### Stage

Documentation reframing before Stage 6.17 `Context Compiler v1` implementation.

### Changed files

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Added the `setting availability system` design to replace traditional AI roleplay's full-setting injection at narration time.
- Clarified that narration should receive the current turn's world slice rather than the full world book: fixed hard context, capsule index, relevant recall, plot-advancement brief, source path references, and post-turn runtime writeback.
- Documented always-on context inputs: submitted action, current-scene, fixed player slots, active quests, core/relevant rules, forbidden style / hard gates / explicit control blocks, player preferences, and recent reliable turns or capsules.
- Added capsule-first reading guidance and a recommended `Runtime Capsule` shape for runtime-facing wiki pages.
- Added narration knowledge-boundary rules so narration does not invent unstated world facts, NPC knowledge, location state, item powers, or happened events outside the brief / source-path boundary.
- Added `knowledgeBoundary` to the proposed second-pass brief interface, with `alwaysOnContext`, `recalledSettingSlice`, `capsuleOnlyPaths`, `expandedSectionPaths`, `sourcePathPolicy`, and `doNotInvent`.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks were run to verify the new setting-availability section, capsule-first guidance, narration knowledge-boundary language, and `knowledgeBoundary` fields appear in the active Context Compiler plan.

### Scope notes

- Did not implement Context Compiler v1.
- Did not change runtime context compilation code, narration prompts, import behavior, schema code, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-09 - Context Compiler Plot Advancement Reframing

### Stage

Documentation reframing before Stage 6.17 `Context Compiler v1` implementation.

### Changed files

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md`
- Updated `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Reframed Context Compiler's core value from context summarization to autonomous per-turn plot advancement for AI roleplay.
- Synchronized the Stage 6.17 roadmap summary with the new plot-advancement framing.
- Clarified the two-pass mental model: pass 1 is DM / writer recall, while pass 2 is director judgment that decides how the world should move after the submitted player action.
- Renamed the second pass in the detailed plan to `Outline-aware Plot Advancement Brief Compiler`.
- Added a campaign-delta requirement: every formal narration turn should create at least one meaningful change for the generated narration to realize and for later runtime update extraction to observe.
- Added three advancement strengths: `micro`, `medium`, and `strong`, plus a default v1 pacing policy that advances lightly by default, escalates after repeated low-progress turns, and reserves major advances for justified conditions.
- Added `plotAdvancement` output fields for `pacingIntent`, `advancementStrength`, `thisTurnMustChange`, `beatToApproach`, `pressureMove`, `revealPolicy`, `doNotResolveYet`, and `playerAgencyRule`.
- Tightened second-pass non-goals: it must not prewrite narrative, full NPC dialogue, next action options, style rewrites, future facts, or railroaded outcomes.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks were run to verify the new second-pass name, campaign-delta requirement, pacing fields, and plot advancement terminology appear in the active Context Compiler plan.

### Scope notes

- Did not implement Context Compiler v1.
- Did not change runtime context compilation code, narration prompts, import behavior, schema code, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

## 2026-06-09 - Context Compiler v1 Plan Alignment

### Stage

Documentation alignment before Stage 6.17 `Context Compiler v1` implementation.

### Changed files

- Updated `docs/CONTEXT_COMPILER_REDESIGN_PLAN.md`
- Updated `docs/LLMWIKIRPG_NEXT_ARCHITECTURE_STEPS.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/IMPLEMENTATION_LOG.md`

### Summary

- Revised the Context Compiler v1 plan to require exactly two LLM interactions for every formal narration turn: Recall Selector / Memory Routing, then Outline-aware Context Brief Compiler.
- Removed normal 1-call downgrade and 3-call upgrade modes from the plan. Deterministic v0 fallback remains only for LLM failure, and retrieval repair / outline impact probing are deferred to independent future interactions or stages.
- Replaced the obsolete `wiki/plot-arcs/main-outline.md` path with the current schema-slot outline model: `wiki/outlines/main.md`, `wiki/outlines/progress.md`, active `plot-arcs/*.md`, and active `plot-arcs/runtime/*.md`.
- Replaced vague outline bullets with schema-section-derived inputs: main outline premise / act structure / intended reveals / delayed reveals / branch conditions / must-not-contradict; outline progress current stage / completed beats / divergence notes / next useful beats; plot arc core question / unresolved suspense / conflict structure / advancement conditions / runtime beat changes.
- Clarified the control material boundary: rules slots can affect Context Compiler reasoning, narration/dialogue style slots should pass through to Narration instead of being summarized by Context Compiler, style forbidden / player preferences / explicit control blocks remain high-priority hard controls, and memory long-term/session notes are auxiliary rather than authoritative fact sources.
- Updated the Stage 6.17 roadmap summary and suggested implementation paths to use `src/lib/rpg-interactions/context-compiler/` after the completed LLM interaction consolidation work.

### Validation

- Documentation-only pass; no source code tests were required.
- Follow-up text checks were run after edits to verify stale downgrade/upgrade, old outline path, old flat interaction file path, and old Stage 6.17 wording no longer appear in the active Context Compiler plan text.

### Scope notes

- Did not implement Context Compiler v1.
- Did not change runtime context compilation code, narration prompts, import behavior, schema code, or UI.
- Did not call a real LLM.
- No `git commit` or `git push` was performed.

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
