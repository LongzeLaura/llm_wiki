# Stage 03: Category Registry Implementation

You are continuing `llm_wiki_chemical` from phase 3.

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

If phase 2 created a dedicated registry-design document, read that too before implementation.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for category definitions and runtime type inference.
2. Propose a minimal implementation plan for phase 3 only.
3. Keep the implementation incremental and compatibility-first.

## Goal

Implement a minimal `category registry` or `schema registry` layer so the runtime can preserve original `llm_wiki` behavior while also supporting a chemical schema.

## Allowed Modifications

You may modify only the smallest necessary implementation files, such as:

- `src/lib/**`
- `src/components/**` only if required for shared registry wiring, not for UI redesign
- `src-tauri/src/commands/project.rs` only if strictly necessary for schema or project initialization alignment
- lightweight tests or fixtures
- `docs/**`
- `IMPLEMENTATION_LOG.md`

## Do Not

- Do not perform a large rewrite.
- Do not adapt extraction prompts yet beyond the minimum required for wiring.
- Do not redesign frontend category presentation yet.
- Do not perform storage migration or data-shape changes beyond registry plumbing.
- Do not remove `entity`, `concept`, or `source`.
- Do not add new dependencies unless truly necessary.

## Expected Output

Produce a small implementation that introduces:

- a registry or registry-like source of truth for category metadata
- compatibility mapping for original categories
- a way for chemical schema definitions to be represented without breaking default behavior
- minimal supporting docs for how the registry is used

## Acceptance Criteria

- Default behavior still supports original `llm_wiki` categories.
- Chemical schema support is introduced through configuration or registry logic.
- The implementation is minimal and localized.
- The change is ready for phase 4 prompt adaptation.
- TypeScript and related checks pass.

## Runnable Tests Or Smoke Checks

Run the smallest relevant validation set available, at minimum:

- `npm run typecheck`

If the touched code path affects build behavior, also run:

- `npm run build`

If you add or touch testable logic and mock tests are available, run:

- `npm run test:mocks`

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
