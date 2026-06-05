# LLMWikiRPG Architecture Plan

## Scope

This document is the first-phase architecture analysis for turning `llm_wiki` into a minimal runnable RPG context manager and narrative runtime. It intentionally does not propose a rewrite, a NovelForge merge, a SillyTavern port, a complex UI, or a multi-agent workflow.

The target is a small closed loop:

1. Import setting material.
2. Generate structured RPG wiki pages.
3. Accept a player action.
4. Compile a short context pack from relevant wiki pages.
5. Generate player-visible narrative.
6. Extract state updates.
7. Stage updates for confirmation.
8. Apply confirmed updates back into the wiki and turn log.

## Current Architecture Summary

`llm_wiki` is a Tauri desktop app with a React/TypeScript frontend and a Rust backend. The current system already has three important loops that are reusable for `llmwikirpg`:

1. Project creation creates a local Markdown wiki project with `raw/`, `wiki/`, `schema.md`, `purpose.md`, `wiki/index.md`, `wiki/log.md`, and `wiki/overview.md`.
2. Ingest reads source files, asks an LLM to analyze them, asks another prompt to emit wiki file blocks, parses those blocks, and writes Markdown pages under `wiki/`.
3. Chat retrieves relevant wiki pages, builds a compact prompt context, calls the selected chat model, and stores cited page references with the assistant response.

The app treats Markdown files as the source of truth. The UI and backend mostly provide file access, LLM calls, retrieval, graph expansion, embeddings, and synchronization around this Markdown tree.

## Located Code Positions

### Project Template Creation

Primary project skeleton creation lives in:

- `src-tauri/src/commands/project.rs`
- `src/commands/fs.ts`
- `src/components/project/create-project-dialog.tsx`
- `src/lib/templates.ts`

`src-tauri/src/commands/project.rs` exposes `create_project`. It creates the initial directory tree, default `schema.md`, default `purpose.md`, `wiki/index.md`, `wiki/log.md`, `wiki/overview.md`, and Obsidian compatibility files.

`src/commands/fs.ts` wraps the Tauri command with `createProject()` and attaches the persistent project identity under `.llm-wiki/project.json` through `ensureProjectId()` and `upsertProjectInfo()`.

`src/components/project/create-project-dialog.tsx` calls `createProject()`, then selects a frontend template from `src/lib/templates.ts`, overwrites `schema.md` and `purpose.md`, and creates template-specific extra wiki directories.

`src/lib/templates.ts` defines the current frontend templates: research, reading, personal growth, business/team, and general.

### `purpose.md` / `schema.md` Generation Logic

Initial default `schema.md` and `purpose.md` are generated in:

- `src-tauri/src/commands/project.rs`

Template-specific `schema.md` and `purpose.md` contents are defined in:

- `src/lib/templates.ts`

Template application is performed in:

- `src/components/project/create-project-dialog.tsx`

Important behavior: Rust creates a valid generic project first; the frontend then replaces `schema.md` and `purpose.md` with the selected template. An RPG template can fit into this existing template layer without changing the Rust command initially, though the Rust default skeleton would still create the generic directories unless later adjusted.

### Ingest Prompt Locations

The ingest pipeline is centered in:

- `src/lib/ingest.ts`

Key prompt builders are:

- `buildAnalysisPrompt()` at `src/lib/ingest.ts`
- `buildGenerationPrompt()` at `src/lib/ingest.ts`
- `buildReviewSuggestionPrompt()` at `src/lib/ingest.ts`
- `buildChunkAnalysisSystemPrompt()` and `buildChunkAnalysisUserPrompt()` at `src/lib/ingest.ts`
- `executeIngestWrites()` prompt path at `src/lib/ingest.ts`

`autoIngest()` is the normal source import entry point. It reads the source, `schema.md`, `purpose.md`, `wiki/index.md`, and `wiki/overview.md`; runs analysis; runs generation; parses `---FILE: ...---` blocks; writes files; appends log entries; updates index and overview; stores review items; and optionally embeds written pages.

### Query Prompt / Chat Prompt Locations

Chat context assembly and prompt construction live mainly in:

- `src/components/chat/chat-panel.tsx`
- `src/stores/chat-store.ts`
- `src/lib/search.ts`
- `src-tauri/src/commands/search.rs`
- `src/lib/graph-relevance.ts`

`ChatPanel.handleSend()` builds the current chat prompt. It handles greeting short-circuiting, reads `purpose.md` and `wiki/index.md`, runs `searchWiki()`, optionally runs external search, expands retrieved pages through graph relevance, reads selected page contents under a context budget, and sends the final system prompt plus conversation history to `streamChat()`.

`src/stores/chat-store.ts` stores conversations, messages, current streaming state, ingest/chat mode, max history count, and cited references.

The current chat prompt is knowledge-QA oriented, not narrative-runtime oriented. For RPG mode, it should be reused structurally but replaced semantically with a narrative prompt and deterministic context-pack assembly.

### Wiki File Read/Write Logic

Frontend wrappers live in:

- `src/commands/fs.ts`

Rust filesystem commands live in:

- `src-tauri/src/commands/fs.rs`

The important wrappers are `readFile()`, `writeFile()`, `writeFileAtomic()`, `listDirectory()`, `createDirectory()`, `deleteFile()`, `fileExists()`, and related helpers.

`src-tauri/src/commands/fs.rs` implements the actual file access and rich source extraction. `read_file` handles plain text plus PDF, Office, images, and media placeholders. `write_file` and `write_file_atomic` are registered in `src-tauri/src/lib.rs`.

Ingest-specific safety and write handling live in:

- `src/lib/ingest.ts`

Important ingest write functions include `parseFileBlocks()`, `isSafeIngestPath()`, `writeFileBlocks()`, `tryReadFile()`, and merge handling through `mergePageContent()`.

### Chat Context Assembly / Retrieval Pipeline

The current retrieval path is:

1. `ChatPanel.handleSend()` receives user text.
2. It reads `wiki/index.md` and `purpose.md`.
3. It calls `searchWiki(projectPath, text)` in `src/lib/search.ts`.
4. `searchWiki()` invokes backend command `search_project`.
5. `src-tauri/src/commands/search.rs` scans `wiki/**/*.md`, performs keyword scoring, optionally merges embedding/vector results with reciprocal rank fusion, and returns ranked results.
6. `ChatPanel` takes the top results, builds a retrieval graph with `buildRetrievalGraph()`, adds one-hop related pages with `getRelatedNodes()`, reads page contents, applies context budget from `src/lib/context-budget.ts`, and builds a single system prompt.
7. `streamChat()` in `src/lib/llm-client.ts` sends the prompt to the configured provider.

This is a strong foundation for RPG context retrieval, but RPG needs a more opinionated retrieval strategy: always include `current-scene`, player state, hard rules, style, and recent events before adding search-derived pages.

### `index.md` / `overview.md` / `log.md` Update Logic

Initial creation:

- `src-tauri/src/commands/project.rs`

Ingest update instructions:

- `buildGenerationPrompt()` in `src/lib/ingest.ts` explicitly asks the LLM to emit an updated `wiki/index.md`, a `wiki/log.md` append entry, and an updated `wiki/overview.md`.

Ingest write behavior:

- `writeFileBlocks()` in `src/lib/ingest.ts` appends `wiki/log.md` blocks.
- `writeFileBlocks()` overwrites listing pages such as `wiki/index.md` and `wiki/overview.md`.
- Content pages are merged with `mergePageContent()` rather than blindly overwritten.

Concurrency guard:

- `src/lib/project-mutex.ts`

The mutex exists because `autoIngest()` reads `wiki/index.md`, asks the LLM to emit a revised index, and writes it later. Concurrent ingests could otherwise overwrite each other's index changes.

Source deletion lifecycle updates:

- `src/lib/source-lifecycle.ts`

This module removes source references and appends deletion entries to `wiki/log.md` when source files are deleted.

## Modules Suitable As LLMWikiRPG Foundation

### Keep As Core Infrastructure

- `src/commands/fs.ts` and `src-tauri/src/commands/fs.rs`: local Markdown file I/O and source extraction.
- `src/lib/llm-client.ts` and provider modules: model invocation should remain centralized.
- `src/stores/wiki-store.ts`: project, LLM, embedding, language, and source-watch configuration are reusable.
- `src/lib/search.ts` and `src-tauri/src/commands/search.rs`: retrieval can be reused for action-relevant wiki recall.
- `src/lib/graph-relevance.ts`: wikilink graph expansion is useful for related characters, locations, factions, and plot arcs.
- `src/lib/context-budget.ts`: RPG context packs need strict size budgets.
- `src/lib/ingest.ts`: the two-stage analyze/generate import pattern is directly reusable for importing setting material into RPG pages.
- `src/lib/project-mutex.ts`: needed for state-write serialization when confirming updates.
- `src/lib/templates.ts`: best place to add an RPG project template in a later implementation phase.

### Reuse With Prompt Changes

- Ingest analysis/generation prompts can be adapted from research wiki pages to RPG page types.
- Chat prompt assembly can be adapted from question answering to narrative generation.
- Review/staging concepts can inspire `runtime/pending_updates.md`, though the existing review store is knowledge-gap oriented and should not be overextended too early.

### Avoid In First Minimal Version

- Do not add multi-agent orchestration.
- Do not port SillyTavern code.
- Do not port NovelForge code.
- Do not build complex RPG UI.
- Do not create a new persistence layer before Markdown files prove insufficient.

## Required New Or Changed Modules

### RPG Template

Add a frontend template later in `src/lib/templates.ts` with RPG page types and extra directories. The template should define `schema.md`, `purpose.md`, and extra directories matching the RPG structure.

The minimal template should be schema-first and explicit about page routing. It should instruct ingest to produce pages under `world/`, `characters/`, `locations/`, `factions/`, `items/`, `plot-arcs/`, `events/`, `style/`, and `rules/` rather than generic `entities/` and `concepts/`.

### RPG Runtime Library

Add a small RPG runtime module later, likely under `src/lib/rpg-runtime.ts` or split into focused files if it grows. Minimal responsibilities:

- Build action search queries from player input plus current scene.
- Select mandatory context files.
- Retrieve and rank relevant wiki pages.
- Assemble `wiki/runtime/context_pack.md`.
- Generate narrative with `streamChat()`.
- Extract structured updates with a second `streamChat()` call.
- Write staged updates to `wiki/runtime/pending_updates.md`.
- Apply confirmed updates to target pages and append `wiki/runtime/turn_log.md`.

### RPG Prompt Builders

Add prompt builders instead of embedding long RPG prompts inside React components. Suggested functions:

- `buildRpgContextPackPrompt()` if context compilation needs LLM assistance, though the minimal version can assemble context deterministically.
- `buildRpgNarrationPrompt()` for player-visible fiction.
- `buildRpgStateExtractionPrompt()` for JSON or Markdown update extraction.
- `buildRpgApplyUpdatesPrompt()` only if deterministic patching is insufficient.

### RPG UI Entry Point

Minimal UI can reuse the existing chat panel shape. The first implementation can be a small mode switch or project template behavior, not a full game screen. A later dedicated panel can show:

- Current scene.
- Player action input.
- Narrative output.
- Pending updates preview and confirm/reject buttons.

### Update Staging And Confirmation

The current ingest pipeline writes generated pages immediately. RPG state changes should not do that. It needs a staged update file:

- `wiki/runtime/pending_updates.md`

Only after user confirmation should updates be applied to target pages and logged in:

- `wiki/runtime/turn_log.md`

This is the key behavioral difference from current ingest.

## Recommended RPG Wiki Directory Structure

Use the user's proposed structure, with a few minimal conventions:

```text
wiki/
  sources/
  world/
  characters/
  player/
  locations/
  factions/
  items/
  plot-arcs/
  events/
  current-scene/
  relationships/
  style/
  rules/
  runtime/
    context_pack.md
    turn_log.md
    pending_updates.md
    unresolved_threads.md
```

Suggested meaning:

- `wiki/sources/`: imported setting/source summaries.
- `wiki/world/`: world overview, history, cosmology, cultures, magic/technology assumptions.
- `wiki/characters/`: NPCs and major cast members.
- `wiki/player/`: player character sheet, inventory summary, known facts, current objectives.
- `wiki/locations/`: places, maps in prose, local state.
- `wiki/factions/`: organizations, groups, allegiances.
- `wiki/items/`: important objects, artifacts, equipment, clues.
- `wiki/plot-arcs/`: main quest lines, side plots, unresolved dramatic arcs.
- `wiki/events/`: canonical past events and recent scene-level events.
- `wiki/current-scene/`: current location, present characters, immediate situation, visible hooks.
- `wiki/relationships/`: relationship state between player, NPCs, factions, and locations.
- `wiki/style/`: tone, narration style, genre constraints, content boundaries.
- `wiki/rules/`: game rules, safety rules, world rules, mechanics if any.
- `wiki/runtime/`: generated runtime artifacts, not source lore.

Minimal first-run files should include:

- `wiki/current-scene/main.md`
- `wiki/player/player.md`
- `wiki/style/narration.md`
- `wiki/rules/core-rules.md`
- `wiki/runtime/context_pack.md`
- `wiki/runtime/turn_log.md`
- `wiki/runtime/pending_updates.md`
- `wiki/runtime/unresolved_threads.md`

## Player Action Runtime Flow

### Target Flow

1. Receive the player's action.
2. Read mandatory state: current scene, player page, style, core rules, recent turn log, unresolved threads.
3. Search the wiki using the player action plus current scene keywords.
4. Add related pages through wikilink graph expansion.
5. Build `wiki/runtime/context_pack.md` within a strict context budget.
6. Call the narrative model to generate player-visible story text.
7. Call the state extraction model to extract proposed updates.
8. Write proposed updates to `wiki/runtime/pending_updates.md`.
9. Show the narrative and pending updates to the user.
10. On confirmation, apply updates to the relevant wiki pages and append `wiki/runtime/turn_log.md`.

### Minimal Context Pack Contents

`context_pack.md` should be deterministic Markdown, not a hidden database object. Suggested structure:

```markdown
# RPG Context Pack

## Player Action

...

## Current Scene

...

## Player State

...

## Rules

...

## Style

...

## Recent Turns

...

## Retrieved Pages

### characters/example.md
...

### locations/example.md
...

## Unresolved Threads

...
```

Mandatory pages should be included before search results. Search results should be added until the page budget is full.

### Retrieval Priority For RPG

The existing chat retrieval treats every query as open-ended QA. RPG should use priority bands:

1. Always include `current-scene`, `player`, `rules`, `style`, `runtime/turn_log.md` tail, and `runtime/unresolved_threads.md`.
2. Include pages explicitly linked from current scene.
3. Include pages matched by player action search.
4. Include graph neighbors for matched characters, locations, factions, items, and plot arcs.
5. Include recent events if budget remains.

This avoids the biggest RPG failure mode: the model answers with globally relevant lore while ignoring immediate scene state.

## Narrative Generation Prompt Shape

The narrative model should receive only the compiled context pack and the player's action. It should be told:

- Continue from the current scene.
- Produce only player-visible narrative.
- Do not expose hidden state extraction.
- Do not directly edit wiki pages.
- Respect rules, style, established facts, and unresolved threads.
- Keep output short enough for turn-based play.
- End with a clear situation for the player's next action.

The output should be prose, not JSON.

## State Extraction Prompt Shape

The state extraction model should receive the context pack, player action, and generated narrative. It should output structured proposed updates. For minimal implementation, Markdown is easier to inspect than JSON and maps directly to `pending_updates.md`.

Suggested sections:

```markdown
# Pending RPG Updates

## Events

- target: wiki/events/YYYY-MM-DD-turn-N.md
- update: ...

## Character Updates

- target: wiki/characters/name.md
- update: ...

## Relationship Updates

- target: wiki/relationships/name.md
- update: ...

## Scene Update

- target: wiki/current-scene/main.md
- update: ...

## Plot Arc Updates

- target: wiki/plot-arcs/name.md
- update: ...

## Unresolved Threads

- target: wiki/runtime/unresolved_threads.md
- update: ...
```

JSON can be added later once the update application logic is stable.

## Applying Confirmed Updates

For the minimal version, avoid complex patch application. Use conservative append/replace rules:

- Append a new event page under `wiki/events/`.
- Append turn summary to `wiki/runtime/turn_log.md`.
- Replace `wiki/current-scene/main.md` with a complete extracted scene state only if the extractor emits a complete scene block.
- Append dated update bullets to character, relationship, plot arc, location, and faction pages.
- Keep `pending_updates.md` until applied, then either clear it or move its contents into `turn_log.md`.

Do not let the narrative model write files. Only the state extraction/apply phase writes files.

## Minimal Runnable Version Steps

### Step 1: Add RPG Template

Add an RPG template in `src/lib/templates.ts` and expose it through the existing template picker. It should create the RPG directories and write RPG-specific `schema.md` and `purpose.md`.

No backend change is required for the first version if frontend-created extra directories are enough.

### Step 2: Adapt Import Prompts For RPG Projects

Keep `autoIngest()` but make the RPG template schema authoritative enough that current `buildGenerationPrompt()` routes pages into RPG folders. If this is insufficient, add a small RPG-specific branch in prompt construction later.

First goal: imported setting material creates usable pages under RPG directories, plus `index.md`, `overview.md`, and `log.md`.

### Step 3: Add Runtime Files

On RPG project creation or first RPG action, ensure these files exist:

- `wiki/runtime/context_pack.md`
- `wiki/runtime/turn_log.md`
- `wiki/runtime/pending_updates.md`
- `wiki/runtime/unresolved_threads.md`
- `wiki/current-scene/main.md`
- `wiki/player/player.md`
- `wiki/style/narration.md`
- `wiki/rules/core-rules.md`

### Step 4: Implement Context Pack Compiler

Add a deterministic function that reads mandatory pages, uses `searchWiki()` for the action, expands through graph relevance, applies `computeContextBudget()`, and writes `wiki/runtime/context_pack.md`.

This should be independent of the current QA prompt in `ChatPanel` so RPG behavior can evolve without destabilizing normal wiki chat.

### Step 5: Implement Narrative Turn Function

Add a function that takes player action, calls the context pack compiler, sends the narrative prompt through `streamChat()`, and returns player-visible prose.

Reuse existing LLM config from `useWikiStore` and streaming behavior from `ChatPanel` if practical.

### Step 6: Implement State Extraction To Pending Updates

After narrative generation, call a second prompt that emits proposed updates. Write the result to `wiki/runtime/pending_updates.md` using `writeFile()` or `writeFileAtomic()`.

This phase should not modify character, scene, event, or plot pages yet.

### Step 7: Add Confirm Updates Action

Add a simple confirm action that applies `pending_updates.md` conservatively:

- Append turn entry to `wiki/runtime/turn_log.md`.
- Create event page if present.
- Append update notes to target pages.
- Clear or archive `pending_updates.md`.

Use `withProjectLock()` or an equivalent project-level lock around this write sequence.

### Step 8: Minimal UI Integration

Reuse the existing chat panel style or add a small RPG panel. The MVP only needs:

- Player action input.
- Narrative output.
- Pending updates preview.
- Confirm updates button.

No map, character sheet UI, timeline UI, or multi-agent controls are required.

## Risks And Design Notes

- Current ingest writes `index.md` and `overview.md` by LLM overwrite. This is workable for import but risky for frequent RPG turn updates. RPG turn updates should avoid rewriting global index/overview on every turn.
- Current chat prompt is QA-specific. Do not overload it with RPG rules; create a separate runtime path.
- Current `search_project` searches all `wiki/**/*.md`, which includes `runtime/`. RPG retrieval should avoid accidentally retrieving stale `runtime/context_pack.md` or `pending_updates.md` as lore unless explicitly needed.
- Existing Markdown file safety in `isSafeIngestPath()` is designed for ingest writes under `wiki/`. RPG update application needs similar path validation before writing model-proposed targets.
- Existing page merging uses LLM-assisted merging. For MVP RPG turns, simple append-only updates are safer and easier to audit.
- Embeddings can improve recall, but the MVP should work with keyword search and graph expansion only.

## Recommended First Implementation Boundary

The smallest coherent implementation is not a new RPG engine. It is a new RPG project template plus a turn runner that reuses existing primitives:

- File I/O from `src/commands/fs.ts`.
- LLM calls from `src/lib/llm-client.ts`.
- Retrieval from `src/lib/search.ts` and graph relevance.
- Context budgeting from `src/lib/context-budget.ts`.
- Project locking from `src/lib/project-mutex.ts`.
- Existing chat UI patterns for streaming and display.

Everything else can remain normal `llm_wiki` behavior until the RPG loop proves useful.
