import { describe, expect, it } from "vitest"
import { RPG_RUNTIME_DEBUG_STEP_DEFINITIONS } from "./rpg-runtime/debug-trace"
import {
  getRpgRuntimeContractClassificationMatrix,
  RPG_RUNTIME_CONTRACT_ERROR_CATEGORIES,
  RPG_RUNTIME_CONTRACT_FIELD_CATEGORIES,
  type RpgRuntimeContractFieldCategory,
} from "./rpg-runtime/contract-classification"

describe("RPG runtime contract classification matrix", () => {
  it("has a matrix entry for every runtime debug step", () => {
    const matrix = getRpgRuntimeContractClassificationMatrix()

    expect(matrix.map((entry) => entry.stepId)).toEqual(
      RPG_RUNTIME_DEBUG_STEP_DEFINITIONS.map((definition) => definition.stepId),
    )
  })

  it("uses only stable field and error category names", () => {
    const validFieldCategories = new Set<RpgRuntimeContractFieldCategory>(RPG_RUNTIME_CONTRACT_FIELD_CATEGORIES)
    const validErrorCategories = new Set<string>(RPG_RUNTIME_CONTRACT_ERROR_CATEGORIES)

    expect([...validErrorCategories]).toEqual([
      "json_extract_failed",
      "malformed_json",
      "loose_scalar_array",
      "loose_single_object_array",
      "null_optional_field",
      "missing_semantic_field",
      "invalid_semantic_enum",
      "unsafe_knowledge_boundary",
      "unknown_reference",
      "derivable_protocol_omitted",
      "forbidden_safety_key",
      "forbidden_persistence_claim",
      "forbidden_write_target",
      "compiler_invariant_failed",
      "canonical_validation_failed",
      "provider_transport_failure",
      "blocked_by_previous_failure",
    ])

    for (const stage of getRpgRuntimeContractClassificationMatrix()) {
      expect(stage.fields.length, stage.stepId).toBeGreaterThan(0)
      for (const field of stage.fields) {
        expect(validFieldCategories.has(field.category), `${stage.stepId}:${field.fieldPath}`).toBe(true)
        if (field.errorCategory) {
          expect(validErrorCategories.has(field.errorCategory), `${stage.stepId}:${field.fieldPath}`).toBe(true)
        }
      }
      for (const category of stage.defaultErrorCategories) {
        expect(validErrorCategories.has(category), `${stage.stepId}:${category}`).toBe(true)
      }
    }
  })

  it("keeps optional-by-design fields out of semantic-required and not-optional classifications", () => {
    for (const stage of getRpgRuntimeContractClassificationMatrix()) {
      for (const field of stage.fields) {
        if (!field.optionalByDesign) continue
        expect(field.category, `${stage.stepId}:${field.fieldPath}`).toBe("derivable_protocol")
        expect(field.notOptional, `${stage.stepId}:${field.fieldPath}`).not.toBe(true)
      }
    }
  })

  it("classifies World Tick affected paths and envelopes as derivable protocol", () => {
    const worldTick = getRpgRuntimeContractClassificationMatrix().find((entry) => entry.stepId === "world_tick")
    const derivable = new Set(
      worldTick?.fields.filter((field) => field.category === "derivable_protocol").map((field) => field.fieldPath),
    )

    expect(derivable.has("worldDeltas.*[].affectedPaths")).toBe(true)
    expect(derivable.has("worldDeltas.*[].runtimeDeltaRefs")).toBe(true)
    expect(derivable.has("worldDeltas.*[].visibility")).toBe(true)
    expect(derivable.has("clockUpdates[].timeDeltaBasis")).toBe(true)
    expect(derivable.has("references[]")).toBe(true)
  })

  it("keeps hard persistence boundaries concentrated at update and persistence steps", () => {
    const nonPersistenceSteps = new Set([
      "action_resolver",
      "world_tick",
      "recall_selector",
      "outline_brief",
      "story_outline_regenerator",
      "narration_generator",
    ])

    for (const stage of getRpgRuntimeContractClassificationMatrix()) {
      const hardFields = stage.fields.filter((field) => field.category === "persistence_hard_boundary")
      if (nonPersistenceSteps.has(stage.stepId)) {
        expect(hardFields, stage.stepId).toEqual([])
      }
    }

    const updateProposal = getRpgRuntimeContractClassificationMatrix().find(
      (entry) => entry.stepId === "runtime_update_proposal",
    )
    expect(updateProposal?.contractMode).toBe("hard_persistence")
    expect(updateProposal?.fields.some((field) => field.category === "persistence_hard_boundary")).toBe(true)
    expect(updateProposal?.fields.some((field) => field.fieldPath === "target path policy")).toBe(true)

    const updateValidation = getRpgRuntimeContractClassificationMatrix().find(
      (entry) => entry.stepId === "runtime_update_validation",
    )
    const pendingPersistence = getRpgRuntimeContractClassificationMatrix().find(
      (entry) => entry.stepId === "pending_update_persistence",
    )
    expect(updateValidation?.contractMode).toBe("deterministic_boundary")
    expect(pendingPersistence?.contractMode).toBe("deterministic_boundary")
    expect(updateValidation?.fields.every((field) => field.category !== "derivable_protocol")).toBe(true)
    expect(pendingPersistence?.fields.every((field) => field.category !== "derivable_protocol")).toBe(true)
  })

  it("marks critical semantic fields as not optional", () => {
    const matrix = getRpgRuntimeContractClassificationMatrix()
    const requiredFieldPaths = [
      ["action_resolver", "eventDraft.summary"],
      ["world_tick", "worldDeltas.*[].summary"],
      ["outline_brief", "playerFacingBrief.summary"],
      ["narration_generator", "playerFacingText"],
      ["runtime_update_proposal", "proposedWikiUpdates[].targetPath"],
      ["runtime_update_proposal", "proposedWikiUpdates[].content"],
    ] as const

    for (const [stepId, fieldPath] of requiredFieldPaths) {
      const field = matrix.find((stage) => stage.stepId === stepId)?.fields.find((entry) => entry.fieldPath === fieldPath)
      expect(field?.category, `${stepId}:${fieldPath}`).toBe("semantic_required")
      expect(field?.notOptional, `${stepId}:${fieldPath}`).toBe(true)
      expect(field?.optionalByDesign, `${stepId}:${fieldPath}`).not.toBe(true)
    }
  })
})
