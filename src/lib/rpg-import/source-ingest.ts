import { autoIngest } from "@/lib/ingest"
import type { RpgImportModeSpec, RpgImportRequest, RpgImportResult } from "./types"

export async function runSourceIngestImport(
  request: RpgImportRequest,
): Promise<RpgImportResult> {
  if (!request.sourcePath) {
    throw new Error("source_ingest import requires sourcePath.")
  }
  if (!request.llmConfig) {
    throw new Error("source_ingest import requires llmConfig.")
  }

  const writtenPaths = await autoIngest(
    request.projectPath,
    request.sourcePath,
    request.llmConfig,
    request.signal,
    request.folderContext,
  )

  return {
    mode: "source_ingest",
    writtenPaths,
    reviewItems: [],
    warnings: [],
    skipped: [],
  }
}

export const sourceIngestModeSpec: RpgImportModeSpec = {
  mode: "source_ingest",
  run: runSourceIngestImport,
}
