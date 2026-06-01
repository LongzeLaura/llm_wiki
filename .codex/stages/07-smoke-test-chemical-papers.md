# Stage 07: Smoke Test Chemical Papers

You are continuing `llm_wiki_chemical` from phase 7.

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

Also read the outputs of phases 2 through 6 if they exist.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for source import, ingest queue, extraction output writing, and frontend display visibility.
2. Propose a minimal smoke-test plan for phase 7 only.
3. Prefer reproducible sample inputs and small fixes over broad refactoring.

## Goal

Use existing or sample Markdown chemistry papers to smoke test the import, extraction, save, and display flow for the chemical adaptation work.

## Allowed Modifications

You may modify only the smallest necessary files for smoke testing, such as:

- sample inputs or fixtures
- narrowly scoped test helpers
- tiny blocking fixes discovered during the smoke test, if they are required and clearly documented
- `docs/**`
- `IMPLEMENTATION_LOG.md`

If you create sample files, keep them small and clearly named.

## Do Not

- Do not perform broad refactors under the name of smoke testing.
- Do not rewrite unrelated ingestion or UI logic.
- Do not delete existing data.
- Do not add dangerous automation or automatic cleanup.

## Expected Output

Produce a reproducible smoke-test record that shows:

- what sample or existing paper inputs were used
- what commands or manual steps were run
- whether import, extraction, save, and display succeeded
- any blocking issues or limitations that remain

Creating a concise report document is encouraged, for example:

- `docs/SMOKE_TEST_CHEMICAL.md`

## Acceptance Criteria

- At least one realistic chemical-paper path is exercised end to end, or the exact environment limitation is documented clearly.
- Results are reproducible enough for a human reviewer to follow.
- Any fixes made are minimal and directly tied to smoke-test blockers.
- Validation results are recorded clearly.

## Runnable Tests Or Smoke Checks

Run the most relevant available checks, at minimum:

- `npm run typecheck`
- `npm run build`

Also run if practical:

- `npm run test:mocks`

In addition, document the exact smoke-test commands or manual steps used for the chemical-paper scenario.

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
