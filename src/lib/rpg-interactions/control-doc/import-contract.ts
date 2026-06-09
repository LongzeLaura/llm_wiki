import {
  getRpgSchemaSlot,
  type RpgSchemaSlot,
  type RpgSchemaSlotWritePolicy,
} from "@/lib/rpg-wiki-schema"

export const CONTROL_DOC_IMPORT_TARGET_SLOTS = [
  "main_outline",
  "outline_progress",
  "rules_core",
  "style_narration",
] as const

export type ControlDocImportTargetSlot = (typeof CONTROL_DOC_IMPORT_TARGET_SLOTS)[number]

export interface ControlDocImportSlotDefinition {
  slotId: ControlDocImportTargetSlot
  title: string
  targetPath: string
  writePolicy: RpgSchemaSlotWritePolicy
  reviewPolicy: string
  canonicalizationNote: string
}

export interface ControlDocImportContract {
  mode: "control_doc_import"
  supportedSlots: readonly ControlDocImportTargetSlot[]
  usesLlmByDefault: false
  deterministicBoundary: string
  slotDefinitions: readonly ControlDocImportSlotDefinition[]
  notes: readonly string[]
}

export const CONTROL_DOC_IMPORT_CONTRACT_NOTES = [
  "control_doc_import currently performs deterministic faithful canonicalization.",
  "The canonicalization prompt spec is a model contract boundary and future optional entrypoint, not the current default import behavior.",
  "Control document imports preserve author/GM control semantics and must not convert future outlines or possible futures into confirmed events.",
  "rpg-import/control-doc-import.ts owns file reads, safe writes, manual confirmation, and review item generation.",
] as const

export function isControlDocImportTargetSlot(value: string): value is ControlDocImportTargetSlot {
  return CONTROL_DOC_IMPORT_TARGET_SLOTS.some((slot) => slot === value)
}

export function resolveControlDocImportSlot(targetSlot: ControlDocImportTargetSlot): ControlDocImportSlotDefinition {
  const schemaSlot = getRpgSchemaSlot(targetSlot)
  if (!schemaSlot) {
    throw new Error(`control_doc_import targetSlot "${targetSlot}" is missing from the RPG schema slot registry.`)
  }

  return {
    slotId: targetSlot,
    title: controlDocSlotTitle(targetSlot),
    targetPath: schemaSlot.path,
    writePolicy: controlDocWritePolicy(targetSlot, schemaSlot),
    reviewPolicy: controlDocReviewPolicy(targetSlot),
    canonicalizationNote: controlDocCanonicalizationNote(targetSlot),
  }
}

export function getControlDocImportTargetPath(targetSlot: string): string | undefined {
  if (!isControlDocImportTargetSlot(targetSlot)) return undefined
  return resolveControlDocImportSlot(targetSlot).targetPath
}

export const controlDocImportContract: ControlDocImportContract = {
  mode: "control_doc_import",
  supportedSlots: CONTROL_DOC_IMPORT_TARGET_SLOTS,
  usesLlmByDefault: false,
  deterministicBoundary: "deterministic_faithful_canonicalization",
  slotDefinitions: CONTROL_DOC_IMPORT_TARGET_SLOTS.map(resolveControlDocImportSlot),
  notes: CONTROL_DOC_IMPORT_CONTRACT_NOTES,
}

function controlDocSlotTitle(slot: ControlDocImportTargetSlot): string {
  switch (slot) {
    case "main_outline":
      return "Main Outline"
    case "outline_progress":
      return "Outline Progress"
    case "rules_core":
      return "Core Rules"
    case "style_narration":
      return "Narration Style"
  }
}

function controlDocWritePolicy(
  slot: ControlDocImportTargetSlot,
  schemaSlot: RpgSchemaSlot,
): RpgSchemaSlotWritePolicy {
  if (slot === "outline_progress") {
    return "merge"
  }
  return schemaSlot.writePolicy
}

function controlDocReviewPolicy(slot: ControlDocImportTargetSlot): string {
  if (slot === "outline_progress") {
    return "review_required_for_initialization_then_runtime_pending_review"
  }
  return "manual_confirm_before_runtime_or_silent_overwrite"
}

function controlDocCanonicalizationNote(slot: ControlDocImportTargetSlot): string {
  if (slot === "outline_progress") {
    return "faithful_initialization_only_empty_or_opening_progress_allowed"
  }
  return "faithful_normalization_only_no_lossy_source_ingest"
}
