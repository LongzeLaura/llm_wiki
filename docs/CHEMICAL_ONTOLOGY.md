# llm_wiki_chemical Chemical Ontology

## Purpose

This document is the phase 1 authority for chemical knowledge classification in `llm_wiki_chemical`.

It defines the target domain ontology for zeolite catalysis, catalytic reaction mechanisms, and chemistry-paper knowledge extraction. It is intended to guide later work on:

- extraction schema design
- prompt design
- wiki page routing
- frontend category presentation
- evidence aggregation
- knowledge synthesis

This phase is documentation only. No runtime behavior is changed here.

## Design Context

### Relevant existing code path

Phase 0 analysis shows that the current project still centers its generic taxonomy around `entity`, `concept`, and `source`, with supporting types such as `query`, `comparison`, `synthesis`, `overview`, `finding`, `thesis`, and `methodology`.

The main current control points are:

- `src/lib/templates.ts`
  Default schema text and base wiki type definitions.
- `src-tauri/src/commands/project.rs`
  Default wiki directory initialization such as `wiki/entities`, `wiki/concepts`, and `wiki/sources`.
- `src/lib/ingest.ts`
  Extraction prompt construction and generation routing, including `## Key Entities`, `## Key Concepts`, and generation instructions that still default to `wiki/entities/` and `wiki/concepts/`.
- `src/lib/wiki-page-types.ts`
  Runtime known types and directory-to-type inference.
- `src/lib/wiki-type-style.ts`, `src/components/layout/knowledge-tree.tsx`, and `src/components/graph/graph-view.tsx`
  Type labels, colors, ordering, and graph display.

### Why a new ontology is needed

The generic taxonomy is sufficient for broad note extraction, but it is not a natural representation for catalytic literature. In zeolite catalysis, knowledge is better organized around:

- the catalytic system being studied
- the elementary processes that occur in that system
- the mechanistic network formed by those processes
- the evidence that supports or challenges those claims

Therefore, `llm_wiki_chemical` should not simply rename `entity` and `concept`. It should introduce a chemistry-native ontology that preserves compatibility with the existing system while providing a clearer target for later incremental migration.

## Classification Overview

The authoritative four-layer ontology is:

1. `Catalytic System Layer` / `催化系统层`
2. `Elementary Process Layer` / `基元过程层`
3. `Mechanistic Network Layer` / `机理网络层`
4. `Evidence and Validation Layer` / `证据与验证层`

These are not flat tags. They form a dependency structure:

- `Catalytic System Layer` answers: what system is being studied?
- `Elementary Process Layer` answers: what events occur in that system?
- `Mechanistic Network Layer` answers: how do those events combine into pathways, cycles, or networks?
- `Evidence and Validation Layer` answers: what supports, limits, or challenges the system/process/mechanism claims?

### Engineering interpretation

For later implementation, the four layers should be treated as the chemical ontology core, while the current generic page types should be treated as compatibility-era storage and rendering categories until migration is complete.

## Layer 1: Catalytic System Layer

### Names

- Chinese name: `催化系统层`
- English name: `Catalytic System Layer`
- Short engineering label: `catalytic_system`

### Core question

What catalytic system is being studied?

### Definition

This layer describes the complete catalytic system investigated in a paper, section, or claim context. It includes not only explicit objects such as reactants, products, and catalyst materials, but also the system-defining environment that controls catalytic behavior.

For zeolite catalysis, the following are part of the catalytic system itself rather than optional metadata:

- zeolite framework topology
- active site identity
- local coordination environment
- pore, channel, and cage environment
- confinement environment
- catalyst state
- reaction conditions

This layer should be understood as a layer of catalytic system descriptors, not merely a bag of generic entities.

### What should be extracted from papers

This layer should extract the objects, environments, and conditions that define the studied catalytic system, including but not limited to:

- reactants
- products
- adsorbates
- intermediates
- catalyst material
- zeolite framework
- active sites
- Brønsted acid sites
- Lewis acid sites
- metal sites
- pore, cage, and channel environment
- confinement environment
- surface state
- catalyst state
- reaction conditions
- temperature
- pressure
- feed composition
- space velocity
- time on stream

### Recommended fields

- `name`
- `chinese_name`
- `english_name`
- `system_type`
- `role`
- `chemical_formula`
- `catalyst_material`
- `zeolite_framework`
- `active_site_type`
- `local_environment`
- `pore_or_cage_environment`
- `surface_or_catalyst_state`
- `reaction_conditions`
- `related_species`
- `source_paper`
- `source_sentence`
- `confidence`
- `notes`

### Field explanations

- `name`: normalized canonical name for the extracted catalytic-system descriptor.
- `chinese_name`: preferred Chinese label for display and Chinese-language review.
- `english_name`: preferred English label for cross-paper normalization.
- `system_type`: descriptor subtype such as `reactant`, `product`, `intermediate`, `catalyst_material`, `active_site`, `framework`, `condition`, or `environment`.
- `role`: function within the catalytic system such as `reactant`, `product`, `adsorbate`, `intermediate`, `catalyst`, `active_site`, or `confinement_environment`.
- `chemical_formula`: chemical formula when applicable.
- `catalyst_material`: catalyst material identity such as `H-ZSM-5`, `SAPO-34`, or `Ga/H-ZSM-5`.
- `zeolite_framework`: framework code such as `MFI`, `CHA`, `BEA`, or `FAU`.
- `active_site_type`: active site category such as `Brønsted acid site`, `Lewis acid site`, or `metal site`.
- `local_environment`: local chemical environment such as Al distribution, neighboring acid sites, metal coordination, or nearby heteroatoms.
- `pore_or_cage_environment`: channel, cage, pore, or confinement-space description.
- `surface_or_catalyst_state`: catalyst state under reaction or pretreatment conditions, for example protonated, coked, hydrated, reduced, or oxidized.
- `reaction_conditions`: structured description of temperature, pressure, feed, WHSV, partial pressures, and time on stream.
- `related_species`: linked species in the same system context.
- `source_paper`: paper-level source identity.
- `source_sentence`: evidence sentence or sentence span that supports the extraction.
- `confidence`: extraction confidence, either numeric or ordinal.
- `notes`: free-text curation notes, ambiguity notes, or normalization notes.

## Layer 2: Elementary Process Layer

### Names

- Chinese name: `基元过程层`
- English name: `Elementary Process Layer`
- Short engineering label: `elementary_process`

### Core question

What elementary processes occur in the catalytic system?

### Definition

This layer captures the basic events that occur in the catalytic system. These include chemical elementary steps, surface events, transport events, and deactivation or regeneration events.

For zeolite catalysis, this layer must include both:

1. chemical elementary steps
2. transport and confinement-related processes

This is necessary because catalytic behavior depends not only on reaction chemistry at a site, but also on pore topology, diffusion, confinement, and deactivation dynamics.

### What should be extracted from papers

This layer should extract process-level statements including but not limited to:

- adsorption
- desorption
- protonation
- deprotonation
- surface reaction
- bond formation
- bond cleavage
- C-C bond formation
- C-C bond cleavage
- hydride transfer
- methylation
- cracking
- isomerization
- oligomerization
- cyclization
- aromatization
- diffusion
- pore crossing
- cage-to-cage migration
- coke formation
- site poisoning
- site regeneration

### Recommended fields

- `process_name`
- `chinese_name`
- `english_name`
- `process_type`
- `participants`
- `reactant_species`
- `product_species`
- `intermediate_species`
- `catalyst_or_site_involved`
- `location`
- `directionality`
- `energetic_information`
- `kinetic_information`
- `condition_dependency`
- `role_in_mechanism`
- `source_paper`
- `source_sentence`
- `confidence`
- `notes`

### Field explanations

- `process_name`: canonical label for the process instance or normalized process class.
- `chinese_name`: preferred Chinese label.
- `english_name`: preferred English label.
- `process_type`: normalized process class such as `adsorption`, `desorption`, `protonation`, `hydride_transfer`, `diffusion`, or `coke_formation`.
- `participants`: all participants including molecules, adsorbates, sites, or environments.
- `reactant_species`: species or state before the process.
- `product_species`: species or state after the process.
- `intermediate_species`: intermediates directly associated with the process.
- `catalyst_or_site_involved`: catalyst, site, or catalytic motif responsible for the process.
- `location`: process location such as external surface, straight channel, sinusoidal channel, CHA cage, or Brønsted site.
- `directionality`: forward, reverse, reversible, or directional migration when relevant.
- `energetic_information`: barrier, reaction energy, adsorption energy, or other thermodynamic descriptors.
- `kinetic_information`: rate constant, apparent order, turnover frequency, or kinetic expression.
- `condition_dependency`: dependence on temperature, pressure, feed composition, coverage, water, or time on stream.
- `role_in_mechanism`: mechanistic role such as `rate_determining`, `selectivity_controlling`, `initiation_step`, `propagation_step`, `deactivation_step`, or `regeneration_step`.
- `source_paper`: paper-level source identity.
- `source_sentence`: source sentence supporting the process statement.
- `confidence`: extraction confidence, either numeric or ordinal.
- `notes`: ambiguity notes, competing interpretations, or normalization notes.

## Layer 3: Mechanistic Network Layer

### Names

- Chinese name: `机理网络层`
- English name: `Mechanistic Network Layer`
- Short engineering label: `mechanistic_network`

### Core question

How do elementary processes combine into a reaction mechanism?

### Definition

This layer describes how multiple elementary processes connect into pathways, cycles, competing routes, partial subnetworks, or complete mechanisms.

Its key principle is that mechanism knowledge is network-structured rather than only list-structured. A mechanism is not just a sequence of steps; it is a graph of species, states, processes, cycles, branch points, and control relationships.

This layer must support typical catalytic constructs such as:

- olefin cycle
- aromatic cycle
- dual-cycle mechanism
- hydrocarbon-pool mechanism
- coke formation pathway
- diffusion-limited route
- deactivation pathway

### What should be extracted from papers

This layer should extract mechanism-level claims including but not limited to:

- reaction pathway
- reaction network
- catalytic cycle
- hydrocarbon-pool cycle
- olefin cycle
- aromatic cycle
- dual-cycle mechanism
- rate-determining step
- selectivity-controlling step
- dominant pathway
- competing pathway
- side reaction pathway
- deactivation pathway
- coke formation pathway
- diffusion-limited route
- microkinetic network

### Recommended fields

- `mechanism_name`
- `chinese_name`
- `english_name`
- `mechanism_type`
- `involved_processes`
- `involved_species`
- `involved_sites`
- `pathway_sequence`
- `network_nodes`
- `network_edges`
- `dominant_pathway`
- `competing_pathways`
- `rate_determining_step`
- `selectivity_controlling_step`
- `deactivation_route`
- `evidence_summary`
- `supported_claims`
- `challenged_claims`
- `source_paper`
- `source_sentence`
- `confidence`
- `notes`

### Field explanations

- `mechanism_name`: canonical mechanism or pathway name.
- `chinese_name`: preferred Chinese label.
- `english_name`: preferred English label.
- `mechanism_type`: normalized class such as `catalytic_cycle`, `reaction_network`, `dominant_pathway`, `deactivation_pathway`, or `microkinetic_network`.
- `involved_processes`: links to the elementary processes that compose the mechanism.
- `involved_species`: linked reactants, intermediates, products, and retained species.
- `involved_sites`: relevant sites, environments, pores, cages, or catalyst states.
- `pathway_sequence`: explicit ordered sequence if the paper states one.
- `network_nodes`: graph nodes, usually species, states, sites, or submechanisms.
- `network_edges`: graph edges, usually mapped to elementary processes or causal relations.
- `dominant_pathway`: pathway identified as dominant under specific conditions.
- `competing_pathways`: alternative or competing pathways.
- `rate_determining_step`: linked process or claim identified as rate controlling.
- `selectivity_controlling_step`: linked process or claim identified as selectivity controlling.
- `deactivation_route`: route responsible for deactivation or coke accumulation.
- `evidence_summary`: concise summary of the main supporting or limiting evidence.
- `supported_claims`: mechanism claims supported by evidence.
- `challenged_claims`: mechanism claims challenged, constrained, or rejected by evidence.
- `source_paper`: paper-level source identity.
- `source_sentence`: sentence supporting the mechanism statement.
- `confidence`: extraction confidence, either numeric or ordinal.
- `notes`: ambiguity notes, competing mechanism notes, or normalization notes.

## Layer 4: Evidence and Validation Layer

### Names

- Chinese name: `证据与验证层`
- English name: `Evidence and Validation Layer`
- Short engineering label: `evidence_claim`

### Core question

What supports or challenges the proposed catalytic system, elementary processes, and mechanism?

### Definition

This layer records the evidence that supports, challenges, limits, or partially validates a chemical claim.

Its defining rule is that evidence is claim-centered. The goal is not only to list methods such as IR, NMR, DFT, or kinetics, but to link each evidence item to a specific claim about:

- a species
- an active site
- an elementary process
- a pathway or mechanism
- a rate or selectivity control statement

### What should be extracted from papers

This layer should extract evidence statements including but not limited to:

- spectroscopy
- IR spectroscopy
- NMR spectroscopy
- Raman spectroscopy
- isotope labeling
- kinetic measurement
- product distribution
- transient experiment
- operando characterization
- in situ characterization
- DFT calculation
- adsorption energy calculation
- transition state calculation
- microkinetic modeling
- molecular simulation
- diffusion simulation
- literature precedent
- expert interpretation
- contradiction, limitation, or conflict evidence

### Recommended fields

- `claim`
- `claim_type`
- `target_layer`
- `target_object`
- `evidence_type`
- `evidence_method`
- `evidence_result`
- `support_relation`
- `strength`
- `limitation`
- `experimental_or_computational`
- `conditions`
- `source_paper`
- `source_sentence`
- `figure_or_table_reference`
- `confidence`
- `notes`

### Field explanations

- `claim`: the chemical statement being supported, challenged, or limited.
- `claim_type`: claim category such as `species_identification`, `active_site_assignment`, `elementary_process`, `mechanism`, `rate_control`, or `selectivity_control`.
- `target_layer`: the ontology layer targeted by the evidence, usually `catalytic_system`, `elementary_process`, or `mechanistic_network`.
- `target_object`: the specific object, process, pathway, or mechanism being evaluated.
- `evidence_type`: normalized evidence class such as `spectroscopy`, `isotope_labeling`, `kinetics`, `DFT`, or `microkinetic_modeling`.
- `evidence_method`: specific method such as `IR`, `13C NMR`, `D labeling`, or `DFT transition-state calculation`.
- `evidence_result`: concise result statement.
- `support_relation`: relation such as `supports`, `challenges`, `partially_supports`, `contradicts`, or `limits`.
- `strength`: evidence strength such as `weak`, `moderate`, or `strong`, or a richer text label.
- `limitation`: explicit limitation, uncertainty, boundary condition, or unresolved ambiguity.
- `experimental_or_computational`: whether the evidence is experimental, computational, or hybrid.
- `conditions`: experimental or computational conditions under which the evidence applies.
- `source_paper`: paper-level source identity.
- `source_sentence`: sentence or sentence span providing the evidence statement.
- `figure_or_table_reference`: figure, scheme, or table identifier when available.
- `confidence`: extraction confidence, either numeric or ordinal.
- `notes`: curator notes, conflict notes, or normalization notes.

## Cross-Layer Relationships

The intended semantic dependency is:

- `Catalytic System Layer` provides the system context.
- `Elementary Process Layer` references species, sites, and conditions from the catalytic system.
- `Mechanistic Network Layer` composes one or more elementary processes into pathways or networks.
- `Evidence and Validation Layer` targets claims in one or more of the first three layers.

### Recommended relationship patterns

- `catalytic_system -> contains -> species_or_site`
- `elementary_process -> occurs_in -> catalytic_system`
- `elementary_process -> transforms -> species`
- `mechanistic_network -> composed_of -> elementary_process`
- `mechanistic_network -> depends_on -> catalytic_system`
- `evidence_claim -> supports/challenges -> catalytic_system | elementary_process | mechanistic_network`

## Relationship to the Original llm_wiki Taxonomy

The new chemical ontology should be treated as an interpretation layer over the current generic taxonomy, not as a blind string replacement.

### Relationship to `entity`

In the original system, `entity` is a broad extracted object class. In `llm_wiki_chemical`, that generic bucket is too coarse.

Recommended remapping:

- `entity` as reactant, product, adsorbate, intermediate, catalyst, active site, framework, or condition descriptor
  Map primarily to `Catalytic System Layer`.
- `entity` as adsorption, protonation, diffusion, cracking, or coke formation event
  Map to `Elementary Process Layer`.
- `entity` as hydrocarbon-pool mechanism, dual-cycle mechanism, or reaction pathway
  Map to `Mechanistic Network Layer`.
- `entity` as IR, NMR, DFT, isotope-labeling result, or kinetic evidence item
  Map to `Evidence and Validation Layer`.

### Relationship to `concept`

`concept` can remain useful as a generic abstraction label during migration, but it should not be the final chemistry ontology target.

Recommended handling:

- system-level explanatory concepts such as `confinement effect`, `shape selectivity`, or `acid site distribution`
  Attach to `Catalytic System Layer`.
- process concepts such as `hydride transfer`, `methylation`, or `cracking`
  Map to `Elementary Process Layer` when claimed as concrete events; otherwise retain as abstract concept metadata.
- mechanism concepts such as `hydrocarbon-pool mechanism` or `dual-cycle mechanism`
  Map to `Mechanistic Network Layer` when asserted as mechanism claims.
- evidence concepts such as `operando evidence` or `isotope labeling evidence`
  Map to `Evidence and Validation Layer`.

### Relationship to `source`

`source` remains essential, but in the chemical ontology it must serve traceability rather than act as a sufficient semantic category by itself.

Recommended handling:

- keep `source` as document provenance
- require tighter linkage to `source_paper`, `source_sentence`, and when possible `figure_or_table_reference`
- require the evidence layer to be strongly source-linked
- keep source traceability available for the other three layers as well

### Relationship to other existing types

Phase 0 also identified non-core types such as `query`, `comparison`, `synthesis`, `overview`, `finding`, `thesis`, and `methodology`.

These should currently be treated as auxiliary knowledge-product types rather than ontology-core chemical layers:

- `overview` remains a structural project page
- `source` remains provenance-oriented
- `query`, `comparison`, and `synthesis` remain user-facing synthesis outputs
- `finding`, `thesis`, and `methodology` may later align with evidence summaries or synthesis products, but they are not substitutes for the four-layer ontology

## Recommended Future Schemas

These are design suggestions only for later phases. They are not implemented in phase 1.

### Option A: layer-first schema

- `catalytic_system`
- `elementary_process`
- `mechanistic_network`
- `evidence_claim`

### Option B: object-family schema

- `ChemicalEntity`
- `ChemicalProcess`
- `ChemicalMechanism`
- `ChemicalEvidence`
- `ChemicalCategory`

### Recommendation

Prefer option A for runtime routing and storage because it aligns directly with the four-layer ontology and makes downstream prompting, browsing, and synthesis more explicit.

## Extraction Examples

The following examples are illustrative and may be synthetic, but they match the intended extraction style for catalytic literature.

### Example 1: Catalytic System Layer

Source sentence:

`Methanol conversion was studied over H-ZSM-5 with Brønsted acid sites located inside the MFI channels at 400 °C.`

Recommended extraction:

- `catalyst_material: H-ZSM-5`
- `zeolite_framework: MFI`
- `active_site_type: Brønsted acid site`
- `local_environment: inside MFI channels`
- `role: catalyst / active_site`
- `reactant: methanol`
- `reaction_conditions: 400 °C`
- `source_sentence: original sentence`

### Example 2: Elementary Process Layer

Source sentence:

`Surface methoxy species are formed by methanol dehydration on Brønsted acid sites.`

Recommended extraction:

- `process_name: surface methoxy formation`
- `process_type: dehydration`
- `reactant_species: methanol`
- `product_species: surface methoxy species`
- `catalyst_or_site_involved: Brønsted acid site`
- `role_in_mechanism: initiation_step`

### Example 3: Mechanistic Network Layer

Source sentence:

`The product distribution suggests that the olefin cycle dominates at short contact times, whereas the aromatic cycle becomes more important with increasing time on stream.`

Recommended extraction:

- `mechanism_name: dual-cycle mechanism`
- `mechanism_type: competing_pathway_network`
- `dominant_pathway: olefin cycle at short contact times`
- `competing_pathways: aromatic cycle`
- `pathway_sequence: condition-dependent competition`
- `involved_processes: methylation, cracking, hydride transfer, aromatization`
- `notes: pathway dominance changes with time on stream`

### Example 4: Evidence and Validation Layer

Source sentence:

`13C isotope labeling experiments confirmed that retained hydrocarbon species contribute to the formation of light olefins.`

Recommended extraction:

- `claim: retained hydrocarbon species contribute to light olefin formation`
- `claim_type: mechanism`
- `target_layer: mechanistic_network`
- `target_object: hydrocarbon-pool mechanism`
- `evidence_type: isotope_labeling`
- `evidence_method: 13C isotope labeling`
- `support_relation: supports`
- `strength: strong`

### Example 5: Cross-layer linked example

Source sentence:

`DFT calculations indicate that methylation in the straight channel has a lower barrier than in the channel intersection, supporting the preferential olefin-cycle route in H-ZSM-5.`

Recommended extraction:

- Catalytic system:
  `catalyst_material: H-ZSM-5`, `zeolite_framework: MFI`, `pore_or_cage_environment: straight channel / channel intersection`
- Elementary process:
  `process_name: methylation`, `location: straight channel`, `energetic_information: lower barrier`
- Mechanistic network:
  `dominant_pathway: olefin cycle`
- Evidence:
  `evidence_type: DFT`, `claim: methylation in straight channels preferentially supports olefin-cycle propagation`, `support_relation: supports`

## Boundary Rules and Common Confusions

### 1. Intermediate: system or process?

- If an intermediate is being identified as a species present in the catalytic system, classify it in `Catalytic System Layer`.
- If the focus is on its formation, transformation, or consumption event, classify that statement in `Elementary Process Layer`.

Recommended rule:

- species identity belongs to layer 1
- species transformation belongs to layer 2

### 2. Is `hydride transfer` a concept or an elementary process?

- As a general explanatory notion, it can remain concept-like metadata during migration.
- As a concrete step in a claimed pathway, it belongs in `Elementary Process Layer`.

Recommended rule:

- abstract explanation -> concept-compatible metadata
- concrete event claim -> layer 2

### 3. Is `hydrocarbon-pool` a species, concept, or mechanism?

- As retained hydrocarbon species or pool constituents, it can appear in `Catalytic System Layer`.
- As `hydrocarbon-pool mechanism`, it belongs in `Mechanistic Network Layer`.
- As background explanation without a concrete paper claim, it may remain concept-like metadata.

Recommended rule:

- pool species -> layer 1
- pool mechanism -> layer 3
- abstract background term -> concept-compatible metadata

### 4. Is DFT a source, evidence, or method?

- DFT as a method belongs in `evidence_method`.
- DFT outputs such as barriers or adsorption energies belong in `evidence_result`.
- The actual paper or computation record belongs in `source`.
- What DFT supports or challenges must be expressed through `claim`.

Recommended rule:

- method != claim != source

### 5. Are reaction conditions part of the system layer or evidence layer?

- Conditions that define the catalytic experiment belong in `Catalytic System Layer`.
- Conditions under which a given evidence item was obtained may also be recorded in the evidence layer `conditions` field.

Recommended rule:

- experiment-defining conditions -> layer 1
- evidence-specific measurement conditions -> layer 4

### 6. Is diffusion an elementary process or part of mechanism?

- A single diffusion event, pore crossing, or cage migration belongs in `Elementary Process Layer`.
- A diffusion-limited route or transport-controlled pathway belongs in `Mechanistic Network Layer`.

Recommended rule:

- event -> layer 2
- route-level mechanistic consequence -> layer 3

## Implementation Guidance for Later Phases

The following recommendations are intentionally incremental and preserve the current project behavior as much as possible.

### 1. Introduce a schema or registry layer before deleting generic categories

Do not remove `entity`, `concept`, or `source` outright. First add a chemistry-aware schema or registry that maps current runtime types to the four-layer ontology.

Recommended direction:

- add a `chemical category registry`
- keep compatibility with current frontmatter `type`
- allow schema-driven routing by project template

### 2. Add explicit ontology fields to extracted records

Later extraction outputs should prefer carrying:

- `layer`
- `type`
- `source_sentence`
- `source_paper`
- `confidence`
- optionally `claim_id`, `process_id`, or `mechanism_id`

This can coexist with existing markdown-based storage.

### 3. Adapt prompt design incrementally

Later prompt changes should proceed in this order:

1. weaken hardcoded `entity/concept` wording in generation prompts
2. allow schema-defined chemical folders and chemical type labels
3. change analysis prompts from `Key Entities` and `Key Concepts` to four-layer chemical extraction instructions
4. only then revisit page-generation defaults and project templates

### 4. Support layer-aware storage and routing

Future schema and storage design should support records or pages whose semantics are explicit even if they remain markdown files.

Suggested future frontmatter additions:

- `layer`
- `type`
- `claim_type`
- `target_layer`
- `target_object`
- `source_sentence`
- `confidence`

### 5. Support four-layer browsing in the frontend

The frontend should eventually allow browsing by:

- `Catalytic System`
- `Elementary Process`
- `Mechanistic Network`
- `Evidence and Validation`

This should be implemented through registry-driven labels, colors, ordering, and icons rather than a large hardcoded rewrite.

### 6. Prioritize claim-centered synthesis

Later knowledge synthesis should prioritize:

- composing multiple elementary processes into a mechanistic network
- aggregating multiple evidence claims onto a process or mechanism claim
- detecting conflicting evidence
- distinguishing mechanisms under different catalytic-system conditions

### 7. Consider a claim-centered evidence graph

A strong later-phase direction is a claim-centered evidence graph in which:

- nodes may include species, sites, processes, mechanisms, and claims
- edges may include `supports`, `challenges`, `depends_on`, and `composed_of`
- evidence remains traceable to paper, sentence, and figure scope

## Conflict Handling with Phase 0 Documents

If any phase 0 document describes the current codebase in a way that implies `entity/concept/source` should remain the final chemistry taxonomy, this document takes precedence for the target ontology design.

Reason:

- phase 0 documents describe the current implementation and its constraints
- phase 1 defines the target domain ontology for later implementation

This is not a contradiction in project direction. It is a deliberate separation between current runtime behavior and target chemistry-native semantics.

## Minimal Change Plan for Phase 2 and Beyond

Recommended next implementation order:

1. define a chemical category registry and schema mapping
2. update project template schema text to include chemical layers
3. update generation prompt routing to prefer chemical schema destinations
4. update analysis prompts to use four-layer extraction framing
5. update frontend type presentation through registry lookup
6. review delete, resolver, and dedup flows that still assume `wiki/entities` and `wiki/concepts`

## Phase 1 Output Summary

This document completes the phase 1 ontology-definition task by:

- defining the four-layer chemical ontology
- specifying extraction targets for each layer
- recommending fields and field semantics
- mapping the ontology to the existing `llm_wiki` taxonomy
- documenting examples and classification boundaries
- proposing an incremental implementation direction without modifying runtime code
