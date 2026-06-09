import { campaignSetupImportContract } from "./campaign-setup"
import {
  controlDocCanonicalizationInteractionSpec,
  controlDocImportContract,
} from "./control-doc"
import type { RpgInteractionKind, RpgInteractionPrompt, RpgInteractionSpec } from "./interaction-spec"
import { pageMergeInteractionSpec } from "./merge"
import { narrationInteractionSpec, runtimeUpdateInteractionSpec } from "./runtime"
import {
  sourceIngestAnalysisInteractionSpec,
  sourceIngestGenerationInteractionSpec,
} from "./source-ingest"

export type RpgInteractionStage =
  | "source_ingest"
  | "page_merge"
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
    kind: "narration",
    stage: "runtime_narration",
    usesLlm: true,
    implemented: true,
    spec: narrationInteractionSpec,
  },
  {
    kind: "runtime_state_update",
    stage: "runtime_update",
    usesLlm: true,
    implemented: true,
    spec: runtimeUpdateInteractionSpec,
  },
] as const satisfies readonly RpgInteractionRegistryEntry[]

export type ImplementedRpgInteractionKind = typeof rpgInteractionRegistryEntries[number]["kind"]

export const plannedRpgInteractionKinds = [
  "campaign_setup_generation",
  "relationship_derivation",
  "outline_impact",
  "outline_regeneration",
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
