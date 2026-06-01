# Stage 04: Extraction Prompt Adaptation

You are continuing `llm_wiki_chemical` from phase 4.

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

Also read the outputs of phases 2 and 3 if they exist.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for extraction analysis prompts, generation prompts, and schema-based routing.
2. Propose a minimal change plan for phase 4 only.
3. Preserve parser expectations and existing fallback behavior unless a small change is required.

## Goal

Adapt the extraction prompt logic so the project can use the chemical ontology when running in chemical mode, instead of hardcoding `concept/entity/source` assumptions everywhere.

## Allowed Modifications

You may modify only the smallest necessary prompt-related files, such as:

- `src/lib/ingest.ts`
- prompt helper files under `src/lib/**`
- registry or template files required for prompt selection
- focused tests or fixtures
- `docs/**`
- `IMPLEMENTATION_LOG.md`

## Do Not

- Do not do a large prompt-system rewrite.
- Do not break the existing file-block output format unless absolutely necessary.
- Do not redesign storage flow in this stage.
- Do not redesign frontend presentation in this stage.
- Do not remove original categories or compatibility behavior.

## Expected Output

Produce a prompt adaptation that:

- uses project mode, schema, or registry context
- supports chemical ontology wording and targets
- preserves legacy behavior when chemical mode is not active
- keeps downstream parsing and file writing compatible

## Acceptance Criteria

- Chemical mode can reference the four-layer ontology in extraction prompts.
- Legacy mode still works with original assumptions.
- Prompt changes remain localized and reviewable.
- Build or typecheck validation passes.

## Runnable Tests Or Smoke Checks

Run at minimum:

- `npm run typecheck`

Also run when relevant:

- `npm run build`
- `npm run test:mocks`

If you add tests, keep them focused on prompt routing and compatibility behavior.

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
