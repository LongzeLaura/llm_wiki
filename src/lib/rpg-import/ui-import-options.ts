import {
  CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS,
  type CampaignSetupImportTargetSlot,
} from "./campaign-setup-import"
import {
  CONTROL_DOC_IMPORT_TARGET_SLOTS,
  type ControlDocImportTargetSlot,
} from "./control-doc-import"
import type { RpgImportMode } from "./types"

export const DEFAULT_RPG_IMPORT_UI_OPTION_ID = "source_ingest" as const

type SourceIngestOptionId = typeof DEFAULT_RPG_IMPORT_UI_OPTION_ID
type ControlDocOptionId = `control_doc_import:${ControlDocImportTargetSlot}`
type CampaignSetupOptionId = `campaign_setup_import:${CampaignSetupImportTargetSlot}`

export type RpgImportUiOptionId =
  | SourceIngestOptionId
  | ControlDocOptionId
  | CampaignSetupOptionId

export type RpgImportUiGroup =
  | "source_ingest"
  | "control_doc_import"
  | "campaign_setup_import"

export interface RpgImportUiOption {
  id: RpgImportUiOptionId
  group: RpgImportUiGroup
  mode: Exclude<RpgImportMode, "runtime_update_apply">
  targetSlot?: ControlDocImportTargetSlot | CampaignSetupImportTargetSlot
  labelKey: string
  descriptionKey: string
  allowMultipleFiles: boolean
  requiresSingleFile: boolean
  nameOption?: "questName" | "relationshipName"
  confirmation?: "control_overwrite" | "current_scene_bootstrap"
}

export interface RpgImportUiSelectionInput {
  optionId?: string
  questName?: string
  relationshipName?: string
  explicitBootstrap?: boolean
  manualConfirm?: boolean
  allowOverwrite?: boolean
}

export interface ResolvedRpgImportUiSelection {
  option: RpgImportUiOption
  mode: Exclude<RpgImportMode, "runtime_update_apply">
  targetSlot?: string
  options: Record<string, unknown>
}

const CONTROL_DOC_UI_SLOTS: readonly ControlDocImportTargetSlot[] = [
  "main_outline",
  "outline_progress",
  "rules_core",
  "style_narration",
]

const CAMPAIGN_SETUP_UI_SLOTS: readonly CampaignSetupImportTargetSlot[] = [
  "player_main",
  "current_scene",
  "events_prologue",
  "main_quest",
  "quest",
  "player_relationship",
]

export const RPG_IMPORT_UI_OPTIONS: readonly RpgImportUiOption[] = [
  {
    id: DEFAULT_RPG_IMPORT_UI_OPTION_ID,
    group: "source_ingest",
    mode: "source_ingest",
    labelKey: "sources.rpgImport.options.sourceIngest.label",
    descriptionKey: "sources.rpgImport.options.sourceIngest.description",
    allowMultipleFiles: true,
    requiresSingleFile: false,
  },
  ...CONTROL_DOC_UI_SLOTS.map((slot) => ({
    id: controlDocOptionId(slot),
    group: "control_doc_import" as const,
    mode: "control_doc_import" as const,
    targetSlot: slot,
    labelKey: `sources.rpgImport.options.controlDoc.${slot}.label`,
    descriptionKey: `sources.rpgImport.options.controlDoc.${slot}.description`,
    allowMultipleFiles: false,
    requiresSingleFile: true,
    confirmation: "control_overwrite" as const,
  })),
  ...CAMPAIGN_SETUP_UI_SLOTS.map((slot) => ({
    id: campaignSetupOptionId(slot),
    group: "campaign_setup_import" as const,
    mode: "campaign_setup_import" as const,
    targetSlot: slot,
    labelKey: `sources.rpgImport.options.campaignSetup.${slot}.label`,
    descriptionKey: `sources.rpgImport.options.campaignSetup.${slot}.description`,
    allowMultipleFiles: false,
    requiresSingleFile: true,
    nameOption: slot === "quest"
      ? "questName" as const
      : slot === "player_relationship"
        ? "relationshipName" as const
        : undefined,
    confirmation: slot === "current_scene" ? "current_scene_bootstrap" as const : undefined,
  })),
] as const

export function getDefaultRpgImportUiOption(): RpgImportUiOption {
  return RPG_IMPORT_UI_OPTIONS[0]
}

export function getRpgImportUiOption(optionId: string | undefined): RpgImportUiOption {
  return RPG_IMPORT_UI_OPTIONS.find((option) => option.id === optionId)
    ?? getDefaultRpgImportUiOption()
}

export function resolveRpgImportUiSelection(
  input: RpgImportUiSelectionInput = {},
): ResolvedRpgImportUiSelection {
  const option = getRpgImportUiOption(input.optionId)
  const options: Record<string, unknown> = {}

  if (option.mode === "control_doc_import") {
    if (input.manualConfirm) options.manualConfirm = true
    if (input.allowOverwrite) options.allowOverwrite = true
  }

  if (option.mode === "campaign_setup_import") {
    if (option.targetSlot === "quest") {
      const questName = normalizeOptionalName(input.questName)
      if (questName) options.questName = questName
    }

    if (option.targetSlot === "player_relationship") {
      const relationshipName = normalizeOptionalName(input.relationshipName)
      if (relationshipName) options.relationshipName = relationshipName
    }

    if (option.targetSlot === "current_scene" && input.explicitBootstrap) {
      options.explicitBootstrap = true
    }
  }

  return {
    option,
    mode: option.mode,
    targetSlot: option.targetSlot,
    options,
  }
}

export function controlDocOptionId(slot: ControlDocImportTargetSlot): ControlDocOptionId {
  assertUiExposesControlDocSlot(slot)
  return `control_doc_import:${slot}`
}

export function campaignSetupOptionId(slot: CampaignSetupImportTargetSlot): CampaignSetupOptionId {
  assertUiExposesCampaignSetupSlot(slot)
  return `campaign_setup_import:${slot}`
}

function normalizeOptionalName(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function assertUiExposesControlDocSlot(slot: ControlDocImportTargetSlot): void {
  if (!CONTROL_DOC_UI_SLOTS.includes(slot)) {
    throw new Error(`Control Doc Import slot "${slot}" is not exposed in the file import UI.`)
  }
}

function assertUiExposesCampaignSetupSlot(slot: CampaignSetupImportTargetSlot): void {
  if (!CAMPAIGN_SETUP_UI_SLOTS.includes(slot)) {
    throw new Error(`Campaign Setup Import slot "${slot}" is not exposed in the file import UI.`)
  }
}

export function listControlDocUiSlots(): readonly ControlDocImportTargetSlot[] {
  return CONTROL_DOC_UI_SLOTS
}

export function listCampaignSetupUiSlots(): readonly CampaignSetupImportTargetSlot[] {
  return CAMPAIGN_SETUP_UI_SLOTS
}

export function assertRpgImportUiOptionsMatchSupportedSlots(): void {
  const missingControlSlots = CONTROL_DOC_UI_SLOTS.filter(
    (slot) => !CONTROL_DOC_IMPORT_TARGET_SLOTS.includes(slot),
  )
  const missingCampaignSlots = CAMPAIGN_SETUP_UI_SLOTS.filter(
    (slot) => !CAMPAIGN_SETUP_IMPORT_TARGET_SLOTS.includes(slot),
  )

  if (missingControlSlots.length > 0 || missingCampaignSlots.length > 0) {
    throw new Error(
      [
        ...missingControlSlots.map((slot) => `Unsupported control_doc_import UI slot: ${slot}`),
        ...missingCampaignSlots.map((slot) => `Unsupported campaign_setup_import UI slot: ${slot}`),
      ].join("\n"),
    )
  }
}
