# Chemical Wiki Semantic Repair Plan

Last updated: 2026-06-01

## Purpose

This document is the repository-aligned execution draft for the next incremental follow-up after phases 0 through 8.

It does not restart category-registry work, prompt-profile adaptation, storage-path support, or frontend category presentation from scratch.

Instead, it targets the remaining semantic gap between:

- the already-implemented four-layer chemical category baseline
- and the stricter chemistry-specific extraction behavior we want from generated wiki pages

## Confirmed Current Baseline

As of 2026-06-01, the repository already contains the following completed baseline work:

- phase 0 read-only architecture and pipeline analysis
- phase 1 chemical ontology definition
- phase 2 registry design
- phase 3 runtime category registry implementation
- phase 4 prompt-profile adaptation
- phase 5 storage and frontmatter normalization
- phase 6 frontend category presentation adaptation
- phase 7 tracked chemical smoke fixture and sample
- phase 8 cleanup and review pass
- explicit persisted project mode support for new projects

This means the next task is not "add chemical mode" in general.

The next task is a focused semantic repair pass on top of the existing chemical baseline.

## Verified Existing Code Paths

The following runtime paths were rechecked and should be treated as the active baseline for this repair pass:

### Project mode and template bootstrap

- `src/components/project/create-project-dialog.tsx`
- `src/commands/fs.ts`
- `src/lib/project-identity.ts`
- `src/lib/project-mode.ts`
- `src/lib/templates.ts`
- `src-tauri/src/commands/project.rs`

Current behavior:

- new projects explicitly choose `default` or `chemical`
- mode is persisted in `.llm-wiki/project.json`
- chemical mode already injects chemical schema text and chemical wiki directories at the frontend template layer
- Rust bootstrap still creates a legacy-first starter structure before the frontend template content is written

### Category registry, type inference, and rendering

- `src/lib/category-registry.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`
- `src/components/layout/knowledge-tree.tsx`
- `src/components/graph/graph-view.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/layout/activity-panel.tsx`

Current behavior:

- chemical categories are first-class registry entries
- chemical directories are recognized at runtime
- tree, graph, badges, and activity rows already render chemical categories

### Ingest, prompt routing, and write path

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/page-merge.ts`
- `src/lib/sources-merge.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`

Current behavior:

- ingest prompt framing already switches between legacy and chemical mode
- chemical mode already prefers `catalytic_system`, `elementary_process`, `mechanistic_network`, and `evidence_claim`
- save and merge paths already normalize registered chemical `type:` values
- existing smoke fixtures already verify category routing and chemical output directories

## Confirmed Gaps To Repair

The remaining problems are narrower and more semantic than the earlier phase documents assumed.

### Gap 1: four-layer pages do not yet have a strict minimum semantic field contract

The repository currently recognizes chemical page types, but it does not yet enforce a dedicated minimum field set for:

- `catalytic_system`
- `elementary_process`
- `mechanistic_network`
- `evidence_claim`

Most current examples still rely on generic frontmatter such as:

- `type`
- `title`
- `tags`
- `related`
- `sources`

### Gap 2: chemical prompts are profile-aware but not strict enough

`src/lib/ingest.ts` already knows how to speak in the four-layer ontology, but it does not yet strongly enforce:

- anti-misclassification rules
- required semantic fields
- explicit `unknown` or `not_specified` placeholders
- stronger claim-centered evidence output

### Gap 3: there is no dedicated chemical validator or dry-run repair tool

The repository currently has smoke fixtures and tests, but it does not yet have a focused tool that can:

- inspect generated chemical wiki pages
- report missing required semantic fields
- flag likely misclassified pages
- summarize missing cross-layer links
- produce dry-run repair suggestions without rewriting the wiki by default

### Gap 4: the existing smoke fixture validates routing more than semantic completeness

The current tracked chemistry fixture proves that the four categories can be routed and written, but it does not yet prove that:

- `catalytic_system` pages carry system-level descriptors rather than loose species summaries
- `elementary_process` pages encode process type, transport vs chemistry role, and location context
- `mechanistic_network` pages expose nodes, edges, pathway competition, and control-step fields
- `evidence_claim` pages are consistently claim-centered with normalized relation types

## Scope For This Repair Pass

This repair pass should stay incremental and reviewable.

### Allowed modification areas

- `src/lib/ingest.ts`
- small new config or helper files for chemical field definitions or validation
- focused tests under `src/lib/*.test.ts` or `src/test-helpers/**`
- a new validation or dry-run repair script under `scripts/`
- chemistry-specific documentation under `docs/`
- `IMPLEMENTATION_LOG.md`

### Allowed only if directly required

- `src/lib/templates.ts`
- `src/lib/project-mode.ts`
- `src-tauri/src/commands/project.rs`
- tiny UI copy or display adjustments if semantic fields need to remain visible and understandable

### Explicit non-goals

- do not redesign the category registry
- do not redo phase 3 through phase 8
- do not replace markdown storage
- do not delete legacy `entity`, `concept`, or `source`
- do not bulk rewrite existing wiki files
- do not perform a broad frontend rewrite

## Proposed Execution Order

### Step 1: define the semantic repair target clearly

Add a chemistry-specific minimum field contract for the four chemical page types.

Prefer one lightweight source of truth that can be reused by:

- prompt generation
- validation
- tests
- future repair tooling

### Step 2: tighten chemical prompt instructions

Update `src/lib/ingest.ts` so chemical-mode prompts explicitly enforce:

- `catalytic_system` pages as system-level descriptors rather than free-floating species pages
- `elementary_process` pages as step-level or transport-level events with normalized fields
- `mechanistic_network` pages as network-structured outputs, not only prose summaries
- `evidence_claim` pages as claim-evidence-relation outputs with normalized relation types

Also require explicit fallback values such as `unknown`, `not_specified`, or empty arrays where appropriate instead of silently omitting required fields.

### Step 3: add minimal post-processing or normalization only where necessary

If prompt hardening alone is insufficient, add a narrow post-processing layer that:

- fills missing required fields with safe placeholder values
- normalizes allowed enumerations
- does not alter legacy mode behavior

Do not introduce a large new storage abstraction for this step.

### Step 4: add a dedicated chemical validator

Add a read-only validation command or script that:

- scans `wiki/`
- identifies chemical pages by registry type or directory
- checks required semantic fields
- flags likely misclassification patterns
- reports missing cross-layer links
- writes a report file under `docs/`

The default mode must remain read-only.

### Step 5: add a dry-run repair suggestion tool if validation findings need one

If useful, add a dry-run repair helper that suggests:

- suspected `catalytic_system` pages that are really species-only or intermediate-only pages
- `elementary_process` pages missing `process_type` or `location_context`
- `mechanistic_network` pages missing `nodes` or `edges`
- `evidence_claim` pages missing `claim`, `evidence`, or `relation_type`

Actual file changes must require an explicit write flag.

### Step 6: strengthen the tracked chemistry smoke path

Update or extend the existing chemical smoke fixture so it checks semantic completeness in addition to routing.

Prefer building on:

- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `docs/SMOKE_TEST_CHEMICAL.md`

## Validation Commands

The previous "toolchain unavailable" assumption is no longer accurate for this workspace.

As of 2026-06-01, these commands were confirmed to run successfully from the repository root when invoked through `cmd /c`:

```powershell
cmd /c npm run typecheck
cmd /c npm run build
cmd /c npm run test:mocks -- src/lib/ingest.prompt.test.ts
cmd /c npm run test:mocks -- src/lib/ingest.scenarios.test.ts
```

Important note:

- direct `npm ...` calls from PowerShell still hit the local `npm.ps1` execution-policy restriction
- use `cmd /c npm ...` or `npm.cmd ...` in this repository's execution notes

## Acceptance Criteria For This Repair Pass

This repair pass should be considered complete only if all of the following are true:

- the repository has one clear minimum semantic contract for the four chemical page types
- chemical prompts explicitly encode anti-misclassification and missing-field fallback rules
- a dedicated chemical validator exists and is runnable
- validator output is written to a documented report path
- the tracked chemical smoke path checks semantic completeness, not only category routing
- legacy mode behavior remains intact
- no bulk rewrite of existing wiki files is performed by default

## Risks

- prompt-only improvements may still leave edge cases that require light normalization
- existing sample pages and fixtures may need updates once stricter required fields are introduced
- Rust bootstrap remains legacy-first and may still deserve a later cleanup pass, but that should not expand the scope of this repair task
- manual UI verification of richer chemical fields may still be useful after validation logic is in place

## Recommended Next Task

Execute this plan as the next incremental follow-up phase after the current completed phase 8 baseline.

The working title should be:

- `Phase 9 - Chemical Semantic Repair`

That phase should explicitly treat the current repository state as:

- category support already implemented
- storage compatibility already implemented
- UI category presentation already implemented
- semantic enforcement and validation still pending
