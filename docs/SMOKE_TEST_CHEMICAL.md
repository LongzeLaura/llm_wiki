# Chemical Smoke Test Record

Last updated: 2026-05-31

## Goal

Record a reproducible phase 7 smoke test for a chemistry-paper path covering:

- source import input
- ingest queue handoff
- chemical extraction routing
- markdown writeback
- frontend visibility expectations

## Inputs Used

Tracked manual sample:

- [docs/samples/zeolite-mto-smoke-paper.md](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/docs/samples/zeolite-mto-smoke-paper.md:1)

Tracked automated fixture:

- scenario `chemical-zeolite-mto-smoke` in [src/test-helpers/scenarios/ingest-scenarios.ts](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/test-helpers/scenarios/ingest-scenarios.ts:271)

The sample paper is a small methanol-to-olefins note covering:

- H-ZSM-5 / MFI / Bronsted acid sites
- surface methoxy formation
- dual-cycle mechanism language
- 13C isotope-labeling evidence
- DFT barrier comparison

## Expected Chemical Outputs

The automated fixture is designed to write these pages:

- `wiki/catalytic-systems/h-zsm-5-mfi-mto.md`
- `wiki/elementary-processes/surface-methoxy-formation.md`
- `wiki/mechanistic-networks/dual-cycle-mto.md`
- `wiki/evidence-claims/isotope-labeling-retained-hydrocarbons.md`
- `wiki/sources/zeolite-mto-smoke-paper.md`
- `wiki/index.md`
- `wiki/log.md`
- `wiki/overview.md`

Those outputs intentionally include cross-links so the graph and tree surfaces can classify them by registered type after reload.

## Commands Attempted

Required checks run from the repository root:

```powershell
npm run typecheck
npm run build
npm run test:mocks -- src/lib/ingest.scenarios.test.ts
```

## Results

`npm run typecheck`

- Failed immediately: `'tsc' is not recognized as an internal or external command`

`npm run build`

- Failed because `npm run typecheck` failed first
- `vite` was not reached

`npm run test:mocks -- src/lib/ingest.scenarios.test.ts`

- Failed immediately: `'vitest' is not recognized as an internal or external command`

## Smoke-Test Outcome By Stage

Import

- Manual import sample prepared.
- Actual UI import was not executed in this workspace.
- Intended path remains [src/components/sources/sources-view.tsx](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/components/sources/sources-view.tsx:97) -> [src/lib/source-lifecycle.ts](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/lib/source-lifecycle.ts:138) -> [src/lib/ingest-queue.ts](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/lib/ingest-queue.ts:210).

Extraction

- A reproducible chemical fixture was added.
- Actual execution was blocked because local `vitest` and `tsc` binaries are unavailable.
- Intended runtime entry remains [src/lib/ingest.ts](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/lib/ingest.ts:424).

Save

- Expected written paths are encoded in the smoke fixture and align with chemical registry directories.
- Actual file writes were not executed in this workspace because the ingest scenario test could not run.

Display

- The expected output pages use registered chemical `type:` values and directory names consumed by:
  - [src/components/layout/knowledge-tree.tsx](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/components/layout/knowledge-tree.tsx:24)
  - [src/components/graph/graph-view.tsx](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/components/graph/graph-view.tsx:76)
  - [src/lib/wiki-graph.ts](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/src/lib/wiki-graph.ts:159)
- Actual UI verification was not executed because the workspace cannot currently build or launch the frontend.

## Reproduction Steps Once Tooling Is Restored

1. Install the local Node toolchain for the repo so `tsc`, `vite`, and `vitest` are available from npm scripts.
2. Run:

```powershell
npm run typecheck
npm run build
npm run test:mocks -- src/lib/ingest.scenarios.test.ts
```

3. Open the app, import [docs/samples/zeolite-mto-smoke-paper.md](/abs/path/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_chemical/docs/samples/zeolite-mto-smoke-paper.md:1) into a project whose `schema.md` contains the chemical profile markers used in the fixture.
4. Confirm that the written pages appear under chemical groups in the knowledge tree and as typed nodes in the graph.

## Current Limitation

This phase now has a small tracked chemical sample, a tracked ingest fixture, and a concrete rerun procedure.

The end-to-end smoke path was not executable in this workspace on 2026-05-31 because the repository does not currently have runnable local Node binaries for `tsc`, `vite`, and `vitest`.
