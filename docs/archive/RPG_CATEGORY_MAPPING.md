# RPG Category Mapping

Stage 02 output for mapping the legacy `llm_wiki` category system to the first-version llmWikiRPG directory model. This stage is documentation-only and does not modify business logic.

## Mapping Goals

- Keep legacy `entities`, `concepts`, and `sources` behavior available for compatibility.
- Treat RPG directories as a semantic expansion of the existing wiki model, not as a destructive replacement.
- Make first-version RPG category boundaries explicit before registry, prompt, storage, and UI changes.
- Separate stable setting, dynamic state, historical events, current scene state, relationship state, and source tracking.

## Legacy llm_wiki Categories

The Stage 01 analysis found the following legacy categories in code, templates, prompts, UI, retrieval, or tests:

| Legacy category | Existing role | First-version RPG handling |
| -- | -- | -- |
| `sources` | Evidence/source summaries for imported files and raw materials. | Preserve directly as `sources`. |
| `entities` | General named things such as people, objects, places, and organizations. | Split into concrete RPG entity directories: `characters`, `locations`, `factions`, and `items`; keep legacy directory valid in default/compat mode. |
| `concepts` | Abstract ideas, topics, themes, mechanisms, and high-level notes. | Split into `world`, `plot-arcs`, and `relationships`; parts of rule-like concepts can later move to `rules`. |
| `queries` | Saved assistant answers and query-derived wiki pages. | Keep as legacy/default behavior for now. RPG routing for saved narrative outputs is out of scope for Stage 02. |
| `comparisons` | Cross-page comparisons and contrastive analysis. | No direct first-version RPG directory. Use normal wikilinks or future relationship/plot analysis only when needed. |
| `synthesis` | Higher-level summaries across sources and pages. | Partially maps to `plot-arcs`, `current-scene`, and overview-style pages; no dedicated RPG `synthesis` category in v1. |
| `findings` | Research findings or extracted conclusions. | Map only confirmed narrative facts to `events` or concrete entity pages. Do not map hypotheses to `events`. |
| `methodology` | Research method/process notes. | Not used by first-version RPG categories. Preserve only for legacy templates. |
| `thesis` | Research thesis or central argument pages. | Not used by first-version RPG categories. Preserve only for legacy templates. |

## First-Version RPG Core Categories

The Stage 02 implementation target follows the 11 core directories named by `AGENTS.md` and the phase plan:

| RPG directory | Category class | Update character | Primary role |
| -- | -- | -- | -- |
| `sources` | Source tracking | Append/add source summaries | Records where information came from. |
| `world` | Static or semi-static setting | Cautious merge | Records world background, history, culture, public facts, and stable setting context. |
| `characters` | RPG entity and dynamic state | Merge | Records NPC/static character facts plus important current state changes. |
| `player` | Dynamic player state | Merge | Records player character identity, abilities, inventory, goals, known information, and current state. |
| `locations` | RPG entity and scene state | Merge | Records places, spatial relationships, access conditions, history, and current location state. |
| `factions` | RPG entity and relationship structure | Merge | Records organizations, groups, agendas, members, resources, and attitudes. |
| `items` | RPG entity and inventory/plot object state | Merge | Records equipment, clues, key items, ownership, condition, and plot function. |
| `plot-arcs` | Narrative structure | Merge | Records main arcs, side arcs, unresolved conflicts, foreshadowing, constraints, and likely development. |
| `events` | Historical timeline | Append-first | Records confirmed events that have already happened and their consequences. |
| `current-scene` | Current state snapshot | Overwrite/snapshot | Records only the latest immediate scene context required for the next turn. |
| `relationships` | Dynamic relationship network | Merge | Records relationship state, trust, tension, conflicts, misunderstandings, and relationship changes. |

## Directory Classification

| Classification | Directories | Notes |
| -- | -- | -- |
| Source tracking | `sources` | Evidence layer; should not become the main home for cleaned setting/state facts. |
| Static setting | `world` | Stable or slowly changing setting. Rule-like content is allowed temporarily only until `rules` is introduced. |
| RPG entities | `characters`, `locations`, `factions`, `items` | Replaces most RPG uses of legacy `entities` with specific directories. |
| Dynamic state | `player`, `characters`, `locations`, `factions`, `items`, `plot-arcs`, `relationships` | These require merge-aware updates in later stages. |
| Timeline events | `events` | Only confirmed past events. Future plans and speculation belong in `plot-arcs`. |
| Current scene | `current-scene` | Must stay a current snapshot, not a cumulative log. |
| Relationship network | `relationships` | Tracks pair/group relationship state separately from full character profiles. |

## Legacy-To-RPG Mapping

| Legacy category | RPG target | Mapping rule |
| -- | -- | -- |
| `sources` | `sources` | Directly preserved. Continue using it for raw input summaries, role cards, worldbooks, module text, and imported conversation/source summaries. |
| `entities` | `characters` | People and NPCs move here. Player character should go to `player`, not `characters`. |
| `entities` | `locations` | Places, rooms, regions, facilities, routes, and scene locations move here. |
| `entities` | `factions` | Organizations, families, teams, armies, cults, institutions, and political groups move here. |
| `entities` | `items` | Equipment, props, documents, clues, magical objects, and key items move here. |
| `concepts` | `world` | Stable world facts, history, culture, social norms, public knowledge, and setting assumptions move here. |
| `concepts` | `plot-arcs` | Narrative structure, unresolved mysteries, conflicts, foreshadowing, and possible directions move here. |
| `concepts` | `relationships` | Abstract relationship descriptions move here only when they describe a concrete relationship state or tension. |
| `queries` | no v1 RPG replacement | Preserve as legacy saved-answer behavior. Later stages may add RPG-specific save targets. |
| `comparisons` | no v1 RPG replacement | Preserve for legacy mode. RPG v1 should prefer concrete pages and links rather than comparison pages. |
| `synthesis` | `plot-arcs` | Long-range story synthesis can become plot arc summaries if it describes narrative direction or conflicts. |
| `synthesis` | `current-scene` | Short immediate-context synthesis can become current scene state, but it must be overwritten rather than accumulated. |
| `findings` | `events` | Only confirmed, already-happened narrative findings become events. Do not write predictions or theories to `events`. |
| `findings` | `world` / concrete entity directories | Stable discoveries about the world or entities should be stored on the relevant page instead of as generic findings. |
| `methodology` | not used | No RPG v1 target. Keep legacy behavior untouched. |
| `thesis` | not used | No RPG v1 target. Keep legacy behavior untouched. |

## RPG-To-Legacy Compatibility View

| RPG directory | Legacy compatibility interpretation |
| -- | -- |
| `sources` | Same as legacy `sources`. |
| `characters` | Specialized RPG `entities`. |
| `player` | Specialized dynamic player entity/state, not a legacy category. |
| `locations` | Specialized RPG `entities`. |
| `factions` | Specialized RPG `entities`. |
| `items` | Specialized RPG `entities`. |
| `world` | Specialized RPG `concepts` for setting. |
| `plot-arcs` | Specialized RPG `concepts` or `synthesis` for narrative structure. |
| `events` | Specialized narrative `findings` or timeline facts. |
| `current-scene` | Specialized dynamic snapshot; no safe legacy equivalent. |
| `relationships` | Specialized RPG `concepts` for live relationship state. |

## Source Strategy

`sources` remains a first-version core directory because source traceability is useful for RPG material too. It should contain source summaries and provenance, not the final canonical state of characters, scenes, events, or relationships.

Required source behavior for later stages:

- Imported worldbooks, role cards, module text, historical conversation dumps, and user setting supplements should each receive source summaries under `wiki/sources/`.
- RPG pages should link back to relevant sources when possible.
- Deleting or updating sources must not require deleting RPG category behavior.
- Existing source lifecycle behavior should be preserved unless a later stage explicitly extends it.

## Boundary For `style`, `rules`, And `runtime`

`docs/RPG_WIKI_SCHEMA.md` includes `style/`, `rules/`, and `runtime/`, but the Stage 02 target list and `AGENTS.md` first-version target directories stop at the 11 core directories above.

First-version boundary:

| Directory | Stage 02 decision | Reason |
| -- | -- | -- |
| `style` | Not a core v1 category mapping target. Document as a later schema/runtime extension. | It controls generation style rather than extracted story facts. |
| `rules` | Not a core v1 category mapping target. Temporarily allow stable rule-like information under `world` until a rules category is added. | It is important for RPG quality but outside the phase-plan v1 directory list. |
| `runtime` | Not a persistent extracted wiki category in v1. Defer to later context-pack/runtime stages. | It is a generated working area, not an extracted category equivalent to legacy entities/concepts/sources. |

Later stages may still use these schema sections when designing context compilation, but Stage 02 does not promote them to required category-registry targets.

## First-Version Non-Goals

- Do not delete or rename legacy `entities`, `concepts`, `sources`, `queries`, `comparisons`, `synthesis`, `findings`, `methodology`, or `thesis` paths.
- Do not migrate existing user projects automatically.
- Do not implement `style`, `rules`, or `runtime` as required v1 category registry entries in Stage 02.
- Do not introduce code changes, registry code, prompt changes, storage changes, UI changes, or tests in this stage.
- Do not make `current-scene` a history log.
- Do not write future plans, speculation, or foreshadowing into `events` as if they already happened.
- Do not use `relationships` as a duplicate full character profile store.

## Implementation Implications For Later Stages

- Stage 03 should introduce RPG category metadata for the 11 core directories and keep legacy type inference compatible.
- Stage 04 should turn the schema definitions for the 11 core directories into code-readable configuration, while documenting `style`, `rules`, and `runtime` as deferred or auxiliary schema areas.
- Stage 05 should update prompts to route extracted facts according to this mapping and explicitly distinguish confirmed facts, current state, history, foreshadowing, and speculation.
- Stage 06 and Stage 07 must represent different update modes: append for `events`, overwrite/snapshot for `current-scene`, merge for `player`, `characters`, `relationships`, `plot-arcs`, and other entity directories.
- Stage 08 should present RPG categories with labels/order instead of relying on unknown custom-type fallback.
- Stage 09 should preserve default/legacy behavior and avoid destructive replacement of old directories.
