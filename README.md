# llmWikiRPG

Current version: v0.3

llmWikiRPG is a desktop RPG runtime knowledge base. It organizes source material, player state, current scene, relationship tension, style rules, and turn history into a readable and writable wiki that can support live conversation-driven play.

This branch is RPG-only. Legacy `llm_wiki` / `default` projects are not supported, and the app will reject projects that are not marked as `llmwikirpg`.

## Runtime Wiki Layout

New projects use these RPG directories:

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

The legacy llm_wiki directories `wiki/entities/`, `wiki/concepts/`, `wiki/queries/`, `wiki/comparisons/`, `wiki/synthesis/`, `wiki/methodology/`, `wiki/findings/`, and `wiki/thesis/` are no longer product capabilities. Existing files are not deleted automatically, but the UI does not create or write them.

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
