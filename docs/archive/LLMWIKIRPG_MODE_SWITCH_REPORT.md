# llmWikiRPG Mode Switch Report

## 1. Does the project need a mode switch?

Yes.

The repository already had RPG-aware runtime pieces, but it still bootstrapped new projects as legacy `llm_wiki` projects and relied on heuristic/text-marker detection instead of a first-class mode setting.

## 2. How do you switch to `llmwikirpg` mode now?

Two supported paths now exist:

### New project

Use the create-project dialog and choose:

- `Mode = llmwikirpg`

When selected, the app now bootstraps the project with:

- persisted project mode metadata
- RPG schema
- RPG purpose
- RPG index / overview / log
- RPG-first directory structure

### Existing project

Set the project mode metadata in:

- `.llm-wiki/project.json`

Example:

```json
{
  "id": "existing-project-id",
  "createdAt": 1760000000000,
  "mode": "llmwikirpg"
}
```

Compatibility aliases are also accepted at detection time:

- `rpg`
- `llmwikirpg`

## 3. What files were changed?

Code:

- [src/lib/project-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/project-mode.ts)
- [src/commands/fs.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/commands/fs.ts)
- [src/components/project/create-project-dialog.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/project/create-project-dialog.tsx)
- [src/lib/wiki-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.ts)
- [src/components/chat/chat-panel.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/chat/chat-panel.tsx)
- [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts)

Tests:

- [src/lib/project-mode.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/project-mode.test.ts)
- [src/lib/wiki-mode.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.test.ts)
- [src/lib/ingest.prompt.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.prompt.test.ts)
- [src/lib/rpg-smoke.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-smoke.test.ts)

Docs:

- [docs/LLMWIKIRPG_MODE_SWITCH_ANALYSIS.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/LLMWIKIRPG_MODE_SWITCH_ANALYSIS.md)
- [docs/LLMWIKIRPG_MODE_SWITCH_REPORT.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/LLMWIKIRPG_MODE_SWITCH_REPORT.md)
- [docs/CURRENT_STATE.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/CURRENT_STATE.md)
- [docs/IMPLEMENTATION_LOG.md](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/docs/IMPLEMENTATION_LOG.md)

## 4. What new configuration was added?

### Persisted project mode metadata

Added a mode field in project metadata:

```json
{
  "mode": "default" | "llmwikirpg"
}
```

Stored in:

- `.llm-wiki/project.json`

### Mode bootstrap config

Added a lightweight frontend mode bootstrap layer in:

- [src/lib/project-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/project-mode.ts)

It currently defines:

- `default`
- `llmwikirpg`

and separates:

- bootstrap schema
- bootstrap purpose
- bootstrap index / overview / log
- bootstrap directories

## 5. How do you start or create an `llmwikirpg` project?

### In the UI

1. Create a new project.
2. Select `Mode = llmwikirpg`.
3. Finish creation normally.

### For an existing project

1. Ensure the project has `.llm-wiki/project.json`.
2. Add or update:

```json
{
  "mode": "llmwikirpg"
}
```

## 6. How do you verify the project is running in `llmwikirpg` mode?

Check one or more of the following:

- `.llm-wiki/project.json` contains `"mode": "llmwikirpg"`
- `schema.md` begins with `wikiMode: llmwikirpg` for newly created RPG-mode projects
- the project contains RPG bootstrap directories such as:
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
- runtime detection now prefers project metadata before fallback heuristics
- ingest prompt tests and the RPG smoke test pass with `llmwikirpg` mode naming

## 7. What runtime behavior changed?

### Mode detection

Runtime now prefers explicit project metadata in `.llm-wiki/project.json`, then falls back to:

- `wikiMode: ...` markers
- RPG directory heuristics

### Project creation

The create-project flow can now explicitly choose `llmwikirpg` mode and bootstrap RPG-specific files/directories.

### Manual ingest path

The manual ingest flow was corrected to read:

- `schema.md`
- `purpose.md`

from the project root, instead of the incorrect:

- `wiki/schema.md`
- `wiki/purpose.md`

This makes manual ingest use the actual project schema/mode context.

## 8. Verification completed

Validated locally with:

```powershell
npx.cmd vitest run src/lib/wiki-mode.test.ts src/lib/project-mode.test.ts src/lib/ingest.prompt.test.ts src/lib/rpg-smoke.test.ts
npm.cmd run typecheck
```

Results:

- tests passed: 4 files, 29 tests
- TypeScript typecheck passed

What this verifies directly:

- default mode still exists
- `llmwikirpg` mode is selectable/configurable
- runtime mode detection accepts explicit metadata and legacy alias markers
- ingest prompt routing still works
- RPG smoke routing still works

## 9. Remaining risks / follow-up suggestions

- Rust backend project creation still creates the legacy skeleton first, and the frontend RPG bootstrap then overwrites the relevant files and adds RPG directories. This is low risk, but a future cleanup could move mode-specific bootstrap deeper into a shared backend/bootstrap layer.
- Auxiliary RPG directories `style`, `rules`, `quests`, and `memory` are now bootstrapped for RPG-mode projects, but the current extraction registry still focuses on the 11 core v1 RPG categories.
- Existing projects without `.llm-wiki/project.json` mode metadata still rely on fallback markers/heuristics until explicitly updated.
- There is still no dedicated project-settings UI for changing mode after creation; the current change intentionally keeps the closure lightweight.
