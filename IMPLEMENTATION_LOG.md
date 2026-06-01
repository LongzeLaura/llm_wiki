# Implementation Log

## Current Goal

Build `llm_wiki_chemical` by adapting the original llm_wiki extraction/category system to support chemical knowledge categories.

## Completed

- [ ] Architecture overview generated
- [ ] Extraction pipeline mapped
- [x] Chemical ontology documented
- [ ] Category registry designed
- [ ] Backend extraction prompt adapted
- [ ] Frontend category UI adapted
- [ ] Existing project behavior preserved
- [ ] Smoke test completed

## Decisions

### Decision 001: Preserve original categories initially

We will not immediately delete concept/entity/source. Instead, we will introduce chemical categories through a configurable schema or registry.

Reason:
This reduces risk and makes it easier to compare original and chemical behavior.

## Current Open Questions

- Where should chemical category definitions live?
- Should chemical mode be project-level or global?
- How should existing extracted data be migrated?

## Next Recommended Task

Ask Codex to locate all files related to category definition, extraction prompt construction, and category rendering.

## Phase 1 Record

### What Changed

Phase 1 added the authoritative chemical ontology document for `llm_wiki_chemical`.

The new document defines a four-layer chemistry-native classification system:

- `Catalytic System Layer`
- `Elementary Process Layer`
- `Mechanistic Network Layer`
- `Evidence and Validation Layer`

It also records:

- recommended extraction targets for each layer
- recommended fields and field semantics
- mapping from existing `entity` / `concept` / `source` semantics into the four-layer ontology
- representative extraction examples
- boundary rules for ambiguous cases
- incremental implementation guidance for later phases

### Why It Changed

The current codebase still centers extraction and rendering around generic categories such as `entity`, `concept`, and `source`. That taxonomy is not expressive enough for zeolite catalysis and reaction-mechanism literature.

Phase 1 therefore establishes the target ontology before any prompt, schema, storage, or UI changes are made. This keeps later engineering work incremental and reviewable.

### Files Modified

- `docs/CHEMICAL_ONTOLOGY.md` (new)
- `IMPLEMENTATION_LOG.md` (updated)

### Impact On Later Phases

- Later schema and registry work should treat the four-layer ontology as the target semantic model.
- Existing generic categories should be mapped into the ontology rather than immediately removed.
- Prompt adaptation should move from `entity/concept` framing toward four-layer chemical extraction.
- Frontend category presentation should eventually become registry-driven so that chemical layer labels, colors, and ordering are configurable.
- Evidence handling should move toward claim-centered traceability with `source_sentence`, `source_paper`, and optional figure/table references.

### Remaining Risks

- The runtime still contains many hardcoded assumptions around `wiki/entities`, `wiki/concepts`, and `wiki/sources`.
- Deduplication, resolver, delete, and chat-reference flows may require special handling once chemical layer directories become first-class.
- Existing markdown storage conventions do not yet explicitly encode `layer`, `claim_type`, or evidence-target semantics.

### Next Recommended Task

Design a minimal `chemical category registry` and schema-mapping layer that:

- preserves current runtime behavior
- maps existing generic types to the four-layer ontology
- defines future chemical directory names, labels, and type metadata
- gives later prompt and frontend changes a single source of truth

## Automation Scaffold Record

### What Changed

Created a phase-2-and-beyond Codex execution scaffold without modifying business code.

Added:

- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `.codex/stages/02-category-registry-design.md`
- `.codex/stages/03-category-registry-implementation.md`
- `.codex/stages/04-extraction-prompt-adaptation.md`
- `.codex/stages/05-backend-storage-adaptation.md`
- `.codex/stages/06-frontend-category-ui.md`
- `.codex/stages/07-smoke-test-chemical-papers.md`
- `.codex/stages/08-cleanup-and-review.md`
- `scripts/run-codex-stages.ps1`

### Why It Changed

The project had completed phase 0 and phase 1 documentation, but it did not yet have a durable execution framework for running later Codex stages in short, isolated contexts.

This scaffold makes the next phases easier to execute incrementally while preserving the original constraints:

- do not rerun phase 0
- do not rerun phase 1
- do not overwrite existing documents
- do not modify business code in the scaffold step
- do not rely on dangerous full-access execution

### Files Modified

- `docs/ROADMAP.md` (new)
- `docs/CURRENT_STATE.md` (new)
- `docs/TASK_QUEUE.md` (new)
- `.codex/stages/02-category-registry-design.md` (new)
- `.codex/stages/03-category-registry-implementation.md` (new)
- `.codex/stages/04-extraction-prompt-adaptation.md` (new)
- `.codex/stages/05-backend-storage-adaptation.md` (new)
- `.codex/stages/06-frontend-category-ui.md` (new)
- `.codex/stages/07-smoke-test-chemical-papers.md` (new)
- `.codex/stages/08-cleanup-and-review.md` (new)
- `scripts/run-codex-stages.ps1` (new)
- `IMPLEMENTATION_LOG.md` (appended)

### Remaining Risks

- The stage prompts still depend on disciplined execution in later runs; each phase must keep strict scope control.
- Later phases may reveal a small number of additional files that should be added to allowed scopes.
- Full end-to-end smoke testing may still depend on local environment constraints and available chemistry Markdown inputs.

### Next Recommended Task

Run `.codex/stages/02-category-registry-design.md` first, review the design output manually, and only then continue to phase 3 implementation.

## Stage Runner Range Update

### What Changed

Updated `scripts/run-codex-stages.ps1` so it can run an inclusive stage range with:

- `-From <stage>`
- `-Until <stage>`

The script now supports cases like:

- `-From 02 -Until 02` to run only stage 02 and stop automatically after that stage
- `-From 03 -Until 05` to run stages 03 through 05
- `-From 02` to keep the previous default behavior of running from stage 02 onward

Also added validation for:

- two-digit stage ids
- invalid ranges where `From > Until`

### Why It Changed

The original stage runner only supported a starting stage and always continued through all later stages.

That made it awkward to run or rerun exactly one stage, or to stop after a bounded range for manual review. The new range parameters keep the script incremental and review-friendly.

### Files Modified

- `scripts/run-codex-stages.ps1`
- `IMPLEMENTATION_LOG.md`

### Remaining Risks

- The script still assumes stage filenames begin with a two-digit numeric prefix.
- It does not yet support non-contiguous custom stage lists, only inclusive ranges.

### Next Recommended Task

Use `scripts/run-codex-stages.ps1 -From 02 -Until 02` when you want to run only phase 2 and pause for manual review before continuing.

## Local Validation Environment Recovery

### What Changed

Restored the local Node validation environment and fixed two test-only reliability issues uncovered once the full mock test suite could run again.

Environment work:

- installed workspace-local npm dependencies with a repo-local cache so validation no longer depends on the locked global npm cache

Code and test fixes:

- switched ingest queue persistence from `writeFile` to `writeFileAtomic`
- added an atomic write implementation to the real-filesystem test adapter
- updated ingest queue unit tests to mock and assert `writeFileAtomic`
- normalized one Windows-sensitive source-summary path assertion to the project's forward-slash path convention

### Why It Changed

After dependencies were restored, `npm run build` started passing, but `npm run test:mocks` still exposed two concrete failures:

- queue persistence could read a partially-written JSON file during integration tests
- one source-summary path assertion compared a backslash path with the runtime's normalized forward-slash path

The fixes keep runtime behavior minimal and align queue persistence with the existing atomic-write pattern already used elsewhere in the project.

### Files Modified

- `src/lib/ingest-queue.ts`
- `src/test-helpers/fs-temp.ts`
- `src/lib/ingest-queue.test.ts`
- `src/lib/ingest-source-path-collision.test.ts`
- `IMPLEMENTATION_LOG.md`

### Remaining Risks

- The broader test suite beyond `test:mocks` has not yet been run in this pass.
- Vite build warnings about large chunks and dynamic import handling remain non-blocking follow-up items.

### Next Recommended Task

Run the next-lightest available test targets beyond `test:mocks`, then decide whether any phase-7 smoke scenarios should be promoted into a more explicit repeatable local validation command.

## Stage Runner Compatibility Fix

### What Changed

Adjusted `scripts/run-codex-stages.ps1` so its internal `codex exec` invocation only uses options supported by the current CLI.

Removed the unsupported `--ask-for-approval on-request` argument from the non-interactive stage-runner call.

### Why It Changed

When the stage runner was executed, phase 02 failed before doing any project work because the current `codex exec` command rejected `--ask-for-approval` as an unexpected argument.

This fix restores actual script executability without changing the stage selection behavior.

### Files Modified

- `scripts/run-codex-stages.ps1`
- `IMPLEMENTATION_LOG.md`

### Remaining Risks

- The script still depends on the installed Codex CLI behavior and may need future small compatibility adjustments if the CLI changes again.

### Next Recommended Task

Rerun `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 02 -Until 02` to confirm phase 02 now starts correctly and stops after that single stage.

## Stage Runner Sandbox Ordering Fix

### What Changed

Adjusted `scripts/run-codex-stages.ps1` so `codex exec` receives its options before the stdin prompt marker `-`.

The runner now invokes the CLI in this order:

- `codex exec --cd <repo> --sandbox workspace-write -`

instead of placing `-` before the options.

### Why It Changed

The previous run showed `codex exec` starting with `sandbox: read-only` even though the script intended to request `workspace-write`.

Since stage 2 is documentation-writing work, the safer fix is to make the option ordering explicit before rerunning the stage.

### Files Modified

- `scripts/run-codex-stages.ps1`
- `IMPLEMENTATION_LOG.md`

### Remaining Risks

- The stage runner still depends on the installed Codex CLI honoring the requested sandbox mode.

### Next Recommended Task

Rerun stage 02 with `powershell -ExecutionPolicy Bypass -File scripts/run-codex-stages.ps1 -From 02 -Until 02` and confirm the session now starts with `sandbox: workspace-write`.

## Phase 2 Record: Category Registry Design

### What Changed

Completed the phase 2 design-only registry artifact for chemical categories.

Added:

- `docs/CATEGORY_REGISTRY_DESIGN.md`

Updated:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The new design document defines:

- a `CategoryDefinition` model
- a `CategoryProfile` model
- canonical compatibility categories for `entity`, `concept`, and `source`
- canonical chemical categories for `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim`
- recommended `legacy-default` and `chemical-default` profiles
- directory mappings, ontology mappings, later-phase consumption guidance, and migration notes

### Why It Changed

The codebase currently spreads category behavior across templates, ingest prompts, path inference, and frontend rendering. That makes chemical adaptation risky unless later phases can depend on one authoritative registry.

This phase establishes that registry design before runtime implementation so phase 3 can make minimal, reviewable code changes instead of a larger taxonomy rewrite.

### Files Modified

- `docs/CATEGORY_REGISTRY_DESIGN.md` (new)
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Remaining Risks

- The current runtime still has special-case behavior for `source` pages and `wiki/sources/`.
- The proposed `chemical-default` profile is documented, but no project-level selection mechanism exists yet.
- `entity` and `concept` remain semantically ambiguous compatibility categories until prompt and storage phases are implemented.
- Several frontend surfaces still have separate hardcoded type maps that phase 3 or phase 6 must consolidate carefully.

### Next Recommended Task

Implement phase 3 with a small runtime registry module and wire it into:

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`

while keeping the default runtime profile behavior compatible with the original `llm_wiki`.

## Phase 3 Record: Category Registry Implementation

### What Changed

Implemented a small runtime category registry layer and wired it into the existing wiki type helpers.

Added:

- `src/lib/category-registry.ts`
- `src/lib/category-registry.test.ts`
- `docs/CATEGORY_REGISTRY_USAGE.md`

Updated:

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/wiki-type-style.ts`
- `src/lib/wiki-type-style.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The runtime registry now defines:

- canonical category metadata for legacy, chemical, and auxiliary page types
- `legacy-default` and `chemical-default` profiles
- directory lookups for both legacy and chemical wiki folders
- compatibility preservation for `entity`, `concept`, and `source`

Phase 3 also keeps the default generation type list aligned with the legacy profile so prompt behavior is unchanged ahead of phase 4.

### Why It Changed

Phase 2 established the registry design, but runtime code still spread category assumptions across multiple hardcoded maps.

This phase introduces one small TypeScript registry as a compatibility-first source of truth so later prompt, storage, and UI work can target a stable metadata layer instead of duplicating category rules again.

### Files Modified

- `src/lib/category-registry.ts` (new)
- `src/lib/category-registry.test.ts` (new)
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/wiki-type-style.ts`
- `src/lib/wiki-type-style.test.ts`
- `docs/CATEGORY_REGISTRY_USAGE.md` (new)
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run test:mocks`

Result:

- both commands failed in the local environment because the workspace does not currently have local Node tool binaries such as `node_modules/.bin/tsc` and `node_modules/.bin/vitest`

Not run for the same reason:

- `npm run build`

### Remaining Risks

- Prompt construction in `src/lib/ingest.ts` still uses legacy-first category framing and has not yet been switched to profile-aware routing.
- Rust project bootstrap still creates only legacy wiki directories, so chemical directories are currently runtime-recognized rather than template-initialized.
- Frontend tree and graph presentation still contain some hardcoded type presentation that phase 6 should consolidate onto registry metadata.
- Validation is incomplete in this session because the local Node toolchain required by the repository scripts is not installed.

### Next Recommended Task

Implement phase 4 prompt adaptation so `src/lib/ingest.ts` can read the registry and choose between:

- legacy extraction framing for `legacy-default`
- chemical four-layer extraction framing for `chemical-default`

without changing source-summary compatibility behavior.

## Phase 4 Record: Extraction Prompt Adaptation

### What Changed

Adapted the ingest prompt builders to switch between legacy and chemical extraction framing without changing the downstream FILE/REVIEW parsing contract.

Updated:

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The prompt layer now:

- resolves a prompt profile from schema and registry cues
- keeps legacy behavior as the default fallback
- uses the four-layer chemical ontology in stage 1 analysis prompts when the schema indicates chemical mode
- uses the same chemical framing for long-source chunk analysis prompts
- adapts stage 2 generation instructions and known type lists so chemical mode can target `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim`
- preserves source-summary compatibility under `wiki/sources/` and does not change FILE/REVIEW block formatting

### Why It Changed

Phase 3 introduced the registry and chemical profiles, but prompt construction still assumed `entity` and `concept` everywhere. That meant chemical projects had registry metadata available at runtime without any way for extraction prompts to use it.

This phase makes prompt construction profile-aware with a localized change in `ingest.ts`, which keeps the migration incremental and reviewable while preserving legacy behavior when chemical mode is not indicated.

### Files Modified

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run test:mocks -- src/lib/ingest.prompt.test.ts`
- `npm run build`

Result:

- all three commands failed in the local environment because the workspace does not currently have runnable local Node tool binaries such as `tsc`, `vitest`, and `vite`

### Remaining Risks

- Chemical prompt mode is currently inferred from schema text markers and chemical directory/category references rather than a dedicated persisted project setting.
- Storage, resolver, and delete flows still have legacy-first assumptions around paths such as `wiki/sources/`, `wiki/entities/`, and `wiki/concepts/`.
- Validation remains incomplete in this session because the local Node toolchain required by the repository scripts is not installed.

### Next Recommended Task

Implement phase 5 backend storage adaptation so chemical page types can move through write, resolve, and maintenance flows safely while keeping `source` summary compatibility intact.

## Phase 5 Record: Backend Storage Adaptation

### What Changed

Adapted the markdown storage path so registered chemical categories survive save, merge, and reload flows without changing the repository storage model.

Updated:

- `src/lib/category-registry.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/sources-merge.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest.ts`
- `src/lib/category-registry.test.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/sources-merge.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The storage layer now:

- resolves registered legacy and chemical type aliases such as display labels and directory-style names back to canonical ids
- normalizes registered `type:` frontmatter values during ingest writes so pages stored in chemical folders persist canonical values such as `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim`
- applies the same normalization after page merges so older non-canonical registered types are repaired the next time those pages are rewritten
- preserves custom schema-defined types by only canonicalizing registered categories
- keeps source-summary routing and compatibility behavior anchored to `wiki/sources/`

### Why It Changed

Phase 4 made chemical extraction prompts possible, but the storage path still trusted whatever registered type spelling the model emitted. That meant a page could be written into the correct chemical directory while carrying a non-canonical `type:` value that downstream readers would treat inconsistently after reload.

This phase fixes that at the write boundary instead of introducing a migration or a new storage layer. Existing markdown remains authoritative, custom schema-defined types remain untouched, and chemical registered categories now round-trip through the current save/read flow more safely.

### Files Modified

- `src/lib/category-registry.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/sources-merge.ts`
- `src/lib/page-merge.ts`
- `src/lib/ingest.ts`
- `src/lib/category-registry.test.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/lib/sources-merge.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`

Result:

- all three commands failed in the local environment because `node_modules` is absent, so the repository scripts cannot find local binaries such as `tsc`, `vite`, and `vitest`

### Remaining Risks

- Rust project bootstrap still initializes only the legacy default wiki directories and schema text, so new chemical directories are created lazily when pages are first written rather than at project creation time.
- Source summary routing and media ownership remain intentionally tied to `wiki/sources/`; this phase does not generalize provenance storage beyond that compatibility path.
- Existing already-written pages with non-canonical registered types are only repaired when they are read through alias-aware helpers or rewritten through the ingest save path; this phase does not run a global migration.
- Validation remains incomplete in this session because the required local Node toolchain has not been installed in the workspace.

### Next Recommended Task

Implement phase 6 frontend category UI adaptation so tree, graph, chips, and related displays present chemical registered categories consistently now that the backend storage path preserves them.

## Phase 6 Record: Frontend Category UI

### What Changed

Adapted the remaining category-presentation surfaces so registered chemical page types render through the shared registry-backed style layer instead of local hardcoded maps.

Updated:

- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`
- `src/lib/wiki-type-style.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The frontend now:

- uses `getWikiTypeStyle()` and `compareWikiTypeOrder()` to drive knowledge-tree group labels, icons, accent colors, ordering, and default expansion for both legacy and chemical core categories
- renders graph node colors from shared type styles for registered categories, while preserving hashed fallback colors for unknown custom types
- derives graph legend and filter labels from registry-backed type metadata when no translation key exists, which makes chemical categories appear with stable labels and ordering without a new hardcoded map
- uses shared type styles for cited-reference badges in chat so chemical references no longer fall back to generic source visuals
- uses shared type styles in the activity panel so chemical wiki writes show meaningful icons and labels instead of generic file icons

### Why It Changed

Phase 5 made chemical category ids survive storage and reload, but several frontend surfaces still had local legacy-only label, icon, color, and order maps.

This phase removes those duplicated display assumptions in the smallest possible way by routing the touched UI surfaces through the existing registry-aware style helper instead of introducing another frontend-only category layer.

### Files Modified

- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`
- `src/lib/wiki-type-style.test.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`

Result:

- all three commands failed in the local environment because local Node tool binaries are still unavailable, so commands cannot find `tsc`, `vite`, or `vitest`

Manual UI smoke steps:

- not run in this session because the workspace cannot currently build or launch the frontend without the missing local Node toolchain

### Remaining Risks

- Graph labels still rely on existing translation keys for legacy categories and registry-label fallback for chemical categories; a later i18n pass may want to add dedicated translated strings for the new chemical labels.
- The knowledge tree currently expands all registered core categories by default, which is registry-driven and useful for chemical mode, but future product review may still want project-profile-specific expansion behavior.
- Frontend validation remains incomplete in this session because the required local Node toolchain is not installed in the workspace.

### Next Recommended Task

Implement phase 7 smoke testing with representative chemical papers or Markdown sources so the project can verify:

- prompt routing into chemical categories
- persisted chemical page writes
- knowledge-tree and graph display of those pages
- any remaining end-to-end gaps before cleanup and review

## Phase 7 Record: Smoke Test Chemical Papers

### What Changed

Added a small, reproducible chemical-paper smoke-test fixture and a concise phase-7 report.

Updated:

- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `docs/samples/zeolite-mto-smoke-paper.md`
- `docs/SMOKE_TEST_CHEMICAL.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The new smoke artifacts now provide:

- a small tracked methanol-to-olefins markdown sample for manual import
- a tracked ingest scenario that targets the chemical prompt profile and emits:
  - `catalytic_system`
  - `elementary_process`
  - `mechanistic_network`
  - `evidence_claim`
  - `source`
  - updated `wiki/index.md`, `wiki/log.md`, and `wiki/overview.md`
- a reproducible report documenting:
  - which inputs were used
  - which commands were run
  - the expected chemical output files
  - the exact environment limitation encountered in this workspace

### Why It Changed

Phase 6 made chemical categories visible in the UI, but phase 7 still needed a concrete chemistry-paper path that a reviewer could rerun and inspect.

The smallest reviewable way to do that in the current repository was:

- add one realistic chemical ingest fixture to the existing scenario harness
- add one small tracked sample markdown paper for later manual import
- record the exact smoke-test commands and failure mode instead of claiming execution that did not happen

This keeps the change fixture-driven and documentation-first without refactoring ingest, queue, or UI code under the name of smoke testing.

### Files Modified

- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `docs/samples/zeolite-mto-smoke-paper.md`
- `docs/SMOKE_TEST_CHEMICAL.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run build`
- `npm run test:mocks -- src/lib/ingest.scenarios.test.ts`

Result:

- `npm run typecheck` failed because `tsc` is not available in the local environment
- `npm run build` failed because the typecheck step failed first
- `npm run test:mocks -- src/lib/ingest.scenarios.test.ts` failed because `vitest` is not available in the local environment

Recorded in the smoke report:

- `docs/SMOKE_TEST_CHEMICAL.md`

### Remaining Risks

- The new chemical smoke scenario is tracked and reproducible, but it was not executed in this workspace because the repository currently lacks runnable local Node binaries for `tsc`, `vite`, and `vitest`.
- Import, queue, write, and display behavior are documented through the existing code path and fixture expectations, but live UI verification of the chemical pages remains outstanding.
- Rust project bootstrap still creates legacy-first directories only, so manual smoke testing still depends on the runtime creating chemical directories lazily when pages are written.

### Next Recommended Task

Restore the local Node toolchain, rerun the commands in `docs/SMOKE_TEST_CHEMICAL.md`, verify the chemical pages in the knowledge tree and graph, and then continue to phase 8 cleanup/review with those results captured.

## Phase 8 Record: Cleanup And Review

### What Changed

Phase 8 made one small runtime cleanup and one documentation-alignment pass.

Updated runtime files:

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/components/chat/chat-message.tsx`

Updated docs:

- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The runtime cleanup added a shared registry-backed wiki-page lookup helper and switched chat cited-reference resolution plus rendered wiki-link existence checks to use it.

That means chat-side fallback lookup no longer stops at a legacy-only directory list and can now find pages written under registered chemical directories such as:

- `wiki/catalytic-systems/`
- `wiki/elementary-processes/`
- `wiki/mechanistic-networks/`
- `wiki/evidence-claims/`

Phase 8 also aligned roadmap/state/queue docs so they all describe phases 2 through 8 as completed work while still calling out the operational validation blocker.

### Why It Changed

Phases 3 through 6 moved runtime type inference, prompt routing, storage normalization, and UI styling onto the category registry, but one phase-6-touched UI surface still resolved chat citations through a repeated hardcoded legacy folder list.

That inconsistency was a good phase 8 target because it was:

- small
- low risk
- directly related to the category-registry migration
- easy to document clearly

The documentation updates were also necessary because `docs/ROADMAP.md` still marked phases 2 through 8 as planned even though the later phase records already existed in the repository.

### Files Modified

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-page-types.test.ts`
- `src/components/chat/chat-message.tsx`
- `docs/ROADMAP.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Attempted:

- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`

Result:

- all three commands still fail in this workspace because the repository does not currently have runnable local Node tool binaries such as `tsc`, `vite`, and `vitest`

### Remaining Risks

- Rust project bootstrap still initializes only the legacy default wiki directories and schema text.
- Some untouched surfaces still contain legacy-first assumptions, especially `src/components/review/review-view.tsx` and maintenance/dedup flows.
- Source summary routing remains intentionally anchored to `wiki/sources/` for compatibility; this phase did not generalize provenance storage.
- Validation remains incomplete in this session because the required local Node toolchain is still unavailable.

### Next Recommended Task

Restore the local Node toolchain, rerun:

- `npm run typecheck`
- `npm run build`
- `npm run test:mocks`

Then rerun the chemical smoke procedure in `docs/SMOKE_TEST_CHEMICAL.md` and inspect the remaining untouched legacy-first bootstrap and maintenance flows before broader rollout work.

## Project Mode Selection Record

### What Changed

Added an explicit project mode selection path for new projects and made ingest prompt routing prefer persisted project mode metadata over `schema.md` text inference.

Updated runtime files:

- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/lib/templates.ts`
- `src/lib/ingest.ts`
- `src/lib/project-identity.ts`
- `src/lib/project-mode.ts`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/project-mode.test.ts`
- `src/lib/project-identity.integration.test.ts`
- `IMPLEMENTATION_LOG.md`

The new project flow now:

- requires an explicit mode choice in the create-project dialog
- persists that choice into `<project>/.llm-wiki/project.json`
- initializes chemical-mode projects with chemical schema documentation plus chemical wiki directories
- keeps default-mode projects on the legacy `entity` / `concept` / `source` path

The ingest pipeline now:

- loads the persisted project mode from `.llm-wiki/project.json`
- routes analysis, generation, review-suggestion, and long-document chunk prompts by project mode first
- falls back to the old schema-marker inference only when opening a legacy project that has no saved mode yet

### Why It Changed

The previous chemical-mode behavior depended on editing `schema.md` so the model could infer that a project was chemical. That was useful as a temporary bridge, but it was not a reliable or reviewable system boundary.

This change makes project mode an explicit project-level setting while preserving backward compatibility for older projects that do not have mode metadata yet.

### Files Modified

- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/lib/templates.ts`
- `src/lib/ingest.ts`
- `src/lib/project-identity.ts`
- `src/lib/project-mode.ts`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/project-mode.test.ts`
- `src/lib/project-identity.integration.test.ts`
- `IMPLEMENTATION_LOG.md`

### Validation

Ran:

- `npm run test:mocks -- src/lib/project-mode.test.ts src/lib/project-identity.integration.test.ts src/lib/ingest.prompt.test.ts`
- `npm run typecheck`
- `npm run build`

Result:

- all three commands passed
- `npm run build` emitted existing non-blocking Vite chunk-size and ineffective-dynamic-import warnings

### Remaining Risks

- The Rust-side bootstrap command still writes a legacy-first starter `schema.md` / `wiki/index.md` before the frontend creation flow overwrites or extends the new-project content. Runtime behavior is correct because the persisted mode is written during the same create flow, but a future cleanup pass could move more of the mode-aware bootstrap into one place.
- Legacy interactive ingest paths outside `autoIngest()` still retain older schema-loading behavior and were not broadened in this incremental change because the current primary source-import flow already goes through the mode-aware auto-ingest pipeline.
- Existing projects remain compatibility-routed by schema fallback until they are explicitly assigned a mode; this preserves behavior but means the repository still has a mixed migration state.

### Next Recommended Task

Add a small project-inspection or settings surface that shows the current persisted project mode and allows explicitly upgrading legacy projects from schema-fallback mode to a saved mode without recreating the project.

## Semantic Repair Plan Alignment Record

### What Changed

Added a repository-aligned execution draft for the next incremental follow-up phase in:

- `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md`

Updated status documents:

- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `docs/ROADMAP.md`

The new plan explicitly treats the current repository state as:

- phases 0 through 8 already completed
- chemical category support already implemented
- storage compatibility already implemented
- frontend category presentation already implemented
- semantic enforcement, validator coverage, and dry-run repair tooling still pending

The alignment pass also corrected an outdated assumption in the docs: local validation is no longer blocked by missing Node binaries in this workspace. Instead, direct PowerShell `npm` calls currently fail because of the local `npm.ps1` execution-policy restriction, while `cmd /c npm ...` works.

### Why It Changed

The previously proposed repair task was too broad for the current codebase state. It mixed together work that the repository has already completed with work that is still genuinely missing.

That mismatch would have created a misleading execution plan and encouraged unnecessary rework across registry, storage, and UI surfaces that already have a solid incremental baseline.

This alignment pass narrows the next task to the actual remaining gap:

- stricter four-layer semantic field contracts
- stronger chemical prompt constraints
- dedicated chemical validation
- optional dry-run repair support
- smoke coverage for semantic completeness rather than only category routing

### Files Modified

- `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `docs/ROADMAP.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Ran from the repository root:

- `cmd /c npm run typecheck`
- `cmd /c npm run build`
- `cmd /c npm run test:mocks -- src/lib/ingest.prompt.test.ts`
- `cmd /c npm run test:mocks -- src/lib/ingest.scenarios.test.ts`

Result:

- all four commands passed
- `npm run build` emitted existing non-blocking Vite warnings about chunk size and ineffective dynamic imports

### Remaining Risks

- The semantic repair plan is now aligned with the repository, but the validator and dry-run repair tooling it calls for do not exist yet.
- The current chemical smoke fixture still proves category routing more strongly than semantic-field completeness.
- Rust bootstrap remains legacy-first even though the frontend project-creation flow now persists mode-aware schema content.
- Manual UI verification of richer chemical semantic fields is still outstanding.

### Next Recommended Task

Execute `docs/CHEMICAL_WIKI_SEMANTIC_REPAIR_PLAN.md` as the next incremental follow-up phase under a narrow scope such as:

- `Phase 9 - Chemical Semantic Repair`

## Phase 9 Record: Chemical Semantic Repair

### What Changed

Completed the narrow phase 9 semantic repair pass on top of the existing chemical category baseline.

Added:

- `src/lib/chemical-semantic-contract.json`
- `src/lib/chemical-semantic-contract.ts`
- `src/lib/chemical-semantic-contract.test.ts`
- `src/lib/chemical-semantic-validator.test.ts`
- `scripts/chemical-semantic-validator.mjs`

Updated:

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

The phase 9 change set now provides:

- one lightweight source of truth for the minimum semantic field contract of:
  - `catalytic_system`
  - `elementary_process`
  - `mechanistic_network`
  - `evidence_claim`
- stricter chemical prompt instructions that:
  - require the contract fields
  - state anti-misclassification rules
  - require exact fallback placeholders `unknown`, `not_specified`, or `[]`
- a write-boundary chemical-only normalization step that fills missing contract fields without changing legacy page behavior
- a dedicated validator script that scans `wiki/`, writes `docs/chemical-semantic-validation-report.md`, and supports dry-run repair suggestions via `--dry-run-repair`
- stronger chemical smoke coverage that runs the validator against the tracked chemical ingest scenario instead of only checking category routing

### Why It Changed

The repository already had chemical categories, registry-aware storage, and registry-aware UI behavior, but it still lacked semantic enforcement.

That meant chemical mode could route pages into the right folders while still leaving the four-layer pages underspecified, inconsistently structured, or missing the chemistry-specific fields needed for later synthesis and repair work.

Phase 9 closes that narrower gap without redoing phases 0 through 8 and without deleting legacy `entity`, `concept`, or `source`.

### Relevant Existing Code Path Rechecked

The effective runtime path for this work remained:

- `src/components/sources/sources-view.tsx`
- `src/lib/source-lifecycle.ts`
- `src/lib/ingest-queue.ts`
- `src/lib/ingest.ts`

Within `ingest.ts`, the important live control points were:

- `resolveIngestPromptProfile()` for legacy vs chemical routing
- `buildAnalysisPrompt()` and `buildGenerationPrompt()` for prompt framing
- `writeFileBlocks()` for save-time normalization and merge entry
- the legacy interactive FILE-block write path later in the same file, which also needed the same chemical-only normalization

### Files Modified

- `src/lib/chemical-semantic-contract.json`
- `src/lib/chemical-semantic-contract.ts`
- `src/lib/chemical-semantic-contract.test.ts`
- `src/lib/chemical-semantic-validator.test.ts`
- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `scripts/chemical-semantic-validator.mjs`
- `docs/CURRENT_STATE.md`
- `docs/TASK_QUEUE.md`
- `IMPLEMENTATION_LOG.md`

### Validation

Ran from the repository root:

- `cmd /c npm run test:mocks -- src/lib/chemical-semantic-contract.test.ts src/lib/ingest.prompt.test.ts src/lib/chemical-semantic-validator.test.ts src/lib/ingest.scenarios.test.ts`
- `cmd /c npm run typecheck`
- `cmd /c npm run build`

Result:

- all three commands passed
- `npm run build` emitted the existing non-blocking Vite warnings about chunk size and ineffective dynamic imports

### Remaining Risks

- The validator currently focuses on minimum field presence, placeholder detection, enum normalization, missing `related` links, and a few conservative misclassification heuristics; later passes may still want richer chemistry-specific checks.
- Rust-side bootstrap is still legacy-first, so project creation remains mode-correct only because the frontend template layer overwrites and extends the starter content.
- Manual in-app verification of the richer chemical semantic fields in tree/graph/review surfaces is still outstanding.
- Untouched maintenance flows such as dedup and review routing may still contain legacy-only assumptions that phase 9 intentionally did not widen into scope.

### Next Recommended Task

Use the completed phase 9 baseline to inspect the remaining untouched legacy-first surfaces before broader chemical-mode rollout:

- `src-tauri/src/commands/project.rs`
- `src/components/review/review-view.tsx`
- `src/lib/dedup.ts`
- `src/lib/dedup-runner.ts`
