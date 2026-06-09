# RPG Dynamic Update Strategy

Stage 07 output for clarifying and minimally enforcing RPG dynamic update boundaries.

## Scope

This stage only tightens dynamic update behavior for the first-version RPG directories already introduced in Stages 03 through 06.

It does not:

- redesign retrieval or runtime context assembly
- add new RPG directories outside the Stage 02 boundary
- delete legacy `entities`, `concepts`, or `sources` behavior
- perform project-wide refactors

## Recorded Difference From Earlier Documents

- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md` still uses examples such as `wiki/current-scene/main.md`.
- Actual Stage 06 code already normalized `current-scene` writes to `wiki/current-scene/scene_state.md`.
- Stage 07 follows the implemented path `wiki/current-scene/scene_state.md` to avoid widening the change scope.

## Core Rule

RPG wiki state is split into three different kinds of truth and they must not contaminate each other:

- `current-scene`: the latest immediate snapshot for the next turn only
- `events`: confirmed history of what already happened
- `plot-arcs`: unresolved structure, foreshadowing, conflicts, and possible future development

The rest of the dynamic directories must update around those boundaries rather than duplicating them.

## Directory Semantics

| Directory | Semantic role | Write mode | Stage 07 rule |
| -- | -- | -- | -- |
| `wiki/current-scene/` | Current turn snapshot | Runtime overwrite only | Keep only the latest scene state. Never accumulate prior scenes here. Ordinary ingest must not write this directory; the RPG Play/Runtime apply flow owns the overwrite path. |
| `wiki/events/` | Canonical happened history | Append | Only store already-happened events and consequences. Do not store next-step advice or future development sections here. |
| `wiki/player/` | Player state | Merge | Preserve stable profile, but rewrite volatile state sections from the latest turn instead of carrying stale status forward. |
| `wiki/characters/` | NPC and important character state | Merge | Preserve static profile, but rewrite volatile current-state sections from the latest turn. |
| `wiki/relationships/` | Relationship state and tension | Merge | Preserve long-lived relationship framing, but rewrite volatile trust/tension/current-state sections from the latest turn. |
| `wiki/plot-arcs/` | Story structure and unresolved threads | Merge | Preserve arc identity, but rewrite stage/open-question/future-direction sections from the latest turn. |
| `wiki/world/` | Stable setting | Cautious merge | Prefer long-lived facts; avoid treating transient scene state as world canon. |
| `wiki/locations/` `wiki/factions/` `wiki/items/` | Entity pages with some dynamic state | Merge | Keep entity identity stable; move scene-history details to `events` instead of accumulating transcript-like state. |
| `wiki/sources/` | Provenance and source summaries | Append/add | Track where information came from, not the canonical live scene state. |

## Cross-Directory Boundaries

### `current-scene` vs `events`

- `current-scene` answers: what is true right now for the next turn
- `events` answers: what has already happened
- If the scene changes, `current-scene` is replaced
- If the change becomes historical fact, it is appended to `events`
- Ordinary ingest never opens `current-scene`; session/current-scene wording should be routed to `events`, `plot-arcs`, `relationships`, `player`, or source notes unless it arrives through the RPG Play/Runtime apply path.

### `events` vs `plot-arcs`

- `events` is for confirmed history
- `plot-arcs` is for unresolved conflict, foreshadowing, open questions, constraints, and likely development
- “possible next move”, “future development”, and similar planning/advice content belongs in `plot-arcs`, not `events`

### `characters` / `player` / `relationships`

- Character and player pages keep identity plus meaningful state
- Relationship pages keep trust, tension, conflict, and dependency state between parties
- Event transcript details belong in `events`
- Short-lived scene details belong in `current-scene`

## Minimal Enforcement Added In Stage 07

Stage 07 adds only small writer-boundary rules:

1. Prompt constraint
   - Generation guidance now explicitly tells the model to fully rewrite dynamic state sections for `player`, `characters`, `relationships`, and `plot-arcs`.
   - Generation guidance now explicitly forbids “next steps” / “future development” style sections inside `events`.

2. Event pollution guard
   - Writes to `wiki/events/` are skipped when the generated page contains obvious future-planning section headings such as “Possible Directions”, “Next Steps”, or equivalent headings.
   - These sections should instead be emitted to `wiki/plot-arcs/`.

3. Current-scene ordinary-ingest block
   - Writes to `wiki/current-scene/` are skipped in ordinary ingest regardless of source wording.
   - `current-scene` is a runtime-owned snapshot maintained by the RPG Play/Runtime apply path, not by source ingest.
   - Static-source blocked markers are still kept so warnings can explain when a rejected source looks like encyclopedia, lore, route summary, ending, or epilogue material.

4. Stale-state cleanup before merge
   - Before merge-based updates of `player`, `characters`, `relationships`, and `plot-arcs`, designated volatile sections are removed from the existing on-disk page.
   - This lets the new turn fully replace those dynamic sections instead of letting stale state survive through generic merge behavior.

## Volatile Sections Rewritten By Latest Turn

Stage 07 treats the following section families as replaceable dynamic state:

- `player`: current state, inventory/resources, current goals, known information, promises, consequences
- `characters`: current state, current goal, player-facing attitude, recent changes, active hooks
- `relationships`: current relationship state, trust/tension/conflict/dependency state, short-term direction
- `plot-arcs`: current stage, unresolved questions, active conflicts, next developments, future directions

The exact implementation is intentionally heading-based and minimal. It is not a full semantic diff engine.

## Non-Goals Left For Later Stages

- retrieval priority for `current-scene`, `player`, style/rules, and recent events
- runtime context-pack compilation
- stronger contradiction resolution across multiple dynamic pages
- automatic migration of old page layouts with arbitrary heading schemes
- UI-level highlighting of dynamic directories

## Result

After Stage 07, the writer path has a clearer contract:

- `current-scene` stays a single latest snapshot
- ordinary ingest no longer writes `current-scene`; runtime apply remains the dedicated overwrite path
- `events` stays history-oriented
- `plot-arcs` stays future- and structure-oriented
- merge-based dynamic pages no longer keep stale “current state” sections by default
