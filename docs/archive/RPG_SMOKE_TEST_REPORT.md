# RPG Smoke Test Report

## Stage

Stage 10: RPG smoke test

## Goal

Use a small set of RPG sample texts to verify that the first-version RPG extraction, storage, and display-related routing chain is usable without widening scope into Stage 11 evaluation work.

## Test Method

- Added a focused automated smoke test: `src/lib/rpg-smoke.test.ts`
- Validation command:
  - `npx vitest run src/lib/rpg-smoke.test.ts`
  - `npm run typecheck`
- Test mode:
  - mocked LLM responses for deterministic routing/write assertions
  - real temp-project filesystem writes through the normal ingest pipeline
  - helper-level display-chain checks through RPG mode detection, wiki type inference, and RPG retrieval prioritization

## Sample Inputs

The smoke test uses four source files across the three Stage 10 sample classes:

1. World setting text
   - `raw/sources/world-guide.md`
   - Covers world facts, location, faction, and key item
2. Character card text
   - `raw/sources/hero-sheet.md`
   - Covers player identity, major NPC, and relationship
3. Plot progression text
   - `raw/sources/session-01.md`
   - First scene/event update
   - `raw/sources/session-02.md`
   - Second scene/event update to verify overwrite/append behavior

The project schema is explicitly marked `wikiMode: rpg` so the smoke test validates the RPG path, not default-mode fallback behavior.

## Observed Results

### Directory generation

Representative output pages were written under all first-version RPG directories:

| Directory | Representative result | Status |
| -- | -- | -- |
| `wiki/sources/` | canonical source-summary pages for `world-guide.md`, `hero-sheet.md`, `session-01.md`, `session-02.md` | Pass |
| `wiki/world/` | `basic-overview.md` | Pass |
| `wiki/characters/` | `mira-vale.md` | Pass |
| `wiki/player/` | `player.md` | Pass |
| `wiki/locations/` | `river-port.md` | Pass |
| `wiki/factions/` | `amber-guild.md` | Pass |
| `wiki/items/` | `lantern-key.md` | Pass |
| `wiki/plot-arcs/` | `shadow-below-the-port.md` | Pass |
| `wiki/events/` | `timeline.md` | Pass |
| `wiki/current-scene/` | `scene_state.md` | Pass |
| `wiki/relationships/` | `player-mira.md` | Pass |

### Storage/update behavior

- No legacy `wiki/entities/` or `wiki/concepts/` directory was created during the RPG smoke run.
- `current-scene` normalization worked:
  - first turn emitted `wiki/current-scene/state.md`
  - actual stored path became `wiki/current-scene/scene_state.md`
  - the older scene snapshot did not remain after the second turn
- `events` append behavior worked:
  - `wiki/events/timeline.md` retained both Session 01 and Session 02 event entries
- `sources` remained compatibility-shaped:
  - source pages were written to `wiki/sources/`
  - frontmatter type stays legacy `source`, which matches the Stage 03 compatibility decision

### Display-chain validation

The smoke test did not run a browser/manual UI pass, but it did verify the frontend-facing routing helpers that Stage 08 and Stage 09 depend on:

- `detectWikiMode(...)` resolved the project as `rpg`
- `inferWikiTypeFromPath(...)` recognized representative RPG pages such as:
  - `wiki/world/basic-overview.md` -> `world`
  - `wiki/current-scene/scene_state.md` -> `current-scene`
  - `wiki/relationships/player-mira.md` -> `relationships`
- `prioritizeChatSearchResults(...)` preferred live RPG context in the expected order:
  - `current-scene`
  - `player`
  - `events`

## Validation Outcome

- `npx vitest run src/lib/rpg-smoke.test.ts` passed: 1 test file, 1 test
- `npm run typecheck` passed

## Differences Or Limitations

- This smoke test validates deterministic pipeline routing with mocked LLM output, not real model extraction quality.
- Frontend validation is helper-level, not a browser-rendered manual UI walkthrough.
- Multi-turn merge behavior for `player`, `characters`, `relationships`, and `plot-arcs` was not expanded in this stage; the smoke test focuses on first-write coverage plus the most critical live-state behaviors: `current-scene` overwrite and `events` append.

## Conclusion

Stage 10 is complete at smoke-test scope. The first-version RPG ingest path can route sample RPG material into the intended RPG directories, preserve the key live-state storage semantics, and expose those paths to the frontend-side RPG recognition helpers without falling back to legacy `entities` or `concepts`.
