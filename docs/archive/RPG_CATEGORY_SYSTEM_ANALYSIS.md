# RPG Category System Analysis

Stage 01 output for locating the legacy `llm_wiki` category, extraction, save, display, and query chain. This stage is analysis-only and does not modify business logic.

## Summary

The current project does not have a single central category registry for all legacy wiki directories. Category behavior is distributed across project templates, prompt builders, path inference helpers, frontend grouping/styling, ingest write rules, graph/retrieval logic, and tests.

The legacy baseline categories are:

- `entities`
- `concepts`
- `sources`
- `queries`
- `comparisons`
- `synthesis`
- `findings`
- `methodology`
- `thesis`

The default Rust project skeleton creates only part of that set: `entities`, `concepts`, `sources`, `queries`, `comparisons`, and `synthesis`. The frontend research template adds `methodology`, `findings`, and `thesis`. Other frontend templates add custom directories such as `characters`, `themes`, `plot-threads`, `chapters`, `goals`, `habits`, `reflections`, `journal`, `meetings`, `decisions`, `projects`, and `stakeholders`.

## Category Definition Entry Points

### Backend Default Project Skeleton

- `src-tauri/src/commands/project.rs`

Key behavior:

- `create_project_impl()` creates the default directory set: `raw/sources`, `raw/assets`, `wiki/entities`, `wiki/concepts`, `wiki/sources`, `wiki/queries`, `wiki/comparisons`, and `wiki/synthesis`.
- The default `schema.md` defines page types `entity`, `concept`, `source`, `query`, `comparison`, `synthesis`, and `overview`.
- The default `wiki/index.md` contains headings for `Entities`, `Concepts`, `Sources`, `Queries`, `Comparisons`, and `Synthesis`.

### Frontend Templates

- `src/lib/templates.ts`
- `src/components/project/create-project-dialog.tsx`

Key behavior:

- `BASE_SCHEMA_TYPES` defines the shared legacy schema rows for `entity`, `concept`, `source`, `query`, `comparison`, `synthesis`, and `overview`.
- `BASE_FRONTMATTER` constrains default frontmatter `type` to `entity | concept | source | query | comparison | synthesis | overview`.
- `researchTemplate.extraDirs` adds `wiki/methodology`, `wiki/findings`, and `wiki/thesis`.
- `readingTemplate.extraDirs` adds book-oriented custom directories but still includes the base legacy schema.
- `personalTemplate` and `businessTemplate` also inherit the legacy base schema and add their own custom directories.
- `CreateProjectDialog.handleCreate()` calls the Rust `createProject()`, then overwrites `schema.md` and `purpose.md` with the chosen frontend template and creates `template.extraDirs`.

### Type Inference Helper

- `src/lib/wiki-page-types.ts`

Key behavior:

- `GENERATION_WIKI_TYPES` is the closest existing list of generation-recognized legacy types: `source`, `entity`, `concept`, `comparison`, `query`, `synthesis`, `thesis`, `methodology`, and `finding`.
- `WIKI_TYPE_DIRS` maps directories to types: `entities -> entity`, `concepts -> concept`, `sources -> source`, `queries -> query`, `comparisons -> comparison`, `synthesis -> synthesis`, `findings -> finding`, `thesis -> thesis`, `methodology -> methodology`.
- `inferWikiTypeFromPath()` also falls back to any custom `wiki/<dir>/<file>.md` directory by returning the directory name as the type.

## Extraction Prompt Entry Points

### Main Ingest Pipeline

- `src/lib/ingest.ts`

Key functions:

- `autoIngest()` and `autoIngestImpl()` are the source import entry points.
- `buildAnalysisPrompt()` asks for `Key Entities`, `Key Concepts`, `Main Arguments & Findings`, `Connections to Existing Wiki`, `Contradictions & Tensions`, and `Recommendations`.
- `buildGenerationPrompt()` asks the LLM to generate a source summary under `wiki/sources/`, typed pages for entities and concepts, `wiki/index.md`, `wiki/log.md`, and `wiki/overview.md`.
- `buildGenerationPrompt()` treats `schema.md` as authoritative and tells the model to prefer schema-defined directories before falling back to `wiki/entities/` and `wiki/concepts/`.
- `buildChunkAnalysisSystemPrompt()` uses long-source chunk analysis categories: entities, concepts, claims, findings, evidence, contradictions, open questions, and cross-chunk relations.
- `buildReviewSuggestionPrompt()` still uses research-oriented review categories such as missing entity/concept pages, contradictions, duplicates, and suggestions.

Important finding:

- The generation prompt already has a schema-driven escape hatch for custom directories, so RPG categories can likely be introduced incrementally through schema/registry/prompt changes rather than a complete rewrite.

## LLM Output Parsing Entry Points

- `src/lib/ingest.ts`

Key behavior:

- `parseFileBlocks()` parses `---FILE: wiki/path/to/page.md---` blocks and returns path/content pairs.
- `isSafeIngestPath()` allows any safe relative path under `wiki/`; it does not restrict output to legacy directories.
- `parseReviewBlocks()` parses optional `---REVIEW: type | Title---` blocks.
- `FILE_BLOCK_REGEX` is retained only for legacy diagnostic test compatibility; the live path uses `parseFileBlocks()`.

Important finding:

- The parser and path safety gate are directory-agnostic except for requiring paths to be under `wiki/`. This should reduce the backend parsing work needed for RPG categories.

## Wiki File Write Entry Points

### Ingest Writes

- `src/lib/ingest.ts`

Key behavior:

- `writeFileBlocks()` writes parsed LLM file blocks.
- `wiki/log.md` is appended.
- Listing pages such as `wiki/index.md` and `wiki/overview.md` are overwritten.
- Other content pages are merged through `mergePageContent()` from `src/lib/page-merge.ts`.
- Any generated path under `wiki/sources/` is canonicalized to the computed `sourceSummaryPath`.
- Language guard currently skips strict language detection for `wiki/entities/` and `wiki/sources/`, but not for RPG-specific directories.
- Fallback source summary creation writes `type: source` to `wiki/sources/<source-slug>.md` if the LLM fails to create it.
- Embedding page IDs are derived from filename stem only, which can collide across directories.

Important finding:

- RPG categories can be written through the existing writer if the LLM emits safe `wiki/<rpg-dir>/...` paths, but dynamic update semantics such as overwrite-only `current-scene` and append-only `events` are not represented yet. Current content pages all use the same merge behavior.

### Chat Answer Save Writes

- `src/components/chat/chat-message.tsx`

Key behavior:

- `SaveToWikiButton` saves assistant answers under `wiki/queries/<generated-file>.md` with `type: query`.
- It updates `wiki/index.md` under `## Queries`, appends `wiki/log.md`, refreshes the file tree, and then auto-ingests the saved query to extract entities/concepts.

Important finding:

- Saved chat answers are tightly coupled to `queries` and then to legacy entity/concept extraction. RPG mode will need to decide whether this remains a legacy-only behavior or routes saved narrative/GM outputs differently.

### Source Lifecycle Writes

- `src/lib/source-lifecycle.ts`
- `src/lib/wiki-page-delete.ts`
- `src/lib/wiki-cleanup.ts`

Key behavior:

- Imported files are copied into `raw/sources` and queued for ingest.
- Source deletion scans all `wiki/**/*.md`, rewrites or removes `sources` frontmatter, deletes empty-source pages, cleans index listings, strips deleted wikilinks, and appends deletion logs.
- Source summary media cleanup has special handling for `wiki/sources/<slug>.md`.

Important finding:

- Source reference maintenance is already broad across all wiki pages, while media cleanup and source summary behavior are specifically tied to `wiki/sources/`.

## Frontend Read And Display Entry Points

### Project Tree Loading

- `src/App.tsx`
- `src/components/layout/app-layout.tsx`
- `src/commands/fs.ts`
- `src-tauri/src/commands/fs.rs`

Key behavior:

- On project open, `App.handleProjectOpened()` calls `listDirectory(project.path)` and stores the full file tree.
- `AppLayout.loadFileTree()` reloads the root project tree.
- `src/commands/fs.ts` wraps the Tauri `list_directory`, `read_file`, and write commands.

### Knowledge Tree Grouping

- `src/components/layout/knowledge-tree.tsx`

Key behavior:

- `KnowledgeTree.loadPages()` lists `wiki/`, flattens all Markdown files, skips `index.md` and `log.md`, reads each page, and calls `parsePageInfo()`.
- `parsePageInfo()` prefers frontmatter `type`; if missing, it falls back to `inferWikiTypeFromPath()`.
- `TYPE_CONFIG` explicitly styles and orders legacy types: `overview`, `entity`, `concept`, `source`, `synthesis`, `finding`, `thesis`, `methodology`, `comparison`, and `query`.
- Unknown/custom types are shown with fallback file icon, label from `wikiTypeLabel()`, muted color, and order `99`.
- Default expanded groups are `overview`, `entity`, `concept`, and `source`.

Important finding:

- RPG directories could appear in the current UI through the fallback custom-type path, but they would not get intended labels, icons, order, default expansion, or RPG-specific display priority.

### Page Preview And Frontmatter

- `src/components/layout/preview-panel.tsx`
- `src/components/editor/wiki-editor.tsx`
- `src/components/editor/wiki-reader.tsx`
- `src/components/editor/frontmatter-panel.tsx`
- `src/lib/wiki-type-style.ts`

Key behavior:

- `PreviewPanel` reads selected files and renders Markdown through `WikiEditor`/`WikiReader`.
- `WikiReader` resolves `[[wikilinks]]` against the full wiki tree.
- `FrontmatterPanel` uses `getWikiTypeStyle()` to style type chips and only has explicit styles for legacy/research types plus `event` and `overview`.
- Source chips resolve source references against `raw/sources`, not `wiki/sources`.

Important finding:

- Rendering and wikilink navigation are mostly category-agnostic. Type chip styling and source reference resolution are the category-sensitive parts.

## Query, Search, And Agent Usage Entry Points

### Chat Retrieval

- `src/components/chat/chat-panel.tsx`
- `src/lib/search.ts`
- `src-tauri/src/commands/search.rs`
- `src/lib/graph-relevance.ts`

Key behavior:

- `ChatPanel.handleSend()` reads `purpose.md` and `wiki/index.md`, calls `searchWiki()`, expands results through `buildRetrievalGraph()` and `getRelatedNodes()`, reads selected pages, and builds a QA-oriented prompt.
- `searchWiki()` invokes backend `search_project`.
- `search_project_inner()` scans all Markdown files under `wiki/` recursively and scores by keyword and optional vector search.
- `graph-relevance.ts` builds graph nodes from all Markdown files under `wiki/`, extracts `type` from frontmatter, and uses legacy `TYPE_AFFINITY` for entity/concept/source/query/synthesis relationships.
- `ChatPanel` currently treats all pages as normal knowledge-QA context; it does not reserve mandatory RPG context such as `current-scene`, `player`, `rules`, recent events, or style.

Important finding:

- Backend search is already directory-agnostic and will find RPG pages once they exist. RPG mode still needs retrieval priority logic because the current chat retrieval may omit mandatory dynamic state.

### Graph View And Type Affinity

- `src/lib/wiki-graph.ts`
- `src/lib/graph-relevance.ts`

Key behavior:

- `wiki-graph.ts` reads all Markdown files under `wiki/`, extracts `type`, excludes `query` nodes from the visual graph, and computes community layout.
- `graph-relevance.ts` type affinity only knows legacy semantic types.

Important finding:

- RPG pages will be graph-visible if they have frontmatter and links, but relationship weighting will fall back to generic affinity unless RPG type affinities are added later.

## Tests And Fixtures With Legacy Assumptions

Important test/fixture locations found during Stage 01:

- `src/lib/wiki-page-types.test.ts`
- `src/lib/wiki-type-style.test.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/lib/ingest.scenarios.test.ts`
- `src/lib/ingest-parse.test.ts`
- `src/lib/ingest-sanitize.test.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`
- `src/test-helpers/scenarios/sweep-scenarios.ts`
- `src/test-helpers/scenarios/search-scenarios.ts`
- `src/test-helpers/real-content.ts`
- `src/lib/wiki-page-resolver.test.ts`
- `src/lib/wiki-page-delete.test.ts`
- `src/stores/lint-store.test.ts`

Observed assumptions:

- Many ingest scenarios expect `wiki/concepts/...` and `wiki/sources/...` output.
- Wiki page type tests assert legacy directory-to-type inference.
- Resolver/delete tests use `wiki/entities`, `wiki/concepts`, and `wiki/sources` paths.
- Real content fixtures mention expected `wiki/entities/*.md` and concept output.

Stage 01 did not modify tests.

## Actual Code vs Existing Documents

Recorded differences:

- `docs/LLMWIKIRPG_ARCHITECTURE_PLAN.md` describes recommended RPG directories including `style/`, `rules/`, and `runtime/`, while `AGENTS.md` and the Stage 02 phase table emphasize the 11 core directories ending at `relationships/` plus `sources/`. This mismatch remains unresolved and should be handled in Stage 02 mapping.
- The phase plan frames Stage 01 as locating `entities`, `concepts`, `sources`, `comparisons`, `synthesis`, `findings`, `methodology`, and `thesis`; actual code also treats `queries` as a major legacy category and save target.
- The current code already has partial support for schema-defined custom directories in `buildGenerationPrompt()` and `inferWikiTypeFromPath()`, so RPG support may not require replacing every legacy hardcoded path at once.
- There is no single existing registry file to replace. A future RPG category registry will need to consolidate behavior currently spread across templates, prompt constants, type inference, UI config, type styles, retrieval affinity, and update semantics.

## Files Likely To Change In Later Stages

### Stage 02: Mapping Documentation

- `docs/RPG_CATEGORY_MAPPING.md`
- `docs/CURRENT_STATE.md`
- `docs/IMPLEMENTATION_LOG.md`

### Stage 03/04: Category Registry And Schema Config

- `src/lib/wiki-page-types.ts`
- `src/lib/wiki-type-style.ts`
- `src/lib/templates.ts`
- Possible new config file such as `src/lib/rpg-categories.ts` or `src/config/rpgCategories.ts`
- Possible schema config file such as `src/lib/rpg-wiki-schema.ts`

### Stage 05: RPG Extraction Prompt

- `src/lib/ingest.ts`
- `src/lib/ingest.prompt.test.ts`
- `src/test-helpers/scenarios/ingest-scenarios.ts`

### Stage 06/07: Backend Storage And Dynamic Updates

- `src/lib/ingest.ts`
- `src/lib/page-merge.ts`
- `src/lib/source-lifecycle.ts`
- `src/lib/wiki-page-delete.ts`
- `src/lib/wiki-cleanup.ts`
- `src/lib/embedding.ts`
- Possible new RPG update module for `current-scene`, `events`, `player`, `characters`, and `relationships`

### Stage 08: Frontend UI

- `src/components/layout/knowledge-tree.tsx`
- `src/components/editor/frontmatter-panel.tsx`
- `src/components/chat/chat-message.tsx`
- `src/components/chat/chat-panel.tsx`
- `src/lib/graph-relevance.ts`
- `src/lib/wiki-graph.ts`

### Stage 09: Legacy Compatibility

- `src/lib/templates.ts`
- `src/lib/wiki-page-types.ts`
- `src/lib/ingest.ts`
- Potential project mode/config file if `wikiMode = "default" | "rpg"` is added.

## Stage 01 Conclusions

- Legacy category support is distributed and prompt/schema-driven rather than registry-driven.
- The parser, writer safety gate, recursive search, and Markdown reader are already flexible enough to handle new directories.
- The main RPG risks are prompt semantics, frontend category presentation, graph/retrieval priorities, embedding ID collisions across directories, and dynamic update behavior.
- No business logic was changed in this stage.
