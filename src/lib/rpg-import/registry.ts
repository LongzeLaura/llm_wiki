import { campaignSetupImportModeSpec } from "./campaign-setup-import"
import { controlDocImportModeSpec } from "./control-doc-import"
import { runtimeUpdateApplyModeSpec } from "./runtime-update-apply"
import { sourceIngestModeSpec } from "./source-ingest"
import type { RpgImportMode, RpgImportModeSpec } from "./types"

const RPG_IMPORT_MODE_SPECS: Partial<Record<RpgImportMode, RpgImportModeSpec>> = {
  source_ingest: sourceIngestModeSpec,
  control_doc_import: controlDocImportModeSpec,
  campaign_setup_import: campaignSetupImportModeSpec,
  runtime_update_apply: runtimeUpdateApplyModeSpec,
}

export function getRpgImportModeSpec(
  mode: RpgImportMode,
): RpgImportModeSpec | undefined {
  return RPG_IMPORT_MODE_SPECS[mode]
}

export function listRpgImportModeSpecs(): RpgImportModeSpec[] {
  return Object.values(RPG_IMPORT_MODE_SPECS)
}
