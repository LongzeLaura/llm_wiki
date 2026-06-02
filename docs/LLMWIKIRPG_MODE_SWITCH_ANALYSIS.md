# llmWikiRPG Mode Switch Analysis

## Scope

This document records the code-level diagnosis performed in the current repository before the minimal mode-switch closure changes were applied.

The inspection focused on:

- project creation and bootstrap
- mode/profile/domain/template/schema/category/registry hooks
- ingest and extraction runtime
- frontend project-creation flow
- whether RPG-specific schema and directories are actually used at runtime

## 1. Does the current project need to switch from the default mode to `llmwikirpg` mode?

Yes.

Before this change set, the repository already contained substantial RPG runtime pieces, but they were not exposed through a first-class project mode:

- RPG category registry existed in [src/lib/rpg-categories.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-categories.ts).
- RPG schema config existed in [src/lib/rpg-wiki-schema.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-wiki-schema.ts).
- Ingest prompt and write-path logic already had RPG-aware behavior in [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts).
- Frontend retrieval and display already had RPG-aware behavior in [src/components/chat/chat-panel.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/chat/chat-panel.tsx), [src/lib/rpg-query-priority.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-query-priority.ts), and [src/lib/wiki-page-types.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-page-types.ts).

However, new projects still bootstrapped as legacy `llm_wiki` projects unless the user manually edited `schema.md` or created enough RPG directories for the heuristic detector to infer RPG mode.

So the answer is:

- runtime RPG support existed
- default project bootstrap still pointed to legacy behavior
- a real `llmwikirpg` mode switch was still needed

## 2. Did the project already support mode switching before this change?

Partially, but not as a first-class mode system.

What existed before:

- A lightweight detector in [src/lib/wiki-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.ts).
- Detection sources were:
  - `wikiMode: ...` text markers inside `schema.md` / `purpose.md` / `index.md`
  - heuristic detection from RPG directory names such as `world`, `player`, `events`, `current-scene`, `relationships`

What did not exist before:

- no persisted project mode field
- no mode selector in the frontend create-project flow
- no dedicated mode registry
- no explicit existing-project mode metadata
- no clean separation between "default project bootstrap" and "llmwikirpg project bootstrap"

Conclusion:

- heuristic switching existed
- explicit mode switching did not

## 3. Where was the default mode defined before the change?

Primarily in project bootstrap and legacy schema assumptions:

- Rust project creation hardcoded legacy directories in [src-tauri/src/commands/project.rs](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src-tauri/src/commands/project.rs).
- The default schema written by the backend in the same file was still the classic `entities / concepts / sources / queries / comparisons / synthesis` schema.
- The frontend create-project dialog in [src/components/project/create-project-dialog.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/project/create-project-dialog.tsx) offered only:
  - project name
  - template
  - output language
  - parent directory
- Templates in [src/lib/templates.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/templates.ts) were domain-like content templates, not runtime modes.

So the effective default mode was still legacy `llm_wiki`.

## 4. Where was `llmwikirpg`-related code/config before the change?

Runtime/category/schema layer:

- [src/lib/rpg-categories.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-categories.ts)
- [src/lib/rpg-wiki-schema.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-wiki-schema.ts)
- [src/lib/rpg-dynamic-update.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-dynamic-update.ts)
- [src/lib/wiki-mode.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.ts)

Prompt and pipeline layer:

- [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts)

Frontend display/retrieval layer:

- [src/components/chat/chat-panel.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/chat/chat-panel.tsx)
- [src/lib/rpg-query-priority.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-query-priority.ts)
- [src/lib/wiki-page-types.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-page-types.ts)
- [src/components/chat/chat-message.tsx](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/components/chat/chat-message.tsx)

Tests proving partial runtime support:

- [src/lib/rpg-smoke.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/rpg-smoke.test.ts)
- [src/lib/wiki-mode.test.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-mode.test.ts)

## 5. At runtime, which schema / prompt / category were actually loaded before the change?

### Auto-ingest pipeline

`autoIngest()` in [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts) already did the most correct thing:

- read `schema.md`
- read `purpose.md`
- read `wiki/index.md`
- list the current `wiki/` tree
- call `detectWikiMode(...)`
- if RPG mode was detected, inject RPG analysis/generation guidance
- use RPG storage semantics for `current-scene`, `events`, merge-based dynamic pages, and source routing

So the auto-ingest pipeline already used RPG schema/prompt/category behavior, but only when detection succeeded.

### Manual ingest chat path

Before this change, `startIngest()` and `executeIngestWrites()` in [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts) read:

- `wiki/schema.md`
- `wiki/purpose.md`

Those files do not exist in normal projects, because real projects store:

- `schema.md`
- `purpose.md`

at the project root.

So before this fix:

- manual ingest chat path was missing the intended schema/purpose context
- mode-sensitive behavior there was weaker than expected

## 6. Were `entities / concepts / sources` hardcoded?

Yes.

Hardcoded legacy behavior existed in multiple places:

- project bootstrap directories in [src-tauri/src/commands/project.rs](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src-tauri/src/commands/project.rs)
- legacy template schema definitions in [src/lib/templates.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/templates.ts)
- legacy/default type inference in [src/lib/wiki-page-types.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/wiki-page-types.ts)
- prompt fallback language in [src/lib/ingest.ts](/C:/Users/Administrator/Documents/Works/Chem/worktrees/llm_wiki_rpg/src/lib/ingest.ts)

The important nuance is:

- RPG support had been added on top
- legacy hardcoding had not been removed
- mode selection was therefore the missing control plane

## 7. Before the change, how could a project switch to RPG behavior?

There was no clean single official switch.

Possible implicit/partial methods were:

- add `wikiMode: rpg` to `schema.md`
- add `wikiMode: rpg` to `purpose.md`
- make the schema or wiki tree RPG-shaped enough that `detectWikiMode()` inferred RPG mode

That means the effective switch method was:

- text marker in config-like markdown
- heuristic directory inference

There was no support through:

- frontend project settings
- database field
- stable project metadata
- explicit mode registry

## 8. Minimum change needed if switching was not first-class

The minimum viable closure point was:

1. Add persisted project mode metadata.
2. Add a small mode registry or equivalent config layer.
3. Add a mode selector to new-project creation.
4. Bootstrap `llmwikirpg` projects with:
   - explicit mode marker
   - RPG schema
   - RPG index/overview/log
   - RPG directories
5. Make runtime mode detection prefer project metadata over heuristics.
6. Keep legacy default behavior unchanged when `mode` is not `llmwikirpg`.

That is exactly the path implemented in the follow-up change set.

## Final diagnosis

Before this change:

- the project still defaulted to legacy `llm_wiki`
- `llmwikirpg` support was real but partial
- the pipeline could use RPG logic, but only through heuristic or text-marker activation
- new projects could not choose mode from the UI
- project bootstrap and mode declaration were the smallest missing closure points

So the correct diagnosis is:

- yes, a switch to `llmwikirpg` mode was needed
- yes, RPG runtime code was already connected
- but no, the mode system was not yet explicit or user-selectable
