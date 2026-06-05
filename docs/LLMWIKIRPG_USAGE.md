# llmWikiRPG Usage

## Purpose

This document describes how to use the first-version llmWikiRPG flow implemented in Stages 03 through 11, and what boundaries still apply after Stage 12 cleanup.

## When To Use RPG Mode

Use RPG mode when the project is meant to maintain interactive-fiction or tabletop-RPG state in structured wiki directories instead of relying mainly on legacy `entities` and `concepts`.

The preferred activation method is an explicit text marker:

```md
wikiMode: rpg
```

Place that marker in project text such as `schema.md` or `purpose.md`.

If the marker is absent, the current implementation may still infer RPG mode from schema or directory shape, but explicit marking is recommended because it is more predictable and is the intended Stage 09 compatibility path.

## First-Version RPG Directories

The first-version migration targets these 11 directories:

- `wiki/sources/`
- `wiki/world/`
- `wiki/characters/`
- `wiki/player/`
- `wiki/locations/`
- `wiki/factions/`
- `wiki/items/`
- `wiki/plot-arcs/`
- `wiki/events/`
- `wiki/current-scene/`
- `wiki/relationships/`

## Category Boundaries

- `sources`: source summaries and provenance, not canonical world state.
- `world`: stable world facts, history, social background, and long-lived setting knowledge.
- `characters`: important NPCs and their durable plus currently relevant state.
- `player`: player-character state, capabilities, goals, inventory, and player-specific knowledge.
- `locations`: places, scene spaces, and location state.
- `factions`: organizations, camps, institutions, and group motives.
- `items`: notable equipment, artifacts, clues, and key objects.
- `plot-arcs`: unresolved threads, conflicts, foreshadowing, and possible development directions.
- `events`: confirmed past events only.
- `current-scene`: current snapshot only; writing it requires live input marked with `[RPG-LIVE]`.
- `relationships`: relationship changes, trust, conflict, dependence, and tension between actors.

## Update Semantics

- `wiki/current-scene/scene_state.md` is the canonical first-version current-scene file, is overwrite-oriented, and can only be generated from source input containing `[RPG-LIVE]`.
- `wiki/events/timeline.md` is append-oriented and keeps event history.
- `player`, `characters`, `relationships`, and `plot-arcs` use merge-style updates, with Stage 07 cleanup rules intended to replace stale dynamic sections instead of letting them linger.
- `world`, `locations`, `factions`, and `items` remain merge-oriented knowledge pages.
- `sources` stays compatibility-shaped and continues using legacy source-summary behavior in frontmatter/type handling.

## Recommended Source Types

The current implementation is suited for these source classes:

- world-setting text
- character sheets
- session or scene progression logs
- imported lore or scenario notes

## Practical Workflow

1. Mark the project with `wikiMode: rpg`.
2. Ingest setting files, character material, and static plot/canon text through the normal pipeline without `[RPG-LIVE]`.
3. For active play or turn-runtime input that should update `wiki/current-scene/scene_state.md`, include `[RPG-LIVE]` in the source text.
4. Confirm that outputs are routed into RPG directories rather than legacy `wiki/entities/` or `wiki/concepts/`.
5. Review the separation between `current-scene`, `events`, and `plot-arcs`.
6. Use chat/query flows against the project; Stage 08 and Stage 09 prioritize live RPG pages when the project is detected as RPG mode.

Example live input:

```md
[RPG-LIVE]
当前场景：玩家站在冬木市教会门口，准备进入。
```

Do not add `[RPG-LIVE]` when importing setting, character, plot-analysis, canon narrative, or dialogue-corpus files unless that source is truly the current active play turn.

## High-Value Review Checks

- Past facts belong in `events`, not `plot-arcs`.
- Future plans and unresolved hooks belong in `plot-arcs`, not `events`.
- Current state belongs in `current-scene`, not spread across event history.
- Player-specific state should stay in `player`, not be merged into general NPC pages.
- Relationship pages should capture interaction change and tension rather than duplicate full character biographies.

## Compatibility Notes

- Legacy `entities`, `concepts`, `sources`, and `queries` behavior is still present and must remain available.
- RPG-first prompt and retrieval behavior is gated by project mode detection rather than globally replacing the default wiki flow.
- Project skeleton creation is still legacy-oriented; RPG directories are created lazily when pages are first written.

## Current Limits

- No first-class persisted UI setting for wiki mode exists yet.
- No real-model extraction benchmark exists yet; current automated evidence is based on mocked-LLM smoke coverage plus prompt/schema review.
- No dedicated runtime context-pack compiler, contradiction engine, or deeper multi-page state reconciler exists yet.
- `style`, `rules`, and `runtime` remain documented design areas, not first-version implemented category targets.
