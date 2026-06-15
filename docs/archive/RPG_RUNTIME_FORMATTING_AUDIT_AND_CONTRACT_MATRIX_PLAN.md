# RPG Runtime Formatting Audit and Contract Matrix

## Purpose

This stage implements Phase A and Phase B from `docs/RPG_RUNTIME_FORMATTING_REDUCTION_ASSESSMENT.md` as an observation and classification layer only.

It does not change runtime prompts, parser behavior, validator strictness, wiki writeback, pending/apply policy, fallback behavior, or legacy/default compatibility.

## Phase A - Failure-Frontier Formatting Audit

The reusable audit entry point is:

```ts
buildRuntimeFormattingAuditReport({ realTrace, syntheticTrace })
```

It returns a `runtimeFormattingAudit` table with one row per trace step and measurement kind.

Each row records:

- `measurementKind`: `real` or `synthetic`.
- `state`: `executed`, `failed`, `blocked_by_previous_failure`, `unknown_real_model_cost`, or `synthetic`.
- Per-area character totals for input assembly, prompt, raw output, parsed output, validation, handoff, and total recorded chars.
- Top prompt sections and top input assembly contributors sorted by character count.
- Failure frontier when a step failed: input assembly, provider/transport, parse, draft validation, compiler, canonical validation, write safety, persistence, or unknown.

Real trace data is read only from sections already recorded by the runtime debug trace. Pending real steps after an earlier failure are explicitly marked `blocked_by_previous_failure`; the audit must not invent prompt, output, or model cost numbers for steps that never ran.

Synthetic traces are allowed only for local prompt/input/handoff structure measurement. They must be labelled `synthetic` and must not be treated as real model behavior, quality, latency, or provider cost.

## Phase B - Runtime Contract Classification Matrix

The reusable matrix entry points are:

```ts
getRpgRuntimeContractClassificationMatrix()
getRpgRuntimeContractStageMatrix(stepId)
```

Each runtime step has field rules in these categories:

- `semantic_required`: the LLM or boundary must decide it; missing should remain a hard error for that contract.
- `semantic_optional`: useful semantic material that may be absent.
- `derivable_protocol`: local compiler/controller material; missing, empty arrays, or blank strings can mean undeclared draft protocol where the stage later adopts optional-by-design rules.
- `dangerous_forbidden`: output that must be rejected or kept out of the stage.
- `persistence_hard_boundary`: strict writeback safety rules for Runtime Update Proposal, validation, and persistence boundaries.

The unified error category list is:

- `malformed_json`
- `missing_semantic_field`
- `invalid_semantic_enum`
- `unsafe_knowledge_boundary`
- `unknown_reference`
- `derivable_protocol_omitted`
- `forbidden_persistence_claim`
- `forbidden_write_target`
- `compiler_invariant_failed`
- `canonical_validation_failed`
- `provider_transport_failure`
- `blocked_by_previous_failure`

## Boundary Notes

- Action Resolver, World Tick, Outline Brief, Story Outline Regenerator, and Narration Generator are classified as non-writeback semantic stages in this phase.
- Recall Selector remains an allowlist-selection stage backed by deterministic local reading.
- Runtime Update Proposal, Runtime Update Validation, and Pending Update Persistence remain the persistence boundary.
- World Tick records `affectedPaths`, runtime refs, source IDs, full visibility envelope, time basis, reference metadata, IDs, and default arrays as `derivable_protocol`; this document and matrix do not by themselves change the current compiler or validator behavior.

## Phase C - Soft/Hard Validation Boundary Design

Implemented entry points:

```ts
getRpgRuntimeValidationBoundaryPolicies()
getRpgRuntimeValidationBoundaryPolicy(stepId)
```

The validation-boundary policy is derived from the Phase B matrix:

- `action_resolver`, `world_tick`, `outline_brief`, `story_outline_regenerator`, and `narration_generator` are soft semantic stages.
- `recall_selector` remains an allowlist-selection gate.
- `runtime_update_proposal`, `runtime_update_validation`, and `pending_update_persistence` are the hard/deterministic persistence boundary.
- `derivable_protocol_omitted` is warning/compiler input for soft semantic stages, not a persistence acceptance path.
- Existing canonical validators remain strict; this phase records where strict failures belong instead of globally relaxing validators.

## Phase D - World Tick Contract Containment

World Tick now applies the optional-by-design rule to draft string arrays:

- Missing arrays, empty arrays, and blank-string-only arrays in World Tick draft protocol mean "undeclared" and are compiled from deterministic defaults.
- This specifically fixes draft `affectedPaths: []` by deriving canonical non-empty affected paths before `validateWorldTickResult()`.
- Canonical `WorldTickResult` parsing without prompt input remains strict and still rejects missing or empty canonical `affectedPaths`.
- Forbidden keys, invalid enums, missing semantic summaries on emitted items, wiki write claims, narration fields, next action options, recall output, and outline revision authority remain hard failures.

World Tick also now emits a compact `WorldTickSemanticHandoff` debug handoff alongside the full local result. It summarizes action outcome, confirmed / ongoing / possible-future separation, PC-visible deltas, user-visible PC-unknown signals, tension/gap/pacing summaries, candidate paths, and warnings. Full `WorldTickResult` remains in turn record / local controller state; downstream prompt replacement is deferred to Phase E.

## Phase E - Compact Semantic Handoff Layer

Runtime turn flow now builds and carries a shared `TurnSemanticHandoff` for non-writeback downstream LLM stages.

Implemented behavior:

- `buildTurnSemanticHandoff()` and `buildTurnSemanticHandoffFromCanonical()` produce a compact turn packet from `SubmittedAction`, `ActionResolution`, `WorldTickResult`, `WorldTickVisibleSelection`, `PostActionWorkingState`, and existing World Tick semantic material.
- The handoff separates `confirmed`, `attemptedOrBlocked`, `ongoing`, and `possibleFuture` material, and separately tracks `pcVisible`, `pcInferred`, `userVisiblePcUnknown`, `gmOnlyControl`, risks, pressure signals, open questions, candidate paths, reference allowlist, and warnings.
- Handoff builders enforce compact budgets: semantic lists are capped, reference allowlist is deduped and capped, summaries are truncated, warnings are capped, and serialized handoff output is bounded for prompt use.
- `RunRpgTurnResult`, `RpgTurnRecord`, runtime journal entries, controller flow results, and persistence-shared turn records now carry `turnSemanticHandoff` while keeping full canonical `actionResolution`, `worldTickResult`, `visibleSelection`, and `postActionWorkingState` for local compilers, validators, debug audit, and Runtime Update Proposal.
- Recall Selector, Outline Brief, Narration Generator, and triggered Story Outline Regenerator prompt paths now consume `TurnSemanticHandoff` instead of expanding full canonical `ActionResolution`, `WorldTickResult`, or `PostActionWorkingState`.
- Debug trace records compact handoff prompt sections and retains full canonical local sections only for audit/controller use.

Preserved boundaries:

- Runtime Update Proposal, Runtime Update Validation, and Pending Update Persistence continue to receive canonical-complete state.
- `TurnSemanticHandoff` is soft semantic handoff only; it is never promoted directly into accepted wiki facts.
- No legacy/default compatibility, old full-canonical prompt fallback, parser repair, or silent validator relaxation was added.

## Phase F - Stage-Specific Compiler Slimming

Action Resolver and Narration Generator now use lightweight LLM draft contracts compiled locally into the existing strict canonical types.

Action Resolver:

- Introduced `ActionResolutionDraft` and `compileActionResolutionDraftOutput()`.
- The model-facing contract now asks only for semantic action intent/outcome/status, target/actor refs, time-cost summary, risks/costs, obstacles, direct result summaries/statuses, player action semantic delta, progress potential, lightweight `referencePaths`, and string warnings.
- The local compiler generates `resolutionId`, `costId`, `obstacleId`, `resultId`, canonical `runtimeDeltaRefs`, default arrays, and normalized reference envelopes before strict `validateActionResolution()`.
- The local compiler also converts `referencePaths?: string[]` into canonical reference envelopes and `warnings?: string[]` into structured warning objects.
- `attempted_not_confirmed` remains the default event status; the compiler does not silently promote attempted action material to `confirmed_happened`.
- Forbidden narration, wiki write, runtime update, recall, outline, canonical ID/ref envelope, and persistence keys remain hard failures.

World Tick prompt/schema follow-up:

- The prompt now uses a compact `WorldTickActionBrief` section instead of expanding the full `ActionResolution` plus separate `playerActionDelta` and `timeDelta` sections.
- The model-facing `WorldTickDraft` contract no longer asks for `tickId`, reference envelopes, or warning envelopes; `referencePaths?: string[]` and `warnings?: string[]` are compiled into canonical structures locally.
- `WorldTickActionBrief` is prompt/debug material only and is not part of persistence or write acceptance.

Narration Generator:

- Introduced `TurnNarrationDraft` and `compileTurnNarrationDraftOutput()`.
- The model-facing contract now asks for player prose, optional parallel-line prose, tension summary/review handoff, optional tension signals, next action option text/intent/risk, optional pacing/reveal self-report enums, and warnings.
- The local compiler generates `narrationId`, display policy defaults, player-knowledge-boundary metadata, source refs, action option IDs, option-only future status, references, and narration meta envelopes before strict `validateTurnNarration()`.
- The local compiler defaults omitted `narrationSelfReport`, tension signal arrays, and `nextActionOptions[].likelyAffectedPaths`.
- Player-facing leakage of GM-only, hidden, or user-visible-PC-unknown material remains a hard failure; ordinary metadata omission is compiler responsibility.

Outline Brief prompt slimming:

- The existing Outline Brief draft/compiler flow remains in place.
- Prompt expansion is now bounded to compact turn handoff, recalled materials, visibility boundaries, outline/control slices, plot-arc fuel, hard constraints, and capped known references.
- Outline/control slices, plot-arc fuel, and hard constraints are capped to 8 entries each; known references are capped to 20 entries; full local canonical input remains available to compiler and validator.

Story Outline Regenerator:

- Compiler redesign remains deferred.
- The triggered prompt path now uses compact handoff plus outline-specific control materials, without full `PostActionWorkingState` prompt expansion.

## Phase G - Persistence Boundary Consolidation

Runtime persistence now uses a shared deterministic boundary gate before anything can enter pending staging.

Implemented behavior:

- Added `validateRpgRuntimePersistenceBoundary()` and `summarizeRpgRuntimePersistenceBoundary()` as the shared gate for Runtime Update Proposal acceptance.
- The gate combines runtime target policy, runtime update semantic/write validation, pending eligibility ids, and review-only audit item tracking.
- Runtime controller and `runtime_update_apply stage_pending` now both pass proposed updates through this same gate before calling `createPendingRpgUpdates()`.
- `pending_update_persistence` stages only gate-accepted updates; `TurnSemanticHandoff`, World Tick handoff, Narration output, skipped deltas, outline revision review items, pacing proposals, journal entries, and proposal groups cannot directly become pending updates.
- Debug trace and turn journal now include a persistence boundary summary with proposal/accepted/rejected/pending counts, pending eligible ids, rejected issue codes, warning issue codes, and review-only audit ids.
- `apply_pending` remains the final filesystem write gate: it still applies only `accepted` pending updates, rechecks target policy, and enforces project `wiki/` path containment before writing.

Preserved boundaries:

- Runtime Update Proposal remains the only LLM-facing ordinary wiki write-intent stage.
- Runtime Update Validation and Pending Update Persistence remain deterministic gates.
- No canonical validators were relaxed, and no fallback, parser repair, retry sanitizer, legacy/default compatibility, or old-path preservation was added.

## Validation

Implemented tests:

- `src/lib/rpg-runtime-formatting-audit.test.ts`
- `src/lib/rpg-runtime-contract-classification.test.ts`
- `src/lib/rpg-runtime-validation-boundary.test.ts`
- `src/lib/rpg-world-tick-interaction.test.ts`
- `src/lib/rpg-world-tick-working-state.test.ts`
- `src/lib/rpg-turn-semantic-handoff.test.ts`
- `src/lib/rpg-runtime-compact-prompt.test.ts`
- `src/lib/rpg-action-resolver-draft-compiler.test.ts`
- `src/lib/rpg-narration-draft-compiler.test.ts`
- `src/lib/rpg-runtime-persistence-boundary.test.ts`

Validation commands:

- `npm.cmd run typecheck`
- `npx.cmd vitest run src/lib/rpg-runtime-formatting-audit.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts --exclude='**/*.real-llm.test.ts'`
- `npx.cmd vitest run src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-contract.test.ts src/lib/rpg-runtime-contract-classification.test.ts src/lib/rpg-runtime-validation-boundary.test.ts src/lib/rpg-world-tick-working-state.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-debug-trace.test.ts --exclude='**/*.real-llm.test.ts'`
- `npx.cmd vitest run src/lib/rpg-turn-semantic-handoff.test.ts src/lib/rpg-action-resolver-draft-compiler.test.ts src/lib/rpg-narration-draft-compiler.test.ts src/lib/rpg-runtime-compact-prompt.test.ts --exclude='**/*.real-llm.test.ts'`
- `npx.cmd vitest run src/lib/rpg-interactions.test.ts src/lib/rpg-recall-selector.test.ts src/lib/rpg-recall-selector-handoff.test.ts src/lib/rpg-outline-brief.test.ts src/lib/rpg-narration-generator.test.ts src/lib/rpg-story-outline-regenerator.test.ts src/lib/rpg-turn-orchestrator.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-debug-trace.test.ts src/lib/rpg-world-tick-interaction.test.ts src/lib/rpg-world-tick-working-state.test.ts --exclude='**/*.real-llm.test.ts'`
- `npx.cmd vitest run src/lib/rpg-runtime-persistence-boundary.test.ts src/lib/rpg-runtime-update-proposal.test.ts src/lib/rpg-runtime-update-validation.test.ts src/lib/rpg-runtime-controller.test.ts src/lib/rpg-import/runtime-update-apply.test.ts src/lib/rpg-runtime-write-policy-client.test.ts src/lib/rpg-write-policy.test.ts src/lib/rpg-runtime-validation-boundary.test.ts --exclude='**/*.real-llm.test.ts'`
- `npm.cmd run build:runtime`
