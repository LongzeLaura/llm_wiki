# Stage 08: Cleanup And Review

You are continuing `llm_wiki_chemical` from phase 8.

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

Also read the outputs of phases 2 through 7 if they exist.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path and the changes already introduced in phases 2 through 7.
2. Propose a minimal cleanup and review plan for phase 8 only.
3. Focus on consistency, low-risk cleanup, and clear documentation of remaining risks.

## Goal

Review the work completed so far, clean up safe duplication or remaining hardcoded category names where appropriate, align documentation, and produce clear next-step guidance.

## Allowed Modifications

You may modify:

- files already touched by earlier phases, but only for small cleanup or consistency fixes
- focused tests or fixtures
- `docs/**`
- `IMPLEMENTATION_LOG.md`

## Do Not

- Do not perform a large rewrite.
- Do not introduce new architecture that was not already justified by earlier phases.
- Do not use cleanup as a reason to rename the whole project or delete compatibility behavior.
- Do not remove original categories unless explicitly requested.

## Expected Output

Produce a concise cleanup and review result that covers:

- safe duplication cleanup, if any
- remaining hardcoded category names, if any
- document consistency across roadmap, state, queue, and implementation log
- remaining risks
- recommended next tasks after phase 8

## Acceptance Criteria

- Cleanup changes are small and low risk.
- Docs are internally consistent.
- Remaining issues are clearly called out rather than hidden.
- Validation commands pass.

## Runnable Tests Or Smoke Checks

Run at minimum:

- `npm run typecheck`
- `npm run build`

Also run if relevant:

- `npm run test:mocks`

If phase 7 produced a reproducible smoke test, rerun or spot-check it when practical and document the result.

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
