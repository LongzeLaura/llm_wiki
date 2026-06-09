# llmWikiRPG Usage

## Purpose

This document describes how to use the first-version llmWikiRPG flow and the current runtime contract through Stage 6.12.

## When To Use RPG Mode

Use RPG mode when the project is meant to maintain interactive-fiction or tabletop-RPG state in structured wiki directories instead of relying mainly on legacy `entities` and `concepts`.

The preferred activation method is an explicit text marker:

```md
wikiMode: llmwikirpg
```

Place that marker in project text such as `schema.md` or `purpose.md`.

Legacy/default projects are no longer the product path. Existing projects should carry explicit `llmwikirpg` metadata or `wikiMode: llmwikirpg`; old `wikiMode: rpg` markers are accepted only as compatibility input where the code still normalizes them.

## First-Version RPG Directories

The current RPG wiki contract uses these directories:

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
- `wiki/style/`
- `wiki/rules/`
- `wiki/quests/`
- `wiki/memory/`

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
- `current-scene`: runtime-owned current snapshot only; ordinary ingest must not write it.
- `relationships`: relationship changes, trust, conflict, dependence, and tension between actors.
- `style`: manual tone, narration style, voice, variables, and presentation conventions.
- `rules`: manual house rules, system rulings, safety boundaries, and runtime constraints.
- `quests`: objective tracking for goals, missions, tasks, blockers, completion state, and accepted runtime objective changes.
- `memory`: explicit user-approved memory and reminders; not inferred or written automatically.

## Update Semantics

- `wiki/current-scene/scene_state.md` is the canonical first-version current-scene file, is overwrite-oriented, and is maintained only by the RPG Play/Runtime apply flow after the user accepts a pending runtime update.
- `wiki/events/timeline.md` is append-oriented and keeps event history.
- `player`, `characters`, `relationships`, `plot-arcs`, and `quests` use merge-style updates, with Stage 07 cleanup rules intended to replace stale dynamic sections instead of letting them linger.
- Runtime update/write policy allows `wiki/quests/*.md` only with `merge`; `overwrite` and `append` are rejected for quests.
- `world`, `locations`, `factions`, and `items` remain merge-oriented knowledge pages.
- `sources` stays compatibility-shaped and continues using legacy source-summary behavior in frontmatter/type handling.

## Recommended Source Types

The current implementation is suited for these source classes:

- world-setting text
- character sheets
- session or scene progression logs
- imported lore or scenario notes

## Practical Workflow

1. Use an `llmwikirpg` project with `wikiMode: llmwikirpg`.
2. Ingest setting files, character material, session notes, and static plot/canon text through the normal pipeline for non-current-scene directories.
3. Use the dedicated RPG runtime Play view for active play. Accepted runtime pending updates are the only path that should overwrite `wiki/current-scene/scene_state.md`.
4. Confirm that outputs are routed into RPG directories rather than legacy `wiki/entities/` or `wiki/concepts/`.
5. Review the separation between `current-scene`, `events`, and `plot-arcs`.
6. Use the dedicated RPG runtime Play view for turn-by-turn play; normal chat/search remain supporting wiki tools rather than the main runtime loop.

## High-Value Review Checks

- Past facts belong in `events`, not `plot-arcs`.
- Future plans and unresolved hooks belong in `plot-arcs`, not `events`.
- Current state belongs in `current-scene`, not spread across event history.
- Player-specific state should stay in `player`, not be merged into general NPC pages.
- Relationship pages should capture interaction change and tension rather than duplicate full character biographies.

## Compatibility Notes

- Legacy `entities`, `concepts`, and `queries` are no longer product write targets for llmWikiRPG projects.
- `wiki/sources/` remains a valid RPG evidence layer; it is not a legacy query/entity directory.
- New project creation is RPG-oriented and should create RPG directories directly. Existing legacy files may remain on disk, but UI/prompt/ingest/runtime should not route new llmWikiRPG content into legacy directories.

## Current Limits

- Runtime review metadata is now recoverable through `.llm-wiki/runtime/`, but there is still no audit UI, compaction, or migration tooling for those metadata files.
- Applying accepted updates refreshes affected project files, data-version subscribers, and current-scene display when the canonical scene snapshot is overwritten.
- Current runtime merge behavior is conservative append-style; section-aware merge and stronger semantic validation are still future work.
- Context Compiler v1 still needs better use of selected options, `likelyAffectedPaths`, recent accepted events, runtime overlays, and richer objective/quest retrieval.
- Relationship/tension derivation, outline impact detection, outline regeneration, and real-model long-turn evaluation remain future architecture work.
