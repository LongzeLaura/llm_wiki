# llmWikiRPG

Current version: v0.5

llmWikiRPG is a desktop RPG runtime knowledge base. It organizes source material, player state, current scene, relationship tension, style rules, and turn history into a readable and writable wiki that can support live conversation-driven play.

This branch is RPG-only. Legacy `llm_wiki` / `default` projects are not supported, and the app will reject projects that are not marked as `llmwikirpg`.

## v0.5 Highlights

- Runtime turn architecture: the formal RPG turn now runs through module-specific handoffs instead of a centralized `CompactStoryBrief` / context compiler path.
- Direct wiki input builders: action resolver, world tick, recall selector, outline brief, narration generator, and runtime update proposal consume scoped wiki reads and structured handoffs.
- Stronger turn boundaries: player action adjudication, world reactions, recall selection, outline impact, narration, and wiki update proposals are separate runtime responsibilities.
- Outline-aware play support: major outline drift can trigger a conditional story outline regeneration handoff without silently rewriting accepted wiki facts.
- Runtime update validation: pending wiki updates are built from structured proposal output, with audit fields preserved for review instead of becoming ordinary wiki writes.
- Schema and documentation alignment: runtime-facing schema, final architecture docs, current state, and archived planning documents now reflect the post-context-compiler flow.

## v0.4 Highlights

- RPG-only project creation and loading: new projects use the llmWikiRPG directory contract directly instead of a legacy skeleton.
- Import framework: ordinary source ingest, control document import, campaign setup import, and runtime update apply now have separate contracts and target policies.
- Runtime play loop: the RPG Play panel can run turns, stage pending wiki updates, persist turn/pending state, and apply accepted updates through the runtime write policy.
- Safer dynamic state: `current-scene` is overwrite-only, `events` is append/create history, and player, quests, relationship, plot-arc, and runtime overlay updates use merge semantics.
- Interaction boundary consolidation: RPG prompts, parse contracts, target policy, and deterministic import contracts live under `src/lib/rpg-interactions/`.
- Legacy cleanup: old chat/dedup/enrich/vector-v1/default prompt islands and unused UI pieces have been removed from the current RPG product path.

## Runtime Wiki Layout

New projects use these RPG directories:

- `wiki/sources/`
- `wiki/world/`
- `wiki/characters/`
- `wiki/player/`
- `wiki/locations/`
- `wiki/factions/`
- `wiki/items/`
- `wiki/outlines/`
- `wiki/plot-arcs/`
- `wiki/events/`
- `wiki/current-scene/`
- `wiki/relationships/`
- `wiki/style/`
- `wiki/rules/`
- `wiki/quests/`
- `wiki/memory/`

The legacy llm_wiki directories `wiki/entities/`, `wiki/concepts/`, `wiki/queries/`, `wiki/comparisons/`, `wiki/synthesis/`, `wiki/methodology/`, `wiki/findings/`, and `wiki/thesis/` are no longer product capabilities. Existing files are not deleted automatically, but the UI does not create or write them.

## Runtime Write Rules

- `wiki/current-scene/scene_state.md` stores the current snapshot and is overwritten only through accepted runtime or campaign setup updates.
- `wiki/events/*.md` stores confirmed history and is appended/created; future plans and possible outcomes belong in `plot-arcs` or `outlines`.
- `wiki/player/*.md`, `wiki/quests/*.md`, `wiki/relationships/runtime/*.md`, and `wiki/plot-arcs/runtime/*.md` are merge-oriented runtime state.
- Stable setting pages such as base `characters`, `locations`, `factions`, `items`, `world`, `rules`, and `style` are protected from ordinary runtime writes.

## Import Modes

- `source_ingest`: compresses ordinary source material into runtime-useful wiki pages.
- `control_doc_import`: preserves GM/control documents such as outlines, rules, style guides, reveal order, and long-term notes.
- `campaign_setup_import`: bootstraps player state, opening scene, prologue facts, initial quests, and initial relationships.
- `runtime_update_apply`: applies accepted pending runtime updates after a completed turn.

## Development

```bash
npm install
npm run dev
npm run typecheck
npx vitest run
```

Tauri development:

```bash
npm run tauri dev
```

## Project Markers

An RPG project must include `.llm-wiki/project.json` with:

```json
{ "mode": "llmwikirpg" }
```

or a schema marker such as:

```markdown
wikiMode: llmwikirpg
```

Projects marked `default` or missing RPG markers are rejected instead of migrated.
