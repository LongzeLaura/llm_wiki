# RPG Extraction Evaluation

## Stage

Stage 11: RPG extraction evaluation

## Evaluation Scope

- Review the Stage 10 smoke test report and its mocked output structure.
- Compare the current RPG prompt/schema guidance against the intended Stage 11 quality checks: misrouting, missing fields, dynamic-state pollution, and page granularity.
- Apply only the smallest prompt/schema correction that is directly supported by the Stage 10 evidence.

## Inputs Reviewed

- `docs/RPG_SMOKE_TEST_REPORT.md`
- `docs/RPG_WIKI_SCHEMA.md`
- `docs/RPG_CATEGORY_MAPPING.md`
- `src/lib/rpg-smoke.test.ts`
- `src/lib/ingest.ts`
- `src/lib/rpg-wiki-schema.ts`

## Findings

### 1. Stage 10 validated routing and storage semantics, not real-model extraction quality

The Stage 10 smoke test uses mocked LLM FILE-block output and real filesystem writes. That means it successfully validates:

- RPG directory routing
- `current-scene` overwrite behavior
- `events` append behavior
- helper-level frontend type/mode recognition

It does not directly measure:

- real-model misclassification rates
- field completeness against the schema
- relationship/state summarization quality
- duplicate fact leakage across multiple RPG directories

Conclusion: Stage 11 can only make evidence-backed prompt/schema tightening based on the smoke artifacts. It cannot honestly claim end-to-end real extraction quality is fully validated from the current test setup.

### 2. Confirmed prompt/schema ambiguity around `current-scene` filename

The Stage 10 smoke sequence intentionally included a generated FILE block for `wiki/current-scene/state.md`, and the writer normalized it to `wiki/current-scene/scene_state.md`.

Observed implication:

- storage behavior is correct
- prompt/schema guidance is still loose enough that a model may emit alternate `current-scene` filenames
- that ambiguity is unnecessary because Stage 06/07 already treat `current-scene` as one canonical snapshot target

This is a concrete Stage 11 quality issue because repeated alternate filenames increase the chance of confusing outputs, noisier reviews, and apparent duplication before writer normalization.

## Minimal Fix Applied

### Prompt change

Tightened RPG directory-routing guidance in `src/lib/ingest.ts`:

- `wiki/current-scene/` now explicitly requires the exact file `wiki/current-scene/scene_state.md` for first-version RPG mode
- the rule still preserves schema authority if a future project explicitly overrides that exact file path

### Schema change

Tightened `current-scene` granularity wording in `src/lib/rpg-wiki-schema.ts`:

- changed from an example-style recommendation
- to an exact-file requirement for v1: `current-scene/scene_state.md`

### Test updates

- updated prompt tests to assert the exact-file guidance appears
- updated schema tests to assert the canonical `current-scene` filename is documented

## Issues Recorded But Not Resolved In This Stage

These remain outside the evidence available from Stage 10's mocked setup:

- real-model confusion between `player` and `characters`
- real-model confusion between `events` and `plot-arcs`
- relationship pages degenerating into duplicate character summaries
- missing schema-field coverage in generated pages
- over-fragmented or over-coarse page granularity outside `current-scene`

They should be validated in a later pass using either:

- a real-model manual extraction evaluation on representative RPG inputs, or
- richer deterministic fixtures that intentionally simulate common misroutes and omissions

## Outcome

- Extraction-quality limitations are now documented honestly.
- One smoke-test-backed ambiguity was removed from both prompt and schema guidance.
- No broader routing, storage, compatibility, or frontend refactor was introduced.
