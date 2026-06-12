import { campaignSetupImportContract } from "./campaign-setup"
import {
  controlDocCanonicalizationInteractionSpec,
  controlDocImportContract,
} from "./control-doc"
import type { RpgInteractionKind, RpgInteractionPrompt, RpgInteractionSpec } from "./interaction-spec"
import { pageMergeInteractionSpec } from "./merge"
import {
  actionResolverInteractionSpec,
  narrationGeneratorInteractionSpec,
  outlineBriefInteractionSpec,
  recallSelectorInteractionSpec,
  runtimeUpdateInteractionSpec,
  storyOutlineRegeneratorInteractionSpec,
  worldTickInteractionSpec,
} from "./runtime"
import {
  sourceIngestAnalysisInteractionSpec,
  sourceIngestGenerationInteractionSpec,
} from "./source-ingest"

export type RpgInteractionStage =
  | "source_ingest"
  | "page_merge"
  | "runtime_action_resolution"
  | "runtime_world_tick"
  | "runtime_recall_selector"
  | "runtime_outline_brief_compiler"
  | "runtime_story_outline_regenerator"
  | "runtime_narration"
  | "runtime_update"
  | "control_doc_import"
  | "campaign_setup_import"
  | "context_compiler"
  | "derivation"
  | "outline"

export interface RpgInteractionRegistryEntry<TInput = never, TOutput = unknown> {
  kind: RpgInteractionKind
  stage: RpgInteractionStage
  usesLlm: boolean
  implemented: true
  spec?: RpgInteractionSpec<TInput, TOutput>
  contract?: unknown
  notes?: readonly string[]
  buildPrompt?: (input: TInput) => RpgInteractionPrompt
  parseOutput?: (output: string, input: TInput) => TOutput
}

export const rpgInteractionRegistryEntries = [
  {
    kind: "source_ingest_analysis",
    stage: "source_ingest",
    usesLlm: true,
    implemented: true,
    spec: sourceIngestAnalysisInteractionSpec,
  },
  {
    kind: "source_ingest_generation",
    stage: "source_ingest",
    usesLlm: true,
    implemented: true,
    spec: sourceIngestGenerationInteractionSpec,
  },
  {
    kind: "page_merge",
    stage: "page_merge",
    usesLlm: true,
    implemented: true,
    spec: pageMergeInteractionSpec,
  },
  {
    kind: "control_doc_canonicalization",
    stage: "control_doc_import",
    usesLlm: false,
    implemented: true,
    spec: controlDocCanonicalizationInteractionSpec,
    contract: controlDocImportContract,
    notes: controlDocImportContract.notes,
  },
  {
    kind: "campaign_setup_import_contract",
    stage: "campaign_setup_import",
    usesLlm: false,
    implemented: true,
    contract: campaignSetupImportContract,
    notes: [
      ...campaignSetupImportContract.reviewBoundaryNotes,
      ...campaignSetupImportContract.futurePressureBoundaryNotes,
      ...campaignSetupImportContract.abilityLikeInputReviewBoundaryNotes,
      ...campaignSetupImportContract.currentSceneBootstrapBoundaryNotes,
    ],
  },
  {
    kind: "action_resolver",
    stage: "runtime_action_resolution",
    usesLlm: true,
    implemented: true,
    spec: actionResolverInteractionSpec,
  },
  {
    kind: "world_tick",
    stage: "runtime_world_tick",
    usesLlm: true,
    implemented: true,
    spec: worldTickInteractionSpec,
  },
  {
    kind: "recall_selector",
    stage: "runtime_recall_selector",
    usesLlm: true,
    implemented: true,
    spec: recallSelectorInteractionSpec,
  },
  {
    kind: "outline_brief",
    stage: "runtime_outline_brief_compiler",
    usesLlm: true,
    implemented: true,
    spec: outlineBriefInteractionSpec,
  },
  {
    kind: "outline_regeneration",
    stage: "runtime_story_outline_regenerator",
    usesLlm: true,
    implemented: true,
    spec: storyOutlineRegeneratorInteractionSpec,
    notes: [
      "Step 14.5 contract only; not connected to runRpgTurn in this stage.",
      "Outputs provisionalOutlinePatch, outlineRevisionProposal, regenerationSafetyReport, and warnings only.",
      "Does not write wiki/, does not modify wiki/outlines/main.md, and does not create ordinary runtime updates.",
    ],
  },
  {
    kind: "narration_generator",
    stage: "runtime_narration",
    usesLlm: true,
    implemented: true,
    spec: narrationGeneratorInteractionSpec,
    notes: [
      "LLM 5 narration_generator contract is connected to runRpgTurn.",
      "Outputs TurnNarration runtime-only JSON, not RpgTurnResult, wiki writes, ordinary runtime updates, or outline proposals.",
      "parallelLineText display does not grant PC knowledge.",
    ],
  },
  {
    kind: "runtime_update_proposal",
    stage: "runtime_update",
    usesLlm: true,
    implemented: true,
    spec: runtimeUpdateInteractionSpec,
    notes: [
      "LLM 6 Runtime Update Proposal JSON contract.",
      "Uses structured current-turn sources before prose evidence.",
      "Does not stage pending updates, apply writes, modify writer/apply behavior, or auto-write outlines/main.md.",
    ],
  },
] as const satisfies readonly RpgInteractionRegistryEntry[]

export type ImplementedRpgInteractionKind = typeof rpgInteractionRegistryEntries[number]["kind"]

export const plannedRpgInteractionKinds = [
  "campaign_setup_generation",
  "relationship_derivation",
] as const satisfies readonly RpgInteractionKind[]

export function listRpgInteractionRegistryEntries(): readonly RpgInteractionRegistryEntry[] {
  return rpgInteractionRegistryEntries
}

export function listImplementedRpgInteractionKinds(): ImplementedRpgInteractionKind[] {
  return rpgInteractionRegistryEntries.map((entry) => entry.kind)
}

export function listPlannedRpgInteractionKinds(): readonly typeof plannedRpgInteractionKinds[number][] {
  return plannedRpgInteractionKinds
}

export function getRpgInteractionRegistryEntry(kind: RpgInteractionKind): RpgInteractionRegistryEntry | undefined {
  return rpgInteractionRegistryEntries.find((entry) => entry.kind === kind)
}

export function isRpgInteractionKindImplemented(kind: RpgInteractionKind): kind is ImplementedRpgInteractionKind {
  return getRpgInteractionRegistryEntry(kind) !== undefined
}
