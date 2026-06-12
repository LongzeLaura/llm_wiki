use std::fs;
use std::path::Path;

use chrono::Local;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::panic_guard::run_guarded;
use crate::types::wiki::WikiProject;

#[tauri::command]
pub fn create_project(name: String, path: String) -> Result<WikiProject, String> {
    run_guarded("create_project", || create_project_impl(name, path))
}

fn create_project_impl(name: String, path: String) -> Result<WikiProject, String> {
    let root = Path::new(&path).join(&name);

    if root.exists() {
        return Err(format!("Directory already exists: '{}'", root.display()));
    }

    let dirs = [
        "raw/sources",
        "raw/assets",
        "wiki/sources",
        "wiki/world",
        "wiki/characters",
        "wiki/characters/runtime",
        "wiki/player",
        "wiki/locations",
        "wiki/locations/runtime",
        "wiki/factions",
        "wiki/factions/runtime",
        "wiki/items",
        "wiki/items/runtime",
        "wiki/outlines",
        "wiki/plot-arcs",
        "wiki/plot-arcs/runtime",
        "wiki/events",
        "wiki/current-scene",
        "wiki/relationships",
        "wiki/relationships/runtime",
        "wiki/style",
        "wiki/rules",
        "wiki/quests",
        "wiki/memory",
    ];
    for dir in &dirs {
        fs::create_dir_all(root.join(dir))
            .map_err(|e| format!("Failed to create directory '{}': {}", dir, e))?;
    }

    let today = Local::now().format("%Y-%m-%d").to_string();

    write_file_inner(root.join("schema.md"), RPG_SCHEMA)?;
    write_file_inner(root.join("purpose.md"), RPG_PURPOSE)?;
    write_file_inner(root.join("wiki/index.md"), RPG_INDEX)?;
    write_file_inner(
        root.join("wiki/log.md"),
        &format!("# Campaign Log\n\n## {today}\n\n- Project created in llmWikiRPG mode\n"),
    )?;
    write_file_inner(root.join("wiki/overview.md"), RPG_OVERVIEW)?;
    for (relative_path, contents) in RPG_SCHEMA_SLOT_TEMPLATES {
        write_file_inner(root.join(relative_path), contents)?;
    }

    fs::create_dir_all(root.join(".obsidian"))
        .map_err(|e| format!("Failed to create .obsidian: {}", e))?;

    write_file_inner(
        root.join(".obsidian/app.json"),
        r#"{
  "attachmentFolderPath": "raw/assets",
  "userIgnoreFilters": [
    ".cache",
    ".llm-wiki",
    ".superpowers"
  ],
  "useMarkdownLinks": false,
  "newLinkFormat": "shortest",
  "showUnsupportedFiles": false
}"#,
    )?;
    write_file_inner(
        root.join(".obsidian/appearance.json"),
        r#"{
  "baseFontSize": 16,
  "theme": "obsidian"
}"#,
    )?;
    write_file_inner(
        root.join(".obsidian/core-plugins.json"),
        r#"{
  "file-explorer": true,
  "global-search": true,
  "graph": true,
  "backlink": true,
  "tag-pane": true,
  "page-preview": true,
  "outgoing-link": true,
  "starred": true
}"#,
    )?;

    Ok(WikiProject {
        name,
        path: root.to_string_lossy().replace('\\', "/"),
    })
}

#[tauri::command]
pub fn open_project(path: String) -> Result<WikiProject, String> {
    run_guarded("open_project", || {
        let root = Path::new(&path);

        validate_wiki_project_root(root)?;

        let name = root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        Ok(WikiProject {
            name,
            path: path.replace('\\', "/"),
        })
    })
}

#[tauri::command]
pub fn open_project_folder(app: AppHandle, path: String) -> Result<(), String> {
    run_guarded("open_project_folder", || {
        let root = Path::new(&path);
        validate_wiki_project_root(root)?;

        let canonical = root
            .canonicalize()
            .map_err(|e| format!("Failed to resolve project path '{}': {}", path, e))?;
        let canonical = canonical.to_string_lossy().to_string();

        match app.opener().open_path(canonical.clone(), None::<&str>) {
            Ok(()) => Ok(()),
            Err(open_err) => app
                .opener()
                .reveal_item_in_dir(canonical)
                .map_err(|reveal_err| {
                    format!(
                        "Failed to open project folder: {}; reveal fallback also failed: {}",
                        open_err, reveal_err
                    )
                }),
        }
    })
}

fn validate_wiki_project_root(root: &Path) -> Result<(), String> {
    if !root.exists() {
        return Err(format!("Path does not exist: '{}'", root.display()));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: '{}'", root.display()));
    }
    if !root.join("schema.md").exists() {
        return Err(format!(
            "Not a valid llmWikiRPG project (missing schema.md): '{}'",
            root.display()
        ));
    }
    if !root.join("wiki").is_dir() {
        return Err(format!(
            "Not a valid llmWikiRPG project (missing wiki/ directory): '{}'",
            root.display()
        ));
    }
    if !is_llmwikirpg_project_root(root)? {
        return Err(format!(
            "Legacy llm_wiki projects are no longer supported. Open an llmWikiRPG project instead: '{}'",
            root.display()
        ));
    }

    Ok(())
}

fn is_llmwikirpg_project_root(root: &Path) -> Result<bool, String> {
    let project_meta = root.join(".llm-wiki/project.json");
    if project_meta.exists() {
        let raw = fs::read_to_string(&project_meta).map_err(|e| {
            format!(
                "Failed to read project metadata '{}': {}",
                project_meta.display(),
                e
            )
        })?;
        let lower = raw.to_lowercase();
        if lower.contains(r#""mode": "default""#) || lower.contains(r#""mode":"default""#) {
            return Ok(false);
        }
        if lower.contains("llmwikirpg") || lower.contains(r#""mode": "rpg""#) {
            return Ok(has_core_rpg_dirs(root));
        }
    }

    let schema = fs::read_to_string(root.join("schema.md"))
        .unwrap_or_default()
        .to_lowercase();
    if schema.contains("wikimode: default") || schema.contains("wikimode = \"default\"") {
        return Ok(false);
    }

    Ok(
        (schema.contains("wikimode: llmwikirpg") || schema.contains("wikimode: rpg"))
            && has_core_rpg_dirs(root),
    )
}

fn has_core_rpg_dirs(root: &Path) -> bool {
    [
        "wiki/sources",
        "wiki/world",
        "wiki/characters",
        "wiki/player",
        "wiki/locations",
        "wiki/factions",
        "wiki/items",
        "wiki/plot-arcs",
        "wiki/events",
        "wiki/current-scene",
        "wiki/relationships",
    ]
    .iter()
    .all(|dir| root.join(dir).is_dir())
}

fn write_file_inner(path: std::path::PathBuf, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create parent dirs for '{}': {}",
                path.display(),
                e
            )
        })?;
    }
    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file '{}': {}", path.display(), e))
}

const RPG_SCHEMA_SLOT_TEMPLATES: &[(&str, &str)] = &[
    (
        "wiki/world/basic_overview.md",
        "# World Basic Overview\n\n## Runtime Capsule\n\n<!-- Core premise, era, primary stage, genre, atmosphere, and broad world background. -->\n",
    ),
    (
        "wiki/world/history.md",
        "# World History\n\n## Runtime Capsule\n\n<!-- Established world history, eras, and public past events. Current campaign events belong in wiki/events/. -->\n",
    ),
    (
        "wiki/world/common_sense.md",
        "# World Common Sense\n\n## Runtime Capsule\n\n<!-- Public knowledge, everyday assumptions, customs, taboos, and common beliefs. -->\n",
    ),
    (
        "wiki/world/supernatural_presence.md",
        "# Supernatural Presence\n\n## Runtime Capsule\n\n<!-- How magic, technology, monsters, anomalies, mysteries, or other extraordinary elements visibly exist. Mechanics belong in wiki/rules/. -->\n",
    ),
    (
        "wiki/world/social_structure.md",
        "# Social Structure\n\n## Runtime Capsule\n\n<!-- Social order, law, economy, public power structure, and broad institutions. Specific organizations belong in wiki/factions/. -->\n",
    ),
    (
        "wiki/outlines/main.md",
        "# Main Outline\n\n## Runtime Capsule\n\n<!-- Author/GM-side future outline. Keep empty until explicitly filled. -->\n\n## Act Structure\n\n<!-- Planned beats, reveal order, and branch conditions. -->\n",
    ),
    (
        "wiki/outlines/progress.md",
        "# Outline Progress\n\n## Runtime Capsule\n\n<!-- Runtime-reviewed progress relative to the main outline. -->\n\n## Current Stage\n\n<!-- Current act, beat, completed beats, skipped beats, and divergence notes. -->\n",
    ),
    (
        "wiki/rules/core.md",
        "# Core Rules\n\n## Runtime Capsule\n\n<!-- Core action, safety, success, failure, and constraint rules. -->\n",
    ),
    (
        "wiki/rules/world.md",
        "# World Rules\n\n## Runtime Capsule\n\n<!-- World operation rules that constrain what can happen during play. -->\n",
    ),
    (
        "wiki/rules/table.md",
        "# Table Rules\n\n## Runtime Capsule\n\n<!-- Table procedures, boundaries, and play conventions. -->\n",
    ),
    (
        "wiki/style/narration.md",
        "# Narration Style\n\n## Runtime Capsule\n\n<!-- Global narration voice, pacing, point of view, and descriptive priorities. -->\n",
    ),
    (
        "wiki/style/dialogue.md",
        "# Dialogue Style\n\n## Runtime Capsule\n\n<!-- Global dialogue principles. Character-specific voice belongs in character or relationship pages. -->\n",
    ),
    (
        "wiki/style/forbidden.md",
        "# Forbidden Style\n\n## Runtime Capsule\n\n<!-- Words, patterns, reveals, or presentation choices to avoid. -->\n",
    ),
    (
        "wiki/memory/player-preferences.md",
        "# Player Preferences\n\n## Runtime Capsule\n\n<!-- Player preferences, safety boundaries, and long-term experience requirements. -->\n",
    ),
    (
        "wiki/memory/long-term.md",
        "# Long-Term Memory\n\n## Runtime Capsule\n\n<!-- Long-term context notes that do not yet belong in a more specific wiki directory. -->\n",
    ),
    (
        "wiki/memory/session-notes.md",
        "# Session Notes\n\n## Runtime Capsule\n\n<!-- Recent manual notes or material waiting to be sorted into concrete wiki directories. -->\n",
    ),
    (
        "wiki/current-scene/scene_state.md",
        r#"# Current Scene

## Runtime Capsule

Latest immediate scene snapshot for the next turn. This page is overwrite-only: keep only the state needed to start the next playable turn.

## Campaign Setup Import Shape

Use the `current_scene` campaign setup slot for a file that answers:

- When and where is the first playable moment?
- Who is present, what are they doing, and what is immediately visible?
- What just happened that matters right now?
- What active danger, clock, countdown, or pending reaction must the next turn inherit?

Recommended source headings:

```markdown
# Opening Scene

## Time And Place
...

## Present Characters
...

## Immediate Situation
...

## Visible Objects And Clues
...

## Active Pressure
...

## Player's Immediate Choices
...
```

## Do Not Put Here

- Full backstory or prologue history; put confirmed past events in `wiki/events/prologue.md`.
- Future plans, unrevealed GM notes, or possible routes; keep those in outlines or plot-arcs after review.
- Stable character profiles; put those in `wiki/characters/`.
- Long-term player preferences or table rules; put those in `wiki/memory/` or `wiki/rules/`.
"#,
    ),
    (
        "wiki/player/player.md",
        r#"# Player

## Runtime Capsule

Current player character identity, background, stable facts, and current status summary.

## Campaign Setup Import Shape

Use the `player_main` campaign setup slot for a player profile file. `campaign_setup_import` v0 does not ask an LLM to split or rewrite the profile, so make the source easy to review.

Recommended source headings:

```markdown
# Player Character

## Identity
- Name:
- Pronouns:
- Role/archetype:

## Background
- Origin:
- Important history:
- Ties to the campaign:

## Current Status
- Location:
- Condition:
- Reputation/standing:

## Stable Facts
- Canonical facts that should stay true unless play changes them:
```

If the same source also includes abilities, inventory, goals, or known information, keep those under clear headings so review/manual merge can move them into the fixed player slots.

## Fixed Player Slots

- `wiki/player/player.md`: identity, background, current status, stable PC facts.
- `wiki/player/abilities.md`: abilities, skills, limits, costs, current availability.
- `wiki/player/inventory.md`: held items, quantities, equipped state, consumed/lost state.
- `wiki/player/goals.md`: PC goals, promises, priorities, motivations.
- `wiki/player/known_information.md`: what the PC knows, suspects, misunderstands, or must not yet know.

## Do Not Put Here

- NPC profiles; put those in `wiki/characters/`.
- Table rules or power system rules; put those in `wiki/rules/`.
- Future GM-only plans; keep those in outlines or plot-arcs after review.
"#,
    ),
    (
        "wiki/player/abilities.md",
        r#"# Player Abilities

## Runtime Capsule

Player abilities, skills, limits, costs, and current availability.

## Campaign Setup Source Shape

If you import a player profile, put ability-like content under a clear heading so review can route it here. `campaign_setup_import` v0 warns about ability-like text but does not automatically split it out of `player_main`.

Recommended source headings:

```markdown
## Abilities
- Ability name:
  - What it does:
  - Cost or cooldown:
  - Limits:
  - Current availability:

## Skills
- Skill name:
  - Rank/level:
  - Use cases:
  - Limits:
```

## Do Not Put Here

- Global game rules or world laws; put those in `wiki/rules/`.
- NPC abilities; put stable NPC capabilities in `wiki/characters/`.
- One-turn temporary effects unless they must persist into later play.
"#,
    ),
    (
        "wiki/player/inventory.md",
        r#"# Player Inventory

## Runtime Capsule

Current held items, quantities, equipped state, and consumption state.

## Campaign Setup Source Shape

Use a clear inventory section in the player profile or a separate manual note. `campaign_setup_import` v0 does not automatically split inventory from `player_main`.

Recommended source headings:

```markdown
## Inventory
- Item:
  - Quantity:
  - Equipped/held/stored:
  - Condition:
  - Known properties:
  - Source or owner:

## Resources
- Currency:
- Consumables:
- Ammunition/charges:
```

## Do Not Put Here

- General item lore with no current PC ownership; put that in `wiki/items/`.
- Items merely seen in the scene; put immediate interactables in `wiki/current-scene/scene_state.md`.
- Future rewards not yet obtained.
"#,
    ),
    (
        "wiki/player/goals.md",
        r#"# Player Goals

## Runtime Capsule

PC subjective goals, promises, priorities, and motivations.

## Campaign Setup Source Shape

Use this slot for goals the player character currently recognizes at campaign start. `campaign_setup_import` v0 does not automatically split goals from `player_main`.

Recommended source headings:

```markdown
## Goals
- Goal:
  - Why it matters:
  - Current blocker:
  - Urgency:
  - Success condition:

## Promises And Obligations
- Promise/obligation:
  - To whom:
  - Consequence if ignored:
```

## Do Not Put Here

- GM-only future plot plans; put those in `wiki/outlines/main.md`.
- Confirmed historical events; put those in `wiki/events/`.
- Quest tracking shared by the campaign; put objective records in `wiki/quests/`.
"#,
    ),
    (
        "wiki/player/known_information.md",
        r#"# Player Known Information

## Runtime Capsule

Information the player character knows, suspects, misunderstands, or must not yet know.

## Campaign Setup Source Shape

Use this slot for starting knowledge boundaries. `campaign_setup_import` v0 does not automatically split knowledge from `player_main`, so put knowledge in an obvious section if it is part of the imported player profile.

Recommended source headings:

```markdown
## Known To The PC
- Fact:
  - Source:
  - Confidence:

## Suspicions
- Suspicion:
  - Evidence:
  - Confidence:

## Misunderstandings
- Belief:
  - Why it is wrong or incomplete:

## Not Yet Known To The PC
- Hidden fact:
  - Who knows it:
  - Reveal boundary:
```

## Do Not Put Here

- Information only the real user saw in a parallel scene unless the PC also learned it.
- GM-only future reveals as if the PC knows them.
- Stable world lore unrelated to PC knowledge; put that in `wiki/world/`.
"#,
    ),
];

const RPG_SCHEMA: &str = r#"wikiMode: llmwikirpg

# Wiki Schema - llmWikiRPG

## Project Boundary

- This project schema supports only `llmwikirpg`.
- Legacy directories rejected: `wiki/entities/`, `wiki/concepts/`, `wiki/queries/`, `wiki/comparisons/`, `wiki/synthesis/`, `wiki/methodology/`, `wiki/findings/`, `wiki/thesis/`.
- Existing legacy files may remain on disk, but they are not valid product schema directories or write targets.

## Runtime Wiki Directories

| Path | Layer | Write policy | Contract |
|------|-------|--------------|----------|
| `wiki/sources/` | Evidence | ingest merge/append | Source evidence layer, imported material summaries, provenance, and document-level notes. |
| `wiki/world/` | Fixed stable base slots | ingest/manual merge into fixed slots; runtime blocked | Stable setting, lore, history, common sense, supernatural presence, and social structure. Do not create arbitrary world pages. |
| `wiki/characters/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base character models, canon facts, portrayal rules, and source-supported stable traits. |
| `wiki/characters/runtime/` | Runtime overlay | runtime merge | Current campaign status overlays for characters: condition, intent, temporary resources, and scene-relevant changes. |
| `wiki/player/` | Runtime/base state | runtime/manual merge | Player character identity, abilities, inventory, goals, knowledge, and accepted state. |
| `wiki/locations/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base location setting, layout, access rules, residents, and stable hooks. |
| `wiki/locations/runtime/` | Runtime overlay | runtime merge | Current location status overlays: danger, access, occupants, damage, clues, and temporary atmosphere. |
| `wiki/factions/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base faction identity, agenda, members, resources, and durable relationships. |
| `wiki/factions/runtime/` | Runtime overlay | runtime merge | Current faction stance/resource overlays for campaign-time pressure and temporary moves. |
| `wiki/items/` | Stable base | ingest/manual merge; runtime must not rewrite base pages | Base item identity, capabilities, history, constraints, and plot function. |
| `wiki/items/runtime/` | Runtime overlay | runtime merge | Current holder, location, condition, consumption, loss, damage, or other runtime item state. |
| `wiki/outlines/main.md` | Manual control | manual_or_review_only | Author/GM-side main outline, future beats, reveal order, and branch conditions. |
| `wiki/outlines/progress.md` | Runtime progress | runtime merge through pending/review | Current progress relative to the main outline: active beat, completed/skipped beats, and divergence notes. |
| `wiki/plot-arcs/` | Dynamic derived | derivation/runtime merge | Unresolved conflicts, foreshadowing, possible developments, future pressure, and constraints. |
| `wiki/plot-arcs/runtime/` | Runtime overlay | runtime merge | Current campaign changes to plot arcs, triggered/skipped beats, and pressure changes. |
| `wiki/events/` | Timeline | append/create only | Confirmed events that already happened; never store hypothetical future outcomes as history. |
| `wiki/current-scene/scene_state.md` | Snapshot | overwrite | Latest immediate scene snapshot only. |
| `wiki/relationships/` | Dynamic derived | derivation/runtime merge | Relationship state, trust, tension, dependency, conflict, and relationship-change pressure. |
| `wiki/relationships/runtime/` | Runtime overlay | runtime merge | Current campaign relationship deltas, trust changes, recent conflicts, and new misunderstandings. |
| `wiki/style/` | Manual control | manual_or_review_only | Tone, narration style, dialogue style, forbidden patterns, variables, and presentation conventions. |
| `wiki/rules/` | Manual control | manual_or_review_only | Core rules, world operation rules, table rules, safety boundaries, and runtime constraints. |
| `wiki/quests/` | Objective tracking | manual/runtime merge | Goals, missions, tasks, blockers, completion state, and accepted runtime objective changes. |
| `wiki/memory/` | Explicit memory | manual_or_review_only for player preferences; explicit review for other memory | User-approved memory and reminders; do not infer or write automatically. |
| `wiki/overview.md` | Summary | manual/ingest merge | High-level campaign overview. |
| `wiki/index.md` | Navigation | generated/manual refresh | Navigation index for the RPG wiki. |

## Fixed Schema Slots

New projects must create these fixed slot files. Missing slots mean the project structure is incomplete, not a legacy project compatibility case.

| slotId | path | owner | write policy |
|---|---|---|---|
| `world_basic_overview` | `wiki/world/basic_overview.md` | source_ingest | merge |
| `world_history` | `wiki/world/history.md` | source_ingest | merge |
| `world_common_sense` | `wiki/world/common_sense.md` | source_ingest | merge |
| `world_supernatural_presence` | `wiki/world/supernatural_presence.md` | source_ingest | merge |
| `world_social_structure` | `wiki/world/social_structure.md` | source_ingest | merge |
| `main_outline` | `wiki/outlines/main.md` | control_doc | manual_or_review_only |
| `outline_progress` | `wiki/outlines/progress.md` | runtime | merge through pending/review |
| `rules_core` | `wiki/rules/core.md` | control_doc | manual_or_review_only |
| `rules_world` | `wiki/rules/world.md` | control_doc | manual_or_review_only |
| `rules_table` | `wiki/rules/table.md` | control_doc | manual_or_review_only |
| `style_narration` | `wiki/style/narration.md` | control_doc | manual_or_review_only |
| `style_dialogue` | `wiki/style/dialogue.md` | control_doc | manual_or_review_only |
| `style_forbidden` | `wiki/style/forbidden.md` | control_doc | manual_or_review_only |
| `memory_player_preferences` | `wiki/memory/player-preferences.md` | control_doc | manual_or_review_only |
| `memory_long_term` | `wiki/memory/long-term.md` | control_doc | manual_or_review_only |
| `memory_session_notes` | `wiki/memory/session-notes.md` | control_doc | manual_or_review_only |
| `current_scene` | `wiki/current-scene/scene_state.md` | runtime | overwrite |
| `player_main` | `wiki/player/player.md` | campaign_setup | merge |
| `player_abilities` | `wiki/player/abilities.md` | campaign_setup | merge |
| `player_inventory` | `wiki/player/inventory.md` | campaign_setup | merge |
| `player_goals` | `wiki/player/goals.md` | campaign_setup | merge |
| `player_known_information` | `wiki/player/known_information.md` | campaign_setup | merge |

- `rules/`, `style/`, `wiki/memory/player-preferences.md`, and `wiki/outlines/main.md` are manual_or_review_only control files.
- `wiki/world/` is a fixed slot set. Do not create arbitrary world files; merge extra world subtopics into the five fixed world slots.
- `wiki/outlines/progress.md` is the runtime outline progress slot; runtime may merge it only inside the pending/review apply boundary.
- `wiki/player/` is a fixed slot set. Do not create arbitrary player files; merge extra player subtopics into the five fixed player slots.

## Overlay Resolution

- For `characters`, `locations`, `factions`, and `items`, resolve the base page first, then apply the matching `runtime/` overlay by slug.
- `relationships` and `plot-arcs` also use base plus `runtime/` overlay directories; broad resolver expansion can be refined in a later stage.
- Example: `wiki/characters/rin.md` supplies the stable model; `wiki/characters/runtime/rin.md` supplies current campaign state.
- Runtime agents may merge overlay pages, but base pages are runtime blocked and should only receive ingest/manual stable facts.
- If base and overlay disagree, prefer the overlay for immediate play state and keep the base as the stable/source-supported contract.

## Dynamic Update Rules

- Static ingest output for `characters`, `locations`, `factions`, and `items` writes stable facts to base directories; runtime state writes to the matching `runtime/` overlay.
- Static ingest output for `world` writes only to the five fixed world slots.
- `wiki/current-scene/scene_state.md` is a snapshot and should be overwritten on each accepted scene advance.
- `wiki/events/` is append/create-only history for confirmed happened events.
- `wiki/plot-arcs/` may contain foreshadowing, unresolved questions, and future pressure, but must not invent events as already happened.
- `wiki/player/` updates must target only fixed player slots.
- `wiki/relationships/`, `wiki/quests/`, `wiki/outlines/progress.md`, and runtime overlays should merge accepted state without treating unchosen options as facts.
- Avoid current-state pollution in historical `events`, and avoid writing unresolved future pressure as completed history.
- Preserve `sources:` frontmatter provenance on every generated page.

## Derived Content Frontmatter

```yaml
---
type: relationships
title: "Rin and Player"
derived: true
derivation_source: runtime
sources: []
related: []
---
```

## Generated Page Frontmatter

```yaml
---
type: characters
title: "Tohsaka Rin"
sources: []
related: []
tags: []
---
```
"#;

const RPG_PURPOSE: &str = r#"# Project Purpose - llmWikiRPG

## Campaign Goal

<!-- What campaign, module, setting, or interactive narrative does this wiki track? -->

## Scope

**In scope:**
- World facts that matter during play
- Player and NPC state that has become canon
- Confirmed events, active scene state, and unresolved arcs

**Out of scope:**
- Pure speculation with no narrative support
- Future plans written as if they already happened
- Duplicate notes better stored in existing RPG directories

## Current Focus

<!-- Current chapter, scene, party objective, or campaign focus -->

## Mode Notes

- This project runs in `llmwikirpg` mode.
- Legacy llm_wiki `entities`, `concepts`, and `queries` directories are not supported.
"#;

const RPG_INDEX: &str = r#"# Wiki Index

## Sources

## World

## Characters

## Player

## Locations

## Factions

## Items

## Outlines

## Plot Arcs

## Events

## Current Scene

## Relationships

## Style

## Rules

## Quests

## Memory
"#;

const RPG_OVERVIEW: &str = r#"---
type: overview
title: "Campaign Overview"
tags: []
related: []
---

# Overview

<!-- Summarize the campaign world, active conflicts, party situation, and current trajectory. -->
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn create_project_writes_required_rpg_schema_slots_and_runtime_dirs() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let temp_root = std::env::temp_dir().join(format!("llmwikirpg-project-test-{unique}"));
        fs::create_dir_all(&temp_root).expect("temp root should be created");

        let result = create_project_impl(
            "stage-d-project".to_string(),
            temp_root.to_string_lossy().to_string(),
        )
        .expect("project should be created");
        let root = Path::new(&result.path);

        for dir in [
            "wiki/outlines",
            "wiki/relationships/runtime",
            "wiki/plot-arcs/runtime",
        ] {
            assert!(root.join(dir).is_dir(), "missing required dir: {dir}");
        }

        for (relative_path, _contents) in RPG_SCHEMA_SLOT_TEMPLATES {
            assert!(
                root.join(relative_path).is_file(),
                "missing required slot file: {relative_path}"
            );
        }

        fs::remove_dir_all(&temp_root).expect("temp root should be removed");
    }

    #[test]
    fn create_project_writes_campaign_setup_starter_schema_guidance() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let temp_root =
            std::env::temp_dir().join(format!("llmwikirpg-starter-schema-test-{unique}"));
        fs::create_dir_all(&temp_root).expect("temp root should be created");

        let result = create_project_impl(
            "starter-schema-project".to_string(),
            temp_root.to_string_lossy().to_string(),
        )
        .expect("project should be created");
        let root = Path::new(&result.path);

        let player = fs::read_to_string(root.join("wiki/player/player.md"))
            .expect("player starter file should be readable");
        assert!(player.contains("## Campaign Setup Import Shape"));
        assert!(player.contains("`campaign_setup_import` v0 does not ask an LLM"));
        assert!(player.contains("## Fixed Player Slots"));
        assert!(player.contains("`wiki/player/known_information.md`"));

        let current_scene = fs::read_to_string(root.join("wiki/current-scene/scene_state.md"))
            .expect("current scene starter file should be readable");
        assert!(current_scene.contains("Use the `current_scene` campaign setup slot"));
        assert!(current_scene.contains("## Do Not Put Here"));

        for (relative_path, expected) in [
            ("wiki/player/abilities.md", "## Campaign Setup Source Shape"),
            ("wiki/player/inventory.md", "## Campaign Setup Source Shape"),
            ("wiki/player/goals.md", "## Campaign Setup Source Shape"),
            (
                "wiki/player/known_information.md",
                "## Campaign Setup Source Shape",
            ),
        ] {
            let content = fs::read_to_string(root.join(relative_path))
                .unwrap_or_else(|_| panic!("{relative_path} should be readable"));
            assert!(
                content.contains(expected),
                "{relative_path} missing source-shape guidance"
            );
            assert!(
                content.contains("## Do Not Put Here"),
                "{relative_path} missing boundary guidance"
            );
        }

        fs::remove_dir_all(&temp_root).expect("temp root should be removed");
    }
}
