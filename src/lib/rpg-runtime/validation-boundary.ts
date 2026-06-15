import type { RpgRuntimeDebugStepId } from "./debug-trace"
import {
  getRpgRuntimeContractClassificationMatrix,
  getRpgRuntimeContractStageMatrix,
  type RpgRuntimeContractErrorCategory,
  type RpgRuntimeContractStageMatrix,
} from "./contract-classification"

export type RpgRuntimeValidationBoundaryMode = RpgRuntimeContractStageMatrix["contractMode"]

export type RpgRuntimeValidationInterruptBehavior =
  | "soft_semantic_interrupts_only_on_semantic_or_safety_errors"
  | "allowlist_selection_interrupts_on_selection_contract_errors"
  | "hard_persistence_interrupts_on_any_persistence_contract_error"
  | "deterministic_boundary_interrupts_on_gate_failure"

export type RpgRuntimeDerivableProtocolBehavior =
  | "compile_or_warn"
  | "deterministic_gate"
  | "hard_boundary_metadata"
  | "not_applicable"

export interface RpgRuntimeValidationBoundaryPolicy {
  stepId: RpgRuntimeDebugStepId
  stageLabel: string
  contractMode: RpgRuntimeValidationBoundaryMode
  interruptBehavior: RpgRuntimeValidationInterruptBehavior
  persistenceHardBoundary: boolean
  turnInterruptErrorCategories: readonly RpgRuntimeContractErrorCategory[]
  warningOnlyErrorCategories: readonly RpgRuntimeContractErrorCategory[]
  reviewSignalErrorCategories: readonly RpgRuntimeContractErrorCategory[]
  derivableProtocolBehavior: RpgRuntimeDerivableProtocolBehavior
  canonicalValidatorRole: "internal_audit" | "allowlist_gate" | "persistence_gate" | "deterministic_gate"
  notes: readonly string[]
}

const SOFT_WARNING_CATEGORIES = ["derivable_protocol_omitted"] as const satisfies readonly RpgRuntimeContractErrorCategory[]
const SOFT_REVIEW_CATEGORIES = [
  "forbidden_persistence_claim",
  "forbidden_write_target",
] as const satisfies readonly RpgRuntimeContractErrorCategory[]

export function getRpgRuntimeValidationBoundaryPolicy(
  stepId: RpgRuntimeDebugStepId,
): RpgRuntimeValidationBoundaryPolicy {
  return buildRpgRuntimeValidationBoundaryPolicy(getRpgRuntimeContractStageMatrix(stepId))
}

export function getRpgRuntimeValidationBoundaryPolicies(): readonly RpgRuntimeValidationBoundaryPolicy[] {
  return getRpgRuntimeContractClassificationMatrix().map(buildRpgRuntimeValidationBoundaryPolicy)
}

function buildRpgRuntimeValidationBoundaryPolicy(
  stage: RpgRuntimeContractStageMatrix,
): RpgRuntimeValidationBoundaryPolicy {
  if (stage.contractMode === "soft_semantic") {
    return {
      stepId: stage.stepId,
      stageLabel: stage.stageLabel,
      contractMode: stage.contractMode,
      interruptBehavior: "soft_semantic_interrupts_only_on_semantic_or_safety_errors",
      persistenceHardBoundary: false,
      turnInterruptErrorCategories: withoutCategories(stage.defaultErrorCategories, SOFT_WARNING_CATEGORIES),
      warningOnlyErrorCategories: SOFT_WARNING_CATEGORIES,
      reviewSignalErrorCategories: SOFT_REVIEW_CATEGORIES,
      derivableProtocolBehavior: "compile_or_warn",
      canonicalValidatorRole: "internal_audit",
      notes: [
        "Soft format recovery order is JSON extraction/local repair, loose draft coercion, optional repair-only retry, draft compiler, then canonical validation.",
        "Soft semantic stages may still interrupt on malformed JSON, missing semantic fields, invalid enums, unsafe knowledge boundaries, unknown references, or forbidden output.",
        "derivable_protocol_omitted is not a persistence acceptance path; local compilers either derive the protocol field or surface a warning/invariant failure.",
      ],
    }
  }

  if (stage.contractMode === "allowlist_selection") {
    return {
      stepId: stage.stepId,
      stageLabel: stage.stageLabel,
      contractMode: stage.contractMode,
      interruptBehavior: "allowlist_selection_interrupts_on_selection_contract_errors",
      persistenceHardBoundary: false,
      turnInterruptErrorCategories: stage.defaultErrorCategories,
      warningOnlyErrorCategories: [],
      reviewSignalErrorCategories: [],
      derivableProtocolBehavior: "deterministic_gate",
      canonicalValidatorRole: "allowlist_gate",
      notes: [
        "Recall selection is a model-authored allowlist plan only; deterministic local readers own file content and budget policy.",
      ],
    }
  }

  if (stage.contractMode === "hard_persistence") {
    return {
      stepId: stage.stepId,
      stageLabel: stage.stageLabel,
      contractMode: stage.contractMode,
      interruptBehavior: "hard_persistence_interrupts_on_any_persistence_contract_error",
      persistenceHardBoundary: true,
      turnInterruptErrorCategories: uniqueCategories([...stage.defaultErrorCategories, "derivable_protocol_omitted"]),
      warningOnlyErrorCategories: [],
      reviewSignalErrorCategories: ["forbidden_persistence_claim", "forbidden_write_target", "unsafe_knowledge_boundary"],
      derivableProtocolBehavior: "hard_boundary_metadata",
      canonicalValidatorRole: "persistence_gate",
      notes: [
        "Hard persistence stages connect to wiki write intent and must keep target path, happened status, visibility, actor knowledge, and reveal boundaries strict.",
        "Hard persistence stages do not receive soft format recovery, loose draft coercion, or repair retry output as acceptance evidence.",
        "Compiler-derived metadata may support validation, but omitted derivable protocol never accepts an unsafe write.",
        "Runtime Update Proposal is the only LLM-facing write-intent contract; deterministic validation and pending persistence decide acceptance.",
      ],
    }
  }

  return {
    stepId: stage.stepId,
    stageLabel: stage.stageLabel,
    contractMode: stage.contractMode,
    interruptBehavior: "deterministic_boundary_interrupts_on_gate_failure",
    persistenceHardBoundary: true,
    turnInterruptErrorCategories: stage.defaultErrorCategories,
    warningOnlyErrorCategories: [],
    reviewSignalErrorCategories: ["forbidden_persistence_claim", "forbidden_write_target", "unsafe_knowledge_boundary"],
    derivableProtocolBehavior: "deterministic_gate",
    canonicalValidatorRole: "deterministic_gate",
    notes: [
      "Deterministic runtime boundaries do not consume soft semantic output directly; they gate accepted proposals before staging or persistence.",
      "Pending update persistence only stages validated accepted updates; apply_pending remains the final filesystem write gate and rechecks status, target policy, and wiki path containment.",
    ],
  }
}

function withoutCategories(
  categories: readonly RpgRuntimeContractErrorCategory[],
  excluded: readonly RpgRuntimeContractErrorCategory[],
): readonly RpgRuntimeContractErrorCategory[] {
  const excludedSet = new Set(excluded)
  return categories.filter((category) => !excludedSet.has(category))
}

function uniqueCategories(
  categories: readonly RpgRuntimeContractErrorCategory[],
): readonly RpgRuntimeContractErrorCategory[] {
  return [...new Set(categories)]
}
