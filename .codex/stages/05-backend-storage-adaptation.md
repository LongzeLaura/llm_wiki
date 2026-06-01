# Stage 05: Backend Storage Adaptation

You are continuing `llm_wiki_chemical` from phase 5.

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

Also read the outputs of phases 2, 3, and 4 if they exist.

## Required Start Protocol

Before editing files:

1. Summarize the relevant existing code path for generated file routing, frontmatter typing, page merge behavior, and any storage assumptions tied to category names.
2. Propose a minimal change plan for phase 5 only.
3. Keep compatibility with current markdown-based storage as the default rule.

## Goal

Ensure chemical category results can be saved, read, and passed through the current data flow without breaking the original data structure or forcing a large migration.

## Allowed Modifications

You may modify only the smallest necessary storage and data-flow files, such as:

- `src/lib/ingest.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/page-merge.ts`
- `src/lib/sources-merge.ts`
- `src/lib/wiki-page-resolver.ts`
- `src/lib/wiki-page-delete.ts`
- `src-tauri/src/commands/project.rs` only if directory initialization must be aligned
- focused tests or fixtures
- `docs/**`
- `IMPLEMENTATION_LOG.md`

## Do Not

- Do not replace markdown storage with a new database schema.
- Do not perform a global migration that rewrites existing repositories.
- Do not introduce destructive rename or delete behavior.
- Do not redesign frontend UI in this stage.
- Do not remove original categories or their existing data paths.

## Expected Output

Produce a minimal storage adaptation that:

- allows chemical categories to survive save and reload paths
- preserves compatibility with existing frontmatter and directory assumptions where needed
- keeps original data structures readable
- documents any remaining limitations

## Acceptance Criteria

- Chemical-category pages or records can be routed and stored without breaking legacy behavior.
- Existing markdown and frontmatter patterns remain compatible.
- Changes are localized and small enough to review.
- Validation commands pass.

## Runnable Tests Or Smoke Checks

Run at minimum:

- `npm run typecheck`
- `npm run build`

If the touched logic is covered by existing tests or you add focused tests, also run:

- `npm run test:mocks`

## Required Final Updates

Before finishing, you must update:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

When updating `IMPLEMENTATION_LOG.md`, append only. Do not overwrite prior history.
