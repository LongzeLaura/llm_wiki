import { getRpgImportModeSpec } from "./registry"
import type { RpgImportRequest, RpgImportResult } from "./types"

export async function runRpgImport(
  request: RpgImportRequest,
): Promise<RpgImportResult> {
  const spec = getRpgImportModeSpec(request.mode)
  if (!spec) {
    throw new Error(`RPG import mode "${request.mode}" is not registered.`)
  }
  return spec.run(request)
}
