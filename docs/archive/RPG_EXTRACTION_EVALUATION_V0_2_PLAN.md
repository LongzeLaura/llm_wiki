# RPG Extraction Evaluation v0.2 Plan

## Purpose

This document records the post-v1 extraction-quality goals for llmWikiRPG v0.2 and the current state of those fixes after tasks 1 through 10.

It exists to separate two different claims clearly:

- v0.1 proved that RPG-mode routing and write strategies can work end-to-end in a controlled mocked flow.
- v0.2 is the follow-up pass that targets real extraction-quality failure modes found in representative RPG / interactive-fiction source material.

## What v0.1 proved, and what it did not

`docs/RPG_SMOKE_TEST_REPORT.md` and Stage 10 verified a mocked-LLM but real-filesystem smoke loop. That evidence is still useful, but its scope is narrow.

What v0.1 smoke coverage proved:

- RPG directories can be recognized and written.
- `current-scene` snapshots overwrite instead of appending.
- `events` pages append instead of overwriting.
- RPG page types can be surfaced to the frontend/runtime helpers.

What v0.1 smoke coverage did not prove:

- real-model semantic classification quality
- reliable `player/` versus `characters/` decisions
- reliable `events/` versus `plot-arcs/` decisions
- resistance to static-lore pollution in `current-scene/`
- resistance to trope/tag noise in `concepts/`
- field completeness and roleplay usability of generated character pages
- omission rates for `locations/` and `factions/`

## v0.2 target problems

The v0.2 task list focuses on the concrete misclassification patterns found during real extraction review:

1. `player/` versus `characters/` boundary confusion
2. missing object-type-first routing discipline
3. `events/` versus `plot-arcs/` boundary confusion
4. static encyclopedia or ending text polluting `current-scene/`
5. trope/tag/trivia noise leaking into `concepts/`
6. under-extraction of `locations/` and `factions/`
7. character pages that are too tag-like to support RPG portrayal
8. no lightweight validation/lint layer after generation
9. missing regression coverage tying the new rules together

## Resolution Matrix

| Problem | Primary mitigation in v0.2 | Current behavior | Residual gap |
| --- | --- | --- | --- |
| `player/` vs `characters/` confusion | Prompt/schema hard boundary plus object-type-first routing | Generation is instructed not to route canon/protagonist/POV characters into `player/` without explicit current-PC evidence | Validation warns on suspicious `wiki/player/` pages, but does not auto-rewrite them |
| Missing object-type-first routing | Analysis/generation prompts now require object classification before directory choice | Candidate objects are routed through explicit `object_type` categories first | Still prompt-driven, so real-model compliance is not guaranteed without later evaluation |
| `events/` vs `plot-arcs/` confusion | Prompt/schema discrete-event rules | Route/timeline/storyline-like pages are instructed to become `plot-arcs/` or be split | Validation warns on suspicious route-like `events/`, but does not auto-split them |
| Static-source `current-scene/` pollution | Prompt/schema boundary plus writer-side ordinary-ingest block | Ordinary ingest now rejects all `current-scene/` writes; static lore, ending summaries, encyclopedia-like inputs, and live-looking source text must route elsewhere unless handled by the RPG Play/Runtime apply flow | Some supporting diagnostics remain lightweight heuristics, but `current-scene` write access is no longer opened by ordinary source ingest |
| Trope/tag noise in `concepts/` | Prompt/schema boundary tightening | Character trope/trivia material should be merged back into character pages instead of `concepts/` | Validation warns on trope-like `concepts/`, but does not auto-merge them |
| Missing `locations/` / `factions/` | Secondary extraction pass in prompts/schema | Repeated or plot-relevant places and organizations should still be emitted, even as short source-limited stubs | Validation only raises review/warning items when omissions look likely |
| Character pages too shallow for RPG use | Expanded character schema | `characters/` pages are guided toward roleplay-ready sections such as speech style, boundaries, and multi-state snapshots | There is no completeness validator yet for missing roleplay sections |
| No post-generation guardrails | Lightweight extraction validation/lint | `llmwikirpg` `autoIngest` now emits warnings/review items for the major routing mistakes above | Lint remains lightweight, heuristic, and scoped to generated FILE blocks |
| No regression lock | Focused prompt/validation/scenario tests | The main v0.2 guardrails now have deterministic regression coverage | Coverage still runs against mocked generation rather than a real-model harness |

## Fix classes: auto-prevent vs detect-only

The v0.2 fixes are intentionally not all the same kind of enforcement.

### Auto-prevent or normalize

- Canonical `wiki/current-scene/scene_state.md` routing
- write-time rejection of all ordinary ingest `current-scene/` writes
- overwrite / append / merge storage behavior already established in v1

### Detect and warn, but do not auto-repair

- suspicious original-work character pages under `wiki/player/`
- player-facing wording in `wiki/characters/` when no current PC is established
- route/timeline-like `wiki/events/`
- trope/community-tag-like `wiki/concepts/`
- likely missing `wiki/locations/` or `wiki/factions/`

### Prompt/schema guidance only

- object-type-first reasoning
- richer roleplay-oriented `characters/` sections
- stronger second-pass extraction pressure for `locations/` and `factions/`

## Compatibility boundary

All v0.2 changes are intended to preserve the pre-existing default/legacy behavior:

- do not remove legacy `entities`, `concepts`, `sources`, or `queries`
- do not break non-RPG projects
- apply RPG-first routing/validation only when the project is in `llmwikirpg` mode or inferably RPG-shaped through the existing compatibility layer

## What still needs a later pass

v0.2 improves semantic guardrails, but it does not finish extraction evaluation work. The main remaining gaps are:

- a real-model evaluation harness on representative RPG inputs
- stronger source-type classification than the current heuristic checks
- optional auto-repair flows for some warning classes
- completeness checks for roleplay-ready character sections
- a standalone whole-project audit, not just inline ingest-time lint

## Current outcome

After tasks 1 through 10:

- the main real-extraction semantic boundary problems are now documented and guarded by prompt/schema updates
- the riskiest output classes also have lightweight ingest-time warnings
- those rules are covered by targeted regression tests
- the project still does not claim that real-model extraction quality is fully solved or fully benchmarked
