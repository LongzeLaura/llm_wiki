# Category Registry Usage

Last updated: 2026-05-31

## Purpose

This document records the phase 3 runtime implementation of the category registry introduced in phase 2 design.

The implementation is intentionally small and compatibility-first:

- default runtime behavior still resolves to the legacy category profile
- chemical categories are now represented in code as first-class registry entries
- prompt construction and project bootstrap remain unchanged until later phases

## Runtime Source Of Truth

The authoritative runtime registry now lives in:

- `src/lib/category-registry.ts`

That module defines:

- category metadata records for legacy, chemical, and auxiliary page types
- `legacy-default` and `chemical-default` profiles
- lookup helpers by category id
- lookup helpers by wiki directory
- registry-backed path inference helpers for known category directories

## Current Consumers

Phase 3 rewires only the smallest safe consumers:

- `src/lib/wiki-page-types.ts`
  - known default generation type list still comes from the legacy profile
  - path inference now recognizes both legacy and chemical directories
  - display labels now come from registry metadata when available
- `src/lib/wiki-type-style.ts`
  - chip labels now come from registry metadata
  - chemical category styles are available without changing default behavior

## Compatibility Rules

- `legacy-default` remains the default runtime profile
- `entity`, `concept`, and `source` remain valid and unchanged
- `source` remains the source-summary compatibility category
- chemical directories such as `wiki/catalytic-systems/` and `wiki/evidence-claims/` are now recognized without requiring a storage migration

## Deferred To Later Phases

Phase 3 does not yet:

- switch ingest prompt framing by profile
- change project bootstrap directories in Rust
- migrate stored page frontmatter
- redesign tree or graph presentation around registry metadata

Those follow-up tasks remain intentionally separate so the registry can be reviewed in isolation first.
