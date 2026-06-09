import type { LlmConfig } from "@/stores/wiki-store"

export type RpgImportMode =
  | "source_ingest"
  | "control_doc_import"
  | "campaign_setup_import"
  | "runtime_update_apply"

export interface RpgImportRequest {
  mode: RpgImportMode
  projectPath: string
  sourcePath?: string
  sourceText?: string
  sourceFileName?: string
  targetSlot?: string
  llmConfig?: LlmConfig
  signal?: AbortSignal
  folderContext?: string
  options?: Record<string, unknown>
}

export interface RpgImportResult {
  mode: RpgImportMode
  writtenPaths: string[]
  reviewItems: unknown[]
  warnings: string[]
  skipped: string[]
}

export interface RpgImportModeSpec {
  mode: RpgImportMode
  run: (request: RpgImportRequest) => Promise<RpgImportResult>
}
