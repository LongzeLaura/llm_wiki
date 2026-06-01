# Stage 06: Frontend Category UI

You are continuing `llm_wiki_chemical` from phase 6.

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

Also read the outputs of phases 2 through 5 if they exist.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for knowledge-tree labels, type styles, graph colors, and any other category-display logic.
2. Propose a minimal change plan for phase 6 only.
3. Preserve the existing UI behavior for legacy categories while extending support for chemical categories.

## Goal

Adapt the frontend so chemical categories such as catalytic system, elementary process, mechanistic network, and evidence claim can be displayed cleanly.

## Allowed Modifications

You may modify only the smallest necessary frontend presentation files, such as:

- `src/components/layout/**`
- `src/components/graph/**`
- `src/components/editor/**`
- `src/components/chat/**` only if category labels or badges require updates
- `src/lib/wiki-type-style.ts`
- registry-related display helpers
- focused tests or fixtures
- `docs/**`
- `IMPLEMENTATION_LOG.md`

## Do Not

- Do not perform a broad UI redesign unrelated to category presentation.
- Do not rewrite backend storage or prompt logic unless a tiny blocking fix is required and documented.
- Do not remove support for original category displays.
- Do not add dependencies unless truly necessary.

## Expected Output

Produce a minimal UI adaptation that:

- renders chemical categories with sensible labels
- supports stable ordering where appropriate
- gives chemical categories usable colors or icons
- keeps legacy categories readable
- documents any remaining display gaps

## Acceptance Criteria

- Chemical categories appear correctly in the main category-related UI surfaces that were touched.
- Legacy categories still render correctly.
- The UI changes are registry-aware or config-aware rather than another hardcoded layer.
- Build validation passes.

## Runnable Tests Or Smoke Checks

Run at minimum:

- `npm run typecheck`
- `npm run build`

If mockable UI logic is covered or new focused tests are added, also run:

- `npm run test:mocks`

If a local preview path is practical, document the manual UI smoke steps you used.

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
