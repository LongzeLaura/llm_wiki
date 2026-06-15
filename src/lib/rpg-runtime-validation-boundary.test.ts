import { describe, expect, it } from "vitest"
import {
  getRpgRuntimeValidationBoundaryPolicies,
  getRpgRuntimeValidationBoundaryPolicy,
} from "./rpg-runtime/validation-boundary"

describe("RPG runtime validation boundary policy", () => {
  it("derives boundary modes from the contract classification matrix", () => {
    expect(getRpgRuntimeValidationBoundaryPolicy("action_resolver")).toMatchObject({
      contractMode: "soft_semantic",
      persistenceHardBoundary: false,
      canonicalValidatorRole: "internal_audit",
    })
    expect(getRpgRuntimeValidationBoundaryPolicy("world_tick")).toMatchObject({
      contractMode: "soft_semantic",
      derivableProtocolBehavior: "compile_or_warn",
    })
    expect(getRpgRuntimeValidationBoundaryPolicy("recall_selector")).toMatchObject({
      contractMode: "allowlist_selection",
      canonicalValidatorRole: "allowlist_gate",
    })
    expect(getRpgRuntimeValidationBoundaryPolicy("runtime_update_proposal")).toMatchObject({
      contractMode: "hard_persistence",
      persistenceHardBoundary: true,
      canonicalValidatorRole: "persistence_gate",
    })
    expect(getRpgRuntimeValidationBoundaryPolicy("pending_update_persistence")).toMatchObject({
      contractMode: "deterministic_boundary",
      persistenceHardBoundary: true,
      canonicalValidatorRole: "deterministic_gate",
    })
  })

  it("keeps persistence hard boundaries concentrated at update, validation, and persistence gates", () => {
    const hardBoundarySteps = getRpgRuntimeValidationBoundaryPolicies()
      .filter((policy) => policy.persistenceHardBoundary)
      .map((policy) => policy.stepId)

    expect(hardBoundarySteps).toEqual([
      "runtime_update_proposal",
      "runtime_update_validation",
      "pending_update_persistence",
    ])
  })

  it("treats derivable protocol omissions as soft warning/compiler input rather than persistence acceptance", () => {
    const worldTickPolicy = getRpgRuntimeValidationBoundaryPolicy("world_tick")

    expect(worldTickPolicy.warningOnlyErrorCategories).toContain("derivable_protocol_omitted")
    expect(worldTickPolicy.turnInterruptErrorCategories).not.toContain("derivable_protocol_omitted")
    expect(worldTickPolicy.persistenceHardBoundary).toBe(false)

    const updatePolicy = getRpgRuntimeValidationBoundaryPolicy("runtime_update_proposal")
    expect(updatePolicy.warningOnlyErrorCategories).not.toContain("derivable_protocol_omitted")
    expect(updatePolicy.turnInterruptErrorCategories).toContain("derivable_protocol_omitted")
    expect(updatePolicy.derivableProtocolBehavior).toBe("hard_boundary_metadata")
  })

  it("documents deterministic pending staging and final apply gates", () => {
    const validationPolicy = getRpgRuntimeValidationBoundaryPolicy("runtime_update_validation")
    const pendingPolicy = getRpgRuntimeValidationBoundaryPolicy("pending_update_persistence")

    expect(validationPolicy.notes.join("\n")).toContain("do not consume soft semantic output directly")
    expect(pendingPolicy.notes.join("\n")).toContain("apply_pending remains the final filesystem write gate")
  })

  it("documents the five recovery and validation layers without extending them to persistence", () => {
    const softPolicy = getRpgRuntimeValidationBoundaryPolicy("action_resolver")
    const hardPolicy = getRpgRuntimeValidationBoundaryPolicy("runtime_update_proposal")

    expect(softPolicy.notes.join("\n")).toContain(
      "JSON extraction/local repair, loose draft coercion, optional repair-only retry, draft compiler, then canonical validation",
    )
    expect(hardPolicy.notes.join("\n")).toContain(
      "do not receive soft format recovery, loose draft coercion, or repair retry output as acceptance evidence",
    )
  })
})
