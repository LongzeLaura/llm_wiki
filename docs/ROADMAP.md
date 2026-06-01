# Roadmap

## Scope

This roadmap starts at phase 2.

Phase 0 and phase 1 are already complete and must not be rerun.

- Phase 0 completed the read-only codebase analysis.
- Phase 1 completed the chemical ontology and category-system design baseline.

This document defines the execution roadmap for phases 2 through 8 only.

## Completed Baseline

The following artifacts are already authoritative:

- `AGENTS.md`
- `IMPLEMENTATION_LOG.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/EXTRACTION_PIPELINE_MAP.md`
- `docs/CATEGORY_SYSTEM_ANALYSIS.md`
- `docs/CHEMICAL_ONTOLOGY.md`

## Phase Status

| Phase | Status | Goal | Primary Output |
| --- | --- | --- | --- |
| 0 | Done | Read-only code analysis | Architecture and pipeline documents |
| 1 | Done | Chemical ontology design | `docs/CHEMICAL_ONTOLOGY.md` |
| 2 | Done | Design a category registry / schema registry | Registry design doc and execution notes |
| 3 | Done | Implement the category registry with minimal code changes | Config or registry layer in runtime |
| 4 | Done | Adapt extraction prompts to project mode and chemical ontology | Prompt routing changes with compatibility |
| 5 | Done | Adapt backend storage and data flow | Save/read/pass chemical categories safely |
| 6 | Done | Adapt frontend category presentation | Chemical category labels, order, styles, display |
| 7 | Done | Run smoke tests with chemical papers | Reproducible smoke-test record |
| 8 | Done | Cleanup and review | Consistency review and next-step recommendations |

## Phase Goals

### Phase 2

Design a category registry or schema registry that can support chemical categories without deleting `concept`, `entity`, or `source`.

### Phase 3

Implement the registry layer with minimal code changes so that original `llm_wiki` behavior remains available while chemical schemas become possible.

### Phase 4

Adapt LLM extraction prompts so project mode can use the chemical ontology instead of hardcoded `concept/entity/source` assumptions.

### Phase 5

Adapt backend storage and data flow so chemical categories can be saved, read, and passed through existing flows without destructive schema rewrites.

### Phase 6

Adapt frontend presentation so catalytic system, elementary process, mechanistic network, and evidence categories can be shown clearly.

### Phase 7

Run smoke tests with existing or sample Markdown papers to validate import, extraction, save, and display flow.

### Phase 8

Review duplicated logic, remaining hardcoded category names, documentation consistency, and next improvements.

## Execution Rules

Every phase from 2 onward must:

1. Read the required baseline documents before editing.
2. Summarize the relevant existing code path first.
3. Propose a minimal change plan for that phase only.
4. Keep changes incremental and reviewable.
5. Preserve original `llm_wiki` behavior unless the phase explicitly changes it.
6. Run available tests or smoke checks.
7. Update:
   - `docs/CURRENT_STATE.md`
   - `docs/TASK_QUEUE.md`
   - `IMPLEMENTATION_LOG.md`

## Recommended Phase Order

1. Run `.codex/stages/02-category-registry-design.md`
2. Run `.codex/stages/03-category-registry-implementation.md`
3. Run `.codex/stages/04-extraction-prompt-adaptation.md`
4. Run `.codex/stages/05-backend-storage-adaptation.md`
5. Run `.codex/stages/06-frontend-category-ui.md`
6. Run `.codex/stages/07-smoke-test-chemical-papers.md`
7. Run `.codex/stages/08-cleanup-and-review.md`

## Human Review Checkpoints

Human review is especially recommended after:

- Phase 2 design completion
- Phase 3 registry implementation
- Phase 5 backend storage adaptation
- Phase 7 smoke-test results
- Phase 8 cleanup review

## Success Criteria For This Roadmap

The automation framework is successful when:

- phases 0 and 1 remain preserved as completed baseline work
- each later phase has an isolated Codex prompt
- the execution script runs stages one by one instead of using a single long context
- no stage requires automatic commit, deletion, or dangerous permissions

## Post-Phase 8 Follow-Up

The staged phase 2 through phase 8 adaptation work is now complete.

Open follow-up items are operational or intentionally deferred cleanup:

- execute the repository-aligned semantic follow-up in `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md`
- continue using `cmd /c npm ...` or `npm.cmd ...` for validation commands in this workspace because direct PowerShell `npm` still hits the local execution-policy restriction
- rerun the chemical smoke steps in `docs/SMOKE_TEST_CHEMICAL.md` after semantic-repair changes land and manual UI verification is scheduled
- review remaining untouched legacy-first surfaces such as project bootstrap, maintenance/dedup flows, and review-item routing before any broader chemical-mode rollout
